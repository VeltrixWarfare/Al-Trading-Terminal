import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!config.aiBaseUrl || !config.aiModel) {
    return NextResponse.json({
      error: "AI belum dikonfigurasi. Isi AI_BASE_URL, AI_API_KEY (jika provider memerlukan), dan AI_MODEL di Vercel."
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    if (!body?.market?.quote || !Array.isArray(body?.market?.candles) || body.market.candles.length < 30) {
      return NextResponse.json({ error: "Data market tidak cukup. Minimal 30 candle diperlukan untuk analisis." }, { status: 400 });
    }

    const base = config.aiBaseUrl.replace(/\/+$/, "");
    const endpoint = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    const system = `You are a cautious XAUUSD market research copilot. Use only the supplied OHLC data. Never invent live prices, news, indicators, or certainty. If the setup is unclear, say WAIT / NO CLEAR SETUP. This is educational market research, not personalized financial advice or an instruction to place a trade. Do not provide automatic execution instructions. Distinguish calculated facts from hypotheses. Respond in Indonesian with: Ringkasan data, keterbatasan timeframe, observasi candle, skenario naik, skenario turun, kondisi yang membatalkan skenario, and kesimpulan. Do not claim BOS, CHoCH, FVG, order blocks, or liquidity sweeps unless actually derivable from the supplied candles.`;

    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(config.aiApiKey ? { Authorization: `Bearer ${config.aiApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.aiModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(body.market) }
        ]
      })
    });

    const raw = await response.text();
    let result: any = null;
    try { result = raw ? JSON.parse(raw) : null; } catch { /* provider may return plain text */ }

    if (!response.ok) {
      const detail = typeof result?.error?.message === "string"
        ? result.error.message
        : typeof result?.message === "string" ? result.message
        : raw.slice(0, 500) || `HTTP ${response.status}`;
      return NextResponse.json({
        error: `AI provider menolak request (HTTP ${response.status}). ${detail}`
      }, { status: 502 });
    }

    const analysis = result?.choices?.[0]?.message?.content;
    if (typeof analysis !== "string" || !analysis.trim()) {
      return NextResponse.json({
        error: "Provider merespons, tetapi format jawabannya bukan OpenAI-compatible chat completion. Periksa AI_BASE_URL dan provider."
      }, { status: 502 });
    }

    return NextResponse.json({ analysis, model: config.aiModel, generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "AI analysis failed"
    }, { status: 502 });
  }
}
