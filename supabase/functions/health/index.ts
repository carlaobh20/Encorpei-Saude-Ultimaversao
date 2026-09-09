import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const t0 = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { error } = await supabase.from("profiles").select("user_id").limit(1);
    const body = {
      status: error ? "error" : "ok",
      banco: error ? "error" : "ok",
      latencia_ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
      versao: "1.0.0",
      mensagem: error?.message,
    };
    return new Response(JSON.stringify(body), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: "error",
        banco: "error",
        latencia_ms: Date.now() - t0,
        timestamp: new Date().toISOString(),
        versao: "1.0.0",
        mensagem: String(e),
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
