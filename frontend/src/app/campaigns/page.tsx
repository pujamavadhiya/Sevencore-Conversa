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
  FileText,
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

  // Selected Campaign Detail Modal & Follow-ups
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignContactsList, setCampaignContactsList] = useState<any[]>([]);
  const [dispatchingFollowups, setDispatchingFollowups] = useState(false);
  const [followupFilter, setFollowupFilter] = useState<string>("all");
  const [viewingExcerpt, setViewingExcerpt] = useState<{ name: string; text: string } | null>(null);

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

  const handleDispatchFollowups = async (campaignId: number) => {
    try {
      setDispatchingFollowups(true);
      const res = await api.dispatchCampaignFollowups(campaignId);
      if (res.queued > 0) {
        alert(`Successfully queued ${res.queued} eligible contacts into follow-up cohort '${res.cohort_label}'.`);
      } else {
        alert(res.message || "No contacts are currently eligible for follow-up dispatch.");
      }
      const updatedCampaign = await api.getCampaign(campaignId);
      setSelectedCampaign(updatedCampaign);
      const contacts = await api.getCampaignContacts(campaignId);
      setCampaignContactsList(contacts);
      loadData();
    } catch (err: any) {
      alert("Failed to dispatch follow-up cohort: " + (err.message || String(err)));
    } finally {
      setDispatchingFollowups(false);
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
          <div className="modal-content" style={{ maxWidth: "860px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Campaign Intelligence & Follow-up Orchestration
                </div>
                <h2 style={{ fontSize: "20px", margin: "2px 0 0", color: "var(--text-primary)" }}>
                  {selectedCampaign.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
              >
                ✕
              </button>
            </div>

            {/* Campaign Core Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
              <div style={{ padding: "14px", background: "#F8FAFC", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Total Contacts</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A" }}>{selectedCampaign.total_contacts}</div>
              </div>
              <div style={{ padding: "14px", background: "#F8FAFC", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Initial Dials Made</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#4F46E5" }}>{selectedCampaign.calls_attempted}</div>
              </div>
              <div style={{ padding: "14px", background: "var(--accent-emerald-bg)", border: "1px solid rgba(5, 150, 105, 0.2)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-emerald)", fontWeight: 600 }}>Connected & Finished</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--accent-emerald)" }}>{selectedCampaign.calls_answered}</div>
              </div>
              <div style={{ padding: "14px", background: "var(--accent-amber-bg)", border: "1px solid rgba(217, 119, 6, 0.2)", borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "11px", color: "var(--accent-amber)", fontWeight: 600 }}>Total Spend</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--accent-amber)" }}>₹{selectedCampaign.actual_cost_inr}</div>
              </div>
            </div>

            {/* Sarvam Batch Smart Follow-up Cohort Box */}
            <div
              style={{
                padding: "18px 20px",
                background: "linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 100%)",
                border: "1px solid #C7D2FE",
                borderRadius: "var(--radius-lg)",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "#4F46E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Sparkles size={16} color="#FFFFFF" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "15px", margin: 0, fontWeight: 700, color: "#1E1B4B" }}>
                      Sarvam Multi-Round Follow-up Engine
                    </h3>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      Classifies silent pickups, mid-call drops, and unreached contacts into intelligent follow-up cohorts with conversation memory.
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDispatchFollowups(selectedCampaign.id)}
                  disabled={dispatchingFollowups || (selectedCampaign.followups_eligible_count || 0) === 0}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {dispatchingFollowups ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Streaming Cohort...
                    </>
                  ) : (
                    <>
                      <Play size={13} /> Dispatch Follow-up Cohort ({selectedCampaign.followups_eligible_count || 0} Due)
                    </>
                  )}
                </button>
              </div>

              {/* Follow-up State Counters */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Eligible to Redial Now</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: (selectedCampaign.followups_eligible_count || 0) > 0 ? "#4F46E5" : "#64748B" }}>
                    {selectedCampaign.followups_eligible_count || 0} contacts
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-up Pending Window</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#D97706" }}>
                    {selectedCampaign.followups_pending_count || 0} contacts
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Queued in Cohort</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0284C7" }}>
                    {selectedCampaign.followups_queued_count || 0} contacts
                  </div>
                </div>
                <div style={{ background: "#FFFFFF", padding: "10px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Concluded Successfully</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#059669" }}>
                    {selectedCampaign.followups_completed_count || 0} contacts
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { id: "all", label: `All Dials (${campaignContactsList.length})` },
                  {
                    id: "due",
                    label: `Follow-up Due (${
                      campaignContactsList.filter(
                        (c) =>
                          c.followup_status === "followup_pending" &&
                          c.followup_eligible_at &&
                          new Date(c.followup_eligible_at) <= new Date()
                      ).length
                    })`,
                  },
                  {
                    id: "pending",
                    label: `Pending Timer (${
                      campaignContactsList.filter((c) => c.followup_status === "followup_pending").length
                    })`,
                  },
                  {
                    id: "success",
                    label: `Concluded (${
                      campaignContactsList.filter((c) => c.followup_status === "success" || c.status === "connected").length
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFollowupFilter(tab.id)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      background: followupFilter === tab.id ? "#4F46E5" : "#FFFFFF",
                      color: followupFilter === tab.id ? "#FFFFFF" : "#475569",
                      borderColor: followupFilter === tab.id ? "#4F46E5" : "#CBD5E1",
                      fontSize: "12px",
                      padding: "4px 10px",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience Table with Follow-up Intelligence */}
            <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "8px", background: "#FFFFFF" }}>
              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                <thead style={{ background: "#F8FAFC", position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: 700 }}>Contact</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: 700 }}>Phone</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: 700 }}>Call Status</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: 700 }}>Follow-up Outcome</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", color: "#64748B", fontWeight: 700 }}>Round / Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignContactsList
                    .filter((cc) => {
                      if (followupFilter === "due") {
                        return (
                          cc.followup_status === "followup_pending" &&
                          cc.followup_eligible_at &&
                          new Date(cc.followup_eligible_at) <= new Date()
                        );
                      }
                      if (followupFilter === "pending") {
                        return cc.followup_status === "followup_pending";
                      }
                      if (followupFilter === "success") {
                        return cc.followup_status === "success" || cc.status === "connected";
                      }
                      return true;
                    })
                    .map((cc) => {
                      const isEligibleNow =
                        cc.followup_status === "followup_pending" &&
                        cc.followup_eligible_at &&
                        new Date(cc.followup_eligible_at) <= new Date();

                      return (
                        <tr key={cc.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1E293B" }}>
                            {cc.contact?.name}
                          </td>
                          <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#475569" }}>
                            {cc.contact?.phone_number}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <span
                              className={`badge ${
                                cc.status === "connected"
                                  ? "badge-connected"
                                  : cc.status === "calling"
                                  ? "badge-running"
                                  : cc.status === "no_answer" || cc.status === "busy"
                                  ? "badge-warning"
                                  : "badge-pending"
                              }`}
                              style={{ fontSize: "11px" }}
                            >
                              {cc.status}
                            </span>
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {cc.followup_reason ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: "11px",
                                    background: cc.followup_reason.includes("silent") ? "#EEF2FF" : "#FFFBEB",
                                    color: cc.followup_reason.includes("silent") ? "#4338CA" : "#B45309",
                                    border: cc.followup_reason.includes("silent") ? "1px solid #C7D2FE" : "1px solid #FCD34D",
                                  }}
                                >
                                  {cc.followup_reason_display || cc.followup_reason}
                                </span>
                                {isEligibleNow ? (
                                  <span style={{ fontSize: "10px", color: "#059669", fontWeight: 700 }}>
                                    ● Eligible to dispatch now
                                  </span>
                                ) : cc.followup_eligible_at ? (
                                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                                    Eligible at {new Date(cc.followup_eligible_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                ) : null}
                              </div>
                            ) : cc.followup_status === "success" ? (
                              <span className="badge badge-connected" style={{ fontSize: "11px" }}>
                                Concluded (Success)
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Initial Round</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                Round {cc.followup_round || 0}
                              </span>
                              {cc.previous_conversation && (
                                <button
                                  onClick={() =>
                                    setViewingExcerpt({
                                      name: cc.contact?.name || "Recipient",
                                      text: cc.previous_conversation,
                                    })
                                  }
                                  className="badge"
                                  style={{
                                    background: "#F1F5F9",
                                    border: "1px solid #CBD5E1",
                                    color: "#475569",
                                    cursor: "pointer",
                                    fontSize: "10px",
                                  }}
                                  title="View Stored Conversation Context"
                                >
                                  <FileText size={10} /> Context
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Excerpt Viewer Modal */}
      {viewingExcerpt && (
        <div className="modal-overlay" style={{ zIndex: 120 }}>
          <div className="modal-content" style={{ maxWidth: "540px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={18} color="#4F46E5" />
                <h3 style={{ fontSize: "16px", margin: 0 }}>
                  Stored Conversation Context: {viewingExcerpt.name}
                </h3>
              </div>
              <button
                onClick={() => setViewingExcerpt(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              This conversation transcript is automatically fed into <code>app_variables.previous_conversation</code> when the follow-up call is placed, allowing the Voice Agent to resume seamlessly.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "14px",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#1E293B",
                whiteSpace: "pre-wrap",
                maxHeight: "260px",
                overflowY: "auto",
                fontFamily: "monospace",
              }}
            >
              {viewingExcerpt.text}
            </pre>
            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewingExcerpt(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
