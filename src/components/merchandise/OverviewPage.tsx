'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconLoader2,
  IconRefresh,
  IconSettings,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { merchErrorMessage } from '@/lib/merchandiseErrors';
import {
  badgeClassForStore,
  formatBaht,
  formatBangkok,
  storeStateLabel,
} from '@/lib/merchandiseFormat';
import type { AdminProductDto } from '@/types/merchandise';
import { merchHref, useMerchandise } from './MerchandiseContext';

type Counts = {
  pending: number;
  paid: number;
  expired: number;
  awaitingShipment: number;
};

export default function OverviewPage() {
  const { eventId, token, store, openReviews, reloadReviews } =
    useMerchandise();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [products, setProducts] = useState<AdminProductDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!eventId || !token) return;
      setLoading(true);
      setError('');
      try {
        const [pending, paid, expired, awaitingShipment, productList] =
          await Promise.all([
            merchandiseApi.listOrders(
              eventId,
              { paymentStatus: 'pending', limit: 1 },
              token,
              signal,
            ),
            merchandiseApi.listOrders(
              eventId,
              { paymentStatus: 'paid', limit: 1 },
              token,
              signal,
            ),
            merchandiseApi.listOrders(
              eventId,
              { paymentStatus: 'expired', limit: 1 },
              token,
              signal,
            ),
            merchandiseApi.listOrders(
              eventId,
              {
                paymentStatus: 'paid',
                shippingStatus: 'not_shipped',
                limit: 1,
              },
              token,
              signal,
            ),
            merchandiseApi.listProducts(eventId, {}, token, signal),
            reloadReviews(),
          ]);
        if (signal?.aborted) return;
        setCounts({
          pending: pending.pagination.total,
          paid: paid.pagination.total,
          expired: expired.pagination.total,
          awaitingShipment: awaitingShipment.pagination.total,
        });
        setProducts(productList);
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
    [eventId, token, reloadReviews],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const checklist: { label: string; href: string }[] = [];
  if (store && !store.opensAt && !store.closesAt) {
    checklist.push({
      label: 'ยังไม่ตั้งเวลาเปิด–ปิดพรีออเดอร์',
      href: merchHref('/merchandise/store', eventId),
    });
  }
  if (store && !store.enabled) {
    checklist.push({
      label: 'ร้านยังปิดอยู่',
      href: merchHref('/merchandise/store', eventId),
    });
  }
  const publishedCount = products.filter(
    (p) => p.publishState === 'published',
  ).length;
  if (!loading && publishedCount === 0) {
    checklist.push({
      label: 'ยังไม่มีสินค้าที่เผยแพร่',
      href: merchHref('/merchandise/products', eventId),
    });
  }
  const incompleteDrafts = products.filter(
    (p) => p.publishState === 'draft' && p.publishIssues.length > 0,
  ).length;
  if (incompleteDrafts > 0) {
    checklist.push({
      label: `มีสินค้าร่างที่ข้อมูลยังไม่ครบ ${incompleteDrafts} รายการ`,
      href: merchHref('/merchandise/products', eventId, { status: 'draft' }),
    });
  }

  const statCards = [
    {
      label: 'รอชำระ',
      value: counts?.pending ?? 0,
      href: merchHref('/merchandise/orders', eventId, {
        paymentStatus: 'pending',
      }),
      icon: IconClock,
      iconClass: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'ชำระแล้ว',
      value: counts?.paid ?? 0,
      href: merchHref('/merchandise/orders', eventId, {
        paymentStatus: 'paid',
      }),
      icon: IconCreditCard,
      iconClass: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'หมดเวลาชำระ',
      value: counts?.expired ?? 0,
      href: merchHref('/merchandise/orders', eventId, {
        paymentStatus: 'expired',
      }),
      icon: IconX,
      iconClass: 'bg-red-50 text-red-700',
    },
    {
      label: 'ชำระแล้วรอจัดส่ง',
      value: counts?.awaitingShipment ?? 0,
      href: merchHref('/merchandise/orders', eventId, {
        paymentStatus: 'paid',
        shippingStatus: 'not_shipped',
      }),
      icon: IconTruck,
      iconClass: 'bg-sky-50 text-sky-700',
    },
    {
      label: 'รอตรวจสอบ',
      value: openReviews,
      href: merchHref('/merchandise/reviews', eventId),
      icon: IconAlertCircle,
      iconClass: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            ภาพรวมร้านของที่ระลึก
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            สถานะร้าน ยอดคำสั่งซื้อ และสิ่งที่ต้องทำก่อนเปิดรับพรีออเดอร์
          </p>
        </div>
        <Link
          href={merchHref('/merchandise/store', eventId)}
          className="btn-secondary gap-2"
        >
          <IconSettings size={18} aria-hidden="true" />
          ตั้งค่าร้าน
        </Link>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 font-medium underline underline-offset-4"
            onClick={() => void load()}
          >
            <IconRefresh size={16} aria-hidden="true" />
            ลองใหม่
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, href, icon: Icon, iconClass }) => (
          <Link
            key={label}
            href={href}
            className="stat-card transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`stat-icon ${iconClass}`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="stat-value">
                {loading && counts === null ? (
                  <IconLoader2 size={22} className="animate-spin" />
                ) : (
                  value.toLocaleString('th-TH')
                )}
              </div>
              <div className="stat-label">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-zinc-900">ข้อมูลร้าน</h2>
            {store && (
              <span className={badgeClassForStore(store.state)}>
                {storeStateLabel[store.state]}
              </span>
            )}
          </div>
          {!store ? (
            <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลร้าน...</p>
          ) : (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">เปิดพรีออเดอร์ (เวลาไทย)</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {formatBangkok(store.opensAt)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">ปิดพรีออเดอร์ (เวลาไทย)</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {formatBangkok(store.closesAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">ค่าจัดส่ง</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {formatBaht(store.shippingBaht)} ต่อคำสั่งซื้อ
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">กำหนดผลิต</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-zinc-900">
                  {store.productionInfoTh || 'ยังไม่กรอก'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">กำหนดจัดส่ง</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-zinc-900">
                  {store.shippingInfoTh || 'ยังไม่กรอก'}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-zinc-900">
            สิ่งที่ต้องทำก่อนเปิดขาย
          </h2>
          {loading ? (
            <p className="text-sm text-zinc-500">กำลังตรวจสอบรายการ...</p>
          ) : checklist.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              <IconCheck size={18} />
              พร้อมเปิดรับพรีออเดอร์แล้ว
            </div>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-900"
                >
                  <span>{item.label}</span>
                  <Link
                    href={item.href}
                    className="shrink-0 font-semibold text-amber-900 underline underline-offset-4"
                  >
                    ไปจัดการ
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
