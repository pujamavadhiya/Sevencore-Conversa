"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Download,
  Search,
  Filter,
  FileText,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Bot,
  User,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  Megaphone,
  Radio,
  Layers,
  History,
} from "lucide-react";
import { api } from "@/lib/api";
import { HistoryCampaignSummary, HistoryCallItem } from "@/types";

export default function CallsHistoryPage() {
  // Top-level View Mode: "campaigns" vs "single"
  const [activeTab, setActiveTab] = useState<"campaigns" | "single">("campaigns");

  // Campaigns History States
  const [campaignsList, setCampaignsList] = useState<HistoryCampaignSummary[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<HistoryCampaignSummary | null>(null);
  const [campaignCallsList, setCampaignCallsList] = useState<HistoryCallItem[]>([]);
  const [campaignCallsTotal, setCampaignCallsTotal] = useState(0);

  // Single Calls History States
  const [singleCallsList, setSingleCallsList] = useState<HistoryCallItem[]>([]);
  const [singleCallsTotal, setSingleCallsTotal] = useState(0);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Call Detail & Transcript Modal
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [callDetailData, setCallDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [fetchingTranscript, setFetchingTranscript] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // User History Sub-modal
  const [userHistoryList, setUserHistoryList] = useState<HistoryCallItem[] | null>(null);
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);

  // Load data on tab change or filter change
  useEffect(() => {
    if (activeTab === "campaigns") {
      if (!activeCampaign) {
        loadCampaignsHistory();
      } else {
        loadActiveCampaignCalls(activeCampaign.campaign_id);
      }
    } else {
      loadSingleCallsHistory();
    }
  }, [activeTab, activeCampaign?.campaign_id, dispositionFilter, reasonFilter, search]);

  const loadCampaignsHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getHistoryCampaigns();
      setCampaignsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load campaign history:", err);
      setCampaignsList([]);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveCampaignCalls = async (campId: string) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dispositionFilter) params.disposition = dispositionFilter;
      if (reasonFilter) params.reason = reasonFilter;
      if (search) params.user_identifier = search;

      const data = await api.getHistoryCampaignCalls(campId, params);
      setCampaignCallsList(data.items || []);
      setCampaignCallsTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load campaign calls:", err);
      setCampaignCallsList([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSingleCallsHistory = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dispositionFilter) params.disposition = dispositionFilter;

      const data = await api.getHistorySingleCalls(params);
      setSingleCallsList(data.items || []);
      setSingleCallsTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load single calls history:", err);
      setSingleCallsList([]);
    } finally {
      setLoading(false);
    }
  };

  const openCallDetail = async (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    try {
      setLoadingDetail(true);
      const detail = await api.getHistoryCallDetail(attemptId);
      setCallDetailData(detail);
    } catch (err) {
      console.error("Failed to fetch call detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePullTranscriptOnDemand = async (attemptId: string) => {
    try {
      setFetchingTranscript(true);
      const res = await api.getHistoryCallTranscript(attemptId);
      if (callDetailData) {
        setCallDetailData({
          ...callDetailData,
          transcript_text: res.text,
          transcript_status: res.status,
        });
      }
      // Also refresh table
      if (activeCampaign) {
        loadActiveCampaignCalls(activeCampaign.campaign_id);
      } else {
        loadSingleCallsHistory();
      }
    } catch (err) {
      alert("Transcript not available yet. Please try again after call interaction settles.");
    } finally {
      setFetchingTranscript(false);
    }
  };

  const openUserHistory = async (campId: string, uid: string) => {
    setSelectedUserUid(uid);
    try {
      const data = await api.getHistoryCampaignUserAttempts(campId, uid);
      setUserHistoryList(data.items || []);
    } catch (err) {
      console.error("Failed to load user attempt history:", err);
      setUserHistoryList([]);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDispositionBadge = (disp?: string, status?: string) => {
    if (disp === "success" || status === "connected") {
      return (
        <span className="badge badge-connected">
          <CheckCircle2 size={12} /> Concluded
        </span>
      );
    }
    if (disp === "followup") {
      return (
        <span className="badge badge-warning">
          <Clock size={12} /> Follow-up Due
        </span>
      );
    }
    if (disp === "retrying") {
      return (
        <span className="badge badge-running">
          <span className="live-dot" /> Retrying
        </span>
      );
    }
    if (disp === "not_connected" || status === "failed" || status === "no_answer" || status === "busy") {
      return <span className="badge badge-danger">{status || "Not Connected"}</span>;
    }
    return <span className="badge" style={{ background: "#F1F5F9", color: "#475569" }}>{disp || status || "Pending"}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
              }}
            >
              <History size={20} color="#FFFFFF" />
            </div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
              Call History & Transcript Pipeline
            </h1>
          </div>
          <p className="subtitle" style={{ margin: 0 }}>
            Dedicated records and turn-by-turn dialogue generation, strictly separating batch campaigns from single outbound calls.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <a href="http://localhost:8000/api/v1/calls/export_csv/" className="btn btn-secondary">
            <Download size={14} /> Export CSV
          </a>
          <button
            onClick={() => {
              if (activeTab === "campaigns") {
                if (activeCampaign) loadActiveCampaignCalls(activeCampaign.campaign_id);
                else loadCampaignsHistory();
              } else {
                loadSingleCallsHistory();
              }
            }}
            className="btn btn-secondary"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Navigation Tabs: Campaigns (Batch) vs Single (Instant) */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "12px",
          marginBottom: "24px",
        }}
      >
        <button
          onClick={() => {
            setActiveTab("campaigns");
            setActiveCampaign(null);
          }}
          className={`btn ${activeTab === "campaigns" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 600 }}
        >
          <Megaphone size={16} /> Batch Campaigns History
          {campaignsList.length > 0 && (
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: activeTab === "campaigns" ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                fontSize: "11px",
              }}
            >
              {campaignsList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("single");
            setActiveCampaign(null);
          }}
          className={`btn ${activeTab === "single" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "8px 16px", fontSize: "14px", fontWeight: 600 }}
        >
          <PhoneCall size={16} /> Single Calls (Instant Outbound)
          {singleCallsTotal > 0 && (
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: activeTab === "single" ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                fontSize: "11px",
              }}
            >
              {singleCallsTotal}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          SECTION 1: BATCH CAMPAIGNS HISTORY
          ========================================================================= */}
      {activeTab === "campaigns" && (
        <div>
          {/* If no campaign selected: Show the list of campaign sections/cards */}
          {!activeCampaign ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", margin: 0 }}>Campaign History Sections</h2>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Select a campaign to inspect its complete batch call history, follow-up cohorts, and transcripts.
                  </div>
                </div>

                <div style={{ position: "relative", width: "300px" }}>
                  <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "11px" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: "36px" }}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} className="spin" style={{ margin: "0 auto 12px" }} />
                  Loading campaign history records...
                </div>
              ) : campaignsList.length === 0 ? (
                <div className="glass-panel" style={{ padding: "48px 32px", textAlign: "center" }}>
                  <Megaphone size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
                  <h3 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "6px" }}>
                    No Campaign History Stored Yet
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto 16px" }}>
                    Campaign call attempts and batch cohorts will automatically appear here once outbound campaigns are launched.
                  </p>
                  <Link href="/campaigns" className="btn btn-primary">
                    Go to Calling Campaigns
                  </Link>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
                  {campaignsList
                    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.campaign_id.includes(search))
                    .map((c) => (
                      <div
                        key={c.campaign_id}
                        className="glass-panel"
                        onClick={() => setActiveCampaign(c)}
                        style={{
                          padding: "22px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#4F46E5")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                      >
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <span className="badge" style={{ background: "#EEF2FF", color: "#4F46E5", fontWeight: 700, fontSize: "11px" }}>
                              Campaign ID #{c.campaign_id}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              {c.last_call_at ? `Last active ${new Date(c.last_call_at).toLocaleDateString()}` : "Created"}
                            </span>
                          </div>

                          <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                            {c.name}
                          </h3>
                        </div>

                        {/* Metric Counters Bar */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "8px",
                            padding: "12px",
                            background: "#F8FAFC",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border-subtle)",
                            marginTop: "16px",
                            marginBottom: "16px",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Dials</div>
                            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                              {c.total_attempts}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Connected</div>
                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#059669" }}>
                              {c.connected}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-ups</div>
                            <div style={{ fontSize: "15px", fontWeight: 700, color: "#D97706" }}>
                              {c.followups}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#4F46E5", fontSize: "13px", fontWeight: 600 }}>
                          <span>Access Campaign Calls ({c.total_attempts})</span>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* Selected Campaign: Inside that campaign's call records */
            <div>
              {/* Breadcrumb Navigation */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setActiveCampaign(null)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <ArrowLeft size={14} /> Back to All Campaigns
                  </button>
                  <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>/</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {activeCampaign.name} (Campaign #{activeCampaign.campaign_id})
                  </span>
                </div>
              </div>

              {/* Campaign Quick Summary Bar */}
              <div
                className="glass-panel"
                style={{
                  padding: "16px 20px",
                  marginBottom: "20px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Campaign Summary
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {activeCampaign.name}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "20px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Total Calls</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>{activeCampaign.total_attempts}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Connected</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#059669" }}>{activeCampaign.connected}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Concluded (Success)</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#4F46E5" }}>{activeCampaign.successful}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Follow-up Due</div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#D97706" }}>{activeCampaign.followups}</div>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                  <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px", top: "12px" }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by contact ID / phone number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ paddingLeft: "36px" }}
                  />
                </div>

                <select
                  className="form-select"
                  style={{ width: "180px" }}
                  value={dispositionFilter}
                  onChange={(e) => setDispositionFilter(e.target.value)}
                >
                  <option value="">All Dispositions</option>
                  <option value="success">Success (Concluded)</option>
                  <option value="followup">Follow-up Due</option>
                  <option value="retrying">Platform Retrying</option>
                  <option value="not_connected">Not Connected</option>
                </select>

                <select
                  className="form-select"
                  style={{ width: "220px" }}
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                >
                  <option value="">All Follow-up Reasons</option>
                  <option value="silent_after_pickup_10s">Silent After Pickup (10s)</option>
                  <option value="silent_mid_conversation_10s">Silent Mid-Talk (10s)</option>
                  <option value="no_answer_retries_exhausted">No Answer Exhausted</option>
                  <option value="busy_retries_exhausted">Busy Exhausted</option>
                  <option value="connected_but_no_conclusion">No Conclusion Marked</option>
                  <option value="call_failed">Carrier Failed</option>
                </select>
              </div>

              {/* Campaign Calls Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User / Contact</th>
                      <th>Attempt ID</th>
                      <th>Call Outcome</th>
                      <th>Disposition</th>
                      <th>Duration</th>
                      <th>Executed At</th>
                      <th>Transcript</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignCallsList.length === 0 && !loading ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                          No call attempts match the selected filter in this campaign.
                        </td>
                      </tr>
                    ) : (
                      campaignCallsList.map((c) => (
                        <tr key={c.attempt_id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.user_contact_masked || "Masked Recipient"}
                            </div>
                            {c.user_identifier && (
                              <button
                                onClick={() => openUserHistory(activeCampaign.campaign_id, c.user_identifier!)}
                                style={{ background: "none", border: "none", padding: 0, fontSize: "11px", color: "#4F46E5", cursor: "pointer", textDecoration: "underline" }}
                              >
                                View User Attempts ({c.user_identifier})
                              </button>
                            )}
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                            {c.attempt_id.slice(0, 14)}...
                          </td>
                          <td>
                            {c.followup_reason ? (
                              <span
                                className="badge"
                                style={{
                                  fontSize: "11px",
                                  background: c.followup_reason.includes("silent") ? "#EEF2FF" : "#FFFBEB",
                                  color: c.followup_reason.includes("silent") ? "#4338CA" : "#B45309",
                                  border: c.followup_reason.includes("silent") ? "1px solid #C7D2FE" : "1px solid #FCD34D",
                                }}
                              >
                                {c.followup_reason}
                              </span>
                            ) : c.call_outcome ? (
                              <span className="badge badge-connected" style={{ fontSize: "11px" }}>{c.call_outcome}</span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{c.connectivity_status || "—"}</span>
                            )}
                          </td>
                          <td>{getDispositionBadge(c.disposition, c.connectivity_status)}</td>
                          <td>{c.duration ? `${c.duration}s` : "—"}</td>
                          <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            {new Date(c.executed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                c.transcript_status === "ready"
                                  ? "badge-connected"
                                  : c.transcript_status === "pending"
                                  ? "badge-running"
                                  : ""
                              }`}
                              style={{ fontSize: "11px" }}
                            >
                              {c.transcript_status}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => openCallDetail(c.attempt_id)}
                              className="btn btn-secondary btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <FileText size={12} /> Inspect
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
        </div>
      )}

      {/* =========================================================================
          SECTION 2: SINGLE CALLS (INSTANT OUTBOUND) HISTORY
          ========================================================================= */}
      {activeTab === "single" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "18px", margin: 0 }}>Single Outbound Call Records</h2>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                Standalone instant calls placed via the Instant Outbound Dialer or API.
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <select
                className="form-select"
                style={{ width: "180px" }}
                value={dispositionFilter}
                onChange={(e) => setDispositionFilter(e.target.value)}
              >
                <option value="">All Dispositions</option>
                <option value="success">Success</option>
                <option value="followup">Follow-up</option>
                <option value="not_connected">Not Connected</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recipient (Masked)</th>
                  <th>Attempt ID</th>
                  <th>Status</th>
                  <th>Disposition</th>
                  <th>Duration</th>
                  <th>Executed At</th>
                  <th>Transcript Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {singleCallsList.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                      No single calls recorded yet.
                    </td>
                  </tr>
                ) : (
                  singleCallsList.map((c) => (
                    <tr key={c.attempt_id}>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                        {c.user_contact_masked || "Masked Recipient"}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        {c.attempt_id.slice(0, 14)}...
                      </td>
                      <td>
                        <span className={`badge ${c.connectivity_status === "connected" ? "badge-connected" : "badge-running"}`}>
                          {c.connectivity_status}
                        </span>
                      </td>
                      <td>{getDispositionBadge(c.disposition, c.connectivity_status)}</td>
                      <td>{c.duration ? `${c.duration}s` : "—"}</td>
                      <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {new Date(c.executed_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.transcript_status === "ready"
                              ? "badge-connected"
                              : c.transcript_status === "pending"
                              ? "badge-running"
                              : ""
                          }`}
                          style={{ fontSize: "11px" }}
                        >
                          {c.transcript_status}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => openCallDetail(c.attempt_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <FileText size={12} /> Inspect
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

      {/* =========================================================================
          MODAL: CALL DETAIL & ON-DEMAND TRANSCRIPT GENERATOR
          ========================================================================= */}
      {selectedAttemptId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "680px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Call Attempt Details & Dialogue
                </div>
                <h3 style={{ fontSize: "18px", margin: "2px 0 0", color: "var(--text-primary)" }}>
                  {callDetailData?.user_contact_masked || "Call Attempt"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedAttemptId(null);
                  setCallDetailData(null);
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                <RefreshCw size={20} className="spin" style={{ margin: "0 auto 10px" }} />
                Loading call records...
              </div>
            ) : callDetailData ? (
              <div>
                {/* Meta details grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "10px",
                    padding: "14px",
                    background: "#F8FAFC",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Attempt ID</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#4F46E5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {callDetailData.attempt_id}
                      </span>
                      <button
                        onClick={() => copyToClipboard(callDetailData.attempt_id, "att")}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                        title="Copy Attempt ID"
                      >
                        {copiedId === "att" ? <Check size={12} color="#059669" /> : <Copy size={12} color="#64748B" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Call Type</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {callDetailData.call_type === "campaign" ? `Campaign #${callDetailData.campaign_id}` : "Single Call"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Duration / Status</div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#0F172A" }}>
                      {callDetailData.duration ? `${callDetailData.duration}s` : "0s"} · {callDetailData.connectivity_status}
                    </div>
                  </div>
                </div>

                {/* Transcript Header & On-Demand Generator */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={16} color="#059669" />
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Conversation Transcript
                    </h4>
                    <span className="badge badge-connected" style={{ fontSize: "10px" }}>
                      {callDetailData.transcript_status}
                    </span>
                  </div>

                  {callDetailData.transcript_status !== "ready" && (
                    <button
                      onClick={() => handlePullTranscriptOnDemand(callDetailData.attempt_id)}
                      disabled={fetchingTranscript}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "12px" }}
                    >
                      {fetchingTranscript ? (
                        <>
                          <RefreshCw size={12} className="spin" /> Fetching from Analytics API...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} /> Generate / Pull Now
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Rendered Dialogue Bubble Stream */}
                {callDetailData.transcript_text ? (
                  <div
                    style={{
                      maxHeight: "260px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "16px",
                      background: "#F8FAFC",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "16px",
                    }}
                  >
                    {callDetailData.transcript_text.split("\n").map((line: string, lIdx: number) => {
                      const isAssistant = line.startsWith("Agent:") || line.startsWith("assistant:");
                      return (
                        <div
                          key={lIdx}
                          className={`turn-bubble ${isAssistant ? "turn-assistant" : "turn-user"}`}
                          style={{ margin: 0 }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", fontSize: "11px", fontWeight: 700 }}>
                            {isAssistant ? <Bot size={12} /> : <User size={12} />}
                            <span>{isAssistant ? "Voice Agent" : "Customer"}</span>
                          </div>
                          <div>{line.replace(/^(Agent|Customer|assistant|user):\s*/i, "")}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "24px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed var(--border-subtle)", marginBottom: "16px" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                      No transcript stored yet. If this call was connected, click below to pull dialogue turns from Sarvam Analytics.
                    </div>
                    <button
                      onClick={() => handlePullTranscriptOnDemand(callDetailData.attempt_id)}
                      disabled={fetchingTranscript}
                      className="btn btn-primary btn-sm"
                    >
                      <Sparkles size={12} /> Fetch Transcript from Analytics API
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedAttemptId(null);
                  setCallDetailData(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-MODAL: USER'S COMPLETE CAMPAIGN ATTEMPTS HISTORY
          ========================================================================= */}
      {selectedUserUid && userHistoryList && (
        <div className="modal-overlay" style={{ zIndex: 120 }}>
          <div className="modal-content" style={{ maxWidth: "600px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", margin: 0 }}>
                  User Attempt History: {selectedUserUid}
                </h3>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  Chronological multi-round attempts for this recipient in Campaign #{activeCampaign?.campaign_id}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUserUid(null);
                  setUserHistoryList(null);
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
              {userHistoryList.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: "#F8FAFC",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Attempt {item.retry_attempt ? item.retry_attempt + 1 : idx + 1}: {item.connectivity_status}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {new Date(item.executed_at).toLocaleString()} · Duration: {item.duration || 0}s
                    </div>
                  </div>
                  <div>{getDispositionBadge(item.disposition, item.connectivity_status)}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "16px", textAlign: "right" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedUserUid(null);
                  setUserHistoryList(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
