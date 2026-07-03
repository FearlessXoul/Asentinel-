import { useState, useEffect, useRef } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#080810",
  bg2: "#0D0D18",
  bg3: "#12121F",
  border: "rgba(255,255,255,0.07)",
  green: "#00FFB2",
  gold: "#FBBF24",
  red: "#EF4444",
  purple: "#A78BFA",
  blue: "#38BDF8",
  text: "#E8E8E8",
  muted: "rgba(255,255,255,0.4)",
  dim: "rgba(255,255,255,0.15)",
};

const mono = "'SF Mono','Fira Code','Courier New',monospace";

// ─── Animated desk feed (hero) ────────────────────────────────────────────────
const SIGNALS = [
  { color: C.gold, label: "● REGIME SHIFT", badge: "ACT NOW", title: "The market turned", body: "Vol 4× wider. Funding flipped. Buyers thinning." },
  { color: C.red, label: "⚠ BEHAVIOR", badge: "YOUR PATTERN", title: "You're repeating a mistake", body: "Sized up right after a loss. 3rd time this week." },
  { color: C.purple, label: "⬡ SHRINK", badge: "MINDSET", title: "Revenge mode detected", body: "You re-entered BTC 8 min after your stop. That wasn't a setup." },
  { color: C.green, label: "◈ ORACLE", badge: "SIGNAL", title: "Strong confluence at 4H level", body: "Break + volume + daily trend alignment. R:R 1:3.4." },
  { color: C.blue, label: "∑ QUANT", badge: "EDGE", title: "Win rate dropped this week", body: "63% → 48%. Your Friday trades account for all of it." },
];

const LiveFeed = () => {
  const [visibleIdx, setVisibleIdx] = useState([0, 1]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setVisibleIdx((prev) => {
        const next = (prev[prev.length - 1] + 1) % SIGNALS.length;
        return [...prev.slice(-2), next];
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
      <div style={{
        fontSize: 9, color: C.green, letterSpacing: "0.14em", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", background: C.green,
          display: "inline-block", animation: "pulse 1.5s ease infinite",
        }} />
        LIVE · {SIGNALS.length} AGENTS WATCHING
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleIdx.map((idx, i) => {
          const s = SIGNALS[idx];
          return (
            <div key={`${idx}-${tick}-${i}`} style={{
              background: `${s.color}0D`,
              border: `1px solid ${s.color}30`,
              borderLeft: `3px solid ${s.color}`,
              borderRadius: 10,
              padding: "12px 14px",
              animation: i === visibleIdx.length - 1 ? "slideIn 0.4s ease" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: s.color, fontWeight: 700, letterSpacing: "0.08em" }}>{s.label}</span>
                <span style={{
                  fontSize: 8, color: s.color, border: `1px solid ${s.color}40`,
                  padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em",
                }}>{s.badge}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{s.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Pricing card ─────────────────────────────────────────────────────────────
const PlanCard = ({ name, price, period, color, features, cta, highlight, badge }) => (
  <div style={{
    background: highlight ? `${color}08` : C.bg2,
    border: `1px solid ${highlight ? color : C.border}`,
    borderRadius: 14,
    padding: "24px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    position: "relative",
    transition: "transform 0.2s",
  }}>
    {badge && (
      <div style={{
        position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
        background: color, color: "#000", fontSize: 9, fontWeight: 800,
        padding: "3px 14px", borderRadius: 20, letterSpacing: "0.08em",
      }}>{badge}</div>
    )}
    <div style={{ fontSize: 10, color, letterSpacing: "0.12em", marginBottom: 6 }}>{name}</div>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
      <span style={{ fontSize: 32, fontWeight: 800, color: C.text }}>{price}</span>
      {period && <span style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>/ {period}</span>}
    </div>
    <div style={{ height: 1, background: C.border, margin: "14px 0" }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, flex: 1 }}>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: f.dim ? C.dim : C.muted }}>
          <span style={{ color: f.dim ? C.dim : color, marginTop: 1 }}>{f.dim ? "○" : "◆"}</span>
          {f.text}
        </div>
      ))}
    </div>
    <button style={{
      width: "100%", padding: "12px", borderRadius: 10,
      background: highlight ? color : "transparent",
      border: `1px solid ${highlight ? color : C.border}`,
      color: highlight ? "#000" : C.muted,
      fontWeight: 700, fontSize: 12, cursor: "pointer",
      fontFamily: mono, letterSpacing: "0.05em",
    }}>{cta}</button>
  </div>
);

// ─── Agent row ────────────────────────────────────────────────────────────────
const AgentRow = ({ icon, color, name, desc }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
    borderBottom: `1px solid ${C.border}`,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, background: `${color}15`,
      border: `1px solid ${color}30`, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 16, color, flexShrink: 0,
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
    </div>
  </div>
);

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel = ({ text }) => (
  <div style={{
    fontSize: 9, letterSpacing: "0.2em", color: C.muted, textTransform: "uppercase",
    display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
  }}>
    <span style={{ display: "block", height: 1, width: 32, background: C.border }} />
    {text}
    <span style={{ display: "block", height: 1, width: 32, background: C.border }} />
  </div>
);

// ─── Nav ──────────────────────────────────────────────────────────────────────
const Nav = ({ onCTA }) => (
  <nav style={{
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
    background: "rgba(8,8,16,0.85)", backdropFilter: "blur(16px)",
    borderBottom: `1px solid ${C.border}`,
    padding: "0 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between", height: 54,
    maxWidth: "100%",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", color: C.text }}>ASENTINEL</span>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={onCTA} style={{
        background: "none", border: `1px solid ${C.border}`, color: C.muted,
        padding: "6px 14px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: mono,
      }}>Log in</button>
      <button onClick={onCTA} style={{
        background: C.gold, border: "none", color: "#000",
        padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: mono,
      }}>Get access →</button>
    </div>
  </nav>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const pricingRef = useRef(null);

  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSignup = () => {
    if (email.includes("@")) {
      setSubmitted(true);
    }
  };

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: mono, minHeight: "100vh" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { outline: none; border-color: rgba(0,255,178,0.5) !important; }
        button:hover { opacity: 0.88; }
      `}</style>

      <Nav onCTA={scrollToPricing} />

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "100px 24px 60px", textAlign: "center",
      }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: C.green, marginBottom: 20, animation: "fadeUp 0.6s ease" }}>
          14-DAY FREE TRIAL · NO CARD REQUIRED
        </div>
        <h1 style={{
          fontSize: "clamp(32px, 7vw, 64px)", fontWeight: 900,
          lineHeight: 1.08, letterSpacing: "-0.02em",
          color: C.text, marginBottom: 10, maxWidth: 700,
          animation: "fadeUp 0.7s ease",
        }}>
          Seven AI agents.<br />
          <span style={{ color: C.green }}>One command center.</span>
        </h1>
        <p style={{
          fontSize: 15, color: C.muted, maxWidth: 480, lineHeight: 1.7,
          marginBottom: 36, animation: "fadeUp 0.8s ease",
        }}>
          Seven specialist agents. One anonymous command center. Built for traders who want an edge the market can't see coming.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 60, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.9s ease" }}>
          <button onClick={scrollToPricing} style={{
            background: C.gold, border: "none", color: "#000", fontWeight: 800,
            padding: "14px 28px", borderRadius: 10, fontSize: 13, cursor: "pointer",
            fontFamily: mono, letterSpacing: "0.04em",
          }}>Start 14-day free trial →</button>
          <button onClick={scrollToPricing} style={{
            background: "none", border: `1px solid ${C.border}`, color: C.muted,
            padding: "14px 22px", borderRadius: 10, fontSize: 12, cursor: "pointer",
            fontFamily: mono,
          }}>See pricing</button>
        </div>

        <div style={{ animation: "fadeUp 1s ease", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <LiveFeed />
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 14, letterSpacing: "0.1em" }}>
            LIVE DESK · PATTERN DETECTION · REGIME ALERTS
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

      {/* ── AGENTS ── */}
      <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <SectionLabel text="THE AGENTS" />
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Not one AI. <span style={{ color: C.green }}>Seven specialists.</span>
          </h2>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          {[
            { icon: "◈", color: C.green, name: "Oracle", desc: "Market analysis, bias, key levels, trade thesis" },
            { icon: "⊕", color: "#FF6B35", name: "Sniper", desc: "Precise entry, SL, TP, and invalidation levels" },
            { icon: "⬡", color: C.purple, name: "Shrink", desc: "Trading psychology, mindset, discipline frameworks" },
            { icon: "◎", color: C.gold, name: "Autopsy", desc: "Post-mortem trade review, mistake pattern analysis" },
            { icon: "∑", color: C.blue, name: "Quant", desc: "Win rate, expectancy, Kelly criterion, edge math" },
            { icon: "⚠", color: C.red, name: "Risk Manager", desc: "Position sizing, max loss, exposure control" },
            { icon: "⚡", color: "#FBBF24", name: "News Scanner", desc: "Live macro news with trade implications, web-powered" },
          ].map((a) => <AgentRow key={a.name} {...a} />)}
        </div>
      </section>

      {/* ── DESK FEATURE ── */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
      <section style={{ padding: "80px 24px", maxWidth: 700, margin: "0 auto" }}>
        <SectionLabel text="LIVE DESK" />
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {[
            {
              label: "POSITION MONITORING",
              title: "One trade. Everything watching it.",
              body: "Log a position and Asentinel watches it in real time. Regime shifts, behavioral flags, invalidation checks — surfaced before you make the mistake.",
              color: C.gold,
            },
            {
              label: "PATTERN DETECTION",
              title: "It knows when you're repeating yourself.",
              body: "Sized up after a loss? Re-entered 8 minutes after your stop? The desk catches the pattern before you compound it.",
              color: C.red,
            },
            {
              label: "SCORECARD",
              title: "A report card on your edge.",
              body: "After every closed trade: Readiness, Discipline, Edge, Risk, and Momentum scores — computed from your actual log, not a vibe.",
              color: C.green,
            },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.12em", color: f.color }}>{f.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 500 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
      <section ref={pricingRef} style={{ padding: "80px 24px", maxWidth: 740, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <SectionLabel text="PRICING" />
          <h2 style={{ fontSize: 26, fontWeight: 800 }}>
            Pay for <span style={{ color: C.gold }}>edge</span>, not features.
          </h2>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>Cancel anytime. No contracts.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          <PlanCard
            name="FREE" price="$0" color={C.dim}
            features={[
              { text: "3 agent messages / day" },
              { text: "Oracle + Shrink only" },
              { text: "No Desk access", dim: true },
              { text: "No memory", dim: true },
            ]}
            cta="Start free trial"
          />
          <PlanCard
            name="PRO" price="$29" period="mo" color={C.green} highlight badge="MOST POPULAR"
            features={[
              { text: "Unlimited agent messages" },
              { text: "All 7 agents" },
              { text: "Live Desk + pattern detection" },
              { text: "Session memory" },
              { text: "Live prices + News Scanner" },
            ]}
            cta="Get Pro →"
          />
          <PlanCard
            name="ELITE" price="$79" period="mo" color={C.gold}
            features={[
              { text: "Everything in Pro" },
              { text: "Telegram bot access" },
              { text: "Priority AI responses" },
              { text: "Weekly AI trade review" },
              { text: "Early access to new agents" },
            ]}
            cta="Go Elite →"
          />
        </div>
      </section>

      {/* ── EMAIL CAPTURE ── */}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
      <section style={{ padding: "80px 24px", textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
        <div style={{ fontSize: 9, color: C.green, letterSpacing: "0.16em", marginBottom: 14 }}>EARLY ACCESS</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
          Be first in.<br /><span style={{ color: C.green }}>Get 14 days full access. Free.</span>
        </h2>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 24, lineHeight: 1.7 }}>
          Join the waitlist. First 100 traders get instant full access — no card required.
        </p>
        {submitted ? (
          <div style={{
            background: `${C.green}12`, border: `1px solid ${C.green}40`,
            borderRadius: 10, padding: "16px", fontSize: 13, color: C.green,
          }}>
            ◆ You're in. We'll reach out soon.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              placeholder="your@email.com"
              type="email"
              style={{
                flex: 1, minWidth: 200, padding: "12px 14px",
                background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 10, color: C.text, fontSize: 13, fontFamily: mono,
              }}
            />
            <button onClick={handleSignup} style={{
              padding: "12px 20px", background: C.gold, border: "none",
              borderRadius: 10, color: "#000", fontWeight: 800, fontSize: 12,
              cursor: "pointer", fontFamily: mono, letterSpacing: "0.04em",
            }}>Join waitlist →</button>
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: "24px", borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em" }}>ASENTINEL</span>
        </div>
        <div style={{ fontSize: 10, color: C.dim }}>
          {["Privacy", "Terms", "Support"].map((l, i) => (
            <span key={i} style={{ marginLeft: i > 0 ? 16 : 0, cursor: "pointer" }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.dim }}>© 2026 Asentinel · By Anonymous</div>
      </footer>
    </div>
  );
}
