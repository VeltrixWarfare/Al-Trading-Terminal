import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!config.marketDataUrl) return NextResponse.json({
    error: "MARKET_DATA_URL belum dikonfigurasi. Pilih provider XAUUSD dan isi environment variables."
  }, { status: 503 });
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "M15";
  try {
    const response = await fetch(config.marketDataUrl, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", ...(config.marketDataApiKey ? { Authorization: `Bearer ${config.marketDataApiKey}` } : {}) },
      body: JSON.stringify({ symbol: "XAUUSD", timeframe })
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.quote || !Array.isArray(data?.candles)) throw new Error("Provider response tidak sesuai normalized schema. Lihat README.");
    const q = data.quote;
    if (typeof q.bid !== "number" || typeof q.ask !== "number" || !q.timestamp || !q.source) throw new Error("Quote tidak lengkap.");
    if (q.ask < q.bid || Number.isNaN(Date.parse(q.timestamp))) throw new Error("Quote tidak valid.");
    return NextResponse.json({ quote: q, candles: data.candles, timeframe });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Market data error" }, { status: 502 });
  }
}
