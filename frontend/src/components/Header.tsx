"use client";

import React, { useState, useEffect } from "react";
import { Phone, Clock, ShieldCheck, Moon } from "lucide-react";
import TestCallModal from "./TestCallModal";

export default function Header() {
  const [istTime, setIstTime] = useState("");
  const [isWindowOpen, setIsWindowOpen] = useState(true);
  const [testModalOpen, setTestModalOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const istStr = now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        setIstTime(istStr);

        // Check hour in IST (9 AM to 8 PM)
        const istHourStr = now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        });
        const hour = parseInt(istHourStr, 10);
        setIsWindowOpen(hour >= 9 && hour < 20);
      } catch {
        // fallback
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="top-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Live Indian Timezone clock */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F1F5F9",
              padding: "6px 14px",
              borderRadius: "9999px",
              border: "1px solid #CBD5E1",
              fontSize: "13px",
              color: "#334155",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: "600",
            }}
          >
            <Clock size={14} color="var(--accent-primary)" />
            <span>IST: {istTime || "Loading..."}</span>
          </div>

          {/* Telecom Calling Window Status */}
          <div
            className={`badge ${isWindowOpen ? "badge-success" : "badge-warning"}`}
            style={{ padding: "5px 12px", fontSize: "12px" }}
          >
            {isWindowOpen ? (
              <>
                <ShieldCheck size={14} /> TRAI Calling Window Open (09:00 - 20:00 IST)
              </>
            ) : (
              <>
                <Moon size={14} /> TRAI Window Closed (Suppressed till 09:00 AM)
              </>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTestModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Phone size={14} color="var(--accent-emerald)" />
            <span>Quick Test Call</span>
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 12px",
              borderRadius: "8px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                fontSize: "12px",
                color: "#FFFFFF",
              }}
            >
              SC
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#0F172A" }}>Admin</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Sevencore Workspace</div>
            </div>
          </div>
        </div>
      </header>

      <TestCallModal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} />
    </>
  );
}
