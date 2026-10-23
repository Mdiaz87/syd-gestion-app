// Contraseña de Supabase Auth a partir del PIN de 4 dígitos.
// v2: HMAC con PIN_PEPPER (secreto del servidor) — sin él no se puede armar
// la contraseña aunque se conozca el PIN y la clave del usuario, así que no
// sirve probar PINs directo contra Supabase Auth.
// v1 (viejo, derivable desde el navegador): solo para migrar al entrar.
const enc = new TextEncoder();

export async function passwordV2(key: string, pin: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("PIN_PEPPER")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", llave, enc.encode(`${key}:${pin}`)));
  return "v2-" + Array.from(firma, b => b.toString(16).padStart(2, "0")).join("");
}

export const passwordV1 = (key: string, pin: string) => `syd-${key}-${pin}`;

export const pinValido = (pin: unknown): pin is string => typeof pin === "string" && /^\d{4}$/.test(pin);

export const genPin = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
