// Staff DTOs copied from conference-api/src/modules/posters/types.ts; preview input mirrors its schema.
export type AnnouncementType = 'oral' | 'poster' | 'highlighted-poster';
export type RevisionStatus = 'open' | 'submitted' | 'expired' | 'cancelled';
export type MatchState = 'ready' | 'alias_pending' | 'conflict' | 'missing' | 'incomplete';
export type MailKind = 'initial' | 'reminder' | 'revision' | 'receipt';
export type MailState = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'suppressed';
export type Announcement = { id: number; sequence?: number; trackingId: string | null;
  title: string; presentationType: AnnouncementType; categoryId: number; categoryName: string;
  submitterName: string | null; affiliation: string | null; round: 1 | 2 };
export type UploadDto = { id: string; version: number; fileName: string; mimeType: 'image/png' | 'application/pdf';
  sizeBytes: number; publicUrl: string; receivedAt: string; revisionRequestId: string | null };
export type RevisionDto = { id: string; details: string; closesAt: string; status: RevisionStatus;
  createdAt: string; requestedBy: number; submittedAt: string | null; cancelledAt: string | null;
  cancelledBy: number | null; cancellationReason: string | null };
export type PosterProgress='not_submitted'|'submitted'|'revision_pending'|'revised'|'revision_expired';
export type PosterListRow={sourceKey:string;announcement:Announcement;abstractId:number|null;matchState:MatchState|'withdrawn'|null;matchFingerprint:string;
 problems:string[];snapshot:unknown;verifiedBy:number|null;verifiedAt:string|null;verificationReason:string|null;
 submitterEmail:string|null;progress:PosterProgress;currentUpload:UploadDto|null;activeRequest:RevisionDto|null;
 lastEmail:{id:string;kind:MailKind;state:MailState;createdAt:string;errorCode:string|null}|null;canNotify:boolean};
export type PosterSettingsDto={eventId:number;closesAt:string;version:number;reconcileReady:boolean;reconciledAt:string|null};
export type PosterSettingsHistoryDto={settings:PosterSettingsDto;history:Array<{id:string;actorId:number|null;reason:string|null;before:unknown;after:unknown;createdAt:string}>;capabilities:{read:true;manage:boolean}};
export type PosterReconciliationDto={eventId:number;digest:string;counts:Record<string,number>};
export type PosterListDto={items:PosterListRow[];total:number;page:number;pageSize:number;settings:PosterSettingsDto;
 capabilities:{read:true;manage:boolean};counts:Record<PosterProgress,number>};
export type PosterDetailDto={row:PosterListRow;uploads:UploadDto[];requests:RevisionDto[];
 emailJobs:Array<{id:string;kind:MailKind;state:MailState;recipient:string;subject:string;html:string;text?:string;templateVersion?:string;createdAt:string;finishedAt:string|null;
  triggeredBy:number|null;parentJobId:string|null;requestId:string|null;uploadId:string|null;errorCode:string|null;attempts:unknown[]}>;
 audit:unknown[];capabilities:{read:true;manage:boolean}};
export type PosterBatchDto={batchId:string;jobs:Array<{id:string;abstractId:number;recipient:string;state:MailState;errorCode:string|null}>};
export type PosterPreviewDto = {fingerprint:string;messages:Array<{abstractId:number;recipient:string;subject:string;html:string;text?:string;templateVersion:string}>;requestId?:string;closesAt?:string};
export type PosterPreviewInput =
  | { kind: 'initial' | 'reminder'; abstractIds: number[] }
  | { kind: 'revision'; abstractId: number; requestId?: string; details: string; closesAt: string }
  | { kind: 'receipt'; abstractId: number; uploadId: string }
  | { kind: 'resend'; jobId: string };
