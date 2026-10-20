import { Suspense } from 'react';
import OrdersTable from '@/components/merchandise/OrdersTable';

export default function MerchandiseOrdersRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <OrdersTable />
    </Suspense>
  );
}
