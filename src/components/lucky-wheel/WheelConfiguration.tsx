"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCirclePlus,
  IconDeviceFloppy,
  IconLoader2,
  IconPhoto,
  IconTrash,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import type {
  AdminWheelState,
  WheelConfiguration as WheelConfigurationValue,
  WheelConfigurationSegment,
} from "@/types/lucky-wheel";

type Props = {
  eventId: number;
  token: string;
  state: AdminWheelState;
  onReload: () => Promise<void>;
};

const blankConfiguration = (): WheelConfigurationValue => ({
  segments: [],
  collectionInstructions: { th: "", en: "" },
  collectionDeadline: "",
});

const toBangkokInput = (iso: string) => {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
};

const fromBangkokInput = (value: string) =>
  value ? new Date(`${value}:00+07:00`).toISOString() : "";

const normalizeForEdit = (state: AdminWheelState): WheelConfigurationValue => {
  if (state.wheel.configuration) {
    return structuredClone(state.wheel.configuration);
  }
  return blankConfiguration();
};

export function WheelConfiguration({ eventId, token, state, onReload }: Props) {
  const [draft, setDraft] = useState<WheelConfigurationValue>(() => normalizeForEdit(state));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setDraft(normalizeForEdit(state));
    setReason("");
    setStale(false);
  }, [state]);

  const original = useMemo(() => normalizeForEdit(state), [state]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const existingKinds = useMemo(
    () => new Map(state.segments.map((segment) => [segment.id, segment.kind])),
    [state.segments],
  );

  const updateSegment = (
    id: string,
    updater: (segment: WheelConfigurationSegment) => WheelConfigurationSegment,
  ) => {
    setDraft((current) => ({
      ...current,
      segments: current.segments.map((segment) =>
        segment.id === id ? updater(segment) : segment,
      ),
    }));
  };

  const addSegment = (kind: "prize" | "no_prize") => {
    setDraft((current) => ({
      ...current,
      segments: [
        ...current.segments,
        {
          id: crypto.randomUUID(),
          kind,
          name: { th: "", en: "" },
          imageId: null,
          enabled: true,
          position: current.segments.length,
        },
      ],
    }));
  };

  const removeSegment = (id: string) => {
    setDraft((current) => ({
      ...current,
      segments: current.segments
        .filter((segment) => segment.id !== id)
        .map((segment, index) => ({ ...segment, position: index })),
    }));
  };

  const uploadImage = async (segmentId: string, file: File) => {
    setUploadingId(segmentId);
    try {
      const uploaded = await api.luckyWheel.uploadImage(token, eventId, file);
      updateSegment(segmentId, (segment) => ({ ...segment, imageId: uploaded.imageId }));
      toast.success("อัปโหลดรูปวงล้อแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingId(null);
    }
  };

  const save = async () => {
    if (!dirty || saving) return;
    if (!draft.segments.some((segment) => segment.kind === "prize")) {
      toast.error("ต้องมีอย่างน้อย 1 ช่องของรางวัล");
      return;
    }
    if (
      draft.segments.some(
        (segment) =>
          !segment.name.th.trim() ||
          !segment.name.en.trim(),
      ) ||
      !draft.collectionInstructions.th.trim() ||
      !draft.collectionInstructions.en.trim() ||
      !draft.collectionDeadline
    ) {
      toast.error("กรอกชื่อ TH/EN จุดรับของ และกำหนดเวลารับของให้ครบ");
      return;
    }

    setSaving(true);
    setStale(false);
    try {
      await api.luckyWheel.publish(token, eventId, {
        expectedVersion: state.wheel.version,
        configuration: draft,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success("บันทึกและเผยแพร่การตั้งค่าวงล้อแล้ว");
      await onReload();
    } catch (error) {
      if (error instanceof ApiError && error.code === "WHEEL_UPDATED") {
        setStale(true);
        toast.error("มีการแก้ไขวงล้อจากที่อื่น กรุณาโหลดข้อมูลล่าสุดก่อน");
      } else {
        toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-7" aria-labelledby="wheel-config-title">
      <div className="flex flex-col gap-5 border-b border-zinc-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">01 · Configuration</p>
          <h2 id="wheel-config-title" className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">ช่องในวงล้อและการรับรางวัล</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">จัดลำดับช่อง กำหนดชื่อสองภาษาและรูป แล้วเผยแพร่ทั้งชุดพร้อมกัน</p>
          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${dirty ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
            {dirty ? "มีการแก้ไขที่ยังไม่เผยแพร่" : `ข้อมูลตรงกับ server · v${state.wheel.version}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11 px-3 text-xs sm:text-sm" onClick={() => addSegment("prize")}>
            <IconCirclePlus size={17} /> เพิ่มรางวัล
          </button>
          <button type="button" className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 min-h-11 px-3 text-xs sm:text-sm" onClick={() => addSegment("no_prize")}>
            <IconCirclePlus size={17} /> เพิ่มช่องไม่ได้รางวัล
          </button>
        </div>
      </div>

      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <span className="flex items-center gap-2"><IconAlertTriangle size={18} />ข้อมูลบน server เปลี่ยนแล้ว ระบบจะไม่เขียนทับแบบเงียบ ๆ</span>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void onReload()}>
            โหลดข้อมูลล่าสุด
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-950">ช่องบนวงล้อ</h3>
          <p className="text-xs font-medium text-zinc-500">{draft.segments.length} ช่อง · ช่องที่หมดจะยังแสดงตำแหน่งเดิม</p>
        </div>
        {draft.segments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm leading-6 text-zinc-600">
            ยังไม่มีช่องในวงล้อ เพิ่มของรางวัลหรือช่องไม่ได้รางวัลก่อนเผยแพร่
          </div>
        ) : (
          draft.segments.map((segment, index) => {
            const originalKind = existingKinds.get(segment.id);
            return (
              <div key={segment.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_2px_12px_rgba(24,24,27,0.03)] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-950 text-sm font-bold tabular-nums text-white">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">{segment.name.th || (segment.kind === "prize" ? "รางวัลใหม่" : "ช่องไม่ได้รางวัล")}</p>
                      <p className="text-xs text-zinc-500">ตำแหน่งที่ {index + 1} · {segment.kind === "prize" ? "ของรางวัล" : "ไม่ได้รางวัล"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                    onClick={() => removeSegment(segment.id)}
                    aria-label={`ลบช่อง ${segment.name.th || index + 1}`}
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(120px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                  <label className="text-xs font-medium text-zinc-500">
                    ประเภท
                    <select
                      className="input-field mt-1"
                      value={segment.kind}
                      disabled={Boolean(originalKind)}
                      onChange={(event) =>
                        updateSegment(segment.id, (current) => ({
                          ...current,
                          kind: event.target.value as "prize" | "no_prize",
                          imageId: event.target.value === "no_prize" ? null : current.imageId,
                        }))
                      }
                    >
                      <option value="prize">ของรางวัล</option>
                      <option value="no_prize">ไม่ได้รางวัล</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-zinc-500">
                    ชื่อภาษาไทย
                    <input
                      className="input-field mt-1"
                      maxLength={160}
                      value={segment.name.th}
                      onChange={(event) =>
                        updateSegment(segment.id, (current) => ({
                          ...current,
                          name: { ...current.name, th: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs font-medium text-zinc-500">
                    English name
                    <input
                      className="input-field mt-1"
                      maxLength={160}
                      value={segment.name.en}
                      onChange={(event) =>
                        updateSegment(segment.id, (current) => ({
                          ...current,
                          name: { ...current.name, en: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={segment.enabled}
                      onChange={(event) =>
                        updateSegment(segment.id, (current) => ({ ...current, enabled: event.target.checked }))
                      }
                    />
                    เปิดใช้งาน
                  </label>
                </div>

                {segment.kind === "prize" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
                    <label className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                      {uploadingId === segment.id ? <IconLoader2 size={17} className="animate-spin" /> : <IconPhoto size={17} />}
                      {segment.imageId ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadingId === segment.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadImage(segment.id, file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <span className="text-xs text-zinc-500">
                      {segment.imageId ? `Trusted image ID: ${segment.imageId}` : "JPEG/PNG/WebP สูงสุด 5 MiB"}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
        <h3 className="text-base font-semibold text-zinc-950">การรับของรางวัล</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">ข้อความนี้แสดงบนหลักฐานรางวัลของผู้เข้าร่วม</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-zinc-700">
          จุดรับของ / วิธีรับของ (TH)
          <textarea
            className="input-field mt-1 min-h-24 resize-y"
            value={draft.collectionInstructions.th}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                collectionInstructions: { ...current.collectionInstructions, th: event.target.value },
              }))
            }
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Collection instructions (EN)
          <textarea
            className="input-field mt-1 min-h-24 resize-y"
            value={draft.collectionInstructions.en}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                collectionInstructions: { ...current.collectionInstructions, en: event.target.value },
              }))
            }
          />
        </label>
        <label className="text-sm font-medium text-zinc-700">
          กำหนดเวลารับของ (เวลาไทย)
          <input
            className="input-field mt-1"
            type="datetime-local"
            value={toBangkokInput(draft.collectionDeadline)}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                collectionDeadline: fromBangkokInput(event.target.value),
              }))
            }
          />
          <span className="mt-1 block text-xs font-normal text-zinc-500">Asia/Bangkok (UTC+7)</span>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          เหตุผลการแก้ไข
          <input
            className="input-field mt-1"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="จำเป็นเมื่อเปลี่ยน deadline ที่เคยเผยแพร่"
          />
        </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="max-w-xl text-sm leading-6 text-emerald-950">
          การแก้ฟอร์มยังไม่กระทบผู้เข้าร่วมจนกดบันทึกและเผยแพร่
        </p>
        <button type="button" className="btn-primary min-h-11 shrink-0" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <IconLoader2 size={17} className="animate-spin" /> : <IconDeviceFloppy size={17} />}
          บันทึกและเผยแพร่
        </button>
      </div>
    </section>
  );
}
