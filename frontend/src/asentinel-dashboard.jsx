import { useState, useEffect } from "react";

const C = {
  bg: "#080810", bg2: "#0D0D18", bg3: "#12121F",
  border: "rgba(255,255,255,0.07)",
  green: "#00FFB2", gold: "#FBBF24", red: "#EF4444", purple: "#A78BFA", blue: "#38BDF8",
  text: "#E8E8E8", muted: "rgba(255,255,255,0.4)", dim: "rgba(255,255,255,0.12)",
};
const mono = "'SF Mono','Fira Code','Courier New',monospace";
const API = import.meta?.env?.VITE_API_URL || "http://localhost:3001";

const PLANS = {
  free:  { label: "FREE",  color: C.muted, price: "$0" },
  pro:   { label: "PRO",   color: C.green, price: "$29/mo" },
  elite: { label: "ELITE", color: C.gold,  price: "$79/mo" },
};

const AGENTS = [
  { id: "oracle",  icon: "◈", label: "Oracle",       color: C.green,   plans: ["free","pro","elite"] },
  { id: "sniper",  icon: "⊕", label: "Sniper",       color: "#FF6B35", plans: ["pro","elite"] },
  { id: "shrink",  icon: "⬡", label: "Shrink",       color: C.purple,  plans: ["free","pro","elite"] },
  { id: "autopsy", icon: "◎", label: "Autopsy",      color: C.gold,    plans: ["pro","elite"] },
  { id: "quant",   icon: "∑", label: "Quant",        color: C.blue,    plans: ["pro","elite"] },
  { id: "risk",    icon: "⚠", label: "Risk Manager", color: C.red,     plans: ["pro","elite"] },
  { id: "news",    icon: "⚡", label: "News Scanner", color: C.gold,    plans: ["elite"] },
];

const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.bg2, border: `1px solid ${C.border}`,
    borderRadius: 14, padding: "20px", ...style,
  }}>{children}</div>
);

const SectionLabel = ({ text }) => (
  <div style={{ fontSize: 9, letterSpacing: "0.16em", color: C.muted, marginBottom: 14 }}>{text}</div>
);

export default function Dashboard({ onLogout }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [telegramCopied, setTelegramCopied] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState("");

  const token = localStorage.getItem("as_token");

  useEffect(() => {
    if (!token) return onLogout?.();
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.error) onLogout?.(); else setUser(data); })
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (priceKey) => {
    const priceId = priceKey === "pro"
      ? import.meta?.env?.VITE_STRIPE_PRO_PRICE_ID
      : import.meta?.env?.VITE_STRIPE_ELITE_PRICE_ID;
    if (!priceId) return alert("Stripe not configured yet");
    setUpgradeLoading(priceKey);
    try {
      const res = await fetch(`${API}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { alert("Error — try again"); }
    setUpgradeLoading("");
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch(`${API}/billing/portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { alert("Error opening billing portal"); }
    setBillingLoading(false);
  };

  const copyTelegramLink = () => {
    const link = `https://t.me/asentinelai_bot?start=connect_${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setTelegramCopied(true);
      setTimeout(() => setTelegramCopied(false), 2000);
    });
  };

  const logout = () => {
    localStorage.removeItem("as_token");
    localStorage.removeItem("as_plan");
    onLogout?.();
  };

  if (loading) return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: mono,
    }}>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em" }}>Loading…</div>
    </div>
  );

  const plan = user?.plan || "free";
  const planInfo = PLANS[plan];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: mono, color: C.text }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Nav */}
      <nav style={{
        padding: "0 24px", height: 54, display: "flex", alignItems: "center",
        justifyContent: "space-between", borderBottom: `1px solid ${C.border}`,
        background: "rgba(8,8,16,0.9)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em" }}>ASENTINEL</span>
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>/ DASHBOARD</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted }}>{user?.email}</span>
          <button onClick={() => window.location.href = "/app"} style={{
            background: C.green, border: "none", color: "#000",
            padding: "5px 12px", borderRadius: 7, fontSize: 10, fontWeight: 800,
            cursor: "pointer", fontFamily: mono, letterSpacing: "0.04em",
          }}>OPEN APP →</button>
          <button onClick={logout} style={{
            background: "none", border: `1px solid ${C.border}`, color: C.muted,
            padding: "5px 10px", borderRadius: 7, fontSize: 10, cursor: "pointer", fontFamily: mono,
          }}>LOG OUT</button>
        </div>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px", animation: "fadeUp 0.3s ease" }}>

        {/* Plan card */}
        <Card style={{ marginBottom: 16, borderColor: planInfo.color + "40" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <SectionLabel text="YOUR PLAN" />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: planInfo.color,
                  background: `${planInfo.color}15`, border: `1px solid ${planInfo.color}30`,
                  padding: "3px 10px", borderRadius: 20, letterSpacing: "0.08em",
                }}>{planInfo.label}</span>
                <span style={{ fontSize: 13, color: planInfo.color }}>{planInfo.price}</span>
              </div>
              {plan === "free" && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                  3 messages/day · Oracle + Shrink only
                </div>
              )}
            </div>
            {plan !== "free" ? (
              <button onClick={handleManageBilling} disabled={billingLoading} style={{
                background: "none", border: `1px solid ${C.border}`, color: C.muted,
                padding: "7px 14px", borderRadius: 8, fontSize: 10, cursor: "pointer",
                fontFamily: mono, letterSpacing: "0.05em",
              }}>{billingLoading ? "…" : "Manage billing"}</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleUpgrade("pro")} disabled={upgradeLoading === "pro"} style={{
                  background: C.green, border: "none", color: "#000",
                  padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: "pointer", fontFamily: mono,
                }}>{upgradeLoading === "pro" ? "…" : "Get Pro →"}</button>
              </div>
            )}
          </div>
        </Card>

        {/* Agent access */}
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel text="AGENT ACCESS" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGENTS.map((a) => {
              const unlocked = a.plans.includes(plan);
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  background: unlocked ? `${a.color}0A` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${unlocked ? a.color + "25" : C.border}`,
                  opacity: unlocked ? 1 : 0.5,
                }}>
                  <span style={{ fontSize: 14, color: unlocked ? a.color : C.dim }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: unlocked ? C.text : C.dim }}>{a.label}</div>
                    <div style={{ fontSize: 9, color: C.dim, letterSpacing: "0.04em" }}>
                      {unlocked ? "UNLOCKED" : a.plans[0].toUpperCase() + "+"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {plan === "free" && (
            <div style={{ marginTop: 14, padding: "12px", background: `${C.gold}08`, border: `1px solid ${C.gold}20`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.gold, marginBottom: 6 }}>Unlock all 7 agents with Pro</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleUpgrade("pro")} style={{
                  flex: 1, padding: "9px", background: C.gold, border: "none",
                  color: "#000", fontWeight: 800, fontSize: 11, borderRadius: 8,
                  cursor: "pointer", fontFamily: mono,
                }}>Get Pro — $29/mo →</button>
                <button onClick={() => handleUpgrade("elite")} style={{
                  flex: 1, padding: "9px", background: "none", border: `1px solid ${C.gold}40`,
                  color: C.gold, fontSize: 11, borderRadius: 8, cursor: "pointer", fontFamily: mono,
                }}>Go Elite — $79/mo</button>
              </div>
            </div>
          )}
        </Card>

        {/* Telegram connect */}
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel text="TELEGRAM BOT" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {plan === "elite" ? "Connect your Telegram" : "Available on Elite"}
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                {plan === "elite"
                  ? "Use all 7 agents directly in Telegram. Copy the link below and open it on your phone."
                  : "Get the Telegram bot — all 7 agents as commands, right in your DMs."}
              </div>
            </div>
            {plan === "elite" ? (
              <button onClick={copyTelegramLink} style={{
                flexShrink: 0, padding: "9px 16px", borderRadius: 8,
                background: telegramCopied ? `${C.green}20` : "none",
                border: `1px solid ${telegramCopied ? C.green : C.border}`,
                color: telegramCopied ? C.green : C.muted,
                fontSize: 10, cursor: "pointer", fontFamily: mono, letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}>
                {telegramCopied ? "✓ COPIED" : "COPY LINK"}
              </button>
            ) : (
              <button onClick={() => handleUpgrade("elite")} style={{
                flexShrink: 0, padding: "9px 14px", borderRadius: 8,
                background: C.gold, border: "none",
                color: "#000", fontSize: 10, fontWeight: 800, cursor: "pointer",
                fontFamily: mono,
              }}>Go Elite →</button>
            )}
          </div>

          {plan === "elite" && (
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: C.bg3, borderRadius: 8,
              fontSize: 10, color: C.muted, letterSpacing: "0.04em", lineHeight: 1.8,
            }}>
              1. Copy the link above<br />
              2. Open it on your phone<br />
              3. Tap "Start" in Telegram<br />
              4. You're connected — use /oracle, /sniper, etc.
            </div>
          )}
        </Card>

        {/* Account */}
        <Card>
          <SectionLabel text="ACCOUNT" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{user?.email}</div>
              <div style={{ fontSize: 10, color: C.dim }}>
                Joined {user?.created_at ? new Date(user.created_at * 1000).toLocaleDateString() : "—"}
              </div>
            </div>
            <button onClick={logout} style={{
              background: "none", border: `1px solid ${C.red}30`,
              color: C.red + "AA", padding: "7px 14px", borderRadius: 8,
              fontSize: 10, cursor: "pointer", fontFamily: mono,
            }}>Log out</button>
          </div>
        </Card>

      </div>
    </div>
  );
}
