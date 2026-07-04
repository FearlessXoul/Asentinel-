import { useState } from "react";

export function computeUnrealized(pos) {
  const dir = pos.direction === "long" ? 1 : -1;
  const pct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * dir;
  const usd = pos.size * pct;
  return { pct: pct * 100, usd };
}

export function detectPatterns(tradeLog) {
  const flags = [];
  if (tradeLog.length < 2) return flags;
  let streak = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    if (tradeLog[i-1].result === "loss" && tradeLog[i].size > tradeLog[i-1].size) streak++;
  }
  if (streak >= 2) flags.push({ type: "behavior", title: "You're repeating a mistake", detail: `You sized up after a loss ${streak} times recently.` });
  let revenge = 0;
  for (let i = 1; i < tradeLog.length; i++) {
    const p = tradeLog[i-1], c = tradeLog[i];
    if (p.result === "loss" && p.symbol === c.symbol && c.openedAt - p.closedAt < 600000) revenge++;
  }
  if (revenge >= 2) flags.push({ type: "behavior", title: "Revenge trading pattern", detail: `Re-entered same symbol within 10min of loss ${revenge} times.` });
  const last3 = tradeLog.slice(-3);
  if (last3.length === 3 && last3.every(t => t.result === "loss")) flags.push({ type: "behavior", title: "3 losses in a row", detail: "Consider stepping away or cutting size." });
  return flags;
}

export function computeScores(tradeLog) {
  if (!tradeLog.length) return [
    { label: "Readiness", score: 50, delta: 0 },
    { label: "Discipline", score: 50, delta: 0 },
    { label: "Edge", score: 50, delta: 0 },
    { label: "Risk", score: 50, delta: 0 },
    { label: "Momentum", score: 50, delta: 0 },
  ];
  const recent = tradeLog.slice(-20);
  const prev = tradeLog.slice(-40, -20);
  const wr = s => s.length ? s.filter(t => t.result === "win").length / s.length : 0.5;
  const apnl = s => s.length ? s.reduce((a, t) => a + (t.pnl || 0), 0) / s.length : 0;
  const sual = s => { let c = 0; for (let i = 1; i < s.length; i++) if (s[i-1].result === "loss" && s[i].size > s[i-1].size) c++; return c; };
  const e = Math.round(wr(recent) * 100), ep = Math.round(wr(prev) * 100);
  const d = Math.max(0, 100 - sual(recent) * 15), dp = Math.max(0, 100 - sual(prev) * 15);
  const r = Math.max(0, Math.min(100, 50 + apnl(recent) / 5)), rp = Math.max(0, Math.min(100, 50 + apnl(prev) / 5));
  const m = Math.round(wr(tradeLog.slice(-5)) * 100);
  const rd = Math.round((d + e) / 2);
  return [
    { label: "Readiness", score: rd, delta: rd - Math.round((dp + ep) / 2) },
    { label: "Discipline", score: d, delta: d - dp },
    { label: "Edge", score: e, delta: e - ep },
    { label: "Risk", score: Math.round(r), delta: Math.round(r - rp) },
    { label: "Momentum", score: m, delta: 0 },
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
      <input style={inp} value={symbol} onChange={e => setSymbol(e.target.value)} />
      <label style={lbl}>DIRECTION</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["long","short"].map(d => (
          <button key={d} onClick={() => setDirection(d)} style={{ flex:1, padding:"9px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700, background: direction===d?(d==="long"?"#00FFB220":"#EF444420"):"rgba(255,255,255,0.04)", border:`1px solid ${direction===d?(d==="long"?"#00FFB2":"#EF4444"):"rgba(255,255,255,0.1)"}`, color: direction===d?(d==="long"?"#00FFB2":"#EF4444"):"rgba(255,255,255,0.4)" }}>{d.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{flex:1}}><label style={lbl}>ENTRY PRICE</label><input style={inp} type="number" value={entryPrice} onChange={e=>setEntryPrice(e.target.value)} /></div>
        <div style={{flex:1}}><label style={lbl}>LEVERAGE</label><input style={inp} type="number" value={leverage} onChange={e=>setLeverage(e.target.value)} /></div>
      </div>
      <label style={lbl}>SIZE (USD)</label><input style={inp} type="number" value={size} onChange={e=>setSize(e.target.value)} />
      <label style={lbl}>WHY YOU ENTERED</label><input style={inp} value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="Break of 4H resistance" />
      <label style={lbl}>INVALIDATION</label><input style={inp} value={invalidation} onChange={e=>setInvalidation(e.target.value)} placeholder="Close below 42100" />
      <div style={{ display:"flex", gap:8, marginTop:6 }}>
        <button onClick={onCancel} style={{ flex:1, padding:"11px", borderRadius:8, background:"none", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.4)", fontSize:12, cursor:"pointer" }}>CANCEL</button>
        <button onClick={submit} style={{ flex:2, padding:"11px", borderRadius:8, background:accent, border:"none", color:"#000", fontWeight:700, fontSize:12, cursor:"pointer" }}>OPEN POSITION</button>
      </div>
    </div>
  );
};

export const PlanCheckModal = ({ position, patternFlag, onClose }) => {
  const { pct, usd } = computeUnrealized(position);
  const up = usd >= 0;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", zIndex:200 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#0D0D14", width:"100%", maxWidth:700, margin:"0 auto", borderRadius:"18px 18px 0 0", padding:"18px 18px 28px", maxHeight:"85vh", overflowY:"auto", border:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontSize:14, fontWeight:700 }}>CHECK YOUR PLAN</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:18, cursor:"pointer" }}>x</button>
        </div>
        {patternFlag && (
          <div style={{ background:"#FBBF2412", border:"1px solid #FBBF2440", borderLeft:"3px solid #FBBF24", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:9, color:"#FBBF24", fontWeight:700, marginBottom:6 }}>PATTERN DETECTED</div>
            <div style={{ fontSize:13, color:"#E8E8E8", fontStyle:"italic" }}>"{patternFlag.detail}"</div>
          </div>
        )}
        <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>WHY YOU ENTERED</div>
          <div style={{ fontSize:13, color:"#E8E8E8" }}>{position.thesis || "No thesis recorded"}</div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>INVALIDATION</div>
          <div style={{ fontSize:13, color:"#E8E8E8", marginBottom:10 }}>{position.invalidation || "Not set"}</div>
          <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"9px 12px", fontSize:12, color:"rgba(255,255,255,0.5)" }}>Has this level been hit? If yes, exit per your original plan.</div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:10, marginBottom:16 }}>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>{position.symbol} {position.direction.toUpperCase()}</span>
          <span style={{ fontSize:14, fontWeight:700, color:up?"#00FFB2":"#EF4444" }}>{up?"+":""}{usd.toFixed(0)} ({up?"+":""}{pct.toFixed(2)}%)</span>
        </div>
        <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:10, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#E8E8E8", fontSize:12, fontWeight:700, cursor:"pointer" }}>GOT IT</button>
      </div>
    </div>
  );
};
     
