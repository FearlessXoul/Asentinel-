// ════════════════════════════════════════════════════════════════════════════
// ASENTINEL TELEGRAM BOT — bot.js
// Deploy alongside server.js on Railway (separate service or same repo)
// ENV VARS: BOT_TOKEN, BACKEND_URL, BOT_SECRET (shared secret with backend)
// ════════════════════════════════════════════════════════════════════════════

const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);
const BACKEND = process.env.BACKEND_URL || "http://localhost:3001";
const BOT_SECRET = process.env.BOT_SECRET || "changeme";

// ─── In-memory session store (upgrade to Redis for scale) ────────────────────
const sessions = {}; // telegramId → { token, mode, history }

const getSession = (id) => {
  if (!sessions[id]) sessions[id] = { token: null, mode: "oracle", history: {} };
  return sessions[id];
};

// ─── Backend API helper ───────────────────────────────────────────────────────
async function api(path, method = "GET", body = null, token = null) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "x-bot-secret": BOT_SECRET }),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

// ─── Agent configs ────────────────────────────────────────────────────────────
const AGENTS = {
  oracle:  { icon: "◈", label: "Oracle",      plans: ["free","pro","elite"], desc: "Market analysis & trade thesis" },
  sniper:  { icon: "⊕", label: "Sniper",      plans: ["pro","elite"],        desc: "Entry / SL / TP precision" },
  shrink:  { icon: "⬡", label: "Shrink",      plans: ["free","pro","elite"], desc: "Trading psychology" },
  autopsy: { icon: "◎", label: "Autopsy",     plans: ["pro","elite"],        desc: "Trade post-mortem" },
  quant:   { icon: "∑", label: "Quant",        plans: ["pro","elite"],        desc: "Stats & edge math" },
  risk:    { icon: "⚠", label: "Risk Manager", plans: ["pro","elite"],        desc: "Position sizing & exposure" },
  news:    { icon: "⚡", label: "News",         plans: ["elite"],              desc: "Live macro & market news" },
};

// ─── Upgrade prompt ───────────────────────────────────────────────────────────
const upgradeMsg = (agentName, requiredPlan) =>
  `🔒 *${agentName}* requires *${requiredPlan.toUpperCase()}*.\n\nUpgrade at asentinel.app/pricing to unlock all agents.`;

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const name = ctx.from.first_name || "trader";
  await ctx.reply(
    `◈ *ASENTINEL*\n\nWelcome, ${name}.\n\nSeven AI trading agents, right here in Telegram.\n\n*Connect your account to get started:*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.url("🔗 Connect Account", `${process.env.FRONTEND_URL}/connect?tid=${ctx.from.id}`)],
        [Markup.button.callback("📋 See all agents", "show_agents")],
      ]),
    }
  );
});

// ─── /login via token (frontend sends user here after auth) ──────────────────
bot.command("connect", async (ctx) => {
  const token = ctx.message.text.split(" ")[1];
  if (!token) {
    return ctx.reply("Usage: /connect <your_token>\n\nGet your token from asentinel.app/connect");
  }
  const data = await api("/auth/me", "GET", null, token);
  if (data.error) return ctx.reply("❌ Invalid token. Try reconnecting from the website.");

  const sess = getSession(ctx.from.id);
  sess.token = token;
  await ctx.reply(
    `✅ *Connected as ${data.email}*\nPlan: *${data.plan.toUpperCase()}*\n\nYou're ready. Pick an agent:`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buildAgentKeyboard(data.plan)),
    }
  );
});

// ─── Show agents ──────────────────────────────────────────────────────────────
const buildAgentKeyboard = (plan) => {
  const rows = [];
  const entries = Object.entries(AGENTS);
  for (let i = 0; i < entries.length; i += 2) {
    const row = entries.slice(i, i + 2).map(([id, a]) => {
      const locked = !a.plans.includes(plan);
      return Markup.button.callback(`${locked ? "🔒" : a.icon} ${a.label}`, `agent_${id}`);
    });
    rows.push(row);
  }
  return rows;
};

bot.action("show_agents", async (ctx) => {
  const sess = getSession(ctx.from.id);
  let plan = "free";
  if (sess.token) {
    const data = await api("/auth/me", "GET", null, sess.token);
    plan = data.plan || "free";
  }
  await ctx.editMessageText(
    "Choose your agent:",
    Markup.inlineKeyboard(buildAgentKeyboard(plan))
  );
});

// ─── Agent switch ─────────────────────────────────────────────────────────────
Object.entries(AGENTS).forEach(([id, agent]) => {
  bot.action(`agent_${id}`, async (ctx) => {
    const sess = getSession(ctx.from.id);
    if (!sess.token) {
      return ctx.answerCbQuery("Connect your account first — use /start");
    }

    const user = await api("/auth/me", "GET", null, sess.token);
    const plan = user.plan || "free";

    if (!agent.plans.includes(plan)) {
      const required = agent.plans[0];
      await ctx.answerCbQuery(`Requires ${required.toUpperCase()} plan`);
      return ctx.reply(upgradeMsg(agent.label, required), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.url("⚡ Upgrade now", `${process.env.FRONTEND_URL}/pricing`)]]),
      });
    }

    sess.mode = id;
    await ctx.answerCbQuery(`Switched to ${agent.label}`);
    await ctx.reply(
      `${agent.icon} *${agent.label}* active\n_${agent.desc}_\n\nSend your question:`,
      { parse_mode: "Markdown" }
    );
  });
});

// ─── /agents command ──────────────────────────────────────────────────────────
bot.command("agents", async (ctx) => {
  const sess = getSession(ctx.from.id);
  let plan = "free";
  if (sess.token) {
    const data = await api("/auth/me", "GET", null, sess.token);
    plan = data.plan || "free";
  }
  await ctx.reply("Choose an agent:", Markup.inlineKeyboard(buildAgentKeyboard(plan)));
});

// ─── /mode shortcut commands ──────────────────────────────────────────────────
Object.entries(AGENTS).forEach(([id]) => {
  bot.command(id, async (ctx) => {
    const sess = getSession(ctx.from.id);
    const agent = AGENTS[id];
    if (!sess.token) return ctx.reply("Connect your account first — use /start");

    const user = await api("/auth/me", "GET", null, sess.token);
    if (!agent.plans.includes(user.plan)) {
      return ctx.reply(upgradeMsg(agent.label, agent.plans[0]), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.url("⚡ Upgrade", `${process.env.FRONTEND_URL}/pricing`)]]),
      });
    }
    sess.mode = id;
    const text = ctx.message.text.replace(`/${id}`, "").trim();
    if (text) {
      return handleMessage(ctx, text);
    }
    await ctx.reply(`${agent.icon} *${agent.label}* ready — send your question.`, { parse_mode: "Markdown" });
  });
});

// ─── /clear ───────────────────────────────────────────────────────────────────
bot.command("clear", async (ctx) => {
  const sess = getSession(ctx.from.id);
  if (sess.token) {
    await api(`/chat/${sess.mode}`, "DELETE", null, sess.token);
  }
  sess.history = {};
  await ctx.reply(`🗑 Chat cleared.`);
});

// ─── /plan ────────────────────────────────────────────────────────────────────
bot.command("plan", async (ctx) => {
  const sess = getSession(ctx.from.id);
  if (!sess.token) return ctx.reply("Not connected. Use /start");
  const data = await api("/auth/me", "GET", null, sess.token);
  await ctx.reply(
    `◆ *Your Plan: ${data.plan.toUpperCase()}*\n\n` +
    Object.entries(AGENTS).map(([id, a]) => {
      const locked = !a.plans.includes(data.plan);
      return `${locked ? "🔒" : a.icon} ${a.label}`;
    }).join("\n"),
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.url("Manage billing", `${process.env.FRONTEND_URL}/billing`)]]),
    }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.reply(
    `*ASENTINEL — Commands*\n\n` +
    `/start — Connect your account\n` +
    `/agents — Switch agent\n` +
    `/oracle — Switch to Oracle\n` +
    `/sniper — Switch to Sniper\n` +
    `/shrink — Switch to Shrink\n` +
    `/autopsy — Switch to Autopsy\n` +
    `/quant — Switch to Quant\n` +
    `/risk — Switch to Risk Manager\n` +
    `/news — Switch to News Scanner\n` +
    `/clear — Clear chat history\n` +
    `/plan — View your plan & limits\n\n` +
    `_You can also inline: /oracle BTC looking bullish_`,
    { parse_mode: "Markdown" }
  );
});

// ─── Message handler ──────────────────────────────────────────────────────────
async function handleMessage(ctx, text) {
  const sess = getSession(ctx.from.id);

  if (!sess.token) {
    return ctx.reply(
      "Connect your account first to use Asentinel agents.",
      Markup.inlineKeyboard([[Markup.button.url("🔗 Connect Account", `${process.env.FRONTEND_URL}/connect?tid=${ctx.from.id}`)]])
    );
  }

  const mode = sess.mode || "oracle";
  if (!sess.history[mode]) sess.history[mode] = [];

  sess.history[mode].push({ role: "user", content: text });
  const messages = sess.history[mode].slice(-10); // keep last 10 for context

  const thinking = await ctx.reply(`${AGENTS[mode].icon} thinking…`);

  try {
    const data = await api("/chat", "POST", { mode, messages }, sess.token);

    if (data.error === "upgrade_required") {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      return ctx.reply(upgradeMsg(AGENTS[mode].label, "pro"), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([[Markup.button.url("⚡ Upgrade", `${process.env.FRONTEND_URL}/pricing`)]]),
      });
    }

    if (data.error === "daily_limit_reached") {
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id);
      return ctx.reply(
        "⏱ *Free daily limit reached* (3/day)\n\nUpgrade to Pro for unlimited messages.",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([[Markup.button.url("⚡ Get Pro", `${process.env.FRONTEND_URL}/pricing`)]]),
        }
      );
    }

    if (data.reply) {
      sess.history[mode].push({ role: "assistant", content: data.reply });
      await ctx.telegram.editMessageText(ctx.chat.id, thinking.message_id, null, data.reply);
    }
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, thinking.message_id, null, "❌ Error — try again.");
  }
}

bot.on("text", (ctx) => handleMessage(ctx, ctx.message.text));

// ─── Launch ───────────────────────────────────────────────────────────────────
bot.launch();
console.log("Asentinel bot running");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
