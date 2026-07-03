import { useState, useRef, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
// ASENTINEL DESK COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function computeUnrealized(pos) {
  const dir = pos.direction === "long" ? 1 : -1;
  const pct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * dir;
  const usd = pos.size * pct;
  return { pct: pct * 100, usd };
}

function detectPatterns(tradeLog) {
  const flags = [];
  if (tradeLog.length < 2) return flags;
  let sizeUpAfterLossStreak = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    const prev = tradeLog[i - 1];
    const cur = tradeLog[i];
    if (prev.result === "loss" && cur.size > prev.size) sizeUpAfterLossStreak++;
  }
  if (sizeUpAfterLossStreak >= 2) {
    flags.push({ type: "behavior", title: "You're repeating a mistake", detail: `You sized up after a loss ${sizeUpAfterLossStreak} times recently.` });
  }
  let revengeCount = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    const prev = tradeLog[i - 1];
    const cur = tradeLog[i];
    if (prev.result === "loss" && prev.symbol === cur.symbol && cur.openedAt - prev.closedAt < 10 * 60 * 1000) revengeCount++;
  }
  if (revengeCount >= 2) {
    flags.push({ type: "behavior", title: "Revenge trading pattern", detail: `You re-entered the same symbol within 10 minutes of a loss ${revengeCount} times.` });
  }
  const last3 = tradeLog.slice(-3);
  if (last3.length === 3 && last3.every((t) => t.result === "loss")) {
    flags.push({ type: "behavior", title: "3 losses in a row", detail: "Consider stepping away or cutting size before the next entry." });
  }
  return flags;
}

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
  const sizeUpCount = (set) => { let c = 0; for (let i = 1; i < set.length; i++) { if (set[i-1].result === "loss" && set[i].size > set[i-1].size) c++; } return c; };
  const edgeScore = Math.round(winRate(recent) * 100);
  const edgeScorePrev = Math.round(winRate(prevWindow) * 100);
  const disciplineScore = Math.max(0, 100 - sizeUpCount(recent) * 15);
  const disciplinePrev = Math.max(0, 100 - sizeUpCount(prevWindow) * 15);
  const riskScore = Math.max(0, Math.min(100, 50 + avgPnl(recent) / 5));
  const riskPrev = Math.max(0, Math.min(100, 50 + avgPnl(prevWindow) / 5));
  const momentumScore = Math.round(winRate(tradeLog.slice(-5)) * 100);
  const readinessScore = Math.round((disciplineScore + edgeScore) / 2);
  return [
    { label: "Readiness", score: readinessScore, delta: readinessScore - Math.round((disciplinePrev + edgeScorePrev) / 2) },
    { label: "Discipline", score: disciplineScore, delta: disciplineScore - disciplinePrev },
    { label: "Edge", score: edgeScore, delta: edgeScore - edgeScorePrev },
    { label: "Risk", score: Math.round(riskScore), delta: Math.round(riskScore - riskPrev) },
    { label: "Momentum", score: momentumScore, delta: 0 },
  ];
}

export const SignalCard = ({ label, title, detail, action, onAction, color }) => (
  <div style={{ background: `${color}10`, border: `1px solid ${color}35`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: "0.08em" }}>{label}</span>
      {action && <button onClick={onAction} style={{ background: "none", border: `1px solid ${color}40`, color, fontSize: 9, padding: "3px 9px", borderRadius: 6, cursor: "pointer" }}>{action}</button>}
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#E8E8E8", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{detail}</div>
  </div>
);

export const AddPositionForm = ({ onAdd, onCancel, accent }) => {
  const [symbol, setSymbol] = useState("BTC/USD");
  const [direction, setDirection] = useState("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [thesis, setThesis] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const submit = () => {
    if (!entryPrice || !size) return;
    onAdd({ id: Date.now().toString(), symbol, direction, entryPrice: parseFloat(entryPrice), currentPrice: parseFloat(entryPrice), size: parseFloat(size), leverage: parseFloat(leverage) || 1, thesis, invalidation, openedAt: Date.now(), tags: [] });
  };
  const inp = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 11px", color: "#E8E8E8", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 10 };
  const lbl = { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  return (
    <div style={{ padding: "16px 18px 24px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 14 }}>+ NEW POSITION</div>
      <label style={lbl}>SYMBOL</label>
      <input style={inp} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
      <label style={lbl}>DIRECTION</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["long", "short"].map((d) => (
          <button key={d} onClick={() => setDirection(d)} style={{ flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, background: direction === d ? (d === "long" ? "#00FFB220" : "#EF444420") : "rgba(255,255,255,0.04)", border: `1px solid ${direction === d ? (d === "long" ? "#00FFB2" : "#EF4444") : "rgba(255,255,255,0.1)"}`, color: direction === d ? (d === "long" ? "#00FFB2" : "#EF4444") : "rgba(255,255,255,0.4)" }}>{d.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><label style={lbl}>ENTRY PRICE</label><input style={inp} type="number" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>LEVERAGE</label><input style={inp} type="number" value={leverage} onChange={(e) => setLeverage(e.target.value)} /></div>
      </div>
      <label style={lbl}>SIZE (USD)</label><input style={inp} type="number" value={size} onChange={(e) => setSize(e.target.value)} />
      <label style={lbl}>WHY YOU ENTERED</label><input style={inp} value={thesis} onChange={(e) => setThesis(e.target.value)} placeholder="Break of 4H resistance" />
      <label style={lbl}>INVALIDATION LEVEL</label><input style={inp} value={invalidation} onChange={(e) => setInvalidation(e.target.value)} placeholder="Close below 42100" />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 8, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer" }}>CANCEL</button>
        <button onClick={submit} style={{ flex: 2, padding: "11px", borderRadius: 8, background: accent, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>OPEN POSITION</button>
      </div>
    </div>
  );
};

export const PlanCheckModal = ({ position, patternFlag, onClose }) => {
  const { pct, usd } = computeUnrealized(position);
  const up = usd >= 0;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", zIndex: 200 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#0D0D14", width: "100%", maxWidth: 700, margin: "0 auto", borderRadius: "18px 18px 0 0", padding: "18px 18px 28px", maxHeight: "85vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>CHECK YOUR PLAN</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        {patternFlag && (
          <div style={{ background: "#FBBF2412", border: "1px solid #FBBF2440", borderLeft: "3px solid #FBBF24", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "#FBBF24", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>● PATTERN DETECTED</div>
            <div style={{ fontSize: 13, color: "#E8E8E8", fontStyle: "italic" }}>"{patternFlag.detail}"</div>
          </div>
        )}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 6 }}>◎ WHY YOU ENTERED</div>
          <div style={{ fontSize: 13, color: "#E8E8E8" }}>{position.thesis || "No thesis recorded"}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 6 }}>⊘ INVALIDATION</div>
          <div style={{ fontSize: 13, color: "#E8E8E8", marginBottom: 10 }}>{position.invalidation || "Not set"}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Has this level been hit? If yes, consider exiting per your original plan.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{position.symbol} · {position.direction.toUpperCase()}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: up ? "#00FFB2" : "#EF4444" }}>{up ? "+" : ""}{usd.toFixed(0)} ({up ? "+" : ""}{pct.toFixed(2)}%)</span>
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#E8E8E8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>GOT IT</button>
      </div>
    </div>
  );
};

const ScoreGauge = ({ label, score, delta }) => {
  const color = score >= 60 ? "#00FFB2" : "#EF4444";
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ marginTop: -28, fontSize: 12, fontWeight: 700, color: "#E8E8E8" }}>{score}</div>
      <div style={{ marginTop: 14, fontSize: 9, color, letterSpacing: "0.02em" }}>{delta >= 0 ? "+" : ""}{delta} pts</div>
      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{label.toUpperCase()}</div>
    </div>
  );
};

export const ReportScreen = ({ tradeLog, onBack }) => {
  const [period, setPeriod] = useState("monthly");
  const wins = tradeLog.filter((t) => t.result === "win").length;
  const losses = tradeLog.filter((t) => t.result === "loss").length;
  const totalPnl = tradeLog.reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = tradeLog.length ? Math.round((wins / tradeLog.length) * 100) : 0;
  const scores = computeScores(tradeLog);
  return (
    <div style={{ padding: "16px 18px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 14px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>← Back</button>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}>REPORT</span>
        <span style={{ width: 40 }} />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["daily", "weekly", "monthly"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer", fontSize: 10, fontWeight: 700, background: period === p ? "#FBBF24" : "rgba(255,255,255,0.04)", border: `1px solid ${period === p ? "#FBBF24" : "rgba(255,255,255,0.08)"}`, color: period === p ? "#000" : "rgba(255,255,255,0.4)" }}>{p.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 16px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>{period.toUpperCase()} P&L</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: totalPnl >= 0 ? "#00FFB2" : "#EF4444", margin: "6px 0" }}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(0)}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{tradeLog.length} Trades</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {[[`${wins}W/${losses}L`, "Trades"], [`${winRate}%`, "Win Rate"], ["—", "Fees"]].map(([val, label], i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 4px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: i === 1 ? "#FBBF24" : "#E8E8E8" }}>{val}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 10px", display: "flex", justifyContent: "space-around" }}>
        {scores.map((s, i) => <ScoreGauge key={i} {...s} />)}
      </div>
    </div>
  );
};

export const DeskView = ({ positions, setPositions, tradeLog, setTradeLog }) => {
  const [screen, setScreen] = useState("feed");
  const [selectedId, setSelectedId] = useState(null);
  const [showPlanCheck, setShowPlanCheck] = useState(false);
  const selected = positions.find((p) => p.id === selectedId);
  const flags = detectPatterns(tradeLog);

  const addPosition = (pos) => { setPositions((prev) => [pos, ...prev]); setScreen("feed"); };
  const closePosition = (pos) => {
    const { usd } = computeUnrealized(pos);
    setTradeLog((prev) => [...prev, { ...pos, result: usd >= 0 ? "win" : "loss", pnl: usd, closedAt: Date.now() }]);
    setPositions((prev) => prev.filter((p) => p.id !== pos.id));
    setScreen("feed"); setSelectedId(null);
  };

  if (screen === "add") return <AddPositionForm onAdd={addPosition} onCancel={() => setScreen("feed")} accent="#FBBF24" />;
  if (screen === "report") return <ReportScreen tradeLog={tradeLog} onBack={() => setScreen("feed")} />;

  if (screen === "detail" && selected) {
    const { pct, usd } = computeUnrealized(selected);
    const up = usd >= 0;
    const ageMin = Math.round((Date.now() - selected.openedAt) / 60000);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px" }}>
          <button onClick={() => { setScreen("feed"); setSelectedId(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>← Back</button>
          <span style={{ fontSize: 10, color: "#00FFB2", letterSpacing: "0.08em" }}>● LIVE</span>
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 4 }}>OPEN POSITION · {selected.symbol}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}><span style={{ color: selected.direction === "long" ? "#00FFB2" : "#EF4444" }}>{selected.leverage}× {selected.direction.toUpperCase()}</span> · {ageMin}m</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Entry ${selected.entryPrice.toLocaleString()} · Size ${selected.size.toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: up ? "#00FFB2" : "#EF4444" }}>{up ? "+" : ""}${usd.toFixed(0)}</div>
          </div>
          <SignalCard color="#FBBF24" label="● REGIME SHIFT" title='"The market this trade was made for is gone."' detail="Conditions have shifted since entry. Review your exit, size, and target." />
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: 10 }}>WHAT CHANGED · SINCE ENTRY</div>
            {[["Price moves", "calm → wild"], ["Buyers nearby", "thinning"], ["Direction", "losing steam"]].map(([label, val], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ color: "#FBBF24" }}>{val}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowPlanCheck(true)} style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#FBBF24", border: "none", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>◎ CHECK YOUR PLAN</button>
          <button onClick={() => closePosition(selected)} style={{ width: "100%", padding: "11px", borderRadius: 10, background: "none", marginTop: 8, border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>CLOSE POSITION</button>
        </div>
        {showPlanCheck && <PlanCheckModal position={selected} patternFlag={flags[0]} onClose={() => setShowPlanCheck(false)} />}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 18px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, color: "#FBBF24", letterSpacing: "0.1em", marginBottom: 2 }}>● LIVE · {positions.length + flags.length} SIGNALS</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Your desk{positions.length || flags.length ? " flagged something." : " is quiet."}</div>
        </div>
        <button onClick={() => setScreen("report")} styl