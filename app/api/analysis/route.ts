import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const schema = {
  type: "object",
  properties: {
    bias: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "WAIT"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string" },
    market_snapshot: { type: "string" },
    observations: { type: "array", items: { type: "string" } },
    bullish_scenario: { type: "string" },
    bearish_scenario: { type: "string" },
    invalidation: { type: "string" },
    key_levels: { type: "array", items: { type: "string" } },
    conclusion: { type: "string" },
    limitations: { type: "string" }
  },
  required: ["bias","confidence","summary","market_snapshot","observations","bullish_scenario","bearish_scenario","invalidation","key_levels","conclusion","limitations"],
  additionalProperties: false
};

export async function POST(request: Request) {
  if (!config.aiBaseUrl || !config.aiModel) {
    return NextResponse.json({ error: "AI belum dikonfigurasi. Isi AI_BASE_URL, AI_API_KEY, dan AI_MODEL di Vercel." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const market = body?.market;
    if (!market?.quote || !Array.isArray(market?.candles) || market.candles.length < 30) {
      return NextResponse.json({ error: "Data market tidak cukup. Minimal 30 candle diperlukan." }, { status: 400 });
    }
    const candles = market.candles.slice(-100);
    const base = config.aiBaseUrl.replace(/\/+$/, "");
    const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    const system = `Kamu adalah AI Market Research Copilot khusus XAUUSD. Gunakan HANYA OHLC candle yang diberikan. Jangan mengarang harga, berita, indikator, support/resistance, BOS, CHoCH, FVG, order block atau liquidity sweep. Pisahkan fakta hasil perhitungan dari hipotesis. Jika bukti tidak cukup, bias harus WAIT atau NEUTRAL. Confidence bukan probabilitas menang. Jawab HANYA JSON valid sesuai struktur berikut: bias (BULLISH/BEARISH/NEUTRAL/WAIT), confidence (LOW/MEDIUM/HIGH), summary (maksimal 2 kalimat), market_snapshot, observations (3-5 poin singkat), bullish_scenario, bearish_scenario, invalidation, key_levels (maksimal 4 level dan alasan; jika tidak dapat dihitung tulis "Belum cukup bukti"), conclusion (maksimal 2 kalimat), limitations. Bahasa Indonesia. Jangan gunakan markdown, heading, atau bullet di dalam string. Ini riset edukatif, bukan instruksi transaksi.`;
    const response = await fetch(endpoint, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(config.aiApiKey ? { Authorization: `Bearer ${config.aiApiKey}` } : {}) },
      body: JSON.stringify({
        model: config.aiModel, temperature: 0.15,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ symbol: market.quote.symbol, lastPrice: market.quote.last, timestamp: market.quote.timestamp, source: market.quote.source, timeframe: market.timeframe, candles }) }
        ],
        response_format: { type: "json_object" }
      })
    });
    const raw = await response.text();
    let result: any = null;
    try { result = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) {
      const detail = result?.error?.message || result?.message || raw.slice(0, 400) || `HTTP ${response.status}`;
      return NextResponse.json({ error: `AI provider HTTP ${response.status}: ${detail}` }, { status: 502 });
    }
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Provider tidak mengembalikan isi analisis." }, { status: 502 });
    }
    let analysis: any;
    try {
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Format jawaban AI belum berupa JSON terstruktur. Coba ulangi atau gunakan model yang mendukung JSON output." }, { status: 502 });
    }
    return NextResponse.json({ analysis, model: config.aiModel, generatedAt: new Date().toISOString(), dataSource: market.quote.source, timeframe: market.timeframe });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI analysis failed" }, { status: 502 });
  }
}
