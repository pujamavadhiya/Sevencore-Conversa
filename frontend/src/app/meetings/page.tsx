"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Plus, CheckCircle, Clock, User, Phone, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Meeting, Contact } from "@/types";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | "">("");
  const [title, setTitle] = useState("Demo Consultation");
  const [dateTime, setDateTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mData, cData] = await Promise.all([api.getMeetings(), api.getContacts()]);
      setMeetings(Array.isArray(mData) ? mData : mData.results || []);
      setContacts(Array.isArray(cData) ? cData : cData.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId || !dateTime) return;

    try {
      await api.createMeeting({
        contact: Number(selectedContactId),
        title,
        scheduled_time: dateTime,
        notes,
        status: "confirmed",
      });
      setModalOpen(false);
      setTitle("Demo Consultation");
      setDateTime("");
      setNotes("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to schedule meeting");
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.updateMeeting(id, { status });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Follow-up Meetings & Lead Disposition</h1>
          <p className="subtitle">
            Track customer meetings, product demos, and callbacks requested during automated voice calls.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Schedule Follow-up
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Meeting Title</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Scheduled Time (IST)</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No meetings or follow-ups logged yet. When callers express interest, log callbacks here.
                </td>
              </tr>
            ) : (
              meetings.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: "600", color: "var(--text-primary)" }}>{m.title}</td>
                  <td>{m.contact_details?.name || "Customer"}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.contact_details?.phone_number || "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Clock size={14} color="var(--accent-primary)" />
                      {new Date(m.scheduled_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        m.status === "completed"
                          ? "badge-connected"
                          : m.status === "confirmed"
                          ? "badge-running"
                          : m.status === "requested"
                          ? "badge-pending"
                          : "badge-danger"
                      }`}
                    >
                      {m.status_display || m.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{m.notes || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {m.status !== "completed" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => updateStatus(m.id, "completed")}
                          title="Mark Completed"
                        >
                          <CheckCircle size={12} color="var(--accent-emerald)" />
                        </button>
                      )}
                      {m.status !== "cancelled" && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => updateStatus(m.id, "cancelled")}
                          title="Cancel"
                        >
                          <XCircle size={12} color="var(--accent-rose)" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Schedule Meeting Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Schedule Follow-up Meeting</h2>
            <form onSubmit={handleCreateMeeting}>
              <div className="form-group">
                <label className="form-label">Contact</label>
                <select
                  className="form-select"
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(Number(e.target.value))}
                  required
                >
                  <option value="">Select a contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Title / Agenda</label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 15-Minute Product Demo"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date & Time (IST)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Topics requested by customer on call..."
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
