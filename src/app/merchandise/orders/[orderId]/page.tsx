import { Suspense } from 'react';
import OrderDetail from '@/components/merchandise/OrderDetail';

export default function MerchandiseOrderDetailRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <OrderDetail />
    </Suspense>
  );
}
