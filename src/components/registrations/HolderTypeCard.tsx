'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { IconGift, IconLoader2 } from '@tabler/icons-react';
import { api, ApiError } from '@/lib/api';
import {
  holderReviewReason,
  holderSourceLabel,
  type HolderTypeHistoryEntry,
  type HolderTypeOption,
} from '@/lib/holder-types';

interface HolderTypeCardProps {
  token: string;
  registrationId: number;
  holderType: string | null;
  holderTypeSource: string | null;
  holderTypeUpdatedAt: string | null;
  canEdit: boolean;
  onSaved: () => void;
}

const dateTime = (value: string) =>
  new Date(value).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export function HolderTypeCard({
  token,
  registrationId,
  holderType,
  holderTypeSource,
  holderTypeUpdatedAt,
  canEdit,
  onSaved,
}: HolderTypeCardProps) {
  const [options, setOptions] = useState<HolderTypeOption[]>([]);
  const [history, setHistory] = useState<HolderTypeHistoryEntry[]>([]);
  const [selected, setSelected] = useState(holderType ?? '');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.registrations
      .holderTypes(token)
      .then((res) => setOptions(res.holderTypes))
      .catch(() => setOptions([]));
  }, [token]);

  useEffect(() => {
    setSelected(holderType ?? '');
    setReason('');
    if (!canEdit) return;
    api.registrations
      .holderTypeHistory(token, registrationId)
      .then((res) => setHistory(res.history))
      .catch(() => setHistory([]));
  }, [token, registrationId, holderType, holderTypeSource, canEdit]);

  const byKey = useMemo(
    () => new Map(options.map((option) => [option.key, option])),
    [options],
  );
  const current = holderType ? byKey.get(holderType) : undefined;
  const preview = selected ? byKey.get(selected) : undefined;
  const review = holderReviewReason(holderTypeSource);
  const changed = selected !== (holderType ?? '');
  const typeLabel = (key: string | null, source?: string | null) =>
    key
      ? (byKey.get(key)?.label ?? key)
      : source?.startsWith('review:')
        ? 'รอตรวจ'
        : 'ยังไม่ระบุ';

  const save = async () => {
    setIsSaving(true);
    try {
      await api.registrations.updateHolderType(token, registrationId, {
        holderType: selected || null,
        expectedHolderType: holderType,
        reason: reason.trim() || undefined,
      });
      toast.success('บันทึกประเภทแล้ว');
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('มีคนแก้ประเภทนี้ไปก่อนแล้ว ระบบโหลดค่าล่าสุดให้');
        onSaved();
      } else {
        toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Ticket Type และ Gift</h2>

      <div className="space-y-1">
        <p className="text-xl font-semibold text-zinc-900">
          {current?.label ?? (review ? 'รอตรวจ' : 'ยังไม่ระบุ')}
        </p>
        <p className="flex items-center gap-1.5 text-base text-zinc-700">
          <IconGift size={18} className="text-zinc-400" aria-hidden="true" />
          {current ? current.giftLabel || '-' : 'ยังไม่ระบุ'}
        </p>
        <p className="text-sm text-zinc-500">
          {holderSourceLabel(holderTypeSource)}
          {holderTypeUpdatedAt ? ` · ${dateTime(holderTypeUpdatedAt)}` : ''}
        </p>
        {review && !holderType && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {review}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
          <label className="block text-sm font-medium text-zinc-700">
            เปลี่ยนประเภท
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="input-field mt-1 w-full"
            >
              <option value="">ยังไม่ระบุ</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                  {option.giftCode === 'gift' ? ' (ได้ Gift)' : ''}
                </option>
              ))}
            </select>
          </label>
          {changed && (
            <p className="text-sm text-zinc-600">
              Gift:{' '}
              <span className="font-semibold text-zinc-900">
                {preview
                  ? preview.giftCode === 'gift'
                    ? 'ให้'
                    : 'ไม่ได้ Gift'
                  : 'ยังไม่ระบุ'}
              </span>
            </p>
          )}
          <label className="block text-sm font-medium text-zinc-700">
            เหตุผล (ไม่บังคับ)
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="เช่น อยู่ในรายชื่อกรรมการสภาฯ"
              className="input-field mt-1 w-full"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={!changed || isSaving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving && <IconLoader2 size={16} className="animate-spin" />}
            บันทึกประเภท
          </button>
        </div>
      )}

      {canEdit && history.length > 0 && (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-700">ประวัติการเปลี่ยน</h3>
          <ol className="space-y-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="text-zinc-600">
                <span className="font-medium text-zinc-900">
                  {typeLabel(entry.previousType, entry.previousSource)} →{' '}
                  {typeLabel(entry.newType, entry.newSource)}
                </span>
                <br />
                {holderSourceLabel(entry.newSource)}
                {entry.actorFirstName
                  ? ` โดย ${entry.actorFirstName} ${entry.actorLastName ?? ''}`
                  : ''}
                {' · '}
                {dateTime(entry.createdAt)}
                {entry.reason && entry.newSource.startsWith('manual:') && (
                  <span className="block text-zinc-500">{entry.reason}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
