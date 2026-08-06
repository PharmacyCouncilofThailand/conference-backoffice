"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconAdjustments, IconLoader2, IconSearch, IconSettings, IconUsersGroup } from "@tabler/icons-react";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { AssignedEvent, TeamRegistrationListItem } from "@/types/api";

const registrationLabels: Record<string, string> = {
  draft: "Draft", ready_for_payment: "Ready", payment_pending: "Payment pending", paid: "Paid", expired: "Expired",
};
const statusClasses: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700",
  payment_pending: "bg-amber-100 text-amber-700", ready_for_payment: "bg-blue-100 text-blue-700",
  draft: "bg-zinc-100 text-zinc-600", expired: "bg-zinc-100 text-zinc-500",
  failed: "bg-red-100 text-red-700", verification_required: "bg-orange-100 text-orange-700",
};

export default function TeamRegistrationsPage() {
  const { token, user, isAdmin, currentEvent, setCurrentEvent } = useAuth();
  const [events, setEvents] = useState<AssignedEvent[]>(user?.assignedEvents ?? []);
  const [eventId, setEventId] = useState<number | null>(currentEvent?.id ?? null);
  const [items, setItems] = useState<TeamRegistrationListItem[]>([]);
  const [paidCount, setPaidCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    if (!isAdmin) {
      const assigned = user?.assignedEvents ?? [];
      setEvents(assigned);
      const selected = currentEvent ?? assigned[0] ?? null;
      setEventId(selected?.id ?? null);
      return;
    }
    api.backofficeEvents.list(token, "page=1&limit=100")
      .then((response) => {
        const available = response.events.map((event) => ({ id: Number(event.id), code: String(event.eventCode), name: String(event.eventName) }));
        setEvents(available);
        setEventId((current) => current ?? available[0]?.id ?? null);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Events"));
  }, [token, isAdmin, user, currentEvent]);

  useEffect(() => {
    if (!token || !eventId) { setLoading(false); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const query = new URLSearchParams({ eventId: String(eventId), page: String(page), pageSize: String(pageSize) });
        if (search.trim()) query.set("search", search.trim());
        if (status) query.set("registrationStatus", status);
        if (paymentStatus) query.set("paymentStatus", paymentStatus);
        const response = await api.teamRegistrations.list(token, query);
        setItems(response.data.items); setPaidCount(response.data.paidTeamCount);
        setTotal(response.data.pagination.total); setPages(Math.max(response.data.pagination.pages, 1));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load team registrations");
      } finally { setLoading(false); }
    }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [token, eventId, page, pageSize, search, status, paymentStatus]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === eventId), [events, eventId]);
  const selectEvent = (id: number) => {
    setEventId(id); setPage(1);
    const selected = events.find((event) => event.id === id);
    if (!isAdmin && selected) setCurrentEvent(selected);
  };

  return (
    <AdminLayout title="Team Registrations">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-6">
        <Metric label="All teams" value={total} />
        <Metric label="Paid teams" value={paidCount} accent />
        <Metric label="Selected Event" value={selectedEvent?.code ?? "—"} />
      </div>

      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Team applications</h2>
            <p className="text-sm text-zinc-500">Read-only for Team Registration Viewer; corrections are Admin-only.</p>
          </div>
          {isAdmin && eventId && (
            <Link href={`/events/${eventId}/team-registration-settings`} className="btn-secondary inline-flex items-center gap-2">
              <IconSettings size={18} /> Registration settings
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5 mb-5">
          <select className="input-field" value={eventId ?? ""} onChange={(event) => selectEvent(Number(event.target.value))}>
            <option value="" disabled>Select Event</option>
            {events.map((event) => <option value={event.id} key={event.id}>{event.code} — {event.name}</option>)}
          </select>
          <div className="relative xl:col-span-2">
            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className="input-field-search" placeholder="Team, leader, member or Email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </div>
          <select className="input-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All application statuses</option>
            {Object.entries(registrationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input-field" value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}>
            <option value="">All payment statuses</option>
            {['pending', 'paid', 'failed', 'expired', 'verification_required'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
          </select>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 mb-4">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-16 text-zinc-500"><IconLoader2 className="animate-spin mr-2" /> Loading teams…</div>
        ) : !eventId ? (
          <Empty text="No assigned Event is available for this account." />
        ) : items.length === 0 ? (
          <Empty text="No teams match the selected filters." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[980px]">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500"><tr>
                <th className="px-4 py-3">Team</th><th className="px-4 py-3">Leader</th><th className="px-4 py-3 text-center">Members</th>
                <th className="px-4 py-3">Category</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Application</th><th className="px-4 py-3">Payment</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">{items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-4"><Link href={`/team-registrations/${item.id}`} className="font-semibold text-emerald-700 hover:underline">{item.teamName}</Link><div className="text-xs text-zinc-400">{item.registrationCode ?? "Draft"}</div></td>
                  <td className="px-4 py-4 text-sm"><div className="font-medium text-zinc-800">{item.leader.name}</div><div className="text-zinc-500">{item.leader.email}</div></td>
                  <td className="px-4 py-4 text-center">{item.memberCount}</td>
                  <td className="px-4 py-4 text-sm text-zinc-600">{item.category.name}</td>
                  <td className="px-4 py-4 text-sm">{item.amount ? `฿${Number(item.amount).toLocaleString()}` : "—"}<div className="text-xs text-zinc-400">{item.pricingRound ?? "—"}</div></td>
                  <td className="px-4 py-4"><Badge value={item.registrationStatus} label={registrationLabels[item.registrationStatus]} /></td>
                  <td className="px-4 py-4"><Badge value={item.paymentStatus ?? "none"} label={item.paymentStatus?.replaceAll('_', ' ') ?? "—"} /></td>
                </tr>
              ))}</tbody>
            </table>
            <Pagination currentPage={page} totalPages={pages} totalCount={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} itemName="teams" />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return <div className="card py-4 flex items-center gap-4"><div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}><IconUsersGroup size={22} /></div><div><div className="text-2xl font-bold text-zinc-900">{value}</div><div className="text-sm text-zinc-500">{label}</div></div></div>;
}
function Badge({ value, label }: { value: string; label: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClasses[value] ?? 'bg-zinc-100 text-zinc-600'}`}>{label}</span>; }
function Empty({ text }: { text: string }) { return <div className="py-16 text-center text-zinc-400"><IconAdjustments className="mx-auto mb-3" size={34} /><p>{text}</p></div>; }
