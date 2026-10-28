"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { api } from "@/lib/api";

interface CallJob {
  job_id: string;
  app_id: string;
  app_version: number;
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
  // Service configuration
  const [config, setConfig] = useState<ServiceConfig | null>(null);

  // Form states
  const [phone, setPhone] = useState("+91");
  const [appId, setAppId] = useState("");
  const [appVersion, setAppVersion] = useState("1");
  const [openingLine, setOpeningLine] = useState("");
  const [bypassWindow, setBypassWindow] = useState(false);
  const [customVars, setCustomVars] = useState<Array<{ key: string; val: string }>>([
    { key: "user_name", val: "Asha" },
  ]);

  // Operational states
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<CallJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<CallJob[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load config and existing jobs
  useEffect(() => {
    loadConfig();
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
            // Refresh recent jobs
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
      if (data?.default_app_id) {
        setAppId(data.default_app_id);
      }
      if (data?.default_app_version) {
        setAppVersion(String(data.default_app_version));
      }
    } catch (err) {
      console.error("Failed to load config:", err);
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

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!phone || phone.trim() === "+91" || phone.trim() === "+") {
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
        app_id: appId || undefined,
        app_version: appVersion ? Number(appVersion) : undefined,
        opening_line: openingLine.trim() || undefined,
        variables: variablesMap,
        bypass_window: bypassWindow,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.job_id) {
        // Fetch full newly created job
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
        return <span className="badge badge-success">Completed</span>;
      case "dialing":
        return (
          <span className="badge badge-primary" style={{ animation: "pulse 1.5s infinite" }}>
            Dialing...
          </span>
        );
      case "rejected":
        return <span className="badge badge-danger">Rejected (Guard)</span>;
      case "failed":
        return <span className="badge badge-danger">Failed</span>;
      case "busy":
        return <span className="badge badge-warning">Busy</span>;
      case "no_answer":
        return <span className="badge badge-warning">No Answer</span>;
      case "exhausted":
        return <span className="badge badge-secondary">Retries Exhausted</span>;
      default:
        return <span className="badge badge-secondary">{state}</span>;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 16px rgba(99, 102, 241, 0.4)",
              }}
            >
              <Zap size={20} color="#FFFFFF" />
            </div>
            <h1 style={{ margin: 0 }}>Instant Outbound Orchestrator</h1>
          </div>
          <p className="subtitle" style={{ margin: 0 }}>
            Server-side Sarvam Voice Agent orchestrator running directly inside Next.js with state machine, automatic retries, and webhook listeners.
          </p>
        </div>

        <button onClick={() => { loadConfig(); loadJobs(); }} className="btn btn-secondary">
          <RefreshCw size={14} /> Refresh Service
        </button>
      </div>

      {/* Diagnostics / Environment Status Bar */}
      {config && (
        <div
          className="card"
          style={{
            padding: "16px 20px",
            marginBottom: "24px",
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: config.api_key_configured ? "#10B981" : "#F59E0B",
                  boxShadow: config.api_key_configured ? "0 0 10px #10B981" : "0 0 10px #F59E0B",
                }}
              />
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                  Sarvam Telephony Provider
                </div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {config.caller_number || "No Caller Number configured in .env.local"}
                </div>
              </div>
            </div>

            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Org / Workspace</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                {config.org_id || "None"} / {config.workspace_id || "None"}
              </div>
            </div>

            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Calling Window</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#38BDF8" }}>
                {config.calling_window_hours} ({config.timezone})
              </div>
            </div>

            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "16px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Webhook URL</div>
              <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#A78BFA" }}>
                {config.webhook_url}
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#FCA5A5",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={18} color="#EF4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Column: Instant Call Dispatcher */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
            <PhoneCall size={20} color="#818CF8" />
            <h2 style={{ fontSize: "18px", margin: 0 }}>Dispatch Instant Call</h2>
          </div>

          <form onSubmit={handleDispatch}>
            {/* Phone Number */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Recipient Phone Number (E.164 Format) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Standard Indian E.164: Must start with +91 followed by 10 digits.
              </div>
            </div>

            {/* Agent App ID & Version */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label className="form-label">Sarvam App ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="agent_sales_v1"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">App Version</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                />
              </div>
            </div>

            {/* Opening Line Override */}
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Initial Bot Message (Opening Line Override)</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Optional: Hello, I am calling from Sevencore regarding your recent service inquiry."
                value={openingLine}
                onChange={(e) => setOpeningLine(e.target.value)}
              />
            </div>

            {/* Dynamic Agent Variables */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="form-label" style={{ margin: 0 }}>Agent Variables (Prompt Context)</label>
                <button
                  type="button"
                  onClick={handleAddVar}
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                >
                  <Plus size={12} /> Add Variable
                </button>
              </div>

              {customVars.map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Variable Key (e.g. user_name)"
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
                    style={{ flex: 1.2 }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVar(idx)}
                    className="btn btn-secondary"
                    style={{ padding: "8px", color: "var(--danger)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Compliance Override Option */}
            <div style={{ marginBottom: "20px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={bypassWindow}
                  onChange={(e) => setBypassWindow(e.target.checked)}
                />
                <span>Bypass TRAI Call Window Guard (for development testing only)</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: "100%", justifyContent: "center", padding: "12px" }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="spin" /> Dispatching Call...
                </>
              ) : (
                <>
                  <PhoneCall size={16} /> Place Outbound Call Now
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Job Inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {activeJob ? (
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                    Active Call Inspection
                  </div>
                  <h3 style={{ fontSize: "18px", margin: "4px 0 0" }}>{activeJob.phone}</h3>
                </div>
                {getStateBadge(activeJob.state)}
              </div>

              {/* Status details grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  padding: "14px",
                  background: "rgba(15, 23, 42, 0.6)",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Job ID</div>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {activeJob.job_id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sarvam Attempt ID</div>
                  <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#818CF8" }}>
                    {activeJob.attempt_id || "Not assigned yet"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Duration</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {activeJob.duration !== undefined ? `${activeJob.duration}s` : "Pending..."}
                  </div>
                </div>
              </div>

              {/* Chronological History Steps */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "10px" }}>
                  Execution Timeline & Guard Transitions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {activeJob.history.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "rgba(255, 255, 255, 0.03)",
                        borderLeft: "3px solid #6366F1",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <strong style={{ color: "#818CF8" }}>{step.action}</strong>
                        <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontFamily: "monospace", fontSize: "11px" }}>
                        {typeof step.details === "object" ? JSON.stringify(step.details) : String(step.details)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transcript Display if Available */}
              {activeJob.transcript && (
                <div style={{ padding: "14px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "#34D399", fontWeight: 600, fontSize: "13px" }}>
                    <FileText size={16} /> Transcript Fetched from Sarvam Analytics API
                  </div>
                  <pre style={{ margin: 0, fontSize: "11px", color: "#D1FAE5", maxHeight: "150px", overflowY: "auto" }}>
                    {JSON.stringify(activeJob.transcript, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <PhoneCall size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <div>No active call job selected. Dispatch a call using the form to see real-time updates.</div>
            </div>
          )}

          {/* Recent Jobs Mini-Table */}
          <div className="card" style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "14px", margin: "0 0 12px" }}>Recent Calls in Session</h4>
            {recentJobs.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No previous calls dispatched yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recentJobs.map((j) => (
                  <div
                    key={j.job_id}
                    onClick={() => setActiveJob(j)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "6px",
                      background: activeJob?.job_id === j.job_id ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.02)",
                      border: activeJob?.job_id === j.job_id ? "1px solid #6366F1" : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{j.phone}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {new Date(j.created_at).toLocaleTimeString()} · Attempts: {j.attempts}
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
