'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ImageAsset } from '@/types/merchandise';

export interface VariantImagePickerProps {
  images: ImageAsset[];
  value: string | null;
  onChange(id: string | null): void;
  label: string;
  disabled?: boolean;
}

export default function VariantImagePicker({
  images,
  value,
  onChange,
  label,
  disabled = false,
}: VariantImagePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const noImages = images.length === 0;
  const isDisabled = disabled || noImages;
  const selected = images.find((img) => img.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        disabled={isDisabled}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="btn-secondary min-h-11 gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.url}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
        ) : (
          <span className="text-xs text-zinc-600">ใช้รูปสินค้า</span>
        )}
      </button>

      {noImages && (
        <p className="mt-1 max-w-[220px] text-xs text-zinc-500">
          บันทึกรูปสินค้าก่อน จึงจะเลือกรูปให้ตัวเลือกได้
        </p>
      )}

      {open && !isDisabled && (
        <div
          id={popoverId}
          role="group"
          aria-label={label}
          className="absolute left-0 z-20 mt-1 w-max max-w-[min(20rem,80vw)] rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
        >
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => {
              const active = img.id === value;
              return (
                <button
                  key={img.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`รูปที่ ${idx + 1}`}
                  onClick={() => pick(img.id)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 p-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    active
                      ? 'border-emerald-600'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => pick(null)}
            className="btn-secondary mt-2 min-h-11 w-full"
          >
            ไม่กำหนดรูป
          </button>
        </div>
      )}
    </div>
  );
}
