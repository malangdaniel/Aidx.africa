import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COMMISSION_RATE = 0.05;

interface CheckoutItem {
  drugId: string;
  quantity: number;
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

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const items: CheckoutItem[] = Array.isArray(body?.items) ? body.items : [];
    const deliveryAddress = String(body?.deliveryAddress ?? "").trim();
    const paymentMethod = body?.paymentMethod === "wallet" ? "wallet" : "wallet";

    if (items.length === 0) return json({ error: "Cart is empty" }, 400);
    if (deliveryAddress.length < 5 || deliveryAddress.length > 500) {
      return json({ error: "A valid delivery address is required" }, 400);
    }
    for (const it of items) {
      if (!it?.drugId || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 100) {
        return json({ error: "Invalid cart item" }, 400);
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Merge duplicate drug ids
    const merged = new Map<string, number>();
    for (const it of items) merged.set(it.drugId, (merged.get(it.drugId) ?? 0) + it.quantity);
    const drugIds = [...merged.keys()];

    const { data: drugs, error: drugErr } = await admin
      .from("drugs")
      .select("id, name, price, stock_quantity, pharmacy_id, prescription_required")
      .in("id", drugIds);
    if (drugErr) throw drugErr;
    if (!drugs || drugs.length !== drugIds.length) return json({ error: "Some products are no longer available" }, 400);

    // Validate stock and server-side pricing
    const lines = drugs.map((d) => {
      const qty = merged.get(d.id)!;
      return {
        drug: d,
        quantity: qty,
        unitPrice: Number(d.price),
        totalPrice: Number(d.price) * qty,
      };
    });

    const outOfStock = lines.filter((l) => (l.drug.stock_quantity ?? 0) < l.quantity);
    if (outOfStock.length > 0) {
      return json(
        {
          error: "Insufficient stock",
          details: outOfStock.map((l) => ({ drugId: l.drug.id, name: l.drug.name, available: l.drug.stock_quantity ?? 0 })),
        },
        409,
      );
    }

    const totalAmount = lines.reduce((s, l) => s + l.totalPrice, 0);
    const commissionAmount = Math.round(totalAmount * COMMISSION_RATE * 100) / 100;

    // Wallet payment: funds move into escrow
    const { data: wallet, error: walletErr } = await admin
      .from("wallets")
      .select("id, balance, escrow_balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (walletErr) throw walletErr;
    if (!wallet) return json({ error: "Wallet not found" }, 400);

    if (Number(wallet.balance ?? 0) < totalAmount) {
      return json(
        { error: "Insufficient wallet balance", balance: Number(wallet.balance ?? 0), required: totalAmount },
        402,
      );
    }

    // Create parent order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: userId,
        total_amount: totalAmount,
        escrow_amount: totalAmount,
        commission_amount: commissionAmount,
        status: "paid",
        delivery_address: deliveryAddress,
        payment_reference: `wallet_${crypto.randomUUID()}`,
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const rollback = async () => {
      await admin.from("orders").delete().eq("id", order.id);
    };

    // Order items
    const { error: itemsErr } = await admin.from("order_items").insert(
      lines.map((l) => ({
        order_id: order.id,
        drug_id: l.drug.id,
        pharmacy_id: l.drug.pharmacy_id,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.totalPrice,
      })),
    );
    if (itemsErr) {
      await rollback();
      throw itemsErr;
    }

    // Split into child orders per pharmacy
    const byPharmacy = new Map<string, number>();
    for (const l of lines) {
      byPharmacy.set(l.drug.pharmacy_id, (byPharmacy.get(l.drug.pharmacy_id) ?? 0) + l.totalPrice);
    }
    const { data: childOrders, error: childErr } = await admin
      .from("child_orders")
      .insert(
        [...byPharmacy.entries()].map(([pharmacyId, amount]) => ({
          parent_order_id: order.id,
          pharmacy_id: pharmacyId,
          total_amount: amount,
          status: "paid",
        })),
      )
      .select();
    if (childErr) {
      await rollback();
      throw childErr;
    }

    // Decrement stock
    for (const l of lines) {
      const newStock = Math.max(0, (l.drug.stock_quantity ?? 0) - l.quantity);
      await admin.from("drugs").update({ stock_quantity: newStock }).eq("id", l.drug.id);
    }

    // Move funds to escrow
    const { error: walletUpdateErr } = await admin
      .from("wallets")
      .update({
        balance: Number(wallet.balance ?? 0) - totalAmount,
        escrow_balance: Number(wallet.escrow_balance ?? 0) + totalAmount,
      })
      .eq("id", wallet.id);
    if (walletUpdateErr) {
      await rollback();
      throw walletUpdateErr;
    }

    // History trail
    await admin.from("order_history").insert([
      { order_id: order.id, status: "paid", notes: "Payment held in escrow", created_by: userId },
      ...(childOrders ?? []).map((c: { id: string }) => ({
        child_order_id: c.id,
        status: "paid" as const,
        notes: "Awaiting pharmacy confirmation",
        created_by: userId,
      })),
    ]);

    return json({
      orderId: order.id,
      totalAmount,
      commissionAmount,
      pharmacies: byPharmacy.size,
      paymentMethod,
    });
  } catch (e) {
    console.error("checkout-order failed:", e);
    return json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});
