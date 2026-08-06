"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowLeft, IconLoader2, IconPlus, IconTrash } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { TeamRegistrationCategoryConfig, TeamRegistrationConfig, TeamRegistrationRoundConfig } from "@/types/api";

const BANGKOK_OFFSET = "+07:00";
const defaultCategories: TeamRegistrationCategoryConfig[] = [
  { code: "higher_education_pharmacy", displayName: "อุดมศึกษา — มีนิสิต/นักศึกษาเภสัชศาสตร์", educationLevel: "higher_education", pharmacyRule: "required", isActive: true, displayOrder: 1 },
  { code: "higher_education_general", displayName: "อุดมศึกษา — ทีมทั่วไป", educationLevel: "higher_education", pharmacyRule: "forbidden", isActive: true, displayOrder: 2 },
  { code: "upper_secondary", displayName: "มัธยมศึกษาตอนปลาย", educationLevel: "upper_secondary", pharmacyRule: "forbidden", isActive: true, displayOrder: 3 },
];
const defaultRounds: TeamRegistrationRoundConfig[] = [
  { code: "early_bird", displayName: "Early Bird", startsAt: "2026-08-14T17:00:00.000Z", endsAt: "2026-08-30T17:00:00.000Z", isActive: true },
  { code: "regular", displayName: "Regular", startsAt: "2026-08-31T17:00:00.000Z", endsAt: "2026-09-20T17:00:00.000Z", isActive: true },
];

function initialConfig(): TeamRegistrationConfig {
  return {
    version: 0, isEnabled: false, timezone: "Asia/Bangkok",
    registrationOpensAt: "2026-08-14T17:00:00.000Z", registrationClosesAt: "2026-09-20T17:00:00.000Z",
    minMembers: 3, maxMembers: 5, minAge: 15, maxAge: 30, draftTtlHours: 72,
    paymentAttemptTtlMinutes: 30, paymentProfileCode: "team_registration_default",
    eventWebsiteOrigin: "https://team-event.example.com", paymentResultUrl: "https://team-event.example.com/payment/result",
    categories: defaultCategories, pricingRounds: defaultRounds,
    prices: [
      { pricingRoundCode: "early_bird", categoryCode: "higher_education_pharmacy", amount: 700, currency: "THB" },
      { pricingRoundCode: "early_bird", categoryCode: "higher_education_general", amount: 750, currency: "THB" },
      { pricingRoundCode: "early_bird", categoryCode: "upper_secondary", amount: 750, currency: "THB" },
      { pricingRoundCode: "regular", categoryCode: "higher_education_pharmacy", amount: 800, currency: "THB" },
      { pricingRoundCode: "regular", categoryCode: "higher_education_general", amount: 850, currency: "THB" },
      { pricingRoundCode: "regular", categoryCode: "upper_secondary", amount: 850, currency: "THB" },
    ],
  };
}

export default function TeamRegistrationSettingsPage() {
  const params = useParams<{ id: string }>();
  const eventId = Number(params.id);
  const { token, isAdmin } = useAuth();
  const [config, setConfig] = useState<TeamRegistrationConfig>(initialConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !eventId || !isAdmin) return;
    setLoading(true); setError("");
    try {
      const loaded = (await api.teamRegistrations.getConfig(token, eventId)).data.config;
      if (!loaded) { setConfig(initialConfig()); return; }
      const categories = loaded.categories;
      const pricingRounds = loaded.pricingRounds;
      const prices = loaded.prices.map((price) => ({
        ...price,
        pricingRoundCode: price.pricingRoundCode || pricingRounds.find((round) => round.id === price.pricingRoundId)?.code || "",
        categoryCode: price.categoryCode || categories.find((category) => category.id === price.categoryId)?.code || "",
      })).filter((price) => price.pricingRoundCode && price.categoryCode);
      setConfig({ ...loaded, categories, pricingRounds, prices });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load settings"); }
    finally { setLoading(false); }
  }, [token, eventId, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const matrix = useMemo(() => {
    const result = new Map<string, number>();
    for (const price of config.prices) result.set(`${price.pricingRoundCode}:${price.categoryCode}`, Number(price.amount));
    return result;
  }, [config.prices]);

  const setPrice = (roundCode: string, categoryCode: string, amount: number) => {
    const key = `${roundCode}:${categoryCode}`;
    const next = config.prices.filter((price) => `${price.pricingRoundCode}:${price.categoryCode}` !== key);
    next.push({ pricingRoundCode: roundCode, categoryCode, amount, currency: "THB" });
    setConfig({ ...config, prices: next });
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const activeCategories = config.categories.filter((category) => category.isActive);
      const activeRounds = config.pricingRounds.filter((round) => round.isActive);
      const prices = activeRounds.flatMap((round) => activeCategories.map((category) => ({
        pricingRoundCode: round.code, categoryCode: category.code,
        amount: matrix.get(`${round.code}:${category.code}`) ?? 0, currency: "THB" as const,
      })));
      await api.teamRegistrations.saveConfig(token, eventId, { ...config, prices });
      toast.success("Team registration settings saved"); await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to save settings"); }
    finally { setSaving(false); }
  };

  if (!isAdmin) return <AdminLayout title="Team Registration Settings"><div className="card bg-red-50 text-red-700">Admin access is required.</div></AdminLayout>;
  return <AdminLayout title="Team Registration Settings">
    <Link href="/team-registrations" className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-700"><IconArrowLeft size={18} /> Back to team registrations</Link>
    {loading ? <div className="card flex justify-center py-20"><IconLoader2 className="animate-spin text-emerald-600" /></div> : <div className="space-y-6">
      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      <section className="card"><div className="flex justify-between gap-4"><div><h2 className="font-semibold text-zinc-900">Availability</h2><p className="text-sm text-zinc-500">Configuration remains disabled until explicitly enabled.</p></div><Toggle checked={config.isEnabled} onChange={(checked) => setConfig({ ...config, isEnabled: checked })} /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <DateField label="Registration opens (Bangkok)" value={config.registrationOpensAt} onChange={(value) => setConfig({ ...config, registrationOpensAt: value })} />
          <DateField label="Registration closes (Bangkok)" value={config.registrationClosesAt} onChange={(value) => setConfig({ ...config, registrationClosesAt: value })} />
          <Field label="External Event website origin" value={config.eventWebsiteOrigin} onChange={(value) => setConfig({ ...config, eventWebsiteOrigin: value })} />
          <Field label="Payment result URL" value={config.paymentResultUrl} onChange={(value) => setConfig({ ...config, paymentResultUrl: value })} />
          <Field label="Payment profile code" value={config.paymentProfileCode} onChange={(value) => setConfig({ ...config, paymentProfileCode: value })} />
          <Field label="Timezone" value={config.timezone} disabled onChange={() => undefined} />
        </div>
      </section>

      <section className="card"><h2 className="font-semibold mb-4">Registration rules</h2><div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <NumberField label="Min members" value={config.minMembers} onChange={(value) => setConfig({ ...config, minMembers: value })} />
        <NumberField label="Max members" value={config.maxMembers} onChange={(value) => setConfig({ ...config, maxMembers: value })} />
        <NumberField label="Min age" value={config.minAge} onChange={(value) => setConfig({ ...config, minAge: value })} />
        <NumberField label="Max age" value={config.maxAge} onChange={(value) => setConfig({ ...config, maxAge: value })} />
        <NumberField label="Draft TTL (hours)" value={config.draftTtlHours} onChange={(value) => setConfig({ ...config, draftTtlHours: value })} />
        <NumberField label="Payment TTL (min)" value={config.paymentAttemptTtlMinutes} onChange={(value) => setConfig({ ...config, paymentAttemptTtlMinutes: value })} />
      </div></section>

      <section className="card"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Team categories</h2><p className="text-sm text-zinc-500">Codes become stable API identifiers after use.</p></div><button className="btn-secondary inline-flex items-center gap-2" onClick={() => setConfig({ ...config, categories: [...config.categories, { code: `category_${config.categories.length + 1}`, displayName: "New category", educationLevel: "higher_education", pharmacyRule: "forbidden", isActive: true, displayOrder: config.categories.length + 1 }] })}><IconPlus size={17} /> Add</button></div>
        <div className="space-y-3">{config.categories.map((category, index) => <div key={`${category.code}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1fr_auto] gap-3 rounded-xl border p-4">
          <Field label="Code" value={category.code} onChange={(value) => updateCategory(config, setConfig, index, { code: slug(value) })} />
          <Field label="Display name" value={category.displayName} onChange={(value) => updateCategory(config, setConfig, index, { displayName: value })} />
          <Select label="Education" value={category.educationLevel} options={[['higher_education','Higher education'],['upper_secondary','Upper secondary']]} onChange={(value) => updateCategory(config, setConfig, index, { educationLevel: value as TeamRegistrationCategoryConfig['educationLevel'] })} />
          <Select label="Pharmacy rule" value={category.pharmacyRule} options={[['required','At least one'],['forbidden','Forbidden']]} onChange={(value) => updateCategory(config, setConfig, index, { pharmacyRule: value as TeamRegistrationCategoryConfig['pharmacyRule'] })} />
          <button title="Remove category" className="self-end p-3 text-red-500" onClick={() => setConfig({ ...config, categories: config.categories.filter((_, position) => position !== index) })}><IconTrash size={18} /></button>
        </div>)}</div>
      </section>

      <section className="card"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Pricing rounds</h2><p className="text-sm text-zinc-500">Intervals use Bangkok time and may intentionally contain gaps.</p></div><button className="btn-secondary inline-flex items-center gap-2" onClick={() => setConfig({ ...config, pricingRounds: [...config.pricingRounds, { code: `round_${config.pricingRounds.length + 1}`, displayName: "New round", startsAt: config.registrationOpensAt, endsAt: config.registrationClosesAt, isActive: true }] })}><IconPlus size={17} /> Add</button></div>
        <div className="space-y-3">{config.pricingRounds.map((round, index) => <div key={`${round.code}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto] gap-3 rounded-xl border p-4">
          <Field label="Code" value={round.code} onChange={(value) => updateRound(config, setConfig, index, { code: slug(value) })} />
          <Field label="Display name" value={round.displayName} onChange={(value) => updateRound(config, setConfig, index, { displayName: value })} />
          <DateField label="Starts (Bangkok)" value={round.startsAt} onChange={(value) => updateRound(config, setConfig, index, { startsAt: value })} />
          <DateField label="Ends (Bangkok)" value={round.endsAt} onChange={(value) => updateRound(config, setConfig, index, { endsAt: value })} />
          <button title="Remove round" className="self-end p-3 text-red-500" onClick={() => setConfig({ ...config, pricingRounds: config.pricingRounds.filter((_, position) => position !== index) })}><IconTrash size={18} /></button>
        </div>)}</div>
      </section>

      <section className="card"><h2 className="font-semibold mb-4">Price matrix (THB per team)</h2><div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr className="bg-zinc-50"><th className="p-3 text-left text-sm">Pricing round</th>{config.categories.map((category) => <th key={category.code} className="p-3 text-left text-sm">{category.displayName}</th>)}</tr></thead><tbody>{config.pricingRounds.map((round) => <tr key={round.code} className="border-t"><td className="p-3 font-medium">{round.displayName}</td>{config.categories.map((category) => <td className="p-3" key={category.code}><input type="number" min={0} step="1" className="input-field" value={matrix.get(`${round.code}:${category.code}`) ?? 0} onChange={(event) => setPrice(round.code, category.code, Number(event.target.value))} /></td>)}</tr>)}</tbody></table></div></section>

      <div className="sticky bottom-4 flex justify-end"><button className="btn-primary px-6 inline-flex items-center gap-2 shadow-lg" disabled={saving} onClick={save}>{saving && <IconLoader2 size={17} className="animate-spin" />} Save settings</button></div>
    </div>}
  </AdminLayout>;
}

function updateCategory(config: TeamRegistrationConfig, setConfig: (value: TeamRegistrationConfig) => void, index: number, update: Partial<TeamRegistrationCategoryConfig>) { setConfig({ ...config, categories: config.categories.map((item, position) => position === index ? { ...item, ...update } : item) }); }
function updateRound(config: TeamRegistrationConfig, setConfig: (value: TeamRegistrationConfig) => void, index: number, update: Partial<TeamRegistrationRoundConfig>) { setConfig({ ...config, pricingRounds: config.pricingRounds.map((item, position) => position === index ? { ...item, ...update } : item) }); }
function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function toBangkokInput(iso: string) { const date = new Date(iso); return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16); }
function fromBangkokInput(value: string) { return new Date(`${value}:00${BANGKOK_OFFSET}`).toISOString(); }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-medium text-zinc-600">{label}<input type="datetime-local" className="input-field mt-1" value={toBangkokInput(value)} onChange={(event) => onChange(fromBangkokInput(event.target.value))} /></label>; }
function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) { return <label className="text-sm font-medium text-zinc-600">{label}<input className="input-field mt-1" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-sm font-medium text-zinc-600">{label}<input type="number" min={1} className="input-field mt-1" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) { return <label className="text-sm font-medium text-zinc-600">{label}<select className="input-field mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>; }
function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-zinc-300'}`}><span className={`h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button>; }
