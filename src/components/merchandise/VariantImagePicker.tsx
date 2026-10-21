'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const noImages = images.length === 0;
  const isDisabled = disabled || noImages;
  const selected = images.find((img) => img.id === value) ?? null;

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const pop = popoverRef.current;
    if (!trigger || !pop) return;
    const margin = 8;
    const r = trigger.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + 4;
    if (top + h > vh - margin && r.top - 4 - h >= margin) {
      top = r.top - 4 - h;
    }
    top = Math.max(margin, Math.min(top, vh - margin - h));
    const left = Math.max(margin, Math.min(r.left, vw - margin - w));
    setPos({ top, left });
  }, [open, images.length]);

  useEffect(() => {
    if (!open || !pos) return;
    const pop = popoverRef.current;
    if (!pop || pop.contains(document.activeElement)) return;
    const target =
      pop.querySelector<HTMLElement>('button[aria-pressed="true"]') ??
      pop.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    function inside(target: EventTarget | null) {
      const node = target as Node | null;
      return (
        !!node &&
        (!!rootRef.current?.contains(node) ||
          !!popoverRef.current?.contains(node))
      );
    }
    function onPointerDown(e: MouseEvent) {
      if (!inside(e.target)) setOpen(false);
    }
    function onScroll(e: Event) {
      if (!inside(e.target)) setOpen(false);
    }
    function onFocusIn(e: FocusEvent) {
      if (!inside(e.target)) setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
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
        onClick={() => {
          if (!open) setPos(null);
          setOpen((o) => !o);
        }}
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

      {open &&
        !isDisabled &&
        createPortal(
          <div
            ref={popoverRef}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const btns = e.currentTarget.querySelectorAll('button');
              const first = btns[0];
              const last = btns[btns.length - 1];
              const active = document.activeElement;
              if (
                (!e.shiftKey && active === last) ||
                (e.shiftKey && active === first)
              ) {
                // leaving the popover: close and continue tabbing from the trigger
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
            id={popoverId}
            role="group"
            aria-label={label}
            style={{
              position: 'fixed',
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="z-50 w-max max-w-[min(20rem,80vw)] rounded-xl border border-zinc-200 bg-white p-3 shadow-lg"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
