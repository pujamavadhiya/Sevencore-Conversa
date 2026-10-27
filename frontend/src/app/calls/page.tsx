"use client";

import React, { useState, useEffect } from "react";
import { PhoneCall, Download, Search, Filter, FileText, CheckCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { CallAttempt } from "@/types";

export default function CallsPage() {
  const [calls, setCalls] = useState<CallAttempt[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallAttempt | null>(null);

  useEffect(() => {
    loadCalls();
  }, [statusFilter, search]);

  const loadCalls = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const data = await api.getCalls(params);
      setCalls(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Call History & Records</h1>
          <p className="subtitle">
            Inspect all Indian voice call attempts, durations, telephony gateway outcomes, and Sarvam cost calculations.
          </p>
        </div>
        <a href="http://localhost:8000/api/v1/calls/export_csv/" className="btn btn-secondary">
          <Download size={14} /> Export Call Logs (CSV)
        </a>
      </div>

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "13px" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "38px" }}
            placeholder="Search by contact name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ width: "200px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Call Statuses</option>
          <option value="connected">Connected & Answered</option>
          <option value="no_answer">No Answer / Ring Timeout</option>
          <option value="busy">Line Busy</option>
          <option value="failed">Failed / NDNC Blocked</option>
          <option value="initiated">Initiated</option>
        </select>
      </div>

      {/* Call History Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Phone Number</th>
              <th>Agent</th>
              <th>Campaign</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Cost (INR)</th>
              <th>Mode</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No call attempts match the selected filter.
                </td>
              </tr>
            ) : (
              calls.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: "600" }}>{c.contact_name || "Recipient"}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
                    {c.masked_phone_number || c.user_phone_number}
                  </td>
                  <td>{c.agent_name}</td>
                  <td style={{ color: "var(--text-secondary)" }}>{c.campaign_name || "Single Test Call"}</td>
                  <td>
                    <span
                      className={`badge ${
                        c.status === "connected"
                          ? "badge-connected"
                          : c.status === "initiated"
                          ? "badge-running"
                          : "badge-danger"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td>{c.duration_seconds > 0 ? `${c.duration_seconds}s` : "—"}</td>
                  <td style={{ fontWeight: "600" }}>₹{c.cost_inr}</td>
                  <td>
                    {c.is_mock ? (
                      <span className="badge badge-mock">MOCK</span>
                    ) : (
                      <span className="badge badge-success">LIVE SARVAM</span>
                    )}
                  </td>
                  <td>
                    {c.transcript ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedCall(c)}
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <FileText size={12} /> Transcript
                      </button>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No transcript</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Transcript Drawer Modal */}
      {selectedCall && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "18px" }}>Call Transcript</h2>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Call with {selectedCall.contact_name} ({selectedCall.masked_phone_number}) • {selectedCall.duration_seconds}s
                </div>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            {/* AI Disposition Banner */}
            {selectedCall.transcript && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "#EEF2FF", border: "1px solid #C7D2FE", marginBottom: "16px" }}>
                <div style={{ fontSize: "11px", color: "#4F46E5", textTransform: "uppercase", fontWeight: "700" }}>
                  AI Summary & Outcome
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "4px", lineHeight: "1.4" }}>
                  {selectedCall.transcript.summary}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <span className="badge badge-running">Disposition: {selectedCall.transcript.disposition}</span>
                  <span className="badge badge-success">Sentiment: {selectedCall.transcript.sentiment}</span>
                </div>
              </div>
            )}

            {/* Messages Feed */}
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "rgba(0,0,0,0.3)",
                padding: "16px",
                borderRadius: "10px",
              }}
            >
              {selectedCall.transcript?.messages?.map((m, idx) => (
                <div
                  key={idx}
                  className={m.role === "assistant" ? "turn-bubble turn-assistant" : "turn-bubble turn-user"}
                >
                  <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "2px" }}>
                    {m.role === "assistant" ? `${selectedCall.agent_name} (AI)` : selectedCall.contact_name} • {m.language_name}
                  </div>
                  {m.content}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button className="btn btn-secondary" onClick={() => setSelectedCall(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
