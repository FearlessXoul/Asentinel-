// ════════════════════════════════════════════════════════════════════════════
// App.jsx — Asentinel root router
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import Landing from "./asentinel-landing";
import AuthPage from "./asentinel-auth";
import Dashboard from "./asentinel-dashboard";
import GodMode from "./asentinel-app";

const API = "https://asentinel.onrender.com";

export default function App() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("as_token");
    if (!token) { setChecking(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.id) { setUser(data); setPage("dashboard"); }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleAuthSuccess = (data) => { setUser(data); setPage("dashboard"); };

  const handleLogout = () => {
    localStorage.removeItem("as_token");
    localStorage.removeItem("as_plan");
    setUser(null);
    setPage("landing");
  };

  if (checking) return (
    <div style={{
      minHeight: "100vh", background: "#080810", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'SF Mono','Fira Code',monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00FFB2", animation: "pulse 1.2s ease infinite" }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>ASENTINEL</span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
    </div>
  );

  if (page === "landing") return <Landing onLogin={() => setPage("auth")} onSignup={() => setPage("auth")} />;
  if (page === "auth") return <AuthPage onSuccess={handleAuthSuccess} onBack={() => setPage("landing")} />;
  if (page === "dashboard") return <Dashboard user={user} onLogout={handleLogout} onOpenApp={() => setPage("app")} />;
  if (page === "app") return <GodMode user={user} onDashboard={() => setPage("dashboard")} />;

  return null;
}
