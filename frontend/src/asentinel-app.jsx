import { useState, useRef, useEffect } from "react";
import { DeskView } from "./asentinel-desk";

const MODES = [
  { id: "oracle", label: "Oracle", icon: "◈", color: "#00FFB2", desc: "Market analysis & trade thesis", system: `You are Oracle, an elite market analyst. Analyze markets across Forex, Crypto, Stocks, Options, and Futures. Format: Bias / Key Levels / Confluences / Trade Plan / Risk.`, tools: true },
  { id: "sniper", label: "Sniper", icon: "⊕", color: "#FF6B35", desc: "Entry, SL & TP precision", system: `You are Sniper, a precision trade execution specialist. Output: Entry Zone / Stop Loss / TP1 / TP2 / TP3 / Risk-Reward / Invalidation.`, tools: true },
  { id: "shrink", label: "Shrink", icon: "⬡", color: "#A78BFA", desc: "Trading psychology & mindset", system: `You are Shrink, a trading psychologist. Help traders identify mental blocks, build discipline. Give actionable mental frameworks.`, tools: false },
  { id: "autopsy", label: "Autopsy", icon: "◎", color: "#F59E0B", desc: "Trade review & mistake analysis", system: `You are Autopsy, a trade post-mortem analyst. Output: What went right / What went wrong / Root cause / What to do differently.`, tools: false },
  { id: "quant", label: "Quant", icon: "∑", color: "#38BDF8", desc: "Stats, edge & backtesting logic", system: `You are Quant, a quantitative analyst. Help with win rate math, expectancy, position sizing, backtesting logic.`, tools: false },
  { id: "risk", label: "Risk Mgr", icon: "⚠", color: "#EF4444", desc: "Position sizing & exposure control", system: `You are Risk Manager. Help traders size positions, set max daily loss, manage exposure. Output: Position Size / Max Loss / Exposure / Verdict.`, tools: false },
  { id: "news", label: "News", icon: "⚡", color: "#FBBF24", desc: "Live macro & market news scanner", system: `You are News Scanner. Use web search to find macro and market news. Output: headline, market impact, trade implication. Always search first.`, tools: true },
];

async function saveData(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch (e) {}
}
async function loadData(key, fallback) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fallback; } catch (e) { return fallback; }
}

const TypingDots = ({ color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 14px" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: color, animation: `gdBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
    ))}
  </div>
);

const Message = ({ msg, accentColor }) => {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div style={{ maxWidth: "84%", padding: "10px 14px", borderRadius: isUser ? "14px 14px 3px 14px" : "3px 14px 14px 14px", background: isUser ? accentColor : "rgba(255,255,255,0.05)", color: isUser ? "#000" : "#E8E8E8", fontSize: 13.5, lineHeight: 1.65, fontFamily: "'SF Mono','Fira Code',monospace", border: isUser ? "none" : "1px solid rgba(255,255,255,0.08)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {msg.content}
      </div>
    </div>
  );
};

export default function AsentinelApp({ user, onDashboard }) {
  const [view, setView] = useState("agents");
  const [activeMode, setActiveMode] = useState(MODES[0]);
  const [chats, setChats] = useState({});
  const [positions, setPositions] = useState([]);
  const [tradeLog, setTradeLog] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [prices, setPrices] = useState(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [toast, setToast] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    Promise.all([
      loadData("asentinel-chats-v1", {}),
      loadData("asentinel-positions-v1", []),
      loadData("asentinel-tradelog-v1", []),
    ]).then(([c, p, t]) => { setChats(c); setPositions(p); setTradeLog(t); setStorageReady(true); });
  }, []);

  useEffect(() => { if (storageReady) saveData("asentinel-chats-v1", chats); }, [chats, storageReady]);
  useEffect(() => { if (storageReady) saveData("asentinel-positions-v1", positions); }, [positions, storageReady]);
  useEffect(() => { if (storageReady) saveData("asentinel-tradelog-v1", tradeLog); }, [tradeLog, storageReady]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, loading, activeMode.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };
  const currentMessages = chats[activeMode.id] || [];
  const totalQueries = Object.values(chats).reduce((s, m) => s + m.filter(x => x.role === "user").length, 0);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newHistory = [...currentMessages, userMsg];
    setChats((prev) => ({ ...prev, [activeMode.id]: newHistory }));
    setInput(""); setLoading(true);
    try {
      const body = { model: "claude-sonnet-4-6", max_tokens: 1000, system: activeMode.system, messages: newHistory };
      if (activeMode.tools) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("") || "No response.";
      setChats((prev) => ({ ...prev, [activeMode.id]: [...newHistory, { role: "assistant", content: reply }] }));
    } catch (e) {
      setChats((prev) => ({ ...prev, [activeMode.id]: [...newHistory, { role: "assistant", content: "Connection error. Try again." }] }));
    }
    setLoading(false);
  };

  const fetchPrices = async () => {
    setLoadingPrices(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, system: "Return ONLY a valid JSON array of 4 objects: symbol (string), price (string), change (number). Assets: BTC/USD, EUR/USD, XAU/USD, SPX. No markdown.", messages: [{ role: "user", content: "Current prices now" }], tools: [{ type: "web_search_20250305", name: "web_search" }] }) });
      const data = await res.json();
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
      setPrices(JSON.parse(text));
    } catch (e) { showToast("Price fetch failed"); }
    setLoadingPrices(false);
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const clearChat = () => { setChats((prev) => ({ ...prev, [activeMode.id]: [] })); showToast("Chat cleared"); };

  return (
    <div style={{ minHeight: "100vh", background: "#080810", color: "#E8E8E8", fontFamily: "'SF Mono','Fira Code',monospace", display: "flex", flexDirection: "column", maxWidth: 700, margin: "0 auto" }}>
      <style>{`@keyframes gdBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}} @keyframes gdFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}} ::-webkit-scrollbar{width:3px} textarea::placeholder{color:rgba(255,255,255,0.18)}`}</style>

      {toast && <div style={{ position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",background:"rgba(20,20,30,0.92)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"7px 16px",fontSize:11,color:"#E8E8E8",zIndex:300,animation:"gdFade 0.2s ease" }}>{toast}</div>}

      {/* Header */}
      <div style={{ padding:"13px 16px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"#080810",position:"sticky",top:0,zIndex:10 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:view==="desk"?"#FBBF24":activeMode.color,boxShadow:`0 0 10px ${view==="desk"?"#FBBF24":activeMode.color}99` }}/>
            <span style={{ fontSize:9,letterSpacing:"0.2em",color:"rgba(255,255,255,0.3)",textTransform:"uppercase" }}>ASENTINEL</span>
          </div>
          <div style={{ display:"flex",gap:5,alignItems:"center" }}>
            {onDashboard && <button onClick={onDashboard} style={{ background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",fontSize:9,padding:"4px 9px",borderRadius:6,cursor:"pointer" }}>DASHBOARD</button>}
            {view==="agents" && <>
              <button onClick={fetchPrices} disabled={loadingPrices} style={{ background:"none",border:"1px solid rgba(251,191,36,0.3)",color:loadingPrices?"rgba(255,255,255,0.2)":"#FBBF24",fontSize:9,padding:"4px 9px",borderRadius:6,cursor:"pointer" }}>{loadingPrices?"…":"⚡ PRICES"}</button>
              <button onClick={clearChat} style={{ background:"none",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.28)",fontSize:9,padding:"4px 9px",borderRadius:6,cursor:"pointer" }}>CLEAR</button>
            </>}
          </div>
        </div>
        <div style={{ display:"flex",gap:4 }}>
          {[{id:"agents",label:"AGENTS"},{id:"desk",label:`DESK${positions.length?` · ${positions.length}`:""}`}].map((t) => (
            <button key={t.id} onClick={() => setView(t.id)} style={{ flex:1,padding:"9px",background:"none",border:"none",borderBottom:`2px solid ${view===t.id?(t.id==="desk"?"#FBBF24":"#00FFB2"):"transparent"}`,color:view===t.id?"#E8E8E8":"rgba(255,255,255,0.3)",fontSize:11,fontWeight:700,letterSpacing:"0.08em",cursor:"pointer" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {view === "desk" ? (
        <DeskView positions={positions} setPositions={setPositions} tradeLog={tradeLog} setTradeLog={setTradeLog} />
      ) : (
        <>
          <div style={{ padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:5,overflowX:"auto",scrollbarWidth:"none" }}>
            {MODES.map((mode) => {
              const count = (chats[mode.id]||[]).filter(m=>m.role==="user").length;
              const active = activeMode.id===mode.id;
              return (
                <button key={mode.id} onClick={()=>setActiveMode(mode)} style={{ background:active?`${mode.color}15`:"transparent",border:`1px solid ${active?mode.color:"rgba(255,255,255,0.07)"}`,color:active?mode.color:"rgba(255,255,255,0.32)",fontSize:10,padding:"4px 10px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",letterSpacing:"0.04em",transition:"all 0.15s",display:"flex",alignItems:"center",gap:4 }}>
                  <span style={{fontSize:11}}>{mode.icon}</span>{mode.label}
                  {count>0&&<span style={{background:mode.color,color:"#000",borderRadius:"50%",width:13,height:13,fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div style={{ padding:"5px 16px",fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:"0.05em",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span>{activeMode.icon} {activeMode.desc}</span>
            {activeMode.tools&&<span style={{color:"#00FFB2",fontSize:8,letterSpacing:"0.12em"}}>◉ LIVE WEB</span>}
          </div>

          {prices && (
            <div style={{ padding:"8px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:5 }}>
              {prices.map((p,i) => (
                <div key={i} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"6px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11 }}>
                  <span style={{color:"rgba(255,255,255,0.45)"}}>{p.symbol}</span>
                  <span style={{color:"#E8E8E8",fontWeight:600}}>{p.price}</span>
                  <span style={{color:p.change>=0?"#00FFB2":"#EF4444",fontSize:10}}>{p.change>=0?"▲":"▼"} {Math.abs(p.change).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 8px",minHeight:260 }}>
            {currentMessages.length===0&&(
              <div style={{ textAlign:"center",padding:"48px 20px",color:"rgba(255,255,255,0.09)" }}>
                <div style={{fontSize:30,marginBottom:10}}>{activeMode.icon}</div>
                <div style={{fontSize:10,letterSpacing:"0.14em"}}>{activeMode.label.toUpperCase()} READY</div>
                <div style={{fontSize:9,marginTop:4,color:"rgba(255,255,255,0.06)"}}>{activeMode.desc}</div>
              </div>
            )}
            {currentMessages.map((msg,i)=><Message key={i} msg={msg} accentColor={activeMode.color}/>)}
            {loading&&(
              <div style={{display:"flex",justifyContent:"flex-start"}}>
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"3px 14px 14px 14px"}}>
                  <TypingDots color={activeMode.color}/>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div style={{ padding:"10px 16px 18px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"#080810" }}>
            <div style={{ display:"flex",gap:8,alignItems:"flex-end",background:"rgba(255,255,255,0.04)",border:`1px solid ${input?activeMode.color+"55":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"9px 12px",transition:"border-color 0.2s" }}>
              <textarea ref={textareaRef} value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={handleKey} placeholder={`Ask ${activeMode.label}…`} rows={1} style={{ flex:1,background:"none",border:"none",outline:"none",color:"#E8E8E8",fontSize:13.5,fontFamily:"inherit",resize:"none",lineHeight:1.5,minHeight:22 }}/>
              <button onClick={send} disabled={!input.trim()||loading} style={{ background:input.trim()&&!loading?activeMode.color:"rgba(255,255,255,0.07)",border:"none",borderRadius:8,width:30,height:30,cursor:input.trim()&&!loading?"pointer":"default",color:input.trim()&&!loading?"#000":"rgba(255,255,255,0.2)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",flexShrink:0 }}>↑</button>
            </div>
            <div style={{ fontSize:9,color:"rgba(255,255,255,0.1)",marginTop:5,textAlign:"center",letterSpacing:"0.08em" }}>ENTER · SHIFT+ENTER FOR NEWLINE · MEMORY PERSISTS</div>
          </div>
        </>
      )}
    </div>
  );
}
