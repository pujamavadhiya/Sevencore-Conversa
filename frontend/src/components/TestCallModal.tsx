"use client";

import React, { useState, useEffect } from "react";
import { Phone, X, CheckCircle, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent, CallAttempt } from "@/types";

interface TestCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TestCallModal({ isOpen, onClose, onSuccess }: TestCallModalProps) {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactName, setContactName] = useState("Demo Customer");
  const [bypassCompliance, setBypassCompliance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CallAttempt | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getAgents().then((data) => {
        const list = Array.isArray(data) ? data : data.results || [];
        setAgents(list);
        if (list.length > 0 && !selectedAgentId) {
          setSelectedAgentId(list[0].id);
        }
      }).catch(() => {});
      setError(null);
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) {
      setError("Please enter a phone number.");
      return;
    }
    if (!selectedAgentId) {
      setError("Please select a Voice Agent.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await api.testCall({
        phone_number: phoneNumber,
        agent_id: Number(selectedAgentId),
        contact_name: contactName,
        bypass_compliance: bypassCompliance,
      });
      setResult(resp);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to initiate test call");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "560px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <Phone size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "18px" }}>Dispatch Instant Test Call</h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Test conversational AI agent speech & flow before campaign launch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "var(--accent-rose-bg)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "8px",
              color: "var(--accent-rose)",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {!result ? (
          <form onSubmit={handleDispatch}>
            <div className="form-group">
              <label className="form-label">Voice Agent</label>
              <select
                className="form-select"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                required
              >
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.language_display || ag.primary_language})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Recipient Indian Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 98765 43210 or 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Auto-normalized to +91 E.164 standard.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Recipient Name (for personalization)</label>
              <input
                type="text"
                className="form-input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
              <input
                type="checkbox"
                id="bypass"
                checked={bypassCompliance}
                onChange={(e) => setBypassCompliance(e.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
              />
              <label htmlFor="bypass" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Internal test number (bypass TRAI calling hours restriction for development)
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Calling...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Initiate Call
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              style={{
                padding: "16px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-emerald)", fontWeight: "600", marginBottom: "8px" }}>
                <CheckCircle size={18} /> Call Executed Successfully
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                <div><strong>Status:</strong> {result.status.toUpperCase()}</div>
                <div><strong>Duration:</strong> {result.duration_seconds}s</div>
                <div><strong>Attempt ID:</strong> {result.sarvam_attempt_id}</div>
                <div><strong>Estimated Cost:</strong> ₹{result.cost_inr}</div>
                {result.is_mock && (
                  <div style={{ color: "#F472B6", marginTop: "4px" }}>
                    ℹ️ Executed on Sarvam Mock Engine (zero cost incurred)
                  </div>
                )}
              </div>
            </div>

            {result.transcript && result.transcript.messages && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "10px" }}>
                  Conversation Transcript
                </div>
                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  {result.transcript.messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={m.role === "assistant" ? "turn-bubble turn-assistant" : "turn-bubble turn-user"}
                    >
                      <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "2px" }}>
                        {m.role === "assistant" ? "AI Voice Agent" : "Customer"}
                      </div>
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
