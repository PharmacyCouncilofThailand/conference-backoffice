// One stable color per PRIS holder type, shared by the check-in desk popup and
// dashboard so a type always reads the same everywhere. Gold is reserved for VIP.

export interface HolderTypeTone {
  badge: string; // pill: border + background + text
  bar: string; // progress bar fill
  dot: string; // small legend dot
}

const TONES: Record<string, HolderTypeTone> = {
  vip: { badge: 'border-amber-300 bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 text-amber-950', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  council_committee: { badge: 'border-indigo-300 bg-indigo-50 text-indigo-800', bar: 'bg-indigo-500', dot: 'bg-indigo-500' },
  college_committee: { badge: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800', bar: 'bg-fuchsia-500', dot: 'bg-fuchsia-500' },
  reviewer: { badge: 'border-violet-300 bg-violet-50 text-violet-800', bar: 'bg-violet-500', dot: 'bg-violet-500' },
  speaker: { badge: 'border-sky-300 bg-sky-50 text-sky-800', bar: 'bg-sky-500', dot: 'bg-sky-500' },
  presenter: { badge: 'border-blue-300 bg-blue-50 text-blue-800', bar: 'bg-blue-500', dot: 'bg-blue-500' },
  participant: { badge: 'border-emerald-300 bg-emerald-50 text-emerald-800', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  exhibitor: { badge: 'border-teal-300 bg-teal-50 text-teal-800', bar: 'bg-teal-500', dot: 'bg-teal-500' },
  health_hack: { badge: 'border-rose-300 bg-rose-50 text-rose-800', bar: 'bg-rose-500', dot: 'bg-rose-500' },
  media: { badge: 'border-slate-300 bg-slate-50 text-slate-700', bar: 'bg-slate-500', dot: 'bg-slate-500' },
  staff_mc: { badge: 'border-orange-300 bg-orange-50 text-orange-800', bar: 'bg-orange-500', dot: 'bg-orange-500' },
};

const NEUTRAL: HolderTypeTone = {
  badge: 'border-zinc-200 bg-zinc-50 text-zinc-500',
  bar: 'bg-zinc-400',
  dot: 'bg-zinc-400',
};

export function holderTypeTone(key?: string | null): HolderTypeTone {
  return (key && TONES[key]) || NEUTRAL;
}
