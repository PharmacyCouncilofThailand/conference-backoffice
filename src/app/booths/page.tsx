import { Suspense } from 'react';
import BoothAdmin from '@/components/booths/BoothAdmin';
export default function BoothsPage() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <BoothAdmin />
    </Suspense>
  );
}
