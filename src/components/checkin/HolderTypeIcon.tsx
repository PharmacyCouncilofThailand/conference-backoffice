import { IconDiamond, IconSparkles } from '@tabler/icons-react';

/** Diamond for VVIP, sparkles for VIP, nothing for other holder types. */
export function HolderTypeIcon({ holderType, size = 14 }: { holderType?: string | null; size?: number }) {
  if (holderType === 'vvip') return <IconDiamond size={size} className="shrink-0" aria-hidden="true" />;
  if (holderType === 'vip') return <IconSparkles size={size} className="shrink-0" aria-hidden="true" />;
  return null;
}
