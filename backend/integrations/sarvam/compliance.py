import datetime
import zoneinfo
from typing import Tuple
from django.conf import settings
from apps.contacts.models import SuppressionEntry, Contact

def is_within_permitted_calling_hours(
    start_hour: int = None,
    end_hour: int = None
) -> Tuple[bool, str]:
    """
    Checks if current local time in India (Asia/Kolkata) falls within permitted commercial calling hours.
    TRAI Commercial Communications regulations mandate calling between 09:00 and 20:00 (8:00 PM).
    """
    start = start_hour if start_hour is not None else getattr(settings, "CALLING_WINDOW_START_HOUR", 9)
    end = end_hour if end_hour is not None else getattr(settings, "CALLING_WINDOW_END_HOUR", 20)
    
    try:
        ist_tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        now_ist = datetime.datetime.now(ist_tz)
    except Exception:
        # Fallback if zoneinfo is unavailable
        now_ist = datetime.datetime.now()

    current_hour = now_ist.hour
    
    if start <= current_hour < end:
        return True, f"Current IST time ({now_ist.strftime('%I:%M %p')}) is within permitted window ({start:02d}:00 to {end:02d}:00 IST)."
    
    return False, f"Current IST time ({now_ist.strftime('%I:%M %p')}) is OUTSIDE permitted commercial calling hours ({start:02d}:00 to {end:02d}:00 IST). Calling is suppressed."

def check_number_compliance(organization, phone_number: str) -> Tuple[bool, str]:
    """
    Checks if a phone number is eligible for calling under Indian telecom rules:
    1. Valid format
    2. Not in organization DND / Opt-out suppression list
    3. Not globally flagged as opted out
    """
    if not phone_number or not phone_number.startswith("+91") or len(phone_number) != 13:
        return False, "Invalid Indian phone number format. Must be +91 followed by 10 digits."

    # Check suppression registry
    if SuppressionEntry.objects.filter(organization=organization, phone_number=phone_number).exists():
        supp = SuppressionEntry.objects.filter(organization=organization, phone_number=phone_number).first()
        return False, f"Number is in DND/Suppression registry (Reason: {supp.reason})."

    # Check contact-level opt-out
    contact = Contact.objects.filter(organization=organization, phone_number=phone_number).first()
    if contact and contact.is_opted_out:
        return False, "Contact has explicitly opted out of voice calls."

    return True, "Number is eligible for calling."
