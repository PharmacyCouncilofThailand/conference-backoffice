'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  IconArrowDown,
  IconArrowsSort,
  IconArrowUp,
  IconCheck,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react';
import { useDebounce } from '@/hooks/useDebounce';
import { ApiError } from '@/lib/api';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  formatBaht,
  publishIssueLabel,
  unavailableLabel,
} from '@/lib/merchandiseFormat';
import type {
  AdminCategoryDto,
  AdminProductDto,
  ProductQuery,
} from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';

function computeProductPrice(
  product: AdminProductDto & {
    price?: { kind: 'exact' | 'from'; amountBaht: number } | null;
  },
): { kind: 'exact' | 'from'; amountBaht: number } | null {
  if (product.price !== undefined) {
    return product.price;
  }
  if (product.kind === 'bundle') {
    return product.basePriceBaht !== null && product.basePriceBaht >= 0
      ? { kind: 'exact', amountBaht: product.basePriceBaht }
      : null;
  }
  const prices = product.variants
    .filter((v) => v.saleEnabled)
    .map((v) => v.priceBaht ?? product.basePriceBaht)
    .filter((p): p is number => p !== null && p > 0);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  return {
    kind: prices.every((p) => p === min) ? 'exact' : 'from',
    amountBaht: min,
  };
}

function formatProductPrice(product: AdminProductDto): string {
  const price = computeProductPrice(product);
  if (!price) return 'ยังไม่ตั้งราคา';
  return price.kind === 'from'
    ? `เริ่ม ${formatBaht(price.amountBaht)}`
    : formatBaht(price.amountBaht);
}

export default function ProductList() {
  const { eventId, token } = useMerchandise();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>(
    (searchParams.get('status') as '' | 'draft' | 'published') || '',
  );
  const [kind, setKind] = useState<'' | 'single' | 'bundle'>(
    (searchParams.get('kind') as '' | 'single' | 'bundle') || '',
  );
  const [categoryId, setCategoryId] = useState(
    searchParams.get('categoryId') ?? '',
  );
  const debouncedSearch = useDebounce(search, 300);

  const [products, setProducts] = useState<AdminProductDto[]>([]);
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryTarget, setBulkCategoryTarget] =
    useState<string>('__none__');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFailures, setBulkFailures] = useState<
    { id: string; name: string; message: string }[]
  >([]);

  const [reordering, setReordering] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [createModalKind, setCreateModalKind] = useState<
    'single' | 'bundle' | null
  >(null);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const hasFilter = Boolean(
    debouncedSearch.trim() || status || kind || categoryId,
  );

  useEffect(() => {
    if (hasFilter && reordering) {
      setReordering(false);
    }
  }, [hasFilter, reordering]);

  useEffect(() => {
    if (!eventId) return;
    router.replace(
      merchHref(pathname, eventId, {
        search: debouncedSearch.trim(),
        status,
        kind,
        categoryId,
      }),
    );
  }, [eventId, pathname, router, debouncedSearch, status, kind, categoryId]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const query: ProductQuery = {
          ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          ...(categoryId ? { categoryId } : {}),
        };
        const [prodList, catList] = await Promise.all([
          merchandiseApi.listProducts(eventId, query, token, signal),
          merchandiseApi.listCategories(eventId, token, signal),
        ]);
        if (signal?.aborted) return;
        setProducts(prodList);
        setCategories(catList);
        setSelectedIds((prev) => {
          const valid = new Set(prodList.map((p) => p.id));
          return new Set([...prev].filter((id) => valid.has(id)));
        });
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
    [eventId, token, debouncedSearch, status, kind, categoryId],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.nameTh])),
    [categories],
  );

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkChange(
    change: { saleEnabled: boolean } | { categoryId: string | null },
  ) {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkFailures([]);
    setError('');
    try {
      const failures: { id: string; name: string; message: string }[] = [];
      const nameById = new Map(products.map((p) => [p.id, p.nameTh]));
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const results = await merchandiseApi.bulkProducts(
          eventId,
          { ids: chunk, change },
          token,
        );
        for (const r of results) {
          if (!r.ok) {
            failures.push({
              id: r.id,
              name: nameById.get(r.id) ?? r.id,
              message: merchErrorMessage(
                new ApiError(
                  r.error ?? 'อัปเดตไม่สำเร็จ',
                  422,
                  r.code ?? undefined,
                ),
              ),
            });
          }
        }
      }
      await load();
      if (failures.length > 0) {
        setBulkFailures(failures);
        toast.error(`ดำเนินการไม่สำเร็จ ${failures.length} รายการ`);
      } else {
        setSelectedIds(new Set());
        toast.success(`อัปเดตสินค้าแล้ว ${ids.length} รายการ`);
      }
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBulkBusy(false);
    }
  }

  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setProducts(next);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setError('');
    try {
      const updated = await merchandiseApi.orderProducts(
        eventId,
        products.map((p) => p.id),
        token,
      );
      setProducts(updated);
      setReordering(false);
      toast.success('บันทึกลำดับสินค้าแล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingOrder(false);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!createModalKind || creating) return;
    const trimmed = createName.trim();
    if (!trimmed) {
      setCreateError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (trimmed.length > 300) {
      setCreateError('ชื่อสินค้ายาวเกิน 300 ตัวอักษร');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const created = await merchandiseApi.createProduct(
        eventId,
        { kind: createModalKind, nameTh: trimmed },
        token,
      );
      toast.success('สร้างสินค้าแล้ว');
      router.push(merchHref(`/merchandise/products/${created.id}`, eventId));
    } catch (err) {
      setCreateError(merchErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            รายการสินค้า
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            จัดการสินค้าเดี่ยวและชุด Bundle สถานะการขาย และลำดับการแสดงผล
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!reordering ? (
            <button
              type="button"
              disabled={hasFilter || products.length < 2}
              title={
                hasFilter ? 'ล้างตัวกรองก่อนจึงจะจัดลำดับได้' : 'จัดลำดับสินค้า'
              }
              onClick={() => setReordering(true)}
              className="btn-secondary min-h-11 gap-2"
            >
              <IconArrowsSort size={18} />
              จัดลำดับ
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={savingOrder}
                onClick={() => void handleSaveOrder()}
                className="btn-primary min-h-11 gap-2"
              >
                {savingOrder && (
                  <IconLoader2 size={18} className="animate-spin" />
                )}
                บันทึกลำดับ
              </button>
              <button
                type="button"
                disabled={savingOrder}
                onClick={() => {
                  setReordering(false);
                  void load();
                }}
                className="btn-secondary min-h-11"
              >
                ยกเลิก
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setCreateModalKind('single');
              setCreateName('');
              setCreateError('');
            }}
            className="btn-primary min-h-11 gap-2"
          >
            <IconPlus size={18} />
            เพิ่มสินค้าเดี่ยว
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateModalKind('bundle');
              setCreateName('');
              setCreateError('');
            }}
            className="btn-secondary min-h-11 gap-2"
          >
            <IconPlus size={18} />
            เพิ่ม Bundle
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <IconSearch
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อสินค้า..."
              className="input-field-search"
            />
          </div>

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as '' | 'draft' | 'published')
            }
            className="input-field"
          >
            <option value="">สถานะทั้งหมด</option>
            <option value="draft">ฉบับร่าง</option>
            <option value="published">เผยแพร่แล้ว</option>
          </select>

          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as '' | 'single' | 'bundle')
            }
            className="input-field"
          >
            <option value="">ชนิดทั้งหมด</option>
            <option value="single">สินค้าเดี่ยว</option>
            <option value="bundle">Bundle</option>
          </select>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-field"
          >
            <option value="">ทุกหมวดสินค้า</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nameTh}
              </option>
            ))}
          </select>
        </div>
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

      {selectedIds.size > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-4 bg-emerald-50/70">
          <span className="text-sm font-semibold text-emerald-950">
            เลือกแล้ว {selectedIds.size} รายการ
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulkChange({ saleEnabled: true })}
              className="btn-primary min-h-11 gap-2"
            >
              เปิดขาย
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void runBulkChange({ saleEnabled: false })}
              className="btn-secondary min-h-11 gap-2"
            >
              ปิดขาย
            </button>
            <div className="flex items-center gap-2">
              <select
                value={bulkCategoryTarget}
                onChange={(e) => setBulkCategoryTarget(e.target.value)}
                className="input-field min-w-[160px]"
              >
                <option value="__none__">ไม่มีหมวด</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameTh}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() =>
                  void runBulkChange({
                    categoryId:
                      bulkCategoryTarget === '__none__'
                        ? null
                        : bulkCategoryTarget,
                  })
                }
                className="btn-secondary min-h-11 shrink-0"
              >
                ย้ายหมวด…
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkFailures.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <p className="font-semibold">รายการที่ดำเนินการไม่สำเร็จ:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {bulkFailures.map((f) => (
              <li key={f.id}>
                {f.name}: {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">กำลังโหลดสินค้า...</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">ไม่พบรายการสินค้า</div>
        ) : (
          <table className="data-table table-sticky-actions">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={
                      products.length > 0 &&
                      selectedIds.size === products.length
                    }
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th>รูป</th>
                <th>ชื่อสินค้า</th>
                <th>ชนิด</th>
                <th>หมวด</th>
                <th>ราคา</th>
                <th>สถานะ</th>
                <th>ซื้อได้</th>
                <th>สิ่งที่ยังขาด</th>
                <th className="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => {
                const thumb = p.images[0];
                const editUrl = merchHref(
                  `/merchandise/products/${p.id}`,
                  eventId,
                );
                return (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb.url}
                          alt={p.nameTh}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-400">
                          ไม่มีรูป
                        </div>
                      )}
                    </td>
                    <td>
                      <Link
                        href={editUrl}
                        className="font-semibold text-zinc-900 hover:text-emerald-700 hover:underline"
                      >
                        {p.nameTh}
                      </Link>
                    </td>
                    <td>{p.kind === 'bundle' ? 'Bundle' : 'สินค้าเดี่ยว'}</td>
                    <td>
                      {p.categoryId
                        ? (categoryMap.get(p.categoryId) ?? '—')
                        : '—'}
                    </td>
                    <td className="font-medium text-zinc-900">
                      {formatProductPrice(p)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={
                            p.publishState === 'published'
                              ? 'badge badge-success'
                              : 'badge badge-warning'
                          }
                        >
                          {p.publishState === 'published'
                            ? 'เผยแพร่'
                            : 'ฉบับร่าง'}
                        </span>
                        <span
                          className={
                            p.saleEnabled
                              ? 'badge badge-info'
                              : 'badge badge-error'
                          }
                        >
                          {p.saleEnabled ? 'เปิดขาย' : 'ปิดขาย'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {p.purchasable ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <IconCheck size={16} />
                          ซื้อได้
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {p.unavailableCodes
                            .map((c) => unavailableLabel[c] ?? c)
                            .join(', ')}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.publishIssues.length === 0 ? (
                        <span className="text-xs text-emerald-700">ครบ</span>
                      ) : (
                        <span
                          className="badge badge-warning"
                          title={p.publishIssues
                            .map((i) => publishIssueLabel[i] ?? i)
                            .join(', ')}
                        >
                          ขาด {p.publishIssues.length} ข้อ
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {reordering && (
                          <>
                            <button
                              type="button"
                              disabled={idx === 0 || savingOrder}
                              onClick={() => moveRow(idx, -1)}
                              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                              title="เลื่อนขึ้น"
                            >
                              <IconArrowUp size={16} />
                            </button>
                            <button
                              type="button"
                              disabled={
                                idx === products.length - 1 || savingOrder
                              }
                              onClick={() => moveRow(idx, 1)}
                              className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                              title="เลื่อนลง"
                            >
                              <IconArrowDown size={16} />
                            </button>
                          </>
                        )}
                        <Link href={editUrl} className="btn-secondary gap-1">
                          <IconPencil size={16} />
                          แก้ไข
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {createModalKind && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md p-6">
            <h2 className="text-lg font-bold text-zinc-900">
              {createModalKind === 'bundle'
                ? 'เพิ่มชุดสินค้า Bundle'
                : 'เพิ่มสินค้าเดี่ยว'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              สินค้าใหม่จะเริ่มต้นเป็นฉบับร่างและเปิดหน้าแก้ไขทันที
            </p>
            {createError && (
              <div
                role="alert"
                className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700"
              >
                {createError}
              </div>
            )}
            <form
              onSubmit={(e) => void handleCreateProduct(e)}
              className="mt-4 space-y-4"
            >
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-700">
                  ชื่อสินค้า (ภาษาไทย)
                </span>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="ระบุชื่อสินค้า"
                  className="input-field"
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setCreateModalKind(null)}
                  className="btn-secondary min-h-11"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary min-h-11 gap-2"
                >
                  {creating && (
                    <IconLoader2 size={18} className="animate-spin" />
                  )}
                  สร้างและแก้ไขต่อ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
