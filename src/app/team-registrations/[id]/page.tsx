"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconArrowLeft, IconLoader2, IconMailForward, IconPencil, IconShieldCheck, IconUsersGroup } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { AdminLayout } from "@/components/layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { TeamRegistrationDetail, TeamRegistrationMember } from "@/types/api";

export default function TeamRegistrationDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, isAdmin } = useAuth();
  const [detail, setDetail] = useState<TeamRegistrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TeamRegistrationMember | null>(null);
  const [teamName, setTeamName] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true); setError("");
    try { setDetail((await api.teamRegistrations.get(token, params.id)).data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load team"); }
    finally { setLoading(false); }
  }, [token, params.id]);

  useEffect(() => { void load(); }, [load]);

  const saveCorrection = async () => {
    if (!token || !detail || !reason.trim()) return toast.error("Please provide a change reason");
    setSaving(true);
    try {
      const member = editing ? {
        id: editing.id, firstName: editing.firstName, lastName: editing.lastName,
        nickname: editing.nickname, email: editing.email, phoneNumber: editing.phoneNumber,
        lineId: editing.lineId, foodDrugAllergies: editing.foodDrugAllergies,
        emergencyContactName: editing.emergencyContactName, emergencyContactPhone: editing.emergencyContactPhone,
      } : undefined;
      await api.teamRegistrations.correct(token, detail.registration.id, {
        changeReason: reason.trim(),
        ...(teamName.trim() && teamName.trim() !== detail.registration.teamName ? { teamName: teamName.trim() } : {}),
        ...(member ? { member } : {}),
      });
      toast.success("Team information updated"); setEditing(null); setReason(""); setTeamName(""); await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Update failed"); }
    finally { setSaving(false); }
  };

  const resend = async () => {
    if (!token || !detail) return;
    try {
      const response = await api.teamRegistrations.resendConfirmation(token, detail.registration.id);
      toast.success(`Queued ${response.data.recipients} confirmation email(s)`); await load();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to resend email"); }
  };

  return (
    <AdminLayout title="Team Registration Detail">
      <Link href="/team-registrations" className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-700"><IconArrowLeft size={18} /> Back to teams</Link>
      {loading ? <div className="card flex justify-center py-20"><IconLoader2 className="animate-spin text-emerald-600" /></div>
      : error || !detail ? <div className="card bg-red-50 text-red-700">{error || "Team not found"}</div>
      : <DetailContent detail={detail} isAdmin={isAdmin} onEdit={(member) => { setEditing({ ...member }); setTeamName(detail.registration.teamName); }} onResend={resend} />}

      {editing && detail && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b"><h3 className="font-semibold text-lg">Admin correction</h3><p className="text-sm text-zinc-500">All changes are written to the audit log.</p></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Team name" value={teamName} onChange={setTeamName} wide />
              <Field label="First name" value={editing.firstName} onChange={(value) => setEditing({ ...editing, firstName: value })} />
              <Field label="Last name" value={editing.lastName} onChange={(value) => setEditing({ ...editing, lastName: value })} />
              <Field label="Nickname" value={editing.nickname ?? ""} onChange={(value) => setEditing({ ...editing, nickname: value || null })} />
              <Field label="Email" type="email" value={editing.email} onChange={(value) => setEditing({ ...editing, email: value })} />
              <Field label="Phone" value={editing.phoneNumber} onChange={(value) => setEditing({ ...editing, phoneNumber: value })} />
              <Field label="Line ID" value={editing.lineId} onChange={(value) => setEditing({ ...editing, lineId: value })} />
              <Field label="Emergency contact" value={editing.emergencyContactName ?? ""} onChange={(value) => setEditing({ ...editing, emergencyContactName: value })} />
              <Field label="Emergency phone" value={editing.emergencyContactPhone ?? ""} onChange={(value) => setEditing({ ...editing, emergencyContactPhone: value })} />
              <label className="md:col-span-2 text-sm font-medium text-zinc-600">Change reason *<textarea className="input-field mt-1 min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            </div>
            <div className="p-6 border-t flex justify-end gap-3"><button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary inline-flex items-center gap-2" onClick={saveCorrection} disabled={saving}>{saving && <IconLoader2 size={17} className="animate-spin" />} Save correction</button></div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function DetailContent({ detail, isAdmin, onEdit, onResend }: { detail: TeamRegistrationDetail; isAdmin: boolean; onEdit: (member: TeamRegistrationMember) => void; onResend: () => void }) {
  const registration = detail.registration;
  const latestPayment = detail.paymentAttempts[0];
  return <div className="space-y-6">
    <div className="card flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><IconUsersGroup /></div><div><h1 className="text-2xl font-bold text-zinc-900">{registration.teamName}</h1><p className="text-sm text-zinc-500">{String(registration.registrationCode ?? "Draft")} · {registration.leaderEmail}</p></div></div>
      <div className="flex gap-2"><Status value={registration.status} />{isAdmin && registration.status === "paid" && <button className="btn-secondary inline-flex items-center gap-2" onClick={onResend}><IconMailForward size={18} /> Resend email</button>}</div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Summary label="Members" value={detail.members.length} />
      <Summary label="Pricing round" value={registration.pricingRoundNameSnapshot ?? "—"} />
      <Summary label="Amount" value={registration.amountSnapshot ? `฿${Number(registration.amountSnapshot).toLocaleString()}` : "—"} />
      <Summary label="Payment" value={latestPayment?.status ?? "—"} />
    </div>

    <section className="card"><h2 className="font-semibold text-zinc-900 mb-4">Members</h2><div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{detail.members.map((member) => <MemberCard key={member.id} member={member} canEdit={isAdmin} onEdit={() => onEdit(member)} />)}</div></section>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className="card"><h2 className="font-semibold mb-4">Payment attempts</h2><div className="space-y-3">{detail.paymentAttempts.length ? detail.paymentAttempts.map((attempt) => <div key={attempt.id} className="rounded-xl border p-4 text-sm"><div className="flex justify-between"><span className="font-mono">{attempt.referenceNo}</span><Status value={attempt.status} /></div><div className="mt-2 text-zinc-500">฿{Number(attempt.amount).toLocaleString()} · {formatDate(attempt.createdAt)}</div></div>) : <Muted text="No payment attempts" />}</div></section>
      <section className="card"><h2 className="font-semibold mb-4">Email delivery</h2><div className="space-y-3">{detail.emailDeliveries.length ? detail.emailDeliveries.map((email) => <div key={email.id} className="flex justify-between rounded-xl border p-4 text-sm"><div><div>{email.recipientEmail}</div><div className="text-xs text-zinc-400">{formatDate(email.createdAt)}</div></div><Status value={email.status} /></div>) : <Muted text="No email deliveries" />}</div></section>
    </div>

    <section className="card"><div className="flex items-center gap-2 mb-4"><IconShieldCheck className="text-zinc-500" size={20} /><h2 className="font-semibold">Audit trail</h2></div><div className="space-y-2 text-sm">{detail.auditLogs.length ? detail.auditLogs.map((log) => <div key={log.id} className="flex justify-between border-b py-2"><span>{log.action.replaceAll('_', ' ')}{log.changeReason ? ` — ${log.changeReason}` : ""}</span><span className="text-zinc-400">{formatDate(log.createdAt)}</span></div>) : <Muted text="No prior audit entries" />}</div></section>
  </div>;
}

function MemberCard({ member, canEdit, onEdit }: { member: TeamRegistrationMember; canEdit: boolean; onEdit: () => void }) { return <article className="rounded-xl border border-zinc-200 p-5"><div className="flex justify-between"><div><div className="font-semibold text-zinc-900">{member.firstName} {member.lastName}</div><div className="text-xs text-zinc-500 uppercase">{member.memberRole}{member.isPharmacyStudent ? " · Pharmacy student" : ""}</div></div>{canEdit && <button onClick={onEdit} className="p-2 text-zinc-400 hover:text-emerald-700" title="Correct member"><IconPencil size={18} /></button>}</div><dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-sm"><Info label="Email" value={member.email} /><Info label="Phone" value={member.phoneNumber} /><Info label="Line ID" value={member.lineId} /><Info label="Age" value={member.age} /><Info label="Institution" value={member.university ?? member.school ?? "—"} /><Info label="Faculty / Grade" value={member.faculty ?? member.gradeLevel ?? "—"} /><Info label="Allergies" value={member.sensitiveDataPurgedAt ? "Purged" : member.foodDrugAllergies ?? "None reported"} /><Info label="Emergency" value={member.sensitiveDataPurgedAt ? "Purged" : `${member.emergencyContactName ?? "—"} ${member.emergencyContactPhone ?? ""}`} /></dl></article>; }
function Field({ label, value, onChange, type = "text", wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) { return <label className={`text-sm font-medium text-zinc-600 ${wide ? 'md:col-span-2' : ''}`}>{label}<input type={type} className="input-field mt-1" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Summary({ label, value }: { label: string; value: string | number }) { return <div className="card py-4"><div className="text-sm text-zinc-500">{label}</div><div className="text-xl font-semibold text-zinc-900 capitalize">{value}</div></div>; }
function Info({ label, value }: { label: string; value: string | number }) { return <div><dt className="text-xs text-zinc-400">{label}</dt><dd className="text-zinc-700 break-words">{value}</dd></div>; }
function Status({ value }: { value: string }) { const color = value === 'paid' || value === 'sent' ? 'bg-emerald-100 text-emerald-700' : value.includes('fail') || value === 'verification_required' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'; return <span className={`inline-flex h-fit rounded-full px-2.5 py-1 text-xs font-medium capitalize ${color}`}>{value.replaceAll('_', ' ')}</span>; }
function Muted({ text }: { text: string }) { return <p className="text-sm text-zinc-400">{text}</p>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)); }
