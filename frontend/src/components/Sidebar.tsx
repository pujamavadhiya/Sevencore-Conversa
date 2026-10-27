"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Users,
  Megaphone,
  PhoneCall,
  FileText,
  BarChart3,
  CalendarCheck,
  Settings,
  ShieldCheck,
  Radio,
} from "lucide-react";
import { BRANDING } from "@/lib/branding";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Voice Agents", href: "/agents", icon: Bot },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
  { label: "Contacts & Import", href: "/contacts", icon: Users },
  { label: "Calling Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Call History", href: "/calls", icon: PhoneCall },
  { label: "Transcripts", href: "/transcripts", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Meetings & Leads", href: "/meetings", icon: CalendarCheck },
  { label: "Platform Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
            <Radio size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              {BRANDING.name}
            </div>
            <div style={{ fontSize: "11px", color: "var(--accent-primary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              AI Calling Platform
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
        <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 12px 10px" }}>
          Management
        </div>
        <ul style={{ listStyle: "none" }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href} style={{ marginBottom: "4px" }}>
                <Link
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: isActive ? "600" : "500",
                    color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                    backgroundColor: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
                    border: isActive ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={18} color={isActive ? "var(--accent-primary)" : "var(--text-muted)"} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Telephony Status Footer */}
      <div style={{ padding: "16px 18px", borderTop: "1px solid var(--border-subtle)", background: "rgba(11, 17, 32, 0.8)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="live-dot" />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--accent-emerald)" }}>
              Sarvam Voice Engine
            </span>
          </div>
          <span className="badge badge-mock">DEV MOCK</span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
          India Telephony: <strong style={{ color: "var(--text-secondary)" }}>+91 80 4000 1234</strong>
        </div>
      </div>
    </aside>
  );
}
