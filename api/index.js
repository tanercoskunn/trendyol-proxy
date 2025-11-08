
import express from "express";
import fetch from "node-fetch";

const app = express();

// Env vars set in Vercel Project Settings → Environment Variables
const PROXY_KEY  = process.env.PROXY_KEY;
const SUPPLIER_ID = process.env.SUPPLIER_ID;
const API_KEY     = process.env.API_KEY;
const API_SECRET  = process.env.API_SECRET;

if (!PROXY_KEY || !SUPPLIER_ID || !API_KEY || !API_SECRET) {
  console.warn("⚠️ Missing env vars: PROXY_KEY, SUPPLIER_ID, API_KEY, API_SECRET");
}

// Simple in-memory rate limit (per 15s window)
const windowMs = 15 * 1000;
const limit = 20;
const hits = new Map();
function rateLimiter(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return res.status(429).json({ error: "Too many requests" });
  arr.push(now);
  hits.set(ip, arr);
  next();
}

app.use(rateLimiter);

// Check proxy key
app.use((req, res, next) => {
  const key = req.headers["x-proxy-key"];
  if (!key || key !== PROXY_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

function authHeader() {
  const token = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function trendyolFetch(url) {
  const r = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": authHeader(),
      "Content-Type": "application/json",
      "User-Agent": "trendyol-proxy/1.0 (+https://vercel.com)"
    }
  });
  const text = await r.text();
  return { status: r.status, body: text };
}

app.get("/orders", async (req, res) => {
  try {
    const { startDate, endDate, page = "0", size = "200" } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate & endDate (epoch ms) required" });
    }
    const url = `https://api.trendyol.com/sapigw/suppliers/${SUPPLIER_ID}/orders?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`;
    const { status, body } = await trendyolFetch(url);
    res.status(status).type("application/json").send(body);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/settlements", async (req, res) => {
  try {
    const { startDate, endDate, page = "0", size = "200" } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate & endDate (epoch ms) required" });
    }
    const url = `https://api.trendyol.com/sapigw/suppliers/${SUPPLIER_ID}/settlements?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`;
    const { status, body } = await trendyolFetch(url);
    res.status(status).type("application/json").send(body);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Default export for Vercel
export default app;
