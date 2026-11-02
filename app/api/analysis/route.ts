import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getAIProviders, getPublicAIProviders } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

const schema = {
  type: "object",
  properties: {
    bias: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "WAIT"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    summary: { type: "string" }, market_snapshot: { type: "string" },
    observations: { type: "array", items: { type: "string" } },
    bullish_scenario: { type: "string" }, bearish_scenario: { type: "string" },
    invalidation: { type: "string" }, key_levels: { type: "array", items: { type: "string" } },
    conclusion: { type: "string" }, limitations: { type: "string" }
  },
  required: ["bias","confidence","summary","market_snapshot","observations","bullish_scenario","bearish_scenario","invalidation","key_levels","conclusion","limitations"],
  additionalProperties: false
};

const presets: Record<string,string> = {
  quick: "PRESET QUICK ANALYSIS: buat ringkasan singkat, prioritaskan kondisi candle terbaru, struktur sederhana, dan keterbatasan data. Hindari klaim yang tidak dapat dibuktikan.",
  deep: "PRESET DEEP ANALYSIS: evaluasi rangkaian OHLC secara lebih menyeluruh, bandingkan swing high/low dan momentum candle. Jelaskan bukti yang mendukung dan yang bertentangan. Jangan mengarang indikator.",
  technical: "PRESET TECHNICAL STRUCTURE: fokus pada struktur swing, high/low, range, candle displacement yang benar-benar terlihat, dan level yang dapat dihitung dari OHLC. Jangan menyebut BOS, CHoCH, FVG, order block atau liquidity sweep kecuali kriteria objektifnya benar-benar terpenuhi.",
  fundamental: "PRESET FUNDAMENTAL CONTEXT: data yang diberikan hanya OHLC dan tidak berisi berita/kalender ekonomi. Jangan mengarang berita atau dampak fundamental. Jelaskan bahwa konteks fundamental tidak dapat diverifikasi dari input, lalu berikan hanya konteks harga yang tersedia.",
  multi: "PRESET MULTI-PERSPECTIVE: sajikan beberapa interpretasi yang masuk akal, bukti pro dan kontra, skenario alternatif, serta kondisi yang akan membatalkan tiap interpretasi. Jangan memaksakan satu bias."
};

export async function GET() {
  return NextResponse.json({
    providers: getPublicAIProviders(),
    presets: [
      {id:"quick",label:"Quick Analysis",description:"Ringkasan kondisi market"},
      {id:"deep",label:"Deep Analysis",description:"Evaluasi OHLC lebih menyeluruh"},
      {id:"technical",label:"Technical Structure",description:"Struktur swing dan level harga"},
      {id:"fundamental",label:"Fundamental Context",description:"Konteks fundamental dengan batasan data yang jelas"},
      {id:"multi",label:"Multi-Perspective",description:"Beberapa interpretasi dan bukti kontra"}
    ],
    defaultProvider: process.env.DEFAULT_AI_PROVIDER || "gemini"
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const market = body?.market;
    const requestedProvider = String(body?.provider || process.env.DEFAULT_AI_PROVIDER || "gemini");
    const presetId = String(body?.preset || "quick");
    const provider = getAIProviders().find(p => p.id === requestedProvider);
    if (!provider) {
      return NextResponse.json({error:"Provider ini belum dikonfigurasi oleh admin atau sedang tidak tersedia."},{status:503});
    }
    if (!market?.quote || !Array.isArray(market?.candles) || market.candles.length < 30) {
      return NextResponse.json({error:"Data market tidak cukup. Minimal 30 candle diperlukan."},{status:400});
    }
    const candles = market.candles.slice(-100);
    const endpoint = `${provider.baseUrl}/chat/completions`;
    const system = `Kamu adalah AI Market Research Copilot edukatif untuk XAUUSD. Gunakan HANYA OHLC candle yang diberikan. Jangan mengarang harga, berita, indikator, support/resistance, BOS, CHoCH, FVG, order block atau liquidity sweep. Pisahkan fakta hasil perhitungan dari hipotesis. Jika bukti tidak cukup, bias harus WAIT atau NEUTRAL. Confidence bukan probabilitas menang. ${presets[presetId] || presets.quick} Jawab HANYA JSON valid sesuai struktur: bias (BULLISH/BEARISH/NEUTRAL/WAIT), confidence (LOW/MEDIUM/HIGH), summary (maksimal 2 kalimat), market_snapshot, observations (3-5 poin), bullish_scenario, bearish_scenario, invalidation, key_levels (maksimal 4 level dan alasan; jika tidak cukup tulis "Belum cukup bukti"), conclusion (maksimal 2 kalimat), limitations. Bahasa Indonesia. Jangan gunakan markdown. Ini riset edukatif, bukan instruksi transaksi.`;
    const response = await fetch(endpoint, {
      method:"POST", cache:"no-store",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${provider.apiKey}`},
      body:JSON.stringify({
        model:provider.model,
        messages:[
          {role:"system",content:system},
          {role:"user",content:JSON.stringify({symbol:market.quote.symbol,lastPrice:market.quote.last,timestamp:market.quote.timestamp,source:market.quote.source,timeframe:market.timeframe,candles})}
        ],
        response_format:{type:"json_object"}
      }),
      signal:AbortSignal.timeout(55000)
    });
    const raw=await response.text();
    let result:any=null;
    try { result=raw?JSON.parse(raw):null; } catch {}
    if(!response.ok) {
      const status=response.status;
      const friendly=status===429?"Kuota atau rate limit provider tercapai. Tunggu reset kuota atau pilih provider lain."
        :status===503||status===502?"Provider sedang sibuk atau sementara tidak tersedia. Coba lagi beberapa saat atau pilih provider lain."
        :status===401||status===403?"API key ditolak. Admin perlu memeriksa Environment Variables provider."
        :`Provider gagal memproses permintaan (HTTP ${status}).`;
      return NextResponse.json({error:friendly,provider:provider.label,providerStatus:status},{status:502});
    }
    const content=result?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim()) return NextResponse.json({error:"Provider tidak mengembalikan isi analisis terstruktur."},{status:502});
    let analysis:any;
    try { analysis=JSON.parse(content.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"")); }
    catch { return NextResponse.json({error:"Jawaban AI bukan JSON yang valid. Coba preset lain atau provider lain."},{status:502}); }
    return NextResponse.json({analysis,provider:provider.id,providerLabel:provider.label,model:provider.model,preset:presetId,generatedAt:new Date().toISOString(),dataSource:market.quote.source,timeframe:market.timeframe});
  } catch(error) {
    const timedOut=error instanceof Error && error.name==="TimeoutError";
    return NextResponse.json({error:timedOut?"Permintaan AI melewati batas waktu. Coba provider lain atau ulangi nanti.":"Terjadi gangguan saat menghubungi AI provider."},{status:502});
  }
}
