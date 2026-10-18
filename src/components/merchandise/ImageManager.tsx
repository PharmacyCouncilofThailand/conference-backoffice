'use client';

import { useRef, useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import type { ImageAsset } from '@/types/merchandise';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadStatus = {
  id: string;
  name: string;
  state: 'uploading' | 'done' | 'error';
  message?: string;
};

export interface ImageManagerProps {
  eventId: number;
  token: string;
  images: ImageAsset[];
  max: number;
  onChange(images: ImageAsset[]): void;
  single?: boolean;
}

export default function ImageManager({
  eventId,
  token,
  images,
  max,
  onChange,
  single = false,
}: ImageManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (inputRef.current) {
      inputRef.current.value = '';
    }

    setUploading(true);
    let current = [...images];
    const batchStatuses: UploadStatus[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      name: f.name,
      state: 'uploading',
    }));
    setStatuses(batchStatuses);

    const updateStatus = (
      id: string,
      state: UploadStatus['state'],
      message?: string,
    ) => {
      setStatuses((prev) =>
        prev.map((s) => (s.id === id ? { ...s, state, message } : s)),
      );
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const statusId = batchStatuses[i].id;

      if (!single && current.length >= max) {
        updateStatus(statusId, 'error', `อัปโหลดได้สูงสุด ${max} รูป`);
        continue;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        updateStatus(
          statusId,
          'error',
          'ไฟล์รูปไม่ถูกต้อง รองรับ JPG PNG WebP',
        );
        continue;
      }
      if (file.size > MAX_BYTES) {
        updateStatus(statusId, 'error', 'รูปมีขนาดเกิน 5 MB');
        continue;
      }

      try {
        const uploaded = await merchandiseApi.uploadImage(eventId, file, token);
        if (single) {
          current = [uploaded];
        } else {
          current = [...current, uploaded];
        }
        onChange(current);
        updateStatus(statusId, 'done', 'สำเร็จ');
      } catch (err) {
        updateStatus(statusId, 'error', merchErrorMessage(err));
      }
    }

    setUploading(false);
  }

  function moveImage(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  function removeImage(index: number) {
    const next = images.filter((_, idx) => idx !== index);
    onChange(next);
  }

  const canAddMore = single || images.length < max;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          รองรับไฟล์ JPG, PNG, WebP ขนาดไม่เกิน 5 MB ต่อรูป
          {!single && ` (สูงสุด ${max} รูป · รูปแรกคือรูปหลัก)`}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={!single}
            disabled={uploading || !canAddMore}
            onChange={(e) => void handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading || !canAddMore}
            onClick={() => inputRef.current?.click()}
            className="btn-secondary min-h-11 gap-2"
          >
            {uploading ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconUpload size={18} />
            )}
            {single
              ? images.length > 0
                ? 'เปลี่ยนรูป'
                : 'เลือกรูป'
              : 'อัปโหลดรูป'}
          </button>
        </div>
      </div>

      {statuses.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-zinc-50 p-3 text-xs">
          {statuses.map((st) => (
            <li key={st.id} className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-zinc-700">
                {st.name}
              </span>
              {st.state === 'uploading' && (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <IconLoader2 size={14} className="animate-spin" />
                  กำลังอัปโหลด...
                </span>
              )}
              {st.state === 'done' && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <IconCheck size={14} />
                  {st.message ?? 'สำเร็จ'}
                </span>
              )}
              {st.state === 'error' && (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <IconX size={14} />
                  {st.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          ยังไม่มีรูปภาพ
        </div>
      ) : (
        <div
          className={
            single
              ? 'space-y-2'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'
          }
        >
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-2"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`รูปที่ ${idx + 1}`}
                  className={
                    single
                      ? 'max-h-56 w-full rounded-lg object-cover'
                      : 'aspect-square w-full rounded-lg object-cover'
                  }
                />
                {!single && idx === 0 && (
                  <span className="badge badge-success absolute left-2 top-2">
                    รูปหลัก
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                {!single ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveImage(idx, -1)}
                      className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                      title="เลื่อนซ้าย"
                    >
                      <IconArrowLeft size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => moveImage(idx, 1)}
                      className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                      title="เลื่อนขวา"
                    >
                      <IconArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">
                    {img.width} × {img.height} px
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <IconTrash size={14} />
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
