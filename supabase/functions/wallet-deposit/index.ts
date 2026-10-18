import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MIN_DEPOSIT_NGN = 500;
const MAX_DEPOSIT_NGN = 500000;

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
    const allowSandbox = Deno.env.get("ALLOW_SANDBOX_DEPOSITS") === "true";

    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/wallet-deposit/, "") || "/";

    // -------------------------------------------------------------
    // 1. Webhook endpoint (Signature verified BEFORE database work)
    // -------------------------------------------------------------
    if (path === "/webhook" || req.headers.has("x-paystack-signature")) {
      const signature = req.headers.get("x-paystack-signature");
      const rawBody = await req.text();

      if (!paystackSecret || !signature) {
        return json({ error: "Missing webhook signature or provider secret" }, 401);
      }

      // Validate HMAC SHA512
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(paystackSecret),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
      );
      const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const hash = Array.from(new Uint8Array(signed))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (hash !== signature) {
        return json({ error: "Invalid webhook signature" }, 401);
      }

      let payload: any;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return json({ error: "Invalid JSON payload" }, 400);
      }

      if (payload?.event === "charge.success") {
        const data = payload.data;
        const reference = data?.reference;
        const amountPaidKobo = Number(data?.amount ?? 0);
        const currency = data?.currency;

        if (currency !== "NGN") {
          return json({ error: "Unsupported currency" }, 400);
        }

        // Validate stored deposit amount
        const { data: deposit, error: depErr } = await admin
          .from("wallet_deposits")
          .select("amount_kobo, status")
          .eq("reference", reference)
          .maybeSingle();

        if (depErr || !deposit) {
          return json({ error: "Deposit reference not found" }, 404);
        }

        if (Number(deposit.amount_kobo) !== amountPaidKobo) {
          console.error(`Amount mismatch for ${reference}: expected ${deposit.amount_kobo}, got ${amountPaidKobo}`);
          return json({ error: "Amount mismatch" }, 400);
        }

        const { data: creditResult, error: creditErr } = await admin.rpc(
          "credit_wallet_deposit",
          {
            p_deposit_reference: reference,
            p_provider_ref: String(data.id || data.reference),
            p_metadata: {
              paystack_channel: data.channel,
              gateway_response: data.gateway_response,
              paid_at: data.paid_at,
            },
          }
        );

        if (creditErr) {
          console.error("Webhook deposit credit error:", creditErr);
          return json({ error: creditErr.message }, 500);
        }

        return json({ success: true, result: creditResult });
      }

      return json({ received: true });
    }

    // -------------------------------------------------------------
    // Authenticate user for initialize / verify
    // -------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = body?.action || path.replace("/", "") || "initialize";

    // -------------------------------------------------------------
    // 2. Initialize Deposit
    // -------------------------------------------------------------
    if (action === "initialize") {
      const amount = Math.round(Number(body?.amount ?? 0));
      if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_NGN || amount > MAX_DEPOSIT_NGN) {
        return json(
          { error: `Amount must be between ₦${MIN_DEPOSIT_NGN.toLocaleString()} and ₦${MAX_DEPOSIT_NGN.toLocaleString()}` },
          400
        );
      }

      // Check or fetch user's wallet
      let { data: wallet, error: walletErr } = await admin
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
      const callbackUrl = body?.callbackUrl || `${url.origin}/patient-dashboard?tab=wallet&ref=${reference}`;

      // Insert pending deposit record
      const provider = paystackSecret ? "paystack" : (allowSandbox ? "sandbox" : "paystack");

      if (!paystackSecret && !allowSandbox) {
        return json(
          { error: "Payment gateway is not configured. Please contact administration." },
          503
        );
      }

      const { data: depositRecord, error: depositErr } = await admin
        .from("wallet_deposits")
        .insert({
          user_id: user.id,
          wallet_id: wallet.id,
          amount: amount,
          amount_kobo: amountKobo,
          fee: 0.00,
          total_amount: amount,
          currency: "NGN",
          status: "pending",
          reference: reference,
          provider: provider,
          metadata: {
            user_email: user.email,
            callback_url: callbackUrl,
          },
        })
        .select()
        .single();

      if (depositErr) throw depositErr;

      // If Paystack is configured, call Paystack initialize
      if (paystackSecret) {
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
            metadata: {
              user_id: user.id,
              wallet_id: wallet.id,
              type: "wallet_deposit",
            },
          }),
        });

        const paystackData = await paystackRes.json();
        if (!paystackRes.ok || !paystackData.status) {
          return json({ error: paystackData.message || "Failed to initialize payment gateway" }, 502);
        }

        // Store checkout URL
        await admin
          .from("wallet_deposits")
          .update({ provider_checkout_url: paystackData.data.authorization_url })
          .eq("id", depositRecord.id);

        return json({
          success: true,
          reference: reference,
          amount: amount,
          currency: "NGN",
          isSandbox: false,
          checkoutUrl: paystackData.data.authorization_url,
          accessCode: paystackData.data.access_code,
        });
      }

      // Sandbox / Test Mode ONLY when ALLOW_SANDBOX_DEPOSITS is 'true'
      return json({
        success: true,
        reference: reference,
        amount: amount,
        currency: "NGN",
        isSandbox: true,
        sandboxNotice: "Operating in test sandbox mode (ALLOW_SANDBOX_DEPOSITS=true).",
      });
    }

    // -------------------------------------------------------------
    // 3. Verify Deposit
    // -------------------------------------------------------------
    if (action === "verify") {
      const reference = String(body?.reference ?? "").trim();
      if (!reference) return json({ error: "Deposit reference is required" }, 400);

      // Fetch deposit strictly for authenticated user
      const { data: deposit, error: depErr } = await admin
        .from("wallet_deposits")
        .select("*")
        .eq("reference", reference)
        .eq("user_id", user.id)
        .maybeSingle();

      if (depErr || !deposit) {
        return json({ error: "Deposit not found" }, 404);
      }

      if (deposit.status === "completed") {
        const { data: wallet } = await admin.from("wallets").select("balance").eq("id", deposit.wallet_id).single();
        return json({
          success: true,
          alreadyCredited: true,
          reference: deposit.reference,
          balance: wallet?.balance ?? 0,
        });
      }

      // If Paystack is configured, always verify with Paystack
      if (paystackSecret && deposit.provider === "paystack") {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.status || verifyData.data.status !== "success") {
          return json({
            success: false,
            status: verifyData.data?.status || "pending",
            message: verifyData.message || "Payment has not succeeded yet",
          });
        }

        // Validate currency and amount
        if (verifyData.data.currency !== "NGN") {
          return json({ error: "Invalid payment currency. Expected NGN." }, 400);
        }

        const paidKobo = Number(verifyData.data.amount ?? 0);
        if (paidKobo !== Number(deposit.amount_kobo)) {
          console.error(`Paystack amount mismatch for ${reference}: expected ${deposit.amount_kobo}, got ${paidKobo}`);
          return json({ error: "Payment amount does not match expected deposit amount" }, 400);
        }

        // Credit deposit via atomic function
        const { data: creditResult, error: creditErr } = await admin.rpc("credit_wallet_deposit", {
          p_deposit_reference: reference,
          p_provider_ref: String(verifyData.data.id || reference),
          p_metadata: {
            channel: verifyData.data.channel,
            paid_at: verifyData.data.paid_at,
          },
        });

        if (creditErr) throw creditErr;

        return json({
          success: true,
          credited: true,
          result: creditResult,
        });
      }

      // Sandbox simulation mode verification: ONLY when ALLOW_SANDBOX_DEPOSITS is 'true'
      if (allowSandbox && (deposit.provider === "sandbox" || !paystackSecret)) {
        const { data: creditResult, error: creditErr } = await admin.rpc("credit_wallet_deposit", {
          p_deposit_reference: reference,
          p_provider_ref: `SANDBOX-${reference}`,
          p_metadata: {
            sandbox_simulation: true,
            verified_at: new Date().toISOString(),
          },
        });

        if (creditErr) throw creditErr;

        return json({
          success: true,
          credited: true,
          isSandbox: true,
          result: creditResult,
        });
      }

      // In production without sandbox enabled, reject unverified deposits
      if (!paystackSecret) {
        return json({ error: "Payment provider is not configured and sandbox mode is disabled." }, 503);
      }

      return json({ error: "Unable to verify deposit with payment provider" }, 400);
    }

    return json({ error: `Unknown action '${action}'` }, 400);
  } catch (err: any) {
    console.error("Wallet deposit error:", err);
    return json({ error: err?.message || "Internal server error" }, 500);
  }
});
