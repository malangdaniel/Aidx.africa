import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod'

const Input = z.object({
  childOrderId: z.string().uuid(),
  status: z.enum(['order_received', 'prescription_review', 'processing', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'cancelled', 'rejected']),
  reason: z.string().trim().max(500).optional().default(''),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const respond = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const parsed = Input.safeParse(await req.json())
    if (!parsed.success) return respond({ error: parsed.error.flatten().fieldErrors }, 400)
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) return respond({ error: 'Order service unavailable' }, 500)
    const authorization = req.headers.get('Authorization')
    if (!authorization) return respond({ error: 'Authentication required' }, 401)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return respond({ error: 'Authentication required' }, 401)
    const admin = createClient(url, serviceKey)
    const { data, error } = await admin.rpc('update_pharmacy_order_status', {
      _child_order_id: parsed.data.childOrderId,
      _new_tracking_status: parsed.data.status,
      _reason: parsed.data.reason || null,
      _actor_id: user.id,
    })
    if (error) return respond({ error: error.message }, 400)
    return respond(data)
  } catch {
    return respond({ error: 'Invalid request' }, 400)
  }
})