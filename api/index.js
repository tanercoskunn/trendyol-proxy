import fetch from "node-fetch";

// === Proxy Sunucusu (Trendyol API) ===
// Env değişkenleri (Vercel → Settings → Environment Variables):
// PROXY_KEY, SUPPLIER_ID, API_KEY, API_SECRET

export default async function handler(req, res) {
  const { PROXY_KEY, SUPPLIER_ID, API_KEY, API_SECRET } = process.env;

  // --- Kimlik kontrolü (header veya query param) ---
  const keyFromHeader = req.headers["x-proxy-key"];
  const keyFromQuery = req.query.key;
  const key = keyFromHeader || keyFromQuery;
  if (!key || key !== PROXY_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // --- Trendyol API endpoint seçimi ---
  const { startDate, endDate, page = 0, size = 200 } = req.query;
  const path = req.url.includes("/settlements")
    ? `suppliers/${SUPPLIER_ID}/settlements`
    : `suppliers/${SUPPLIER_ID}/orders`;

  const baseUrl = "https://api.trendyol.com/sapigw/";
  const url = `${baseUrl}${path}?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VercelProxy/1.0",
        "Authorization":
          "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64"),
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res
        .status(response.status)
        .send(`Trendyol API hata: ${response.status} - ${text}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
