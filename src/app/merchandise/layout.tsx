import { Suspense, type ReactNode } from 'react';
import MerchandiseShell from '@/components/merchandise/MerchandiseShell';

export default function MerchandiseLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <MerchandiseShell>{children}</MerchandiseShell>
    </Suspense>
  );
}
