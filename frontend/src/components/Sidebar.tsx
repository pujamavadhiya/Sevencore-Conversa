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
  Zap,
} from "lucide-react";
import { BRANDING } from "@/lib/branding";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Instant Outbound", href: "/instant-outbound", icon: Zap },
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
      <div className="sidebar-header">
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
            <div style={{ fontSize: "11px", color: "#818CF8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              AI Calling Platform
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
        <div className="sidebar-section-title">
          Management
        </div>
        <ul className="sidebar-nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href} style={{ marginBottom: "4px" }}>
                <Link
                  href={item.href}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                >
                  <Icon
                    size={18}
                    className="sidebar-icon"
                    color={isActive ? "#818CF8" : "#94A3B8"}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Telephony Status Footer */}
      <div className="sidebar-footer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="live-dot" />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "#34D399" }}>
              Sarvam Voice Engine
            </span>
          </div>
          <span className="badge badge-mock" style={{ background: "rgba(255, 255, 255, 0.1)", color: "#E2E8F0" }}>DEV MOCK</span>
        </div>
        <div style={{ fontSize: "11px", color: "#94A3B8", lineHeight: "1.4" }}>
          India Telephony: <strong style={{ color: "#F8FAFC" }}>+91 80 4000 1234</strong>
        </div>
      </div>
    </aside>
  );
}
