import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!accessToken) return json({ error: "mercado_pago_not_configured" }, 503);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "not_authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.email) return json({ error: "not_authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const planCode = typeof body.plan_code === "string" ? body.plan_code : "";
    if (!["basic", "pro", "infinity"].includes(planCode)) return json({ error: "invalid_plan" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: plan, error: planError }, { data: profile, error: profileError }] = await Promise.all([
      adminClient.from("plan_settings").select("plan_code,name,price").eq("plan_code", planCode).maybeSingle(),
      adminClient.from("profiles").select("id,full_name,plan_code,role").eq("id", user.id).maybeSingle(),
    ]);

    if (planError || profileError || !plan || !profile) return json({ error: "workspace_not_found" }, 404);
    if (profile.role === "admin") return json({ error: "admin_has_unlimited_access" }, 400);

    // Always use the configured canonical app URL for Mercado Pago redirects.
    // Never trust a caller-controlled Origin header, otherwise checkout could become an open redirect.
    const appUrl = Deno.env.get("APP_URL")?.replace(/\/+$/, "");
    if (!appUrl) return json({ error: "app_url_not_configured" }, 500);

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "invalid_plan_price" }, 400);

    const { data: claim, error: claimError } = await adminClient.rpc("claim_checkout", {
      p_user_id: user.id,
      p_plan_code: planCode,
    });

    if (claimError || !claim) {
      console.error("Checkout claim error", claimError);
      return json({ error: "checkout_claim_failed" }, 500);
    }

    if (claim.status === "already_active") {
      return json({ status: "already_active", plan_code: planCode });
    }

    if (claim.status === "active_subscription_exists") {
      return json({ error: "active_subscription_exists", plan_code: claim.plan_code }, 409);
    }

    if (claim.status === "checkout_in_progress") {
      return json({ error: "checkout_in_progress" }, 409);
    }

    if (claim.status !== "claimed") {
      return json({ error: "invalid_checkout_state" }, 409);
    }

    const notificationUrl = supabaseUrl + "/functions/v1/mercado-pago-webhook?source_news=webhooks";
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: JSON.stringify({
        reason: "Progresso Acha — " + plan.name,
        external_reference: user.id,
        payer_email: user.email,
        notification_url: notificationUrl,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
        back_url: appUrl + "/?billing=return&plan=" + encodeURIComponent(planCode),
      }),
    });

    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData?.init_point || !mpData?.id) {
      console.error("Mercado Pago checkout error", mpResponse.status, mpData);
      await releaseCheckout(adminClient, user.id);
      return json({ error: "mercado_pago_checkout_failed" }, 502);
    }

    const { error: updateError } = await adminClient.from("subscriptions")
      .update({
        provider: "mercado_pago",
        provider_subscription_id: String(mpData.id),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("Subscription local update error", updateError);
      return json({ error: "subscription_store_failed" }, 500);
    }

    return json({
      status: "checkout_created",
      plan_code: planCode,
      checkout_url: mpData.init_point,
      provider_subscription_id: String(mpData.id),
    });
  } catch (error) {
    console.error("mercado-pago-checkout unexpected error", error);
    return json({ error: "internal_error" }, 500);
  }
});

async function releaseCheckout(admin: ReturnType<typeof createClient>, userId: string) {
  const { error } = await admin.from("subscriptions").update({
    status: "pending",
    provider: null,
    provider_subscription_id: null,
    updated_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
  }).eq("user_id", userId).eq("status", "pending").is("provider_subscription_id", null);
  if (error) console.error("Checkout release error", error);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
