// SWE40006 Task 4: Shift Handover Board.
// Express web app that stores handover notes in a separate Redis container.
// Every setting comes from environment variables, so the same image runs locally and on EC2.

const os = require("os");
const path = require("path");
const express = require("express");
const { createClient } = require("redis");

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  siteName: process.env.SITE_NAME || "Northside General Hospital",
  boardTitle: process.env.BOARD_TITLE || "Shift Handover Board",
  appEnv: process.env.APP_ENV || "development",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  timeZone: process.env.DISPLAY_TIMEZONE || "Australia/Sydney",
  wards: (process.env.WARDS || "Ward 3, Ward 5, Emergency, Radiology, Theatre 2")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean),
};

const NOTES_KEY = "handover:notes";
const MAX_NOTES = 100;
const SHOWN_NOTES = 25;

// ---------- Redis connection ----------
// disableOfflineQueue makes commands fail straight away when Redis is down,
// instead of queueing and leaving the browser waiting.
const redis = createClient({
  url: config.redisUrl,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: (retries) => Math.min(retries * 250, 3000),
  },
});

let lastRedisError = null;
redis.on("ready", () => {
  lastRedisError = null;
  console.log(`REDIS connected at ${config.redisUrl}`);
});
redis.on("error", (err) => {
  const msg = err && err.message ? err.message : String(err);
  if (msg !== lastRedisError) console.error(`REDIS error: ${msg}`);
  lastRedisError = msg;
});
redis.connect().catch(() => {
  // The error handler above logs it and the client keeps retrying in the background.
});

// ---------- helpers ----------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(iso) {
  return new Date(iso).toLocaleString("en-AU", {
    timeZone: config.timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function loadNotes() {
  const raw = await redis.lRange(NOTES_KEY, 0, SHOWN_NOTES - 1);
  return raw.map((r) => JSON.parse(r));
}

function renderPage({ notes, error, flash }) {
  const rows = notes.length
    ? notes
        .map(
          (n) => `<tr>
        <td class="nowrap">${escapeHtml(formatTime(n.createdAt))}</td>
        <td class="nowrap">${escapeHtml(n.ward)}</td>
        <td class="nowrap">${escapeHtml(n.author)}</td>
        <td>${escapeHtml(n.message)}</td>
      </tr>`
        )
        .join("\n")
    : `<tr><td colspan="4" class="empty">${error ? "No data. Storage unavailable." : "No handover notes yet."}</td></tr>`;

  const wardOptions = config.wards
    .map((w) => `<option>${escapeHtml(w)}</option>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(config.boardTitle)}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <div class="title">${escapeHtml(config.siteName.toUpperCase())} | ${escapeHtml(config.boardTitle.toUpperCase())}</div>
    <div class="meta">ENV ${escapeHtml(config.appEnv)} | CONTAINER ${escapeHtml(os.hostname())} | STORAGE ${error ? "DOWN" : "OK"}</div>
  </header>
  <main>
    ${error ? `<div class="banner error">Storage unavailable. Notes cannot be read or saved. Detail: ${escapeHtml(error)}</div>` : ""}
    ${flash ? `<div class="banner ok">${escapeHtml(flash)}</div>` : ""}
    <form method="post" action="/notes">
      <label>Ward <select name="ward">${wardOptions}</select></label>
      <label>Staff <input name="author" maxlength="40" required></label>
      <label class="grow">Note <input name="message" maxlength="280" required></label>
      <button type="submit"${error ? " disabled" : ""}>Add note</button>
    </form>
    <table>
      <thead><tr><th>Time</th><th>Ward</th><th>Staff</th><th>Note</th></tr></thead>
      <tbody>
      ${rows}
      </tbody>
    </table>
    <p class="foot">Latest ${SHOWN_NOTES} notes shown. Times in ${escapeHtml(config.timeZone)}. JSON: <a href="/api/notes">/api/notes</a> | <a href="/health">/health</a></p>
  </main>
</body>
</html>`;
}

// ---------- app ----------
const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "4kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

app.get("/", async (req, res) => {
  const flash = req.query.added ? "Note added." : null;
  try {
    const notes = await loadNotes();
    res.send(renderPage({ notes, error: null, flash }));
  } catch (err) {
    res.status(503).send(renderPage({ notes: [], error: err.message, flash: null }));
  }
});

app.post("/notes", async (req, res) => {
  const ward = String(req.body.ward || "").trim();
  const author = String(req.body.author || "").trim().slice(0, 40);
  const message = String(req.body.message || "").trim().slice(0, 280);

  if (!config.wards.includes(ward) || !author || !message) {
    return res.status(400).send("Ward, staff and note are all required.");
  }

  const note = { ward, author, message, createdAt: new Date().toISOString() };
  try {
    await redis.lPush(NOTES_KEY, JSON.stringify(note));
    await redis.lTrim(NOTES_KEY, 0, MAX_NOTES - 1);
    console.log(`NOTE added ward="${ward}" staff="${author}" length=${message.length}`);
    res.redirect(303, "/?added=1");
  } catch (err) {
    console.error(`NOTE failed: ${err.message}`);
    res.status(503).send(renderPage({ notes: [], error: err.message, flash: null }));
  }
});

app.get("/api/notes", async (req, res) => {
  try {
    res.json(await loadNotes());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// Used by the Docker HEALTHCHECK. Returns 503 when Redis cannot be reached,
// so the container shows as unhealthy rather than "up" while it cannot do its job.
app.get("/health", async (req, res) => {
  const body = {
    status: "Healthy",
    container: os.hostname(),
    appEnv: config.appEnv,
    redis: "Healthy",
    checkedAtUtc: new Date().toISOString(),
  };
  try {
    if (!redis.isReady) throw new Error(lastRedisError || "not connected");
    await redis.ping();
  } catch (err) {
    body.status = "Unhealthy";
    body.redis = `Unhealthy: ${err.message}`;
    return res.status(503).json(body);
  }
  res.json(body);
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    `START ${config.boardTitle} listening on 0.0.0.0:${config.port} env=${config.appEnv} redis=${config.redisUrl}`
  );
});

// "docker stop" sends SIGTERM. Close cleanly instead of being killed after the 10 second timeout.
function shutdown(signal) {
  console.log(`STOP received ${signal}, closing`);
  server.close(() => {
    redis.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
