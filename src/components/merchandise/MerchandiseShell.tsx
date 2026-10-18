'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { IconLoader2, IconRefresh } from '@tabler/icons-react';
import { AdminLayout } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import { routeForEventSwitch } from '@/lib/merchandiseRoutes';
import {
  badgeClassForStore,
  formatBangkok,
  storeStateLabel,
} from '@/lib/merchandiseFormat';
import type { AdminStoreDto } from '@/types/merchandise';
import {
  MerchandiseContext,
  MERCH_TABS,
  merchHref,
} from './MerchandiseContext';

type EventOption = { id: number; eventName: string; eventCode: string };

const STORAGE_KEY = 'merch:lastEventId';

function readStoredEventId(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeStoredEventId(eventId: number): void {
  try {
    if (eventId > 0) {
      localStorage.setItem(STORAGE_KEY, String(eventId));
    }
  } catch {
    // ignore storage errors
  }
}

export default function MerchandiseShell({
  children,
}: {
  children: ReactNode;
}) {
  const { user, token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const admin = user?.role === 'admin';

  const queryEventId = Number(searchParams.get('eventId'));
  const validQueryEventId =
    Number.isSafeInteger(queryEventId) && queryEventId > 0 ? queryEventId : 0;

  const [eventId, setEventId] = useState<number>(validQueryEventId);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [store, setStore] = useState<AdminStoreDto | null>(null);
  const [openReviews, setOpenReviews] = useState(0);
  const [loadingShell, setLoadingShell] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (validQueryEventId > 0 && validQueryEventId !== eventId) {
      setEventId(validQueryEventId);
      writeStoredEventId(validQueryEventId);
    }
  }, [validQueryEventId, eventId]);

  useEffect(() => {
    if (!admin || !token) return;
    let active = true;
    setEventsLoading(true);
    api.backofficeEvents
      .list(token, 'limit=1000')
      .then((res) => {
        if (!active) return;
        const list = (res.events ?? []) as unknown as EventOption[];
        setEvents(list);
        if (!validQueryEventId) {
          const stored = readStoredEventId();
          const storedMatch =
            stored > 0 && list.some((e) => e.id === stored) ? stored : 0;
          const prisMatch =
            list.find((e) => e.eventCode === 'PRIS-2026')?.id ?? 0;
          const initial = storedMatch || prisMatch;
          if (initial > 0) {
            setEventId(initial);
            writeStoredEventId(initial);
            const extra: Record<string, string> = {};
            searchParams.forEach((v, k) => {
              if (k !== 'eventId') extra[k] = v;
            });
            router.replace(merchHref(pathname, initial, extra));
          }
        } else {
          writeStoredEventId(validQueryEventId);
        }
      })
      .catch((err) => {
        if (active) setError(merchErrorMessage(err));
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [admin, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadStore = useCallback(async () => {
    if (!admin || !token || !eventId) return;
    const nextStore = await merchandiseApi.getStore(eventId, token);
    setStore(nextStore);
  }, [admin, token, eventId]);

  const reloadReviews = useCallback(async () => {
    if (!admin || !token || !eventId) return;
    const reviews = await merchandiseApi.listReviews(eventId, false, token);
    setOpenReviews(reviews.length);
  }, [admin, token, eventId]);

  const loadAll = useCallback(async () => {
    if (!admin || !token || !eventId) return;
    setLoadingShell(true);
    setError('');
    try {
      const [nextStore, reviews] = await Promise.all([
        merchandiseApi.getStore(eventId, token),
        merchandiseApi.listReviews(eventId, false, token),
      ]);
      setStore(nextStore);
      setOpenReviews(reviews.length);
    } catch (err) {
      setError(merchErrorMessage(err));
    } finally {
      setLoadingShell(false);
    }
  }, [admin, token, eventId]);

  useEffect(() => {
    if (!admin || !token || !eventId) {
      setStore(null);
      setOpenReviews(0);
      return;
    }
    void loadAll();
  }, [admin, token, eventId, loadAll]);

  function handleEventChange(nextId: number) {
    setEventId(nextId);
    const target = routeForEventSwitch(pathname);
    if (nextId > 0) {
      writeStoredEventId(nextId);
      router.replace(merchHref(target, nextId));
    } else {
      router.replace(target);
    }
  }

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <AdminLayout title="ของที่ระลึก">
      {!admin ? (
        <p role="alert">หน้านี้สำหรับ Admin เท่านั้น</p>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label className="block min-w-[260px] flex-1 max-w-xl space-y-2">
                <span className="text-sm font-medium text-zinc-700">Event</span>
                <select
                  value={eventId || ''}
                  disabled={eventsLoading}
                  onChange={(e) => handleEventChange(Number(e.target.value))}
                  className="input-field"
                >
                  <option value="">เลือก Event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.eventName}
                      {ev.eventCode ? ` (${ev.eventCode})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {eventId > 0 && (
                <div className="flex flex-wrap items-center gap-4">
                  {store && (
                    <div className="text-right">
                      <div>
                        <span className={badgeClassForStore(store.state)}>
                          {storeStateLabel[store.state]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        เปิด: {formatBangkok(store.opensAt)} · ปิด:{' '}
                        {formatBangkok(store.closesAt)}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-secondary gap-2"
                    disabled={loadingShell}
                    onClick={() => void loadAll()}
                  >
                    {loadingShell ? (
                      <IconLoader2 size={18} className="animate-spin" />
                    ) : (
                      <IconRefresh size={18} />
                    )}
                    โหลดใหม่
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav
            className="overflow-x-auto rounded-2xl bg-zinc-100 p-2"
            aria-label="ส่วนจัดการของที่ระลึก"
          >
            <div className="flex min-w-max gap-1.5">
              {MERCH_TABS.map(([href, label]) => {
                const isActive =
                  href === '/merchandise'
                    ? pathname === '/merchandise'
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={merchHref(href, eventId)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex min-h-14 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                      isActive
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-950'
                    }`}
                  >
                    <span>{label}</span>
                    {href === '/merchandise/reviews' && openReviews > 0 && (
                      <span className="badge badge-warning">{openReviews}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              <span>{error}</span>
              <button
                type="button"
                className="inline-flex items-center gap-2 font-medium underline underline-offset-4"
                onClick={() => void loadAll()}
              >
                <IconRefresh size={16} aria-hidden="true" />
                ลองใหม่
              </button>
            </div>
          )}

          {!eventId ? (
            <div className="card text-sm text-zinc-600" role="status">
              กรุณาเลือก Event
            </div>
          ) : (
            <MerchandiseContext.Provider
              value={{
                eventId,
                eventCode: store?.eventCode ?? selectedEvent?.eventCode ?? '',
                eventName: selectedEvent?.eventName ?? '',
                token: token ?? '',
                store,
                reloadStore,
                openReviews,
                reloadReviews,
              }}
            >
              {children}
            </MerchandiseContext.Provider>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
