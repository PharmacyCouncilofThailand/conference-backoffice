// API Type Definitions for ACCP Backoffice

// ============================================================================
// User Types
// ============================================================================

export type StaffRole = 'admin' | 'organizer' | 'reviewer' | 'staff' | 'verifier';

export interface AssignedEvent {
    id: number;
    code: string;
    name: string;
}

export interface User {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: StaffRole;
    isActive: boolean;
    assignedEvents: AssignedEvent[];
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    token?: string;
    user?: User;
    error?: string;
    code?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventType = 'single_room' | 'multi_session';

export interface Event {
    id: number;
    eventCode: string;
    eventName: string;
    shortName?: string | null;
    description?: string | null;
    eventType: EventType;
    location?: string | null;
    startDate: string;
    endDate: string;
    maxCapacity: number;
    status: EventStatus;
    imageUrl?: string | null;
    coverImage?: string | null;
    videoUrl?: string | null;
    websiteUrl?: string | null;
    createdAt: string;
    updatedAt: string;
    // Additional optional fields used in edit page
    mapUrl?: string | null;
    venueAddress?: string | null;
    abstractStartDate?: string | null;
    abstractEndDate?: string | null;
    saleStartDate?: string | null;
    saleEndDate?: string | null;
    conferenceCode?: string | null;
    cpeCredits?: string | null;
    documents?: { name: string; url: string }[] | null;
}

export interface EventCreateInput {
    eventCode: string;
    eventName: string;
    shortName?: string;
    description?: string;
    eventType: EventType;
    location?: string;
    startDate: string;
    endDate: string;
    maxCapacity: number;
    status?: EventStatus;
    imageUrl?: string;
    coverImage?: string;
    videoUrl?: string;
    mapUrl?: string;
    websiteUrl?: string;
    conferenceCode?: string;
    cpeCredits?: string;
    documents?: { name: string; url: string }[];
}

export type EventUpdateInput = Partial<EventCreateInput>;

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
    id: number;
    eventId: number;
    sessionCode: string;
    sessionName: string;
    description?: string | null;
    room?: string | null;
    startTime: string;
    endTime: string;
    maxCapacity?: number;
    agenda?: { time: string; topic: string }[] | null;
}

// ============================================================================
// Ticket Types
// ============================================================================

export type TicketCategory = 'primary' | 'addon';

export interface Ticket {
    id: number;
    eventId: number;
    name: string;
    category: TicketCategory;
    groupName: string | null;
    price: string;
    originalPrice: string | null;
    currency: string;
    description: string | null;
    features: string[];
    badgeText: string | null;
    allowedRoles: string | null;
    allowedStudentLevels: string | null;
    quota: number;
    soldCount: number;
    displayOrder: number;
    saleStartDate: string | null;
    saleEndDate: string | null;
    isActive: boolean;
    sessionIds?: number[];
}

// ============================================================================
// Sponsor Types
// ============================================================================

export type SponsorPackageType = 'booth' | 'symposium' | 'bundle';
export type SponsorMediaType = 'past_sponsor_logo' | 'previous_year_impression' | 'brochure' | 'other';
export type SponsorApplicationStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled';
export type SponsorPaymentStatus = 'pending_review' | 'verified' | 'rejected';

export interface SponsorEventProfile {
    id?: number;
    eventId: number;
    aboutTitle?: string | null;
    aboutDescription?: string | null;
    organizerLogoUrl?: string | null;
    brochureUrl?: string | null;
    registrationOpenAt?: string | null;
    registrationCloseAt?: string | null;
    isPublished: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface SponsorStat {
    id: number;
    eventId: number;
    valueText: string;
    label: string;
    description?: string | null;
    sortOrder: number;
    isActive: boolean;
}

export interface SponsorPackageFeature {
    id?: number;
    packageId?: number;
    featureText: string;
    sortOrder: number;
}

export interface SponsorPackageComponent {
    id?: number;
    bundlePackageId?: number;
    componentPackageId: number;
    componentRole?: string | null;
    package?: {
        id: number;
        packageType: SponsorPackageType;
        code: string;
        name: string;
        price: string;
        currency: string;
        quota?: number;
        reservedCount?: number;
        remainingQuota?: number | null;
    } | null;
}

export interface SponsorPackage {
    id: number;
    eventId: number;
    packageType: SponsorPackageType;
    code: string;
    optionLabel?: string | null;
    name: string;
    description?: string | null;
    price: string;
    currency: string;
    quota: number;
    badgeText?: string | null;
    themeKey?: string | null;
    isRecommended: boolean;
    sortOrder: number;
    isActive: boolean;
    reservedCount?: number;
    remainingQuota?: number | null;
    rawRemainingQuota?: number | null;
    effectiveQuota?: number | null;
    availabilitySource?: 'package' | 'components';
    features?: SponsorPackageFeature[];
    components?: SponsorPackageComponent[];
}

export interface SponsorBenefit {
    id: number;
    eventId: number;
    title: string;
    description?: string | null;
    iconKey?: string | null;
    sortOrder: number;
    isActive: boolean;
}

export interface SponsorMediaAsset {
    id: number;
    eventId: number;
    mediaType: SponsorMediaType;
    title?: string | null;
    caption?: string | null;
    fileUrl: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    sortOrder: number;
    isActive: boolean;
}

export interface SponsorTimelineItem {
    id: number;
    eventId: number;
    periodLabel: string;
    title: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isHighlight: boolean;
    sortOrder: number;
    isActive: boolean;
}

export interface SponsorApplicationItem {
    id: number;
    applicationId: number;
    packageId?: number | null;
    packageType: SponsorPackageType;
    packageNameSnapshot: string;
    priceSnapshot: string;
    quantity: number;
    sortOrder: number;
}

export interface SponsorApplication {
    id: number;
    applicationNo: string;
    eventId: number;
    eventName?: string;
    eventCode?: string;
    companyName: string;
    contactFullName: string;
    businessEmail: string;
    phone: string;
    billingName: string;
    taxId: string;
    billingAddress: string;
    paymentSlipUrl?: string | null;
    paymentSlipFileName?: string | null;
    logoUrl?: string | null;
    logoFileName?: string | null;
    totalAmount: string;
    currency: string;
    applicationStatus: SponsorApplicationStatus;
    paymentStatus: SponsorPaymentStatus;
    internalNote?: string | null;
    rejectionReason?: string | null;
    reviewedBy?: number | null;
    reviewedAt?: string | null;
    confirmedAt?: string | null;
    createdAt: string;
    updatedAt?: string;
    reviewerFirstName?: string | null;
    reviewerLastName?: string | null;
    items?: SponsorApplicationItem[];
}

export interface SponsorPage {
    event: Event;
    profile: SponsorEventProfile | null;
    stats: SponsorStat[];
    packages: {
        booth: SponsorPackage[];
        symposium: SponsorPackage[];
        bundle: SponsorPackage[];
    };
    benefits: SponsorBenefit[];
    media: {
        pastSponsors: SponsorMediaAsset[];
        previousYearImpressions: SponsorMediaAsset[];
        brochures: SponsorMediaAsset[];
        other: SponsorMediaAsset[];
    };
    timeline: SponsorTimelineItem[];
}

// ============================================================================
// Registration Types
// ============================================================================

export type RegistrationStatus = 'confirmed' | 'cancelled';

export interface Registration {
    id: number;
    regCode: string;
    eventId: number;
    email: string;
    firstName: string;
    lastName: string;
    status: RegistrationStatus;
    createdAt: string;
    // Additional fields from expanded API responses
    ticketName?: string;
    eventName?: string;
    eventCode?: string;
    source?: 'purchase' | 'manual';
    addedNote?: string | null;
    addedByFirstName?: string | null;
    addedByLastName?: string | null;
}

// ============================================================================
// Verification Types
// ============================================================================

export type AccountStatus = 'pending_approval' | 'active' | 'rejected';

export interface VerificationRequest {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    institution?: string;
    status: AccountStatus;
    studentDocUrl?: string;
    createdAt: string;
}

export type StudentEligibilityStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface StudentEligibilityRequest {
    id: number;
    eventId: number;
    eventCode: string;
    eventName: string;
    userId: number;
    name: string;
    email: string;
    role: string;
    pharmacyLicenseId?: string | null;
    institution?: string | null;
    studentLevel: 'postgraduate';
    status: StudentEligibilityStatus;
    documentFileName: string;
    documentUrl: string;
    documentFileType?: string | null;
    documentFileSize?: number | null;
    rejectionReason?: string | null;
    reviewNote?: string | null;
    reviewedBy?: number | null;
    reviewedByName?: string | null;
    reviewedAt?: string | null;
    resubmissionCount: number;
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// Abstract Types
// ============================================================================

export type AbstractCategory =
    | 'clinical_pharmacy'
    | 'social_administrative'
    | 'community_pharmacy'
    | 'pharmacology_toxicology'
    | 'pharmacy_education'
    | 'digital_pharmacy';

export type PresentationType = 'oral' | 'poster';
export type AbstractStatus = 'pending' | 'accepted' | 'rejected';

export interface Abstract {
    id: number;
    title: string;
    category: AbstractCategory;
    presentationType: PresentationType;
    status: AbstractStatus;
    submittedBy: string;
    createdAt: string;
}

// ============================================================================
// Speaker Types
// ============================================================================

export type SpeakerType = 'keynote' | 'panelist' | 'moderator' | 'guest';

export interface Speaker {
    id: number;
    firstName: string;
    lastName: string;
    email?: string;
    organization?: string;
    position?: string;
    bio?: string;
    photoUrl?: string;
    speakerType: SpeakerType;
}

// ============================================================================
// Promo Code Types
// ============================================================================

export interface PromoRuleSet {
    matchType: 'all' | 'any' | 'only';
    ticketTypeIds: number[];
}

export interface PromoCode {
    id: number;
    eventId?: number | null;
    code: string;
    description?: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: string;
    fixedValueThb?: string | null;
    fixedValueUsd?: string | null;
    minPurchase?: string | null;
    maxDiscount?: string | null;
    maxUses?: number;
    maxUsesPerUser?: number;
    usedCount: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive: boolean;
    status?: string;
    eventCode?: string;
    eventName?: string;
    ruleSets?: PromoRuleSet[];
}

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Payment {
    id: number;
    orderId: number;
    amount: string;
    status: PaymentStatus;
    paymentMethod?: string;
    paidAt?: string;
    createdAt: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: Pagination;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
}

export interface EventsResponse {
    events: Event[];
    pagination: Pagination;
}

export interface UsersResponse {
    users: User[];
    pagination: Pagination;
}

export interface VerificationsResponse {
    verifications: VerificationRequest[];
    pagination: Pagination;
}
