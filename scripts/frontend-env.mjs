// Build-time guard. Never include an environment value in an exception or log.
export function validateFrontendEnv(env) {
  const defined = Object.entries(env).filter(
    ([name, value]) => name.startsWith("VITE_") && value,
  );
  if (
    defined.some(
      ([name]) =>
        !["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].includes(name),
    )
  )
    throw new Error(
      "Unsupported frontend environment variable. Only the public Supabase URL and public key may be exposed.",
    );
  const key = env.VITE_SUPABASE_ANON_KEY,
    url = env.VITE_SUPABASE_URL;
  if (!key && !url) return; // Configuration-free builds are allowed; account features show unavailable.
  if (!key || !url)
    throw new Error("Provide both public Supabase frontend settings.");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid public Supabase URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("Use an HTTPS public Supabase URL without credentials.");
  if (key.startsWith("sb_publishable_")) return;
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    if (payload.role === "anon" && key.split(".").length === 3) return;
  } catch {}
  throw new Error(
    "Frontend key rejected. Use only a Supabase anon or publishable key, never a private key.",
  );
}
