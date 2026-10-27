"use client";

import React, { useState, useEffect } from "react";
import { FileText, Bot, User, Clock, Languages, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { Transcript } from "@/types";

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    try {
      setLoading(true);
      const data = await api.getTranscripts();
      const list = Array.isArray(data) ? data : data.results || [];
      setTranscripts(list);
      if (list.length > 0) {
        setSelectedTranscript(list[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1>Conversation Transcripts & AI Insights</h1>
        <p className="subtitle">
          Turn-by-turn Indian language speech recognition and conversation transcripts from Sarvam Voice Agents.
        </p>
      </div>

      {transcripts.length === 0 && !loading ? (
        <div className="glass-panel" style={{ padding: "50px", textAlign: "center", color: "var(--text-muted)" }}>
          <MessageSquare size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
          <h2 style={{ fontSize: "16px", color: "var(--text-secondary)" }}>No conversation transcripts yet</h2>
          <p style={{ fontSize: "13px", marginTop: "4px" }}>
            Transcripts are automatically generated and stored when voice calls connect.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "24px" }}>
          {/* Left list */}
          <div className="glass-panel" style={{ padding: "16px", maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "12px", padding: "0 4px" }}>
              Completed Conversations ({transcripts.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {transcripts.map((t) => {
                const isSelected = selectedTranscript?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTranscript(t)}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      background: isSelected ? "#EEF2FF" : "#F8FAFC",
                      border: isSelected ? "1px solid #6366F1" : "1px solid var(--border-subtle)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                        Call Attempt #{t.call_attempt}
                      </span>
                      <span className="badge badge-success" style={{ fontSize: "10px" }}>
                        {t.disposition || "Connected"}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      {t.summary ? t.summary.slice(0, 60) + "..." : `${t.messages?.length || 0} spoken turns`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Detailed Conversation Flow */}
          {selectedTranscript ? (
            <div className="glass-panel" style={{ padding: "28px", display: "flex", flexDirection: "column" }}>
              {/* Outcome Banner */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  background: "#EEF2FF",
                  border: "1px solid #C7D2FE",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1E1B4B" }}>
                    AI Conversation Summary
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span className="badge badge-running">Disposition: {selectedTranscript.disposition}</span>
                    <span className="badge badge-connected">Sentiment: {selectedTranscript.sentiment}</span>
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  {selectedTranscript.summary || "Conversation completed normally."}
                </p>
              </div>

              {/* Turn-by-Turn Dialogues */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
                {selectedTranscript.messages?.map((msg: any, idx: number) => {
                  const isAssistant = msg.role === "assistant";
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        alignSelf: isAssistant ? "flex-start" : "flex-end",
                        maxWidth: "75%",
                      }}
                    >
                      {isAssistant && (
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: "4px",
                          }}
                        >
                          <Bot size={16} color="#FFFFFF" />
                        </div>
                      )}
                      <div>
                        <div
                          className={isAssistant ? "turn-bubble turn-assistant" : "turn-bubble turn-user"}
                          style={{ margin: 0, width: "100%", maxWidth: "100%" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "4px", fontSize: "11px", opacity: 0.7 }}>
                            <span>{isAssistant ? "Sarvam Voice Agent" : "Customer / Recipient"}</span>
                            <span>{msg.language_name}</span>
                          </div>
                          <div>{msg.content}</div>
                        </div>
                      </div>
                      {!isAssistant && (
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "50%",
                            background: "rgba(30, 41, 59, 1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: "4px",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <User size={16} color="var(--text-muted)" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
              Select a conversation to view the transcript.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
