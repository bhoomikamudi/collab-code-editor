import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.badge}>Project A</p>
        <h1 style={styles.title}>Real-Time Collaborative Code Editor</h1>
        <p style={styles.description}>
          This app will support live collaborative code editing, document
          management, WebSocket sync, cursor presence, and AI assistance.
        </p>

        <div style={styles.grid}>
          <div style={styles.feature}>
            <h2 style={styles.featureTitle}>Frontend</h2>
            <p style={styles.featureText}>React + CodeMirror editor UI</p>
          </div>

          <div style={styles.feature}>
            <h2 style={styles.featureTitle}>Backend</h2>
            <p style={styles.featureText}>Node.js REST API + WebSockets</p>
          </div>

          <div style={styles.feature}>
            <h2 style={styles.featureTitle}>AI Service</h2>
            <p style={styles.featureText}>FastAPI + OpenAI + RAG pipeline</p>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    margin: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
    background: "#111827",
    color: "#f9fafb",
    padding: "24px"
  },
  card: {
    width: "100%",
    maxWidth: "900px",
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "20px",
    padding: "40px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)"
  },
  badge: {
    display: "inline-block",
    margin: "0 0 16px",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "14px"
  },
  title: {
    margin: "0 0 16px",
    fontSize: "42px",
    lineHeight: 1.1
  },
  description: {
    margin: "0 0 28px",
    color: "#d1d5db",
    fontSize: "18px",
    lineHeight: 1.6
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px"
  },
  feature: {
    border: "1px solid #374151",
    borderRadius: "14px",
    padding: "20px",
    background: "#111827"
  },
  featureTitle: {
    margin: "0 0 8px",
    fontSize: "20px"
  },
  featureText: {
    margin: 0,
    color: "#d1d5db"
  }
};

createRoot(document.getElementById("root")).render(<App />);