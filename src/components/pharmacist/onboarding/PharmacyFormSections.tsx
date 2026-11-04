import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2,
  LocateFixed,
  Upload,
  X,
  Lock,
  Building2,
  Phone,
  Mail,
  User,
  Award,
  MapPin,
  Compass,
  Clock,
  Truck,
  Snowflake,
  CreditCard,
  ShieldCheck,
  Store,
} from 'lucide-react';
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

function SectionCard({
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-foreground">{title}</h4>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/90">
        {label} {required && <span className="text-destructive font-semibold">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-normal">{hint}</p>}
    </div>
  );
}

const lockedHint = 'Contact support to change this after approval.';

export function BusinessSection({
  form,
  set,
  disabled,
  regLocked,
  pharmacyId,
  userId,
}: SectionProps & { pharmacyId: string; userId: string }) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const onLogo = async (file?: File) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const url = await PharmacyOnboardingService.uploadLogo(pharmacyId, userId, file);
      set('logo_url', url);
      toast.success('Logo updated successfully');
    } catch (e) {
      toast.error(errMsg(e, 'Logo upload failed'));
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Brand Identity & Logo */}
      <SectionCard
        icon={Store}
        title="Brand Identity & Storefront"
        description="Pharmacy name and public storefront appearance seen by customers"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border bg-background overflow-hidden flex items-center justify-center text-xs text-muted-foreground shadow-2xs flex-shrink-0">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Pharmacy logo" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2 text-muted-foreground">
                <Store className="w-5 h-5 mb-1 opacity-40" />
                <span className="text-[10px]">No logo</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <p className="text-xs font-semibold text-foreground">Pharmacy Logo</p>
            <p className="text-[11px] text-muted-foreground">
              Recommended format: JPG, PNG, or WebP. Max size: 5MB. Clear logos improve trust with patients.
            </p>
            <div className="pt-1">
              <input
                ref={logoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || logoBusy}
                onClick={() => logoRef.current?.click()}
                className="gap-1.5 text-xs h-8"
              >
                {logoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {form.logo_url ? 'Change Logo' : 'Upload Pharmacy Logo'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pharmacy legal name" required>
            <Input
              value={form.business_name}
              disabled={disabled}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="e.g. HealthCare Pharmacy Ltd"
            />
          </Field>
          <Field label="Trading name (if different)" hint="Optional DBA or branch label">
            <Input
              value={form.trading_name}
              disabled={disabled}
              onChange={(e) => set('trading_name', e.target.value)}
              placeholder="e.g. HealthCare Victoria Island"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Statutory Credentials & Regulatory Registration */}
      <SectionCard
        icon={ShieldCheck}
        title="Statutory Credentials & Licensing"
        description="Official corporate registration and Pharmacists Council of Nigeria (PCN) credentials"
        badge={
          regLocked ? (
            <Badge variant="outline" className="border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 text-[11px] font-normal">
              <Lock className="w-3 h-3" /> Reg. Numbers Locked
            </Badge>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration Number (RC No.)" required hint={regLocked ? lockedHint : undefined}>
            <div className="relative">
              <Input
                value={form.cac_rc_number}
                disabled={disabled || regLocked}
                onChange={(e) => set('cac_rc_number', e.target.value)}
                placeholder="e.g. RC-123456"
                className={regLocked ? 'bg-muted/50 cursor-not-allowed pr-8' : ''}
              />
              {regLocked && <Lock className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted-foreground/60" />}
            </div>
          </Field>

          <Field label="PCN Premises License Number" required hint={regLocked ? lockedHint : undefined}>
            <div className="relative">
              <Input
                value={form.license_number}
                disabled={disabled || regLocked}
                onChange={(e) => set('license_number', e.target.value)}
                placeholder="e.g. PCN/PREM/2024/0000"
                className={regLocked ? 'bg-muted/50 cursor-not-allowed pr-8' : ''}
              />
              {regLocked && <Lock className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted-foreground/60" />}
            </div>
          </Field>

          <Field label="PCN premises license expiry date" required hint="Must be renewed annually">
            <Input
              type="date"
              value={form.pcn_premises_license_expiry}
              disabled={disabled}
              onChange={(e) => set('pcn_premises_license_expiry', e.target.value)}
            />
          </Field>

          <Field label="NAFDAC / NDLEA authorization number" hint="Required if dispensing controlled drugs">
            <Input
              value={form.nafdac_ndlea_number}
              disabled={disabled}
              onChange={(e) => set('nafdac_ndlea_number', e.target.value)}
              placeholder="Optional NAFDAC / NDLEA Ref"
            />
          </Field>

          <Field label="Year established">
            <Input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={form.year_established}
              disabled={disabled}
              onChange={(e) => set('year_established', e.target.value)}
              placeholder="e.g. 2018"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Official Communication Channels */}
      <SectionCard
        icon={Phone}
        title="Official Communication Channels"
        description="Primary contact endpoints used for system notices, alerts, and prescription queries"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pharmacy official email" required>
            <Input
              type="email"
              value={form.email}
              disabled={disabled}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@pharmacy.com"
            />
          </Field>

          <Field label="Pharmacy main phone" required>
            <Input
              type="tel"
              value={form.phone}
              disabled={disabled}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </Field>

          <Field label="WhatsApp number" hint="Direct customer support chat">
            <Input
              type="tel"
              value={form.whatsapp_number}
              disabled={disabled}
              onChange={(e) => set('whatsapp_number', e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function ContactsSection({ form, set, disabled, regLocked }: SectionProps) {
  return (
    <div className="space-y-5">
      {/* Account Contact Person */}
      <SectionCard
        icon={User}
        title="Account & Operations Contact Person"
        description="Liaison officer responsible for order handling, billing, and platform notifications"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input
              value={form.contact_person_name}
              disabled={disabled}
              onChange={(e) => set('contact_person_name', e.target.value)}
              placeholder="e.g. John Doe"
            />
          </Field>
          <Field label="Phone number" required>
            <Input
              type="tel"
              value={form.contact_person_phone}
              disabled={disabled}
              onChange={(e) => set('contact_person_phone', e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Email address">
              <Input
                type="email"
                value={form.contact_person_email}
                disabled={disabled}
                onChange={(e) => set('contact_person_email', e.target.value)}
                placeholder="operations@pharmacy.com"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* Superintendent (Lead) Pharmacist */}
      <SectionCard
        icon={Award}
        title="Superintendent (Lead) Pharmacist"
        description="Licensed pharmacist legally in charge of the premises under PCN regulations"
        badge={
          regLocked ? (
            <Badge variant="outline" className="border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 text-[11px] font-normal">
              <Lock className="w-3 h-3" /> PCN Locked
            </Badge>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Superintendent full name" required>
            <Input
              value={form.pharmacist_full_name}
              disabled={disabled}
              onChange={(e) => set('pharmacist_full_name', e.target.value)}
              placeholder="Pharm. Firstname Lastname"
            />
          </Field>

          <Field label="PCN registration number" required hint={regLocked ? lockedHint : undefined}>
            <div className="relative">
              <Input
                value={form.pharmacist_pcn_number}
                disabled={disabled || regLocked}
                onChange={(e) => set('pharmacist_pcn_number', e.target.value)}
                placeholder="e.g. PCN-12345"
                className={regLocked ? 'bg-muted/50 cursor-not-allowed pr-8' : ''}
              />
              {regLocked && <Lock className="w-3.5 h-3.5 absolute right-2.5 top-3 text-muted-foreground/60" />}
            </div>
          </Field>

          <Field label="Annual practicing license expiry" required hint="Must be current">
            <Input
              type="date"
              value={form.pharmacist_license_expiry}
              disabled={disabled}
              onChange={(e) => set('pharmacist_license_expiry', e.target.value)}
            />
          </Field>

          <Field label="Direct phone number" required>
            <Input
              type="tel"
              value={form.pharmacist_phone}
              disabled={disabled}
              onChange={(e) => set('pharmacist_phone', e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Direct email" required>
              <Input
                type="email"
                value={form.pharmacist_email}
                disabled={disabled}
                onChange={(e) => set('pharmacist_email', e.target.value)}
                placeholder="pharmacist@pharmacy.com"
              />
            </Field>
          </div>
        </div>
      </SectionCard>
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
        toast.success('Location coordinates updated successfully');
      },
      () => {
        toast.error('Could not get your location. You can enter coordinates manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-5">
      {/* Physical Storefront Address */}
      <SectionCard
        icon={MapPin}
        title="Physical Storefront Address"
        description="Physical dispensary location where orders are prepared and fulfilled"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State" required>
            <Select
              value={form.state}
              disabled={disabled}
              onValueChange={(v) => {
                set('state', v);
                set('city', '');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIA_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="City / LGA" required>
            <Select
              value={form.city}
              disabled={disabled || !form.state}
              onValueChange={(v) => set('city', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.state ? 'Select city / LGA' : 'Select state first'} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Street address" required hint="Include building number and street name">
              <Input
                value={form.street}
                disabled={disabled}
                onChange={(e) => set('street', e.target.value)}
                placeholder="e.g. 15 Admiralty Way, Lekki Phase 1"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Nearest landmark" hint="Helps dispatch riders locate your pharmacy quickly">
              <Input
                value={form.landmark}
                disabled={disabled}
                onChange={(e) => set('landmark', e.target.value)}
                placeholder="e.g. Opposite Hubmart Stores"
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      {/* GPS Coordinates */}
      <SectionCard
        icon={Compass}
        title="Geographic Coordinates (GPS)"
        description="Precise pin used to calculate delivery radiuses and route dispatch drivers accurately"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" hint="e.g. 6.447400">
            <Input
              value={form.latitude}
              disabled={disabled}
              onChange={(e) => set('latitude', e.target.value)}
              inputMode="decimal"
              placeholder="6.447400"
            />
          </Field>
          <Field label="Longitude" hint="e.g. 3.473100">
            <Input
              value={form.longitude}
              disabled={disabled}
              onChange={(e) => set('longitude', e.target.value)}
              inputMode="decimal"
              placeholder="3.473100"
            />
          </Field>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/40">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Automatic Geolocation</p>
            <p className="text-[11px]">Stand inside your pharmacy premises for the highest GPS accuracy.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || locating}
            onClick={useMyLocation}
            className="gap-1.5 text-xs h-8 flex-shrink-0"
          >
            {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-primary" />}
            Detect Current Location
          </Button>
        </div>
      </SectionCard>
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

  const Toggle = ({
    k,
    label,
    hint,
  }: {
    k: 'offers_delivery' | 'offers_pickup' | 'handles_controlled_drugs' | 'handles_cold_chain' | 'accepts_hmo' | 'is_24_hours';
    label: string;
    hint?: string;
  }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 bg-muted/20">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Switch checked={form[k]} disabled={disabled} onCheckedChange={(v) => set(k, v)} />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Operating Schedule */}
      <SectionCard
        icon={Clock}
        title="Operating Schedule"
        description="Set customer order processing hours and 24-hour service availability"
      >
        <div className="space-y-3">
          <Toggle k="is_24_hours" label="Open 24 hours daily" hint="Pharmacy operates around the clock every day" />

          {!form.is_24_hours && (
            <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden bg-background">
              {DAYS.map((d) => {
                const h = form.opening_hours[d];
                return (
                  <div key={d} className="flex flex-wrap items-center justify-between gap-2 p-2.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 w-28">
                      <span className="text-xs font-semibold">{DAY_LABELS[d]}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={!h.closed}
                          disabled={disabled}
                          onCheckedChange={(v) => setDay(d, { closed: !v })}
                        />
                        <span className="text-[11px] text-muted-foreground w-12">
                          {h.closed ? 'Closed' : 'Open'}
                        </span>
                      </div>
                      {!h.closed && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time"
                            value={h.open}
                            disabled={disabled}
                            onChange={(e) => setDay(d, { open: e.target.value })}
                            className="h-8 w-24 text-xs px-2"
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={h.close}
                            disabled={disabled}
                            onChange={(e) => setDay(d, { close: e.target.value })}
                            className="h-8 w-24 text-xs px-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Fulfillment & Delivery */}
      <SectionCard
        icon={Truck}
        title="Fulfillment & Delivery Settings"
        description="Configure patient delivery coverage, fees, and storefront pickup options"
      >
        <div className="space-y-3">
          <Toggle k="offers_delivery" label="Offer home delivery" hint="Enable prescription & OTC medicine delivery to patient addresses" />

          {form.offers_delivery && (
            <div className="grid gap-4 sm:grid-cols-2 p-3.5 rounded-lg bg-muted/40 border border-border/50">
              <Field label="Delivery radius (km)" hint="Max distance for dispatch rider orders">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.delivery_radius_km}
                  disabled={disabled}
                  onChange={(e) => set('delivery_radius_km', e.target.value)}
                  placeholder="e.g. 10"
                />
              </Field>
              <Field label="Delivery fee (₦)" hint="Flat or base delivery rate">
                <Input
                  type="number"
                  min={0}
                  value={form.delivery_fee}
                  disabled={disabled}
                  onChange={(e) => set('delivery_fee', e.target.value)}
                  placeholder="e.g. 1500"
                />
              </Field>
            </div>
          )}

          <Toggle k="offers_pickup" label="Offer in-store pickup" hint="Patients can order online and collect in person at your pharmacy" />
        </div>
      </SectionCard>

      {/* Clinical Capabilities & Insurance */}
      <SectionCard
        icon={Snowflake}
        title="Specialized Storage & Insurance Capabilities"
        description="Dispensary equipment capabilities and health insurance partner integration"
      >
        <div className="space-y-3">
          <Toggle
            k="handles_cold_chain"
            label="Refrigerated cold-chain storage"
            hint="Equipped for vaccines, biologics, insulin, and temperature-sensitive drugs"
          />

          <Toggle
            k="handles_controlled_drugs"
            label="Handles controlled / scheduled drugs"
            hint="Requires authorized NAFDAC / NDLEA permit document on file"
          />

          <Toggle
            k="accepts_hmo"
            label="Accepts HMO / Health Insurance"
            hint="Allows insured patients to submit claims through supported health maintenance organizations"
          />

          {form.accepts_hmo && (
            <div className="space-y-2.5 p-3.5 rounded-lg bg-muted/40 border border-border/50">
              <Label className="text-xs font-medium">Supported HMO Partners</Label>
              <div className="flex gap-2">
                <Input
                  value={tag}
                  disabled={disabled}
                  placeholder="Type HMO name and click Add (e.g. AXA Mansard, Hygeia)"
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="text-xs"
                />
                <Button type="button" size="sm" variant="secondary" disabled={disabled || !tag.trim()} onClick={addTag} className="h-9 px-3 text-xs">
                  Add HMO
                </Button>
              </div>

              {form.hmo_partners.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.hmo_partners.map((p) => (
                    <Badge key={p} variant="secondary" className="gap-1 text-xs py-1 px-2.5 bg-background border border-border/60">
                      {p}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => set('hmo_partners', form.hmo_partners.filter((x) => x !== p))}
                          className="text-muted-foreground hover:text-destructive ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">No HMO partners added yet.</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function PayoutSection({ form, set, disabled }: SectionProps) {
  return (
    <div className="space-y-5">
      <SectionCard
        icon={CreditCard}
        title="Settlement & Payout Account"
        description="Designated Nigerian commercial bank account for order settlements and prescription revenue disbursements"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name" required hint="Commercial or licensed microfinance bank">
            <Input
              value={form.payout_bank_name}
              disabled={disabled}
              onChange={(e) => set('payout_bank_name', e.target.value)}
              placeholder="e.g. Access Bank, GTBank, Zenith"
            />
          </Field>

          <Field label="NUBAN account number" required hint="Exactly 10 digits">
            <Input
              value={form.payout_account_number}
              disabled={disabled}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => set('payout_account_number', e.target.value.replace(/\D/g, ''))}
              placeholder="0123456789"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Account beneficiary name" required hint="Should match official registered business name or superintendent pharmacist">
              <Input
                value={form.payout_account_name}
                disabled={disabled}
                onChange={(e) => set('payout_account_name', e.target.value)}
                placeholder="e.g. HealthCare Pharmacy Limited"
              />
            </Field>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Automated Order Disbursements</p>
            <p className="text-[11px] mt-0.5">
              Payouts from patient orders are deposited into this account upon order delivery confirmation. Ensure account name corresponds with CAC records.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
