"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Plus,
  Sparkles,
  Languages,
  Mic,
  Volume2,
  VolumeX,
  Clock,
  Timer,
  BookOpen,
  FileText,
  CheckCircle2,
  Trash2,
  Edit,
  Sliders,
  HelpCircle,
  Upload,
  Globe,
  FileEdit,
} from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent } from "@/types";

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  style: string;
  model: string;
  languages: string[];
  sample_text_hi: string;
  sample_text_en: string;
}

const DEFAULT_VOICE_CATALOG: VoiceOption[] = [
  {
    id: "meera",
    name: "Meera",
    gender: "Female",
    style: "Warm & Professional",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English", "Marathi"],
    sample_text_hi: "नमस्ते! मैं सेवनकोर कॉन्वर्सा से मीरा हूँ। आज मैं आपकी क्या सहायता कर सकती हूँ?",
    sample_text_en: "Hello! I am Meera from Sevencore Conversa. How can I assist you with your business today?",
  },
  {
    id: "pavithra",
    name: "Pavithra",
    gender: "Female",
    style: "Empathetic & Courteous",
    model: "Bulbul v4",
    languages: ["Hindi", "Tamil", "Telugu"],
    sample_text_hi: "नमस्ते, मैं पवित्रा बोल रही हूँ। क्या मेरी बात अपॉइंटमेंट होल्डर से हो रही है?",
    sample_text_en: "Hello, this is Pavithra calling to confirm your upcoming appointment.",
  },
  {
    id: "arvind",
    name: "Arvind",
    gender: "Male",
    style: "Calm & Authoritative",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English", "Tamil"],
    sample_text_hi: "नमस्कार, मैं समाधान फाइनेंस से अरविन्द बोल रहा हूँ।",
    sample_text_en: "Hello, this is Arvind calling regarding your customer account updates.",
  },
  {
    id: "amartya",
    name: "Amartya",
    gender: "Male",
    style: "Energetic & Clear",
    model: "Bulbul v4",
    languages: ["Hindi", "Bengali", "Indian English"],
    sample_text_hi: "नमस्ते! मैं अमर्त्य बोल रहा हूँ। क्या आप नए फीचर्स के बारे में जानना चाहते हैं?",
    sample_text_en: "Hi there! I am Amartya. Would you like to hear about our new voice automation capabilities?",
  },
  {
    id: "ananya",
    name: "Ananya",
    gender: "Female",
    style: "Customer Support Specialist",
    model: "Bulbul v4",
    languages: ["Indian English", "Hindi"],
    sample_text_hi: "नमस्ते, मैं अनन्या हूँ। कस्टमर सपोर्ट में आपका स्वागत है।",
    sample_text_en: "Hello! I am Ananya from Customer Support. I hope you are having a wonderful day.",
  },
  {
    id: "maitreyi",
    name: "Maitreyi",
    gender: "Female",
    style: "Articulate & Formal",
    model: "Bulbul v4",
    languages: ["Hindi", "Bengali", "Gujarati"],
    sample_text_hi: "नमस्कार! मैं मैत्रेयी हूँ। आपके प्रश्नों के समाधान के लिए उपलब्ध हूँ।",
    sample_text_en: "Greetings! I am Maitreyi, available to assist with your operational requirements.",
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [voices, setVoices] = useState<VoiceOption[]>(DEFAULT_VOICE_CATALOG);
  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAgent | null>(null);

  // Agent Setup Fields requested by user:
  // 1. Agent Name
  const [name, setName] = useState("");
  // 2. Turn timeout (seconds)
  const [turnTimeout, setTurnTimeout] = useState(7);
  // 3. Max conversation time (seconds / minutes)
  const [maxDurationMinutes, setMaxDurationMinutes] = useState(10);
  // 4. Voice dropdown selection
  const [speaker, setSpeaker] = useState("meera");
  // 5. First message
  const [greeting, setGreeting] = useState("");
  // 6. System prompt (what we want our agent to do)
  const [instructions, setInstructions] = useState("");
  // 7. Knowledge Base connection for learning
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);

  // Other metadata
  const [purpose, setPurpose] = useState("sales_qualification");
  const [language, setLanguage] = useState("Hindi");
  const [sarvamAppId, setSarvamAppId] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Voice Testing State
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [activePlayingSpeaker, setActivePlayingSpeaker] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [aData, tData, vData, kbData] = await Promise.all([
        api.getAgents(),
        api.getAgentTemplates(),
        api.getVoices().catch(() => DEFAULT_VOICE_CATALOG),
        api.getKnowledgeFiles().catch(() => []),
      ]);
      setAgents(Array.isArray(aData) ? aData : aData.results || []);
      setTemplates(tData || []);
      if (Array.isArray(vData) && vData.length > 0) setVoices(vData);
      setKnowledgeFiles(Array.isArray(kbData) ? kbData : kbData.results || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Test the selected voice using browser SpeechSynthesis or synthesized speech
  const handleTestVoice = (speakerId?: string) => {
    const targetSpeaker = speakerId || speaker;
    const voiceObj = voices.find((v) => v.id === targetSpeaker) || voices[0];
    const isHindi = language.toLowerCase().includes("hindi");
    const textToSpeak = isHindi ? voiceObj.sample_text_hi : voiceObj.sample_text_en;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = isHindi ? "hi-IN" : "en-IN";
      utterance.rate = 0.95;

      // Adjust pitch/rate based on speaker style
      if (voiceObj.gender === "Male") {
        utterance.pitch = 0.85;
      } else {
        utterance.pitch = 1.15;
      }

      utterance.onstart = () => {
        setIsPlayingSample(true);
        setActivePlayingSpeaker(targetSpeaker);
      };

      utterance.onend = () => {
        setIsPlayingSample(false);
        setActivePlayingSpeaker(null);
      };

      utterance.onerror = () => {
        setIsPlayingSample(false);
        setActivePlayingSpeaker(null);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback alert if browser speech synthesis is restricted
      alert(`Voice Sample for ${voiceObj.name} (${voiceObj.style}):\n"${textToSpeak}"`);
    }
  };

  const handleStopVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingSample(false);
    setActivePlayingSpeaker(null);
  };

  const openSetupModal = (agentToEdit?: VoiceAgent, tpl?: any) => {
    if (agentToEdit) {
      setEditingAgent(agentToEdit);
      setName(agentToEdit.name);
      setTurnTimeout(agentToEdit.turn_timeout_seconds || 7);
      setMaxDurationMinutes(Math.round((agentToEdit.max_conversation_duration_seconds || 600) / 60));
      setSpeaker(agentToEdit.speaker || "meera");
      setLanguage(agentToEdit.primary_language || "Hindi");
      setPurpose(agentToEdit.purpose || "sales_qualification");
      setSarvamAppId(agentToEdit.sarvam_app_id || `app_agent_${agentToEdit.id}`);
      setGreeting(agentToEdit.greeting_message || "");
      setInstructions(agentToEdit.system_instructions || "");
      const attachedIds = agentToEdit.knowledge_files?.map((f: any) => f.id) || [];
      setSelectedKbIds(attachedIds);
    } else if (tpl) {
      setEditingAgent(null);
      setName(tpl.name);
      setTurnTimeout(tpl.turn_timeout_seconds || 7);
      setMaxDurationMinutes(Math.round((tpl.max_conversation_duration_seconds || 600) / 60));
      setSpeaker(tpl.speaker || "meera");
      setLanguage(tpl.primary_language || "Hindi");
      setPurpose(tpl.purpose || "sales_qualification");
      setSarvamAppId(`app_${tpl.purpose}_v1`);
      setGreeting(tpl.greeting_message);
      setInstructions(tpl.system_instructions);
      setSelectedKbIds([]);
    } else {
      setEditingAgent(null);
      setName("");
      setTurnTimeout(7);
      setMaxDurationMinutes(10);
      setSpeaker("meera");
      setLanguage("Hindi");
      setPurpose("sales_qualification");
      setSarvamAppId(`app_agent_${Date.now().toString().slice(-4)}`);
      setGreeting("नमस्ते! मैं सेवनकोर कॉन्वर्सा से बोल रही हूँ। क्या अभी दो मिनट बात करने का सही समय है?");
      setInstructions(
        "You are an AI voice calling agent for our business.\n" +
        "1. Speak courteously and listen carefully without interrupting.\n" +
        "2. Answer customer queries based on the attached knowledge base documents.\n" +
        "3. If caller expresses interest, ask to schedule a follow-up consultation."
      );
      setSelectedKbIds([]);
    }
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name,
      purpose,
      primary_language: language,
      speaker,
      sarvam_app_id: sarvamAppId || `app_agent_${Date.now().toString().slice(-4)}`,
      sarvam_app_version: 1,
      turn_timeout_seconds: Number(turnTimeout),
      max_conversation_duration_seconds: Number(maxDurationMinutes) * 60,
      greeting_message: greeting,
      system_instructions: instructions,
      knowledge_file_ids: selectedKbIds,
    };

    try {
      if (editingAgent) {
        await api.updateAgent(editingAgent.id, payload);
      } else {
        await api.createAgent(payload);
      }
      setModalOpen(false);
      handleStopVoice();
      loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to save agent configuration");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this voice agent?")) {
      try {
        await api.deleteAgent(id);
        loadAll();
      } catch (err: any) {
        alert(err.message || "Error deleting agent");
      }
    }
  };

  const selectedVoiceObj = voices.find((v) => v.id === speaker) || voices[0];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Voice Agent Setup & Telephony Intelligence</h1>
          <p className="subtitle">
            Configure agent names, conversational timeouts, Sarvam Bulbul voices with audio testing, opening messages, system prompts, and ground them with your Knowledge Base.
          </p>
        </div>
        <Link
          href="/agents/new"
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} /> New Agent Setup
        </Link>
      </div>

      {/* Pre-built Templates */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <h2 style={{ fontSize: "16px" }}>Quick-Start Presets</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="glass"
              style={{
                padding: "20px",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span className="badge badge-running">{tpl.primary_language}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Bulbul v4 • {tpl.speaker}</span>
                </div>
                <h3 style={{ fontSize: "15px", color: "var(--text-primary)", marginBottom: "6px" }}>{tpl.name}</h3>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", marginBottom: "16px" }}>
                  {tpl.greeting_message.slice(0, 75)}...
                </p>
              </div>
              <Link href="/agents/new" className="btn btn-secondary btn-sm" style={{ textAlign: "center" }}>
                Use This Preset
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Configured Agents List */}
      <div>
        <h2 style={{ fontSize: "18px", marginBottom: "16px" }}>Configured Voice Agents ({agents.length})</h2>
        {agents.length === 0 && !loading ? (
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <Bot size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <div>No voice agents configured yet.</div>
            <p style={{ fontSize: "13px", marginTop: "4px" }}>Click "New Agent Setup" above to create your first agent.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px" }}>
            {agents.map((ag) => {
              const kbCount = ag.knowledge_files?.length || 0;
              return (
                <div key={ag.id} className="glass-panel" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", color: "var(--text-primary)" }}>{ag.name}</h3>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {ag.purpose_display || ag.purpose}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Link
                        href={`/agents/${ag.id}/edit`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        title="Edit Agent Setup"
                      >
                        <Edit size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(ag.id)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        title="Delete Agent"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Attributes & Settings Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                    <span className="badge badge-success">
                      <Languages size={12} /> {ag.language_display || ag.primary_language}
                    </span>
                    <span className="badge badge-running">
                      <Mic size={12} /> {ag.speaker} ({ag.voice_model})
                    </span>
                    <span className="badge" style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", color: "#475569" }}>
                      <Timer size={12} /> Timeout: {ag.turn_timeout_seconds || 7}s
                    </span>
                    <span className="badge" style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", color: "#475569" }}>
                      <Clock size={12} /> Max: {Math.round((ag.max_conversation_duration_seconds || 600) / 60)}m
                    </span>
                    {kbCount > 0 && (
                      <span className="badge badge-connected" title={`${kbCount} documents attached`}>
                        <BookOpen size={12} /> {kbCount} KB Doc{kbCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* First Spoken Message */}
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "12px", borderRadius: "8px", marginBottom: "14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>
                      First Message (Greeting)
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", fontStyle: "italic", lineHeight: "1.4" }}>
                      "{ag.greeting_message}"
                    </div>
                  </div>

                  {/* System Prompt Snippet */}
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: "1.4" }}>
                    <strong style={{ color: "var(--text-primary)" }}>System Prompt:</strong> {ag.system_instructions.slice(0, 110)}...
                  </div>

                  {/* Quick Voice Audio Test */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Voice: <strong>{ag.speaker}</strong>
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (isPlayingSample && activePlayingSpeaker === ag.speaker) {
                          handleStopVoice();
                        } else {
                          handleTestVoice(ag.speaker);
                        }
                      }}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {isPlayingSample && activePlayingSpeaker === ag.speaker ? (
                        <>
                          <VolumeX size={14} color="var(--accent-rose)" /> Stop Audio
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} color="var(--accent-emerald)" /> Test Voice
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* AGENT SETUP MODAL                                        */}
      {/* ======================================================== */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "700px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ fontSize: "20px" }}>
                  {editingAgent ? "Edit Agent Setup" : "New Agent Setup"}
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Configure voice persona, conversational pacing, opening message, system prompt, and knowledge base.
                </p>
              </div>
              <button
                onClick={() => {
                  handleStopVoice();
                  setModalOpen(false);
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ padding: "12px", background: "var(--accent-rose-bg)", color: "var(--accent-rose)", borderRadius: "8px", marginBottom: "18px", fontSize: "13px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* FIELD 1: AGENT NAME */}
              <div className="form-group">
                <label className="form-label">
                  Agent Name <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya - Enterprise Sales Development"
                  required
                />
              </div>

              {/* FIELD 2 & 3: TURN TIMEOUT & MAX CONVERSATION TIME */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Timer size={14} color="var(--accent-primary)" />
                    Turn Timeout (Seconds)
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="30"
                    className="form-input"
                    value={turnTimeout}
                    onChange={(e) => setTurnTimeout(Number(e.target.value))}
                    required
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Silence wait before agent responds or nudges caller (default 7s).
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Clock size={14} color="var(--accent-primary)" />
                    Max Conversation Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="form-input"
                    value={maxDurationMinutes}
                    onChange={(e) => setMaxDurationMinutes(Number(e.target.value))}
                    required
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Maximum call length to control telephony spend (default 10 min).
                  </span>
                </div>
              </div>

              {/* FIELD 4 & 5: VOICE DROPDOWN & TEST VOICE BUTTON */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Mic size={14} color="var(--accent-emerald)" />
                      Select Voice (Bulbul v4) <span style={{ color: "var(--accent-rose)" }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={speaker}
                      onChange={(e) => {
                        setSpeaker(e.target.value);
                        handleStopVoice();
                      }}
                    >
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.gender} • {v.style})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* VOICE TEST BUTTON */}
                  <div>
                    <button
                      type="button"
                      className={`btn ${isPlayingSample ? "btn-danger" : "btn-secondary"}`}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      onClick={() => {
                        if (isPlayingSample) {
                          handleStopVoice();
                        } else {
                          handleTestVoice();
                        }
                      }}
                    >
                      {isPlayingSample ? (
                        <>
                          <VolumeX size={16} /> Stop Voice Sample
                        </>
                      ) : (
                        <>
                          <Volume2 size={16} color="var(--accent-emerald)" /> Test Voice Sample
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Voice Information & Sample text readout */}
                <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  <div>
                    <strong style={{ color: "var(--text-primary)" }}>Selected Speaker:</strong> {selectedVoiceObj.name} ({selectedVoiceObj.gender}) —{" "}
                    <em>{selectedVoiceObj.style}</em>
                  </div>
                  <div style={{ marginTop: "4px", color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text-primary)" }}>Sample Spoken Phrase:</strong> "
                    {language.toLowerCase().includes("hindi") ? selectedVoiceObj.sample_text_hi : selectedVoiceObj.sample_text_en}
                    "
                  </div>
                  {isPlayingSample && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-emerald)", fontWeight: "600", marginTop: "6px" }}>
                      <span className="live-dot" /> Playing speech preview aloud...
                    </div>
                  )}
                </div>
              </div>

              {/* LANGUAGE & APP ID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Primary Spoken Language</label>
                  <select className="form-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="English">Indian English</option>
                    <option value="Marathi">Marathi (मराठी)</option>
                    <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                    <option value="Bengali">Bengali (বাংলা)</option>
                    <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Sarvam App ID (Canvas identifier)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sarvamAppId}
                    onChange={(e) => setSarvamAppId(e.target.value)}
                    placeholder="e.g. app_agent_priya_sales"
                    required
                  />
                </div>
              </div>

              {/* FIELD 6: FIRST MESSAGE */}
              <div className="form-group">
                <label className="form-label">
                  First Message (Spoken Greeting) <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="The first opening sentence spoken when recipient answers the phone..."
                  required
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  Opening spoken turn. Keep it polite, clear, and relevant to the call purpose.
                </span>
              </div>

              {/* FIELD 7: SYSTEM PROMPT */}
              <div className="form-group">
                <label className="form-label">
                  System Prompt (What you want your agent to do) <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Define persona, conversation flow, questions to ask, objection handling, and escalation rules..."
                  required
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  Instructions guide the agent's reasoning, tone, questions to ask, and callback requests.
                </span>
              </div>

              {/* FIELD 8: KNOWLEDGE BASE CONNECTION FOR LEARNING */}
              <div style={{ padding: "16px", borderRadius: "12px", background: "#EEF2FF", border: "1px solid #C7D2FE", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <BookOpen size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E1B4B" }}>
                      Knowledge Base for Agent Learning
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#4F46E5", fontWeight: "600" }}>
                    {selectedKbIds.length} Document{selectedKbIds.length === 1 ? "" : "s"} Connected
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "#3730A3", marginBottom: "12px" }}>
                  Select uploaded business documents (PDFs, rate sheets, FAQs) so the agent learns your product details and answers caller questions accurately.
                </p>

                {knowledgeFiles.length === 0 ? (
                  <div style={{ padding: "12px", background: "#FFFFFF", border: "1px solid #C7D2FE", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                    No documents uploaded in Knowledge Base yet. Go to{" "}
                    <a href="/knowledge-base" style={{ color: "var(--accent-primary)", textDecoration: "underline", fontWeight: "600" }}>
                      Knowledge Base
                    </a>{" "}
                    to upload PDFs, TXT, or CSV files.
                  </div>
                ) : (
                  <div style={{ maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {knowledgeFiles.map((kb) => {
                      const isChecked = selectedKbIds.includes(kb.id);
                      return (
                        <div
                          key={kb.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedKbIds(selectedKbIds.filter((id) => id !== kb.id));
                            } else {
                              setSelectedKbIds([...selectedKbIds, kb.id]);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            background: isChecked ? "#E0E7FF" : "#FFFFFF",
                            border: isChecked ? "1px solid #6366F1" : "1px solid #CBD5E1",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div click
                            style={{ accentColor: "var(--accent-primary)" }}
                          />
                          {kb.category === "site" ? (
                            <Globe size={14} color="#059669" />
                          ) : kb.category === "text" ? (
                            <FileEdit size={14} color="#BE185D" />
                          ) : (
                            <FileText size={14} color="var(--accent-primary)" />
                          )}
                          <div style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: "#0F172A" }}>
                            {kb.name}
                            {kb.source_url && (
                              <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px" }}>
                                ({kb.source_url.slice(0, 30)}...)
                              </span>
                            )}
                          </div>
                          <span
                            className="badge"
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              background:
                                kb.category === "site"
                                  ? "#F0FDF4"
                                  : kb.category === "text"
                                  ? "#FDF2F8"
                                  : "#EEF2FF",
                              color:
                                kb.category === "site"
                                  ? "#047857"
                                  : kb.category === "text"
                                  ? "#BE185D"
                                  : "#4338CA",
                            }}
                          >
                            {kb.category === "site" ? "🌐 Website" : kb.category === "text" ? "📝 Text Note" : "📄 Document"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleStopVoice();
                    setModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAgent ? "Update Agent Setup" : "Save & Activate Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
