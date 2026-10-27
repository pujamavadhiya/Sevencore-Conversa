"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Megaphone,
  PhoneCall,
  CheckCircle,
  Clock,
  IndianRupee,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Radio,
  PlusCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardMetrics, ProviderStatus } from "@/types";
import { BRANDING } from "@/lib/branding";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboard();
      setMetrics(data.metrics);
      setProvider(data.provider_status);
      setRecentCampaigns(data.recent_campaigns || []);
      setRecentCalls(data.recent_calls || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Voice Calling Automation Dashboard</h1>
          <p className="subtitle">{BRANDING.positioning}</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link href="/contacts" className="btn btn-secondary">
            <Users size={16} /> Import Contacts
          </Link>
          <Link href="/campaigns" className="btn btn-primary">
            <PlusCircle size={16} /> Create Campaign
          </Link>
        </div>
      </div>

      {/* Provider Connectivity Banner */}
      {provider && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderColor: provider.is_mock ? "rgba(236, 72, 153, 0.3)" : "rgba(16, 185, 129, 0.3)",
            background: provider.is_mock
              ? "linear-gradient(90deg, #FDF2F8 0%, #FFFFFF 100%)"
              : "linear-gradient(90deg, #F0FDF4 0%, #FFFFFF 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: provider.is_mock ? "#FCE7F3" : "#DCFCE7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: provider.is_mock ? "#BE185D" : "#059669",
              }}
            >
              <Radio size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)" }}>
                  {provider.provider}
                </span>
                {provider.is_mock ? (
                  <span className="badge badge-mock">MOCK SIMULATION ENGINE</span>
                ) : (
                  <span className="badge badge-success">LIVE VOBIZ RENTED TELEPHONY</span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Rented Calling Line: <strong style={{ color: "var(--text-primary)" }}>{provider.rented_number || "+91 80 4000 1234"}</strong> (India +91 Route)
                {provider.is_mock && " • Safe zero-cost development & testing mode active"}
              </div>
            </div>
          </div>
          <Link href="/settings" className="btn btn-secondary btn-sm">
            View Telephony Config
          </Link>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metric-grid">
        <div className="metric-card glass">
          <div className="icon-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)" }}>
            <PhoneCall size={22} />
          </div>
          <div className="value">{loading ? "-" : metrics?.calls_attempted || 0}</div>
          <div className="label">Total Calls Attempted</div>
        </div>

        <div className="metric-card glass">
          <div className="icon-badge" style={{ background: "var(--accent-emerald-bg)", color: "var(--accent-emerald)" }}>
            <CheckCircle size={22} />
          </div>
          <div className="value">{loading ? "-" : metrics?.calls_answered || 0}</div>
          <div className="label">
            Answered Calls ({metrics?.pickup_rate_pct || 0}% Pick-up Rate)
          </div>
        </div>

        <div className="metric-card glass">
          <div className="icon-badge" style={{ background: "var(--accent-cyan-bg)", color: "var(--accent-cyan)" }}>
            <Clock size={22} />
          </div>
          <div className="value">{loading ? "-" : `${metrics?.total_minutes || 0}m`}</div>
          <div className="label">Spoken AI Minutes ({metrics?.avg_duration_seconds || 0}s avg)</div>
        </div>

        <div className="metric-card glass">
          <div className="icon-badge" style={{ background: "var(--accent-amber-bg)", color: "var(--accent-amber)" }}>
            <IndianRupee size={22} />
          </div>
          <div className="value">
            {loading ? "-" : `₹${metrics?.total_cost_inr || "0.00"}`}
          </div>
          <div className="label">Approx. Sarvam Telephony Spend (₹3.50/min)</div>
        </div>
      </div>

      {/* Two Column Layout: Recent Campaigns & Call Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "28px", marginBottom: "32px" }}>
        {/* Recent Campaigns */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2>Recent Calling Campaigns</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                Paced outbound voice campaigns
              </p>
            </div>
            <Link href="/campaigns" style={{ color: "var(--accent-primary)", fontSize: "13px", fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              All Campaigns <ArrowRight size={14} />
            </Link>
          </div>

          {recentCampaigns.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <Megaphone size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-secondary)" }}>
                No calling campaigns launched yet
              </div>
              <p style={{ fontSize: "13px", marginTop: "4px", marginBottom: "16px" }}>
                Upload contacts and configure your first Sarvam voice agent campaign.
              </p>
              <Link href="/campaigns" className="btn btn-primary btn-sm">
                Launch First Campaign
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {recentCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  style={{
                    padding: "16px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>{camp.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      {camp.calls_attempted} of {camp.total_contacts} calls dispatched • {camp.calls_answered} answered
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${camp.status === "completed" ? "badge-connected" : camp.status === "running" ? "badge-running" : "badge-pending"}`}>
                      {camp.status.toUpperCase()}
                    </span>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                      Cost: ₹{camp.actual_cost_inr}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Call Activity Feed */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2>Recent Call Activity</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                Turn-by-turn Indian telephony attempts
              </p>
            </div>
            <Link href="/calls" style={{ color: "var(--accent-primary)", fontSize: "13px", fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
              View History <ArrowRight size={14} />
            </Link>
          </div>

          {recentCalls.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <PhoneCall size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-secondary)" }}>
                No recent calls
              </div>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>
                Use the Quick Test Call button in the top bar to place a test call.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentCalls.map((call) => (
                <div
                  key={call.id}
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
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                      {call.contact__name || "Recipient"} ({call.masked_phone})
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Agent: {call.agent__name} • Duration: {call.duration_seconds}s
                    </div>
                  </div>
                  <div>
                    <span className={`badge ${call.status === "connected" ? "badge-connected" : call.status === "initiated" ? "badge-running" : "badge-failed"}`}>
                      {call.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
