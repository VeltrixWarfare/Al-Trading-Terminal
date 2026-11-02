export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  marketDataUrl: process.env.MARKET_DATA_URL ?? "",
  marketDataApiKey: process.env.MARKET_DATA_API_KEY ?? "",
  aiBaseUrl: process.env.AI_BASE_URL ?? "",
  aiApiKey: process.env.AI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "",
};
export const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
