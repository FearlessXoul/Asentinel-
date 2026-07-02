import { useState, useRef, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
// AGENT MODES
// ════════════════════════════════════════════════════════════════════════════
const MODES = [
  {
    id: "oracle", label: "Oracle", icon: "◈", color: "#00FFB2",
    desc: "Market analysis & trade thesis",
    system: `You are Oracle, an elite market analyst and trading strategist. Analyze markets across Forex, Crypto, Stocks, Options, and Futures with precision. Be direct, specific, actionable. When analyzing setups: identify key levels, confluences, bias, and risk. Format with structure: Bias / Key Levels / Confluences / Trade Plan / Risk. If asked about current prices or live market data, use your web search tool.`,
    tools: true,
  },
  {
    id: "sniper", label: "Sniper", icon: "⊕", color: "#FF6B35",
    desc: "Entry, SL & TP precision",
    system: `You are Sniper, a precision trade execution specialist. Find the exact entry, stop loss, and take profit for any trade idea. Output: Entry Zone / Stop Loss / TP1 / TP2 / TP3 / Risk-Reward / Invalidation. Be ruthlessly precise. Use web search for live prices if needed.`,
    tools: true,
  },
  {
    id: "shrink", label: "Shrink", icon: "⬡", color: "#A78BFA",
    desc: "Trading psychology & mindset",
    system: `You are Shrink, a trading psychologist. You understand FOMO, revenge trading, overconfidence, fear, analysis paralysis. Help traders identify mental blocks, build discipline, develop a winning mindset. Be empathetic but direct. Give actionable mental frameworks and protocols.`,
    tools: false,
  },
  {
    id: "autopsy", label: "Autopsy", icon: "◎", color: "#F59E0B",
    desc: "Trade review & mistake analysis",
    system: `You are Autopsy, a ruthless trade post-mortem analyst. Dissect trades — wins and losses — to extract lessons. Output: What went right / What went wrong / Root cause / Pattern / What to do differently. Be clinical. Find the truth.`,
    tools: false,
  },
  {
    id: "quant", label: "Quant", icon: "∑", color: "#38BDF8",
    desc: "Stats, edge & backtesting logic",
    system: `You are Quant, a quantitative trading analyst. Help with: win rate math, expectancy, position sizing (Kelly, fixed fractional), backtesting logic, strategy robustness. Be precise with numbers. Use formulas when needed.`,
    tools: false,
  },
  {
    id: "risk", label: "Risk Mgr", icon: "⚠", color: "#EF4444",
    desc: "Position sizing & exposure control",
    system: `You are Risk Manager, a professional trading risk officer. Help traders size positions correctly, set max daily loss limits, manage portfolio exposure. Always ask for: account size, risk per trade %, current open exposure. Output: Position Size / Max Loss / Exposure / R-Multiple / Verdict. Capital preservation is the #1 job.`,
    tools: false,
  },
  {
    id: "news", label: "News", icon: "⚡", color: "#FBBF24",
    desc: "Live macro & market news scanner",
    system: `You are News Scanner, a macro and market intelligence agent. Use web search to find current information. When reporting news: headline, market impact (bullish/bearish/neutral for which asset), and one-line trade implication. Prioritize: central bank decisions, economic data, geopolitical events, major earnings, crypto regulatory news. Always search before answering.`,
    tools: true,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS
// ════════════════════════════════════════════════════════════════════════════
async function saveData(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch (e) {}
}
async function loadData(key, fallback) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch (e) { return fallback; }
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ════════════════════════════════════════════════════════════════════════════
const TypingDots = ({ color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 14px" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: "50%", background: color,
        animation: `gdBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
      }} />
    ))}
  </div>
);

const Message = ({ msg, accentColor }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div style={{
        maxWidth: "84%", padding: "10px 14px",
        borderRadius: isUser ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
        background: isUser ? accentColor : "rgba(255,255,255,0.05)",
        color: isUser ? "#000" : "#E8E8E8",
        fontSize: 13.5, lineHeight: 1.65,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {msg.content}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DESK: helper math
// ════════════════════════════════════════════════════════════════════════════
function computeUnrealized(pos) {
  const dir = pos.direction === "long" ? 1 : -1;
  const pct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * dir;
  const usd = pos.size * pct;
  return { pct: pct * 100, usd };
}

// Local heuristic pattern detector — flags behavioral issues from trade log
function detectPatterns(tradeLog) {
  const flags = [];
  if (tradeLog.length < 2) return flags;

  // Sizing up after a loss
  let sizeUpAfterLossStreak = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    const prev = tradeLog[i - 1];
    const cur = tradeLog[i];
    if (prev.result === "loss" && cur.size > prev.size) sizeUpAfterLossStreak++;
  }
  if (sizeUpAfterLossStreak >= 2) {
    flags.push({
      type: "behavior",
      title: "You're repeating a mistake",
      detail: `You sized up after a loss ${sizeUpAfterLossStreak} times recently. Each one risks compounding the drawdown.`,
    });
  }

  // Revenge trading: re-entering same symbol within 10 min of a loss
  let revengeCount = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    const prev = tradeLog[i - 1];
    const cur = tradeLog[i];
    if (prev.result === "loss" && prev.symbol === cur.symbol && cur.openedAt - prev.closedAt < 10 * 60 * 1000) {
      revengeCount++;
    }
  }
  if (revengeCount >= 2) {
    flags.push({
      type: "behavior",
      title: "Revenge trading pattern",
      detail: `You re-entered the same symbol within 10 minutes of a loss ${revengeCount} times. This usually means the entry wasn't planned.`,
    });
  }

  // Losing streak
  const last3 = tradeLog.slice(-3);
  if (last3.length === 3 && last3.every((t) => t.result === "loss")) {
    flags.push({
      type: "behavior",
      title: "3 losses in a row",
      detail: "Your last 3 trades all lost. Consider stepping away or cutting size before the next entry.",
    });
  }

  return flags;
}

// Compute 0-100 scores from real trade log data
function computeScores(tradeLog) {
  if (tradeLog.length === 0) {
    return [
      { label: "Readiness", score: 50, delta: 0 },
      { label: "Discipline", score: 50, delta: 0 },
      { label: "Edge", score: 50, delta: 0 },
      { label: "Risk", score: 50, delta: 0 },
      { label: "Momentum", score: 50, delta: 0 },
    ];
  }

  const recent = tradeLog.slice(-20);
  const prevWindow = tradeLog.slice(-40, -20);

  const winRate = (set) => set.length ? set.filter((t) => t.result === "win").length / set.length : 0.5;
  const avgPnl = (set) => set.length ? set.reduce((s, t) => s + (t.pnl || 0), 0) / set.length : 0;
  const sizeUpAfterLossCount = (set) => {
    let c = 0;
    for (let i = 1; i < set.length; i++) {
      if (set[i - 1].result === "loss" && set[i].size > set[i - 1].size) c++;
    }
    return c;
  };

  const edgeScore = Math.round(winRate(recent) * 100);
  const edgeScorePrev = Math.round(winRate(prevWindow) * 100);

  const disciplineScore = Math.max(0, 100 - sizeUpAfterLossCount(recent) * 15);
  const disciplinePrev = Math.max(0, 100 - sizeUpAfterLossCount(prevWindow) * 15);

  const expectancy = avgPnl(recent);
  const riskScore = Math.max(0, Math.min(100, 50 + expectancy / 5));
  const riskPrev = Math.max(0, Math.min(100, 50 + avgPnl(prevWindow) / 5));

  const last5 = tradeLog.slice(-5);
  const momentumScore = Math.round(winRate(last5) * 100);

  const readinessScore = Math.round((disciplineScore + edgeScore) / 2);

  return [
    { label: "Readiness", score: readinessScore, delta: readinessScore - Math.round((disciplinePrev + edgeScorePrev) / 2) },
    { label: "Discipline", score: disciplineScore, delta: disciplineScore - disciplinePrev },
    { label: "Edge", score: edgeScore, delta: edgeScore - edgeScorePrev },
    { label: "Risk", score: Math.round(riskScore), delta: Math.round(riskScore - riskPrev) },
    { label: "Momentum", score: momentumScore, delta: 0 },
  ];
}

// ════════════════════════════════════════════════════════════════════════════
// DESK: Position Card (feed item)
// ════════════════════════════════════════════════════════════════════════════
const SignalCard = ({ kind, label, title, detail, action, onAction, color }) => (
  <div style={{
    background: `${color}10`,
    border: `1px solid ${color}35`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 10,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 9, letterSpacing: "0.1em", color, fontWeight: 700 }}>{label}</span>
      {action && (
        <button onClick={onAction} style={{
          background: "none", border: `1px solid ${color}55`, color,
          fontSize: 9, padding: "3px 9px", borderRadius: 6, cursor: "pointer", letterSpacing: "0.06em",
        }}>{action}</button>
      )}
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: "#E8E8E8", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{detail}</div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// DESK: Add Position Form
// ════════════════════════════════════════════════════════════════════════════
const AddPositionForm = ({ onAdd, onCancel, accent }) => {
  const [symbol, setSymbol] = useState("BTC/USD");
  const [direction, setDirection] = useState("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [thesis, setThesis] = useState("");
  const [invalidation, setInvalidation] = useState("");

  const submit = () => {
    if (!entryPrice || !size) return;
    onAdd({
      id: Date.now().toString(),
      symbol, direction,
      entryPrice: parseFloat(entryPrice),
      currentPrice: parseFloat(entryPrice),
      size: parseFloat(size),
      leverage: parseFloat(leverage) || 1,
      thesis, invalidation,
      openedAt: Date.now(),
      tags: [],
    });
  };

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    padding: "9px 11px", color: "#E8E8E8", fontSize: 13,
    fontFamily: "inherit", outline: "none", marginBottom: 10,
  };
  const labelStyle = { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginBottom: 5, display: "block" };

  return (
    <div style={{ padding: "16px 18px", animation: "gdFade 0.2s ease" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 14, letterSpacing: "0.05em" }}>
        + NEW POSITION
      </div>
      <label style={labelStyle}>SYMBOL</label>
      <input style={inputStyle} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="BTC/USD" />

      <label style={labelStyle}>DIRECTION</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["long", "short"].map((d) => (
          <button key={d} onClick={() => setDirection(d)} style={{
            flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer",
            fontSize: 12, letterSpacing: "0.06em", fontWeight: 700,
            background: direction === d ? (d === "long" ? "#00FFB220" : "#EF444420") : "rgba(255,255,255,0.04)",
            border: `1px solid ${direction === d ? (d === "long" ? "#00FFB2" : "#EF4444") : "rgba(255,255,255,0.1)"}`,
            color: direction === d ? (d === "long" ? "#00FFB2" : "#EF4444") : "rgba(255,255,255,0.4)",
          }}>{d.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>ENTRY PRICE</label>
          <input style={inputStyle} type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="79520" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>LEVERAGE</label>
          <input style={inputStyle} type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} placeholder="10" />
        </div>
      </div>

      <label style={labelStyle}>SIZE (USD)</label>
      <input style={inputStyle} type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="16940" />

      <label style={labelStyle}>WHY YOU ENTERED</label>
      <input style={inputStyle} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Break of 4H resistance, volume confirmed" />

      <label style={labelStyle}>INVALIDATION LEVEL</label>
      <input style={inputStyle} value={invalidation} onChange={(e) => setInvalidation(e.target.value)} placeholder="Close below 42100" />

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "11px", borderRadius: 8, background: "none",
          border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)",
          fontSize: 12, cursor: "pointer", letterSpacing: "0.05em",
        }}>CANCEL</button>
        <button onClick={submit} style={{
          flex: 2, padding: "11px", borderRadius: 8, background: accent,
          border: "none", color: "#000", fontWeight: 700,
          fontSize: 12, cursor: "pointer", letterSpacing: "0.05em",
        }}>OPEN POSITION</button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DESK: Plan Check Modal
// ════════════════════════════════════════════════════════════════════════════
const PlanCheckModal = ({ position, patternFlag, onClose, onUpdatePrice }) => {
  const { pct, usd } = computeUnrealized(position);
  const up = usd >= 0;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", zIndex: 200, animation: "gdFade 0.2s ease",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#0D0D14", width: "100%", maxWidth: 700, margin: "0 auto",
        borderRadius: "18px 18px 0 0", padding: "18px 18px 28px",
        maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>CHECK YOUR PLAN</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        {patternFlag && (
          <div style={{
            background: "#FBBF2412", border: "1px solid #FBBF2440", borderLeft: "3px solid #FBBF24",
            borderRadius: 10, padding: "12px 14px", marginBottom: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#FBBF24", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
              <span>● PATTERN DETECTED</span><span style={{ color: "rgba(255,255,255,0.3)" }}>BEFORE YOU CLICK</span>
            </div>
            <div style={{ fontSize: 13, color: "#E8E8E8", fontStyle: "italic", lineHeight: 1.5 }}>"{patternFlag.detail}"</div>
          </div>
        )}

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 6 }}>◎ WHY YOU ENTERED</div>
          <div style={{ fontSize: 13, color: "#E8E8E8", lineHeight: 1.5 }}>{position.thesis || "No thesis recorded"}</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 6 }}>⊘ INVALIDATION LEVEL</div>
          <div style={{ fontSize: 13, color: "#E8E8E8", lineHeight: 1.5, marginBottom: 10 }}>{position.invalidation || "Not set"}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            Has this level been hit? If yes, consider exiting per your original plan.
          </div>
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{position.symbol} · {position.direction.toUpperCase()}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: up ? "#00FFB2" : "#EF4444" }}>
            {up ? "+" : ""}{usd.toFixed(0)} ({up ? "+" : ""}{pct.toFixed(2)}%)
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)", color: "#E8E8E8", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>GOT IT</button>
          <button style={{
            flex: 1, padding: "12px", borderRadius: 10, background: "#FBBF24",
            border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>◈ ASK COACH</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DESK: Position Detail (regime shift card)
// ════════════════════════════════════════════════════════════════════════════
const PositionDetail = ({ position, onBack, onClose, onCheckPlan }) => {
  const { pct, usd } = computeUnrealized(position);
  const up = usd >= 0;
  const ageMin = Math.round((Date.now() - position.openedAt) / 60000);

  return (
    <div style={{ animation: "gdFade 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 10, color: "#00FFB2", letterSpacing: "0.08em" }}>● LIVE</span>
      </div>
      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 4 }}>
          OPEN POSITION · {position.symbol}
        </div>
        