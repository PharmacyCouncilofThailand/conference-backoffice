"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconFileText, IconLoader2, IconSearch, IconUsers } from "@tabler/icons-react";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import type { PromoCodeAbstractReportRow } from "@/types/api";

interface EventOption {
  id: number;
  name: string;
}

interface PromoCodeOption {
  id: number;
  code: string;
}

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

async function fetchEventPromoCodes(token: string, eventId: string): Promise<PromoCodeOption[]> {
  const queryForPage = (page: number) =>
    new URLSearchParams({
      page: String(page),
      limit: "100",
      eventId,
      includeGlobal: "true",
    }).toString();

  const firstPage = await api.promoCodes.list(token, queryForPage(1));
  const toOptions = (rows: Record<string, unknown>[]) =>
    rows.map((promo) => ({ id: Number(promo.id), code: String(promo.code) }));
  const options = toOptions(firstPage.promoCodes);

  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const result = await api.promoCodes.list(token, queryForPage(page));
    options.push(...toOptions(result.promoCodes));
  }

  return options;
}

const archiveReasonLabels: Record<string, string> = {
  manual: "Manual",
  withdrawn: "Withdrawn",
  duplicate_submission: "Duplicate submission",
};

const abstractStatusClasses: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  revision: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function PromoCodeAbstractsPage() {
  const { user } = useAuth();
  const isOrganizer = user?.role === "organizer";
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState("");
  const [promoCodeOptions, setPromoCodeOptions] = useState<PromoCodeOption[]>([]);
  const [promoCodeOptionsEventId, setPromoCodeOptionsEventId] = useState("");
  const [promoCodeId, setPromoCodeId] = useState("");
  const [promoCodeError, setPromoCodeError] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<PromoCodeAbstractReportRow[]>([]);
  const [completedReportQuery, setCompletedReportQuery] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportErrorQuery, setReportErrorQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const activeEventId = isOrganizer && !eventId && eventOptions.length === 1
    ? String(eventOptions[0].id)
    : eventId;
  const reportParams = new URLSearchParams();
  if (activeEventId) reportParams.set("eventId", activeEventId);
  reportParams.set("submissionStatus", submissionStatus);
  reportParams.set("page", String(page));
  reportParams.set("limit", String(limit));
  if (promoCodeId) reportParams.set("promoCodeId", promoCodeId);
  if (debouncedSearchTerm.trim()) reportParams.set("search", debouncedSearchTerm.trim());
  const reportQuery = activeEventId ? reportParams.toString() : "";
  const isLoadingReport = Boolean(activeEventId) && completedReportQuery !== reportQuery;
  const isLoadingPromoCodes = Boolean(activeEventId) && promoCodeOptionsEventId !== activeEventId;

  useEffect(() => {
    let isCurrent = true;

    api.backofficeEvents
      .list(getBackofficeToken(), "page=1&limit=100")
      .then((response) => {
        if (!isCurrent) return;
        setEventOptions(
          response.events.flatMap((event): EventOption[] => {
            const id = Number(event.id);
            if (!Number.isInteger(id) || id <= 0) return [];
            return [{ id, name: String(event.eventName ?? event.eventCode ?? `Event ${id}`) }];
          }),
        );
      })
      .catch(() => {
        if (isCurrent) setEventError("Could not load events. Refresh and try again.");
      })
      .finally(() => {
        if (isCurrent) setIsLoadingEvents(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    if (!activeEventId) {
      return () => {
        isCurrent = false;
      };
    }

    fetchEventPromoCodes(getBackofficeToken(), activeEventId)
      .then((options) => {
        if (isCurrent) {
          setPromoCodeOptions(options);
          setPromoCodeOptionsEventId(activeEventId);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setPromoCodeOptions([]);
          setPromoCodeOptionsEventId(activeEventId);
          setPromoCodeError("Could not load promo codes for this event.");
        }
      })

    return () => {
      isCurrent = false;
    };
  }, [activeEventId]);

  useEffect(() => {
    if (!activeEventId) return;

    let isCurrent = true;
    const query = reportQuery;

    api.promoCodeAbstracts
      .list(getBackofficeToken(), query)
      .then((response) => {
        if (!isCurrent) return;
        setRows(response.rows);
        setTotalCount(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
        setReportError("");
        setReportErrorQuery(query);
        setCompletedReportQuery(query);
      })
      .catch(() => {
        if (isCurrent) {
          setTotalCount(0);
          setTotalPages(0);
          setReportError("Could not load the report. Refresh and try again.");
          setReportErrorQuery(query);
          setCompletedReportQuery(query);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [activeEventId, reportQuery]);

  const updateExpanded = (key: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedEvent = eventOptions.find((event) => String(event.id) === activeEventId);
  const currentReportError = reportErrorQuery === reportQuery ? reportError : "";

  return (
    <AdminLayout title="Promo Code & Abstracts">
      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconUsers size={24} stroke={1.5} />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-800">{isLoadingReport ? "—" : totalCount}</p>
              <p className="text-sm text-zinc-400">Buyer / promo code groups</p>
            </div>
          </div>
        </div>
        <div className="card py-4 md:col-span-2">
          <p className="text-sm font-semibold text-zinc-800">How this report is matched</p>
          <p className="mt-1 text-sm text-zinc-500">
            Paid orders with confirmed registrations. Abstracts match the buyer account for this event.
          </p>
        </div>
      </section>

      <section className="card mb-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-600">
            Event <span className="sr-only">filter</span>
            <select
              value={activeEventId}
              disabled={isLoadingEvents}
              onChange={(event) => {
                const nextEventId = event.target.value;
                setEventId(nextEventId);
                setPromoCodeId("");
                setPromoCodeOptions([]);
                setPromoCodeOptionsEventId("");
                setPromoCodeError("");
                setRows([]);
                setTotalCount(0);
                setTotalPages(0);
                setCompletedReportQuery("");
                setReportError("");
                setReportErrorQuery("");
                setExpandedGroups(new Set());
                setPage(1);
              }}
              className="input-field w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{isLoadingEvents ? "Loading events…" : "Select event"}</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-600">
            Promo code
            <select
              value={promoCodeId}
              disabled={!activeEventId || isLoadingPromoCodes || promoCodeOptions.length === 0}
              onChange={(event) => {
                setPromoCodeId(event.target.value);
                setExpandedGroups(new Set());
                setPage(1);
              }}
              className="input-field w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {!activeEventId ? "Select event first" :
                  isLoadingPromoCodes ? "Loading promo codes…" :
                    promoCodeOptions.length === 0 ? "No promo codes" : "All promo codes"}
              </option>
              {promoCodeOptions.map((promoCode) => (
                <option key={promoCode.id} value={promoCode.id}>{promoCode.code}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-600">
            Abstract submission
            <select
              value={submissionStatus}
              onChange={(event) => {
                setSubmissionStatus(event.target.value);
                setExpandedGroups(new Set());
                setPage(1);
              }}
              className="input-field w-full"
            >
              <option value="all">All buyers</option>
              <option value="submitted">Submitted</option>
              <option value="not_submitted">Not submitted</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-600">
            Search
            <span className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="search"
                placeholder="Buyer, registration, title, tracking ID"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setExpandedGroups(new Set());
                  setPage(1);
                }}
                className="input-field-search w-full"
              />
            </span>
          </label>
        </div>
        {eventError && <p role="alert" className="mt-3 text-sm text-rose-600">{eventError}</p>}
        {promoCodeError && <p role="alert" className="mt-3 text-sm text-rose-600">{promoCodeError}</p>}
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {!activeEventId ? (
          <div className="py-16 text-center text-zinc-400">
            <IconUsers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select an event to view promo code users.</p>
          </div>
        ) : isLoadingReport ? (
          <div className="flex justify-center py-12">
            <IconLoader2 size={32} className="animate-spin text-emerald-600" />
          </div>
        ) : currentReportError ? (
          <div role="alert" className="py-12 text-center text-sm text-rose-600">{currentReportError}</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            <IconFileText size={36} className="mx-auto mb-3 opacity-30" />
            <p>No matching promo code users found.</p>
            {selectedEvent && <p className="mt-1 text-xs">Event: {selectedEvent.name}</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Buyer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Promo code</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Orders / registrations</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">Abstract</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row) => {
                    const key = `${row.buyer.id}:${row.promoCode.id}`;
                    const isExpanded = expandedGroups.has(key);
                    const previousCodes = row.promoCode.usedCodes.filter(
                      (code) => code !== row.promoCode.currentCode,
                    );

                    return (
                      <Fragment key={key}>
                        <tr className="align-top transition-colors hover:bg-zinc-50">
                          <td className="px-4 py-4">
                            <p className="font-medium text-zinc-900">{row.buyer.firstName} {row.buyer.lastName}</p>
                            <p className="text-sm text-zinc-500">{row.buyer.email}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex max-w-[220px] break-all rounded bg-violet-50 px-2 py-1 font-mono text-sm font-medium text-violet-700">
                              {row.promoCode.currentCode}
                            </span>
                            {previousCodes.length > 0 && (
                              <p className="mt-1 text-xs text-zinc-500">
                                Used at purchase: {previousCodes.join(", ")}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center text-sm text-zinc-600">
                            <span className="font-semibold text-zinc-800">{row.orders.length}</span> paid orders
                            <span className="mx-2 text-zinc-300">·</span>
                            <span className="font-semibold text-zinc-800">{row.registrations.length}</span> confirmed
                          </td>
                          <td className="px-4 py-4 text-center">
                            {row.hasSubmitted ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Submitted ({row.abstracts.length})
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                Not submitted
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => updateExpanded(key)}
                              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                            >
                              {isExpanded ? "Hide" : "View"}
                              <IconChevronDown size={16} className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-zinc-50/70">
                            <td colSpan={5} className="px-4 py-5 md:px-6">
                              <div className="grid gap-6 lg:grid-cols-2">
                                <section>
                                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Paid orders</h3>
                                  {row.orders.length === 0 ? (
                                    <p className="text-sm text-zinc-500">No qualifying orders.</p>
                                  ) : (
                                    <ul className="space-y-3">
                                      {row.orders.map((order) => (
                                        <li key={order.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                                          <p className="font-mono text-sm font-medium text-zinc-800">{order.orderNumber}</p>
                                          <p className="mt-0.5 text-xs text-zinc-400">
                                            {new Date(order.createdAt).toLocaleString("th-TH")}
                                          </p>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>

                                <section>
                                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Confirmed registrations</h3>
                                  {row.registrations.length === 0 ? (
                                    <p className="text-sm text-zinc-500">No qualifying registrations.</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {row.registrations.map((registration) => (
                                        <li key={registration.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                                          <Link href={`/registrations/${registration.id}`} className="font-mono font-medium text-emerald-700 hover:underline">
                                            {registration.regCode}
                                          </Link>
                                          <span> · {registration.attendeeName} · {registration.ticketName}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>

                                <section className="lg:col-span-2">
                                  <h3 className="mb-3 text-sm font-semibold text-zinc-800">Abstracts for buyer</h3>
                                  {row.abstracts.length === 0 ? (
                                    <p className="text-sm text-zinc-500">This buyer has not submitted an abstract for the event.</p>
                                  ) : (
                                    <ul className="space-y-3">
                                      {row.abstracts.map((abstract) => (
                                        <li key={abstract.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                              <Link href={`/abstracts/${abstract.id}`} className="font-medium text-emerald-700 hover:underline">
                                                {abstract.title}
                                              </Link>
                                              <p className="mt-1 font-mono text-xs text-zinc-500">
                                                {abstract.trackingId || "No tracking ID"}
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${abstractStatusClasses[abstract.status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200"}`}>
                                                {abstract.status}
                                              </span>
                                              {abstract.status === "accepted" && (
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${abstract.confirmedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                                  {abstract.confirmedAt ? "Confirmed" : "Awaiting confirmation"}
                                                </span>
                                              )}
                                              {abstract.archivedAt && (
                                                <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                                                  Archived{abstract.archiveReason ? ` · ${archiveReasonLabels[abstract.archiveReason] ?? abstract.archiveReason}` : ""}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <p className="mt-2 text-xs text-zinc-500">
                                            {abstract.categoryName} · {abstract.presentationType}
                                          </p>
                                          {abstract.archivedAt && abstract.archiveReason && (
                                            <p className="mt-1 text-xs text-zinc-500">
                                              Archive reason: {archiveReasonLabels[abstract.archiveReason] ?? abstract.archiveReason}
                                            </p>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              itemName="buyer/code groups"
            />
          </>
        )}
      </section>
    </AdminLayout>
  );
}
