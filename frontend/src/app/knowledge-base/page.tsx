"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Globe,
  Upload,
  FileText,
  FileEdit,
  CheckCircle,
  Trash2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Bot,
  ExternalLink,
  Search,
  Filter,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { VoiceAgent } from "@/types";

type FeedingCategory = "site" | "document" | "text";

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [activeCategory, setActiveCategory] = useState<FeedingCategory>("site");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State: 1. Site Scraper
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteAgentId, setSiteAgentId] = useState<number | "">("");

  // Form State: 2. Document Upload
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docAgentId, setDocAgentId] = useState<number | "">("");

  // Form State: 3. Paste Raw Text
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textAgentId, setTextAgentId] = useState<number | "">("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [kbData, agentData] = await Promise.all([
        api.getKnowledgeFiles(),
        api.getAgents().catch(() => []),
      ]);
      setItems(Array.isArray(kbData) ? kbData : kbData.results || []);
      setAgents(Array.isArray(agentData) ? agentData : agentData.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1. Submit Site Scraping
  const handleScrapeSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteUrl.trim()) {
      setError("Please enter a valid website URL to scrape.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await api.scrapeSiteKnowledge({
        url: siteUrl.trim(),
        name: siteName.trim() || undefined,
        agent_id: siteAgentId ? Number(siteAgentId) : undefined,
      });
      setSuccessMsg(`Successfully scraped and fed data from ${siteUrl}`);
      setSiteUrl("");
      setSiteName("");
      loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to scrape website");
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Document Upload
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setError("Please select a document file (.pdf, .txt, .csv) to upload.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("category", "document");
    if (docAgentId) {
      formData.append("agent_id", String(docAgentId));
    }

    try {
      await api.uploadKnowledgeFile(formData);
      setSuccessMsg(`Document "${docFile.name}" successfully parsed and added.`);
      setDocFile(null);
      loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Submit Pasted Text
  const handlePasteText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) {
      setError("Please paste or write some knowledge content.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await api.pasteTextKnowledge({
        name: textTitle.trim() || "Custom Knowledge Notes",
        text: textContent.trim(),
        agent_id: textAgentId ? Number(textAgentId) : undefined,
      });
      setSuccessMsg(`Pasted knowledge "${textTitle || 'Notes'}" successfully saved.`);
      setTextTitle("");
      setTextContent("");
      loadAll();
    } catch (err: any) {
      setError(err.message || "Failed to save pasted text");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this knowledge source from the Knowledge Base?")) {
      try {
        await api.deleteKnowledgeFile(id);
        loadAll();
      } catch (err: any) {
        alert(err.message || "Failed to delete knowledge source");
      }
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.source_url && item.source_url.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.content_summary && item.content_summary.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Knowledge Base & Agent Learning Hub</h1>
          <p className="subtitle">
            Feed knowledge into your voice agents through 3 flexible channels: scrape websites, upload business documents, or paste text data directly.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: "12px 16px", background: "var(--accent-rose-bg)", border: "1px solid rgba(225, 29, 72, 0.3)", color: "var(--accent-rose)", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: "12px 16px", background: "var(--accent-emerald-bg)", border: "1px solid rgba(5, 150, 105, 0.3)", color: "var(--accent-emerald)", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* INGESTION SECTION: 3 FEEDING CATEGORIES                   */}
      {/* ======================================================== */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "32px" }}>
        {/* Category Tabs */}
        <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setActiveCategory("site");
              setError(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              border: "1px solid",
              background: activeCategory === "site" ? "#EEF2FF" : "#FFFFFF",
              borderColor: activeCategory === "site" ? "var(--accent-primary)" : "var(--border-subtle)",
              color: activeCategory === "site" ? "var(--accent-primary)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            <Globe size={16} />
            <span>1. Website / Site URL Scraper</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("document");
              setError(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              border: "1px solid",
              background: activeCategory === "document" ? "#EEF2FF" : "#FFFFFF",
              borderColor: activeCategory === "document" ? "var(--accent-primary)" : "var(--border-subtle)",
              color: activeCategory === "document" ? "var(--accent-primary)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            <Upload size={16} />
            <span>2. Upload Documents (PDF / TXT / CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("text");
              setError(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              border: "1px solid",
              background: activeCategory === "text" ? "#EEF2FF" : "#FFFFFF",
              borderColor: activeCategory === "text" ? "var(--accent-primary)" : "var(--border-subtle)",
              color: activeCategory === "text" ? "var(--accent-primary)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            <FileEdit size={16} />
            <span>3. Paste Raw Text & Notes</span>
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* CATEGORY 1: SITES / WEBSITES SCRAPING                */}
        {/* ---------------------------------------------------- */}
        {activeCategory === "site" && (
          <form onSubmit={handleScrapeSite}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Scrape Website & Feed to Agent</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Paste any public website URL (product catalog, pricing, FAQs, or help center). Sevencore Conversa will crawl the text, strip HTML/scripts, and feed it to the agent.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "16px", alignItems: "flex-end", marginBottom: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Website URL <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="url"
                    className="form-input"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://sevencore.ai/pricing or mybusiness.in/faq"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Custom Label (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. Official Pricing Page"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Feed to Specific Voice Agent</label>
                <select
                  className="form-select"
                  value={siteAgentId}
                  onChange={(e) => setSiteAgentId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">General Knowledge (Any Agent)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.primary_language})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Scraping & Processing Page...
                  </>
                ) : (
                  <>
                    <Globe size={16} /> Scrape & Feed Website
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* CATEGORY 2: DOCUMENT UPLOAD                          */}
        {/* ---------------------------------------------------- */}
        {activeCategory === "document" && (
          <form onSubmit={handleUploadDoc}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Upload Business Documents</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Upload brochures, product spec sheets, rate cards, or policy documents (.pdf, .txt, .csv up to 10MB).
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", alignItems: "flex-end", marginBottom: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Select Document File (.pdf, .txt, .csv) <span style={{ color: "var(--accent-rose)" }}>*</span>
                </label>
                <input
                  type="file"
                  id="kb-doc-file"
                  accept=".pdf,.txt,.csv,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="form-input"
                  style={{ padding: "8px 12px" }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Feed to Specific Voice Agent</label>
                <select
                  className="form-select"
                  value={docAgentId}
                  onChange={(e) => setDocAgentId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">General Knowledge (Any Agent)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.primary_language})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting || !docFile}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Uploading & Parsing...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Upload & Feed Document
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ---------------------------------------------------- */}
        {/* CATEGORY 3: PASTE RAW TEXT                           */}
        {/* ---------------------------------------------------- */}
        {activeCategory === "text" && (
          <form onSubmit={handlePasteText}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>Paste Text, FAQs & Custom Guidelines</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Paste free-form business facts, objection-handling scripts, custom pricing tiers, or instructions directly.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Knowledge Title / Subject</label>
                <input
                  type="text"
                  className="form-input"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="e.g. Diwalii Festive Discount Terms & Return Policy"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Feed to Specific Voice Agent</label>
                <select
                  className="form-select"
                  value={textAgentId}
                  onChange={(e) => setTextAgentId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">General Knowledge (Any Agent)</option>
                  {agents.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.name} ({ag.primary_language})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Knowledge Body / Content <span style={{ color: "var(--accent-rose)" }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste product details, refund rules, FAQs, pricing breakdown, or customer service guidance here..."
                required
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                Characters: {textContent.length} • Words: {textContent.trim() ? textContent.trim().split(/\s+/).length : 0}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving Knowledge...
                  </>
                ) : (
                  <>
                    <FileEdit size={16} /> Save & Feed Text
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ======================================================== */}
      {/* KNOWLEDGE REPOSITORY & FILTERING                         */}
      {/* ======================================================== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
            Filter Sources:
          </span>
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={`badge ${filterCategory === "all" ? "badge-running" : ""}`}
            style={{
              cursor: "pointer",
              background: filterCategory === "all" ? "#EEF2FF" : "#FFFFFF",
              border: "1px solid var(--border-subtle)",
              color: filterCategory === "all" ? "var(--accent-primary)" : "var(--text-secondary)",
              padding: "5px 12px",
            }}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory("site")}
            className={`badge ${filterCategory === "site" ? "badge-running" : ""}`}
            style={{
              cursor: "pointer",
              background: filterCategory === "site" ? "#EEF2FF" : "#FFFFFF",
              border: "1px solid var(--border-subtle)",
              color: filterCategory === "site" ? "var(--accent-primary)" : "var(--text-secondary)",
              padding: "5px 12px",
            }}
          >
            🌐 Websites ({items.filter((i) => i.category === "site").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory("document")}
            className={`badge ${filterCategory === "document" ? "badge-running" : ""}`}
            style={{
              cursor: "pointer",
              background: filterCategory === "document" ? "#EEF2FF" : "#FFFFFF",
              border: "1px solid var(--border-subtle)",
              color: filterCategory === "document" ? "var(--accent-primary)" : "var(--text-secondary)",
              padding: "5px 12px",
            }}
          >
            📄 Documents ({items.filter((i) => i.category === "document").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterCategory("text")}
            className={`badge ${filterCategory === "text" ? "badge-running" : ""}`}
            style={{
              cursor: "pointer",
              background: filterCategory === "text" ? "#EEF2FF" : "#FFFFFF",
              border: "1px solid var(--border-subtle)",
              color: filterCategory === "text" ? "var(--accent-primary)" : "var(--text-secondary)",
              padding: "5px 12px",
            }}
          >
            📝 Pasted Text ({items.filter((i) => i.category === "text").length})
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", width: "260px" }}>
          <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "10px", top: "11px" }} />
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            style={{ paddingLeft: "32px", paddingRight: "10px", fontSize: "13px" }}
          />
        </div>
      </div>

      {/* Knowledge Base Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Source / Name</th>
              <th>Category</th>
              <th>Assigned Agent</th>
              <th>Words / Size</th>
              <th>Summary Snippet</th>
              <th>Added Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No knowledge base items match your filter. Select one of the 3 tabs above to feed websites, documents, or text.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{item.name}</div>
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "11px",
                          color: "var(--accent-primary)",
                          textDecoration: "underline",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          marginTop: "2px",
                        }}
                      >
                        {item.source_url.slice(0, 45)}... <ExternalLink size={10} />
                      </a>
                    )}
                  </td>
                  <td>
                    {item.category === "site" ? (
                      <span className="badge" style={{ background: "#F0FDF4", color: "#047857", border: "1px solid #BBF7D0" }}>
                        <Globe size={12} /> Website Scrape
                      </span>
                    ) : item.category === "text" ? (
                      <span className="badge" style={{ background: "#FDF2F8", color: "#BE185D", border: "1px solid #FBCFE8" }}>
                        <FileEdit size={12} /> Pasted Text
                      </span>
                    ) : (
                      <span className="badge badge-running">
                        <FileText size={12} /> {item.file_type || "Document"}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.agent_name ? (
                      <span className="badge badge-connected">
                        <Bot size={12} /> {item.agent_name}
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Available to all</span>
                    )}
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                    {item.word_count ? `${item.word_count.toLocaleString()} words` : `${(item.file_size_bytes / 1024).toFixed(1)} KB`}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-secondary)", maxWidth: "280px" }}>
                    {item.content_summary ? item.content_summary.slice(0, 85) + "..." : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    {new Date(item.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(item.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                      title="Delete Knowledge Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
