import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MIN_DEPOSIT_NGN = 500;
const MAX_DEPOSIT_NGN = 500000;

// Secrets (Supabase > Edge Functions > Secrets):
//   PAYSTACK_SECRET_KEY      sk_test_... or sk_live_...  (required in production)
//   APP_URL                  e.g. https://your-app-domain.com  (used for the payment return page)
// There is no sandbox mode: a wallet is only ever credited after Paystack confirms the payment.
// For testing, use a Paystack TEST key (sk_test_...) and Paystack's test cards.

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/wallet-deposit/, "") || "/";

    // -------------------------------------------------------------
    // 1. Paystack webhook: the signature is ALWAYS required
    // -------------------------------------------------------------
    if (path === "/webhook" || req.headers.has("x-paystack-signature")) {
      const signature = req.headers.get("x-paystack-signature") ?? "";
      const rawBody = await req.text();

      if (!paystackSecret) return json({ error: "Payments are not configured" }, 503);
      if (!signature) return json({ error: "Missing signature" }, 401);

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(paystackSecret),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"],
      );
      const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const hash = Array.from(new Uint8Array(signed))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (!safeEqual(hash, signature)) return json({ error: "Invalid webhook signature" }, 401);

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return json({ error: "Invalid JSON payload" }, 400);
      }

      if (payload?.event === "charge.success") {
        const data = payload.data;
        const reference = String(data?.reference ?? "");
        if (!reference) return json({ error: "Missing reference" }, 400);
        if (data?.currency !== "NGN") return json({ error: "Unsupported currency" }, 400);

        // The amount Paystack says was paid must equal the amount we asked for
        const { data: deposit } = await admin
          .from("wallet_deposits")
          .select("amount_kobo, provider")
          .eq("reference", reference)
          .maybeSingle();
        if (!deposit || deposit.provider !== "paystack") return json({ error: "Unknown deposit" }, 404);
        if (Number(data?.amount) !== Number(deposit.amount_kobo)) {
          console.error("Webhook amount mismatch", reference, data?.amount, deposit.amount_kobo);
          return json({ error: "Amount mismatch" }, 400);
        }

        const { data: creditResult, error: creditErr } = await admin.rpc("credit_wallet_deposit", {
          p_deposit_reference: reference,
          p_provider_ref: String(data.id || reference),
          p_metadata: {
            paystack_channel: data.channel,
            gateway_response: data.gateway_response,
            paid_at: data.paid_at,
          },
        });
        if (creditErr) {
          console.error("Webhook deposit credit error:", creditErr);
          return json({ error: creditErr.message }, 500);
        }
        return json({ success: true, result: creditResult });
      }

      return json({ received: true });
    }

    // -------------------------------------------------------------
    // Authenticate the user for initialize / verify
    // -------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = body?.action || path.replace("/", "") || "initialize";

    // -------------------------------------------------------------
    // 2. Initialize deposit
    // -------------------------------------------------------------
    if (action === "initialize") {
      if (!paystackSecret) {
        return json({ error: "Deposits are not available yet. Please try again later." }, 503);
      }

      const amount = Math.round(Number(body?.amount ?? 0));
      if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_NGN || amount > MAX_DEPOSIT_NGN) {
        return json(
          { error: `Amount must be between ₦${MIN_DEPOSIT_NGN.toLocaleString()} and ₦${MAX_DEPOSIT_NGN.toLocaleString()}` },
          400,
        );
      }

      let { data: wallet } = await admin
        .from("wallets")
        .select("id, balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet, error: createWalletErr } = await admin
          .from("wallets")
          .insert({ user_id: user.id, balance: 0, escrow_balance: 0 })
          .select()
          .single();
        if (createWalletErr) throw createWalletErr;
        wallet = newWallet;
      }

      const reference = `DEP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const amountKobo = amount * 100;

      // Where Paystack sends the customer back to. Never trust an arbitrary client URL.
      const requestOrigin = req.headers.get("origin") ?? "";
      let base = appUrl || requestOrigin;
      if (body?.callbackUrl) {
        try {
          const cb = new URL(String(body.callbackUrl));
          if (appUrl ? cb.origin === appUrl : cb.origin === requestOrigin) base = cb.origin;
        } catch { /* ignore a malformed callback */ }
      }
      const callbackUrl = `${base}/patient-dashboard?tab=wallet&ref=${reference}`;

      const provider = "paystack";
      const { data: depositRecord, error: depositErr } = await admin
        .from("wallet_deposits")
        .insert({
          user_id: user.id,
          wallet_id: wallet!.id,
          amount: amount,
          amount_kobo: amountKobo,
          fee: 0.0,
          total_amount: amount,
          currency: "NGN",
          status: "pending",
          reference: reference,
          provider,
          metadata: { user_email: user.email, callback_url: callbackUrl },
        })
        .select()
        .single();
      if (depositErr) throw depositErr;

      {
        const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            amount: amountKobo,
            currency: "NGN",
            reference: reference,
            callback_url: callbackUrl,
            metadata: { user_id: user.id, wallet_id: wallet!.id, type: "wallet_deposit" },
          }),
        });
        const paystackData = await paystackRes.json();
        if (!paystackRes.ok || !paystackData.status) {
          return json({ error: paystackData.message || "Failed to initialize payment gateway" }, 502);
        }
        await admin
          .from("wallet_deposits")
          .update({ provider_checkout_url: paystackData.data.authorization_url })
          .eq("id", depositRecord.id);

        return json({
          success: true,
          reference,
          amount,
          currency: "NGN",
          isSandbox: false,
          checkoutUrl: paystackData.data.authorization_url,
          accessCode: paystackData.data.access_code,
        });
      }
    }

    // -------------------------------------------------------------
    // 3. Verify deposit (the customer came back from Paystack)
    // -------------------------------------------------------------
    if (action === "verify") {
      const reference = String(body?.reference ?? "").trim();
      if (!reference) return json({ error: "Deposit reference is required" }, 400);

      const { data: deposit, error: depErr } = await admin
        .from("wallet_deposits")
        .select("*")
        .eq("reference", reference)
        .eq("user_id", user.id)
        .maybeSingle();
      if (depErr || !deposit) return json({ error: "Deposit not found" }, 404);

      if (deposit.status === "completed") {
        const { data: wallet } = await admin.from("wallets").select("balance").eq("id", deposit.wallet_id).single();
        return json({
          success: true,
          alreadyCredited: true,
          reference: deposit.reference,
          balance: wallet?.balance ?? 0,
        });
      }

      if (deposit.provider === "paystack") {
        if (!paystackSecret) return json({ error: "Payments are not configured" }, 503);

        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== "success") {
          return json({
            success: false,
            status: verifyData.data?.status || "pending",
            message: verifyData.message || "Payment has not succeeded yet",
          });
        }

        // Paystack's amount must equal what we asked for, in NGN
        if (verifyData.data.currency !== "NGN" || Number(verifyData.data.amount) !== Number(deposit.amount_kobo)) {
          console.error("Verify amount mismatch", reference, verifyData.data.amount, deposit.amount_kobo);
          return json({ success: false, message: "Payment amount does not match this deposit" }, 400);
        }

        const { data: creditResult, error: creditErr } = await admin.rpc("credit_wallet_deposit", {
          p_deposit_reference: reference,
          p_provider_ref: String(verifyData.data.id || reference),
          p_metadata: { channel: verifyData.data.channel, paid_at: verifyData.data.paid_at },
        });
        if (creditErr) throw creditErr;

        return json({ success: true, credited: true, result: creditResult });
      }

      return json({ error: "Unable to verify deposit" }, 400);
    }

    return json({ error: `Unknown action '${action}'` }, 400);
  } catch (err: any) {
    console.error("Wallet deposit error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
