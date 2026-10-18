import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PharmacyService } from '@/services/PharmacyService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Package, Search, Truck, CheckCircle, Loader2, Eye, Phone, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type TrackingStatus =
  | 'order_placed'
  | 'order_received'
  | 'prescription_review'
  | 'processing'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

type Order = {
  id: string;
  parentOrderId: string;
  customer: string;
  phone: string;
  address: string;
  instructions: string;
  total: number;
  date: string;
  trackingStatus: TrackingStatus;
  paymentStatus: string;
  items: Array<{ name: string; strength: string; quantity: number; price: number; dosage: string }>;
};

const statusDisplayLabels: Record<TrackingStatus, string> = {
  order_placed: 'Order placed',
  order_received: 'Order received',
  prescription_review: 'Prescription review',
  processing: 'Processing',
  ready_for_dispatch: 'Ready for dispatch',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const actionLabels: Record<string, string> = {
  order_received: 'Mark received',
  prescription_review: 'Start review',
  processing: 'Start processing',
  ready_for_dispatch: 'Ready for dispatch',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark delivered',
  rejected: 'Reject',
  cancelled: 'Cancel',
};

// Legal transitions according to server rules
const allowedNextSteps: Partial<Record<TrackingStatus, TrackingStatus[]>> = {
  order_placed: ['order_received', 'prescription_review', 'processing', 'rejected', 'cancelled'],
  order_received: ['prescription_review', 'processing', 'rejected', 'cancelled'],
  prescription_review: ['processing', 'rejected', 'cancelled'],
  processing: ['ready_for_dispatch', 'cancelled'],
  ready_for_dispatch: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
};

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [pendingStatus, setPendingStatus] = useState<TrackingStatus | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      const pharmacyId = await PharmacyService.getMyPharmacyId();
      if (!pharmacyId) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from('child_orders')
        .select('id, parent_order_id, status, tracking_status, total_amount, created_at')
        .eq('pharmacy_id', pharmacyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const children = (data ?? []) as any[];
      const parentIds = [...new Set(children.map((row) => row.parent_order_id))];

      const [parentsResult, itemsResult] = parentIds.length
        ? await Promise.all([
            supabase
              .from('orders')
              .select('id, user_id, delivery_address, delivery_instructions, payment_status, prescription_id, prescription_image_url')
              .in('id', parentIds),
            supabase
              .from('order_items')
              .select('order_id, quantity, unit_price, total_price, drug_name_snapshot, drug_strength_snapshot, dosage_instructions_snapshot, drugs:drug_id(name, strength, dosage_instructions)')
              .in('order_id', parentIds)
              .eq('pharmacy_id', pharmacyId),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      if (parentsResult.error) throw parentsResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const parents = (parentsResult.data ?? []) as any[];
      const items = (itemsResult.data ?? []) as any[];
      const userIds = [...new Set(parents.map((row) => row.user_id).filter(Boolean))];

      const profileResult = userIds.length
        ? await supabase.from('profiles').select('user_id, first_name, last_name, phone').in('user_id', userIds)
        : { data: [], error: null };

      const profiles = new Map(((profileResult.data ?? []) as any[]).map((p) => [p.user_id, p]));
      const parentById = new Map(parents.map((row) => [row.id, row]));

      const mapped = children.map((row): Order => {
        const parent = parentById.get(row.parent_order_id);
        const profile = parent ? profiles.get(parent.user_id) : null;
        return {
          id: row.id,
          parentOrderId: row.parent_order_id,
          customer: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Patient',
          phone: profile?.phone || '',
          address: parent?.delivery_address || '',
          instructions: parent?.delivery_instructions || '',
          total: Number(row.total_amount || 0),
          date: new Date(row.created_at).toLocaleString(),
          trackingStatus: (row.tracking_status || row.status || 'order_placed') as TrackingStatus,
          paymentStatus: parent?.payment_status || 'unknown',
          items: items
            .filter((it) => it.order_id === row.parent_order_id)
            .map((it) => ({
              name: it.drug_name_snapshot || it.drugs?.name || 'Medication',
              strength: it.drug_strength_snapshot || it.drugs?.strength || '',
              quantity: Number(it.quantity),
              price: Number(it.total_price || it.unit_price * it.quantity),
              dosage: it.dosage_instructions_snapshot || it.drugs?.dosage_instructions || '',
            })),
        };
      });

      setOrders(mapped);
    } catch (error: any) {
      console.error('Failed to load pharmacy orders', error);
      toast.error(error?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    const channel = supabase
      .channel('pharmacy-order-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'child_orders' }, () => void fetchOrders())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const openDetails = async (order: Order) => {
    setSelected(order);
    setImageUrl(null);
    setPendingStatus(null);
    setReason('');
    const { data } = await supabase
      .from('orders')
      .select('prescription_image_url, prescription_id')
      .eq('id', order.parentOrderId)
      .maybeSingle();
    const path = (data as any)?.prescription_image_url as string | null;
    if (path) setImageUrl(await PharmacyService.getPrescriptionImageUrl(path));
  };

  const handleActionClick = (order: Order, status: TrackingStatus) => {
    setSelected(order);
    setPendingStatus(status);
    setReason('');
    // Direct transitions that do not require reasons can be executed immediately or via simple confirm
    if (status !== 'cancelled' && status !== 'rejected') {
      void executeStatusChange(order.id, status, '');
    }
  };

  const executeStatusChange = async (childOrderId: string, newStatus: TrackingStatus, statusReason: string) => {
    setBusyId(childOrderId);
    try {
      const { data, error } = await (supabase.rpc as any)('pharmacy_set_order_status', {
        p_child_order_id: childOrderId,
        p_new_status: newStatus,
        p_reason: statusReason.trim() || null,
      });

      if (error) throw error;

      toast.success(`Order updated: ${statusDisplayLabels[newStatus] || newStatus}`);
      setPendingStatus(null);
      setReason('');
      await fetchOrders();
      setSelected((curr) => (curr && curr.id === childOrderId ? { ...curr, trackingStatus: newStatus } : curr));
    } catch (error: any) {
      console.error('Status update failed:', error);
      toast.error(error?.message || 'Could not update order status');
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          (filter === 'all' || order.trackingStatus === filter) &&
          `${order.customer} ${order.id} ${order.items.map((i) => i.name).join(' ')}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [orders, filter, search]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search orders"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient, order or medication"
          />
        </div>
        <select
          aria-label="Filter by status"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          {Object.entries(statusDisplayLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Orders List */}
      {visible.map((order) => {
        const legalSteps = allowedNextSteps[order.trackingStatus] || [];
        const isDelivered = order.trackingStatus === 'delivered';
        const isTerminated = order.trackingStatus === 'cancelled' || order.trackingStatus === 'rejected';

        return (
          <Card key={order.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div className="min-w-0">
                <CardTitle className="text-base">Order #{order.id.slice(0, 8)}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.customer} · {order.date}
                </p>
              </div>
              <Badge variant="outline">{statusDisplayLabels[order.trackingStatus] || order.trackingStatus}</Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="space-y-1 text-sm">
                {order.items.map((item, index) => (
                  <p key={`${item.name}-${index}`}>
                    <Package className="mr-2 inline h-3.5 w-3.5" />
                    {item.name}
                    {item.strength ? ` · ${item.strength}` : ''} × {item.quantity}
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <strong>₦{order.total.toLocaleString()}</strong>
                <Button variant="outline" size="sm" onClick={() => void openDetails(order)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View order
                </Button>
              </div>

              {/* Status Notice Notes */}
              {isDelivered && (
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Payment released to your wallet minus the platform fee</span>
                </div>
              )}

              {isTerminated && (
                <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Buyer refunded and stock restored</span>
                </div>
              )}

              {/* Action Buttons (Strict Allowed Transitions Only) */}
              {legalSteps.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 border-t">
                  {legalSteps.map((step) => {
                    const isDestructive = step === 'rejected' || step === 'cancelled';
                    const isCurrentBusy = busyId === order.id;

                    return (
                      <Button
                        key={step}
                        size="sm"
                        variant={isDestructive ? 'destructive' : 'default'}
                        disabled={isCurrentBusy}
                        onClick={() => handleActionClick(order, step)}
                        className="text-xs"
                      >
                        {isCurrentBusy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {step === 'out_for_delivery' && <Truck className="mr-1.5 h-3.5 w-3.5" />}
                        {step === 'delivered' && <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                        {actionLabels[step] || statusDisplayLabels[step] || step}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!visible.length && (
        <div className="border border-dashed rounded-lg py-12 text-center text-sm text-muted-foreground">
          <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
          No orders match this filter.
        </div>
      )}

      {/* Order Details Dialog */}
      <Dialog open={Boolean(selected && !pendingStatus)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order #{selected?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-base">{selected.customer}</p>
                <p className="text-muted-foreground">{selected.address || 'No delivery address provided'}</p>
                {selected.phone && (
                  <a className="mt-1 inline-flex items-center gap-1 text-primary" href={`tel:${selected.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    {selected.phone}
                  </a>
                )}
                {selected.instructions && (
                  <p className="mt-2 text-xs bg-muted p-2 rounded">
                    <strong>Instructions:</strong> {selected.instructions}
                  </p>
                )}
              </div>

              <div className="text-xs space-y-1">
                <p>
                  <strong>Payment status:</strong> {selected.paymentStatus}
                </p>
                <p>
                  <strong>Tracking status:</strong> {statusDisplayLabels[selected.trackingStatus]}
                </p>
              </div>

              <div className="space-y-2 border-t pt-2">
                <p className="font-semibold text-xs uppercase text-muted-foreground">Order Items</p>
                {selected.items.map((item, index) => (
                  <div key={index} className="flex justify-between border-b pb-2 text-xs">
                    <div>
                      <span className="font-medium">
                        {item.name}
                        {item.strength ? ` · ${item.strength}` : ''} × {item.quantity}
                      </span>
                      {item.dosage && <span className="block text-[11px] text-muted-foreground">{item.dosage}</span>}
                    </div>
                    <span className="font-semibold">₦{item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {imageUrl && (
                <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                  <Label className="text-xs font-semibold">Prescription Document</Label>
                  <a
                    className="block text-xs text-primary underline break-all font-medium"
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open secure prescription document ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject / Cancel Reason Dialog (Required: 3-500 characters) */}
      <Dialog
        open={Boolean(pendingStatus === 'cancelled' || pendingStatus === 'rejected')}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === 'rejected' ? 'Reject Order' : 'Cancel Order'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {pendingStatus === 'rejected'
                ? 'Please provide a clear reason for rejecting this order. The patient will be refunded automatically and medications returned to stock.'
                : 'Please provide a reason for cancelling this order. Funds in escrow will be refunded to the patient.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="order-reason" className="text-xs">
              Reason (Required, 3 to 500 characters) *
            </Label>
            <Textarea
              id="order-reason"
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Drug out of stock, invalid prescription, delivery location unreachable..."
              className="text-xs"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{reason.trim().length < 3 ? 'Minimum 3 characters required' : 'Valid'}</span>
              <span>{reason.length}/500</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPendingStatus(null);
                setReason('');
              }}
              disabled={busyId !== null}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (selected && pendingStatus) {
                  void executeStatusChange(selected.id, pendingStatus, reason);
                }
              }}
              disabled={reason.trim().length < 3 || reason.trim().length > 500 || busyId !== null}
            >
              {busyId !== null && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirm {pendingStatus === 'rejected' ? 'Rejection' : 'Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}