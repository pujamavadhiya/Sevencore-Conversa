import io
import csv
import re
from typing import Dict, Any, List, Tuple
from apps.contacts.models import Contact, SuppressionEntry, ContactImport, normalize_indian_phone

def validate_indian_mobile(phone: str) -> Tuple[bool, str]:
    normalized = normalize_indian_phone(phone)
    if not normalized.startswith("+91") or len(normalized) != 13:
        return False, "Must be a valid 10-digit Indian phone number (e.g. +91 98765 43210)"
    digits = normalized[3:]
    if not digits.isdigit():
        return False, "Phone number contains non-numeric characters"
    if digits[0] not in ("6", "7", "8", "9", "0"):
        return False, "Indian mobile numbers typically start with 6, 7, 8, or 9"
    return True, normalized

def parse_contacts_file(file_obj, filename: str) -> List[Dict[str, Any]]:
    rows = []
    if filename.endswith(".csv"):
        # Handle UTF-8 with BOM or plain UTF-8
        content = file_obj.read()
        if isinstance(content, bytes):
            decoded = content.decode("utf-8-sig", errors="replace")
        else:
            decoded = content
        reader = csv.DictReader(io.StringIO(decoded))
        for row in reader:
            rows.append({k.strip().lower(): (v.strip() if v else "") for k, v in row.items() if k})
    elif filename.endswith((".xlsx", ".xls")):
        import openpyxl
        wb = openpyxl.load_workbook(file_obj, data_only=True)
        sheet = wb.active
        headers = []
        for col_idx, cell in enumerate(sheet.iter_rows(max_row=1, values_only=True)):
            headers = [str(h).strip().lower() if h is not None else f"col_{i}" for i, h in enumerate(cell)]
            break
        
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not any(row):
                continue
            row_dict = {}
            for i, val in enumerate(row):
                if i < len(headers):
                    row_dict[headers[i]] = str(val).strip() if val is not None else ""
            rows.append(row_dict)
    return rows

def preview_import_data(organization, file_obj, filename: str) -> Dict[str, Any]:
    raw_rows = parse_contacts_file(file_obj, filename)
    total_rows = len(raw_rows)
    valid_preview = []
    invalid_preview = []
    
    # Pre-fetch existing suppressions and phone numbers for this org
    suppressed_numbers = set(
        SuppressionEntry.objects.filter(organization=organization).values_list("phone_number", flat=True)
    )
    existing_numbers = set(
        Contact.objects.filter(organization=organization).values_list("phone_number", flat=True)
    )
    seen_in_batch = set()

    for idx, row in enumerate(raw_rows, start=1):
        # Flexible field mapping
        name = row.get("name") or row.get("full_name") or row.get("contact_name") or f"Contact {idx}"
        phone_raw = row.get("phone") or row.get("phone_number") or row.get("mobile") or row.get("contact_no") or row.get("phone number") or ""
        company = row.get("company") or row.get("company_name") or row.get("organization") or ""
        email = row.get("email") or row.get("email_address") or ""
        
        if not phone_raw:
            invalid_preview.append({"row": idx, "name": name, "phone": phone_raw, "reason": "Missing phone number"})
            continue

        is_valid, normalized_or_err = validate_indian_mobile(phone_raw)
        if not is_valid:
            invalid_preview.append({"row": idx, "name": name, "phone": phone_raw, "reason": normalized_or_err})
            continue

        phone = normalized_or_err
        if phone in suppressed_numbers:
            invalid_preview.append({"row": idx, "name": name, "phone": phone, "reason": "Phone number is in DND/Suppression registry"})
            continue

        if phone in seen_in_batch:
            invalid_preview.append({"row": idx, "name": name, "phone": phone, "reason": "Duplicate entry inside this spreadsheet"})
            continue

        seen_in_batch.add(phone)
        is_existing = phone in existing_numbers

        valid_preview.append({
            "row": idx,
            "name": name,
            "phone_number": phone,
            "company": company,
            "email": email,
            "is_update": is_existing,
            "custom_fields": {k: v for k, v in row.items() if k not in ("name", "phone", "phone_number", "mobile", "company", "email")}
        })

    return {
        "filename": filename,
        "total_rows": total_rows,
        "valid_count": len(valid_preview),
        "invalid_count": len(invalid_preview),
        "valid_preview": valid_preview[:50],  # sample preview
        "invalid_preview": invalid_preview[:50],
    }

def execute_import(organization, file_obj, filename: str) -> ContactImport:
    preview = preview_import_data(organization, file_obj, filename)
    file_obj.seek(0)
    raw_rows = parse_contacts_file(file_obj, filename)
    
    suppressed_numbers = set(
        SuppressionEntry.objects.filter(organization=organization).values_list("phone_number", flat=True)
    )
    seen_in_batch = set()
    imported_count = 0
    rejected_details = []

    for idx, row in enumerate(raw_rows, start=1):
        name = row.get("name") or row.get("full_name") or row.get("contact_name") or f"Contact {idx}"
        phone_raw = row.get("phone") or row.get("phone_number") or row.get("mobile") or row.get("contact_no") or ""
        company = row.get("company") or row.get("company_name") or ""
        email = row.get("email") or ""
        
        if not phone_raw:
            rejected_details.append({"row": idx, "name": name, "reason": "Missing phone number"})
            continue

        is_valid, normalized_or_err = validate_indian_mobile(phone_raw)
        if not is_valid:
            rejected_details.append({"row": idx, "name": name, "phone": phone_raw, "reason": normalized_or_err})
            continue

        phone = normalized_or_err
        if phone in suppressed_numbers:
            rejected_details.append({"row": idx, "name": name, "phone": phone, "reason": "DND / Opt-out suppressed"})
            continue

        if phone in seen_in_batch:
            rejected_details.append({"row": idx, "name": name, "phone": phone, "reason": "Duplicate within spreadsheet"})
            continue

        seen_in_batch.add(phone)
        custom_fields = {k: v for k, v in row.items() if k not in ("name", "phone", "phone_number", "mobile", "company", "email")}

        Contact.objects.update_or_create(
            organization=organization,
            phone_number=phone,
            defaults={
                "name": name,
                "company": company,
                "email": email,
                "custom_fields": custom_fields,
                "has_consent": True,
            }
        )
        imported_count += 1

    audit = ContactImport.objects.create(
        organization=organization,
        filename=filename,
        total_rows=len(raw_rows),
        imported_count=imported_count,
        rejected_count=len(rejected_details),
        rejection_details=rejected_details,
    )
    return audit
