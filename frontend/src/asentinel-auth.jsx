import { useState } from "react";

const C = {
  bg: "#080810", bg2: "#0D0D18", bg3: "#12121F",
  border: "rgba(255,255,255,0.07)", borderFocus: "rgba(0,255,178,0.4)",
  green: "#00FFB2", gold: "#FBBF24", red: "#EF4444",
  text: "#E8E8E8", muted: "rgba(255,255,255,0.4)", dim: "rgba(255,255,255,0.15)",
};
const mono = "'SF Mono','Fira Code','Courier New',monospace";
const API = import.meta?.env?.VITE_API_URL || "http://localhost:3001";

const Input = ({ label, type = "text", value, onChange, placeholder, error }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 9, letterSpacing: "0.12em", color: C.muted, display: "block", marginBottom: 6 }}>
      {label}
    </label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{
        width: "100%", padding: "11px 14px",
        background: C.bg2, border: `1px solid ${error ? C.red : C.border}`,
        borderRadius: 10, color: C.text, fontSize: 13, fontFamily: mono,
        outline: "none", transition: "border-color 0.2s",
      }}
      onFocus={(e) => e.target.style.borderColor = error ? C.red : C.green}
      onBlur={(e) => e.target.style.borderColor = error ? C.red : C.border}
    />
    {error && <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>{error}</div>}
  </div>
);

const Logo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 10px ${C.green}` }} />
    <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.1em" }}>ASENTINEL</span>
  </div>
);

// ─── Login ────────────────────────────────────────────────────────────────────
const Login = ({ onSuccess, onSwitch }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email || !password) return setError("Fill in all fields");
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return setError("Invalid email or password");
      localStorage.setItem("as_token", data.token);
      localStorage.setItem("as_plan", data.plan);
      onSuccess(data);
    } catch (e) {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Logo />
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", marginBottom: 10 }}>WELCOME BACK</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, letterSpacing: "-0.01em" }}>
        Log in to <span style={{ color: C.green }}>Asentinel</span>
      </h1>

      <Input label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      <Input label="PASSWORD" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" error={error} />

      <button
        onClick={submit} disabled={loading}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{
          width: "100%", padding: "13px", borderRadius: 10,
          background: loading ? "rgba(0,255,178,0.3)" : C.green,
          border: "none", color: "#000", fontWeight: 800,
          fontSize: 13, cursor: loading ? "default" : "pointer",
          fontFamily: mono, letterSpacing: "0.05em", marginTop: 4,
        }}
      >
        {loading ? "Logging in…" : "Log in →"}
      </button>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.muted }}>
        No account?{" "}
        <span onClick={onSwitch} style={{ color: C.green, cursor: "pointer" }}>Sign up free</span>
      </div>
    </div>
  );
};

// ─── Signup ───────────────────────────────────────────────────────────────────
const Signup = ({ onSuccess, onSwitch }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!email.includes("@")) e.email = "Valid email required";
    if (password.length < 8) e.password = "Min 8 characters";
    if (password !== confirm) e.confirm = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error === "Email already exists") return setErrors({ email: "Email already in use" });
      if (data.error) return setErrors({ confirm: data.error });
      localStorage.setItem("as_token", data.token);
      localStorage.setItem("as_plan", "free");
      onSuccess(data);
    } catch (e) {
      setErrors({ confirm: "Connection error — try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Logo />
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", marginBottom: 10 }}>CREATE ACCOUNT</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, letterSpacing: "-0.01em" }}>
        Start for <span style={{ color: C.green }}>free</span>
      </h1>

      <Input label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" error={errors.email} />
      <Input label="PASSWORD" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" error={errors.password} />
      <Input label="CONFIRM PASSWORD" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" error={errors.confirm} />

      <div style={{
        background: `${C.green}0A`, border: `1px solid ${C.green}20`,
        borderRadius: 8, padding: "10px 12px", fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.6,
      }}>
        ◆ Free plan: Oracle + Shrink · 3 messages/day<br />
        Upgrade anytime for all 7 agents + Desk
      </div>

      <button
        onClick={submit} disabled={loading}
        style={{
          width: "100%", padding: "13px", borderRadius: 10,
          background: loading ? "rgba(251,191,36,0.4)" : C.gold,
          border: "none", color: "#000", fontWeight: 800,
          fontSize: 13, cursor: loading ? "default" : "pointer",
          fontFamily: mono, letterSpacing: "0.05em",
        }}
      >
        {loading ? "Creating account…" : "Create account →"}
      </button>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: C.muted }}>
        Have an account?{" "}
        <span onClick={onSwitch} style={{ color: C.green, cursor: "pointer" }}>Log in</span>
      </div>
    </div>
  );
};

// ─── Auth shell ───────────────────────────────────────────────────────────────
export default function AuthPage({ onSuccess }) {
  const [mode, setMode] = useState("login");

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: mono, color: C.text, padding: 24,
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,0.18); }
      `}</style>

      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `linear-gradient(rgba(0,255,178,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,255,178,0.03) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 400,
        background: C.bg2, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: "36px 28px",
      }}>
        {mode === "login"
          ? <Login onSuccess={onSuccess} onSwitch={() => setMode("signup")} />
          : <Signup onSuccess={onSuccess} onSwitch={() => setMode("login")} />
        }
      </div>
    </div>
  );
}
