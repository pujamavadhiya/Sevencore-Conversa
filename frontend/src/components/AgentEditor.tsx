"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  ArrowLeft,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Upload,
  BookOpen,
  Languages,
  Mic,
  Sliders,
  CheckCircle2,
  Radio,
  Clock,
  PhoneForwarded,
  Voicemail,
  ShieldCheck,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent, AgentLanguageVoiceOverride, AgentNudgeMessage, AgentConfig } from "@/types";

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

const DEFAULT_VOICES: VoiceOption[] = [
  {
    id: "shubh",
    name: "Shubh",
    gender: "Male",
    style: "Conversational & Natural",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English", "Gujarati", "Marathi"],
    sample_text_hi: "नमस्ते! मैं शुभ बोल रहा हूँ। आपके साथ बात करके खुशी हुई।",
    sample_text_en: "Hello! This is Shubh. It is a pleasure to connect with you today.",
  },
  {
    id: "ishita",
    name: "Ishita - Expressive Support",
    gender: "Female",
    style: "Expressive & Friendly",
    model: "Bulbul v4",
    languages: ["Gujarati", "Hindi", "Indian English"],
    sample_text_hi: "नमस्ते, मैं इशिता हूँ। क्या मैं आपकी सहायता कर सकती हूँ?",
    sample_text_en: "Hi, I am Ishita from Expressive Support. How can I help you today?",
  },
  {
    id: "meera",
    name: "Meera",
    gender: "Female",
    style: "Warm & Professional",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English", "Marathi"],
    sample_text_hi: "नमस्ते! मैं मीरा बोल रही हूँ। आज मैं आपकी क्या सहायता कर सकती हूँ?",
    sample_text_en: "Hello! I am Meera. How can I assist you with your business today?",
  },
  {
    id: "pavithra",
    name: "Pavithra",
    gender: "Female",
    style: "Empathetic & Courteous",
    model: "Bulbul v4",
    languages: ["Hindi", "Tamil", "Telugu"],
    sample_text_hi: "नमस्ते, मैं पवित्रा हूँ। क्या मेरी बात अपॉइंटमेंट होल्डर से हो रही है?",
    sample_text_en: "Hello, this is Pavithra calling to confirm your upcoming appointment.",
  },
  {
    id: "arvind",
    name: "Arvind",
    gender: "Male",
    style: "Calm & Confident",
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
    sample_text_hi: "नमस्ते! मैं अमर्त्य हूँ। क्या आप नए ऑटोमेशन फीचर्स के बारे में जानना चाहते हैं?",
    sample_text_en: "Hi there! I am Amartya. Would you like to hear about our new voice automation capabilities?",
  },
  {
    id: "ananya",
    name: "Ananya",
    gender: "Female",
    style: "Support Specialist",
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
  {
    id: "dhruv",
    name: "Dhruv",
    gender: "Male",
    style: "Confident & Articulate",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English"],
    sample_text_hi: "नमस्ते, मैं ध्रुव बोल रहा हूँ। क्या मैं आपकी कोई सहायता कर सकता हूँ?",
    sample_text_en: "Hello, this is Dhruv. How can I assist you with your queries today?",
  },
  {
    id: "kavya",
    name: "Kavya",
    gender: "Female",
    style: "Friendly & Dynamic",
    model: "Bulbul v4",
    languages: ["Hindi", "Marathi", "Indian English"],
    sample_text_hi: "नमस्ते, मैं काव्या बोल रही हूँ। आपका दिन शुभ हो।",
    sample_text_en: "Hello! This is Kavya. Have a wonderful day ahead.",
  },
  {
    id: "rohit",
    name: "Rohit",
    gender: "Male",
    style: "Crisp & Professional",
    model: "Bulbul v4",
    languages: ["Hindi", "Punjabi", "Indian English"],
    sample_text_hi: "नमस्कार! मैं रोहित हूँ। आपके व्यवसाय के लिए हम तत्पर हैं।",
    sample_text_en: "Greetings! I am Rohit, here to assist with your business calls.",
  },
  {
    id: "sneha",
    name: "Sneha",
    gender: "Female",
    style: "Calm & Courteous",
    model: "Bulbul v4",
    languages: ["Hindi", "Kannada", "Telugu"],
    sample_text_hi: "नमस्ते, मैं स्नेहा बोल रही हूँ। क्या मेरी बात ग्राहक महोदय से हो रही है?",
    sample_text_en: "Hello, this is Sneha speaking. May I speak with the account holder?",
  },
  {
    id: "priya",
    name: "Priya",
    gender: "Female",
    style: "Polite Sales Specialist",
    model: "Bulbul v4",
    languages: ["Hindi", "Indian English"],
    sample_text_hi: "नमस्ते! मैं प्रिया बोल रही हूँ। क्या आपके पास बात करने के लिए दो मिनट का समय है?",
    sample_text_en: "Hello! I am Priya calling. Do you have a couple of minutes to talk?",
  },
];

const INDIC_LANGUAGES = [
  { code: "Hindi", name: "Hindi", script: "अ", label: "Hindi (हिन्दी)" },
  { code: "English", name: "English", script: "En", label: "Indian English" },
  { code: "Gujarati", name: "Gujarati", script: "અ", label: "Gujarati (ગુજરાતી)" },
  { code: "Bengali", name: "Bengali", script: "বা", label: "Bengali (বাংলা)" },
  { code: "Marathi", name: "Marathi", script: "म", label: "Marathi (मराठी)" },
  { code: "Tamil", name: "Tamil", script: "த", label: "Tamil (தமிழ்)" },
  { code: "Telugu", name: "Telugu", script: "తె", label: "Telugu (తెలుగు)" },
  { code: "Kannada", name: "Kannada", script: "ಕ", label: "Kannada (ಕನ್ನಡ)" },
  { code: "Malayalam", name: "Malayalam", script: "മ", label: "Malayalam (മലയാളം)" },
  { code: "Punjabi", name: "Punjabi", script: "ਪ", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "Odia", name: "Odia", script: "ଓ", label: "Odia (ଓଡ଼ିଆ)" },
];

interface AgentEditorProps {
  mode: "create" | "edit";
  agentId?: number;
}

export default function AgentEditor({ mode, agentId }: AgentEditorProps) {
  const router = useRouter();

  // Loading & Error States
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Voice Catalog & Knowledge Bases
  const [voiceCatalog, setVoiceCatalog] = useState<VoiceOption[]>(DEFAULT_VOICES);
  const [knowledgeFiles, setKnowledgeFiles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Active Section Tab
  const [activeTab, setActiveTab] = useState<
    "speaking" | "thinking" | "listening" | "environment" | "language" | "actions" | "persona"
  >("speaking");

  // Basic Information
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("sales_qualification");
  const [sarvamAppId, setSarvamAppId] = useState("");
  const [sarvamAppVersion, setSarvamAppVersion] = useState(1);
  const [greetingMessage, setGreetingMessage] = useState(
    "नमस्ते! मैं सेवनकोर कॉन्वर्सा से बात कर रहा हूँ। क्या अभी दो मिनट बात करने का सही समय है?"
  );
  const [systemInstructions, setSystemInstructions] = useState(
    "You are an AI voice agent for our business.\n" +
      "1. Speak courteously and listen carefully without interrupting.\n" +
      "2. Answer customer queries based on the attached knowledge base documents.\n" +
      "3. If caller expresses interest, ask to schedule a follow-up consultation."
  );

  // Speaking Configuration
  const [defaultVoice, setDefaultVoice] = useState("shubh");
  const [perLanguageVoices, setPerLanguageVoices] = useState<AgentLanguageVoiceOverride[]>([
    { language: "Hindi", voice: "shubh" },
    { language: "Gujarati", voice: "ishita" },
  ]);
  const [speakingSpeed, setSpeakingSpeed] = useState(1.15);
  const [pitch, setPitch] = useState(0.0);
  const [volume, setVolume] = useState(1.0);
  const [pronunciationDictionary, setPronunciationDictionary] = useState("");

  // Thinking & Knowledge
  const [modelTemperature, setModelTemperature] = useState<"Conservative" | "Balanced" | "Creative">("Balanced");
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);

  // Listening Configuration
  const [interruptible, setInterruptible] = useState(true);
  const [eagerness, setEagerness] = useState<"Patient" | "Balanced" | "Fast" | "Immediate">("Balanced");
  const [volumeThreshold, setVolumeThreshold] = useState<"Low" | "Normal" | "High">("Normal");

  // Environment Configuration
  const [backgroundSound, setBackgroundSound] = useState<"None" | "Quiet office" | "Call center" | "Café">("Quiet office");
  const [backgroundVolume, setBackgroundVolume] = useState(0.15);

  // Language Personalisation
  const [switchLanguageDuringCall, setSwitchLanguageDuringCall] = useState(true);
  const [languagesAllowed, setLanguagesAllowed] = useState<string[]>([
    "Hindi",
    "English",
    "Gujarati",
    "Bengali",
    "Marathi",
  ]);
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [switchAfter, setSwitchAfter] = useState<"Quick" | "Normal" | "Cautious">("Quick");
  const [startingLanguage, setStartingLanguage] = useState("Hindi");
  const [outputNumbersInIndic, setOutputNumbersInIndic] = useState(true);

  // In Call Actions
  const [nudgeQuietCallers, setNudgeQuietCallers] = useState(true);
  const [nudges, setNudges] = useState<AgentNudgeMessage[]>([
    { message: "Hey, are you still on the call?", after_seconds: 5 },
  ]);
  const [hangupAfterUnansweredNudges, setHangupAfterUnansweredNudges] = useState(true);
  const [voicemailDetection, setVoicemailDetection] = useState(true);
  const [voicemailMessage, setVoicemailMessage] = useState(
    "Hey, seems like I have reached your voicemail. I shall call you back at a later time."
  );
  const [callForwarding, setCallForwarding] = useState(false);
  const [forwardingNumber, setForwardingNumber] = useState("");
  const [maxCallLengthMinutes, setMaxCallLengthMinutes] = useState(15);

  // Load initial data
  useEffect(() => {
    loadMetadata();
    if (mode === "edit" && agentId) {
      loadAgentData(agentId);
    } else {
      setSarvamAppId(`app_agent_${Date.now().toString().slice(-4)}`);
    }
  }, [mode, agentId]);

  const loadMetadata = async () => {
    try {
      const [voicesData, kbData, tplsData] = await Promise.allSettled([
        api.getVoices(),
        api.getKnowledgeFiles(),
        api.getAgentTemplates(),
      ]);

      if (voicesData.status === "fulfilled" && Array.isArray(voicesData.value) && voicesData.value.length > 0) {
        // Merge default voices with any server returned voices
        const existingIds = new Set(voicesData.value.map((v: any) => v.id.toLowerCase()));
        const merged = [
          ...voicesData.value,
          ...DEFAULT_VOICES.filter((v) => !existingIds.has(v.id.toLowerCase())),
        ];
        setVoiceCatalog(merged);
      }
      if (kbData.status === "fulfilled" && Array.isArray(kbData.value)) {
        setKnowledgeFiles(kbData.value);
      }
      if (tplsData.status === "fulfilled" && Array.isArray(tplsData.value)) {
        setTemplates(tplsData.value);
      }
    } catch (err) {
      console.error("Error loading agent metadata:", err);
    }
  };

  const loadAgentData = async (id: number) => {
    try {
      setLoading(true);
      const agent: VoiceAgent = await api.getAgent(id);
      setName(agent.name || "");
      setPurpose(agent.purpose || "sales_qualification");
      setSarvamAppId(agent.sarvam_app_id || "");
      setSarvamAppVersion(agent.sarvam_app_version || 1);
      setGreetingMessage(agent.greeting_message || "");
      setSystemInstructions(agent.system_instructions || "");
      setDefaultVoice(agent.speaker || "shubh");
      setStartingLanguage(agent.primary_language || "Hindi");
      setMaxCallLengthMinutes(Math.round((agent.max_conversation_duration_seconds || 900) / 60));

      const attachedKbIds = agent.knowledge_files?.map((f: any) => f.id) || [];
      setSelectedKbIds(attachedKbIds);

      // Populate config if present
      const cfg = agent.config || {};
      if (cfg.speaking_speed !== undefined) setSpeakingSpeed(cfg.speaking_speed);
      if (cfg.pitch !== undefined) setPitch(cfg.pitch);
      if (cfg.volume !== undefined) setVolume(cfg.volume);
      if (cfg.pronunciation_dictionary) setPronunciationDictionary(cfg.pronunciation_dictionary);
      if (cfg.model_temperature) setModelTemperature(cfg.model_temperature);
      if (cfg.interruptible !== undefined) setInterruptible(cfg.interruptible);
      if (cfg.eagerness) setEagerness(cfg.eagerness);
      if (cfg.volume_threshold) setVolumeThreshold(cfg.volume_threshold);
      if (cfg.background_sound) setBackgroundSound(cfg.background_sound);
      if (cfg.background_volume !== undefined) setBackgroundVolume(cfg.background_volume);
      if (cfg.switch_language_during_call !== undefined) setSwitchLanguageDuringCall(cfg.switch_language_during_call);
      if (cfg.languages_allowed && Array.isArray(cfg.languages_allowed)) setLanguagesAllowed(cfg.languages_allowed);
      if (cfg.auto_detect_language !== undefined) setAutoDetectLanguage(cfg.auto_detect_language);
      if (cfg.switch_after) setSwitchAfter(cfg.switch_after);
      if (cfg.output_numbers_in_indic !== undefined) setOutputNumbersInIndic(cfg.output_numbers_in_indic);
      if (cfg.nudge_quiet_callers !== undefined) setNudgeQuietCallers(cfg.nudge_quiet_callers);
      if (cfg.nudges && Array.isArray(cfg.nudges)) setNudges(cfg.nudges);
      if (cfg.hangup_after_unanswered_nudges !== undefined) setHangupAfterUnansweredNudges(cfg.hangup_after_unanswered_nudges);
      if (cfg.voicemail_detection !== undefined) setVoicemailDetection(cfg.voicemail_detection);
      if (cfg.voicemail_message) setVoicemailMessage(cfg.voicemail_message);
      if (cfg.call_forwarding !== undefined) setCallForwarding(cfg.call_forwarding);
      if (cfg.forwarding_number) setForwardingNumber(cfg.forwarding_number);
      if (cfg.per_language_voices && Array.isArray(cfg.per_language_voices)) setPerLanguageVoices(cfg.per_language_voices);
    } catch (err: any) {
      setError(err.message || "Failed to load agent");
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (tpl: any) => {
    setName(tpl.name || "");
    setPurpose(tpl.purpose || "sales_qualification");
    setStartingLanguage(tpl.primary_language || "Hindi");
    setDefaultVoice(tpl.speaker || "shubh");
    setGreetingMessage(tpl.greeting_message || "");
    setSystemInstructions(tpl.system_instructions || "");
    if (tpl.turn_timeout_seconds) {
      setNudges([{ message: "Hey, are you still on the call?", after_seconds: tpl.turn_timeout_seconds }]);
    }
    if (tpl.max_conversation_duration_seconds) {
      setMaxCallLengthMinutes(Math.round(tpl.max_conversation_duration_seconds / 60));
    }
  };

  const handlePlayVoicePreview = (v: VoiceOption, overrideLang?: string) => {
    if (playingVoiceId === v.id) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const langToCheck = overrideLang || startingLanguage;
      const textToSpeak =
        langToCheck === "English"
          ? (v.sample_text_en || "Hello! This is a test sample of this voice.")
          : (v.sample_text_hi || "नमस्ते! यह इस आवाज़ का टेस्ट सैंपल है।");
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = speakingSpeed;
      utterance.pitch = pitch + 1.0;
      utterance.volume = volume;
      utterance.onend = () => setPlayingVoiceId(null);
      utterance.onerror = () => setPlayingVoiceId(null);
      window.speechSynthesis.speak(utterance);
      setPlayingVoiceId(v.id);
    } else {
      alert(`Voice sample for ${v.name}: ${v.sample_text_hi}`);
    }
  };

  const handlePlayVoiceById = (voiceId: string, langCode?: string) => {
    const v =
      voiceCatalog.find((vc) => vc.id.toLowerCase() === voiceId.toLowerCase()) || {
        id: voiceId,
        name: voiceId,
        gender: "Voice",
        style: "Standard",
        model: "Bulbul v4",
        languages: ["Hindi", "English"],
        sample_text_hi: "नमस्ते! यह इस आवाज़ का एक नमूना है।",
        sample_text_en: "Hello! This is a preview sample of this voice.",
      };
    handlePlayVoicePreview(v, langCode);
  };

  const handleAddLanguageVoiceOverride = () => {
    setPerLanguageVoices((prev) => [
      ...prev,
      { language: "Bengali", voice: defaultVoice || "shubh" },
    ]);
  };

  const handleRemoveLanguageVoiceOverride = (index: number) => {
    setPerLanguageVoices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLanguageVoiceOverride = (
    index: number,
    field: "language" | "voice",
    value: string
  ) => {
    setPerLanguageVoices((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddNudge = () => {
    setNudges((prev) => [
      ...prev,
      {
        message: "Are you still with me? Feel free to ask any question.",
        after_seconds: (prev[prev.length - 1]?.after_seconds || 5) + 5,
      },
    ]);
  };

  const handleRemoveNudge = (index: number) => {
    setNudges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateNudge = (
    index: number,
    field: "message" | "after_seconds",
    value: any
  ) => {
    setNudges((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: field === "after_seconds" ? Number(value) : value } : item
      )
    );
  };

  const handleToggleAllowedLanguage = (langCode: string) => {
    setLanguagesAllowed((prev) =>
      prev.includes(langCode) ? prev.filter((l) => l !== langCode) : [...prev, langCode]
    );
  };

  const handleToggleKb = (kbId: number) => {
    setSelectedKbIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError("Please provide a name for this Voice Agent.");
      setActiveTab("persona");
      return;
    }

    const config: AgentConfig = {
      speaking_speed: Number(speakingSpeed),
      pitch: Number(pitch),
      volume: Number(volume),
      pronunciation_dictionary: pronunciationDictionary,
      model_temperature: modelTemperature,
      knowledge_base_ids: selectedKbIds,
      interruptible,
      eagerness,
      volume_threshold: volumeThreshold,
      background_sound: backgroundSound,
      background_volume: Number(backgroundVolume),
      switch_language_during_call: switchLanguageDuringCall,
      languages_allowed: languagesAllowed,
      auto_detect_language: autoDetectLanguage,
      switch_after: switchAfter,
      starting_language: startingLanguage,
      output_numbers_in_indic: outputNumbersInIndic,
      nudge_quiet_callers: nudgeQuietCallers,
      nudges,
      hangup_after_unanswered_nudges: hangupAfterUnansweredNudges,
      voicemail_detection: voicemailDetection,
      voicemail_message: voicemailMessage,
      call_forwarding: callForwarding,
      forwarding_number: forwardingNumber,
      max_call_length_minutes: Number(maxCallLengthMinutes),
      per_language_voices: perLanguageVoices,
    };

    const payload = {
      name: name.trim(),
      purpose,
      primary_language: startingLanguage,
      speaker: defaultVoice,
      sarvam_app_id: sarvamAppId || `app_agent_${Date.now().toString().slice(-4)}`,
      sarvam_app_version: Number(sarvamAppVersion) || 1,
      turn_timeout_seconds: nudges[0]?.after_seconds || 7,
      max_conversation_duration_seconds: Number(maxCallLengthMinutes) * 60,
      greeting_message: greetingMessage,
      system_instructions: systemInstructions,
      knowledge_file_ids: selectedKbIds,
      config,
    };

    try {
      setSaving(true);
      if (mode === "edit" && agentId) {
        await api.updateAgent(agentId, payload);
        setSuccessMsg("Voice Agent settings successfully updated!");
      } else {
        const created = await api.createAgent(payload);
        setSuccessMsg("Voice Agent successfully created!");
        setTimeout(() => {
          router.push("/agents");
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save Voice Agent configuration.");
    } finally {
      setSaving(false);
    }
  };

  const getLanguageScript = (langCode: string) => {
    const found = INDIC_LANGUAGES.find((l) => l.code === langCode);
    return found?.script || "अ";
  };

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
        <RefreshCw size={28} className="spin" style={{ margin: "0 auto 16px" }} />
        <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text-primary)" }}>Loading Voice Agent Details...</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", paddingBottom: "80px" }}>
      {/* Top Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/agents"
            className="btn btn-secondary"
            style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={16} /> Back to Agents
          </Link>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              {mode === "create" ? "New Voice Agent Setup" : "Edit Agent Configuration"}
            </div>
            <h1 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" }}>
              {name || (mode === "create" ? "Configure New Agent" : "Voice Agent Settings")}
            </h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: "10px 24px", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}
          >
            {saving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
            {mode === "create" ? "Create & Deploy Agent" : "Save Agent Changes"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: "14px 18px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "8px", color: "#991B1B", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ padding: "14px 18px", background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: "8px", color: "#065F46", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>{successMsg}</span>
        </div>
      )}

      {/* Fast Presets / Templates Banner */}
      {templates.length > 0 && mode === "create" && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: "24px", background: "linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 100%)", border: "1px solid #C7D2FE" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={16} color="#4F46E5" />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E1B4B" }}>Quick Start Templates</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Click to pre-fill persona & settings</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "12px", padding: "6px 12px", background: "#FFFFFF" }}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* =========================================================================
            PERSISTENT AGENT PROFILE & IDENTITY (Always visible above section tabs)
            ========================================================================= */}
        <div
          className="card"
          style={{
            padding: "20px 24px",
            marginBottom: "20px",
            background: "#FFFFFF",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bot size={18} color="#4F46E5" />
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                Agent Profile & Identity
              </h3>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Core identity configured across all call channels
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Agent Name <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Priya - Inbound & Outbound Sales"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: "14px", fontWeight: 600 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Business Purpose
              </label>
              <select
                className="form-control"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                style={{ fontSize: "13px" }}
              >
                <option value="sales_qualification">Sales Qualification</option>
                <option value="appointment_confirmation">Appointment Confirmation</option>
                <option value="customer_support">Customer Support & FAQs</option>
                <option value="emi_collection">EMI & Payment Follow-up</option>
                <option value="lead_followup">Lead Re-engagement</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Sarvam App ID (PIN)
              </label>
              <input
                type="text"
                className="form-control"
                value={sarvamAppId}
                onChange={(e) => setSarvamAppId(e.target.value)}
                placeholder="app_agent_v1"
                style={{ fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                Agent Version
              </label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={sarvamAppVersion}
                onChange={(e) => setSarvamAppVersion(parseInt(e.target.value) || 1)}
                style={{ fontSize: "13px", fontFamily: "monospace" }}
              />
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "8px",
            marginBottom: "24px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "speaking", label: "Speaking", icon: Volume2 },
            { id: "thinking", label: "Thinking & Knowledge", icon: BookOpen },
            { id: "listening", label: "Listening", icon: Mic },
            { id: "environment", label: "Environment", icon: Sliders },
            { id: "language", label: "Language Personalisation", icon: Languages },
            { id: "actions", label: "In Call Actions", icon: PhoneForwarded },
            { id: "persona", label: "Greeting & Instructions", icon: Bot },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  whiteSpace: "nowrap",
                  borderBottom: isActive ? "2px solid #4F46E5" : "none",
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
        {/* =========================================================================
            SECTION: SPEAKING
            ========================================================================= */}
        {activeTab === "speaking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Default Voice */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>Voice</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  Who your agent sounds like by default
                </p>
              </div>

              {/* Dropdown with all Sarvam voices & Try Voice button */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", maxWidth: "680px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <select
                    className="form-control"
                    value={defaultVoice}
                    onChange={(e) => {
                      if (typeof window !== "undefined" && "speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                      }
                      setPlayingVoiceId(null);
                      setDefaultVoice(e.target.value);
                    }}
                    style={{ fontSize: "14px", fontWeight: 600, padding: "10px 14px", width: "100%" }}
                  >
                    {voiceCatalog.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.gender} ({v.style}, {v.model})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const found = voiceCatalog.find((vc) => vc.id.toLowerCase() === defaultVoice.toLowerCase());
                    if (found) handlePlayVoicePreview(found);
                  }}
                  className={`btn ${playingVoiceId === defaultVoice ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", whiteSpace: "nowrap" }}
                >
                  {playingVoiceId === defaultVoice ? (
                    <>
                      <Pause size={15} /> Pause Sample
                    </>
                  ) : (
                    <>
                      <Play size={15} /> Try Now
                    </>
                  )}
                </button>
              </div>

              {/* Selected Voice Details Preview Card */}
              {(() => {
                const selectedVoiceObj = voiceCatalog.find(
                  (vc) => vc.id.toLowerCase() === defaultVoice.toLowerCase()
                ) || voiceCatalog[0];
                if (!selectedVoiceObj) return null;
                return (
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "#F8FAFC",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                      maxWidth: "680px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {selectedVoiceObj.name}
                        </span>
                        <span className="badge badge-running" style={{ fontSize: "11px" }}>
                          {selectedVoiceObj.model}
                        </span>
                        <span className="badge" style={{ background: "#E2E8F0", color: "#475569", fontSize: "11px" }}>
                          {selectedVoiceObj.gender}
                        </span>
                        <span className="badge badge-connected" style={{ fontSize: "11px" }}>
                          {selectedVoiceObj.style}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                        Native Languages: <strong>{selectedVoiceObj.languages.join(", ")}</strong>
                      </div>
                      <div style={{ fontSize: "12px", fontStyle: "italic", color: "var(--text-secondary)" }}>
                        "{startingLanguage === "English" ? selectedVoiceObj.sample_text_en : selectedVoiceObj.sample_text_hi}"
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Per-language voices overrides */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Per-language voices
                  </h3>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#4F46E5", marginBottom: "4px" }}>
                    Overrides default voice · Use different voices for each language
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                    Voice is assigned per language at call start and will not change mid-conversation. Add as many language-to-voice mappings as you want.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddLanguageVoiceOverride}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={14} /> Add Language Voice
                </button>
              </div>

              {perLanguageVoices.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: "13px" }}>
                  No language overrides set. The agent will use the default voice ({defaultVoice}) across all languages.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {perLanguageVoices.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px, 1fr) minmax(260px, 1.4fr) auto auto",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        background: "#F8FAFC",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {/* Language Selection */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>If call starts in</span>
                        <div
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: "#E0E7FF",
                            color: "#4338CA",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            flexShrink: 0,
                          }}
                        >
                          {getLanguageScript(item.language)}
                        </div>
                        <select
                          className="form-control"
                          value={item.language}
                          onChange={(e) => handleUpdateLanguageVoiceOverride(idx, "language", e.target.value)}
                          style={{ padding: "7px 10px", fontSize: "13px", fontWeight: 600, flex: 1 }}
                        >
                          {INDIC_LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Voice Selection */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>then use</span>
                        <select
                          className="form-control"
                          value={item.voice}
                          onChange={(e) => {
                            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                              window.speechSynthesis.cancel();
                            }
                            setPlayingVoiceId(null);
                            handleUpdateLanguageVoiceOverride(idx, "voice", e.target.value);
                          }}
                          style={{ padding: "7px 10px", fontSize: "13px", fontWeight: 600, flex: 1 }}
                        >
                          {voiceCatalog.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.gender} - {v.style})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Try Voice Button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handlePlayVoiceById(item.voice, item.language)}
                          className={`btn btn-sm ${playingVoiceId === item.voice ? "btn-primary" : "btn-secondary"}`}
                          style={{ padding: "7px 12px", display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
                          title="Try this voice in this language"
                        >
                          {playingVoiceId === item.voice ? <Pause size={13} /> : <Play size={13} />}
                          <span>Try Now</span>
                        </button>
                      </div>

                      {/* Delete Button (Separate cell, never overlaps) */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLanguageVoiceOverride(idx)}
                          style={{
                            background: "#FEE2E2",
                            border: "1px solid #FECACA",
                            color: "#DC2626",
                            cursor: "pointer",
                            padding: "7px 10px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "background 0.15s ease",
                          }}
                          title="Remove language override"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Speaking Speed, Pitch & Volume */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px" }}>
                {/* Speaking Speed */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Speaking speed
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                        How fast the agent talks
                      </p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#4F46E5", fontFamily: "monospace" }}>
                      {Number(speakingSpeed).toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speakingSpeed}
                    onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#4F46E5", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>0.5x (Slow)</span>
                    <span>1.0x</span>
                    <span>1.15x (Recommended)</span>
                    <span>2.0x (Fast)</span>
                  </div>
                </div>

                {/* Pitch */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Pitch
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                        Higher or lower tone of voice
                      </p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#4F46E5", fontFamily: "monospace" }}>
                      {Number(pitch).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.05"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#4F46E5", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>-1.0 (Deeper)</span>
                    <span>0.00 (Default)</span>
                    <span>+1.0 (Higher)</span>
                  </div>
                </div>

                {/* Volume */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        Volume
                      </h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                        How loud the agent speaks
                      </p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#4F46E5", fontFamily: "monospace" }}>
                      {Number(volume).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#4F46E5", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    <span>0.2 (Soft)</span>
                    <span>1.0 (Standard)</span>
                    <span>2.0 (Loud)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pronunciation dictionary */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Pronunciation dictionary
                    </h4>
                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "#E2E8F0", color: "#475569", fontWeight: 700 }}>
                      ADVANCED
                    </span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Upload or specify phonetic replacements so names and brands are spoken the way you want
                  </p>
                </div>
              </div>

              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Sarvam=Sar-vum, Conversa=Con-ver-sa, Bajaj=Ba-jaaj"
                value={pronunciationDictionary}
                onChange={(e) => setPronunciationDictionary(e.target.value)}
                style={{
                  fontSize: "13px",
                  fontFamily: "monospace",
                  minHeight: "80px",
                  lineHeight: "1.5",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  width: "100%",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Enter key=value phonetic rules separated by commas or newlines.
                </span>
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Upload size={12} /> Upload dictionary (.txt / .json)
                  <input
                    type="file"
                    accept=".txt,.json,.csv"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                          setPronunciationDictionary(String(re.target?.result || ""));
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: THINKING & KNOWLEDGE
            ========================================================================= */}
        {activeTab === "thinking" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Model Temperature */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                  Model temperature
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  Lower stays compliant and consistent; higher is more creative
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", maxWidth: "600px" }}>
                {[
                  { id: "Conservative", title: "Conservative", desc: "Strict adherence to facts & scripts" },
                  { id: "Balanced", title: "Balanced", desc: "Recommended for natural business conversations" },
                  { id: "Creative", title: "Creative", desc: "Varied phrasing & dynamic improvisation" },
                ].map((item) => {
                  const isSel = modelTemperature === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setModelTemperature(item.id as any)}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: isSel ? "2px solid #4F46E5" : "1px solid var(--border-subtle)",
                        background: isSel ? "#F5F3FF" : "#FFFFFF",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Knowledge base */}
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Knowledge base
                  </h3>
                  <div style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: "4px", marginBottom: "4px" }}>
                    OPTIONAL · NOT COMPULSORY
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                    Select an existing knowledge base for factual query grounding, or skip this now and link/create documents later from the Knowledge Base manager.
                  </p>
                </div>
                <Link href="/knowledge-base" target="_blank" className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={14} /> Knowledge Base Manager
                </Link>
              </div>

              {/* Single Dropdown Menu for selecting existing Knowledge Base */}
              <div style={{ maxWidth: "600px", marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                  Select Existing Knowledge Base Document
                </label>
                <select
                  className="form-control"
                  value={selectedKbIds[0] || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedKbIds(val ? [Number(val)] : []);
                  }}
                  style={{ width: "100%", padding: "10px 14px", fontSize: "14px", fontWeight: 500 }}
                >
                  <option value="">-- None (Assign Later / Optional) --</option>
                  {knowledgeFiles.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name} ({kb.file_type?.toUpperCase()} · {kb.status})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                  You can first create the agent, then create your knowledge base and assign the agent from the Knowledge Base screen.
                </div>
              </div>

              {selectedKbIds.length > 0 && (() => {
                const selectedKb = knowledgeFiles.find((k) => k.id === selectedKbIds[0]);
                if (!selectedKb) return null;
                return (
                  <div
                    style={{
                      maxWidth: "600px",
                      padding: "14px 18px",
                      background: "#F0FDF4",
                      border: "1px solid #BBF7D0",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <BookOpen size={18} color="#059669" />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                          {selectedKb.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#15803D" }}>
                          Type: {selectedKb.file_type?.toUpperCase()} · Status: {selectedKb.status}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedKbIds([])}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "11px" }}
                    >
                      Clear Selection
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: LISTENING
            ========================================================================= */}
        {activeTab === "listening" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card" style={{ padding: "24px" }}>
              {/* Let callers interrupt */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Let callers interrupt
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Caller can talk over the agent while it’s speaking
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={interruptible}
                    onChange={(e) => setInterruptible(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Eagerness to respond */}
              <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Eagerness to respond
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    How quickly the agent replies after a pause. Lower waits less.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", maxWidth: "600px" }}>
                  {[
                    { id: "Patient", label: "Patient (1.2s)" },
                    { id: "Balanced", label: "Balanced (0.8s)" },
                    { id: "Fast", label: "Fast (0.5s)" },
                    { id: "Immediate", label: "Immediate (0.3s)" },
                  ].map((item) => {
                    const isSel = eagerness === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEagerness(item.id as any)}
                        className={`btn ${isSel ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: "12px", padding: "8px 10px" }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Volume threshold */}
              <div style={{ paddingTop: "20px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Volume threshold
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Quieter audio below this level counts as silence. Lower includes more noise.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", maxWidth: "450px" }}>
                  {[
                    { id: "Low", label: "Low (Sensitive)" },
                    { id: "Normal", label: "Normal (Recommended)" },
                    { id: "High", label: "High (Noisy Ambient)" },
                  ].map((item) => {
                    const isSel = volumeThreshold === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVolumeThreshold(item.id as any)}
                        className={`btn ${isSel ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: "12px", padding: "8px 10px" }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: ENVIRONMENT
            ========================================================================= */}
        {activeTab === "environment" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card" style={{ padding: "24px" }}>
              {/* Background sound */}
              <div style={{ paddingBottom: "24px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ marginBottom: "14px" }}>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Background sound
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                    Ambient noise behind the agent to create natural acoustic presence
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", maxWidth: "640px" }}>
                  {[
                    { id: "None", label: "None", desc: "Pure digital studio silence" },
                    { id: "Quiet office", label: "Quiet office", desc: "Subtle professional hum" },
                    { id: "Call center", label: "Call center", desc: "Gentle background chatter" },
                    { id: "Café", label: "Café", desc: "Warm ambient buzz" },
                  ].map((item) => {
                    const isSel = backgroundSound === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setBackgroundSound(item.id as any)}
                        style={{
                          padding: "14px",
                          borderRadius: "8px",
                          border: isSel ? "2px solid #4F46E5" : "1px solid var(--border-subtle)",
                          background: isSel ? "#F5F3FF" : "#FFFFFF",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Background volume */}
              <div style={{ paddingTop: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Background volume
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                      How loud the ambient noise plays
                    </p>
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "#4F46E5", fontFamily: "monospace" }}>
                    {Math.round(backgroundVolume * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={backgroundVolume}
                  onChange={(e) => setBackgroundVolume(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#4F46E5", cursor: "pointer" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: LANGUAGE PERSONALISATION
            ========================================================================= */}
        {activeTab === "language" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card" style={{ padding: "24px" }}>
              {/* Starting language */}
              <div style={{ paddingBottom: "20px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Starting language
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                    The language the agent opens the call in
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "340px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "#E0E7FF",
                      color: "#4338CA",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                    }}
                  >
                    {getLanguageScript(startingLanguage)}
                  </div>
                  <select
                    className="form-control"
                    value={startingLanguage}
                    onChange={(e) => setStartingLanguage(e.target.value)}
                    style={{ fontSize: "14px", fontWeight: 600 }}
                  >
                    {INDIC_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Switch language during call */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Switch language during call
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Follow along seamlessly when the caller switches languages
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={switchLanguageDuringCall}
                    onChange={(e) => setSwitchLanguageDuringCall(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Languages allowed */}
              <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Languages allowed
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Languages the agent can understand and reply in
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {INDIC_LANGUAGES.map((l) => {
                    const isSelected = languagesAllowed.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => handleToggleAllowedLanguage(l.code)}
                        className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span style={{ fontWeight: 700 }}>{l.script}</span>
                        <span>{l.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-detected language switch & Switch after */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Auto-detected language switch
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Match the caller’s language using the allowed set above
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoDetectLanguage}
                    onChange={(e) => setAutoDetectLanguage(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ marginBottom: "10px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Switch after
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    How long to listen before switching language
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", maxWidth: "380px" }}>
                  {["Quick", "Normal", "Cautious"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSwitchAfter(s as any)}
                      className={`btn ${switchAfter === s ? "btn-primary" : "btn-secondary"}`}
                      style={{ flex: 1, fontSize: "12px", padding: "8px 12px" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output numbers in Indic */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Output numbers in Indic
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Converts numbers to Indic format. E.g. '500' → 'paanch sau'
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={outputNumbersInIndic}
                    onChange={(e) => setOutputNumbersInIndic(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: IN CALL ACTIONS
            ========================================================================= */}
        {activeTab === "actions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card" style={{ padding: "24px" }}>
              {/* Nudge quiet callers */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Nudge quiet callers
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                    Speak up if the caller goes silent for a while
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={nudgeQuietCallers}
                    onChange={(e) => setNudgeQuietCallers(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Dynamic Nudges list */}
              {nudgeQuietCallers && (
                <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "14px" }}>
                    {nudges.map((n, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "12px",
                          background: "#F8FAFC",
                          borderRadius: "8px",
                          border: "1px solid var(--border-subtle)",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", minWidth: "80px" }}>
                          Message {idx + 1}
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          value={n.message}
                          onChange={(e) => handleUpdateNudge(idx, "message", e.target.value)}
                          style={{ flex: 1, minWidth: "220px", fontSize: "13px" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>after</span>
                          <input
                            type="number"
                            min="2"
                            max="60"
                            className="form-control"
                            value={n.after_seconds}
                            onChange={(e) => handleUpdateNudge(idx, "after_seconds", e.target.value)}
                            style={{ width: "65px", fontSize: "13px", padding: "6px" }}
                          />
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>seconds</span>
                        </div>
                        {nudges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveNudge(idx)}
                            style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={handleAddNudge}
                      className="btn btn-secondary btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <Plus size={14} /> Add More
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Translations for all allowed Indic languages refreshed.")}
                      className="btn btn-secondary btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <RefreshCw size={12} /> Regenerate Translations
                    </button>
                  </div>
                </div>
              )}

              {/* Hang up after unanswered nudges */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Hang up after unanswered nudges
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    End the call if the caller still doesn’t respond after configured nudges
                  </p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hangupAfterUnansweredNudges}
                    onChange={(e) => setHangupAfterUnansweredNudges(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {/* Voicemail */}
              <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: voicemailDetection ? "12px" : 0 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Voicemail
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                      Leave a message when voicemail is detected
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={voicemailDetection}
                      onChange={(e) => setVoicemailDetection(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {voicemailDetection && (
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                      Voicemail message (What the agent says on voicemail)
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={voicemailMessage}
                      onChange={(e) => setVoicemailMessage(e.target.value)}
                      style={{ fontSize: "13px", lineHeight: "1.5", padding: "10px 14px", minHeight: "70px", borderRadius: "8px", width: "100%" }}
                    />
                  </div>
                )}
              </div>

              {/* Call forwarding */}
              <div style={{ padding: "20px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: callForwarding ? "12px" : 0 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Call forwarding
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                      Transfer the caller to a human agent when the AI triggers a transfer. Only supported for Vobiz connections.
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={callForwarding}
                      onChange={(e) => setCallForwarding(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {callForwarding && (
                  <div style={{ maxWidth: "360px", marginTop: "10px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                      Human Support Forwarding Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91 98765 43210"
                      value={forwardingNumber}
                      onChange={(e) => setForwardingNumber(e.target.value)}
                      style={{ fontSize: "13px" }}
                    />
                  </div>
                )}
              </div>

              {/* Max call length */}
              <div style={{ paddingTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                      Max call length
                    </h4>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                      Ends the call after this many minutes (up to 60)
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      className="form-control"
                      value={maxCallLengthMinutes}
                      onChange={(e) => setMaxCallLengthMinutes(parseInt(e.target.value) || 15)}
                      style={{ width: "80px", fontSize: "14px", fontWeight: 700, textAlign: "center" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION: GREETING & INSTRUCTIONS
            ========================================================================= */}
        {activeTab === "persona" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card" style={{ padding: "24px" }}>
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{ fontSize: "16px", margin: "0 0 4px", color: "var(--text-primary)" }}>
                  Greeting & System Instructions
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  Define the opening sentence spoken when the caller answers and the core instructions the agent follows throughout the conversation.
                </p>
              </div>

              {/* Greeting Message - Horizontally broad */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>
                    Greeting Message (Opening sentence spoken when caller picks up)
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Spoken immediately on answer
                  </span>
                </div>
                <textarea
                  className="form-control"
                  rows={3}
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  placeholder="नमस्ते! मैं सेवनकोर से बात कर रहा हूँ..."
                  style={{
                    width: "100%",
                    fontSize: "14px",
                    lineHeight: "1.5",
                    padding: "12px 14px",
                    minHeight: "85px",
                    borderRadius: "8px",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* System Instructions - Horizontally broad */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>
                    System Instructions & Persona Guardrails
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Full-width editor with clean line height
                  </span>
                </div>
                <textarea
                  className="form-control"
                  rows={7}
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  style={{
                    width: "100%",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    lineHeight: "1.55",
                    padding: "14px 16px",
                    minHeight: "160px",
                    borderRadius: "8px",
                    resize: "vertical",
                  }}
                  placeholder="You are an articulate, courteous voice AI agent..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Sticky Action Bar */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#FFFFFF",
            borderTop: "1px solid var(--border-subtle)",
            padding: "16px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.05)",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Configuring: <strong style={{ color: "var(--text-primary)" }}>{name || "Untitled Agent"}</strong>
            </span>
            <span className="badge badge-connected" style={{ fontSize: "11px" }}>
              Voice: {defaultVoice}
            </span>
            <span className="badge badge-running" style={{ fontSize: "11px" }}>
              {perLanguageVoices.length} language overrides
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/agents" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 24px" }}
            >
              {saving ? <RefreshCw size={16} className="spin" /> : <CheckCircle2 size={16} />}
              {mode === "create" ? "Create Voice Agent" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

