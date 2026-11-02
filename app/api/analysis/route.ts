import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function POST(request: Request) {
  if (!config.aiBaseUrl || !config.aiModel) return NextResponse.json({
    error: "AI provider belum dikonfigurasi. Untuk AI tanpa biaya API, jalankan Ollama secara lokal dan isi AI_BASE_URL serta AI_MODEL. Lihat README."
  }, { status: 503 });
  try {
    const body = await request.json();
    if (!body?.market?.quote || !Array.isArray(body?.market?.candles) || body.market.candles.length < 30) {
      return NextResponse.json({ error: "Data market tidak cukup untuk analisis. Minimal 30 candle diperlukan." }, { status: 400 });
    }
    const system = `You are a cautious XAUUSD research copilot. Use only supplied data. Never invent live prices, news, indicators, or certainty. If data is insufficient or setup is unclear, return WAIT or NO TRADE. Do not provide automatic execution instructions. Clearly distinguish computed facts from hypotheses. Respond in Indonesian with: Data status, multi-timeframe limitations, observations, bullish scenario, bearish scenario, invalidation, and final status. Do not fabricate BOS/CHoCH/FVG; only identify them if explicitly calculated in input.`;
    const response = await fetch(`${config.aiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(config.aiApiKey ? { Authorization: `Bearer ${config.aiApiKey}` } : {}) },
      body: JSON.stringify({ model: config.aiModel, temperature: 0.2, messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(body.market) }
      ] })
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const result = await response.json();
    const analysis = result?.choices?.[0]?.message?.content;
    if (typeof analysis !== "string" || !analysis.trim()) throw new Error("AI provider returned an empty response.");
    return NextResponse.json({ analysis, model: config.aiModel, generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI analysis failed" }, { status: 502 });
  }
}
