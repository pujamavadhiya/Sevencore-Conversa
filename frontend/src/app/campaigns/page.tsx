"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Play,
  Pause,
  XCircle,
  Clock,
  Sparkles,
  FileText,
  Calendar,
  Edit3,
} from "lucide-react";
import { api } from "@/lib/api";
import { Campaign } from "@/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

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
      const cData = await api.getCampaigns();
      setCampaigns(Array.isArray(cData) ? cData : cData.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNow = async (id: number) => {
    if (!confirm("Are you sure you want to start this scheduled campaign immediately?")) {
      return;
    }
    try {
      await api.startScheduledCampaignNow(id);
      loadData();
    } catch (err: any) {
      alert("Failed to start scheduled campaign: " + (err.message || String(err)));
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
        <Link href="/campaigns/new" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Plus size={16} /> New Calling Campaign
        </Link>
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
                  No campaigns created yet. Click "New Calling Campaign" to configure and launch your first batch.
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
                      {camp.scheduled_start_time && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#4F46E5",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "3px",
                            background: "#EEF2FF",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          <Calendar size={11} color="#4F46E5" />
                          Starts:{" "}
                          {new Date(camp.scheduled_start_time).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          IST
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#A5B4FC" }}>
                        {camp.agent_details?.name || "Agent"}
                      </span>
                    </td>
                    <td>
                      {camp.status === "scheduled" ? (
                        <span
                          className="badge"
                          style={{
                            background: "#EEF2FF",
                            color: "#4F46E5",
                            border: "1px solid #C7D2FE",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontWeight: 700,
                          }}
                        >
                          <Calendar size={11} /> SCHEDULED
                        </span>
                      ) : (
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
                      )}
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
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => viewCampaignDetails(camp)}
                          title="View Details & Follow-ups"
                        >
                          Details
                        </button>
                        <Link
                          href={`/campaigns/${camp.id}/edit`}
                          className="btn btn-secondary btn-sm"
                          title="Edit Campaign"
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Edit3 size={12} /> Edit
                        </Link>
                        {camp.status === "scheduled" && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStartNow(camp.id)}
                            title="Start Campaign Immediately (ahead of schedule)"
                            style={{ background: "#4F46E5", color: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Play size={12} /> Start Now
                          </button>
                        )}
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link
                  href={`/campaigns/${selectedCampaign.id}/edit`}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <Edit3 size={12} /> Edit Campaign
                </Link>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "20px" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scheduled Start Banner */}
            {selectedCampaign.scheduled_start_time && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "#EEF2FF",
                  border: "1px solid #C7D2FE",
                  borderRadius: "8px",
                  marginBottom: "18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#3730A3", fontSize: "13px", fontWeight: 600 }}>
                  <Calendar size={16} color="#4F46E5" />
                  <span>
                    Scheduled to Start:{" "}
                    <strong>
                      {new Date(selectedCampaign.scheduled_start_time).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      IST
                    </strong>
                    {selectedCampaign.status === "scheduled" && " (Awaiting scheduled trigger)"}
                  </span>
                </div>
                {selectedCampaign.status === "scheduled" && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      await handleStartNow(selectedCampaign.id);
                      setSelectedCampaign({ ...selectedCampaign, status: "running" });
                    }}
                    style={{ background: "#4F46E5", color: "#FFFFFF", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Play size={12} /> Launch Now
                  </button>
                )}
              </div>
            )}

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
                    <div style={{ fontSize: "12px", color: "#4338CA" }}>
                      Automated follow-ups for silent pick-ups, mid-talk drops, and unanswered retries with conversational context injection.
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDispatchFollowups(selectedCampaign.id)}
                  disabled={dispatchingFollowups || (selectedCampaign.followups_eligible_count ?? 0) === 0}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Play size={13} />
                  {dispatchingFollowups ? "Dispatching..." : `Dispatch Due Cohort (${selectedCampaign.followups_eligible_count ?? 0})`}
                </button>
              </div>

              {/* Follow-up Summary Pills */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "12px" }}>
                <div style={{ padding: "10px 14px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E0E7FF" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-ups Queued in Cohorts</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#4F46E5" }}>
                    {selectedCampaign.followups_queued_count ?? 0}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E0E7FF" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-ups Pending Eligibility</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#D97706" }}>
                    {selectedCampaign.followups_pending_count ?? 0}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E0E7FF" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-ups Completed</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#059669" }}>
                    {selectedCampaign.followups_completed_count ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Contacts Breakdown */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                  Recipient Call Outcomes & Follow-up Journey
                </h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  {["all", "success", "followup_pending", "followup_queued"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFollowupFilter(f)}
                      className={`btn btn-sm ${followupFilter === f ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                    >
                      {f === "all" ? "All Contacts" : f === "success" ? "Concluded" : f === "followup_pending" ? "Follow-up Pending" : "In Cohort"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
                <table className="data-table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Call Status</th>
                      <th>Follow-up State</th>
                      <th>Reason</th>
                      <th>Round</th>
                      <th>Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignContactsList
                      .filter((cc) => {
                        if (followupFilter === "all") return true;
                        return cc.followup_status === followupFilter;
                      })
                      .map((cc) => (
                        <tr key={cc.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{cc.contact?.name || "Contact"}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                              {cc.contact?.phone_number}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                cc.status === "connected"
                                  ? "badge-connected"
                                  : cc.status === "calling"
                                  ? "badge-running"
                                  : "badge-danger"
                              }`}
                            >
                              {cc.status_display || cc.status}
                            </span>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background:
                                  cc.followup_status === "success"
                                    ? "var(--accent-emerald-bg)"
                                    : cc.followup_status === "followup_queued"
                                    ? "#EEF2FF"
                                    : cc.followup_status === "followup_pending"
                                    ? "var(--accent-amber-bg)"
                                    : "#F1F5F9",
                                color:
                                  cc.followup_status === "success"
                                    ? "var(--accent-emerald)"
                                    : cc.followup_status === "followup_queued"
                                    ? "#4F46E5"
                                    : cc.followup_status === "followup_pending"
                                    ? "var(--accent-amber)"
                                    : "var(--text-muted)",
                                border: cc.followup_status === "followup_queued" ? "1px solid #C7D2FE" : "none",
                              }}
                            >
                              {cc.followup_status_display || cc.followup_status}
                            </span>
                          </td>
                          <td style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            {cc.followup_reason_display || cc.followup_reason || "—"}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>R{cc.followup_round ?? 0}</span>
                          </td>
                          <td>
                            {cc.previous_conversation ? (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setViewingExcerpt({ name: cc.contact?.name, text: cc.previous_conversation })}
                                style={{ fontSize: "11px", padding: "2px 6px" }}
                              >
                                <FileText size={11} /> Excerpt
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    {campaignContactsList.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                          No contacts attached to this campaign.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Excerpt Mini Modal */}
            {viewingExcerpt && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1100,
                }}
              >
                <div style={{ background: "#FFFFFF", padding: "20px", borderRadius: "10px", maxWidth: "480px", width: "90%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px" }}>
                      Prior Conversation Excerpt ({viewingExcerpt.name})
                    </div>
                    <button
                      onClick={() => setViewingExcerpt(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    style={{
                      background: "#F8FAFC",
                      padding: "12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      maxHeight: "240px",
                      overflowY: "auto",
                      border: "1px solid var(--border-subtle)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {viewingExcerpt.text}
                  </div>
                  <div style={{ textAlign: "right", marginTop: "12px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setViewingExcerpt(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
