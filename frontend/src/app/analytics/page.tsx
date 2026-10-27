"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Clock, IndianRupee, PieChart, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const dailyTrends = data?.daily_trends || [];
  const durationDist = data?.duration_distribution || {};
  const maxAttempts = Math.max(...dailyTrends.map((d: any) => d.attempts), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1>Telephony & Campaign Analytics</h1>
        <p className="subtitle">
          Real-time performance metrics, pickup rates, duration distributions, and Sarvam AI telephony expenditure.
        </p>
      </div>

      {/* 7-Day Trend Bar Visualization */}
      <div className="glass-panel" style={{ padding: "28px", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h2>7-Day Call Volume & Answered Dials</h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              Daily attempt volume vs successful customer conversations
            </p>
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--accent-primary)" }} />
              <span>Total Attempts</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--accent-emerald)" }} />
              <span>Connected</span>
            </div>
          </div>
        </div>

        {/* CSS Bar Chart */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "200px", padding: "10px 0" }}>
          {dailyTrends.map((day: any, idx: number) => {
            const attemptHeight = (day.attempts / maxAttempts) * 160;
            const answeredHeight = (day.answered / maxAttempts) * 160;

            return (
              <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "160px", width: "100%", justifyContent: "center" }}>
                  {/* Attempt Bar */}
                  <div
                    style={{
                      width: "18px",
                      height: `${Math.max(attemptHeight, 4)}px`,
                      background: "linear-gradient(180deg, #6366F1 0%, #4F46E5 100%)",
                      borderRadius: "4px 4px 0 0",
                      transition: "height 0.3s ease",
                    }}
                    title={`${day.attempts} attempts`}
                  />
                  {/* Answered Bar */}
                  <div
                    style={{
                      width: "18px",
                      height: `${Math.max(answeredHeight, 4)}px`,
                      background: "linear-gradient(180deg, #10B981 0%, #059669 100%)",
                      borderRadius: "4px 4px 0 0",
                      transition: "height 0.3s ease",
                    }}
                    title={`${day.answered} answered`}
                  />
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px", whiteSpace: "nowrap" }}>
                  {day.date}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
        {/* Duration Distribution */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "17px", marginBottom: "6px" }}>Call Duration Distribution</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Length of connected conversations with recipients
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { label: "Short (< 30s)", count: durationDist.under_30s || 0, color: "#94A3B8" },
              { label: "Standard (30s – 60s)", count: durationDist["30_to_60s"] || 0, color: "#6366F1" },
              { label: "Engaged (1m – 2m)", count: durationDist["60_to_120s"] || 0, color: "#10B981" },
              { label: "Deep Dive (> 2m)", count: durationDist.over_120s || 0, color: "#F59E0B" },
            ].map((item, idx) => (
              <div key={idx}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontWeight: "700", color: "var(--text-primary)" }}>{item.count} calls</span>
                </div>
                <div style={{ height: "6px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${item.count > 0 ? Math.min(item.count * 15, 100) : 0}%`,
                      background: item.color,
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost & Compliance Guardrails */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "17px", marginBottom: "6px" }}>Telephony Billing & Pacing Guardrails</h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Sarvam published voice rates & compliance configurations
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ padding: "14px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sarvam Voice Agents Rate</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--accent-emerald)", marginTop: "2px" }}>
                ₹3.50 / minute (Pay-As-You-Go)
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Pro-rated by seconds. Volume Business Tier reduces to ₹3.00/min.
              </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", background: "#F8FAFC", border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>TRAI Calling Restrictions</div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", marginTop: "2px" }}>
                09:00 AM – 08:00 PM IST Only
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Commercial promotional voice calls are automatically suppressed outside this window.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
