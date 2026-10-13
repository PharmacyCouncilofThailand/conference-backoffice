import { Suspense } from 'react';
import BoothAdmin from '@/components/booths/BoothAdmin';
export default function BoothMembersPage() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <BoothAdmin detail />
    </Suspense>
  );
}
