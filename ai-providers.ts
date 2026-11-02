type ProviderId = "gemini" | "groq" | "openrouter";
type ProviderConfig = { id: ProviderId; label: string; model: string; baseUrl: string; apiKey: string; note: string };

function cleanBase(value: string) { return value.replace(/\/+$/, ""); }

export function getAIProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || "";
  const geminiModel = process.env.GEMINI_MODEL || process.env.AI_MODEL || "";
  const geminiBase = process.env.GEMINI_BASE_URL || process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/";
  if (geminiKey && geminiModel) providers.push({
    id: "gemini", label: "Google Gemini", model: geminiModel,
    baseUrl: cleanBase(geminiBase), apiKey: geminiKey,
    note: "Free tier tersedia untuk model tertentu; kuota dan model mengikuti akun Google."
  });

  const groqKey = process.env.GROQ_API_KEY || "";
  const groqModel = process.env.GROQ_MODEL || "";
  if (groqKey && groqModel) providers.push({
    id: "groq", label: "Groq", model: groqModel,
    baseUrl: cleanBase(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"),
    apiKey: groqKey, note: "Free tier memiliki batas request dan token; jangan upgrade ke paket berbayar jika ingin tetap gratis."
  });

  const routerKey = process.env.OPENROUTER_API_KEY || "";
  const routerModel = process.env.OPENROUTER_MODEL || "openrouter/free";
  if (routerKey) providers.push({
    id: "openrouter", label: "OpenRouter Free", model: routerModel,
    baseUrl: cleanBase(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"),
    apiKey: routerKey, note: "Gunakan openrouter/free atau ID model berakhiran :free. Free models dibatasi kuota."
  });
  return providers;
}

export function getPublicAIProviders() {
  return getAIProviders().map(({id,label,model,note}) => ({id,label,model,note}));
}
