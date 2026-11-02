import { createBrowserClient } from "@supabase/ssr";
import { config } from "./config";

export function getSupabaseBrowser() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  return createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);
}
