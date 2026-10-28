"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Megaphone,
  Users,
  Calendar,
  Clock,
  Sliders,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Play,
  Save,
  Upload,
  FileText,
  Plus,
  Loader2,
  Sparkles,
  IndianRupee,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent, Contact, Campaign } from "@/types";

interface CampaignEditorProps {
  mode: "create" | "edit";
  campaignId?: number;
}

export default function CampaignEditor({ mode, campaignId }: CampaignEditorProps) {
  const router = useRouter();

  // Core Data
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<number | "">("");

  // Schedule & Timing
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("20:00");

  // Pacing Controls
  const [cps, setCps] = useState(2);
  const [maxRetries, setMaxRetries] = useState(2);

  // Audience & Numbers
  const [audienceTab, setAudienceTab] = useState<"sheet" | "paste" | "existing">("sheet");
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [contactSearch, setContactSearch] = useState("");

  // Sheet Upload State
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetPreview, setSheetPreview] = useState<any | null>(null);
  const [parsingSheet, setParsingSheet] = useState(false);

  // Raw Pasted Numbers State
  const [pastedText, setPastedText] = useState("");
  const [parsedPastedContacts, setParsedPastedContacts] = useState<Array<{ name: string; phone_number: string }>>([]);

  // Existing campaign contacts (in edit mode)
  const [currentCampaignContacts, setCurrentCampaignContacts] = useState<any[]>([]);

  // Confirmation & Safety Guards
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [bypassHours, setBypassHours] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [campaignId]);

  const getTodayDateStr = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTomorrowDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      setErrorMessage(null);

      const [agentsData, contactsData] = await Promise.all([
        api.getAgents(),
        api.getContacts(),
      ]);

      const agentsList = Array.isArray(agentsData) ? agentsData : agentsData.results || [];
      const contactsList = Array.isArray(contactsData) ? contactsData : contactsData.results || [];
      setAgents(agentsList);
      setExistingContacts(contactsList);

      if (mode === "create") {
        if (agentsList.length > 0) {
          setSelectedAgentId(agentsList[0].id);
        }
        setScheduledDate(getTomorrowDateStr());
        setScheduledTime("10:00");
      } else if (mode === "edit" && campaignId) {
        // Load existing campaign details
        const camp: Campaign = await api.getCampaign(campaignId);
        setName(camp.name || "");
        setDescription(camp.description || "");
        setSelectedAgentId(camp.agent || (camp.agent_details?.id ?? ""));
        setWindowStart(camp.calling_window_start || "09:00");
        setWindowEnd(camp.calling_window_end || "20:00");
        setCps(camp.calls_per_second || 2);
        setMaxRetries(camp.max_retries || 2);
        setUserConfirmed(camp.is_confirmed || false);

        if (camp.scheduled_start_time) {
          setScheduleMode("scheduled");
          const d = new Date(camp.scheduled_start_time);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          setScheduledDate(`${yyyy}-${mm}-${dd}`);
          setScheduledTime(`${hh}:${min}`);
        } else {
          setScheduleMode("immediate");
          setScheduledDate(getTomorrowDateStr());
          setScheduledTime("10:00");
        }

        // Load existing campaign contacts
        try {
          const campContacts = await api.getCampaignContacts(campaignId);
          setCurrentCampaignContacts(campContacts || []);
          const existingIds = (campContacts || []).map((c: any) => c.contact?.id).filter(Boolean);
          setSelectedContactIds(existingIds);
        } catch {
          setCurrentCampaignContacts([]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load campaign data");
    } finally {
      setInitialLoading(false);
    }
  };

  const applySchedulePreset = (preset: "tomorrow_morning" | "tomorrow_afternoon" | "in_2_hours" | "next_monday") => {
    const now = new Date();
    if (preset === "tomorrow_morning") {
      setScheduledDate(getTomorrowDateStr());
      setScheduledTime("09:30");
    } else if (preset === "tomorrow_afternoon") {
      setScheduledDate(getTomorrowDateStr());
      setScheduledTime("14:30");
    } else if (preset === "in_2_hours") {
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const yyyy = in2h.getFullYear();
      const mm = String(in2h.getMonth() + 1).padStart(2, "0");
      const dd = String(in2h.getDate()).padStart(2, "0");
      const hh = String(in2h.getHours()).padStart(2, "0");
      const min = String(in2h.getMinutes()).padStart(2, "0");
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
      setScheduledTime(`${hh}:${min}`);
    } else if (preset === "next_monday") {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() + ((7 - day + 1) % 7 || 7);
      d.setDate(diff);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
      setScheduledTime("10:00");
    }
  };

  // Handle Sheet File Selection & Preview
  const handleSheetSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSheetFile(file);
    setSheetPreview(null);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setParsingSheet(true);
      const preview = await api.previewImport(formData);
      setSheetPreview(preview);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not parse spreadsheet. Make sure columns like 'Phone' or 'Mobile' exist.");
    } finally {
      setParsingSheet(false);
    }
  };

  // Parse Raw Pasted Numbers
  const handlePastedTextChange = (text: string) => {
    setPastedText(text);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: Array<{ name: string; phone_number: string }> = [];

    lines.forEach((line, idx) => {
      // Split by comma, tab, or semicolon
      const parts = line.split(/[,;\t]+/).map((p) => p.trim()).filter(Boolean);
      if (parts.length === 1) {
        parsed.push({ name: `Contact ${idx + 1}`, phone_number: parts[0] });
      } else if (parts.length >= 2) {
        // Guess which is name and which is phone
        const p1Digits = parts[0].replace(/\D/g, "");
        const p2Digits = parts[1].replace(/\D/g, "");
        if (p2Digits.length >= 10) {
          parsed.push({ name: parts[0], phone_number: parts[1] });
        } else if (p1Digits.length >= 10) {
          parsed.push({ name: parts[1], phone_number: parts[0] });
        } else {
          parsed.push({ name: parts[0], phone_number: parts[1] });
        }
      }
    });
    setParsedPastedContacts(parsed);
  };

  // Calculate Total Audience
  const selectedAgent = agents.find((a) => a.id === Number(selectedAgentId));
  const sheetValidCount = sheetPreview ? sheetPreview.valid_count : 0;
  const pastedCount = parsedPastedContacts.length;
  const existingCount = selectedContactIds.length;
  const totalAudience = Math.max(
    mode === "edit" ? currentCampaignContacts.length : 0,
    sheetValidCount + pastedCount + existingCount
  );
  const estimatedCost = (totalAudience * 1.5 * 3.5).toFixed(2);

  // Form Submission
  const handleSaveCampaign = async (launchAfterSave: boolean) => {
    if (!name.trim()) {
      setErrorMessage("Campaign name is required.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!selectedAgentId) {
      setErrorMessage("Please select a Voice Agent persona for this campaign.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (launchAfterSave && !userConfirmed) {
      setErrorMessage("Confirmation Required: You must check the authorization box before launching.");
      return;
    }

    let scheduledIsoString: string | null = null;
    if (scheduleMode === "scheduled") {
      if (!scheduledDate || !scheduledTime) {
        setErrorMessage("Please specify both a date and time for scheduled launch.");
        return;
      }
      const schedDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(schedDate.getTime()) || schedDate.getTime() <= Date.now()) {
        setErrorMessage("Scheduled start date & time must be in the future.");
        return;
      }
      scheduledIsoString = schedDate.toISOString();
    }

    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      let targetCampId = campaignId;

      const campaignPayload = {
        name: name.trim(),
        description: description.trim(),
        agent: Number(selectedAgentId),
        calling_window_start: windowStart,
        calling_window_end: windowEnd,
        scheduled_start_time: scheduledIsoString,
        calls_per_second: cps,
        max_retries: maxRetries,
        is_confirmed: userConfirmed || launchAfterSave,
      };

      if (mode === "create") {
        const createdCamp = await api.createCampaign(campaignPayload);
        targetCampId = createdCamp.id;
      } else if (mode === "edit" && targetCampId) {
        await api.updateCampaign(targetCampId, campaignPayload);
      }

      if (!targetCampId) {
        throw new Error("Campaign ID not found");
      }

      // Attach Uploaded Sheet if any
      if (sheetFile) {
        const formData = new FormData();
        formData.append("file", sheetFile);
        await api.uploadCampaignSheet(targetCampId, formData);
      }

      // Attach Pasted Raw Contacts or Selected Existing Contacts
      if (parsedPastedContacts.length > 0 || selectedContactIds.length > 0) {
        await api.addContactsToCampaign(targetCampId, {
          contact_ids: selectedContactIds,
          raw_contacts: parsedPastedContacts,
        });
      }

      // Launch or Schedule if requested
      if (launchAfterSave) {
        await api.launchCampaign(targetCampId, true, bypassHours, scheduleMode === "immediate");
      }

      setSuccessMessage(
        mode === "create"
          ? launchAfterSave
            ? scheduleMode === "scheduled"
              ? "Campaign successfully created and scheduled!"
              : "Campaign successfully created and launched!"
            : "Campaign saved as draft successfully!"
          : "Campaign changes saved successfully!"
      );

      setTimeout(() => {
        router.push("/campaigns");
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "450px" }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top Breadcrumb & Action Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/campaigns"
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={16} /> Back to Campaigns
          </Link>
          <div>
            <h1 style={{ fontSize: "22px", margin: 0, fontWeight: 800 }}>
              {mode === "create" ? "Create Calling Campaign" : `Edit Campaign: ${name || "Untitled"}`}
            </h1>
            <p className="subtitle" style={{ margin: "2px 0 0", fontSize: "12px" }}>
              Configure voice agent persona, upload numbers/sheet, set TRAI calling schedule, and review budget.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/campaigns" className="btn btn-secondary">
            Cancel
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleSaveCampaign(false)}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Save size={15} /> Save as Draft
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleSaveCampaign(true)}
            disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving...
              </>
            ) : scheduleMode === "scheduled" ? (
              <>
                <Calendar size={16} /> Confirm & Schedule Campaign
              </>
            ) : (
              <>
                <Play size={16} /> Confirm & Launch Campaign
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMessage && (
        <div
          style={{
            padding: "14px 18px",
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
            color: "#991B1B",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={18} color="#DC2626" />
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: "14px 18px",
            background: "#ECFDF5",
            border: "1px solid #6EE7B7",
            borderRadius: "8px",
            color: "#065F46",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle size={18} color="#059669" />
          {successMessage}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
        {/* Left Column: Form Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Section 1: Campaign Details */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
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
                <Megaphone size={18} color="#4F46E5" />
              </div>
              <div>
                <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>1. Campaign Information</h2>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Assign an identifiable title and business objective.
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Campaign Name <span style={{ color: "var(--accent-rose)" }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Priority Loan Eligibility Outreach"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Description & Calling Objectives
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief internal description regarding the target audience, script tone, and campaign goals..."
              />
            </div>
          </div>

          {/* Section 2: Voice Agent Persona */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
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
                  <Sparkles size={18} color="#4F46E5" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>2. Select Voice Agent Persona</h2>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Choose the AI voice agent that will conduct the conversations.
                  </div>
                </div>
              </div>

              {agents.length > 0 && (
                <Link
                  href="/agents"
                  style={{ fontSize: "12px", color: "var(--accent-primary)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={12} /> New Agent
                </Link>
              )}
            </div>

            {agents.length === 0 ? (
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: "10px",
                  background: "#FFFBEB",
                  border: "1px solid #FCD34D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "8px",
                      background: "#FEF3C7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={20} color="#D97706" />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#92400E", marginBottom: "3px" }}>
                      No existing agent. Create your agent first.
                    </div>
                    <div style={{ fontSize: "13px", color: "#B45309" }}>
                      Calling campaigns require a configured Voice Agent with language and speech models. Please create your voice agent first.
                    </div>
                  </div>
                </div>
                <Link
                  href="/agents"
                  className="btn btn-primary"
                  style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={14} /> Create Agent First
                </Link>
              </div>
            ) : (
              <div>
                <label className="form-label" style={{ fontWeight: 600, marginBottom: "8px", display: "block" }}>
                  Voice Agent <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value ? Number(e.target.value) : "")}
                  style={{ width: "100%", padding: "10px 14px", fontSize: "14px", borderRadius: "8px" }}
                  required
                >
                  <option value="" disabled>-- Select a Voice Agent --</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.language_display || ag.primary_language || "Hindi/English"}) — {ag.purpose_display || ag.purpose}
                    </option>
                  ))}
                </select>

                {/* Selected Agent Preview Card */}
                {selectedAgent && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "14px 16px",
                      background: "#F8FAFC",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>
                        {selectedAgent.name}
                      </span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span className="badge badge-success">{selectedAgent.primary_language}</span>
                        {selectedAgent.speaker && (
                          <span className="badge" style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                            {selectedAgent.speaker}
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedAgent.greeting_message && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic" }}>
                        Greeting: "{selectedAgent.greeting_message}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Target Audience & Contact Numbers / Sheet Upload */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
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
                  <Users size={18} color="#4F46E5" />
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>3. Target Audience & Numbers</h2>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Add contacts by uploading a spreadsheet, pasting numbers, or choosing existing records.
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "#F1F5F9",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#0F172A",
                }}
              >
                Audience: {totalAudience} Callee
              </div>
            </div>

            {/* Audience Method Tabs */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                borderBottom: "1px solid var(--border-subtle)",
                paddingBottom: "12px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                onClick={() => setAudienceTab("sheet")}
                className={`btn btn-sm ${audienceTab === "sheet" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FileSpreadsheet size={14} /> Upload Sheet (CSV/Excel)
              </button>
              <button
                type="button"
                onClick={() => setAudienceTab("paste")}
                className={`btn btn-sm ${audienceTab === "paste" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <FileText size={14} /> Paste Numbers
              </button>
              <button
                type="button"
                onClick={() => setAudienceTab("existing")}
                className={`btn btn-sm ${audienceTab === "existing" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Users size={14} /> Select Existing Contacts ({existingContacts.length})
              </button>
            </div>

            {/* Tab A: Sheet Upload */}
            {audienceTab === "sheet" && (
              <div>
                <div
                  style={{
                    border: "2px dashed #CBD5E1",
                    borderRadius: "10px",
                    padding: "24px",
                    textAlign: "center",
                    background: "#F8FAFC",
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleSheetSelect}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%",
                    }}
                  />
                  <Upload size={28} color="#64748B" style={{ margin: "0 auto 8px" }} />
                  <div style={{ fontWeight: 600, color: "#1E293B", fontSize: "14px" }}>
                    {sheetFile ? sheetFile.name : "Click or drag & drop contact spreadsheet (CSV, XLSX)"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Should contain columns: Name, Phone Number, Company, etc.
                  </div>
                </div>

                {parsingSheet && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "12px", color: "#4F46E5" }}>
                    <Loader2 size={14} className="animate-spin" /> Parsing and validating Indian numbers in spreadsheet...
                  </div>
                )}

                {sheetPreview && (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px",
                      background: "#EEF2FF",
                      border: "1px solid #C7D2FE",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "#312E81" }}>
                        ✓ Spreadsheet Validated: {sheetPreview.valid_count} Valid Indian Numbers ({sheetPreview.invalid_count} rejected)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSheetFile(null);
                          setSheetPreview(null);
                        }}
                        style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {sheetPreview.valid_preview && sheetPreview.valid_preview.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#4338CA" }}>
                        Sample: {sheetPreview.valid_preview.slice(0, 3).map((r: any) => `${r.name} (${r.phone_number})`).join(", ")}...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab B: Paste Numbers */}
            {audienceTab === "paste" && (
              <div>
                <label className="form-label" style={{ fontSize: "12px" }}>
                  Paste rows with <strong>Name, Phone Number</strong> (one recipient per line)
                </label>
                <textarea
                  className="form-input"
                  rows={5}
                  value={pastedText}
                  onChange={(e) => handlePastedTextChange(e.target.value)}
                  placeholder={`Aarav Sharma, +919876543210\nPooja Patel, 9823012345\nVikram Singh, +918040001234`}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
                  <span style={{ fontSize: "12px", color: parsedPastedContacts.length > 0 ? "var(--accent-emerald)" : "var(--text-muted)", fontWeight: 600 }}>
                    {parsedPastedContacts.length > 0 ? `✓ Parsed ${parsedPastedContacts.length} recipient numbers` : "No numbers entered yet"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPastedText("");
                      setParsedPastedContacts([]);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px" }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Tab C: Select from Existing Contacts */}
            {audienceTab === "existing" && (
              <div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search existing contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    style={{ fontSize: "13px" }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (selectedContactIds.length === existingContacts.length) {
                        setSelectedContactIds([]);
                      } else {
                        setSelectedContactIds(existingContacts.map((c) => c.id));
                      }
                    }}
                  >
                    {selectedContactIds.length === existingContacts.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                  }}
                >
                  {existingContacts
                    .filter((c) =>
                      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                      c.phone_number.includes(contactSearch)
                    )
                    .map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderBottom: "1px solid #F1F5F9",
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
                        />
                        <span style={{ fontWeight: 600, fontSize: "13px" }}>{c.name}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {c.phone_number}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Campaign Schedule & Permitted Window */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
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
                <Calendar size={18} color="#4F46E5" />
              </div>
              <div>
                <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>4. Schedule Date & Calling Window</h2>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Select when calls will be triggered and daily TRAI permitted hours.
                </div>
              </div>
            </div>

            {/* Start Timing Selector */}
            <div style={{ marginBottom: "18px" }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "8px" }}>
                Start Timing Mode
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div
                  onClick={() => setScheduleMode("immediate")}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    border: scheduleMode === "immediate" ? "2px solid #4F46E5" : "1px solid #CBD5E1",
                    background: scheduleMode === "immediate" ? "#EEF2FF" : "#F8FAFC",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: scheduleMode === "immediate" ? "#4F46E5" : "#1E293B" }}>
                    <Play size={16} color={scheduleMode === "immediate" ? "#4F46E5" : "#64748B"} />
                    Launch Immediately
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Calls begin as soon as you confirm launch.
                  </div>
                </div>

                <div
                  onClick={() => setScheduleMode("scheduled")}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    border: scheduleMode === "scheduled" ? "2px solid #4F46E5" : "1px solid #CBD5E1",
                    background: scheduleMode === "scheduled" ? "#EEF2FF" : "#F8FAFC",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: scheduleMode === "scheduled" ? "#4F46E5" : "#1E293B" }}>
                    <Calendar size={16} color={scheduleMode === "scheduled" ? "#4F46E5" : "#64748B"} />
                    Schedule for Later (Calendar)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Select future calendar date and time.
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar & Time Selection Box */}
            {scheduleMode === "scheduled" && (
              <div
                style={{
                  padding: "18px",
                  borderRadius: "10px",
                  background: "#F8FAFC",
                  border: "1px solid #C7D2FE",
                  marginBottom: "18px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1E1B4B", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={15} color="#4F46E5" /> Scheduled Start Date & Time
                  </div>
                  <div style={{ fontSize: "11px", color: "#4F46E5", fontWeight: 600 }}>Asia/Kolkata (IST)</div>
                </div>

                {/* Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                  <button
                    type="button"
                    onClick={() => applySchedulePreset("tomorrow_morning")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    Tomorrow 09:30 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => applySchedulePreset("tomorrow_afternoon")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    Tomorrow 02:30 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => applySchedulePreset("in_2_hours")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    In 2 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => applySchedulePreset("next_monday")}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    Next Mon 10:00 AM
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Calendar size={13} color="#4F46E5" /> Start Date
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      min={getTodayDateStr()}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Clock size={13} color="#4F46E5" /> Start Time (IST)
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {scheduledDate && scheduledTime && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: "#EEF2FF",
                      color: "#3730A3",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Clock size={14} color="#4F46E5" />
                    Campaign will launch on:{" "}
                    {new Date(`${scheduledDate}T${scheduledTime}:00`).toLocaleString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    IST
                  </div>
                )}
              </div>
            )}

            {/* Daily Permitted Calling Window */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Permitted Window Start (IST)</label>
                <input
                  type="time"
                  className="form-input"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Permitted Window End (IST)</label>
                <input
                  type="time"
                  className="form-input"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              TRAI commercial telemarketing regulations permit outbound calls between 09:00 AM and 08:00 PM IST.
            </div>
          </div>

          {/* Section 5: Pacing & Concurrency Controls */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
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
                <Sliders size={18} color="#4F46E5" />
              </div>
              <div>
                <h2 style={{ fontSize: "16px", margin: 0, fontWeight: 700 }}>5. Pacing & Concurrency Controls</h2>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Configure dispatch rate and automatic retry attempts.
                </div>
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
                  Recommended: 2 calls/sec
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
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  Applies to unanswered attempts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Summary & Authorization */}
        <div style={{ position: "sticky", top: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Summary Card */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 14px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
              Campaign Overview
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Target Audience</span>
                <span style={{ fontWeight: 700 }}>{totalAudience} contacts</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Voice Agent</span>
                <span style={{ fontWeight: 600 }}>
                  {agents.find((a) => a.id === selectedAgentId)?.name || "Not selected"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Launch Mode</span>
                <span style={{ fontWeight: 600, color: scheduleMode === "scheduled" ? "#4F46E5" : "var(--accent-emerald)" }}>
                  {scheduleMode === "scheduled" ? "📅 Scheduled" : "⚡ Immediate"}
                </span>
              </div>

              {scheduleMode === "scheduled" && scheduledDate && scheduledTime && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Start Time</span>
                  <span style={{ fontWeight: 600, fontSize: "12px" }}>
                    {scheduledDate} {scheduledTime} IST
                  </span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Calling Window</span>
                <span style={{ fontWeight: 600 }}>{windowStart} – {windowEnd} IST</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>CPS Rate</span>
                <span style={{ fontWeight: 600 }}>{cps} calls/sec</span>
              </div>

              <div
                style={{
                  marginTop: "8px",
                  paddingTop: "12px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Estimated Spend</div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-amber)" }}>
                    ₹{estimatedCost}
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                  ₹3.50/min @ 1.5 min avg
                </div>
              </div>
            </div>
          </div>

          {/* Compliance & Authorization Card */}
          <div className="card" style={{ padding: "20px", background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1E1B4B", marginBottom: "10px", fontSize: "13px" }}>
              <ShieldCheck size={16} color="#4F46E5" /> Safety & Launch Guard
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "14px" }}>
              <input
                type="checkbox"
                id="user-auth-check"
                checked={userConfirmed}
                onChange={(e) => setUserConfirmed(e.target.checked)}
                style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#4F46E5" }}
              />
              <label htmlFor="user-auth-check" style={{ fontSize: "12px", color: "#1E1B4B", lineHeight: "1.4" }}>
                <strong>I explicitly authorize executing calls for this campaign.</strong>
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <input
                type="checkbox"
                id="bypass-hours-check"
                checked={bypassHours}
                onChange={(e) => setBypassHours(e.target.checked)}
                style={{ width: "14px", height: "14px", accentColor: "#4F46E5" }}
              />
              <label htmlFor="bypass-hours-check" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Bypass calling hours check (dev/test)
              </label>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => handleSaveCampaign(true)}
              disabled={saving}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : scheduleMode === "scheduled" ? (
                <>
                  <Calendar size={16} /> Schedule Campaign
                </>
              ) : (
                <>
                  <Play size={16} /> Launch Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

