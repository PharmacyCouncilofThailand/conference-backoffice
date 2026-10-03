"use client";

import { useMemo, useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  IconAlertTriangle,
  IconCamera,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { api, ApiError } from "@/lib/api";
import type { RewardLookup } from "@/types/lucky-wheel";

type Props = {
  eventId: number;
  token: string;
  onChanged: () => Promise<void> | void;
};

const formatBangkok = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

export function RewardCollection({ eventId, token, onChanged }: Props) {
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [credential, setCredential] = useState("");
  const [lookup, setLookup] = useState<RewardLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [collectionPoint, setCollectionPoint] = useState("");
  const [deliveredDetails, setDeliveredDetails] = useState("");
  const [confirmationKey, setConfirmationKey] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const lastScannedRef = useRef("");

  const deadlinePassed = useMemo(
    () => Boolean(lookup?.collectionDeadline && Date.now() >= new Date(lookup.collectionDeadline).getTime()),
    [lookup?.collectionDeadline],
  );

  const applyLookup = (result: RewardLookup, normalized: string) => {
    setLookup(result);
    setCredential(normalized);
    setIdentityChecked(false);
    setCollectionPoint(result.collectionPoint || "");
    setDeliveredDetails(result.deliveredDetails || "");
    setConfirmationKey(crypto.randomUUID());
    setCorrectionOpen(false);
    setCorrectionReason("");
  };

  const refreshLookup = async (raw: string) => {
    const normalized = raw.trim();
    const result = await api.luckyWheel.lookupReward(token, eventId, normalized);
    applyLookup(result, normalized);
  };

  const runLookup = async (raw = credential) => {
    const normalized = raw.trim();
    if (!normalized || loading) return;
    setLoading(true);
    setUncertain(false);
    try {
      await refreshLookup(normalized);
    } catch (error) {
      setLookup(null);
      toast.error(error instanceof Error ? error.message : "ไม่พบรางวัล");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!lookup || !identityChecked || !collectionPoint.trim() || loading) return;
    setLoading(true);
    setUncertain(false);
    try {
      await api.luckyWheel.confirmRedemption(token, eventId, lookup.spinId, {
        eventId,
        spinId: lookup.spinId,
        claimGeneration: lookup.claimGeneration,
        idempotencyKey: confirmationKey,
        identityChecked: true,
        collectionPoint: collectionPoint.trim(),
        deliveredDetails: deliveredDetails.trim() || null,
      });
      toast.success("ยืนยันส่งมอบของรางวัลแล้ว");
      await refreshLookup(credential);
      await onChanged();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status >= 500 ||
        error.name === "TypeError"
      ) {
        setUncertain(true);
      }
      toast.error(error instanceof Error ? error.message : "ยืนยันรับของไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const correct = async () => {
    if (!lookup || !correctionReason.trim() || loading) return;
    setLoading(true);
    try {
      await api.luckyWheel.correctRedemption(token, eventId, lookup.spinId, {
        eventId,
        spinId: lookup.spinId,
        claimGeneration: lookup.claimGeneration,
        reason: correctionReason.trim(),
        reopen: true,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("เปิด claim รุ่นใหม่แล้ว พร้อมเก็บเหตุผลการแก้ไข");
      await refreshLookup(credential);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "แก้ไขสถานะรับของไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="reward-collection-title">
      <div>
        <h2 id="reward-collection-title" className="text-lg font-semibold text-zinc-900">ตรวจและส่งมอบของรางวัล</h2>
        <p className="mt-1 text-sm text-zinc-500">
          การสแกนทำแค่ค้นหาและ preview เท่านั้น ระบบไม่ยืนยันรับของอัตโนมัติ
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" className={`btn ${mode === "manual" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("manual")}>
          <IconSearch size={17} /> รหัส
        </button>
        <button type="button" className={`btn ${mode === "camera" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMode("camera")}>
          <IconCamera size={17} /> กล้อง
        </button>
      </div>

      {mode === "camera" && (
        <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-black">
          <Scanner
            onScan={(codes) => {
              const raw = codes[0]?.rawValue?.trim();
              if (!raw || raw === lastScannedRef.current) return;
              lastScannedRef.current = raw;
              setCredential(raw);
              void runLookup(raw);
            }}
            onError={() => toast.error("ไม่สามารถเปิดกล้องได้")}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          value={credential}
          onChange={(event) => {
            setCredential(event.target.value);
            lastScannedRef.current = "";
          }}
          placeholder="PRIS-REWARD:... หรือรหัสตัวอักษร"
          onKeyDown={(event) => {
            if (event.key === "Enter") void runLookup();
          }}
        />
        <button type="button" className="btn btn-primary" disabled={loading || !credential.trim()} onClick={() => void runLookup()}>
          {loading ? <IconLoader2 size={17} className="animate-spin" /> : <IconSearch size={17} />}
          ค้นหา
        </button>
      </div>

      {uncertain && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <div className="flex gap-2">
            <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">สถานะการยืนยันยังไม่แน่นอน</p>
              <p className="mt-1">อย่าส่งมอบซ้ำ ให้กดยืนยันคำขอเดิมอีกครั้ง ระบบจะใช้ request เดิมเพื่อตรวจ/replay ผลที่ commit แล้ว</p>
            </div>
          </div>
        </div>
      )}

      {lookup && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="grid gap-4 border-b border-zinc-100 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">ผู้ได้รับรางวัล</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{lookup.owner.firstName} {lookup.owner.lastName}</p>
              <p className="text-sm text-zinc-500">{lookup.owner.email} · User #{lookup.owner.id}</p>
              <p className="mt-3 text-sm font-medium text-amber-800">ตรวจตัวตนกับผู้มารับของก่อนกดยืนยันทุกครั้ง</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">รางวัล</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{lookup.prize.name.th}</p>
              <p className="text-sm text-zinc-500">{lookup.prize.name.en} · ได้เมื่อ {formatBangkok(lookup.prize.awardedAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-medium ${lookup.status === "redeemed" ? "bg-zinc-100 text-zinc-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {lookup.status === "redeemed" ? "รับของแล้ว" : "ยังไม่รับของ"}
                </span>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700">Claim #{lookup.claimGeneration}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                <p className="font-medium text-zinc-700">กำหนดรับของ</p>
                <p className={deadlinePassed ? "mt-1 text-rose-700" : "mt-1 text-zinc-600"}>{formatBangkok(lookup.collectionDeadline)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                <p className="font-medium text-zinc-700">สถานะเดิม</p>
                <p className="mt-1 text-zinc-600">
                  {lookup.status === "redeemed"
                    ? `ยืนยันโดย Admin #${lookup.redeemedBy ?? "-"} เมื่อ ${formatBangkok(lookup.redeemedAt)}`
                    : "ยังไม่มีการยืนยันส่งมอบ"}
                </p>
              </div>
            </div>

            {lookup.status === "open" ? (
              <>
                {deadlinePassed && (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                    เลยกำหนดรับของแล้ว ต้องแก้ deadline ผ่านการตั้งค่าที่มี audit reason ก่อน จึงจะยืนยันได้
                  </p>
                )}
                <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={identityChecked}
                    onChange={(event) => setIdentityChecked(event.target.checked)}
                  />
                  <span><strong>ตรวจตัวตนแล้ว</strong><br /><span className="text-zinc-500">ชื่อและบัญชีตรงกับผู้ที่มายืนยันรับของ</span></span>
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-medium text-zinc-700">
                    จุดส่งมอบจริง
                    <input className="input mt-1" value={collectionPoint} onChange={(event) => setCollectionPoint(event.target.value)} />
                  </label>
                  <label className="text-sm font-medium text-zinc-700">
                    รายละเอียดส่งมอบ (ถ้ามี)
                    <input
                      className="input mt-1"
                      value={deliveredDetails}
                      onChange={(event) => setDeliveredDetails(event.target.value)}
                      placeholder="เช่น เสื้อ Size L — เป็นบันทึกที่ส่งมอบจริง ไม่ใช่การรับประกันไซซ์"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!identityChecked || !collectionPoint.trim() || deadlinePassed || loading}
                  onClick={() => void confirm()}
                >
                  {loading ? <IconLoader2 size={17} className="animate-spin" /> : uncertain ? <IconRefresh size={17} /> : <IconCheck size={17} />}
                  {uncertain ? "ตรวจ/ยืนยันคำขอเดิม" : "ยืนยันส่งมอบของรางวัล"}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <button type="button" className="text-sm font-semibold text-amber-700 underline underline-offset-4" onClick={() => setCorrectionOpen((value) => !value)}>
                  ต้องแก้ไขการรับของ?
                </button>
                {correctionOpen && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">Correction เป็น action แยกและเก็บประวัติเดิมไว้</p>
                    <textarea
                      className="input mt-3 min-h-20 resize-y"
                      value={correctionReason}
                      maxLength={500}
                      onChange={(event) => setCorrectionReason(event.target.value)}
                      placeholder="เหตุผลที่ต้องเปิด claim ใหม่"
                    />
                    <button type="button" className="btn btn-secondary mt-3" disabled={!correctionReason.trim() || loading} onClick={() => void correct()}>
                      เปิด claim รุ่นใหม่พร้อม audit
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
