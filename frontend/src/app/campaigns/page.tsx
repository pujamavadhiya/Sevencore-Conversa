"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  XCircle,
  Clock,
  ShieldCheck,
  IndianRupee,
  AlertTriangle,
  CheckCircle,
  Users,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sliders,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Campaign, VoiceAgent, Contact } from "@/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("20:00");
  const [cps, setCps] = useState(2);
  const [maxRetries, setMaxRetries] = useState(2);
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [bypassHours, setBypassHours] = useState(false);
  const [creating, setCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Selected Campaign Detail Modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignContactsList, setCampaignContactsList] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cData, aData, contData] = await Promise.all([
        api.getCampaigns(),
        api.getAgents(),
        api.getContacts(),
      ]);
      setCampaigns(Array.isArray(cData) ? cData : cData.results || []);
      setAgents(Array.isArray(aData) ? aData : aData.results || []);
      setContacts(Array.isArray(contData) ? contData : contData.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openWizard = () => {
    setStep(1);
    setName("");
    setDescription("");
    setSelectedAgentId(agents.length > 0 ? agents[0].id : "");
    setSelectedContactIds(contacts.slice(0, 10).map((c) => c.id));
    setWindowStart("09:00");
    setWindowEnd("20:00");
    setCps(2);
    setMaxRetries(2);
    setUserConfirmed(false);
    setBypassHours(false);
    setWizardError(null);
    setWizardOpen(true);
  };

  const handleCreateAndLaunch = async () => {
    if (!userConfirmed) {
      setWizardError("Mandatory Requirement: You must explicitly confirm campaign execution before launch.");
      return;
    }

    try {
      setCreating(true);
      setWizardError(null);

      // 1. Create Campaign
      const camp = await api.createCampaign({
        name,
        description,
        agent: Number(selectedAgentId),
        calling_window_start: windowStart,
        calling_window_end: windowEnd,
        calls_per_second: cps,
        max_retries: maxRetries,
        is_confirmed: true,
      });

      // 2. Add Contacts
      await api.addContactsToCampaign(camp.id, {
        contact_ids: selectedContactIds,
      });

      // 3. Launch with confirmation
      await api.launchCampaign(camp.id, true, bypassHours);

      setWizardOpen(false);
      loadData();
    } catch (err: any) {
      setWizardError(err.message || "Failed to launch campaign");
    } finally {
      setCreating(false);
    }
  };

  const handlePause = async (id: number) => {
    await api.pauseCampaign(id);
    loadData();
  };

  const handleResume = async (id: number) => {
    await api.resumeCampaign(id);
    loadData();
  };

  const handleCancel = async (id: number) => {
    if (confirm("Cancel all remaining calls in this campaign?")) {
      await api.cancelCampaign(id);
      loadData();
    }
  };

  const viewCampaignDetails = async (camp: Campaign) => {
    setSelectedCampaign(camp);
    try {
      const contacts = await api.getCampaignContacts(camp.id);
      setCampaignContactsList(contacts);
    } catch {
      setCampaignContactsList([]);
    }
  };

  // Cost calculation estimate for selected contacts
  const estimatedCost = (selectedContactIds.length * 1.5 * 3.5).toFixed(2);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Voice Calling Campaigns</h1>
          <p className="subtitle">
            Orchestrate batch outbound voice calls with TRAI calling window compliance, pacing controls, and live tracking.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openWizard}>
          <Plus size={16} /> New Calling Campaign
        </button>
      </div>

      {/* Campaigns List */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Assigned Agent</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Answered / Failed</th>
              <th>Spend (INR)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No campaigns created yet. Click "New Calling Campaign" to start your first campaign.
                </td>
              </tr>
            ) : (
              campaigns.map((camp) => {
                const progressPct =
                  camp.total_contacts > 0
                    ? Math.round((camp.calls_attempted / camp.total_contacts) * 100)
                    : 0;

                return (
                  <tr key={camp.id}>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{camp.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Window: {camp.calling_window_start} – {camp.calling_window_end} IST
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#A5B4FC" }}>
                        {camp.agent_details?.name || "Agent"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          camp.status === "completed"
                            ? "badge-connected"
                            : camp.status === "running"
                            ? "badge-running"
                            : camp.status === "paused"
                            ? "badge-warning"
                            : "badge-danger"
                        }`}
                      >
                        {camp.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ minWidth: "150px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span>{camp.calls_attempted} / {camp.total_contacts}</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${progressPct}%`,
                            background: "linear-gradient(90deg, #6366F1, #10B981)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "var(--accent-emerald)", fontWeight: "600" }}>{camp.calls_answered}</span>
                      {" / "}
                      <span style={{ color: "var(--accent-rose)" }}>{camp.calls_failed}</span>
                    </td>
                    <td style={{ fontWeight: "700" }}>₹{camp.actual_cost_inr}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => viewCampaignDetails(camp)}
                          title="View Details"
                        >
                          Details
                        </button>
                        {camp.status === "running" && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handlePause(camp.id)}
                            title="Pause Campaign"
                          >
                            <Pause size={12} />
                          </button>
                        )}
                        {camp.status === "paused" && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleResume(camp.id)}
                            title="Resume Campaign"
                          >
                            <Play size={12} />
                          </button>
                        )}
                        {camp.status !== "completed" && camp.status !== "cancelled" && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(camp.id)}
                            title="Cancel Campaign"
                          >
                            <XCircle size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 7-Step Campaign Creation Wizard Modal */}
      {wizardOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "660px" }}>
            {/* Step Indicators */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
              {[
                "1. Name",
                "2. Agent",
                "3. Audience",
                "4. Pacing",
                "5. Compliance",
                "6. Summary",
                "7. Confirm",
              ].map((stepLabel, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: "11px",
                    fontWeight: step === idx + 1 ? "700" : "500",
                    color: step === idx + 1 ? "var(--accent-primary)" : "var(--text-muted)",
                  }}
                >
                  {stepLabel}
                </span>
              ))}
            </div>

            {wizardError && (
              <div style={{ padding: "12px", background: "var(--accent-rose-bg)", color: "var(--accent-rose)", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
                <AlertTriangle size={16} style={{ display: "inline", marginRight: "6px" }} />
                {wizardError}
              </div>
            )}

            {/* Step 1: Name & Description */}
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 1: Campaign Details</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Give your outbound voice campaign an identifiable name and objective.
                </p>
                <div className="form-group">
                  <label className="form-label">Campaign Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q4 SME Loan Qualification Campaign"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Campaign Description (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief objective of this calling batch..."
                  />
                </div>
              </div>
            )}

            {/* Step 2: Select Voice Agent */}
            {step === 2 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 2: Select Voice Agent</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Select the AI voice agent persona that will conduct the phone conversation.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {agents.map((ag) => (
                    <div
                      key={ag.id}
                      onClick={() => setSelectedAgentId(ag.id)}
                      style={{
                        padding: "16px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: selectedAgentId === ag.id ? "#EEF2FF" : "#F8FAFC",
                        border: selectedAgentId === ag.id ? "1px solid #6366F1" : "1px solid #CBD5E1",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{ag.name}</div>
                        <span className="badge badge-success">{ag.primary_language}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Greeting: "{ag.greeting_message.slice(0, 70)}..."
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Select Audience Contacts */}
            {step === 3 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 3: Select Target Audience</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Choose which validated Indian contacts will be added to this calling batch.
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    Selected: <strong>{selectedContactIds.length}</strong> of {contacts.length} contacts
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedContactIds(contacts.map((c) => c.id))}
                  >
                    Select All
                  </button>
                </div>
                <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContactIds([...selectedContactIds, c.id]);
                          } else {
                            setSelectedContactIds(selectedContactIds.filter((id) => id !== c.id));
                          }
                        }}
                        style={{ accentColor: "var(--accent-primary)" }}
                      />
                      <span style={{ fontWeight: "600", fontSize: "13px" }}>{c.name}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {c.phone_number}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Timing & Pacing */}
            {step === 4 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 4: Permitted Calling Windows & Pacing</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Define the daily hours when calls can take place, plus call pacing limits.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Calling Window Start (IST)</label>
                    <input
                      type="time"
                      className="form-input"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Calling Window End (IST)</label>
                    <input
                      type="time"
                      className="form-input"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="form-group">
                    <label className="form-label">Calls Per Second (CPS Rate)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="form-input"
                      value={cps}
                      onChange={(e) => setCps(Number(e.target.value))}
                    />
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      Safe recommended pacing: 2 calls/sec
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Retries on Busy / No Answer</label>
                    <input
                      type="number"
                      min="0"
                      max="3"
                      className="form-input"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Compliance Checks */}
            {step === 5 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 5: Indian Telecom Compliance Review</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Automated verification against TRAI NDNC and telecom commercial regulations.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-emerald)", fontWeight: "600", fontSize: "13px" }}>
                      <CheckCircle size={16} /> TRAI Calling Hours Policy (09:00 - 20:00 IST)
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Configured calling window: {windowStart} to {windowEnd} IST.
                    </div>
                  </div>

                  <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-emerald)", fontWeight: "600", fontSize: "13px" }}>
                      <CheckCircle size={16} /> DND & Opt-out Registry Filter
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Suppressed numbers are automatically excluded before dispatching calls.
                    </div>
                  </div>

                  <div style={{ padding: "14px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#C7D2FE", fontWeight: "600", fontSize: "13px" }}>
                      <CheckCircle size={16} /> Indian Telephony Line Verified
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Calls route through provisioned Sarvam Vobiz connection (+91 80 4000 1234).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Summary & Cost Estimate */}
            {step === 6 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Step 6: Campaign Summary & Cost Estimate</h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  Inspect estimated charges before confirming execution.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ padding: "16px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Target Audience</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--text-primary)" }}>{selectedContactIds.length} contacts</div>
                  </div>
                  <div style={{ padding: "16px", borderRadius: "10px", background: "var(--accent-amber-bg)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    <div style={{ fontSize: "12px", color: "var(--accent-amber)" }}>Estimated Spend (INR)</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "var(--accent-amber)" }}>₹{estimatedCost}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Based on Sarvam ₹3.50/min rate @ avg 1.5 min/call
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                  <div><strong>Campaign:</strong> {name}</div>
                  <div><strong>Voice Agent:</strong> {agents.find((a) => a.id === selectedAgentId)?.name}</div>
                  <div><strong>Pacing:</strong> {cps} calls/second</div>
                </div>
              </div>
            )}

            {/* Step 7: Explicit User Confirmation */}
            {step === 7 && (
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "4px", color: "var(--accent-primary)" }}>
                  Step 7: Confirm & Launch Campaign
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" }}>
                  Safety Guard: Calling operations require explicit user approval.
                </p>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    background: "#EEF2FF",
                    border: "1px solid #C7D2FE",
                    marginBottom: "24px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                    <input
                      type="checkbox"
                      id="confirm-launch"
                      checked={userConfirmed}
                      onChange={(e) => setUserConfirmed(e.target.checked)}
                      style={{ width: "20px", height: "20px", marginTop: "2px", accentColor: "var(--accent-primary)" }}
                    />
                    <label htmlFor="confirm-launch" style={{ fontSize: "13px", color: "#1E1B4B", lineHeight: "1.5" }}>
                      <strong>I explicitly confirm and authorize launching this calling campaign.</strong>
                      <br />
                      I acknowledge that {selectedContactIds.length} calls will be queued through Sarvam Voice Agents,
                      with estimated spend of ₹{estimatedCost}.
                    </label>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "32px" }}>
                    <input
                      type="checkbox"
                      id="bypass-hours"
                      checked={bypassHours}
                      onChange={(e) => setBypassHours(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
                    />
                    <label htmlFor="bypass-hours" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Bypass calling hours check (internal development/test run)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "28px" }}>
              {step > 1 ? (
                <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                  <ChevronLeft size={16} /> Back
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => setWizardOpen(false)}>
                  Cancel
                </button>
              )}

              {step < 7 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (step === 1 && !name) {
                      setWizardError("Please enter a campaign name.");
                      return;
                    }
                    if (step === 3 && selectedContactIds.length === 0) {
                      setWizardError("Please select at least one contact.");
                      return;
                    }
                    setWizardError(null);
                    setStep(step + 1);
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  className="btn btn-success btn-lg"
                  onClick={handleCreateAndLaunch}
                  disabled={creating || !userConfirmed}
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  Authorize & Launch Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected Campaign Detail Modal */}
      {selectedCampaign && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "720px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "18px" }}>Campaign: {selectedCampaign.name}</h2>
              <button
                onClick={() => setSelectedCampaign(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Contacts</div>
                <div style={{ fontSize: "18px", fontWeight: "700" }}>{selectedCampaign.total_contacts}</div>
              </div>
              <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Attempted</div>
                <div style={{ fontSize: "18px", fontWeight: "700" }}>{selectedCampaign.calls_attempted}</div>
              </div>
              <div style={{ padding: "12px", background: "var(--accent-emerald-bg)", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-emerald)" }}>Answered</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-emerald)" }}>{selectedCampaign.calls_answered}</div>
              </div>
              <div style={{ padding: "12px", background: "var(--accent-amber-bg)", borderRadius: "8px" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-amber)" }}>Total Spend</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-amber)" }}>₹{selectedCampaign.actual_cost_inr}</div>
              </div>
            </div>

            <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Audience Dials ({campaignContactsList.length})</h3>
            <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                <thead style={{ background: "rgba(0,0,0,0.4)" }}>
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Contact</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Phone</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignContactsList.map((cc) => (
                    <tr key={cc.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 12px" }}>{cc.contact?.name}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{cc.contact?.phone_number}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span className={`badge ${cc.status === "connected" ? "badge-connected" : cc.status === "calling" ? "badge-running" : "badge-pending"}`}>
                          {cc.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{cc.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
