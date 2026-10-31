import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LocateFixed, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { NIGERIA_STATES, citiesForState } from '@/lib/nigeriaLocations';
import { PharmacyOnboardingService, errMsg } from '@/services/PharmacyOnboardingService';
import { DAYS, DAY_LABELS, type PharmacyForm } from './pharmacyForm';

export interface SectionProps {
  form: PharmacyForm;
  set: <K extends keyof PharmacyForm>(key: K, value: PharmacyForm[K]) => void;
  disabled?: boolean;
  /** RC no., PCN premises number and pharmacist PCN number cannot change after approval. */
  regLocked?: boolean;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const lockedHint = 'Contact support to change this after approval.';

export function BusinessSection({ form, set, disabled, regLocked, pharmacyId, userId }: SectionProps & { pharmacyId: string; userId: string }) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const onLogo = async (file?: File) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const url = await PharmacyOnboardingService.uploadLogo(pharmacyId, userId, file);
      set('logo_url', url);
      toast.success('Logo updated');
    } catch (e) {
      toast.error(errMsg(e, 'Logo upload failed'));
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border bg-muted/40 overflow-hidden flex items-center justify-center text-[10px] text-muted-foreground">
          {form.logo_url ? <img src={form.logo_url} alt="Pharmacy logo" className="w-full h-full object-cover" /> : 'No logo'}
        </div>
        <div>
          <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="outline" disabled={disabled || logoBusy} onClick={() => logoRef.current?.click()} className="gap-1.5 text-xs">
            {logoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload pharmacy logo
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1">jpg, jpeg, png, webp · max 5MB (optional)</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pharmacy name" required>
          <Input value={form.business_name} disabled={disabled} onChange={(e) => set('business_name', e.target.value)} placeholder="Enter pharmacy name" />
        </Field>
        <Field label="Trading name (if different)">
          <Input value={form.trading_name} disabled={disabled} onChange={(e) => set('trading_name', e.target.value)} />
        </Field>
        <Field label="Registration Number (RC No.)" required hint={regLocked ? lockedHint : undefined}>
          <Input value={form.cac_rc_number} disabled={disabled || regLocked} onChange={(e) => set('cac_rc_number', e.target.value)} placeholder="Enter registration number" />
        </Field>
        <Field label="PCN Premises License Number" required hint={regLocked ? lockedHint : undefined}>
          <Input value={form.license_number} disabled={disabled || regLocked} onChange={(e) => set('license_number', e.target.value)} placeholder="Enter PCN Premises License Number" />
        </Field>
        <Field label="PCN premises license expiry date" required>
          <Input type="date" value={form.pcn_premises_license_expiry} disabled={disabled} onChange={(e) => set('pcn_premises_license_expiry', e.target.value)} />
        </Field>
        <Field label="NAFDAC / NDLEA number (if applicable)">
          <Input value={form.nafdac_ndlea_number} disabled={disabled} onChange={(e) => set('nafdac_ndlea_number', e.target.value)} />
        </Field>
        <Field label="Pharmacy email" required>
          <Input type="email" value={form.email} disabled={disabled} onChange={(e) => set('email', e.target.value)} placeholder="Enter e-mail address" />
        </Field>
        <Field label="Pharmacy phone number" required>
          <Input type="tel" value={form.phone} disabled={disabled} onChange={(e) => set('phone', e.target.value)} placeholder="+234 800 000 0000" />
        </Field>
        <Field label="WhatsApp number">
          <Input type="tel" value={form.whatsapp_number} disabled={disabled} onChange={(e) => set('whatsapp_number', e.target.value)} />
        </Field>
        <Field label="Year established">
          <Input type="number" min={1900} max={new Date().getFullYear()} value={form.year_established} disabled={disabled} onChange={(e) => set('year_established', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

export function ContactsSection({ form, set, disabled, regLocked }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Account contact person</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.contact_person_name} disabled={disabled} onChange={(e) => set('contact_person_name', e.target.value)} />
          </Field>
          <Field label="Phone number" required>
            <Input type="tel" value={form.contact_person_phone} disabled={disabled} onChange={(e) => set('contact_person_phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.contact_person_email} disabled={disabled} onChange={(e) => set('contact_person_email', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Superintendent (lead) pharmacist</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.pharmacist_full_name} disabled={disabled} onChange={(e) => set('pharmacist_full_name', e.target.value)} />
          </Field>
          <Field label="PCN registration number" required hint={regLocked ? lockedHint : undefined}>
            <Input value={form.pharmacist_pcn_number} disabled={disabled || regLocked} onChange={(e) => set('pharmacist_pcn_number', e.target.value)} />
          </Field>
          <Field label="Annual practicing license expiry" required>
            <Input type="date" value={form.pharmacist_license_expiry} disabled={disabled} onChange={(e) => set('pharmacist_license_expiry', e.target.value)} />
          </Field>
          <Field label="Phone number" required>
            <Input type="tel" value={form.pharmacist_phone} disabled={disabled} onChange={(e) => set('pharmacist_phone', e.target.value)} />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.pharmacist_email} disabled={disabled} onChange={(e) => set('pharmacist_email', e.target.value)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

export function LocationSection({ form, set, disabled }: SectionProps) {
  const [locating, setLocating] = useState(false);
  const cities = citiesForState(form.state);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported on this device.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        toast.error('Could not get your location. You can enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="State" required>
        <Select value={form.state} disabled={disabled} onValueChange={(v) => { set('state', v); set('city', ''); }}>
          <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
          <SelectContent>{NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="City / LGA" required>
        <Select value={form.city} disabled={disabled || !form.state} onValueChange={(v) => set('city', v)}>
          <SelectTrigger><SelectValue placeholder={form.state ? 'Select city / LGA' : 'Select state first'} /></SelectTrigger>
          <SelectContent>{cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Street address" required>
          <Input value={form.street} disabled={disabled} onChange={(e) => set('street', e.target.value)} placeholder="Enter street address" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Landmark">
          <Input value={form.landmark} disabled={disabled} onChange={(e) => set('landmark', e.target.value)} placeholder="Enter a landmark" />
        </Field>
      </div>
      <Field label="Latitude" hint="Helps nearby patients find you">
        <Input value={form.latitude} disabled={disabled} onChange={(e) => set('latitude', e.target.value)} inputMode="decimal" />
      </Field>
      <Field label="Longitude">
        <Input value={form.longitude} disabled={disabled} onChange={(e) => set('longitude', e.target.value)} inputMode="decimal" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || locating} onClick={useMyLocation} className="gap-1.5 text-xs">
          {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
          Use my current location
        </Button>
        <p className="text-[11px] text-muted-foreground mt-1">Stand inside the pharmacy for the most accurate pin.</p>
      </div>
    </div>
  );
}

export function OperationsSection({ form, set, disabled }: SectionProps) {
  const [tag, setTag] = useState('');
  const addTag = () => {
    const v = tag.trim();
    if (v && !form.hmo_partners.includes(v)) set('hmo_partners', [...form.hmo_partners, v]);
    setTag('');
  };
  const setDay = (d: (typeof DAYS)[number], patch: Partial<PharmacyForm['opening_hours'][typeof d]>) =>
    set('opening_hours', { ...form.opening_hours, [d]: { ...form.opening_hours[d], ...patch } });

  const Toggle = ({ k, label, hint }: { k: 'offers_delivery' | 'offers_pickup' | 'handles_controlled_drugs' | 'handles_cold_chain' | 'accepts_hmo' | 'is_24_hours'; label: string; hint?: string }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={form[k]} disabled={disabled} onCheckedChange={(v) => set(k, v)} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Toggle k="is_24_hours" label="Open 24 hours" />
        {!form.is_24_hours && (
          <div className="rounded-lg border divide-y">
            {DAYS.map((d) => {
              const h = form.opening_hours[d];
              return (
                <div key={d} className="flex flex-wrap items-center gap-2 p-2.5">
                  <span className="w-24 text-xs font-medium">{DAY_LABELS[d]}</span>
                  <Switch checked={!h.closed} disabled={disabled} onCheckedChange={(v) => setDay(d, { closed: !v })} />
                  {h.closed ? (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ) : (
                    <>
                      <Input type="time" value={h.open} disabled={disabled} onChange={(e) => setDay(d, { open: e.target.value })} className="h-8 w-28 text-xs" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" value={h.close} disabled={disabled} onChange={(e) => setDay(d, { close: e.target.value })} className="h-8 w-28 text-xs" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Toggle k="offers_delivery" label="Offer delivery" />
        {form.offers_delivery && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery radius (km)">
              <Input type="number" min={0} step="0.5" value={form.delivery_radius_km} disabled={disabled} onChange={(e) => set('delivery_radius_km', e.target.value)} />
            </Field>
            <Field label="Delivery fee (₦)">
              <Input type="number" min={0} value={form.delivery_fee} disabled={disabled} onChange={(e) => set('delivery_fee', e.target.value)} />
            </Field>
          </div>
        )}
        <Toggle k="offers_pickup" label="Offer in-store pickup" />
      </div>

      <div className="space-y-2">
        <Toggle k="handles_controlled_drugs" label="Handles controlled drugs" hint="A NAFDAC / NDLEA authorization document becomes required." />
        <Toggle k="handles_cold_chain" label="Handles cold-chain products" hint="Vaccines, insulin and other refrigerated medicines." />
        <Toggle k="accepts_hmo" label="Accepts HMO / insurance" />
        {form.accepts_hmo && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={tag} disabled={disabled} placeholder="Add an HMO partner and press Enter" onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" disabled={disabled} onClick={addTag}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.hmo_partners.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1">
                  {p}
                  {!disabled && <button type="button" onClick={() => set('hmo_partners', form.hmo_partners.filter((x) => x !== p))}><X className="w-3 h-3" /></button>}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PayoutSection({ form, set, disabled }: SectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Bank name">
        <Input value={form.payout_bank_name} disabled={disabled} onChange={(e) => set('payout_bank_name', e.target.value)} />
      </Field>
      <Field label="Account number" hint="Exactly 10 digits">
        <Input value={form.payout_account_number} disabled={disabled} inputMode="numeric" maxLength={10}
          onChange={(e) => set('payout_account_number', e.target.value.replace(/\D/g, ''))} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Account name" hint="Should match the business or the superintendent pharmacist">
          <Input value={form.payout_account_name} disabled={disabled} onChange={(e) => set('payout_account_name', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}
