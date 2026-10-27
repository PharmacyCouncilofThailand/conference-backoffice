'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import {
  IconAlertTriangle,
  IconArrowBack,
  IconCamera,
  IconCheck,
  IconKeyboard,
  IconLoader2,
  IconRefresh,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { AdminLayout } from '@/components/layout';
import { api, ApiError, type CheckinDeskSummary } from '@/lib/api';
import { PrisDeskDashboard } from '@/components/checkin/PrisDeskDashboard';
import {
  PrisScanResultModal,
  type DeskRegistration,
  type DeskResult,
} from '@/components/checkin/PrisScanResultModal';
import {
  playDuplicateSound,
  playErrorSound,
  playSuccessSound,
} from '@/lib/checkin-sounds';
import {
  CHECKIN_TEST_NOTICE,
  isCheckinTestCode,
  testRegistration,
} from '@/lib/checkin-test-mode';

interface RecentCheckin {
  id: number | string;
  kind?: 'daily' | 'single';
  attendanceId?: string | null;
  registrationSessionId: number;
  regCode: string;
  firstName: string;
  lastName: string;
  scannedAt: string;
}

const getBackofficeToken = () =>
  localStorage.getItem('backoffice_token') ||
  sessionStorage.getItem('backoffice_token') ||
  '';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const bangkokTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

function duplicateDetails(error: unknown): {
  registration?: DeskRegistration;
  checkedInAt?: string;
} {
  if (!(error instanceof ApiError) || !error.details) return {};
  if (typeof error.details !== 'object') return {};
  const d = error.details as Record<string, unknown>;
  const reg = d.registration;
  return {
    registration:
      reg && typeof reg === 'object' ? (reg as DeskRegistration) : undefined,
    checkedInAt: typeof d.checkedInAt === 'string' ? d.checkedInAt : undefined,
  };
}

export function PrisCheckinDesk({
  eventId,
  onExit,
}: {
  eventId: number;
  onExit?: () => void;
}) {
  const [token, setToken] = useState('');
  const [desk, setDesk] = useState<CheckinDeskSummary | null>(null);
  const [deskError, setDeskError] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<DeskResult | null>(null);
  const [isTest, setIsTest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recent, setRecent] = useState<RecentCheckin[]>([]);

  const manualInputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef('');
  const busyRef = useRef(false);
  const processScanRef = useRef<(code: string) => void>(() => {});

  useEffect(() => {
    setToken(getBackofficeToken());
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCameraSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.checkins
      .deskSummary(token, eventId)
      .then((d) => {
        if (!cancelled) setDesk(d);
      })
      .catch(() => {
        if (!cancelled) setDeskError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, eventId]);

  const mainSessionId = desk?.mainSession.id;

  const fetchRecent = useCallback(async () => {
    if (!token || !mainSessionId) return;
    try {
      const res = await api.checkins.list(
        token,
        `limit=10&eventId=${eventId}&sessionId=${mainSessionId}`,
      );
      setRecent(
        res.checkins.map((c) => ({
          id: c.id,
          kind: c.kind,
          attendanceId: c.attendanceId,
          registrationSessionId: c.registrationSessionId,
          regCode: c.regCode,
          firstName: c.firstName,
          lastName: c.lastName,
          scannedAt: new Date(c.scannedAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Bangkok',
          }),
        })),
      );
    } catch (error) {
      console.error('Failed to fetch recent check-ins:', error);
    }
  }, [token, eventId, mainSessionId]);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent, refreshKey]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchRecent();
        setRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchRecent]);

  // Keep the manual input focused whenever scanning is possible.
  useEffect(() => {
    if (scanMode === 'manual' && !result && !isLoading && desk) {
      const t = setTimeout(() => manualInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [scanMode, result, isLoading, desk]);

  const showResult = (r: DeskResult) => {
    if (soundEnabled) {
      if (r.status === 'success') playSuccessSound();
      else if (r.status === 'duplicate') playDuplicateSound();
      else playErrorSound();
    }
    setResult(r);
  };

  const simulateTest = async (mainId: number) => {
    setIsTest(true);
    let registration: DeskRegistration = testRegistration(
      desk?.eventName,
    ) as DeskRegistration;
    let checkedInAt: string | null = null;
    try {
      const sample = await api.checkins.testSample(token, eventId, mainId);
      registration = sample.registration;
      checkedInAt =
        sample.sessions.find((s) => s.sessionId === mainId)?.checkedInAt ??
        null;
    } catch {
      // Fall back to the built-in test attendee.
    }
    if (checkedInAt) {
      showResult({
        status: 'duplicate',
        message: 'วันนี้เช็คอินแล้ว',
        code: registration.regCode,
        registration,
        checkedInTime: bangkokTime(checkedInAt),
      });
    } else {
      showResult({
        status: 'success',
        message: 'เช็คอินสำเร็จ',
        code: registration.regCode,
        registration,
      });
    }
  };

  const processScan = async (code: string) => {
    if (busyRef.current || !desk) return;
    busyRef.current = true;
    setIsLoading(true);
    setIsTest(false);
    try {
      if (isCheckinTestCode(code)) {
        await simulateTest(desk.mainSession.id);
        return;
      }
      try {
        const res = await api.checkins.create(token, {
          regCode: code,
          assignedSessionId: desk.mainSession.id,
        });
        showResult({
          status: 'success',
          message: 'เช็คอินสำเร็จ',
          code,
          registration: res.registration,
        });
        setRefreshKey((k) => k + 1);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'ALREADY_CHECKED_IN') {
          const { registration, checkedInAt } = duplicateDetails(error);
          showResult({
            status: 'duplicate',
            message: 'วันนี้เช็คอินแล้ว',
            code,
            registration,
            checkedInTime: bangkokTime(checkedInAt),
          });
        } else if (error instanceof ApiError && error.status === 404) {
          showResult({ status: 'error', message: 'ไม่พบรหัสลงทะเบียน', code });
        } else {
          showResult({
            status: 'error',
            message: errorMessage(error, 'สแกนไม่สำเร็จ'),
            code,
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  processScanRef.current = processScan;

  const handleQrScan = useCallback((results: { rawValue: string }[]) => {
    if (!results || results.length === 0) return;
    const scanned = results[0].rawValue.trim().toUpperCase();
    if (scanned && scanned !== lastScannedRef.current) {
      lastScannedRef.current = scanned;
      processScanRef.current(scanned);
    }
  }, []);

  const handleNext = () => {
    busyRef.current = false;
    lastScannedRef.current = '';
    setResult(null);
    setIsTest(false);
    setTimeout(() => manualInputRef.current?.focus(), 100);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (code) {
      setManualCode('');
      void processScan(code);
    }
  };

  const handleUndo = async (checkin: RecentCheckin) => {
    try {
      let res;
      if (checkin.kind === 'daily' && checkin.attendanceId) {
        const reason = window
          .prompt('เหตุผลในการยกเลิกเช็คอิน (จำเป็น)')
          ?.trim();
        if (!reason) return;
        res = await api.checkins.undoDaily(token, checkin.attendanceId, reason);
      } else {
        if (!window.confirm('ยกเลิกเช็คอินนี้?')) return;
        res = await api.checkins.undo(token, checkin.registrationSessionId);
      }
      if (res.success) {
        toast.success('ยกเลิกเช็คอินแล้ว');
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'ยกเลิกไม่สำเร็จ'));
    }
  };

  const title = `Check-in: ${desk?.eventName ?? 'PRIS 2026'}`;

  if (deskError) {
    return (
      <AdminLayout title="Check-in: PRIS 2026">
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <IconAlertTriangle size={32} className="text-amber-500" />
          <p className="text-zinc-600">โหลดข้อมูลหน้าเช็คอินไม่สำเร็จ</p>
          {onExit && (
            <button onClick={onExit} className="btn-primary px-6">
              กลับ
            </button>
          )}
        </div>
      </AdminLayout>
    );
  }

  const scanning = !isLoading && !result;

  return (
    <AdminLayout title={title}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-lg bg-zinc-100 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200"
            title="เลือกอีเวนต์"
          >
            <IconArrowBack size={18} />
          </button>
        )}
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          วันที่ {desk?.serverDate ?? 'กำลังโหลด'}
        </span>
        {desk?.window && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-600">
            เปิดสแกน {desk.window.open}–{desk.window.close} น.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card flex min-h-[420px] flex-col">
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => {
                  if (!cameraSupported) {
                    toast.error(
                      'Camera requires HTTPS. Please access via a secure URL.',
                    );
                    return;
                  }
                  setScanMode('camera');
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  !cameraSupported
                    ? 'cursor-not-allowed bg-zinc-100 text-zinc-400'
                    : scanMode === 'camera'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                <IconCamera size={18} /> Camera
                {!cameraSupported && <span className="text-xs">(HTTPS only)</span>}
              </button>
              <button
                onClick={() => setScanMode('manual')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  scanMode === 'manual'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                <IconKeyboard size={18} /> Manual
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`rounded-lg p-2 transition-colors ${soundEnabled ? 'bg-zinc-100 text-zinc-500' : 'bg-red-100 text-red-600'}`}
                title={soundEnabled ? 'Mute' : 'Unmute'}
              >
                {soundEnabled ? <IconVolume size={20} /> : <IconVolumeOff size={20} />}
              </button>
            </div>

            {!cameraSupported && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-sm text-amber-800">
                  Camera requires HTTPS. Manual entry is available.
                </p>
              </div>
            )}

            {(!desk || isLoading) && (
              <div className="flex flex-1 flex-col items-center justify-center text-emerald-600">
                <IconLoader2 size={48} className="mb-4 animate-spin" />
                <p className="text-lg font-medium">กำลังดำเนินการ...</p>
              </div>
            )}

            {desk && scanning && scanMode === 'camera' && (
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl">
                  <Scanner
                    onScan={handleQrScan}
                    onError={(err: unknown) => {
                      console.error('Scanner error:', err);
                      const msg = (
                        err instanceof Error ? err.message : String(err)
                      ).toLowerCase();
                      if (msg.includes('secure') || msg.includes('https')) {
                        setCameraSupported(false);
                      } else if (
                        msg.includes('permission') ||
                        msg.includes('notallowed')
                      ) {
                        toast.error('Camera permission denied.');
                      } else {
                        toast.error('Cannot access camera. Using manual entry.');
                      }
                      setScanMode('manual');
                    }}
                    constraints={{ facingMode: 'environment' }}
                    styles={{
                      container: { borderRadius: '0.75rem', overflow: 'hidden' },
                    }}
                  />
                </div>
                <p className="mt-3 text-center text-sm text-zinc-400">
                  ถือกล้องให้ตรงกับ QR code
                </p>
              </div>
            )}

            {desk && scanning && scanMode === 'manual' && (
              <div className="flex flex-1 flex-col items-center justify-center py-8">
                <form onSubmit={handleManualSubmit} className="mx-auto w-full max-w-md">
                  <label className="mb-2 block text-center text-sm font-medium text-zinc-600">
                    กรอกรหัสลงทะเบียน
                  </label>
                  <div className="mb-2 flex gap-2">
                    <input
                      ref={manualInputRef}
                      type="text"
                      className="input-field text-center font-mono text-2xl uppercase tracking-wider"
                      placeholder="REG-XXXX"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary px-6">
                      <IconCheck size={24} />
                    </button>
                  </div>
                  <p className="text-center text-xs text-zinc-400">
                    กด Enter เพื่อยืนยัน
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {token && (
            <PrisDeskDashboard
              token={token}
              eventId={eventId}
              refreshKey={refreshKey}
            />
          )}

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-800">Recent Scans</h3>
              <button
                onClick={() => void fetchRecent()}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
                title="Refresh"
              >
                <IconRefresh size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {recent.length === 0 ? (
                <p className="py-4 text-center text-zinc-400">No recent scans</p>
              ) : (
                recent.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-green-50 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                        <IconCheck size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="font-mono text-xs text-zinc-400">{c.regCode}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-zinc-400">{c.scannedAt}</span>
                      <button
                        onClick={() => void handleUndo(c)}
                        className="rounded p-1 text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600"
                        title="Undo check-in"
                      >
                        <IconArrowBack size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {result && <PrisScanResultModal result={result} onNext={handleNext} />}
      {isTest && result && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 right-4 z-[60] rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-lg"
        >
          {CHECKIN_TEST_NOTICE}
        </div>
      )}
    </AdminLayout>
  );
}
