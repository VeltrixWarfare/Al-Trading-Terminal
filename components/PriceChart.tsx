'use client';
import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, type IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/types";

export default function PriceChart({ candles }: { candles: Candle[] }) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const instance = createChart(host.current, {
      width: host.current.clientWidth, height: 340,
      layout: { background: { type: ColorType.Solid, color: "#101214" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#202428" }, horzLines: { color: "#202428" } },
      rightPriceScale: { borderColor: "#30363b" },
      timeScale: { borderColor: "#30363b", timeVisible: true },
      crosshair: { vertLine: { color: "#68737d" }, horzLine: { color: "#68737d" } },
    });
    chart.current = instance;
    const series = instance.addSeries(CandlestickSeries, {
      upColor: "#c6a96b", downColor: "#d66b6b",
      borderUpColor: "#c6a96b", borderDownColor: "#d66b6b",
      wickUpColor: "#c6a96b", wickDownColor: "#d66b6b",
    });
    if (candles.length) series.setData(candles.map(c => ({
      time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close
    })));
    const resize = () => { if (host.current) instance.applyOptions({ width: host.current.clientWidth }); };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); instance.remove(); chart.current = null; };
  }, [candles]);
  return <div ref={host} className="chart-host" />;
}
