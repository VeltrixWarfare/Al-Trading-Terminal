'use client';
import { useState } from "react";
import { Activity, BrainCircuit, CandlestickChart, ShieldCheck, History, Settings, LayoutDashboard, Radio, RefreshCw, WifiOff, LockKeyhole } from "lucide-react";
import PriceChart from "./PriceChart";
import type { MarketPayload } from "@/lib/types";

const nav = [
  ["Overview", LayoutDashboard], ["AI Analysis", BrainCircuit], ["Signals", Radio],
  ["Risk Center", ShieldCheck], ["Performance", Activity], ["Journal", History], ["Settings", Settings],
] as const;

export default function Dashboard() {
  const [payload, setPayload] = useState<MarketPayload | null>(null);
  const [status, setStatus] = useState("NOT CONNECTED");
  const [message, setMessage] = useState("Hubungkan provider market data melalui environment variables untuk memulai.");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  async function refreshMarket() {
    setLoading(true); setStatus("CONNECTING");
    try {
      const res = await fetch("/api/market?timeframe=M15", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Market data belum tersedia.");
      setPayload(data); setStatus("CONNECTED"); setMessage("Data diterima dari provider.");
    } catch (e) {
      setPayload(null); setStatus("NOT CONNECTED");
      setMessage(e instanceof Error ? e.message : "Gagal mengambil data.");
    } finally { setLoading(false); }
  }

  async function runAnalysis() {
    if (!payload) { setAnalysis("Analisis belum dapat dijalankan: hubungkan sumber data XAUUSD terlebih dahulu."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market: payload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI belum dikonfigurasi.");
      setAnalysis(data.analysis);
    } catch (e) { setAnalysis(e instanceof Error ? e.message : "AI belum tersedia."); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A</div><div><b>AI TRADING</b><span>TERMINAL</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      {nav.map(([label, Icon], i) => <button key={label} className={`nav-item ${i===0?"active":""}`} onClick={() => setMessage(`${label}: modul ini disiapkan bertahap.`)}><Icon size={17}/>{label}</button>)}
      <div className="side-status"><span className="dot amber"/> COPILOT STANDBY<p>Personal workspace<br/>No broker execution</p></div>
      <div className="side-foot">PRIVATE INSTANCE · V1.0</div>
    </aside>
    <section className="main">
      <header className="topbar"><div><span className="eyebrow">PRIVATE RESEARCH ENVIRONMENT</span><h1>Command Center</h1></div><div className="top-right"><span className="pill"><span className="dot amber"/>{status}</span><span className="pill"><LockKeyhole size={14}/> PERSONAL</span></div></header>
      <section className="metrics">
        <div className="metric"><span>INSTRUMENT</span><strong>XAUUSD</strong><small>Gold / US Dollar</small></div>
        <div className="metric"><span>LAST PRICE</span><strong>{payload ? payload.quote.last.toFixed(2) : "—"}</strong><small>{payload ? `Source: ${payload.quote.source}` : "Awaiting market feed"}</small></div>
        <div className="metric"><span>DATA STATUS</span><strong className={payload?"good":"warn"}>{status}</strong><small>{payload ? new Date(payload.quote.timestamp).toLocaleString("id-ID") : "No verified quote"}</small></div>
        <div className="metric"><span>AI ENGINE</span><strong className="warn">NOT CONFIGURED</strong><small>Provider setup required</small></div>
      </section>
      <div className="content-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><div><span className="eyebrow">PRICE ACTION</span><h2><CandlestickChart size={18}/> XAUUSD <span className="muted">/ M15</span></h2></div><button className="button" onClick={refreshMarket} disabled={loading}><RefreshCw size={15}/>{loading?"Loading":"Refresh data"}</button></div>
          {payload?.candles?.length ? <PriceChart candles={payload.candles}/> : <div className="chart-empty"><CandlestickChart size={34}/><b>Market data not connected</b><span>Chart akan muncul setelah provider XAUUSD dikonfigurasi dan data berhasil divalidasi.</span></div>}
          <div className="chart-note"><span>DATA REFRESH: MANUAL</span><span>{payload ? `${payload.candles.length} candles loaded` : "NO CANDLE DATA"}</span></div>
        </section>
        <section className="panel ai-panel">
          <div className="panel-head"><div><span className="eyebrow">REASONING MODULE</span><h2><BrainCircuit size={18}/> AI Market Analysis</h2></div><span className="tag">COPILOT</span></div>
          <div className="bias"><span>MARKET BIAS</span><b>UNDETERMINED</b></div>
          <div className="analysis-box"><span className="eyebrow">ANALYSIS OUTPUT</span><p>{analysis || "Belum ada analisis. Sistem menunggu data market yang valid dan konfigurasi AI."}</p></div>
          <button className="button primary full" onClick={runAnalysis} disabled={loading}><BrainCircuit size={15}/> Run AI analysis</button>
          <div className="disclaimer">AI output is informational. No automatic trade execution.</div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel"><div className="panel-head"><h2><ShieldCheck size={17}/> Risk Center</h2><span className="tag">MANUAL INPUT</span></div><div className="empty-small">Risk calculator will be enabled after contract specifications and account settings are configured.</div></section>
        <section className="panel"><div className="panel-head"><h2><Activity size={17}/> Performance Lab</h2><span className="tag">NO DATA</span></div><div className="empty-small">No verified signal history yet. Performance metrics will appear after signals are recorded and evaluated.</div></section>
      </div>
      <footer><span><span className="dot amber"/> {status}</span><span>{message}</span><span>OBSERVE · ANALYZE · VALIDATE</span></footer>
    </section>
  </main>;
}
