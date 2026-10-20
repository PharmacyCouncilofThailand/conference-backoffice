'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconArrowDown,
  IconArrowUp,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import type { AdminBannerDto, ImageAsset } from '@/types/merchandise';
import ImageManager from './ImageManager';
import { useMerchandise } from './MerchandiseContext';

function validateBannerLink(raw: string): string | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > 2000 || !/^https?:\/\/\S+$/i.test(trimmed)) {
    return 'invalid';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'invalid';
    }
    return trimmed;
  } catch {
    return 'invalid';
  }
}

export default function BannerManager() {
  const { eventId, token } = useMerchandise();
  const [banners, setBanners] = useState<AdminBannerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newImages, setNewImages] = useState<ImageAsset[]>([]);
  const [newLink, setNewLink] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const [draftLinks, setDraftLinks] = useState<Record<string, string>>({});
  const [draftImages, setDraftImages] = useState<Record<string, ImageAsset>>(
    {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      setConflict(false);
      try {
        const list = await merchandiseApi.listBanners(eventId, token, signal);
        if (!signal?.aborted) {
          setBanners(list);
          const links: Record<string, string> = {};
          const imgs: Record<string, ImageAsset> = {};
          for (const b of list) {
            links[b.id] = b.linkUrl ?? '';
            imgs[b.id] = b.image;
          }
          setDraftLinks(links);
          setDraftImages(imgs);
          setOrderDirty(false);
        }
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newImages.length === 0) {
      setError('กรุณาอัปโหลดรูปแบนเนอร์');
      return;
    }
    const parsedLink = validateBannerLink(newLink);
    if (parsedLink === 'invalid') {
      setError(
        'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// และไม่เกิน 2,000 ตัวอักษร',
      );
      return;
    }

    setCreating(true);
    setError('');
    try {
      const created = await merchandiseApi.createBanner(
        eventId,
        {
          imageId: newImages[0].id,
          linkUrl: parsedLink,
          active: newActive,
        },
        token,
      );
      setBanners((prev) => [...prev, created]);
      setDraftLinks((prev) => ({
        ...prev,
        [created.id]: created.linkUrl ?? '',
      }));
      setDraftImages((prev) => ({ ...prev, [created.id]: created.image }));
      setNewImages([]);
      setNewLink('');
      setNewActive(true);
      setAdding(false);
      toast.success('เพิ่มแบนเนอร์แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveBanner(banner: AdminBannerDto) {
    const rawLink = draftLinks[banner.id] ?? banner.linkUrl ?? '';
    const parsedLink = validateBannerLink(rawLink);
    if (parsedLink === 'invalid') {
      setError(
        'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// และไม่เกิน 2,000 ตัวอักษร',
      );
      return;
    }
    const img = draftImages[banner.id] ?? banner.image;

    setSavingId(banner.id);
    setError('');
    setConflict(false);
    try {
      const updated = await merchandiseApi.updateBanner(
        eventId,
        banner.id,
        {
          expectedVersion: banner.version,
          imageId: img.id,
          linkUrl: parsedLink,
        },
        token,
      );
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
      setDraftLinks((prev) => ({
        ...prev,
        [banner.id]: updated.linkUrl ?? '',
      }));
      setDraftImages((prev) => ({ ...prev, [banner.id]: updated.image }));
      toast.success('บันทึกแบนเนอร์แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
      if (isVersionConflict(err)) {
        setConflict(true);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActive(banner: AdminBannerDto) {
    setSavingId(banner.id);
    setError('');
    setConflict(false);
    try {
      const updated = await merchandiseApi.updateBanner(
        eventId,
        banner.id,
        {
          expectedVersion: banner.version,
          active: !banner.active,
        },
        token,
      );
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
      toast.success('อัปเดตสถานะแบนเนอร์แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
      if (isVersionConflict(err)) {
        setConflict(true);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(banner: AdminBannerDto) {
    if (!window.confirm('ลบแบนเนอร์นี้?')) return;
    setSavingId(banner.id);
    setError('');
    try {
      await merchandiseApi.deleteBanner(eventId, banner.id, token);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      toast.success('ลบแบนเนอร์แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  function moveBanner(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setBanners(next);
    setOrderDirty(true);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setError('');
    try {
      const updated = await merchandiseApi.orderBanners(
        eventId,
        banners.map((b) => b.id),
        token,
      );
      setBanners(updated);
      setOrderDirty(false);
      toast.success('บันทึกลำดับแบนเนอร์แล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            แบนเนอร์
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            จัดการแบนเนอร์ส่วนหัวของร้านพรีออเดอร์ ลิงก์ และลำดับการแสดงผล
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {orderDirty && (
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
                onClick={() => void load()}
                className="btn-secondary min-h-11"
              >
                ยกเลิก
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-primary min-h-11 gap-2"
          >
            <IconPlus size={18} />
            เพิ่มแบนเนอร์
          </button>
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
            {conflict ? 'โหลดข้อมูลล่าสุด' : 'ลองใหม่'}
          </button>
        </div>
      )}

      {adding && (
        <form onSubmit={(e) => void handleCreate(e)} className="card space-y-4">
          <h2 className="text-lg font-bold text-zinc-900">เพิ่มแบนเนอร์ใหม่</h2>
          <ImageManager
            eventId={eventId}
            token={token}
            images={newImages}
            max={1}
            single
            onChange={setNewImages}
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              ลิงก์เมื่อคลิก (ไม่บังคับ)
            </span>
            <input
              type="url"
              maxLength={2000}
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="https://example.com"
              className="input-field"
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-zinc-700">
              แสดงแบนเนอร์บนหน้าร้าน
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setAdding(false);
                setNewImages([]);
                setNewLink('');
              }}
              className="btn-secondary min-h-11"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={creating || newImages.length === 0}
              className="btn-primary min-h-11 gap-2"
            >
              {creating && <IconLoader2 size={18} className="animate-spin" />}
              บันทึกแบนเนอร์
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card text-sm text-zinc-500">กำลังโหลดแบนเนอร์...</div>
      ) : banners.length === 0 ? (
        <div className="card text-sm text-zinc-500">ยังไม่มีแบนเนอร์</div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, idx) => {
            const isBusy = savingId === banner.id;
            const currentImg = draftImages[banner.id] ?? banner.image;
            const currentLink = draftLinks[banner.id] ?? banner.linkUrl ?? '';
            return (
              <div key={banner.id} className="card space-y-4">
                <ImageManager
                  eventId={eventId}
                  token={token}
                  images={currentImg ? [currentImg] : []}
                  max={1}
                  single
                  onChange={(imgs) => {
                    if (imgs[0]) {
                      setDraftImages((prev) => ({
                        ...prev,
                        [banner.id]: imgs[0],
                      }));
                    }
                  }}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-zinc-700">
                      ลิงก์เมื่อคลิก (ไม่บังคับ)
                    </span>
                    <input
                      type="url"
                      maxLength={2000}
                      value={currentLink}
                      onChange={(e) =>
                        setDraftLinks((prev) => ({
                          ...prev,
                          [banner.id]: e.target.value,
                        }))
                      }
                      placeholder="https://example.com"
                      className="input-field"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={banner.active}
                        disabled={isBusy}
                        onChange={() => void handleToggleActive(banner)}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-zinc-800">
                        แสดงบนหน้าร้าน
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={idx === 0 || savingOrder}
                        onClick={() => moveBanner(idx, -1)}
                        className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                        title="เลื่อนขึ้น"
                      >
                        <IconArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === banners.length - 1 || savingOrder}
                        onClick={() => moveBanner(idx, 1)}
                        className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                        title="เลื่อนลง"
                      >
                        <IconArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSaveBanner(banner)}
                        className="btn-primary min-h-11 gap-2"
                      >
                        {isBusy && (
                          <IconLoader2 size={16} className="animate-spin" />
                        )}
                        บันทึก
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDelete(banner)}
                        className="btn-danger min-h-11 gap-1"
                      >
                        <IconTrash size={16} />
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
