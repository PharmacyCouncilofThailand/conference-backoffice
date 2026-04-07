"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { getExternalEventReadiness } from "@/lib/eventReadiness";
import toast from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  IconCalendarEvent,
  IconLayoutGrid,
  IconTicket,
  IconPhoto,
  IconArrowLeft,
  IconCheck,
  IconPlus,
  IconTrash,
  IconX,
  IconLoader2,
  IconMicrophone,
  IconPencil,
  IconTarget,
  IconClock,
  IconFileText,
  IconUpload,
  IconAlertTriangle,
} from "@tabler/icons-react";

interface Speaker {
  id: number;
  firstName: string;
  lastName: string;
  organization: string | null;
}

// Types
interface SessionData {
  id?: number;
  sessionCode: string;
  sessionName: string;
  sessionType:
    | "workshop"
    | "gala_dinner"
    | "lecture"
    | "ceremony"
    | "break"
    | "other";
  description: string;
  room: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  selectedSpeakerIds?: number[];
  isMainSession?: boolean;
  isNew?: boolean;
  agenda?: { time: string; topic: string }[];
}

interface TicketData {
  id?: number;
  name: string;
  category: "primary" | "addon";
  groupName?: string;
  price: string;
  currency: "THB" | "USD";
  originalPrice?: string;
  description?: string;
  features?: string[];
  badgeText?: string;
  quota: string;
  saleStartDate: string;
  saleEndDate: string;
  allowedRoles: string[];
  allowedStudentLevels?: string[];
  priority: string;
  isActive?: boolean;
  sessionIds?: number[];
  sessionId?: number;
  isNew?: boolean;
}

interface VenueImage {
  id?: number;
  imageUrl: string;
  caption: string;
  isNew?: boolean;
}

interface EventFormData {
  eventCode: string;
  eventName: string;
  description: string;
  eventType: "single_room" | "multi_session";
  location: string;
  mapUrl: string;
  websiteUrl: string;
  startDate: string;
  endDate: string;
  maxCapacity: number;
  conferenceCode: string;
  cpeCredits: string;
  status: "draft" | "published" | "cancelled" | "completed";
  imageUrl: string;
  coverImage: string;
  videoUrl: string;
  documents: { name: string; url: string }[];
}

const roleOptions = [
  { value: "pharmacist", label: "Pharmacist" },
  { value: "medical_professional", label: "Medical Professional" },
  { value: "student", label: "Student" },
  { value: "general", label: "General" },
];

// Helper to convert ISO date (UTC) to datetime-local string in local browser timezone
const toDateTimeLocal = (isoString: string): string => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

// Helper function to format datetime
const formatDateTime = (dateTimeStr: string): string => {
  if (!dateTimeStr) return "-";
  try {
    const date = new Date(dateTimeStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Bangkok",
    });
  } catch {
    return dateTimeStr;
  }
};

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [activeTab, setActiveTab] = useState<
    "details" | "sessions" | "tickets" | "venue"
  >("details");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [formData, setFormData] = useState<EventFormData>({
    eventCode: "",
    eventName: "",
    description: "",
    eventType: "single_room",
    location: "",
    mapUrl: "",
    websiteUrl: "",
    startDate: "",
    endDate: "",
    maxCapacity: 0,
    conferenceCode: "",
    cpeCredits: "",
    status: "draft",
    imageUrl: "",
    coverImage: "",
    videoUrl: "",
    documents: [],
  });

  // Sessions, Tickets, Images
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [venueImages, setVenueImages] = useState<VenueImage[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");

  // Pending file objects (uploaded on save)
  const [pendingThumbnail, setPendingThumbnail] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pendingCover, setPendingCover] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<{ file: File; previewUrl: string } | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<{ file: File; name: string }[]>([]);

  // Modals
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);

  // Session form
  const [sessionForm, setSessionForm] = useState<SessionData>({
    sessionCode: "",
    sessionName: "",
    sessionType: "other",
    description: "",
    room: "",
    startTime: "",
    endTime: "",
    maxCapacity: 0,
    selectedSpeakerIds: [],
    agenda: [],
  });

  // Ticket form
  const [ticketForm, setTicketForm] = useState<TicketData>({
    name: "",
    category: "primary",
    groupName: "",
    price: "",
    currency: "THB",
    originalPrice: "",
    description: "",
    features: [],
    badgeText: "",
    quota: "0",
    saleStartDate: "",
    saleEndDate: "",
    allowedRoles: [],
    priority: "regular",
    isActive: true,
    sessionIds: [],
  });
  const [ticketFeatureInput, setTicketFeatureInput] = useState("");

  const shouldShowSessions = true;
  const readiness = useMemo(
    () =>
      getExternalEventReadiness({
        websiteUrl: formData.websiteUrl,
        status: formData.status,
        sessions,
        tickets,
      }),
    [formData.status, formData.websiteUrl, sessions, tickets],
  );

  // Fetch existing event data and speakers
  useEffect(() => {
    const fetchSpeakers = async () => {
      try {
        const token = getBackofficeToken();
        const res = await api.speakers.list(token);
        setSpeakers(res.speakers as unknown as Speaker[]);
      } catch (err) {
        console.error("Failed to fetch speakers:", err);
      }
    };
    fetchSpeakers();

    const fetchEvent = async () => {
      setIsLoading(true);
      try {
        const token = getBackofficeToken();
        const response = await api.backofficeEvents.get(
          token,
          parseInt(eventId),
        );
        const event = response.event;

        setFormData({
          eventCode: event.eventCode || "",
          eventName: event.eventName || "",
          description: event.description || "",
          eventType: event.eventType || "single_room",
          location: event.location || "",
          mapUrl: event.mapUrl || "",
          websiteUrl: event.websiteUrl || "",
          startDate: toDateTimeLocal(event.startDate),
          endDate: toDateTimeLocal(event.endDate),
          maxCapacity: event.maxCapacity ?? 0,
          conferenceCode: event.conferenceCode || "",
          cpeCredits: event.cpeCredits || "",
          status: event.status || "draft",
          imageUrl: event.imageUrl || "",
          coverImage: event.coverImage || "",
          videoUrl: event.videoUrl || "",
          documents: event.documents || [],
        });

        // Load sessions
        if (response.sessions) {
          setSessions(
            response.sessions.map((s: any) => ({
              id: s.id,
              sessionCode: s.sessionCode,
              sessionName: s.sessionName,
              sessionType: s.sessionType || "other",
              description: s.description || "",
              room: s.room || "",
              startTime: toDateTimeLocal(s.startTime),
              endTime: toDateTimeLocal(s.endTime),
              maxCapacity: s.maxCapacity ?? 0,
              isMainSession: s.isMainSession,
              agenda: s.agenda || [],
            })),
          );
        }

        // Load tickets
        if (response.tickets) {
          setTickets(
            response.tickets.map((t: any) => {
              // Parse allowedRoles - could be JSON array, CSV string, or JS array
              let roles: string[] = [];
              if (t.allowedRoles) {
                if (Array.isArray(t.allowedRoles)) {
                  roles = t.allowedRoles;
                } else if (typeof t.allowedRoles === "string") {
                  if (t.allowedRoles.startsWith("[")) {
                    try { roles = JSON.parse(t.allowedRoles); } catch { roles = []; }
                  } else {
                    roles = t.allowedRoles.split(",").map((r: string) => r.trim()).filter(Boolean);
                  }
                }
              }
              return {
                id: t.id,
                name: t.name,
                category: t.category,
                groupName: t.groupName || "",
                price: t.price,
                currency: t.currency || "THB",
                originalPrice: t.originalPrice ? String(t.originalPrice) : "",
                description: t.description || "",
                features: t.features || [],
                badgeText: t.badgeText || "",
                quota: String(t.quota || 0),
                saleStartDate: t.saleStartDate
                  ? toDateTimeLocal(t.saleStartDate)
                  : "",
                saleEndDate: t.saleEndDate
                  ? toDateTimeLocal(t.saleEndDate)
                  : "",
                allowedRoles: roles,
                priority: t.priority || "regular",
                isActive: t.isActive ?? true,
                sessionIds: t.sessionIds || (t.sessionId ? [t.sessionId] : []),
              };
            }),
          );
        }

        // Load venue images
        if (response.venueImages) {
          setVenueImages(
            response.venueImages.map((img: any) => ({
              id: img.id,
              imageUrl: img.imageUrl,
              caption: img.caption || "",
            })),
          );
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch event");
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  // Add/Update session
  const handleAddSession = async () => {
    if (!sessionForm.sessionCode || !sessionForm.sessionName) return;
    try {
      const token = getBackofficeToken();

      // Get speaker names from selected IDs
      const speakerNames = (sessionForm.selectedSpeakerIds || [])
        .map((id) => {
          const speaker = speakers.find((s) => s.id === id);
          return speaker ? `${speaker.firstName} ${speaker.lastName}` : "";
        })
        .filter(Boolean);

      if (editingSessionId) {
        // Update existing session
        await api.backofficeEvents.updateSession(
          token,
          parseInt(eventId),
          editingSessionId,
          {
            sessionCode: sessionForm.sessionCode,
            sessionName: sessionForm.sessionName,
            sessionType: sessionForm.sessionType,
            description: sessionForm.description || undefined,
            room: sessionForm.room || undefined,
            startTime: new Date(sessionForm.startTime).toISOString(),
            endTime: new Date(sessionForm.endTime).toISOString(),
            speakers: JSON.stringify(speakerNames),
            maxCapacity: sessionForm.maxCapacity,
            isMainSession: sessionForm.isMainSession || false,
            agenda: sessionForm.agenda && sessionForm.agenda.length > 0 ? sessionForm.agenda : undefined,
          },
        );
        setSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId
              ? {
                ...sessionForm,
                id: editingSessionId,
                isMainSession: sessionForm.isMainSession,
                sessionType: sessionForm.sessionType,
              }
              : s,
          ),
        );
        setEditingSessionId(null);
        toast.success("Session updated successfully");
      } else {
        // Create new session
        const response = await api.backofficeEvents.createSession(
          token,
          parseInt(eventId),
          {
            sessionCode: sessionForm.sessionCode,
            sessionName: sessionForm.sessionName,
            sessionType: sessionForm.sessionType,
            description: sessionForm.description || undefined,
            room: sessionForm.room || undefined,
            startTime: new Date(sessionForm.startTime).toISOString(),
            endTime: new Date(sessionForm.endTime).toISOString(),
            speakers: JSON.stringify(speakerNames),
            maxCapacity: sessionForm.maxCapacity,
            agenda: sessionForm.agenda && sessionForm.agenda.length > 0 ? sessionForm.agenda : undefined,
          },
        );
        const session = response.session as Record<string, unknown>;
        setSessions((prev) => [
          ...prev,
          {
            id: session.id as number,
            sessionCode: session.sessionCode as string,
            sessionName: session.sessionName as string,
            sessionType: sessionForm.sessionType,
            description: (session.description as string) || "",
            room: (session.room as string) || "",
            startTime: toDateTimeLocal(session.startTime as string),
            endTime: toDateTimeLocal(session.endTime as string),
            maxCapacity: (session.maxCapacity as number) ?? 0,
            selectedSpeakerIds: sessionForm.selectedSpeakerIds,
            isMainSession: sessionForm.isMainSession,
          },
        ]);
        toast.success("Session created successfully");
      }
      setSessionForm({
        sessionCode: "",
        sessionName: "",
        sessionType: "other",
        description: "",
        room: "",
        startTime: "",
        endTime: "",
        maxCapacity: 0,
        selectedSpeakerIds: [],
        isMainSession: false,
        agenda: [],
      });
      setShowSessionModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save session");
    }
  };

  // Edit session
  const handleEditSession = (session: SessionData) => {
    setSessionForm({
      sessionCode: session.sessionCode,
      sessionName: session.sessionName,
      sessionType: session.sessionType || "other",
      description: session.description || "",
      room: session.room || "",
      startTime: session.startTime,
      endTime: session.endTime,
      maxCapacity: session.maxCapacity,
      selectedSpeakerIds: session.selectedSpeakerIds || [],
      isMainSession: session.isMainSession || false,
      agenda: session.agenda || [],
    });
    setEditingSessionId(session.id!);
    setShowSessionModal(true);
  };

  // Delete session
  const handleDeleteSession = async (id: number) => {
    if (!confirm("Delete this session?")) return;
    try {
      const token = getBackofficeToken();
      await api.backofficeEvents.deleteSession(token, parseInt(eventId), id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete session");
    }
  };

  // Add ticket
  const handleAddTicket = async () => {
    if (!ticketForm.name || !ticketForm.price) return;
    try {
      const token = getBackofficeToken();
      // Build payload
      const ticketPayload: Record<string, unknown> = {
        name: ticketForm.name,
        category: ticketForm.category,
        groupName: ticketForm.groupName || undefined,
        price: ticketForm.price, // Keep as string
        currency: ticketForm.currency,
        originalPrice: ticketForm.originalPrice ? Number(ticketForm.originalPrice) : undefined,
        description: ticketForm.description || undefined,
        features: ticketForm.features && ticketForm.features.length > 0 ? ticketForm.features : [],
        badgeText: ticketForm.badgeText || undefined,
        quota: parseInt(ticketForm.quota) || 0,
        allowedRoles: JSON.stringify(ticketForm.allowedRoles),
        allowedStudentLevels: ticketForm.allowedStudentLevels && ticketForm.allowedStudentLevels.length > 0 ? JSON.stringify(ticketForm.allowedStudentLevels) : undefined,
        priority: ticketForm.priority || "regular",
        isActive: ticketForm.isActive ?? true,
        // Handle session linking:
        // - Add-on: use selected IDs
        // - Primary: find and link all Main Sessions
        sessionIds:
          ticketForm.category === "addon"
            ? ticketForm.sessionIds
            : ticketForm.category === "primary"
              ? sessions.filter((s) => s.isMainSession).map((s) => s.id)
              : [],
      };

      if (ticketForm.saleStartDate) {
        ticketPayload.saleStartDate = new Date(
          ticketForm.saleStartDate,
        ).toISOString();
      }
      if (ticketForm.saleEndDate) {
        ticketPayload.saleEndDate = new Date(
          ticketForm.saleEndDate,
        ).toISOString();
      }

      if (editingTicketId) {
        // Update existing ticket
        await api.backofficeEvents.updateTicket(
          token,
          parseInt(eventId),
          editingTicketId,
          ticketPayload,
        );

        // Fetch the updated ticket from response or just update local state
        // Since updateTicket returns the updated ticket, we use it
        // But simplified here, we construct it from form

        setTickets((prev) =>
          prev.map((t) =>
            t.id === editingTicketId
              ? {
                ...t,
                id: editingTicketId,
                name: ticketForm.name,
                category: ticketForm.category,
                groupName: ticketForm.groupName,
                price: ticketForm.price,
                currency: ticketForm.currency,
                originalPrice: ticketForm.originalPrice,
                description: ticketForm.description,
                features: ticketForm.features,
                badgeText: ticketForm.badgeText,
                quota: ticketForm.quota,
                allowedRoles: ticketForm.allowedRoles,
                saleStartDate: ticketForm.saleStartDate,
                saleEndDate: ticketForm.saleEndDate,
                sessionIds:
                  ticketForm.category === "addon"
                    ? ticketForm.sessionIds
                    : [],
              }
              : t,
          ),
        );
        setEditingTicketId(null);
        toast.success("Ticket updated successfully");
      } else {
        // Create new ticket
        const response = await api.backofficeEvents.createTicket(
          token,
          parseInt(eventId),
          ticketPayload,
        );
        const ticket = response.ticket as Record<string, unknown>;
        // Parse allowedRoles back from JSON string
        let roles: string[] = [];
        if (ticket.allowedRoles) {
          try {
            roles =
              typeof ticket.allowedRoles === "string"
                ? JSON.parse(ticket.allowedRoles)
                : (ticket.allowedRoles as string[]);
          } catch {
            roles = [];
          }
        }
        setTickets((prev) => [
          ...prev,
          {
            id: ticket.id as number,
            name: ticket.name as string,
            category: ticket.category as "primary" | "addon",
            groupName: (ticket.groupName as string) || "",
            price: String(ticket.price),
            currency: (ticket.currency as "THB" | "USD") || "THB",
            originalPrice: ticket.originalPrice ? String(ticket.originalPrice) : "",
            description: (ticket.description as string) || "",
            features: (ticket.features as string[]) || [],
            badgeText: (ticket.badgeText as string) || "",
            quota: String(ticket.quota || 0),
            saleStartDate: ticket.saleStartDate
              ? toDateTimeLocal(ticket.saleStartDate as string)
              : "",
            saleEndDate: ticket.saleEndDate
              ? toDateTimeLocal(ticket.saleEndDate as string)
              : "",
            allowedRoles: roles,
            priority: (ticket.priority as string) || "regular",
            sessionIds:
              (ticket.sessionIds as number[]) ||
              (ticket.sessionId ? [ticket.sessionId as number] : []),
          },
        ]);
        toast.success("Ticket created successfully");
      }

      setTicketForm({
        name: "",
        category: "primary",
        groupName: "",
        price: "",
        currency: "THB",
        originalPrice: "",
        description: "",
        features: [],
        badgeText: "",
        quota: "0",
        saleStartDate: "",
        saleEndDate: "",
        allowedRoles: [],
        allowedStudentLevels: [],
        priority: "regular",
        isActive: true,
        sessionIds: [],
      });
      setTicketFeatureInput("");
      setShowTicketModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save ticket");
    }
  };

  // Edit ticket
  const handleEditTicket = (ticket: TicketData) => {
    setTicketForm({
      name: ticket.name,
      category: ticket.category,
      groupName: ticket.groupName || "",
      price: ticket.price,
      currency: ticket.currency,
      originalPrice: ticket.originalPrice || "",
      description: ticket.description || "",
      features: ticket.features || [],
      badgeText: ticket.badgeText || "",
      quota: ticket.quota,
      saleStartDate: ticket.saleStartDate,
      saleEndDate: ticket.saleEndDate,
      allowedRoles: ticket.allowedRoles || [],
      allowedStudentLevels: ticket.allowedStudentLevels || [],
      priority: ticket.priority || "regular",
      isActive: ticket.isActive ?? true,
      sessionIds:
        ticket.sessionIds || (ticket.sessionId ? [ticket.sessionId] : []),
    });
    setEditingTicketId(ticket.id!);
    setShowTicketModal(true);
  };

  // Delete ticket
  const handleDeleteTicket = async (id: number) => {
    if (!confirm("Delete this ticket?")) return;
    try {
      const token = getBackofficeToken();
      await api.backofficeEvents.deleteTicket(token, parseInt(eventId), id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete ticket");
    }
  };

  // Delete venue image
  const handleDeleteImage = async (id: number) => {
    if (!confirm("Delete this image?")) return;
    try {
      const token = getBackofficeToken();
      await api.backofficeEvents.deleteImage(token, parseInt(eventId), id);
      setVenueImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete image");
    }
  };

  // Generate upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check sizes
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`File ${file.name} too large (max 5MB)`);
        return;
      }
    }

    setIsUploading(true);
    const token = getBackofficeToken();

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        // 1. Upload to Drive
        const uploadRes = await api.upload.venueImage(token, formData);

        // 2. Add to DB
        const dbRes = await api.backofficeEvents.addImage(
          token,
          parseInt(eventId),
          {
            imageUrl: uploadRes.url,
            caption: imageCaption || file.name,
          },
        );

        const image = dbRes.image as Record<string, unknown>;
        return {
          id: image.id as number,
          imageUrl:
            (image.imageUrl as string) ||
            (image.url as string) ||
            uploadRes.url,
          caption: (image.caption as string) || imageCaption || file.name,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      setVenueImages((prev) => [...prev, ...uploadedImages]);
      setImageCaption("");
      e.target.value = ""; // Reset input
      toast.success(`Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  // Helper: upload file via XHR with progress tracking
  const uploadFileWithProgress = (file: File, endpoint: string, target: string): Promise<{ url: string; filename: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const data = new FormData();
      data.append("file", file);

      setUploadProgress(0);
      setUploadingTarget(target);
      setIsUploading(true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      xhr.open("POST", `${apiUrl}${endpoint}`);
      xhr.setRequestHeader("Authorization", `Bearer ${getBackofficeToken()}`);
      xhr.send(data);
    });
  };

  const resetUploadState = () => {
    setIsUploading(false);
    setUploadingTarget(null);
    setUploadProgress(0);
  };

  // Handle Event Image Selection — store File + preview, upload on save
  const handleEventImageUpload = (file: File, type: "thumbnail" | "cover") => {
    const previewUrl = URL.createObjectURL(file);
    if (type === "thumbnail") {
      if (pendingThumbnail?.previewUrl) URL.revokeObjectURL(pendingThumbnail.previewUrl);
      setPendingThumbnail({ file, previewUrl });
      setFormData((prev) => ({ ...prev, imageUrl: previewUrl }));
    } else {
      if (pendingCover?.previewUrl) URL.revokeObjectURL(pendingCover.previewUrl);
      setPendingCover({ file, previewUrl });
      setFormData((prev) => ({ ...prev, coverImage: previewUrl }));
    }
    toast.success(`${type === "thumbnail" ? "Thumbnail" : "Cover"} image selected! It will be uploaded when you save.`);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file too large (max 50MB)");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (pendingVideo?.previewUrl) URL.revokeObjectURL(pendingVideo.previewUrl);
    setPendingVideo({ file, previewUrl });
    setFormData((prev) => ({ ...prev, videoUrl: previewUrl }));
    toast.success("Video selected! It will be uploaded when you save.");
    e.target.value = "";
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Document file too large (max 50MB)");
      return;
    }

    setPendingDocuments((prev) => [...prev, { file, name: file.name }]);
    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []), { name: file.name, url: "pending" }],
    }));
    toast.success("Document selected! It will be uploaded when you save.");
    e.target.value = "";
  };

  // Upload single file to /upload/event-media
  const uploadEventMediaFile = (
    file: File,
    eventCode: string,
    eventName: string,
    mediaType: string,
    sortOrder?: number,
  ): Promise<{ url: string; filename: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const data = new FormData();
      data.append("file", file);
      data.append("eventCode", eventCode);
      data.append("eventName", eventName);
      data.append("mediaType", mediaType);
      if (sortOrder !== undefined) data.append("sortOrder", String(sortOrder));

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid server response"));
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
      xhr.open("POST", `${apiUrl}/api/upload/event-media`);
      xhr.setRequestHeader("Authorization", `Bearer ${getBackofficeToken()}`);
      xhr.send(data);
    });
  };

  // Extract src from iframe string if present
  const extractMapUrl = (html: string) => {
    if (!html || !html.trim().startsWith("<iframe")) return html;
    const match = html.match(/src="([^"]+)"/);
    return match ? match[1] : html;
  };

  // Save event details
  const handleSaveDetails = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const token = getBackofficeToken();

      // Save event fields first (without blob URLs)
      const eventData: Record<string, unknown> = {
        eventCode: formData.eventCode,
        eventName: formData.eventName,
        description: formData.description || undefined,
        eventType: formData.eventType,
        location: formData.location || undefined,
        mapUrl: extractMapUrl(formData.mapUrl) || undefined,
        websiteUrl: formData.websiteUrl || undefined,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        maxCapacity: formData.maxCapacity,
        conferenceCode: formData.conferenceCode || undefined,
        cpeCredits: formData.cpeCredits || undefined,
        status: formData.status,
        imageUrl: formData.imageUrl === "" ? null : formData.imageUrl.startsWith("blob:") ? undefined : formData.imageUrl || undefined,
        coverImage: formData.coverImage === "" ? null : formData.coverImage.startsWith("blob:") ? undefined : formData.coverImage || undefined,
        videoUrl: formData.videoUrl === "" ? null : formData.videoUrl.startsWith("blob:") ? undefined : formData.videoUrl || undefined,
        documents: formData.documents.filter(d => d.url !== "pending").length > 0
          ? formData.documents.filter(d => d.url !== "pending")
          : undefined,
      };

      await api.backofficeEvents.update(token, parseInt(eventId), eventData);

      // Upload pending media files in parallel
      const hasPendingFiles = pendingThumbnail || pendingCover || pendingVideo || pendingDocuments.length > 0;
      if (hasPendingFiles) {
        setIsUploading(true);
        setUploadingTarget("media");

        const mediaUploads: Promise<{ type: string; url: string } | null>[] = [];
        const evCode = formData.eventCode;
        const evName = formData.eventName;

        if (pendingThumbnail) {
          mediaUploads.push(
            uploadEventMediaFile(pendingThumbnail.file, evCode, evName, "thumbnail")
              .then(r => ({ type: "thumbnail", url: r.url }))
              .catch(err => { console.error("Failed to upload thumbnail:", err); return null; })
          );
        }

        if (pendingCover) {
          mediaUploads.push(
            uploadEventMediaFile(pendingCover.file, evCode, evName, "cover_img")
              .then(r => ({ type: "cover_img", url: r.url }))
              .catch(err => { console.error("Failed to upload cover:", err); return null; })
          );
        }

        if (pendingVideo) {
          mediaUploads.push(
            uploadEventMediaFile(pendingVideo.file, evCode, evName, "cover_vdo")
              .then(r => ({ type: "cover_vdo", url: r.url }))
              .catch(err => { console.error("Failed to upload video:", err); return null; })
          );
        }

        for (const doc of pendingDocuments) {
          mediaUploads.push(
            uploadEventMediaFile(doc.file, evCode, evName, "document")
              .then(r => ({ type: "document", url: r.url, name: doc.name } as any))
              .catch(err => { console.error("Failed to upload document:", err); return null; })
          );
        }

        const mediaResults = await Promise.allSettled(mediaUploads);
        const resolved = mediaResults
          .filter((r): r is PromiseFulfilledResult<{ type: string; url: string } | null> => r.status === "fulfilled")
          .map(r => r.value)
          .filter((r): r is { type: string; url: string } => r !== null);

        // PATCH event with uploaded URLs
        const patchData: Record<string, unknown> = {};
        for (const result of resolved) {
          if (result.type === "thumbnail") patchData.imageUrl = result.url;
          if (result.type === "cover_img") patchData.coverImage = result.url;
          if (result.type === "cover_vdo") patchData.videoUrl = result.url;
        }

        const uploadedDocs = resolved.filter(r => r.type === "document") as any[];
        if (uploadedDocs.length > 0) {
          const existingDocs = (formData.documents || []).filter(d => d.url !== "pending");
          patchData.documents = [...existingDocs, ...uploadedDocs.map((d: any) => ({ name: d.name || "document", url: d.url }))];
        }

        if (Object.keys(patchData).length > 0) {
          await api.backofficeEvents.update(token, parseInt(eventId), patchData);
          // Update local formData with real URLs
          setFormData((prev) => ({
            ...prev,
            ...(patchData.imageUrl ? { imageUrl: patchData.imageUrl as string } : {}),
            ...(patchData.coverImage ? { coverImage: patchData.coverImage as string } : {}),
            ...(patchData.videoUrl ? { videoUrl: patchData.videoUrl as string } : {}),
            ...(patchData.documents ? { documents: patchData.documents as { name: string; url: string }[] } : {}),
          }));
        }

        // Clear pending states
        setPendingThumbnail(null);
        setPendingCover(null);
        setPendingVideo(null);
        setPendingDocuments([]);
        resetUploadState();
      }

      toast.success("Event details saved!");
    } catch (err: any) {
      setError(err.message || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderReadinessPanel = () => {
    if (!readiness.enabled) return null;

    return (
      <div
        className={`mb-6 rounded-xl border px-4 py-4 ${
          readiness.ready
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
              readiness.ready
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {readiness.ready ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />}
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-900">
              External Event Readiness
            </h4>
            {readiness.ready ? (
              <p className="mt-1 text-sm text-emerald-800">
                This event is ready for the external site handoff flow.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-amber-900">
                  Fix these items before linking an external site like
                  `newpharmacist` to this event.
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {readiness.warnings.map((warning) => (
                    <li key={warning.code}>- {warning.message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <AdminLayout title="Edit Event">
        <div className="flex items-center justify-center py-12">
          <IconLoader2 size={32} className="animate-spin text-blue-600" />
          <span className="ml-2 text-gray-500">Loading event...</span>
        </div>
      </AdminLayout>
    );
  }

  const tabs = [
    { id: "details", label: "Event Details", icon: IconCalendarEvent },
    ...(shouldShowSessions
      ? [{ id: "sessions", label: "Sessions", icon: IconLayoutGrid }]
      : []),
    { id: "tickets", label: "Tickets", icon: IconTicket },
    { id: "venue", label: "Venue/Images", icon: IconPhoto },
  ];

  return (
    <AdminLayout title={`Edit Event`}>
      {/* Back Button */}
      <div className="mb-4">
        <Link
          href="/events"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <IconArrowLeft size={18} /> Back to Events
        </Link>
      </div>

      {/* Prominent Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <IconCalendarEvent size={32} />
            </div>
            <div>
              <p className="text-blue-200 text-sm font-medium mb-1">
                {formData.eventCode}
              </p>
              <h1 className="text-2xl font-bold">
                {formData.eventName || "Untitled Event"}
              </h1>
              <p className="text-blue-200 text-sm mt-1">
                {formData.location || "No location set"} •{" "}
                {formData.conferenceCode && `CPE: ${formData.conferenceCode}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${formData.status === "published"
                ? "bg-green-500"
                : formData.status === "draft"
                  ? "bg-yellow-500"
                  : formData.status === "cancelled"
                    ? "bg-red-500"
                    : "bg-gray-500"
                }`}
            >
              {formData.status.charAt(0).toUpperCase() +
                formData.status.slice(1)}
            </span>
            <p className="text-blue-200 text-sm mt-2">
              {formData.startDate &&
                new Date(formData.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Asia/Bangkok",
                })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${activeTab === tab.id
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Event Details Tab */}
      {activeTab === "details" && (
        <div className="card">
          {renderReadinessPanel()}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Code *
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.eventCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    eventCode: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                className="input-field"
                value={formData.eventType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    eventType: e.target.value as any,
                  }))
                }
              >
                <option value="single_room">Single Room</option>
                <option value="multi_session">Multi Session</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Name *
            </label>
            <input
              type="text"
              className="input-field"
              value={formData.eventName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, eventName: e.target.value }))
              }
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="input-field h-24"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments / Documents
            </label>
            <div className="space-y-3">
              {(formData.documents || []).length > 0 && (
                <div className="grid gap-2">
                  {(formData.documents || []).map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <IconFileText size={18} />
                        </div>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate">
                          {doc.name}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          documents: prev.documents.filter((_, i) => i !== idx)
                        }))}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <IconTrash size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleDocumentUpload}
                  disabled={isUploading}
                />
                <label
                  htmlFor="document-upload"
                  className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploading ? "bg-gray-100 border-gray-300 opacity-70" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                >
                  <div className="flex flex-col items-center justify-center pb-6 pt-5">
                    {isUploading ? (
                      <IconLoader2 size={24} className="text-gray-400 mb-2 animate-spin" />
                    ) : (
                      <IconUpload size={24} className="text-gray-400 mb-2" />
                    )}
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> a document
                    </p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS or XLSX (Max 50MB)</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <DatePicker
                selected={
                  formData.startDate ? new Date(formData.startDate) : null
                }
                onChange={(date: Date | null) =>
                  setFormData((prev) => ({
                    ...prev,
                    startDate: date ? date.toISOString() : "",
                  }))
                }
                showTimeSelect
                dateFormat="d MMM yyyy, h:mm aa"
                className="input-field w-full"
                placeholderText="Select start date"
                wrapperClassName="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <DatePicker
                selected={formData.endDate ? new Date(formData.endDate) : null}
                onChange={(date: Date | null) =>
                  setFormData((prev) => ({
                    ...prev,
                    endDate: date ? date.toISOString() : "",
                  }))
                }
                showTimeSelect
                dateFormat="d MMM yyyy, h:mm aa"
                className="input-field w-full"
                placeholderText="Select end date"
                wrapperClassName="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.location}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, location: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://newpharmacist.example.com"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional metadata for events launched from an external site.
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Maps Embed Code (iframe)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder='<iframe src="https://www.google.com/maps/embed?..." ></iframe>'
              value={formData.mapUrl || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, mapUrl: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Capacity
              </label>
              <input
                type="number"
                min="0"
                className="input-field"
                value={formData.maxCapacity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    maxCapacity: parseInt(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-xs text-gray-400 mt-1">0 = Unlimited</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conference Code (CPE)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., ACCP2026"
                value={formData.conferenceCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    conferenceCode: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPE Credits
              </label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                value={formData.cpeCredits}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cpeCredits: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              className="input-field w-48"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  status: e.target.value as any,
                }))
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <hr className="my-6" />

          <div className="flex justify-end">
            <button
              onClick={handleSaveDetails}
              disabled={isSubmitting || isUploading}
              className="btn-primary flex items-center gap-2"
            >
              {isSubmitting ? (
                <IconLoader2 size={18} className="animate-spin" />
              ) : (
                <IconCheck size={18} />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && shouldShowSessions && (
        <div className="card">
          {renderReadinessPanel()}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Sessions</h3>
            <button
              onClick={() => {
                setSessionForm({
                  sessionCode: "",
                  sessionName: "",
                  sessionType: "other",
                  description: "",
                  room: "",
                  startTime: "",
                  endTime: "",
                  maxCapacity: 0,
                  selectedSpeakerIds: [],
                  isMainSession: false,
                });
                setEditingSessionId(null);
                setShowSessionModal(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <IconPlus size={18} /> Add Session
            </button>
          </div>

          {/* Main Sessions Section */}
          {sessions.some((s) => s.isMainSession) && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4 border-b pb-2 border-blue-100">
                <IconCheck size={20} className="text-blue-600" />
                <h4 className="text-lg font-bold text-gray-800">
                  Main Event Session(s)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="text-blue-900">Code</th>
                      <th className="text-blue-900">Session Name</th>
                      <th className="text-blue-900">Room</th>
                      <th className="text-blue-900">Time</th>
                      <th className="text-blue-900">Capacity</th>
                      <th className="w-24 text-blue-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-blue-50/30">
                    {sessions
                      .filter((s) => s.isMainSession)
                      .map((session) => (
                        <tr
                          key={session.id}
                          className="border-b border-blue-100 hover:bg-blue-50"
                        >
                          <td className="font-mono text-sm font-semibold text-blue-700">
                            {session.sessionCode}
                          </td>
                          <td className="font-medium text-gray-900">
                            {session.sessionName}
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-100 text-blue-700 tracking-wide">
                              Main
                            </span>
                          </td>
                          <td>{session.room || "-"}</td>
                          <td className="text-sm">
                            {formatDateTime(session.startTime)}
                          </td>
                          <td>{session.maxCapacity === 0 ? <span className="text-green-600 font-medium">Unlimited</span> : session.maxCapacity}</td>
                          <td className="flex gap-1">
                            <button
                              onClick={() => handleEditSession(session)}
                              className="p-1.5 hover:bg-blue-200 rounded text-blue-700"
                            >
                              <IconPencil size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Sessions Section */}
          <div className={sessions.some((s) => s.isMainSession) ? "pt-2" : ""}>
            <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-200">
              <IconLayoutGrid size={20} className="text-gray-500" />
              <h4 className="text-lg font-bold text-gray-800">
                Breakout Sessions & Workshops
              </h4>
            </div>
            {sessions.filter((s) => !s.isMainSession).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Session Name</th>
                      <th>Room</th>
                      <th>Time</th>
                      <th>Capacity</th>
                      <th className="w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions
                      .filter((s) => !s.isMainSession)
                      .map((session) => (
                        <tr key={session.id}>
                          <td className="font-mono text-sm">
                            {session.sessionCode}
                          </td>
                          <td>{session.sessionName}</td>
                          <td>{session.room || "-"}</td>
                          <td className="text-sm">
                            {formatDateTime(session.startTime)}
                          </td>
                          <td>{session.maxCapacity === 0 ? <span className="text-green-600 font-medium">Unlimited</span> : session.maxCapacity}</td>
                          <td className="flex gap-1">
                            <button
                              onClick={() => handleEditSession(session)}
                              className="p-1.5 hover:bg-blue-100 rounded"
                            >
                              <IconPencil size={18} className="text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id!)}
                              className="p-1.5 hover:bg-red-100 rounded"
                            >
                              <IconTrash size={18} className="text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                No breakout sessions yet. Click "Add Session" to create one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === "tickets" && (
        <div className="card">
          {renderReadinessPanel()}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Ticket Types</h3>
            <button
              onClick={() => setShowTicketModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <IconPlus size={18} /> Add Ticket
            </button>
          </div>

          {tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Quota</th>
                    <th>Order</th>
                    <th>Allowed Roles</th>
                    <th>Sale Period</th>
                    <th className="w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="font-medium">{ticket.name}</td>
                      <td>
                        <span
                          className={`badge ${ticket.category === "primary" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}
                        >
                          {ticket.category === "primary" ? "Primary" : "Add-on"}
                        </span>
                        {ticket.category === "primary" && (
                          <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <IconCheck size={12} /> Includes Main Session
                          </div>
                        )}
                        {ticket.category === "addon" &&
                          ticket.sessionIds &&
                          ticket.sessionIds.length > 0 && (
                            <div className="text-xs text-purple-600 mt-1">
                              {ticket.sessionIds.length === 1 ? (
                                <>
                                  →{" "}
                                  {sessions.find(
                                    (s) => s.id === ticket.sessionIds![0],
                                  )?.sessionName ||
                                    `Session #${ticket.sessionIds![0]}`}
                                </>
                              ) : (
                                <>
                                  → {ticket.sessionIds.length} sessions linked
                                </>
                              )}
                            </div>
                          )}
                      </td>
                      <td className="font-semibold">
                        {ticket.currency}{" "}
                        {Number(ticket.price).toLocaleString()}
                      </td>
                      <td>{ticket.quota === "0" || ticket.quota === "" ? <span className="text-green-600 font-medium">Unlimited</span> : ticket.quota}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ticket.priority === 'early_bird' ? 'bg-orange-100 text-orange-800' :
                          ticket.priority === 'regular' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {ticket.priority === 'early_bird' ? 'Early Bird' :
                            ticket.priority === 'regular' ? 'Regular' :
                              'Regular'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {ticket.allowedRoles?.length ? (
                            ticket.allowedRoles.map((role) => (
                              <span
                                key={role}
                                className={`text-xs px-1.5 py-0.5 rounded font-medium ${role === "pharmacist" ? "bg-green-100 text-green-800" :
                                  role === "medical_professional" ? "bg-indigo-100 text-indigo-800" :
                                    role === "student" ? "bg-blue-100 text-blue-800" :
                                      role === "general" ? "bg-gray-100 text-gray-800" :
                                        "bg-gray-100 text-gray-800"
                                  }`}
                              >
                                {role === "pharmacist" ? "PHARMACIST" : role === "medical_professional" ? "MED. PROF." : role === "student" ? "STUDENT" : role === "general" ? "GENERAL" : role.toUpperCase()}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">All</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-xs text-gray-500">
                          <div>{formatDateTime(ticket.saleStartDate)}</div>
                          <div>to {formatDateTime(ticket.saleEndDate)}</div>
                        </div>
                      </td>
                      <td className="flex gap-1">
                        <button
                          onClick={() => handleEditTicket(ticket)}
                          className="p-1.5 hover:bg-blue-100 rounded"
                        >
                          <IconPencil size={18} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteTicket(ticket.id!)}
                          className="p-1.5 hover:bg-red-100 rounded"
                        >
                          <IconTrash size={18} className="text-red-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No tickets yet. Click "Add Ticket" to create one.
            </div>
          )}
        </div>
      )}

      {/* Venue/Images Tab */}
      {activeTab === "venue" && (
        <div className="space-y-6">
          {renderReadinessPanel()}

          {/* Section 1: Thumbnail Image */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/3">
                <h3 className="text-lg font-medium text-gray-900 md:mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <IconPhoto size={18} />
                  </div>
                  Thumbnail Image
                </h3>
                <p className="text-sm text-gray-500 hidden md:block">
                  This image is used on event cards and listings on the homepage.
                  Recommended aspect ratio is 1:1 or 4:3.
                </p>
              </div>
              <div className="md:w-2/3">
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl relative overflow-hidden group bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="Thumbnail preview" className="max-h-48 object-contain" />
                      <button
                        type="button"
                        onClick={() => { if (pendingThumbnail?.previewUrl) URL.revokeObjectURL(pendingThumbnail.previewUrl); setPendingThumbnail(null); setFormData(prev => ({ ...prev, imageUrl: "" })); }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md z-10 transition-colors"
                        title="Remove thumbnail"
                      >
                        <IconX size={16} />
                      </button>
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <label className="cursor-pointer text-white flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full hover:bg-black/70 transition-colors">
                          <IconPlus size={20} />
                          <span>Change Thumbnail</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleEventImageUpload(e.target.files[0], "thumbnail")} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-gray-100">
                        <IconPhoto size={32} className="text-blue-400" />
                      </div>
                      <div className="flex text-sm text-gray-600 justify-center mt-4">
                        <label className="relative cursor-pointer bg-white px-4 py-2 border border-gray-200 rounded-lg font-medium text-blue-600 hover:bg-gray-50 hover:text-blue-500 transition-colors shadow-sm">
                          <span>Select an image file</span>
                          <input type="file" className="sr-only" accept="image/*" onChange={(e) => e.target.files?.[0] && handleEventImageUpload(e.target.files[0], "thumbnail")} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                  )}
                  {isUploading && uploadingTarget === "thumbnail" && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-20">
                      <div className="bg-white p-5 rounded-xl shadow-lg flex flex-col items-center w-52">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Uploading... {uploadProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Cover Image */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/3">
                <h3 className="text-lg font-medium text-gray-900 md:mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <IconPhoto size={18} />
                  </div>
                  Cover Image
                </h3>
                <p className="text-sm text-gray-500 hidden md:block">
                  This image appears as the large banner at the top of the event detail page.
                  Recommended aspect ratio is 16:9 for best display.
                </p>
              </div>
              <div className="md:w-2/3">
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl relative overflow-hidden group bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  {formData.coverImage ? (
                    <>
                      <img src={formData.coverImage} alt="Cover preview" className="max-h-48 object-cover w-full rounded" />
                      <button
                        type="button"
                        onClick={() => { if (pendingCover?.previewUrl) URL.revokeObjectURL(pendingCover.previewUrl); setPendingCover(null); setFormData(prev => ({ ...prev, coverImage: "" })); }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md z-10 transition-colors"
                        title="Remove cover image"
                      >
                        <IconX size={16} />
                      </button>
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <label className="cursor-pointer text-white flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full hover:bg-black/70 transition-colors">
                          <IconPlus size={20} />
                          <span>Change Cover</span>
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleEventImageUpload(e.target.files[0], "cover")} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-gray-100">
                        <IconPhoto size={32} className="text-indigo-400" />
                      </div>
                      <div className="flex text-sm text-gray-600 justify-center mt-4">
                        <label className="relative cursor-pointer bg-white px-4 py-2 border border-gray-200 rounded-lg font-medium text-indigo-600 hover:bg-gray-50 hover:text-indigo-500 transition-colors shadow-sm">
                          <span>Select an image file</span>
                          <input type="file" className="sr-only" accept="image/*" onChange={(e) => e.target.files?.[0] && handleEventImageUpload(e.target.files[0], "cover")} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG, WEBP up to 10MB</p>
                    </div>
                  )}
                  {isUploading && uploadingTarget === "cover" && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-20">
                      <div className="bg-white p-5 rounded-xl shadow-lg flex flex-col items-center w-52">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Uploading... {uploadProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cover Video Upload */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cover Video (MP4/WebM) - Optional
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl relative overflow-hidden group bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    {formData.videoUrl ? (
                      <>
                        <video src={formData.videoUrl} controls className="max-h-48 w-full rounded bg-black" />
                        <button
                          type="button"
                          onClick={() => { if (pendingVideo?.previewUrl) URL.revokeObjectURL(pendingVideo.previewUrl); setPendingVideo(null); setFormData(prev => ({ ...prev, videoUrl: "" })); }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md z-10 transition-colors"
                          title="Remove video"
                        >
                          <IconX size={16} />
                        </button>
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <label className="cursor-pointer text-white flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full hover:bg-black/70 transition-colors">
                            <IconPlus size={20} />
                            <span>Change Video</span>
                            <input type="file" className="hidden" accept="video/mp4,video/webm" onChange={handleVideoUpload} />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-gray-100">
                          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex text-sm text-gray-600 justify-center mt-4">
                          <label className={`relative cursor-pointer bg-white px-4 py-2 border border-gray-200 rounded-lg font-medium text-indigo-600 hover:bg-gray-50 hover:text-indigo-500 transition-colors shadow-sm ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                            <span>Select a video file</span>
                            <input type="file" className="sr-only" accept="video/mp4,video/webm" onChange={handleVideoUpload} disabled={isUploading} />
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">MP4 or WEBM up to 50MB</p>
                      </div>
                    )}

                    {isUploading && uploadingTarget === "video" && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-20">
                        <div className="bg-white p-5 rounded-xl shadow-lg flex flex-col items-center w-52">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-700">Uploading... {uploadProgress}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    If provided, this video will be played as the background on the event details page.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Venue Gallery */}
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex flex-col md:flex-row gap-8 mb-6">
              <div className="md:w-1/3">
                <h3 className="text-lg font-medium text-gray-900 md:mb-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                    <IconPhoto size={18} />
                  </div>
                  Venue Gallery
                </h3>
                <p className="text-sm text-gray-500 hidden md:block mb-4">
                  Add multiple photos to showcase the event venue, parking area, or previous events.
                </p>
              </div>
              <div className="md:w-2/3">
                <div className="bg-gray-50 p-5 border border-gray-200 rounded-xl shadow-inner">
                  <h4 className="font-semibold mb-3 text-gray-800 text-sm uppercase tracking-wider">Add Gallery Image</h4>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Caption (Optional)
                      </label>
                      <input
                        type="text"
                        className="input-field bg-white shadow-sm"
                        placeholder="e.g. Main Conference Hall"
                        value={imageCaption}
                        onChange={(e) => setImageCaption(e.target.value)}
                        disabled={isUploading}
                      />
                    </div>
                    <div className="w-full sm:w-auto">
                      <input
                        type="file"
                        id="venue-image-upload"
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      <label
                        htmlFor="venue-image-upload"
                        className={`btn-primary w-full sm:w-auto flex items-center justify-center gap-2 cursor-pointer shadow-sm ${isUploading ? "opacity-70 cursor-not-allowed" : ""}`}
                      >
                        {isUploading ? (
                          <>
                            <IconLoader2 size={18} className="animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <IconPlus size={18} />
                            Upload Image
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="pt-6 border-t border-gray-100">
              <h4 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
                Uploaded Images
                <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs font-semibold">
                  {venueImages.length}
                </span>
              </h4>

              {venueImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {venueImages.map((img) => (
                    <div
                      key={img.id}
                      className="group border border-gray-200 rounded-xl overflow-hidden relative shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                    >
                      <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                        <img
                          src={img.imageUrl}
                          alt={img.caption}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
                          {img.caption && (
                            <div className="text-white text-sm font-medium truncate drop-shadow-md mb-2">
                              {img.caption}
                            </div>
                          )}
                          <button
                            onClick={() => handleDeleteImage(img.id!)}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg text-sm flex items-center justify-center gap-1 w-full shadow-lg transition-colors border border-red-400"
                          >
                            <IconTrash size={16} /> <span className="font-medium">Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-gray-100 mb-3">
                    <IconPhoto size={28} className="text-green-400" />
                  </div>
                  <h5 className="text-gray-700 font-medium">No gallery images</h5>
                  <p className="text-sm text-gray-500 mt-1">Upload images to display them here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Save Button Row */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-end sticky bottom-4 z-10">
            <button
              onClick={handleSaveDetails}
              disabled={isSubmitting || isUploading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-base font-medium shadow-md hover:shadow-lg transition-all"
            >
              {isSubmitting ? (
                <>
                  <IconLoader2 size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <IconCheck size={20} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <IconTicket size={20} />{" "}
                  {editingTicketId ? "Edit Ticket" : "Add Ticket Type"}
                </h3>
                <button
                  onClick={() => {
                    setShowTicketModal(false);
                    setEditingTicketId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    className="input-field"
                    value={ticketForm.category}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        category: e.target.value as "primary" | "addon",
                      }))
                    }
                  >
                    <option value="primary">Primary</option>
                    <option value="addon">Add-on</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Audience (Role) *
                  </label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-gray-50">
                    {[
                      { value: "pharmacist", label: "Pharmacist" },
                      { value: "medical_professional", label: "Medical Professional" },
                      { value: "student", label: "Student" },
                      { value: "general", label: "General" },
                    ].map((role) => (
                      <label
                        key={role.value}
                        className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={(ticketForm.allowedRoles || []).includes(role.value)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setTicketForm((prev) => {
                              const currentRoles = prev.allowedRoles || [];
                              if (isChecked) {
                                return { ...prev, allowedRoles: [...currentRoles, role.value] };
                              } else {
                                return { ...prev, allowedRoles: currentRoles.filter(r => r !== role.value) };
                              }
                            });
                          }}
                        />
                        <span className="text-sm font-medium text-gray-700">{role.label}</span>
                      </label>
                    ))}
                  </div>
                  {(ticketForm.allowedRoles || []).length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Please select at least one target audience.</p>
                  )}
                </div>

                {/* Student Level Selection - only show when student role is selected */}
                {(ticketForm.allowedRoles || []).includes("student") && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student Level (optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Leave empty to allow all student levels, or select specific levels.
                    </p>
                    <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                      {[
                        { value: "postgraduate", label: "Postgraduate" },
                        { value: "undergraduate", label: "Undergraduate" },
                      ].map((level) => (
                        <label
                          key={level.value}
                          className="flex items-start gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={(ticketForm.allowedStudentLevels || []).includes(level.value)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setTicketForm((prev) => {
                                const currentLevels = prev.allowedStudentLevels || [];
                                if (isChecked) {
                                  return { ...prev, allowedStudentLevels: [...currentLevels, level.value] };
                                } else {
                                  return { ...prev, allowedStudentLevels: currentLevels.filter(l => l !== level.value) };
                                }
                              });
                            }}
                          />
                          <span className="text-sm font-medium text-gray-700">{level.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Ticket - Auto-linked Main Sessions */}
              {ticketForm.category === "primary" &&
                sessions.filter((s) => s.isMainSession).length > 0 && (
                  <div className="mb-4 bg-purple-50 p-3 rounded-md border border-purple-100">
                    <p className="text-sm font-medium text-purple-700 mb-2 flex items-center gap-1">
                      <IconCheck size={16} /> Automatically linked to Main
                      Session(s):
                    </p>
                    <div className="space-y-1">
                      {sessions
                        .filter((s) => s.isMainSession)
                        .map((session) => (
                          <div
                            key={session.id}
                            className="text-sm text-purple-600 pl-5"
                          >
                            • {session.sessionName}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* Session Selector - Only for Add-on tickets (Checkboxes) */}
              {ticketForm.category === "addon" && sessions.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Sessions/Workshops *
                  </label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {sessions
                      .filter((s) => !s.isMainSession)
                      .map((session) => (
                        <label
                          key={session.id}
                          className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={
                              ticketForm.sessionIds?.includes(session.id!) ||
                              false
                            }
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setTicketForm((prev) => {
                                const currentIds = prev.sessionIds || [];
                                if (isChecked) {
                                  return {
                                    ...prev,
                                    sessionIds: [...currentIds, session.id!],
                                  };
                                } else {
                                  return {
                                    ...prev,
                                    sessionIds: currentIds.filter(
                                      (id) => id !== session.id,
                                    ),
                                  };
                                }
                              });
                            }}
                          />
                          <div>
                            <div className="text-sm font-medium">
                              {session.sessionCode}
                            </div>
                            <div className="text-xs text-gray-500">
                              {session.sessionName}
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select one or more sessions for this add-on ticket
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quota *
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={ticketForm.quota}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        quota: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-400 mt-1">0 = Unlimited</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ticket Priority
                  </label>
                  <select
                    className="input-field"
                    value={ticketForm.priority}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    <option value="early_bird">Early Bird</option>
                    <option value="regular">Regular</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ticket Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Early Bird - Member"
                  value={ticketForm.name}
                  onChange={(e) =>
                    setTicketForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency *
                  </label>
                  <select
                    className="input-field"
                    value={ticketForm.currency}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        currency: e.target.value as "THB" | "USD",
                      }))
                    }
                  >
                    <option value="THB">THB (฿)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="3500"
                    value={ticketForm.price}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-field"
                    placeholder="Show as strikethrough price"
                    value={ticketForm.originalPrice}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        originalPrice: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <select
                    className="input-field"
                    value={ticketForm.groupName}
                    onChange={(e) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        groupName: e.target.value,
                      }))
                    }
                  >
                    <option value="">-- None --</option>
                    <option value="workshop">workshop</option>
                    <option value="gala">gala</option>
                    <option value="registration">registration</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Badge Text
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={ticketForm.badgeText}
                  onChange={(e) =>
                    setTicketForm((prev) => ({
                      ...prev,
                      badgeText: e.target.value,
                    }))
                  }
                  placeholder='e.g. "Early Bird", "Best Value"'
                  maxLength={50}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={ticketForm.description}
                  onChange={(e) =>
                    setTicketForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional ticket description"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Features
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="input-field flex-1"
                    value={ticketFeatureInput}
                    onChange={(e) => setTicketFeatureInput(e.target.value)}
                    placeholder="Add a feature..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && ticketFeatureInput.trim()) {
                        e.preventDefault();
                        setTicketForm((prev) => ({
                          ...prev,
                          features: [...(prev.features || []), ticketFeatureInput.trim()],
                        }));
                        setTicketFeatureInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-sm px-3"
                    onClick={() => {
                      if (ticketFeatureInput.trim()) {
                        setTicketForm((prev) => ({
                          ...prev,
                          features: [...(prev.features || []), ticketFeatureInput.trim()],
                        }));
                        setTicketFeatureInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {(ticketForm.features || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(ticketForm.features || []).map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() =>
                            setTicketForm((prev) => ({
                              ...prev,
                              features: (prev.features || []).filter((_, idx) => idx !== i),
                            }))
                          }
                          className="text-gray-400 hover:text-red-500"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Start Date & Time
                  </label>
                  <DatePicker
                    selected={
                      ticketForm.saleStartDate
                        ? new Date(ticketForm.saleStartDate)
                        : null
                    }
                    onChange={(date: Date | null) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        saleStartDate: date ? date.toISOString() : "",
                      }))
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select start date"
                    wrapperClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale End Date & Time
                  </label>
                  <DatePicker
                    selected={
                      ticketForm.saleEndDate
                        ? new Date(ticketForm.saleEndDate)
                        : null
                    }
                    onChange={(date: Date | null) =>
                      setTicketForm((prev) => ({
                        ...prev,
                        saleEndDate: date ? date.toISOString() : "",
                      }))
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select end date"
                    wrapperClassName="w-full"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTicketModal(false);
                  setEditingTicketId(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTicket}
                className="btn-primary flex items-center gap-2"
              >
                <IconCheck size={18} />{" "}
                {editingTicketId ? "Update Ticket" : "Add Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {editingSessionId ? "Edit Session" : "Create Session"}
                </h3>
                <button
                  onClick={() => {
                    setShowSessionModal(false);
                    setEditingSessionId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IconX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Main Session Checkbox - Logic: Show ONLY if it IS Main, OR if No Main exists */}
              {(sessionForm.isMainSession ||
                !sessions.some(
                  (s) => s.isMainSession && s.id !== editingSessionId,
                )) && (
                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 bg-blue-50/50 border-blue-100/50">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        checked={sessionForm.isMainSession || false}
                        onChange={(e) =>
                          setSessionForm((prev) => ({
                            ...prev,
                            isMainSession: e.target.checked,
                          }))
                        }
                        disabled={sessionForm.isMainSession} // Lock if checked
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          Main session
                          {sessionForm.isMainSession && (
                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              Default (Locked)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Main sessions appear prominently and are auto-linked to
                          Primary tickets.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

              {/* Session Code & Session Name */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Code *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="S-001"
                    value={sessionForm.sessionCode}
                    onChange={(e) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        sessionCode: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter session name"
                    value={sessionForm.sessionName}
                    onChange={(e) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        sessionName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Session Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Type *
                </label>
                <select
                  className="input-field"
                  value={sessionForm.sessionType}
                  onChange={(e) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      sessionType: e.target.value as any,
                    }))
                  }
                >
                  <option value="workshop">Workshop</option>
                  <option value="gala_dinner">Gala Dinner</option>
                  <option value="lecture">Lecture</option>
                  <option value="ceremony">Ceremony</option>
                  <option value="break">Break</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Start Time & End Time */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time *
                  </label>
                  <DatePicker
                    selected={
                      sessionForm.startTime
                        ? new Date(sessionForm.startTime)
                        : null
                    }
                    onChange={(date: Date | null) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        startTime: date ? date.toISOString() : "",
                      }))
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select start time"
                    wrapperClassName="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time *
                  </label>
                  <DatePicker
                    selected={
                      sessionForm.endTime ? new Date(sessionForm.endTime) : null
                    }
                    onChange={(date: Date | null) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        endTime: date ? date.toISOString() : "",
                      }))
                    }
                    showTimeSelect
                    dateFormat="d MMM yyyy, h:mm aa"
                    className="input-field w-full"
                    placeholderText="Select end time"
                    wrapperClassName="w-full"
                  />
                </div>
              </div>

              {/* Room & Max Capacity */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Meeting Room 1"
                    value={sessionForm.room}
                    onChange={(e) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        room: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    min="0"
                    placeholder="0"
                    value={sessionForm.maxCapacity}
                    onChange={(e) =>
                      setSessionForm((prev) => ({
                        ...prev,
                        maxCapacity: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-400 mt-1">0 = Unlimited</p>
                </div>
              </div>

              {/* Time & Agenda */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <IconClock size={16} /> Time & Agenda
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Add agenda items with time slots (e.g. &quot;1:30 – 2:00 PM&quot; and topic).
                </p>
                {(sessionForm.agenda || []).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 mb-2">
                    <input
                      type="text"
                      className="input-field w-40"
                      placeholder="1:30 – 2:00 PM"
                      value={item.time}
                      onChange={(e) => {
                        const updated = [...(sessionForm.agenda || [])];
                        updated[idx] = { ...updated[idx], time: e.target.value };
                        setSessionForm((prev) => ({ ...prev, agenda: updated }));
                      }}
                    />
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Topic description"
                      value={item.topic}
                      onChange={(e) => {
                        const updated = [...(sessionForm.agenda || [])];
                        updated[idx] = { ...updated[idx], topic: e.target.value };
                        setSessionForm((prev) => ({ ...prev, agenda: updated }));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (sessionForm.agenda || []).filter((_, i) => i !== idx);
                        setSessionForm((prev) => ({ ...prev, agenda: updated }));
                      }}
                      className="text-red-400 hover:text-red-600 mt-2"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSessionForm((prev) => ({
                      ...prev,
                      agenda: [...(prev.agenda || []), { time: "", topic: "" }],
                    }));
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                >
                  <IconPlus size={14} /> Add agenda item
                </button>
              </div>

              {/* Instructor(s) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <IconMicrophone size={16} /> Instructor(s)
                </label>
                <div className="border border-gray-300 rounded-md bg-white">
                  {speakers.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto p-2">
                      {speakers.map((speaker) => (
                        <label
                          key={speaker.id}
                          className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={sessionForm.selectedSpeakerIds?.includes(
                              speaker.id,
                            )}
                            onChange={(e) => {
                              const id = speaker.id;
                              setSessionForm((prev) => ({
                                ...prev,
                                selectedSpeakerIds: e.target.checked
                                  ? [...(prev.selectedSpeakerIds || []), id]
                                  : (prev.selectedSpeakerIds || []).filter(
                                    (sid) => sid !== id,
                                  ),
                              }));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>
                            {speaker.firstName} {speaker.lastName}
                          </span>
                          {speaker.organization && (
                            <span className="text-xs text-gray-500">
                              ({speaker.organization})
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-gray-500">
                      No instructors available
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {sessionForm.selectedSpeakerIds?.length || 0}{" "}
                  Instructor(s)
                </p>
              </div>

              {/* Learning Objectives */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <IconTarget size={16} /> Learning Objectives
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Describe the learning objectives for this session..."
                  value={sessionForm.description}
                  onChange={(e) =>
                    setSessionForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setEditingSessionId(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleAddSession} className="btn-primary">
                {editingSessionId ? "Update Session" : "Create Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
