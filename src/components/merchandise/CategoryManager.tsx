'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  IconArrowDown,
  IconArrowUp,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { merchandiseApi } from '@/lib/merchandiseApi';
import { isVersionConflict, merchErrorMessage } from '@/lib/merchandiseErrors';
import type { AdminCategoryDto } from '@/types/merchandise';
import { useMerchandise } from './MerchandiseContext';

export default function CategoryManager() {
  const { eventId, token } = useMerchandise();
  const [categories, setCategories] = useState<AdminCategoryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVisible, setNewVisible] = useState(true);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
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
        const list = await merchandiseApi.listCategories(
          eventId,
          token,
          signal,
        );
        if (!signal?.aborted) {
          setCategories(list);
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
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('กรุณากรอกชื่อหมวด');
      return;
    }
    if (trimmed.length > 200) {
      setError('ชื่อหมวดยาวเกิน 200 ตัวอักษร');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const created = await merchandiseApi.createCategory(
        eventId,
        { nameTh: trimmed, visible: newVisible },
        token,
      );
      setCategories((prev) => [...prev, created]);
      setNewName('');
      setNewVisible(true);
      setAdding(false);
      toast.success('เพิ่มหมวดสินค้าแล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(cat: AdminCategoryDto) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setError('กรุณากรอกชื่อหมวด');
      return;
    }
    if (trimmed.length > 200) {
      setError('ชื่อหมวดยาวเกิน 200 ตัวอักษร');
      return;
    }
    setSavingId(cat.id);
    setError('');
    setConflict(false);
    try {
      const updated = await merchandiseApi.updateCategory(
        eventId,
        cat.id,
        { expectedVersion: cat.version, nameTh: trimmed },
        token,
      );
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
      setEditingId(null);
      toast.success('บันทึกชื่อหมวดแล้ว');
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

  async function handleToggleVisible(cat: AdminCategoryDto) {
    setSavingId(cat.id);
    setError('');
    setConflict(false);
    try {
      const updated = await merchandiseApi.updateCategory(
        eventId,
        cat.id,
        { expectedVersion: cat.version, visible: !cat.visible },
        token,
      );
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
      toast.success('อัปเดตการแสดงหมวดแล้ว');
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

  async function handleDelete(cat: AdminCategoryDto) {
    if (!window.confirm('ลบหมวดนี้? สินค้าในหมวดนี้จะไม่มีหมวด')) return;
    setSavingId(cat.id);
    setError('');
    try {
      await merchandiseApi.deleteCategory(eventId, cat.id, token);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success('ลบหมวดสินค้าแล้ว');
    } catch (err) {
      const msg = merchErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  function moveRow(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setCategories(next);
    setOrderDirty(true);
  }

  async function handleSaveOrder() {
    setSavingOrder(true);
    setError('');
    try {
      const updated = await merchandiseApi.orderCategories(
        eventId,
        categories.map((c) => c.id),
        token,
      );
      setCategories(updated);
      setOrderDirty(false);
      toast.success('บันทึกลำดับหมวดแล้ว');
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
            หมวดสินค้า
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            จัดการหมวดหมู่ การแสดงผลบนหน้าร้าน และลำดับการแสดงผล
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
            เพิ่มหมวด
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
          <h2 className="text-lg font-bold text-zinc-900">เพิ่มหมวดสินค้า</h2>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-700">
              ชื่อหมวด (ภาษาไทย)
            </span>
            <input
              type="text"
              maxLength={200}
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input-field"
              placeholder="เช่น เสื้อผ้า, แก้วและขวดน้ำ"
            />
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={newVisible}
              onChange={(e) => setNewVisible(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-zinc-700">
              แสดงบนหน้าร้าน
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
              className="btn-secondary min-h-11"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn-primary min-h-11 gap-2"
            >
              {creating && <IconLoader2 size={18} className="animate-spin" />}
              บันทึก
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">
            กำลังโหลดหมวดสินค้า...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">ยังไม่มีหมวดสินค้า</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ชื่อหมวด</th>
                <th>แสดงบนหน้าร้าน</th>
                <th>ลำดับ</th>
                <th className="text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, idx) => {
                const isEditing = editingId === cat.id;
                const isBusy = savingId === cat.id;
                return (
                  <tr key={cat.id}>
                    <td>
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            maxLength={200}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="input-field max-w-xs"
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRename(cat)}
                            className="btn-primary gap-1"
                          >
                            {isBusy && (
                              <IconLoader2 size={14} className="animate-spin" />
                            )}
                            บันทึก
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setEditingId(null)}
                            className="btn-secondary"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-zinc-900">
                          {cat.nameTh}
                        </span>
                      )}
                    </td>
                    <td>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={cat.visible}
                          disabled={isBusy}
                          onChange={() => void handleToggleVisible(cat)}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs">
                          {cat.visible ? 'แสดง' : 'ซ่อน'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0 || savingOrder}
                          onClick={() => moveRow(idx, -1)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                          title="เลื่อนขึ้น"
                        >
                          <IconArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={
                            idx === categories.length - 1 || savingOrder
                          }
                          onClick={() => moveRow(idx, 1)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                          title="เลื่อนลง"
                        >
                          <IconArrowDown size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {!isEditing && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditingName(cat.nameTh);
                            }}
                            className="btn-secondary gap-1"
                          >
                            <IconPencil size={16} />
                            แก้ไขชื่อ
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDelete(cat)}
                          className="btn-danger gap-1"
                        >
                          <IconTrash size={16} />
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
