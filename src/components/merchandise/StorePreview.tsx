'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  IconAlertTriangle,
  IconLoader2,
  IconRefresh,
  IconShoppingCart,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import { formatBaht, unavailableLabel } from '@/lib/merchandiseFormat';
import type {
  AdminProductDto,
  ProductDto,
  StoreDto,
  VariantDto,
} from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

function formatPreviewPrice(price: ProductDto['price']): string {
  if (!price) return 'ยังไม่ตั้งราคา';
  return price.kind === 'from'
    ? `เริ่ม ${formatBaht(price.amountBaht)}`
    : formatBaht(price.amountBaht);
}

function variantOptionLabel(v: VariantDto): string {
  const parts = [v.sizeTh, v.colorTh].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'ตัวเลือกเริ่มต้น';
}

export default function StorePreview() {
  const { eventId, token } = useMerchandise();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('productId') ?? '';

  const [storeDto, setStoreDto] = useState<StoreDto | null>(null);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [adminProducts, setAdminProducts] = useState<AdminProductDto[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [detailProduct, setDetailProduct] = useState<ProductDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  const openDetail = useCallback(
    async (productId: string) => {
      if (!eventId || !token || !productId) return;
      setDetailLoading(true);
      setDetailError('');
      setActiveImageIdx(0);
      try {
        const p = await merchandiseApi.previewProduct(
          eventId,
          productId,
          token,
        );
        setDetailProduct(p);
        const firstEnabled = p.variants.find((v) => v.saleEnabled);
        setSelectedVariantId(firstEnabled?.id ?? p.variants[0]?.id ?? null);
      } catch (err) {
        setDetailError(merchErrorMessage(err));
      } finally {
        setDetailLoading(false);
      }
    },
    [eventId, token],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const [preview, adminList] = await Promise.all([
          merchandiseApi.previewStore(eventId, token, signal),
          merchandiseApi.listProducts(eventId, {}, token, signal),
        ]);
        if (signal?.aborted) return;
        setStoreDto(preview.store);
        setProducts(preview.products);
        setAdminProducts(adminList);
      } catch (err) {
        if (!signal?.aborted) {
          setError(merchErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [eventId, token],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  useEffect(() => {
    if (initialProductId) {
      void openDetail(initialProductId);
    }
  }, [initialProductId, openDetail]);

  const draftIds = useMemo(
    () =>
      new Set(
        adminProducts
          .filter((p) => p.publishState === 'draft')
          .map((p) => p.id),
      ),
    [adminProducts],
  );

  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter((p) => p.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const firstBanner = storeDto?.banners[0];

  const selectedVariant = detailProduct?.variants.find(
    (v) => v.id === selectedVariantId,
  );
  const detailPriceText =
    detailProduct?.kind === 'single' &&
    detailProduct.hasOptions &&
    selectedVariant &&
    selectedVariant.priceBaht !== null
      ? formatBaht(selectedVariant.priceBaht)
      : detailProduct
        ? formatPreviewPrice(detailProduct.price)
        : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          ดูตัวอย่างหน้าร้าน
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          ตรวจสอบการแสดงผลสินค้าเดี่ยวและชุด Bundle ก่อนเผยแพร่จริง
        </p>
      </div>

      <div
        role="note"
        className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900"
      >
        <IconAlertTriangle size={18} className="shrink-0" />
        <span>
          ตัวอย่างโดยประมาณ — หน้าร้านจริงอาจต่างเล็กน้อย
          สินค้าทุกตัวแสดงเหมือนร้านเปิดอยู่
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn-secondary gap-2"
            onClick={() => void load()}
          >
            <IconRefresh size={16} />
            ลองใหม่
          </button>
        </div>
      )}

      {loading ? (
        <div className="card text-sm text-zinc-500">
          กำลังโหลดตัวอย่างหน้าร้าน...
        </div>
      ) : (
        <>
          {(firstBanner ||
            storeDto?.productionInfoTh ||
            storeDto?.shippingInfoTh) && (
            <div className="card space-y-4">
              {firstBanner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firstBanner.image.url}
                  alt="แบนเนอร์ร้าน"
                  className="max-h-72 w-full rounded-xl object-cover"
                />
              )}
              {(storeDto?.productionInfoTh || storeDto?.shippingInfoTh) && (
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  {storeDto?.productionInfoTh && (
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <div className="font-semibold text-zinc-800">
                        กำหนดผลิต
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                        {storeDto.productionInfoTh}
                      </p>
                    </div>
                  )}
                  {storeDto?.shippingInfoTh && (
                    <div className="rounded-xl bg-zinc-50 p-3">
                      <div className="font-semibold text-zinc-800">
                        กำหนดจัดส่ง
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                        {storeDto.shippingInfoTh}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {storeDto && storeDto.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('')}
                className={
                  selectedCategoryId === '' ? 'btn-primary' : 'btn-secondary'
                }
              >
                ทั้งหมด
              </button>
              {storeDto.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={
                    selectedCategoryId === cat.id
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }
                >
                  {cat.nameTh}
                </button>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="card text-sm text-zinc-500">
              ไม่มีสินค้าในหมวดนี้
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((p) => {
                const img = p.images[0];
                const isDraft = draftIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void openDetail(p.id)}
                    className="card flex flex-col justify-between space-y-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="relative">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.url}
                            alt={p.nameTh}
                            className="aspect-square w-full rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400">
                            ไม่มีรูปสินค้า
                          </div>
                        )}
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                          {isDraft && (
                            <span className="badge badge-warning">
                              ฉบับร่าง
                            </span>
                          )}
                          {p.kind === 'bundle' && (
                            <span className="badge badge-info">Bundle</span>
                          )}
                        </div>
                      </div>
                      <div className="font-semibold text-zinc-900">
                        {p.nameTh}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-base font-bold text-emerald-700">
                        {formatPreviewPrice(p.price)}
                      </div>
                      {!p.purchasable && (
                        <div className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                          ซื้อไม่ได้:{' '}
                          {p.unavailableCodes
                            .map((c) => unavailableLabel[c] ?? c)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {(detailLoading || detailError || detailProduct) && (
        <div className="modal-overlay">
          <div className="modal-content max-h-[90vh] max-w-3xl overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900">
                  {detailProduct?.nameTh ?? 'รายละเอียดสินค้า'}
                </h2>
                {detailProduct && draftIds.has(detailProduct.id) && (
                  <span className="badge badge-warning">ฉบับร่าง</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailProduct(null);
                  setDetailError('');
                }}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
              >
                <IconX size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                <IconLoader2 size={18} className="animate-spin" />
                กำลังโหลดรายละเอียด...
              </div>
            ) : detailError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {detailError}
              </div>
            ) : (
              detailProduct && (
                <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    {detailProduct.images[activeImageIdx] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detailProduct.images[activeImageIdx].url}
                        alt={detailProduct.nameTh}
                        className="aspect-square w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-400">
                        ไม่มีรูปสินค้า
                      </div>
                    )}
                    {detailProduct.images.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {detailProduct.images.map((img, idx) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => setActiveImageIdx(idx)}
                            className={`overflow-hidden rounded-lg border-2 ${
                              activeImageIdx === idx
                                ? 'border-emerald-600'
                                : 'border-transparent'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt=""
                              className="h-14 w-14 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="text-2xl font-bold text-emerald-700">
                      {detailPriceText}
                    </div>

                    {!detailProduct.purchasable && (
                      <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                        ซื้อไม่ได้:{' '}
                        {detailProduct.unavailableCodes
                          .map((c) => unavailableLabel[c] ?? c)
                          .join(', ')}
                      </div>
                    )}

                    {detailProduct.descriptionTh && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-zinc-500">
                          รายละเอียด
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-zinc-800">
                          {detailProduct.descriptionTh}
                        </p>
                      </div>
                    )}

                    {detailProduct.sizeChartTh && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-zinc-500">
                          ตารางไซซ์
                        </div>
                        <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 font-sans text-xs text-zinc-800">
                          {detailProduct.sizeChartTh}
                        </pre>
                      </div>
                    )}

                    {detailProduct.kind === 'single' &&
                      detailProduct.hasOptions && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-zinc-700">
                            ตัวเลือกสินค้า
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {detailProduct.variants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                disabled={!v.saleEnabled}
                                onClick={() => setSelectedVariantId(v.id)}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                                  selectedVariantId === v.id
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                                } disabled:cursor-not-allowed disabled:opacity-40`}
                              >
                                {variantOptionLabel(v)}
                                {v.priceBaht !== null
                                  ? ` (${formatBaht(v.priceBaht)})`
                                  : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {detailProduct.kind === 'bundle' && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-zinc-700">
                          ส่วนประกอบในชุด
                        </div>
                        <ul className="space-y-2 rounded-xl bg-zinc-50 p-3 text-xs">
                          {detailProduct.components.map((comp) => (
                            <li key={comp.id} className="space-y-1">
                              <div className="font-semibold text-zinc-900">
                                {comp.nameTh} × {comp.quantityPerBundle} ต่อชุด
                              </div>
                              {comp.mode === 'fixed' ? (
                                <div className="text-zinc-600">
                                  ตัวเลือกตายตัว:{' '}
                                  {comp.fixedVariant
                                    ? variantOptionLabel(comp.fixedVariant)
                                    : 'ตัวเลือกเริ่มต้น'}
                                </div>
                              ) : (
                                <div className="text-zinc-600">
                                  ลูกค้าเลือกได้:{' '}
                                  {comp.allowedVariants
                                    .map((v) => variantOptionLabel(v))
                                    .join(', ')}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled
                        className="btn-primary min-h-11 w-full gap-2"
                      >
                        <IconShoppingCart size={18} />
                        หยิบใส่ตะกร้า
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
