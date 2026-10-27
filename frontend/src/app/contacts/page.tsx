"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Upload,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  FileSpreadsheet,
  Plus,
  Loader2,
  FileCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { Contact, SuppressionEntry } from "@/types";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"contacts" | "dnd">("contacts");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Single Contact Modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // Single DND Modal
  const [dndModalOpen, setDndModalOpen] = useState(false);
  const [dndPhone, setDndPhone] = useState("");
  const [dndReason, setDndReason] = useState("USER_OPT_OUT");

  useEffect(() => {
    loadContacts();
    loadSuppressions();
  }, [search]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getContacts(search);
      setContacts(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppressions = async () => {
    try {
      const data = await api.getSuppressions();
      setSuppressions(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      // ignore
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewData(null);
    setImportError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImporting(true);
      const preview = await api.previewImport(formData);
      setPreviewData(preview);
    } catch (err: any) {
      setImportError(err.message || "Failed to parse spreadsheet");
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    try {
      setImporting(true);
      setImportError(null);
      const formData = new FormData();
      formData.append("file", selectedFile);
      const result = await api.executeImport(formData);
      setImportSuccessMsg(`Successfully imported ${result.imported_count} contacts (${result.rejected_count} rejected).`);
      loadContacts();
      setTimeout(() => {
        setImportModalOpen(false);
        setSelectedFile(null);
        setPreviewData(null);
        setImportSuccessMsg(null);
      }, 1800);
    } catch (err: any) {
      setImportError(err.message || "Import execution failed");
    } finally {
      setImporting(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createContact({
        name: newName,
        phone_number: newPhone,
        company: newCompany,
        email: newEmail,
      });
      setContactModalOpen(false);
      setNewName("");
      setNewPhone("");
      setNewCompany("");
      setNewEmail("");
      loadContacts();
    } catch (err: any) {
      alert(err.message || "Error creating contact");
    }
  };

  const handleCreateDnd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSuppression({
        phone_number: dndPhone,
        reason: dndReason,
      });
      setDndModalOpen(false);
      setDndPhone("");
      loadSuppressions();
    } catch (err: any) {
      alert(err.message || "Error adding number to DND");
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Audience & Contact Management</h1>
          <p className="subtitle">
            Upload CSV/Excel spreadsheets, validate Indian phone numbers (+91), and manage TRAI DND opt-outs.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a
            href="http://localhost:8000/api/v1/contacts/sample_template/"
            download
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} /> Download Sample Template
          </a>
          <button className="btn btn-secondary btn-sm" onClick={() => setImportModalOpen(true)}>
            <Upload size={14} /> Import Spreadsheet
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setContactModalOpen(true)}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("contacts")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "contacts" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            color: activeTab === "contacts" ? "#FFFFFF" : "var(--text-muted)",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          All Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab("dnd")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "dnd" ? "2px solid var(--accent-rose)" : "2px solid transparent",
            color: activeTab === "dnd" ? "#FFFFFF" : "var(--text-muted)",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ShieldAlert size={14} color="var(--accent-rose)" /> DND & Opt-out Registry ({suppressions.length})
        </button>
      </div>

      {activeTab === "contacts" && (
        <>
          {/* Search Bar */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "13px" }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "38px" }}
                placeholder="Search contacts by name, Indian phone number, or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <a href="http://localhost:8000/api/v1/contacts/export_csv/" className="btn btn-secondary">
              <Download size={14} /> Export CSV
            </a>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Normalized Phone</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Compliance Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      No contacts found. Click "Import Spreadsheet" to bulk upload contacts.
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "600" }}>{c.name}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.phone_number}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.company || "—"}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.email || "—"}</td>
                      <td>
                        {c.is_opted_out ? (
                          <span className="badge badge-danger">OPTED OUT / DND</span>
                        ) : (
                          <span className="badge badge-success">CONSENT VERIFIED</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete contact ${c.name}?`)) {
                              await api.deleteContact(c.id);
                              loadContacts();
                            }
                          }}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "dnd" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Numbers in this registry are unconditionally suppressed across all campaigns to comply with TRAI NDNC and privacy regulations.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setDndModalOpen(true)}>
              <Plus size={14} /> Add Suppressed Number
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Suppressed Phone</th>
                  <th>Suppression Reason</th>
                  <th>Notes</th>
                  <th>Added At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                      Registry is empty. Opt-outs and TRAI NDNC numbers will appear here.
                    </td>
                  </tr>
                ) : (
                  suppressions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: "600" }}>{s.phone_number}</td>
                      <td>
                        <span className="badge badge-danger">{s.reason_display || s.reason}</span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{s.notes || "Auto-registered"}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                        {new Date(s.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${s.phone_number} from suppression registry?`)) {
                              await api.deleteSuppression(s.id);
                              loadSuppressions();
                            }
                          }}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Spreadsheet Import Modal with Validation Preview */}
      {importModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "680px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "6px" }}>Import Contacts Spreadsheet</h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              Upload your .csv or .xlsx file. The platform will validate Indian phone formats and inspect DND suppressions.
            </p>

            {/* Non-calling safety banner */}
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#C7D2FE",
                marginBottom: "20px",
              }}
            >
              🔒 <strong>Safety Assurance:</strong> Uploading contacts will <em>never</em> trigger calls automatically. You must create and explicitly confirm a campaign before any dial is made.
            </div>

            {importSuccessMsg && (
              <div style={{ padding: "12px", background: "var(--accent-emerald-bg)", color: "var(--accent-emerald)", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
                <CheckCircle size={16} style={{ display: "inline", marginRight: "6px" }} />
                {importSuccessMsg}
              </div>
            )}

            {importError && (
              <div style={{ padding: "12px", background: "var(--accent-rose-bg)", color: "var(--accent-rose)", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
                <AlertTriangle size={16} style={{ display: "inline", marginRight: "6px" }} />
                {importError}
              </div>
            )}

            {!previewData ? (
              <div
                style={{
                  border: "2px dashed var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "40px",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.01)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="file"
                  id="spreadsheet-file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <label htmlFor="spreadsheet-file" style={{ cursor: "pointer" }}>
                  <FileSpreadsheet size={44} color="var(--accent-primary)" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontWeight: "600", fontSize: "15px", color: "var(--text-primary)" }}>
                    Click to select CSV or Excel (.xlsx) file
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Columns supported: Name, Phone Number, Company, Email
                  </div>
                </label>
              </div>
            ) : (
              <div>
                {/* Preview Totals */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ padding: "12px", borderRadius: "8px", background: "#F8FAFC", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Rows in File</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)" }}>{previewData.total_rows}</div>
                  </div>
                  <div style={{ padding: "12px", borderRadius: "8px", background: "var(--accent-emerald-bg)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                    <div style={{ fontSize: "11px", color: "var(--accent-emerald)" }}>Valid Indian Records</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-emerald)" }}>{previewData.valid_count}</div>
                  </div>
                  <div style={{ padding: "12px", borderRadius: "8px", background: "var(--accent-rose-bg)", border: "1px solid rgba(244, 63, 94, 0.3)" }}>
                    <div style={{ fontSize: "11px", color: "var(--accent-rose)" }}>Rejected / DND Rows</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--accent-rose)" }}>{previewData.invalid_count}</div>
                  </div>
                </div>

                {/* Sample valid preview */}
                <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px", marginBottom: "20px" }}>
                  <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead style={{ background: "rgba(0,0,0,0.4)", position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ padding: "8px 12px" }}>Row</th>
                        <th style={{ padding: "8px 12px" }}>Name</th>
                        <th style={{ padding: "8px 12px" }}>Phone (E.164)</th>
                        <th style={{ padding: "8px 12px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.valid_preview.slice(0, 10).map((r: any) => (
                        <tr key={r.row} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px 12px" }}>{r.row}</td>
                          <td style={{ padding: "8px 12px" }}>{r.name}</td>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{r.phone_number}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span className="badge badge-success">Valid</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewData.invalid_preview.length > 0 && (
                  <div style={{ fontSize: "12px", color: "var(--accent-rose)", marginBottom: "16px" }}>
                    ⚠️ {previewData.invalid_count} rows will be rejected (e.g. {previewData.invalid_preview[0]?.reason})
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setImportModalOpen(false);
                  setSelectedFile(null);
                  setPreviewData(null);
                }}
              >
                Cancel
              </button>
              {previewData && (
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmImport}
                  disabled={importing || previewData.valid_count === 0}
                >
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                  Confirm & Import {previewData.valid_count} Contacts
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Add Contact Modal */}
      {contactModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Add Single Contact</h2>
            <form onSubmit={handleCreateContact}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98765 43210 or 9876543210"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setContactModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Add DND Modal */}
      {dndModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Add Number to DND Registry</h2>
            <form onSubmit={handleCreateDnd}>
              <div className="form-group">
                <label className="form-label">Phone Number to Suppress</label>
                <input
                  type="text"
                  className="form-input"
                  value={dndPhone}
                  onChange={(e) => setDndPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Suppression Reason</label>
                <select className="form-select" value={dndReason} onChange={(e) => setDndReason(e.target.value)}>
                  <option value="USER_OPT_OUT">Recipient Opt-out Request</option>
                  <option value="TRAI_NDNC">TRAI National Do Not Call Registry</option>
                  <option value="MANUAL_SUPPRESSION">Manually Suppressed by Admin</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDndModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Suppress Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
