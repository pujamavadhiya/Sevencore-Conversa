"use client";

import React, { useState, useEffect } from "react";
import { Settings, Shield, Radio, CheckCircle, Save, AlertTriangle, KeyRound, Building } from "lucide-react";
import { api } from "@/lib/api";
import { BRANDING } from "@/lib/branding";

export default function SettingsPage() {
  const [data, setData] = useState<any | null>(null);
  const [orgName, setOrgName] = useState("");
  const [complianceMode, setComplianceMode] = useState(true);
  const [budget, setBudget] = useState("2000.00");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.getSettings();
      setData(res);
      if (res.organization) {
        setOrgName(res.organization.name);
        setComplianceMode(res.organization.compliance_mode);
        setBudget(res.organization.max_daily_budget_inr);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      await api.updateSettings({
        name: orgName,
        compliance_mode: complianceMode,
        max_daily_budget_inr: budget,
      });
      setSuccessMsg("Organization & compliance settings saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const provider = data?.sarvam_provider;

  return (
    <div style={{ maxWidth: "860px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1>Platform & Telephony Settings</h1>
        <p className="subtitle">
          Configure organization profile, compliance boundaries, and inspect Sarvam telephony connection health.
        </p>
      </div>

      {successMsg && (
        <div style={{ padding: "12px 16px", background: "var(--accent-emerald-bg)", color: "var(--accent-emerald)", borderRadius: "8px", marginBottom: "24px", fontSize: "13px" }}>
          <CheckCircle size={16} style={{ display: "inline", marginRight: "6px" }} />
          {successMsg}
        </div>
      )}

      {/* Brand Configuration Card */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "28px" }}>
        <h2 style={{ fontSize: "17px", marginBottom: "8px" }}>Centralized Brand Configuration</h2>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
          Brand name and positioning are maintained in one single configuration module across backend & frontend.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Provisional Working Name</div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--text-primary)", marginTop: "2px" }}>
              {BRANDING.name}
            </div>
          </div>
          <div style={{ padding: "14px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Telephony Provider</div>
            <div style={{ fontSize: "16px", fontWeight: "700", color: "var(--accent-emerald)", marginTop: "2px" }}>
              {BRANDING.telephonyProvider}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
          <strong>Brand Positioning:</strong> "{BRANDING.positioning}"
        </div>
      </div>

      {/* Sarvam Telephony Connection Health */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Radio size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: "17px" }}>Sarvam AI Telephony Status</h2>
          </div>
          {provider?.is_mock ? (
            <span className="badge badge-mock">DEV MOCK ACTIVE</span>
          ) : (
            <span className="badge badge-success">LIVE VOBIZ RENTED LINE</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#F8FAFC", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Telephony Route Mode</span>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
              {provider?.provider || "Sarvam Voice Agents"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Rented Calling Number (E.164)</span>
            <span style={{ fontSize: "13px", fontWeight: "700", fontFamily: "monospace", color: "var(--accent-emerald)" }}>
              {provider?.rented_number || "+91 80 4000 1234"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Secret Isolation</span>
            <span style={{ fontSize: "12px", color: "var(--accent-emerald)", fontWeight: "600" }}>
              ✓ Server-Side Environment (.env) Protected
            </span>
          </div>
        </div>

        <div style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          ℹ️ <strong>Zero-Secret Architecture:</strong> Private Sarvam API keys, rented phone number IDs, and webhook secrets reside strictly inside the backend environment variables. The browser never accesses private telephony credentials directly.
        </div>
      </div>

      {/* Organization & Compliance Settings Form */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "17px", marginBottom: "16px" }}>Compliance & Budget Guardrails</h2>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Organization Name</label>
            <input
              type="text"
              className="form-input"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Default Timezone</label>
              <input type="text" className="form-input" value="Asia/Kolkata (IST)" disabled />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Spend Guardrail (₹ INR)</label>
              <input
                type="number"
                step="50"
                className="form-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Campaigns halt automatically when daily spend threshold is reached.
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", margin: "20px 0" }}>
            <input
              type="checkbox"
              id="compliance"
              checked={complianceMode}
              onChange={(e) => setComplianceMode(e.target.checked)}
              style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "var(--accent-primary)" }}
            />
            <label htmlFor="compliance" style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.4" }}>
              <strong>Strict TRAI Telecom Compliance Mode (Recommended)</strong>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Enforces calling window restriction between 09:00 AM and 08:00 PM IST and auto-suppresses numbers in the NDNC / DND registry.
              </div>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
