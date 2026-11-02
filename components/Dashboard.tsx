'use client';
import { useEffect, useMemo, useState } from "react";
import {
  Activity, BrainCircuit, CandlestickChart, ShieldCheck, History, Settings,
  LayoutDashboard, Radio, RefreshCw, LockKeyhole, Plus, Trash2, Save,
  Gauge, BookOpen, TrendingUp, AlertCircle
} from "lucide-react";
import PriceChart from "./PriceChart";
import type { JournalEntry, MarketPayload } from "@/lib/types";

const nav = [
  ["Overview", "Overview", LayoutDashboard],
  ["AI Analysis", "AI Analysis", BrainCircuit],
  ["Signals", "Signals", Radio],
  ["Risk Center", "Risk Center", ShieldCheck],
  ["Performance", "Performance", Activity],
  ["Journal", "Journal", History],
  ["Settings", "Settings", Settings],
] as const;

const frames = [
  ["M1","1 menit"],["M3","3 menit"],["M5","5 menit"],["M15","15 menit"],
  ["H1","1 jam"],["H4","4 jam"],["D1","1 hari"]
] as const;

function Panel({children, className=""}:{children:React.ReactNode;className?:string}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Head({title,sub}:{title:string;sub:string}) {
  return <div className="page-heading"><span className="eyebrow">{sub}</span><h1>{title}</h1></div>;
}

function AnalysisView({data}:{data:any}) {
  const bias = data?.bias || "WAIT";
  const tone = bias === "BULLISH" ? "bullish" : bias === "BEARISH" ? "bearish" : "neutral";
  return <div className="ai-report">
    <div className="ai-verdict">
      <div><span className="eyebrow">MARKET BIAS</span><strong className={`bias ${tone}`}>{bias.replace("_"," ")}</strong></div>
      <div><span className="eyebrow">CONFIDENCE</span><strong className="confidence">{data?.confidence || "LOW"}</strong></div>
    </div>
    <div className="report-section"><span className="eyebrow">EXECUTIVE SUMMARY</span><p>{data?.summary || "Belum tersedia."}</p></div>
    <div className="report-section"><span className="eyebrow">MARKET SNAPSHOT</span><p>{data?.market_snapshot || "Belum tersedia."}</p></div>
    <div className="report-section"><span className="eyebrow">CANDLE OBSERVATIONS</span>
      <ul>{(Array.isArray(data?.observations)?data.observations:[]).map((v:string,i:number)=><li key={i}>{v}</li>)}</ul>
    </div>
    <div className="scenario-grid">
      <div className="scenario-card up"><span className="eyebrow">BULLISH SCENARIO</span><p>{data?.bullish_scenario || "Belum ada skenario."}</p></div>
      <div className="scenario-card down"><span className="eyebrow">BEARISH SCENARIO</span><p>{data?.bearish_scenario || "Belum ada skenario."}</p></div>
    </div>
    <div className="report-section"><span className="eyebrow">KEY LEVELS</span>
      <ul>{(Array.isArray(data?.key_levels)?data.key_levels:[]).map((v:string,i:number)=><li key={i}>{v}</li>)}</ul>
    </div>
    <div className="report-section"><span className="eyebrow">INVALIDATION</span><p>{data?.invalidation || "Belum tersedia."}</p></div>
    <div className="report-conclusion"><span className="eyebrow">AI CONCLUSION</span><p>{data?.conclusion || "WAIT — belum ada kesimpulan."}</p></div>
    <div className="report-limits"><span className="eyebrow">DATA LIMITATIONS</span><p>{data?.limitations || "Analisis hanya berdasarkan data OHLC yang diterima."}</p></div>
  </div>;
}

export default function Dashboard() {
  const [page,setPage] = useState("Overview");
  const [payload,setPayload] = useState<MarketPayload|null>(null);
  const [status,setStatus] = useState("NOT CONNECTED");
  const [message,setMessage] = useState("Refresh data untuk mengambil harga XAU/USD.");
  const [loading,setLoading] = useState(false);
  const [analysis,setAnalysis] = useState<any>(null);
  const [aiError,setAiError] = useState("");
  const [aiProviders,setAiProviders] = useState<{id:string;label:string;model:string;note:string}[]>([]);
  const [aiProvider,setAiProvider] = useState("gemini");
  const [aiPreset,setAiPreset] = useState("quick");
  const [aiMeta,setAiMeta] = useState<{providerLabel?:string;model?:string;preset?:string}|null>(null);
  const [timeframe,setTimeframe] = useState("M15");
  const [riskBalance,setRiskBalance] = useState("1000");
  const [riskPercent,setRiskPercent] = useState("1");
  const [stopDistance,setStopDistance] = useState("10");
  const [journal,setJournal] = useState<JournalEntry[]>([]);
  const [title,setTitle] = useState("");
  const [notes,setNotes] = useState("");
  const [entryFrame,setEntryFrame] = useState("M15");
  const [outcome,setOutcome] = useState<JournalEntry["outcome"]>("Open");

  useEffect(()=>{
    let active=true;
    fetch("/api/analysis",{cache:"no-store"}).then(r=>r.json()).then(data=>{
      if(!active) return;
      const list=Array.isArray(data.providers)?data.providers:[];
      setAiProviders(list);
      const preferred=list.some((p:any)=>p.id===data.defaultProvider)?data.defaultProvider:(list[0]?.id||"");
      setAiProvider(preferred);
    }).catch(()=>{if(active)setAiProviders([]);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    try {
      const saved=localStorage.getItem("aitt-journal-v1");
      if(saved) setJournal(JSON.parse(saved));
    } catch {}
  },[]);
  useEffect(()=>{
    try { localStorage.setItem("aitt-journal-v1",JSON.stringify(journal)); } catch {}
  },[journal]);

  async function refreshMarket(frame=timeframe) {
    setLoading(true); setStatus("CONNECTING"); setMessage("Mengambil data dari Twelve Data...");
    try {
      const res=await fetch(`/api/market?timeframe=${frame}`,{cache:"no-store"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||`Market API HTTP ${res.status}`);
      setPayload(data); setStatus("CONNECTED"); setMessage("Data diterima dan divalidasi dari Twelve Data.");
    } catch(e) {
      setPayload(null); setStatus("NOT CONNECTED");
      setMessage(e instanceof Error?e.message:"Gagal mengambil data.");
    } finally { setLoading(false); }
  }
  function changeFrame(value:string) {
    setTimeframe(value);
    setAnalysis(""); setAiError("");
    refreshMarket(value);
  }
  async function runAnalysis() {
    if(!payload) { setAiError("Ambil data market terlebih dahulu."); return; }
    if(!aiProvider) { setAiError("Belum ada AI provider yang dikonfigurasi admin."); return; }
    setLoading(true); setAiError(""); setAnalysis(""); setAiMeta(null);
    try {
      const res=await fetch("/api/analysis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({market:payload,provider:aiProvider,preset:aiPreset})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||`AI API HTTP ${res.status}`);
      setAnalysis(data.analysis);
      setAiMeta({providerLabel:data.providerLabel,model:data.model,preset:data.preset});
    } catch(e) { setAiError(e instanceof Error?e.message:"AI belum tersedia."); }
    finally { setLoading(false); }
  }
  function addJournal() {
    if(!title.trim()) return;
    const item:JournalEntry={id:crypto.randomUUID(),date:new Date().toISOString(),title:title.trim(),timeframe:entryFrame,notes:notes.trim(),outcome};
    setJournal(old=>[item,...old]); setTitle(""); setNotes(""); setOutcome("Open");
  }
  const stats=useMemo(()=>{
    const closed=journal.filter(x=>x.outcome!=="Open");
    const wins=closed.filter(x=>x.outcome==="Win").length;
    return {total:journal.length,closed:closed.length,wins,winRate:closed.length?Math.round(wins/closed.length*100):0};
  },[journal]);
  const risk=useMemo(()=>{
    const b=Number(riskBalance),p=Number(riskPercent),d=Number(stopDistance);
    if(!(b>0&&p>0&&p<=100&&d>0)) return null;
    return {amount:b*p/100,units:(b*p/100)/d};
  },[riskBalance,riskPercent,stopDistance]);

  const sidebar=<aside className="sidebar">
    <div className="brand"><div className="brand-mark">A</div><div><b>AI TRADING</b><span>TERMINAL</span></div></div>
    <div className="nav-label">WORKSPACE</div>
    {nav.map(([label,key,Icon])=><button key={key} className={`nav-item ${page===key?"active":""}`} onClick={()=>setPage(key)}><Icon size={17}/><span>{label}</span></button>)}
    <div className="side-status"><span className="dot amber"/> RESEARCH MODE<p>Personal workspace<br/>No broker execution</p></div>
    <div className="side-foot">PRIVATE INSTANCE · V1.1</div>
  </aside>;

  return <main className="shell">
    {sidebar}
    <section className="main">
      <header className="topbar">
        <div><span className="eyebrow">PRIVATE RESEARCH ENVIRONMENT</span><h1>{page==="Overview"?"Command Center":page}</h1></div>
        <div className="top-right"><span className="pill"><span className="dot amber"/>{status}</span><span className="pill"><LockKeyhole size={14}/> PERSONAL</span></div>
      </header>

      {page==="Overview" && <>
        <section className="metrics">
          <div className="metric"><span>INSTRUMENT</span><strong>XAUUSD</strong><small>Gold / US Dollar</small></div>
          <div className="metric"><span>LAST PRICE</span><strong>{payload?payload.quote.last.toFixed(2):"—"}</strong><small>{payload?`Source: ${payload.quote.source}`:"Awaiting market feed"}</small></div>
          <div className="metric"><span>DATA STATUS</span><strong className={payload?"good":"warn"}>{status}</strong><small>{payload?new Date(payload.quote.timestamp).toLocaleString("id-ID"):"No verified quote"}</small></div>
          <div className="metric"><span>AI ENGINE</span><strong className={aiError?"warn":"good"}>{analysis?"READY":"CHECK SETTINGS"}</strong><small>{analysis?"Analysis available":"Provider configuration required"}</small></div>
        </section>
        <Panel className="chart-panel">
          <div className="panel-head"><div><span className="eyebrow">PRICE ACTION</span><h2><CandlestickChart size={18}/> XAUUSD <span className="muted">/ {timeframe}</span></h2></div>
            <div className="toolbar"><select className="select" value={timeframe} onChange={e=>changeFrame(e.target.value)}>{frames.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="button" onClick={()=>refreshMarket()} disabled={loading}><RefreshCw size={15}/>{loading?"Loading":"Refresh data"}</button></div>
          </div>
          {payload?.candles?.length?<PriceChart candles={payload.candles}/>:<div className="chart-empty"><CandlestickChart size={34}/><b>Market data belum tersedia</b><span>{message}</span></div>}
          <div className="chart-note"><span>DATA REFRESH: MANUAL</span><span>{payload?`${payload.candles.length} candles loaded`:"NO CANDLE DATA"}</span></div>
        </Panel>
        <div className="content-grid overview-bottom">
          <Panel><div className="panel-head"><h2><BrainCircuit size={17}/> AI Market Analysis</h2><span className="tag">COPILOT</span></div>
            <div className="analysis-box"><span className="eyebrow">LATEST OUTPUT</span>{analysis ? <AnalysisView data={analysis}/> : <p>{aiError||"Belum ada analisis. Ambil data market dan jalankan AI Analysis."}</p>}</div>
            <button className="button primary full" onClick={()=>setPage("AI Analysis")}>Open AI Analysis</button>
          </Panel>
          <Panel><div className="panel-head"><h2><Activity size={17}/> Workspace Summary</h2><span className="tag">LOCAL JOURNAL</span></div><div className="summary-grid"><div><b>{stats.total}</b><small>Journal records</small></div><div><b>{stats.winRate}%</b><small>Recorded win rate</small></div></div><button className="button full" onClick={()=>setPage("Journal")}>Open Journal</button></Panel>
        </div>
      </>}

      {page==="AI Analysis" && <><Head title="AI Market Analysis" sub="MULTI-PROVIDER RESEARCH MODULE · XAUUSD"/><Panel>
        <div className="panel-head"><div><h2>Research Copilot</h2><span className="muted">Pilih AI dan preset. Semua provider memakai candle Twelve Data yang sama.</span></div><span className="tag">NO AUTO EXECUTION</span></div>
        <div className="ai-controls">
          <label>AI PROVIDER<select className="select" value={aiProvider} onChange={e=>setAiProvider(e.target.value)} disabled={!aiProviders.length}>
            {aiProviders.length?aiProviders.map(p=><option key={p.id} value={p.id}>{p.label} · {p.model}</option>):<option value="">Belum dikonfigurasi</option>}
          </select></label>
          <label>ANALYSIS PRESET<select className="select" value={aiPreset} onChange={e=>setAiPreset(e.target.value)}>
            <option value="quick">Quick Analysis</option><option value="deep">Deep Analysis</option><option value="technical">Technical Structure</option><option value="fundamental">Fundamental Context</option><option value="multi">Multi-Perspective</option>
          </select></label>
        </div>
        {aiProviders.find(p=>p.id===aiProvider)?.note && <p className="provider-note">{aiProviders.find(p=>p.id===aiProvider)?.note}</p>}
        <div className="toolbar"><select className="select" value={timeframe} onChange={e=>changeFrame(e.target.value)}>{frames.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="button" onClick={()=>refreshMarket()} disabled={loading}><RefreshCw size={14}/> Refresh market</button></div>
        <div className="analysis-box tall"><span className="eyebrow">ANALYSIS OUTPUT</span>{aiMeta&&<div className="analysis-meta">{aiMeta.providerLabel} · {aiMeta.model} · {aiMeta.preset?.toUpperCase()}</div>}{analysis ? <AnalysisView data={analysis}/> : <p>{aiError||"Pilih AI dan preset, ambil data market, lalu jalankan analisis."}</p>}</div>
        <button className="button primary full" onClick={runAnalysis} disabled={loading||!payload||!aiProvider}><BrainCircuit size={15}/>{loading?"Processing...":"Run AI analysis"}</button>
        {!aiProviders.length&&<p className="disclaimer">Admin perlu mengisi API key dan model provider melalui Environment Variables Vercel.</p>}
        <p className="disclaimer">Free tier tetap memiliki kuota dan batas penggunaan. Informasi edukatif; AI dapat keliru dan bukan instruksi transaksi.</p>
      </Panel></>}

      {page==="Signals" && <><Head title="Signals" sub="RESEARCH IDEAS · NOT EXECUTABLE"/><Panel>
        <div className="panel-head"><h2><Radio size={17}/> Signal Research</h2><span className="tag">MANUAL LOG</span></div>
        <p className="muted">Halaman ini menampilkan catatan ide riset yang kamu simpan di Journal. Tidak ada sinyal otomatis atau pengiriman order ke broker.</p>
        {journal.length===0?<div className="empty-small">Belum ada catatan. Tambahkan catatan riset melalui Journal.</div>:journal.map(j=><div className="record" key={j.id}><div><b>{j.title}</b><small>{j.timeframe} · {new Date(j.date).toLocaleString("id-ID")}</small></div><span className="tag">{j.outcome}</span></div>)}
        <button className="button full" onClick={()=>setPage("Journal")}>Open Journal</button>
      </Panel></>}

      {page==="Risk Center" && <><Head title="Risk Center" sub="EDUCATIONAL CALCULATOR · MANUAL INPUT"/><Panel>
        <div className="panel-head"><h2><ShieldCheck size={17}/> Position Risk Estimator</h2><span className="tag">NOT AN ORDER SIZE</span></div>
        <p className="muted">Kalkulator aritmetika sederhana untuk memahami nominal risiko. Nilai ini bukan rekomendasi ukuran posisi; kontrak XAUUSD dan nilai pergerakan berbeda antarbroker.</p>
        <div className="form-grid">
          <label>Account reference value (USD)<input className="field" inputMode="decimal" value={riskBalance} onChange={e=>setRiskBalance(e.target.value)}/></label>
          <label>Hypothetical risk (%)<input className="field" inputMode="decimal" value={riskPercent} onChange={e=>setRiskPercent(e.target.value)}/></label>
          <label>Hypothetical loss per unit (USD)<input className="field" inputMode="decimal" value={stopDistance} onChange={e=>setStopDistance(e.target.value)}/></label>
        </div>
        <div className="risk-result"><span>HYPOTHETICAL AMOUNT</span><strong>{risk?`$${risk.amount.toFixed(2)}`:"Check input values"}</strong><small>{risk?`Arithmetic units: ${risk.units.toFixed(4)} (not broker lots)`:"Enter positive values; risk percentage must not exceed 100%."}</small></div>
      </Panel></>}

      {page==="Performance" && <><Head title="Performance Lab" sub="JOURNAL-DERIVED STATISTICS"/><div className="metrics">
        <div className="metric"><span>TOTAL RECORDS</span><strong>{stats.total}</strong><small>Saved locally on this browser</small></div>
        <div className="metric"><span>CLOSED RECORDS</span><strong>{stats.closed}</strong><small>Win / Loss / Breakeven</small></div>
        <div className="metric"><span>RECORDED WINS</span><strong>{stats.wins}</strong><small>Manual journal labels</small></div>
        <div className="metric"><span>RECORDED WIN RATE</span><strong>{stats.closed?`${stats.winRate}%`:"—"}</strong><small>Not independently verified</small></div>
      </div><Panel><p className="muted">Statistik dihitung dari label outcome yang kamu masukkan sendiri. Ini bukan hasil trading terverifikasi atau bukti performa strategi.</p><button className="button" onClick={()=>setPage("Journal")}>Manage Journal</button></Panel></>}

      {page==="Journal" && <><Head title="Trade Journal" sub="PERSONAL RESEARCH LOG · SAVED IN THIS BROWSER"/><Panel>
        <div className="panel-head"><h2><BookOpen size={17}/> Add research record</h2><span className="tag">LOCAL STORAGE</span></div>
        <div className="form-grid">
          <label>Title<input className="field" placeholder="Contoh: XAUUSD session review" value={title} onChange={e=>setTitle(e.target.value)}/></label>
          <label>Timeframe<select className="select field" value={entryFrame} onChange={e=>setEntryFrame(e.target.value)}>{frames.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label>Review status<select className="select field" value={outcome} onChange={e=>setOutcome(e.target.value as JournalEntry["outcome"])}>{["Open","Win","Loss","Breakeven"].map(v=><option key={v}>{v}</option>)}</select></label>
        </div>
        <label className="block-label">Notes<textarea className="field textarea" placeholder="Catatan observasi, alasan, dan evaluasi..." value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button className="button primary" onClick={addJournal} disabled={!title.trim()}><Plus size={15}/> Save record</button>
      </Panel><Panel><div className="panel-head"><h2>Saved records</h2><span className="tag">{journal.length} ITEMS</span></div>
        {journal.length===0?<div className="empty-small">Belum ada catatan tersimpan.</div>:journal.map(j=><div className="record" key={j.id}><div><b>{j.title}</b><small>{j.timeframe} · {new Date(j.date).toLocaleString("id-ID")} · {j.outcome}</small>{j.notes&&<p>{j.notes}</p>}</div><button className="icon-button" aria-label="Delete record" onClick={()=>setJournal(old=>old.filter(x=>x.id!==j.id))}><Trash2 size={16}/></button></div>)}
      </Panel></>}

      {page==="Settings" && <><Head title="Settings" sub="TERMINAL CONFIGURATION"/><Panel>
        <div className="panel-head"><h2><Settings size={17}/> Market configuration</h2><span className="tag">SERVER ENVIRONMENT</span></div>
        <p className="muted">Sumber data dikonfigurasi melalui Vercel Environment Variables. Secret tidak ditampilkan di browser.</p>
        <div className="settings-row"><span>Market provider</span><b>Twelve Data · XAU/USD</b></div>
        <div className="settings-row"><span>Connection status</span><b className={payload?"good":"warn"}>{status}</b></div>
        <div className="settings-row"><span>Current timeframe</span><b>{frames.find(x=>x[0]===timeframe)?.[1]||timeframe}</b></div>
        <div className="toolbar"><select className="select" value={timeframe} onChange={e=>changeFrame(e.target.value)}>{frames.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="button" onClick={()=>refreshMarket()} disabled={loading}><RefreshCw size={14}/> Test connection</button></div>
        <div className="settings-row"><span>AI providers configured</span><b>{aiProviders.length} provider(s)</b></div>
        {aiProviders.map(p=><div className="settings-row" key={p.id}><span>{p.label}</span><b>{p.model}</b></div>)}
        <p className="disclaimer">API key tidak pernah dikirim ke browser. Admin mengatur provider melalui Environment Variables Vercel. Pengguna hanya dapat memilih provider yang sudah dikonfigurasi.</p>
      </Panel><Panel><div className="panel-head"><h2><LockKeyhole size={17}/> Privacy & limitations</h2></div><p className="muted">Journal disimpan di localStorage browser ini dan tidak tersinkron ke perangkat lain. Tidak ada koneksi broker atau eksekusi otomatis. Data market bergantung pada paket, kuota, dan keterlambatan provider.</p></Panel></>}

      <footer><span><span className="dot amber"/> {status}</span><span>{message}</span><span>OBSERVE · ANALYZE · VALIDATE</span></footer>
    </section>
  </main>;
}
