// Staff DTOs copied from conference-api/src/modules/presentations/types.ts; preview input mirrors its schema.
export type AnnouncementType = 'oral' | 'poster' | 'highlighted-poster';
export type RevisionStatus = 'open' | 'submitted' | 'expired' | 'cancelled';
export type MatchState = 'ready' | 'alias_pending' | 'conflict' | 'missing' | 'incomplete';
export type MailKind = 'initial' | 'reminder' | 'revision' | 'receipt';
export type MailState = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'suppressed';
export type Announcement = { id: number; sequence?: number; trackingId: string | null;
  title: string; presentationType: AnnouncementType; categoryId: number; categoryName: string;
  submitterName: string | null; affiliation: string | null; round: 1 | 2 };
export type UploadDto = { id: string; version: number; fileName: string; storedFileName: string; mimeType: 'application/pdf' | 'image/png';
  sizeBytes: number; fileUrl: string; storageProvider: 'drive' | 'r2'; driveFileId: string | null;
  receivedAt: string; revisionRequestId: string | null };
export type RevisionDto = { id: string; details: string; closesAt: string; status: RevisionStatus;
  createdAt: string; requestedBy: number; submittedAt: string | null; cancelledAt: string | null;
  cancelledBy: number | null; cancellationReason: string | null };
export type PresentationProgress='not_submitted'|'submitted'|'revision_pending'|'revised'|'revision_expired';
export type PresentationListRow={sourceKey:string;announcement:Announcement;abstractId:number|null;matchState:MatchState|'withdrawn'|null;matchFingerprint:string;
 problems:string[];snapshot:unknown;verifiedBy:number|null;verifiedAt:string|null;verificationReason:string|null;
 submitterEmail:string|null;progress:PresentationProgress;currentUpload:UploadDto|null;activeRequest:RevisionDto|null;
 lastEmail:{id:string;kind:MailKind;state:MailState;createdAt:string;errorCode:string|null}|null;canNotify:boolean};
export type PresentationSettingsDto={eventId:number;closesAt:string;version:number;reconcileReady:boolean;reconciledAt:string|null};
export type PresentationSettingsHistoryDto={settings:PresentationSettingsDto;history:Array<{id:string;actorId:number|null;reason:string|null;before:unknown;after:unknown;createdAt:string}>;capabilities:{read:true;manage:boolean}};
export type PresentationReconciliationDto={eventId:number;digest:string;counts:Record<string,number>};
export type PresentationListDto={items:PresentationListRow[];total:number;page:number;pageSize:number;settings:PresentationSettingsDto;
 capabilities:{read:true;manage:boolean};counts:Record<PresentationProgress,number>};
export type PresentationDetailDto={row:PresentationListRow;uploads:UploadDto[];requests:RevisionDto[];
 emailJobs:Array<{id:string;kind:MailKind;state:MailState;recipient:string;subject:string;html:string;templateVersion?:string;createdAt:string;finishedAt:string|null;
  triggeredBy:number|null;parentJobId:string|null;requestId:string|null;uploadId:string|null;errorCode:string|null;attempts:unknown[]}>;
 audit:unknown[];capabilities:{read:true;manage:boolean}};
export type PresentationBatchDto={batchId:string;jobs:Array<{id:string;abstractId:number;recipient:string;state:MailState;errorCode:string|null}>};
export type PresentationPreviewDto = {fingerprint:string;messages:Array<{abstractId:number;recipient:string;subject:string;html:string;templateVersion:string}>;requestId?:string;closesAt?:string};
export type PresentationPreviewInput =
  | { kind: 'initial' | 'reminder'; abstractIds: number[] }
  | { kind: 'revision'; abstractId: number; requestId?: string; details: string; closesAt: string }
  | { kind: 'receipt'; abstractId: number; uploadId: string }
  | { kind: 'resend'; jobId: string };
