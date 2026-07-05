import { useState } from "react";
import { computeUnrealized, computeScores, detectPatterns, SignalCard, AddPositionForm, PlanCheckModal } from "./asentinel-desk1";

const ScoreGauge = ({ label, score, delta }) => {
  const color = score >= 60 ? "#00FFB2" : "#EF4444";
  const c = 2 * Math.PI * 16;
  const offset = c - (score / 100) * c;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width="40" height="40" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div style={{ marginTop:-28, fontSize:12, fontWeight:700, color:"#E8E8E8" }}>{score}</div>
      <div style={{ marginTop:14, fontSize:9, color, letterSpacing:"0.02em" }}>{delta>=0?"+":""}{delta} pts</div>
      <div style={{ fontSize:8, color:"rgba(255,255,255,0.35)", textAlign:"center" }}>{label.toUpperCase()}</div>
    </div>
  );
};

export const ReportScreen = ({ tradeLog, onBack }) => {
  const [period, setPeriod] = useState("monthly");
  const wins = tradeLog.filter(t => t.result === "win").length;
  const losses = tradeLog.filter(t => t.result === "loss").length;
  const totalPnl = tradeLog.reduce((s, t) => s + (t.pnl || 0), 0);
  const winRate = tradeLog.length ? Math.round((wins / tradeLog.length) * 100) : 0;
  const scores = computeScores(tradeLog);
  return (
    <div style={{ padding:"16px 18px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer" }}>Back</button>
        <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.06em" }}>REPORT</span>
        <span style={{ width:40 }} />
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {["daily","weekly","monthly"].map(p => (
          <button key={p} onClick={()=>setPeriod(p)} style={{ flex:1, padding:"8px", borderRadius:8, cursor:"pointer", fontSize:10, fontWeight:700, background:period===p?"#FBBF24":"rgba(255,255,255,0.04)", border:`1px solid ${period===p?"#FBBF24":"rgba(255,255,255,0.08)"}`, color:period===p?"#000":"rgba(255,255,255,0.4)" }}>{p.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px 16px", marginBottom:14, textAlign:"center" }}>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:"0.08em" }}>{period.toUpperCase()} P&L</div>
        <div style={{ fontSize:32, fontWeight:800, color:totalPnl>=0?"#00FFB2":"#EF4444", margin:"6px 0" }}>{totalPnl>=0?"+":""}${totalPnl.toFixed(0)}</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{tradeLog.length} Trades</div>
        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          {[[`${wins}W/${losses}L`,"Trades"],[`${winRate}%`,"Win Rate"],["—","Fees"]].map(([val,label],i) => (
            <div key={i} style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"8px 4px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:i===1?"#FBBF24":"#E8E8E8" }}>{val}</div>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 10px", display:"flex", justifyContent:"space-around" }}>
        {scores.map((s,i) => <ScoreGauge key={i} {...s} />)}
      </div>
    </div>
  );
};

export const DeskView = ({ positions, setPositions, tradeLog, setTradeLog }) => {
  const [screen, setScreen] = useState("feed");
  const [selectedId, setSelectedId] = useState(null);
  const [showPlanCheck, setShowPlanCheck] = useState(false);
  const selected = positions.find(p => p.id === selectedId);
  const flags = detectPatterns(tradeLog);

  const addPosition = pos => { setPositions(prev => [pos, ...prev]); setScreen("feed"); };
  const closePosition = pos => {
    const { usd } = computeUnrealized(pos);
    setTradeLog(prev => [...prev, { ...pos, result: usd >= 0 ? "win" : "loss", pnl: usd, closedAt: Date.now() }]);
    setPositions(prev => prev.filter(p => p.id !== pos.id));
    setScreen("feed"); setSelectedId(null);
  };

  if (screen === "add") return <AddPositionForm onAdd={addPosition} onCancel={()=>setScreen("feed")} accent="#FBBF24" />;
  if (screen === "report") return <ReportScreen tradeLog={tradeLog} onBack={()=>setScreen("feed")} />;

  if (screen === "detail" && selected) {
    const { pct, usd } = computeUnrealized(selected);
    const up = usd >= 0;
    const ageMin = Math.round((Date.now() - selected.openedAt) / 60000);
    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px 10px" }}>
          <button onClick={()=>{setScreen("feed");setSelectedId(null);}} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer" }}>Back</button>
          <span style={{ fontSize:10, color:"#00FFB2" }}>LIVE</span>
        </div>
        <div style={{ padding:"0 18px 18px" }}>
          <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginBottom:4 }}>OPEN POSITION {selected.symbol}</div>
          <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}><span style={{ color:selected.direction==="long"?"#00FFB2":"#EF4444" }}>{selected.leverage}x {selected.direction.toUpperCase()}</span> {ageMin}m</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>Entry ${selected.entryPrice.toLocaleString()} Size ${selected.size.toLocaleString()}</div>
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:up?"#00FFB2":"#EF4444" }}>{up?"+":""}${usd.toFixed(0)}</div>
          </div>
          <SignalCard color="#FBBF24" label="REGIME SHIFT" title="The market this trade was made for is gone." detail="Conditions shifted. Review exit, size, and target." />
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:10 }}>WHAT CHANGED SINCE ENTRY</div>
            {[["Price moves","calm to wild"],["Buyers nearby","thinning"],["Direction","losing steam"]].map(([label,val],i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderTop:i>0?"1px solid rgba(255,255,255,0.05)":"none", fontSize:12 }}>
                <span style={{ color:"rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ color:"#FBBF24" }}>{val}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setShowPlanCheck(true)} style={{ width:"100%", padding:"13px", borderRadius:10, background:"#FBBF24", border:"none", color:"#000", fontWeight:700, fontSize:13, cursor:"pointer" }}>CHECK YOUR PLAN</button>
          <button onClick={()=>closePosition(selected)} style={{ width:"100%", padding:"11px", borderRadius:10, background:"none", marginTop:8, border:"1px solid rgba(239,68,68,0.3)", color:"#EF4444", fontWeight:700, fontSize:12, cursor:"pointer" }}>CLOSE POSITION</button>
        </div>
        {showPlanCheck && <PlanCheckModal position={selected} patternFlag={flags[0]} onClose={()=>setShowPlanCheck(false)} />}
      </div>
    );
  }

  return (
    <div style={{ padding:"16px 18px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:9, color:"#FBBF24", letterSpacing:"0.1em", marginBottom:2 }}>LIVE {positions.length + flags.length} SIGNALS</div>
          <div style={{ fontSize:16, fontWeight:800 }}>Your desk{positions.length||flags.length?" flagged something.":" is quiet."}</div>
        </div>
        <button onClick={()=>setScreen("report")} style={{ background:"none", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.5)", fontSize:10, padding:"6px 10px", borderRadius:8, cursor:"pointer" }}>REPORT</button>
      </div>
      {positions.map(pos => {
        const { usd } = computeUnrealized(pos);
        const up = usd >= 0;
        return (
          <div key={pos.id} onClick={()=>{setSelectedId(pos.id);setScreen("detail");}} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:10, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"#F7931A22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#F7931A", fontWeight:700 }}>{pos.symbol[0]}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{pos.symbol} <span style={{ color:pos.direction==="long"?"#00FFB2":"#EF4444", fontSize:11 }}>{pos.leverage}x {pos.direction.toUpperCase()}</span></div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>{Math.round((Date.now()-pos.openedAt)/60000)}m open</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:13, fontWeight:700, color:up?"#00FFB2":"#EF4444" }}>{up?"+":""}${usd.toFixed(0)}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>UNREALIZED</div>
            </div>
          </div>
        );
      })}
      {flags.map((f,i) => <SignalCard key={i} color="#EF4444" label="BEHAVIOR YOUR PATTERN" title={f.title} detail={f.detail} />)}
      <button onClick={()=>setScreen("add")} style={{ width:"100%", padding:"13px", borderRadius:10, background:"rgba(251,191,36,0.1)", border:"1px dashed rgba(251,191,36,0.4)", color:"#FBBF24", fontWeight:700, fontSize:12, cursor:"pointer", marginTop:6 }}>+ LOG NEW POSITION</button>
      {!positions.length && !flags.length && <div style={{ textAlign:"center", padding:"30px 10px", color:"rgba(255,255,255,0.18)", fontSize:11 }}>Log a position to activate live monitoring.</div>}
    </div>
  );
};
                                               
