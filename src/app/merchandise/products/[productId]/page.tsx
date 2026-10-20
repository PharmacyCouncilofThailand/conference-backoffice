import { Suspense } from 'react';
import ProductEditor from '@/components/merchandise/ProductEditor';

export default function MerchandiseProductEditorRoute() {
  return (
    <Suspense fallback={<p>กำลังโหลด</p>}>
      <ProductEditor />
    </Suspense>
  );
}
