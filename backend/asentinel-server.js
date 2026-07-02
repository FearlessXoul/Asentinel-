// ════════════════════════════════════════════════════════════════════════════
// ASENTINEL BACKEND — server.js
// Stack: Node.js + Express + Stripe + JWT + PostgreSQL
// Deploy: Render.com (add env vars in Render dashboard)
// ════════════════════════════════════════════════════════════════════════════

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");
const { Pool } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// DB helper — mirrors better-sqlite3 API
const db = {
  run: async (sql, params = []) => {
    const res = await pool.query(sql, params);
    return res;
  },
  get: async (sql, params = []) => {
    const res = await pool.query(sql, params);
    return res.rows[0];
  },
  all: async (sql, params = []) => {
    const res = await pool.query(sql, params);
    return res.rows;
  },
};

// ─── DB SETUP ────────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      daily_message_count INTEGER DEFAULT 0,
      daily_reset_date TEXT DEFAULT '',
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );

    CREATE TABLE IF NOT EXISTS trade_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER DEFAULT EXTRACT(EPOCH FROM NOW())
    );
  `);
  console.log("DB initialized");
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use("/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json());

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "asentinel_dev_secret");
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const requirePlan = (...plans) => async (req, res, next) => {
  const user = await db.get("SELECT plan FROM users WHERE id = $1", [req.user.id]);
  if (!user || !plans.includes(user.plan)) {
    return res.status(403).json({ error: "upgrade_required", plans });
  }
  next();
};

const AGENT_ACCESS = {
  free: ["oracle", "shrink"],
  pro: ["oracle", "sniper", "shrink", "autopsy", "quant", "risk", "news"],
  elite: ["oracle", "sniper", "shrink", "autopsy", "quant", "risk", "news"],
};

const FREE_DAILY_LIMIT = 3;

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Invalid email or password too short" });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "asentinel_dev_secret", { expiresIn: "30d" });
    res.json({ token, plan: "free" });
  } catch (e) {
    if (e.message.includes("unique") || e.message.includes("duplicate")) {
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get("SELECT * FROM users WHERE email = $1", [email?.toLowerCase()]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "asentinel_dev_secret", { expiresIn: "30d" });
  res.json({ token, plan: user.plan });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  const user = await db.get("SELECT id, email, plan, created_at FROM users WHERE id = $1", [req.user.id]);
  res.json(user);
});

// ─── CLAUDE PROXY ─────────────────────────────────────────────────────────────
const AGENT_SYSTEMS = {
  oracle: `You are Oracle, an elite market analyst. Analyze markets across Forex, Crypto, Stocks, Options, and Futures. Format: Bias / Key Levels / Confluences / Trade Plan / Risk.`,
  sniper: `You are Sniper, a precision trade execution specialist. Output: Entry Zone / Stop Loss / TP1 / TP2 / TP3 / Risk-Reward / Invalidation.`,
  shrink: `You are Shrink, a trading psychologist. Help traders identify mental blocks, build discipline. Give actionable mental frameworks.`,
  autopsy: `You are Autopsy, a trade post-mortem analyst. Output: What went right / What went wrong / Root cause / What to do differently.`,
  quant: `You are Quant, a quantitative analyst. Help with win rate math, expectancy, position sizing, backtesting logic.`,
  risk: `You are Risk Manager. Help traders size positions, set max daily loss, manage exposure. Output: Position Size / Max Loss / Exposure / Verdict.`,
  news: `You are News Scanner. Use web search to find macro and market news. Output: headline, market impact, trade implication. Always search first.`,
};

const WEB_SEARCH_AGENTS = ["oracle", "sniper", "news"];

app.post("/chat", requireAuth, async (req, res) => {
  const { mode, messages } = req.body;
  if (!mode || !messages) return res.status(400).json({ error: "Missing mode or messages" });

  const user = await db.get("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const allowed = AGENT_ACCESS[user.plan] || AGENT_ACCESS.free;
  if (!allowed.includes(mode)) {
    return res.status(403).json({ error: "upgrade_required", message: `${mode} requires Pro or Elite` });
  }

  if (user.plan === "free") {
    const today = new Date().toISOString().slice(0, 10);
    if (user.daily_reset_date !== today) {
      await pool.query("UPDATE users SET daily_message_count = 0, daily_reset_date = $1 WHERE id = $2", [today, user.id]);
      user.daily_message_count = 0;
    }
    if (user.daily_message_count >= FREE_DAILY_LIMIT) {
      return res.status(403).json({ error: "daily_limit_reached", message: "Free plan: 3 messages/day. Upgrade for unlimited." });
    }
    await pool.query("UPDATE users SET daily_message_count = daily_message_count + 1 WHERE id = $1", [user.id]);
  }

  const lastMsg = messages[messages.length - 1];
  await pool.query("INSERT INTO chats (user_id, mode, role, content) VALUES ($1, $2, $3, $4)", [user.id, mode, lastMsg.role, lastMsg.content]);

  try {
    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: AGENT_SYSTEMS[mode] || AGENT_SYSTEMS.oracle,
      messages,
    };
    if (WEB_SEARCH_AGENTS.includes(mode)) {
      body.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    const response = await anthropic.messages.create(body);
    const reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    await pool.query("INSERT INTO chats (user_id, mode, role, content) VALUES ($1, $2, $3, $4)", [user.id, mode, "assistant", reply]);
    res.json({ reply });
  } catch (e) {
    console.error("Claude error:", e);
    res.status(500).json({ error: "AI error" });
  }
});

app.get("/chat/:mode", requireAuth, async (req, res) => {
  const rows = await db.all(
    "SELECT role, content FROM chats WHERE user_id = $1 AND mode = $2 ORDER BY created_at ASC LIMIT 100",
    [req.user.id, req.params.mode]
  );
  res.json(rows);
});

app.delete("/chat/:mode", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM chats WHERE user_id = $1 AND mode = $2", [req.user.id, req.params.mode]);
  res.json({ ok: true });
});

// ─── POSITIONS ────────────────────────────────────────────────────────────────
app.get("/positions", requireAuth, async (req, res) => {
  const rows = await db.all("SELECT data FROM positions WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
  res.json(rows.map((r) => JSON.parse(r.data)));
});

app.post("/positions", requireAuth, async (req, res) => {
  const pos = req.body;
  await pool.query(
    "INSERT INTO positions (id, user_id, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $3",
    [pos.id, req.user.id, JSON.stringify(pos)]
  );
  res.json({ ok: true });
});

app.delete("/positions/:id", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM positions WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ─── TRADE LOG ────────────────────────────────────────────────────────────────
app.get("/tradelog", requireAuth, async (req, res) => {
  const rows = await db.all("SELECT data FROM trade_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json(rows.map((r) => JSON.parse(r.data)));
});

app.post("/tradelog", requireAuth, async (req, res) => {
  await pool.query("INSERT INTO trade_log (user_id, data) VALUES ($1, $2)", [req.user.id, JSON.stringify(req.body)]);
  res.json({ ok: true });
});

// ─── STRIPE ───────────────────────────────────────────────────────────────────
app.post("/billing/checkout", requireAuth, async (req, res) => {
  const { priceId } = req.body;
  const user = await db.get("SELECT * FROM users WHERE id = $1", [req.user.id]);
  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(user.id) } });
      customerId = customer.id;
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, user.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=1`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { userId: String(user.id) },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe error:", e);
    res.status(500).json({ error: "Payment error" });
  }
});

app.post("/billing/portal", requireAuth, async (req, res) => {
  const user = await db.get("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user.id]);
  if (!user?.stripe_customer_id) return res.status(400).json({ error: "No subscription" });
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });
  res.json({ url: session.url });
});

app.post("/webhook/stripe", async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send("Webhook error");
  }

  const planFromPriceId = (priceId) => {
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
    if (priceId === process.env.STRIPE_ELITE_PRICE_ID) return "elite";
    return "free";
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId) {
      await pool.query("UPDATE users SET stripe_subscription_id = $1 WHERE id = $2", [session.subscription, userId]);
    }
  }

  if (["customer.subscription.updated", "customer.subscription.created"].includes(event.type)) {
    const sub = event.data.object;
    const priceId = sub.items?.data?.[0]?.price?.id;
    const plan = planFromPriceId(priceId);
    const customer = await db.get("SELECT id FROM users WHERE stripe_customer_id = $1", [sub.customer]);
    if (customer) {
      await pool.query("UPDATE users SET plan = $1, stripe_subscription_id = $2 WHERE id = $3", [plan, sub.id, customer.id]);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const customer = await db.get("SELECT id FROM users WHERE stripe_customer_id = $1", [sub.customer]);
    if (customer) {
      await pool.query("UPDATE users SET plan = 'free' WHERE id = $1", [customer.id]);
    }
  }

  res.json({ received: true });
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "asentinel-api" }));

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Asentinel API running on port ${PORT}`));
});

module.exports = app;
