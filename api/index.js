// VERCEL EDGE veya NODE'U DESTEKLER (bkz. vercel.json)
// Hem header 'X-Proxy-Key' hem de '?key=' query param kabul eder.

export default async function handler(req, res) {
  // Vercel (Node) uyumluluğu: Edge'te 'res' yok; aşağıda Edge sürümü de verdim
  try {
    const { PROXY_KEY, SUPPLIER_ID, API_KEY, API_SECRET } = process.env;

    // --- Auth (header veya query) ---
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const keyFromHeader = req.headers["x-proxy-key"];
    const keyFromQuery  = urlObj.searchParams.get("key");
    const key = keyFromHeader || keyFromQuery;
    if (!key || key !== PROXY_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const startDate = urlObj.searchParams.get("startDate");
    const endDate   = urlObj.searchParams.get("endDate");
    const page      = urlObj.searchParams.get("page") || "0";
    const size      = urlObj.searchParams.get("size") || "200";
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate & endDate (epoch ms) required" });
    }

    const isSettlements = urlObj.pathname.endsWith("/settlements");
    const path = isSettlements
      ? `suppliers/${SUPPLIER_ID}/settlements`
      : `suppliers/${SUPPLIER_ID}/orders`;

    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
    const apiUrl = `https://api.trendyol.com/sapigw/${path}?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`;

    // --- "Tarayıcı benzeri" header seti (WAF false-positive riskini düşürür) ---
    const r = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Origin": "https://partner.trendyol.com",
        "Referer": "https://partner.trendyol.com/",
        "Connection": "keep-alive",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
      }
    });

    const text = await r.text();
    if (!r.ok) {
      // Trendyol response'u aynen iletelim (Cloudflare sayfası dahil)
      return res.status(r.status).send(text);
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(text);
  } catch (e) {
    console.error("Proxy error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
