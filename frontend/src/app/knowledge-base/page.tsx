"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Upload, FileText, CheckCircle, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await api.getKnowledgeFiles();
      setFiles(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.uploadKnowledgeFile(formData);
      loadFiles();
    } catch (err: any) {
      setError(err.message || "Failed to upload knowledge file");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this document from knowledge base?")) {
      try {
        await api.deleteKnowledgeFile(id);
        loadFiles();
      } catch (err: any) {
        alert(err.message || "Failed to delete file");
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1>Knowledge Base & Business Documents</h1>
          <p className="subtitle">
            Upload approved product brochures, FAQs, and pricing PDFs (up to 10MB) to ground Voice Agent conversations.
          </p>
        </div>
        <div>
          <input
            type="file"
            id="kb-upload"
            accept=".pdf,.txt,.csv"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <label htmlFor="kb-upload" className="btn btn-primary" style={{ cursor: "pointer" }}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload Document (.pdf, .txt, .csv)
          </label>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px", background: "var(--accent-rose-bg)", color: "var(--accent-rose)", borderRadius: "8px", marginBottom: "20px", fontSize: "13px" }}>
          <AlertTriangle size={16} style={{ display: "inline", marginRight: "6px" }} />
          {error}
        </div>
      )}

      {/* Documents Grid */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Format</th>
              <th>Size</th>
              <th>Processing Status</th>
              <th>Summary Snippet</th>
              <th>Uploaded Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No documents in knowledge base yet. Upload product brochures, rate cards, or policy documents.
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: "600", color: "var(--text-primary)" }}>{f.name}</td>
                  <td>
                    <span className="badge badge-running">{f.file_type}</span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>
                    {(f.file_size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td>
                    <span className="badge badge-success">
                      <CheckCircle size={12} /> {f.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "260px" }}>
                    {f.content_summary ? f.content_summary.slice(0, 75) + "..." : "—"}
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                    {new Date(f.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(f.id)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
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
