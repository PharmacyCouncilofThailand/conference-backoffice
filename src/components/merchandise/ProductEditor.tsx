'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconEye,
  IconLoader2,
  IconRefresh,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import {
  isVersionConflict,
  merchErrorMessage,
  publishIssuesFromError,
} from '@/lib/merchandiseErrors';
import {
  parseBahtInput,
  publishIssueLabel,
  unavailableLabel,
} from '@/lib/merchandiseFormat';
import type {
  AdminCategoryDto,
  AdminProductDto,
  ImageAsset,
} from '@/types/merchandise';
import BundleComponentsEditor from './BundleComponentsEditor';
import ImageManager from './ImageManager';
import { merchHref, useMerchandise } from './MerchandiseContext';
import VariantMatrixEditor from './VariantMatrixEditor';

export default function ProductEditor() {
  const { eventId, token } = useMerchandise();
  const params = useParams();
  const productId = String(params.productId ?? '');

  const [product, setProduct] = useState<AdminProductDto | null>(null);
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [singles, setSingles] = useState<AdminProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Main info form state
  const [nameTh, setNameTh] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [descriptionTh, setDescriptionTh] = useState('');
  const [sizeChartTh, setSizeChartTh] = useState('');
  const [basePriceRaw, setBasePriceRaw] = useState('');
  const [saleEnabled, setSaleEnabled] = useState(false);
  const [savingMain, setSavingMain] = useState(false);
  const [mainError, setMainError] = useState('');
  const [mainConflict, setMainConflict] = useState(false);

  // Images section state
  const [draftImages, setDraftImages] = useState<ImageAsset[]>([]);
  const [savingImages, setSavingImages] = useState(false);
  const [imagesError, setImagesError] = useState('');
  const [imagesConflict, setImagesConflict] = useState(false);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [serverPublishIssues, setServerPublishIssues] = useState<string[]>([]);

  function fillFormsFromProduct(p: AdminProductDto) {
    setNameTh(p.nameTh);
    setCategoryId(p.categoryId ?? '');
    setDescriptionTh(p.descriptionTh ?? '');
    setSizeChartTh(p.sizeChartTh ?? '');
    setBasePriceRaw(p.basePriceBaht !== null ? String(p.basePriceBaht) : '');
    setSaleEnabled(p.saleEnabled);
    setDraftImages(p.images);
    setMainConflict(false);
    setImagesConflict(false);
    setMainError('');
    setImagesError('');
    setPublishError('');
    setServerPublishIssues([]);
  }

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token || !productId) return;
      setLoading(true);
      setLoadError('');
      try {
        const [prod, cats, singleList] = await Promise.all([
          merchandiseApi.getProduct(eventId, productId, token, signal),
          merchandiseApi.listCategories(eventId, token, signal),
          merchandiseApi.listProducts(
            eventId,
            { kind: 'single' },
            token,
            signal,
          ),
        ]);
        if (signal?.aborted) return;
        setProduct(prod);
        setCategories(cats);
        setSingles(singleList.filter((s) => s.id !== prod.id));
        fillFormsFromProduct(prod);
      } catch (err) {
        if (!signal?.aborted) {
          setLoadError(merchErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [eventId, token, productId],
  );

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  function replaceProductState(next: AdminProductDto) {
    setProduct(next);
    setServerPublishIssues([]);
    setPublishError('');
  }

  async function handleSaveMain(e: React.FormEvent) {
    e.preventDefault();
    if (!product || savingMain) return;
    setMainError('');
    setMainConflict(false);

    const trimmedName = nameTh.trim();
    if (!trimmedName) {
      setMainError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (trimmedName.length > 300) {
      setMainError('ชื่อสินค้ายาวเกิน 300 ตัวอักษร');
      return;
    }
    const parsedPrice = parseBahtInput(basePriceRaw);
    if (parsedPrice === 'invalid') {
      setMainError('ราคาต้องเป็นจำนวนเต็ม 0–1,000,000 บาท');
      return;
    }

    setSavingMain(true);
    try {
      const updated = await merchandiseApi.updateProduct(
        eventId,
        product.id,
        {
          expectedVersion: product.version,
          nameTh: trimmedName,
          categoryId: categoryId || null,
          descriptionTh: descriptionTh.trim() ? descriptionTh.trim() : null,
          ...(product.kind === 'single'
            ? { sizeChartTh: sizeChartTh.trim() ? sizeChartTh.trim() : null }
            : {}),
          basePriceBaht: parsedPrice,
          saleEnabled,
        },
        token,
      );
      replaceProductState(updated);
      fillFormsFromProduct(updated);
      toast.success('บันทึกข้อมูลหลักแล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setMainError(msg);
      toast.error(msg);
      if (isVersionConflict(err)) {
        setMainConflict(true);
      }
    } finally {
      setSavingMain(false);
    }
  }

  async function handleSaveImages() {
    if (!product || savingImages) return;
    setImagesError('');
    setImagesConflict(false);
    setSavingImages(true);
    try {
      const updated = await merchandiseApi.updateProduct(
        eventId,
        product.id,
        {
          expectedVersion: product.version,
          imageIds: draftImages.map((img) => img.id),
        },
        token,
      );
      replaceProductState(updated);
      setDraftImages(updated.images);
      toast.success('บันทึกรูปสินค้าแล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setImagesError(msg);
      toast.error(msg);
      if (isVersionConflict(err)) {
        setImagesConflict(true);
      }
    } finally {
      setSavingImages(false);
    }
  }

  async function handleTogglePublish() {
    if (!product || publishing) return;
    setPublishing(true);
    setPublishError('');
    setServerPublishIssues([]);
    try {
      const updated =
        product.publishState === 'published'
          ? await merchandiseApi.unpublishProduct(
              eventId,
              product.id,
              product.version,
              token,
            )
          : await merchandiseApi.publishProduct(
              eventId,
              product.id,
              product.version,
              token,
            );
      replaceProductState(updated);
      fillFormsFromProduct(updated);
      toast.success(
        updated.publishState === 'published'
          ? 'เผยแพร่สินค้าแล้ว'
          : 'ยกเลิกเผยแพร่สินค้าแล้ว',
      );
    } catch (err) {
      const issues = publishIssuesFromError(err);
      if (issues.length > 0) {
        setServerPublishIssues(issues);
      }
      const msg = merchErrorMessage(err);
      setPublishError(msg);
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  if (loading && !product) {
    return <div className="card text-sm text-zinc-500">กำลังโหลดสินค้า...</div>;
  }

  if (loadError && !product) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
      >
        <span>{loadError}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="btn-secondary gap-2"
        >
          <IconRefresh size={16} />
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!product) return null;

  const displayIssues =
    serverPublishIssues.length > 0
      ? serverPublishIssues
      : product.publishIssues.map((code) => publishIssueLabel[code] ?? code);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {product.nameTh}
            </h1>
            <span className="badge badge-info">
              {product.kind === 'bundle' ? 'Bundle' : 'สินค้าเดี่ยว'}
            </span>
            <span
              className={
                product.publishState === 'published'
                  ? 'badge badge-success'
                  : 'badge badge-warning'
              }
            >
              {product.publishState === 'published' ? 'เผยแพร่' : 'ฉบับร่าง'}
            </span>
            <span
              className={
                product.saleEnabled
                  ? 'badge badge-success'
                  : 'badge badge-error'
              }
            >
              {product.saleEnabled ? 'เปิดขาย' : 'ปิดขาย'}
            </span>
          </div>
          {!product.purchasable && product.unavailableCodes.length > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              ซื้อไม่ได้ในขณะนี้:{' '}
              {product.unavailableCodes
                .map((c) => unavailableLabel[c] ?? c)
                .join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={merchHref('/merchandise/products', eventId)}
            className="btn-secondary min-h-11 gap-2"
          >
            <IconArrowLeft size={18} />
            กลับรายการสินค้า
          </Link>
          <Link
            href={merchHref('/merchandise/preview', eventId, {
              productId: product.id,
            })}
            className="btn-secondary min-h-11 gap-2"
          >
            <IconEye size={18} />
            ดูตัวอย่าง
          </Link>
          {product.publishState === 'published' ? (
            <button
              type="button"
              disabled={publishing}
              onClick={() => void handleTogglePublish()}
              className="btn-secondary min-h-11 gap-2"
            >
              {publishing && <IconLoader2 size={18} className="animate-spin" />}
              ยกเลิกเผยแพร่
            </button>
          ) : (
            <button
              type="button"
              disabled={publishing || product.publishIssues.length > 0}
              onClick={() => void handleTogglePublish()}
              className="btn-primary min-h-11 gap-2"
            >
              {publishing && <IconLoader2 size={18} className="animate-spin" />}
              เผยแพร่
            </button>
          )}
        </div>
      </div>

      {publishError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{publishError}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary gap-2"
          >
            <IconRefresh size={16} />
            โหลดข้อมูลล่าสุด
          </button>
        </div>
      )}

      {displayIssues.length > 0 && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
        >
          <div className="flex items-center gap-2 font-semibold">
            <IconAlertTriangle size={18} />
            <span>สิ่งที่ยังขาดก่อนเผยแพร่</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {displayIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => void handleSaveMain(e)} className="card space-y-4">
        <h2 className="text-lg font-bold text-zinc-900">ข้อมูลหลัก</h2>

        {mainError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            <span>{mainError}</span>
            {mainConflict && (
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary gap-2"
              >
                <IconRefresh size={16} />
                โหลดข้อมูลล่าสุด
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              ชื่อสินค้า (ภาษาไทย)
            </span>
            <input
              type="text"
              required
              maxLength={300}
              value={nameTh}
              onChange={(e) => setNameTh(e.target.value)}
              className="input-field"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              หมวดสินค้า
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input-field"
            >
              <option value="">ไม่มีหมวด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameTh}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              {product.kind === 'bundle'
                ? 'ราคาชุด Bundle (บาท)'
                : 'ราคาหลัก (บาท)'}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={basePriceRaw}
              onChange={(e) => setBasePriceRaw(e.target.value)}
              placeholder="เช่น 250"
              className="input-field"
            />
          </label>

          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-3">
              <input
                type="checkbox"
                checked={saleEnabled}
                onChange={(e) => setSaleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-semibold text-zinc-900">
                เปิดขายสินค้านี้
              </span>
            </label>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-700">
            รายละเอียดสินค้า
          </span>
          <textarea
            rows={4}
            maxLength={10000}
            value={descriptionTh}
            onChange={(e) => setDescriptionTh(e.target.value)}
            className="input-field"
          />
        </label>

        {product.kind === 'single' && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">ตารางไซซ์</span>
            <textarea
              rows={3}
              maxLength={10000}
              value={sizeChartTh}
              onChange={(e) => setSizeChartTh(e.target.value)}
              placeholder="เช่น S รอบอก 36 นิ้ว / M รอบอก 38 นิ้ว"
              className="input-field"
            />
          </label>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingMain}
            className="btn-primary min-h-11 gap-2"
          >
            {savingMain && <IconLoader2 size={18} className="animate-spin" />}
            บันทึกข้อมูลหลัก
          </button>
        </div>
      </form>

      <div className="card space-y-4">
        <h2 className="text-lg font-bold text-zinc-900">รูปสินค้า</h2>

        {imagesError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            <span>{imagesError}</span>
            {imagesConflict && (
              <button
                type="button"
                onClick={() => void load()}
                className="btn-secondary gap-2"
              >
                <IconRefresh size={16} />
                โหลดข้อมูลล่าสุด
              </button>
            )}
          </div>
        )}

        <ImageManager
          eventId={eventId}
          token={token}
          images={draftImages}
          max={20}
          onChange={setDraftImages}
        />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={savingImages}
            onClick={() => void handleSaveImages()}
            className="btn-primary min-h-11 gap-2"
          >
            {savingImages && <IconLoader2 size={18} className="animate-spin" />}
            บันทึกรูป
          </button>
        </div>
      </div>

      {product.kind === 'single' ? (
        <VariantMatrixEditor product={product} onSaved={replaceProductState} />
      ) : (
        <BundleComponentsEditor
          product={product}
          singles={singles}
          onSaved={replaceProductState}
        />
      )}
    </div>
  );
}
