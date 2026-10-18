import { Suspense } from 'react';
import ProductList from '@/components/merchandise/ProductList';

export default function MerchandiseProductsRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <ProductList />
    </Suspense>
  );
}
