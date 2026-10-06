import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: true });

  try {
    const secret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!accessToken || !supabaseUrl || !serviceRoleKey) return json({ error: "webhook_not_configured" }, 503);

    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
    const type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
    const xSignature = req.headers.get("x-signature") || "";
    const xRequestId = req.headers.get("x-request-id") || "";

    if (!dataId) return json({ error: "invalid_notification" }, 400);

    if (secret) {
      if (!xSignature || !xRequestId) return json({ error: "invalid_signature" }, 401);
      const parts = Object.fromEntries(xSignature.split(",").map((part) => {
        const [key, ...rest] = part.split("=");
        return [key?.trim(), rest.join("=").trim()];
      }).filter(([key]) => key));
      const ts = parts.ts;
      const v1 = parts.v1;
      if (!ts || !v1) return json({ error: "invalid_signature" }, 401);

      const manifest = "id:" + dataId + ";request-id:" + xRequestId + ";ts:" + ts + ";";
      const expected = await hmacSha256Hex(secret, manifest);
      if (!timingSafeEqual(expected, v1)) return json({ error: "invalid_signature" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const eventType = type || String(body?.type || "");
    const eventId = String(body?.id || (eventType + ":" + dataId));

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: inserted, error: eventError } = await admin.from("billing_events").insert({
      provider: "mercado_pago",
      event_id: eventId,
      event_type: eventType || "unknown",
      payload: body,
      processed: false,
    }).select("id").maybeSingle();

    if (eventError?.code === "23505") return json({ ok: true, duplicate: true });
    if (eventError || !inserted) return json({ error: "event_store_failed" }, 500);

    let synced = true;
    if (eventType === "subscription_preapproval") {
      synced = await syncPreapproval(dataId, accessToken, admin);
    } else if (eventType === "subscription_authorized_payment") {
      const invoice = await fetchMercadoPago("https://api.mercadopago.com/authorized_payments/" + encodeURIComponent(dataId), accessToken);
      if (!invoice) synced = false;
      const preapprovalId = String(invoice?.preapproval_id || "");
      if (invoice && !preapprovalId) synced = false;
      if (preapprovalId) synced = await syncPreapproval(preapprovalId, accessToken, admin);
    }

    if (!synced) return json({ error: "processing_failed" }, 500);

    const { error: markProcessedError } = await admin.from("billing_events").update({
      processed: true,
      processed_at: new Date().toISOString(),
    }).eq("id", inserted.id);
    if (markProcessedError) return json({ error: "event_update_failed" }, 500);

    return json({ ok: true });
  } catch (error) {
    console.error("mercado-pago-webhook error", error);
    return json({ error: "internal_error" }, 500);
  }
});

async function syncPreapproval(preapprovalId: string, accessToken: string, admin: ReturnType<typeof createClient>) {
  const subscription = await fetchMercadoPago("https://api.mercadopago.com/preapproval/" + encodeURIComponent(preapprovalId), accessToken);
  if (!subscription?.id) return false;

  const providerId = String(subscription.id);
  const status = String(subscription.status || "pending");
  const nextPayment = subscription.next_payment_date || null;

  const { data: localSub } = await admin.from("subscriptions")
    .select("user_id,plan_code")
    .eq("provider_subscription_id", providerId)
    .maybeSingle();

  if (!localSub) return false;

  const { error: subscriptionError } = await admin.from("subscriptions").update({
    status: mapStatus(status),
    provider: "mercado_pago",
    current_period_end: nextPayment,
    cancel_at_period_end: status === "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("user_id", localSub.user_id);
  if (subscriptionError) return false;

  if (status === "authorized") {
    const { error: profileError } = await admin.from("profiles").update({
      plan_code: localSub.plan_code,
      updated_at: new Date().toISOString(),
    }).eq("id", localSub.user_id);
    if (profileError) return false;
  } else if (status === "cancelled" || status === "paused") {
    const { error: profileError } = await admin.from("profiles").update({
      plan_code: "free",
      updated_at: new Date().toISOString(),
    }).eq("id", localSub.user_id);
    if (profileError) return false;
  }
  return true;
}

async function fetchMercadoPago(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago resource fetch failed", response.status, data);
    return null;
  }
  return data;
}

function mapStatus(status: string) {
  if (status === "authorized") return "active";
  if (status === "cancelled") return "canceled";
  if (status === "paused") return "paused";
  return "pending";
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
