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

export interface EventUpdateInput extends Partial<EventCreateInput> { }

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
    quota: number;
    soldCount: number;
    displayOrder: number;
    saleStartDate: string | null;
    saleEndDate: string | null;
    isActive: boolean;
    sessionIds?: number[];
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
