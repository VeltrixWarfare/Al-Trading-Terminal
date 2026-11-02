import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import type { Candle } from "@/lib/types";

export const dynamic = "force-dynamic";

const intervals: Record<string, string> = {
  M1: "1min",
  M3: "3min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  H1: "1h",
  H4: "4h",
  D1: "1day",
};

function parseCandleTime(value: unknown): number {
  if (typeof value !== "string") return NaN;
  // Twelve Data returns UTC wall-clock timestamps when timezone=UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Math.floor(Date.parse(normalized) / 1000);
}

export async function GET(request: Request) {
  if (!config.marketDataUrl || !config.marketDataApiKey) {
    return NextResponse.json(
      { error: "Isi MARKET_DATA_URL dan MARKET_DATA_API_KEY di Vercel Environment Variables." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedTimeframe = searchParams.get("timeframe") || "M15";
  const interval = intervals[requestedTimeframe];
  if (!interval) {
    return NextResponse.json({ error: `Timeframe ${requestedTimeframe} belum didukung.` }, { status: 400 });
  }

  try {
    // MARKET_DATA_URL should be the Twelve Data /time_series endpoint.
    const endpoint = new URL(config.marketDataUrl);
    endpoint.searchParams.set("symbol", "XAU/USD");
    endpoint.searchParams.set("interval", interval);
    endpoint.searchParams.set("outputsize", "100");
    endpoint.searchParams.set("timezone", "UTC");
    endpoint.searchParams.set("apikey", config.marketDataApiKey);

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof data?.message === "string" ? data.message : `HTTP ${response.status}`;
      throw new Error(`Twelve Data (${response.status}): ${detail}`);
    }
    if (data?.status === "error" || data?.code || !Array.isArray(data?.values)) {
      const detail = typeof data?.message === "string" ? data.message : "Respons tidak berisi data candle.";
      throw new Error(`Twelve Data: ${detail}`);
    }

    const candles: Candle[] = data.values
      .map((item: Record<string, unknown>) => ({
        time: parseCandleTime(item.datetime),
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
      }))
      .filter((candle: Candle) =>
        Number.isFinite(candle.time) &&
        [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
        candle.high >= candle.low
      )
      .sort((a: Candle, b: Candle) => a.time - b.time);

    if (candles.length < 2) {
      throw new Error("Twelve Data tidak mengembalikan candle XAU/USD yang cukup. Periksa paket, simbol, dan limit API.");
    }

    const latest = candles[candles.length - 1];
    return NextResponse.json({
      quote: {
        symbol: "XAUUSD",
        last: latest.close,
        timestamp: new Date(latest.time * 1000).toISOString(),
        source: "Twelve Data · XAU/USD",
      },
      candles,
      timeframe: requestedTimeframe,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market data error" },
      { status: 502 }
    );
  }
}
