import { downloadAPIFile, fetchAPI } from './api';
import type {
  AdminBannerDto,
  AdminCategoryDto,
  AdminOrderDetail,
  AdminOrderRow,
  AdminProductDto,
  AdminStoreDto,
  BatchRowResult,
  BulkShipmentRow,
  ComponentInput,
  ImageAsset,
  OrderEditInput,
  OrderFilters,
  OrderSummary,
  Page,
  PaymentReviewDto,
  ProductDto,
  ProductInput,
  ProductQuery,
  ProductionRow,
  ShipmentInput,
  StoreDto,
  StoreInput,
  VariantInput,
} from '@/types/merchandise';

const base = (eventId: number) =>
  `/api/backoffice/merchandise/events/${eventId}`;

async function unwrap<T>(
  endpoint: string,
  options: {
    token: string;
    method?: string;
    body?: BodyInit;
    signal?: AbortSignal;
  },
): Promise<T> {
  const res = await fetchAPI<{ success: true; data: T }>(endpoint, options);
  return res.data;
}

export function orderFilterQuery(
  filters: OrderFilters,
  opts: { paging: boolean } = { paging: true },
): string {
  const params = new URLSearchParams();
  const setTrimmed = (key: string, val?: string) => {
    const trimmed = val?.trim();
    if (trimmed) params.set(key, trimmed);
  };
  setTrimmed('search', filters.search);
  setTrimmed('createdFrom', filters.createdFrom);
  setTrimmed('createdTo', filters.createdTo);
  setTrimmed('paymentStatus', filters.paymentStatus);
  setTrimmed('shippingStatus', filters.shippingStatus);

  if (opts.paging) {
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  }
  return params.toString();
}

/** Same name the API sends; used when Content-Disposition is not readable. */
export function exportFilename(
  kind: 'orders' | 'production',
  eventCode?: string,
): string {
  const code = eventCode?.replace(/[^A-Za-z0-9._-]/g, '_');
  return code ? `merch-${kind}-${code}.xlsx` : `merch-${kind}.xlsx`;
}

function productQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.kind) params.set('kind', query.kind);
  if (query.categoryId?.trim())
    params.set('categoryId', query.categoryId.trim());
  if (query.search?.trim()) params.set('search', query.search.trim());
  return params.toString();
}

export const merchandiseApi = {
  getStore: (eventId: number, token: string, signal?: AbortSignal) =>
    unwrap<AdminStoreDto>(`${base(eventId)}/store`, { token, signal }),

  updateStore: (
    eventId: number,
    input: StoreInput,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminStoreDto>(`${base(eventId)}/store`, {
      token,
      method: 'PUT',
      body: JSON.stringify(input),
      signal,
    }),

  uploadImage: (
    eventId: number,
    file: File,
    token: string,
    signal?: AbortSignal,
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap<ImageAsset>(`${base(eventId)}/images`, {
      token,
      method: 'POST',
      body: formData as unknown as BodyInit,
      signal,
    });
  },

  listCategories: (eventId: number, token: string, signal?: AbortSignal) =>
    unwrap<AdminCategoryDto[]>(`${base(eventId)}/categories`, {
      token,
      signal,
    }),

  createCategory: (
    eventId: number,
    input: { nameTh: string; visible?: boolean },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminCategoryDto>(`${base(eventId)}/categories`, {
      token,
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    }),

  updateCategory: (
    eventId: number,
    id: string,
    input: { expectedVersion: number; nameTh?: string; visible?: boolean },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminCategoryDto>(`${base(eventId)}/categories/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
      signal,
    }),

  deleteCategory: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<{ deleted: true }>(`${base(eventId)}/categories/${id}`, {
      token,
      method: 'DELETE',
      signal,
    }),

  orderCategories: (
    eventId: number,
    ids: string[],
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminCategoryDto[]>(`${base(eventId)}/categories/order`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ ids }),
      signal,
    }),

  listBanners: (eventId: number, token: string, signal?: AbortSignal) =>
    unwrap<AdminBannerDto[]>(`${base(eventId)}/banners`, { token, signal }),

  createBanner: (
    eventId: number,
    input: { imageId: string; linkUrl?: string | null; active?: boolean },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminBannerDto>(`${base(eventId)}/banners`, {
      token,
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    }),

  updateBanner: (
    eventId: number,
    id: string,
    input: {
      expectedVersion: number;
      imageId?: string;
      linkUrl?: string | null;
      active?: boolean;
    },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminBannerDto>(`${base(eventId)}/banners/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
      signal,
    }),

  deleteBanner: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<{ deleted: true }>(`${base(eventId)}/banners/${id}`, {
      token,
      method: 'DELETE',
      signal,
    }),

  orderBanners: (
    eventId: number,
    ids: string[],
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminBannerDto[]>(`${base(eventId)}/banners/order`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ ids }),
      signal,
    }),

  listProducts: (
    eventId: number,
    query: ProductQuery,
    token: string,
    signal?: AbortSignal,
  ) => {
    const q = productQueryString(query);
    return unwrap<AdminProductDto[]>(
      `${base(eventId)}/products${q ? `?${q}` : ''}`,
      { token, signal },
    );
  },

  createProduct: (
    eventId: number,
    input: { kind: 'single' | 'bundle'; nameTh: string } & ProductInput,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products`, {
      token,
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    }),

  getProduct: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}`, {
      token,
      signal,
    }),

  updateProduct: (
    eventId: number,
    id: string,
    input: { expectedVersion: number } & ProductInput,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
      signal,
    }),

  replaceVariants: (
    eventId: number,
    id: string,
    input: { expectedVersion: number; variants: VariantInput[] },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}/variants`, {
      token,
      method: 'PUT',
      body: JSON.stringify(input),
      signal,
    }),

  replaceComponents: (
    eventId: number,
    id: string,
    input: { expectedVersion: number; components: ComponentInput[] },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}/components`, {
      token,
      method: 'PUT',
      body: JSON.stringify(input),
      signal,
    }),

  publishProduct: (
    eventId: number,
    id: string,
    expectedVersion: number,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}/publish`, {
      token,
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
      signal,
    }),

  unpublishProduct: (
    eventId: number,
    id: string,
    expectedVersion: number,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto>(`${base(eventId)}/products/${id}/unpublish`, {
      token,
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
      signal,
    }),

  orderProducts: (
    eventId: number,
    ids: string[],
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminProductDto[]>(`${base(eventId)}/products/order`, {
      token,
      method: 'PUT',
      body: JSON.stringify({ ids }),
      signal,
    }),

  bulkProducts: (
    eventId: number,
    input: {
      ids: string[];
      change: { saleEnabled: boolean } | { categoryId: string | null };
    },
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<BatchRowResult[]>(`${base(eventId)}/products/bulk`, {
      token,
      method: 'POST',
      body: JSON.stringify(input),
      signal,
    }),

  previewStore: (eventId: number, token: string, signal?: AbortSignal) =>
    unwrap<{ store: StoreDto; products: ProductDto[] }>(
      `${base(eventId)}/preview/store`,
      { token, signal },
    ),

  previewProduct: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<ProductDto>(`${base(eventId)}/preview/products/${id}`, {
      token,
      signal,
    }),

  listOrders: (
    eventId: number,
    filters: OrderFilters,
    token: string,
    signal?: AbortSignal,
  ) => {
    const q = orderFilterQuery(filters, { paging: true });
    return unwrap<Page<AdminOrderRow>>(
      `${base(eventId)}/orders${q ? `?${q}` : ''}`,
      { token, signal },
    );
  },

  getOrder: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminOrderDetail>(`${base(eventId)}/orders/${id}`, {
      token,
      signal,
    }),

  editOrder: (
    eventId: number,
    id: string,
    input: OrderEditInput,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminOrderDetail>(`${base(eventId)}/orders/${id}`, {
      token,
      method: 'PATCH',
      body: JSON.stringify(input),
      signal,
    }),

  checkOrderPayment: (
    eventId: number,
    id: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<AdminOrderDetail>(`${base(eventId)}/orders/${id}/payment-checks`, {
      token,
      method: 'POST',
      signal,
    }),

  previewNotification: (
    eventId: number,
    id: string,
    type: 'paid' | 'shipped',
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<{ recipient: string; subject: string; html: string }>(
      `${base(eventId)}/orders/${id}/notifications/${type}/preview`,
      { token, signal },
    ),

  resendNotification: (
    eventId: number,
    id: string,
    type: 'paid' | 'shipped',
    reason: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<{ ok: true }>(
      `${base(eventId)}/orders/${id}/notifications/${type}/resend`,
      {
        token,
        method: 'POST',
        body: JSON.stringify({ reason }),
        signal,
      },
    ),

  setShipment: (
    eventId: number,
    id: string,
    input: ShipmentInput,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<OrderSummary>(`${base(eventId)}/orders/${id}/shipment`, {
      token,
      method: 'PUT',
      body: JSON.stringify(input),
      signal,
    }),

  bulkShipments: (
    eventId: number,
    rows: BulkShipmentRow[],
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<{ results: BatchRowResult[] }>(
      `${base(eventId)}/orders/shipments/bulk`,
      {
        token,
        method: 'POST',
        body: JSON.stringify({ rows }),
        signal,
      },
    ),

  downloadOrdersXlsx: (
    eventId: number,
    filters: OrderFilters,
    token: string,
    eventCode?: string,
  ) => {
    const q = orderFilterQuery(filters, { paging: false });
    return downloadAPIFile(
      `${base(eventId)}/orders/export.xlsx${q ? `?${q}` : ''}`,
      token,
      exportFilename('orders', eventCode),
    );
  },

  downloadProductionXlsx: (
    eventId: number,
    token: string,
    eventCode?: string,
  ) =>
    downloadAPIFile(
      `${base(eventId)}/production/export.xlsx`,
      token,
      exportFilename('production', eventCode),
    ),

  production: (eventId: number, token: string, signal?: AbortSignal) =>
    unwrap<ProductionRow[]>(`${base(eventId)}/production`, { token, signal }),

  listReviews: (
    eventId: number,
    resolved: boolean,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<PaymentReviewDto[]>(
      `${base(eventId)}/payment-reviews?resolved=${resolved ? 'true' : 'false'}`,
      { token, signal },
    ),

  resolveReview: (
    eventId: number,
    attemptId: string,
    note: string,
    token: string,
    signal?: AbortSignal,
  ) =>
    unwrap<PaymentReviewDto>(
      `${base(eventId)}/payment-attempts/${attemptId}/resolve-review`,
      {
        token,
        method: 'POST',
        body: JSON.stringify({ note }),
        signal,
      },
    ),
};
