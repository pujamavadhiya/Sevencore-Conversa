"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  PhoneCall,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  FileText,
  Radio,
  Server,
  ArrowRight,
  Info,
  Bot,
  User,
  Copy,
  Check,
  ExternalLink,
  PhoneForwarded,
} from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent } from "@/types";

interface CallJob {
  job_id: string;
  app_id: string;
  app_version: number;
  agent_id?: number;
  agent_name?: string;
  phone: string;
  variables: Record<string, any>;
  opening_line?: string;
  state:
    | "created"
    | "dialing"
    | "completed"
    | "no_answer"
    | "busy"
    | "failed"
    | "unknown"
    | "rejected"
    | "exhausted";
  attempts: number;
  attempt_id?: string;
  interaction_id?: string;
  duration?: number;
  final_vars?: Record<string, any>;
  history: Array<{ action: string; details: any; timestamp: string }>;
  created_at: string;
  updated_at: string;
  transcript?: any;
}

interface ServiceConfig {
  api_base: string;
  api_key_configured: boolean;
  api_key_masked: string;
  org_id: string;
  workspace_id: string;
  connection_id: string;
  caller_number: string;
  webhook_url: string;
  webhook_secret_configured: boolean;
  default_app_id: string;
  default_app_version: number;
  calling_window_hours: string;
  timezone: string;
  max_attempts: number;
  retry_delays_sec: number[];
}

export default function InstantOutboundPage() {
  // Service configuration & Voice Agents
  const [config, setConfig] = useState<ServiceConfig | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Form states
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [phone, setPhone] = useState("+91");
  const [openingLine, setOpeningLine] = useState("");
  const [bypassWindow, setBypassWindow] = useState(false);
  const [customVars, setCustomVars] = useState<Array<{ key: string; val: string }>>([
    { key: "user_name", val: "Asha Sharma" },
  ]);

  // Operational states
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<CallJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<CallJob[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load config, agents, and existing jobs on mount
  useEffect(() => {
    loadConfig();
    loadAgents();
    loadJobs();
  }, []);

  // Poll active job while dialing or created
  useEffect(() => {
    if (activeJob && (activeJob.state === "dialing" || activeJob.state === "created")) {
      const interval = setInterval(async () => {
        try {
          const res = await api.getInstantCall(activeJob.job_id);
          if (res && !res.error) {
            setActiveJob(res);
            loadJobs();
          }
        } catch {
          // ignore transient poll error
        }
      }, 3000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    } else if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  }, [activeJob?.job_id, activeJob?.state]);

  const loadConfig = async () => {
    try {
      const data = await api.getInstantConfig();
      setConfig(data);
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      const data = await api.getAgents();
      const list = Array.isArray(data) ? data : data?.results || [];
      setAgents(list);
      if (list.length > 0) {
        const first = list[0];
        setSelectedAgentId(String(first.id));
        if (first.greeting_message) {
          setOpeningLine(first.greeting_message);
        }
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await api.getInstantCalls();
      if (Array.isArray(data)) {
        setRecentJobs(data);
        if (!activeJob && data.length > 0) {
          setActiveJob(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load instant calls:", err);
    }
  };

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const found = agents.find((a) => String(a.id) === agentId);
    if (found && found.greeting_message) {
      setOpeningLine(found.greeting_message);
    }
  };

  const selectedAgent = agents.find((a) => String(a.id) === selectedAgentId);

  const handleAddVar = () => {
    setCustomVars([...customVars, { key: "", val: "" }]);
  };

  const handleRemoveVar = (idx: number) => {
    setCustomVars(customVars.filter((_, i) => i !== idx));
  };

  const handleVarChange = (idx: number, field: "key" | "val", value: string) => {
    const updated = [...customVars];
    updated[idx][field] = value;
    setCustomVars(updated);
  };

  const handleApplyPreset = (key: string, defaultVal: string) => {
    if (!customVars.some((v) => v.key === key)) {
      setCustomVars([...customVars, { key, val: defaultVal }]);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (agents.length === 0) {
      setErrorMsg("No existing agent. Please create your voice agent first before placing a call.");
      return;
    }

    if (!selectedAgent) {
      setErrorMsg("Please select a Voice Agent from the dropdown.");
      return;
    }

    if (!phone || phone.trim() === "+91" || phone.trim() === "+" || phone.trim().length < 10) {
      setErrorMsg("Please provide a valid E.164 phone number including country code (e.g. +919876543210).");
      return;
    }

    const variablesMap: Record<string, any> = {};
    for (const item of customVars) {
      if (item.key.trim()) {
        variablesMap[item.key.trim()] = item.val;
      }
    }

    try {
      setSubmitting(true);
      const res = await api.dispatchInstantCall({
        phone: phone.trim(),
        app_id: selectedAgent.sarvam_app_id || config?.default_app_id || "agent_sales_v1",
        app_version: selectedAgent.sarvam_app_version || 1,
        agent_id: selectedAgent.id,
        agent_name: selectedAgent.name,
        opening_line: openingLine.trim() || selectedAgent.greeting_message || undefined,
        variables: variablesMap,
        bypass_window: bypassWindow,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.job_id) {
        const fullJob = await api.getInstantCall(res.job_id);
        setActiveJob(fullJob);
        loadJobs();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger instant outbound call.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case "completed":
        return <span className="badge badge-connected"><CheckCircle2 size={12} /> Connected</span>;
      case "dialing":
        return (
          <span className="badge badge-running">
            <span className="live-dot" style={{ width: "6px", height: "6px" }} /> Dialing
          </span>
        );
      case "rejected":
        return <span className="badge badge-danger"><AlertTriangle size={12} /> Rejected (Guard)</span>;
      case "failed":
        return <span className="badge badge-danger">Failed</span>;
      case "busy":
        return <span className="badge badge-warning">Busy</span>;
      case "no_answer":
        return <span className="badge badge-warning">No Answer</span>;
      case "exhausted":
        return <span className="badge" style={{ background: "#F1F5F9", color: "#475569" }}>Retries Exhausted</span>;
      default:
        return <span className="badge" style={{ background: "#F1F5F9", color: "#475569" }}>{state}</span>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
              }}
            >
              <Zap size={22} color="#FFFFFF" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
                Instant Outbound Caller
              </h1>
              <p className="subtitle" style={{ margin: 0 }}>
                Trigger immediate, high-fidelity AI voice phone calls to any Indian number using your pre-configured Voice Agents.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/agents" className="btn btn-secondary">
            <Bot size={15} /> Manage Voice Agents
          </Link>
          <button
            onClick={() => {
              loadConfig();
              loadAgents();
              loadJobs();
            }}
            className="btn btn-secondary"
            title="Refresh Service and Telephony Configuration"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Telephony Gateway & Compliance Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Telephony Gateway Number */}
        <div className="glass-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Telephony Gateway
            </span>
            <span className="badge badge-connected">
              <span className="live-dot" /> Live
            </span>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
            {config?.caller_number || "+91 80 4000 1234"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Sarvam Rented Caller ID (CLI)
          </div>
        </div>

        {/* Selected Voice Agent */}
        <div className="glass-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Active Voice Agent
            </span>
            <Bot size={16} color="#4F46E5" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
            {selectedAgent ? selectedAgent.name : "None Selected"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {selectedAgent ? `${selectedAgent.language_display || selectedAgent.primary_language} · ${selectedAgent.speaker}` : "Create an agent first"}
          </div>
        </div>

        {/* TRAI Window */}
        <div className="glass-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Calling Window
            </span>
            <Clock size={16} color="#0284C7" />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#0284C7" }}>
            {config?.calling_window_hours || "09:00 - 20:00"} IST
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            TRAI Indian Regulatory Compliance
          </div>
        </div>

        {/* Webhook Status */}
        <div className="glass-panel" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Event Webhook
            </span>
            <ShieldCheck size={16} color="#059669" />
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            /api/sarvam/webhook
          </div>
          <div style={{ fontSize: "12px", color: "#059669", marginTop: "4px" }}>
            Secret Authenticated & Idempotent
          </div>
        </div>
      </div>

      {/* If No Agents Exist: Prominent Alert Banner */}
      {!loadingAgents && agents.length === 0 && (
        <div
          style={{
            padding: "28px 32px",
            background: "#FFFFFF",
            border: "1px solid #FCD34D",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
            gap: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "var(--accent-amber-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bot size={26} color="#D97706" />
            </div>
            <div>
              <h3 style={{ fontSize: "18px", color: "#92400E", marginBottom: "4px" }}>
                No existing agent. Create your agent first.
              </h3>
              <p style={{ margin: 0, fontSize: "14px", color: "#B45309", lineHeight: 1.5 }}>
                Instant outbound calls require a pre-configured Voice Agent persona with language, instructions, and speech models. Please create your first Voice Agent to enable instant calling.
              </p>
            </div>
          </div>
          <Link href="/agents" className="btn btn-primary" style={{ padding: "12px 20px", flexShrink: 0 }}>
            <Plus size={16} /> Create Your Agent First
          </Link>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMsg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-rose-bg)",
            border: "1px solid rgba(225, 29, 72, 0.3)",
            color: "var(--accent-rose)",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={18} color="var(--accent-rose)" style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Responsive Workspace */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Column: Instant Outbound Dispatch Console */}
        <div className="glass-panel" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
            <PhoneForwarded size={20} color="#4F46E5" />
            <h2 style={{ fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
              Dispatch Outbound Call
            </h2>
          </div>

          <form onSubmit={handleDispatch}>
            {/* Step 1: Select Existing Agent Dropdown */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Select Voice Agent *
                </label>
                <Link
                  href="/agents"
                  style={{ fontSize: "12px", color: "var(--accent-primary)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={12} /> New Agent
                </Link>
              </div>

              {loadingAgents ? (
                <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
                  Loading existing voice agents...
                </div>
              ) : agents.length === 0 ? (
                <div
                  style={{
                    padding: "14px 16px",
                    background: "var(--accent-amber-bg)",
                    border: "1px solid rgba(217, 119, 6, 0.3)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "13px",
                    color: "#92400E",
                  }}
                >
                  No existing agent. Create your agent first.
                </div>
              ) : (
                <>
                  <select
                    className="form-select"
                    value={selectedAgentId}
                    onChange={(e) => handleSelectAgent(e.target.value)}
                    required
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name} ({ag.language_display || ag.primary_language || "Hindi/English"}) — {ag.purpose_display || ag.purpose}
                      </option>
                    ))}
                  </select>

                  {/* Selected Agent Quick Metadata Card */}
                  {selectedAgent && (
                    <div
                      style={{
                        marginTop: "10px",
                        padding: "12px 14px",
                        background: "#F8FAFC",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            background: "#EEF2FF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Bot size={18} color="#4F46E5" />
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>
                            {selectedAgent.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#64748B" }}>
                            Voice Model: {selectedAgent.voice_model || "Bulbul v4"} · Speaker: {selectedAgent.speaker}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-connected" style={{ fontSize: "11px" }}>
                        Ready to Dial
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 2: Recipient Phone Number */}
            <div className="form-group">
              <label className="form-label">
                Recipient Phone Number (Indian E.164) *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                Format: Must start with <code>+91</code> followed by a 10-digit mobile number.
              </div>
            </div>

            {/* Step 3: Initial Bot Greeting (Opening Line Override) */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Opening Line / Greeting Message
                </label>
                {selectedAgent?.greeting_message && (
                  <button
                    type="button"
                    onClick={() => setOpeningLine(selectedAgent.greeting_message)}
                    style={{ background: "none", border: "none", color: "var(--accent-primary)", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    Reset to Agent Default
                  </button>
                )}
              </div>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Hello, I am calling from Sevencore Conversa regarding your service request..."
                value={openingLine}
                onChange={(e) => setOpeningLine(e.target.value)}
              />
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Spoken aloud immediately when the customer picks up the call.
              </div>
            </div>

            {/* Step 4: Dynamic Agent Variables */}
            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div>
                  <label className="form-label" style={{ margin: 0 }}>
                    Dynamic Agent Variables
                  </label>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Injected into prompt context (e.g. customer name, appointment time)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddVar}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus size={12} /> Add Key-Value
                </button>
              </div>

              {/* Quick Presets */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", alignSelf: "center", marginRight: "4px" }}>
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("user_name", "Rahul")}
                  className="badge"
                  style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", cursor: "pointer" }}
                >
                  + user_name
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("company_name", "Acme Retail")}
                  className="badge"
                  style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", cursor: "pointer" }}
                >
                  + company_name
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("due_amount", "₹1,250")}
                  className="badge"
                  style={{ background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", cursor: "pointer" }}
                >
                  + due_amount
                </button>
              </div>

              {customVars.map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Key (e.g. user_name)"
                    value={item.key}
                    onChange={(e) => handleVarChange(idx, "key", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Value (e.g. Asha)"
                    value={item.val}
                    onChange={(e) => handleVarChange(idx, "val", e.target.value)}
                    style={{ flex: 1.3 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVar(idx)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: "var(--accent-rose)", padding: "8px 10px" }}
                    title="Remove variable"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Compliance Override Checkbox */}
            <div
              style={{
                marginBottom: "24px",
                padding: "14px 16px",
                background: "#F8FAFC",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={bypassWindow}
                  onChange={(e) => setBypassWindow(e.target.checked)}
                  style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#4F46E5" }}
                />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Bypass TRAI Call Window Guard (09:00 - 20:00 IST)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Enables dialing outside regulatory calling hours for development testing on internal numbers.
                  </div>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            {agents.length === 0 ? (
              <Link
                href="/agents"
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <Plus size={18} /> Create Your Agent First
              </Link>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting || agents.length === 0}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} className="spin" /> Dispatching Outbound Call...
                  </>
                ) : (
                  <>
                    <PhoneCall size={18} /> Place Instant Outbound Call
                  </>
                )}
              </button>
            )}
          </form>
        </div>

        {/* Right Column: Live Call Inspector & Real-time History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Active Call Inspector Card */}
          {activeJob ? (
            <div className="glass-panel" style={{ padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Live Call Session
                  </div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 2px" }}>
                    {activeJob.phone}
                  </h3>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Agent: <strong style={{ color: "var(--text-primary)" }}>{activeJob.agent_name || activeJob.app_id}</strong>
                  </div>
                </div>
                <div>{getStateBadge(activeJob.state)}</div>
              </div>

              {/* Status details grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  padding: "16px",
                  background: "#F8FAFC",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Job ID</div>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeJob.job_id}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Sarvam Attempt ID</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#4F46E5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeJob.attempt_id ? activeJob.attempt_id.slice(0, 14) + "..." : "Awaiting..."}
                    </span>
                    {activeJob.attempt_id && (
                      <button
                        onClick={() => copyToClipboard(activeJob.attempt_id!, "att")}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#64748B" }}
                        title="Copy Attempt ID"
                      >
                        {copiedId === "att" ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>Duration</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                    {activeJob.duration !== undefined ? `${activeJob.duration}s` : "In Progress"}
                  </div>
                </div>
              </div>

              {/* Timeline of State Transitions */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "12px" }}>
                  Timeline & Regulatory Guard Verification
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {activeJob.history.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        background: "#F8FAFC",
                        borderLeft: "3px solid #4F46E5",
                        borderTop: "1px solid var(--border-subtle)",
                        borderRight: "1px solid var(--border-subtle)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px", color: "#1E293B" }}>
                          {step.action}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#64748B" }}>
                        {typeof step.details === "object" ? JSON.stringify(step.details) : String(step.details)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Turn-by-Turn Audio Transcript if fetched */}
              {activeJob.transcript && (
                <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <FileText size={16} color="#059669" />
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0F172A" }}>
                      Turn-by-Turn Conversation Transcript
                    </h4>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                    {Array.isArray(activeJob.transcript?.turns) && activeJob.transcript.turns.length > 0 ? (
                      activeJob.transcript.turns.map((turn: any, tIdx: number) => {
                        const isAssistant = turn.role === "agent" || turn.role === "assistant";
                        return (
                          <div
                            key={tIdx}
                            className={`turn-bubble ${isAssistant ? "turn-assistant" : "turn-user"}`}
                            style={{ margin: 0 }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "11px", fontWeight: 700, color: isAssistant ? "#4338CA" : "#334155" }}>
                              {isAssistant ? <Bot size={13} /> : <User size={13} />}
                              <span>{isAssistant ? (activeJob.agent_name || "Voice Agent") : "Customer"}</span>
                            </div>
                            <div>{turn.text || turn.content || turn.en_text || JSON.stringify(turn)}</div>
                          </div>
                        );
                      })
                    ) : (
                      <pre style={{ margin: 0, fontSize: "12px", padding: "12px", background: "#F8FAFC", borderRadius: "8px", overflowX: "auto" }}>
                        {JSON.stringify(activeJob.transcript, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="glass-panel"
              style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-muted)" }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "#F1F5F9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <PhoneCall size={26} color="#94A3B8" />
              </div>
              <h3 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "6px" }}>
                Ready to Dispatch
              </h3>
              <p style={{ margin: 0, fontSize: "13px", maxWidth: "340px", marginInline: "auto" }}>
                Select a Voice Agent and enter a recipient phone number on the left to initiate a live outbound call and track its progress here.
              </p>
            </div>
          )}

          {/* Recent Dispatches Mini-Table */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Recent Calls in This Session
              </h4>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {recentJobs.length} {recentJobs.length === 1 ? "call" : "calls"}
              </span>
            </div>

            {recentJobs.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-muted)", padding: "12px 0" }}>
                No calls dispatched yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentJobs.map((j) => (
                  <div
                    key={j.job_id}
                    onClick={() => setActiveJob(j)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      background: activeJob?.job_id === j.job_id ? "#EEF2FF" : "#F8FAFC",
                      border: activeJob?.job_id === j.job_id ? "1px solid #6366F1" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {j.phone}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {j.agent_name || j.app_id} · {new Date(j.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div>{getStateBadge(j.state)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
