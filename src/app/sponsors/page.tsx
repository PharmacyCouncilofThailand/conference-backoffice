"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { AdminLayout } from "@/components/layout";
import { Pagination } from "@/components/common";
import { api } from "@/lib/api";
import type {
  Pagination as PaginationType,
  SponsorApplication,
  SponsorApplicationStatus,
  SponsorBenefit,
  SponsorMediaAsset,
  SponsorMediaType,
  SponsorPackage,
  SponsorPackageType,
  SponsorPage,
  SponsorPaymentStatus,
  SponsorStat,
  SponsorTimelineItem,
} from "@/types/api";
import toast from "react-hot-toast";
import {
  IconBriefcase,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconEye,
  IconFileText,
  IconLayoutGrid,
  IconLoader2,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconTicket,
  IconTrash,
  IconUpload,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";

type TabKey = "overview" | "profile" | "packages" | "content" | "media" | "applications";

interface EventOption {
  id: number;
  eventCode: string;
  eventName: string;
}

interface ProfileForm {
  aboutTitle: string;
  aboutDescription: string;
  organizerLogoUrl: string;
  brochureUrl: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  isPublished: boolean;
}

interface PackageForm {
  id?: number;
  packageType: SponsorPackageType;
  code: string;
  optionLabel: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  quota: string;
  badgeText: string;
  themeKey: string;
  isRecommended: boolean;
  sortOrder: string;
  isActive: boolean;
  featuresText: string;
  componentIds: number[];
}

interface StatForm {
  id?: number;
  valueText: string;
  label: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

interface BenefitForm {
  id?: number;
  title: string;
  description: string;
  iconKey: string;
  sortOrder: string;
  isActive: boolean;
}

interface TimelineForm {
  id?: number;
  periodLabel: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  isHighlight: boolean;
  sortOrder: string;
  isActive: boolean;
}

interface MediaForm {
  id?: number;
  mediaType: SponsorMediaType;
  title: string;
  caption: string;
  fileUrl: string;
  sortOrder: string;
  isActive: boolean;
  file: File | null;
}

const getBackofficeToken = () =>
  localStorage.getItem("backoffice_token") ||
  sessionStorage.getItem("backoffice_token") ||
  "";

const emptyProfile: ProfileForm = {
  aboutTitle: "",
  aboutDescription: "",
  organizerLogoUrl: "",
  brochureUrl: "",
  registrationOpenAt: "",
  registrationCloseAt: "",
  isPublished: false,
};

const emptyPackage: PackageForm = {
  packageType: "booth",
  code: "",
  optionLabel: "",
  name: "",
  description: "",
  price: "0",
  currency: "THB",
  quota: "0",
  badgeText: "",
  themeKey: "",
  isRecommended: false,
  sortOrder: "0",
  isActive: true,
  featuresText: "",
  componentIds: [],
};

const emptyStat: StatForm = {
  valueText: "",
  label: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

const emptyBenefit: BenefitForm = {
  title: "",
  description: "",
  iconKey: "",
  sortOrder: "0",
  isActive: true,
};

const emptyTimeline: TimelineForm = {
  periodLabel: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  isHighlight: false,
  sortOrder: "0",
  isActive: true,
};

const emptyMedia: MediaForm = {
  mediaType: "past_sponsor_logo",
  title: "",
  caption: "",
  fileUrl: "",
  sortOrder: "0",
  isActive: true,
  file: null,
};

const packageTypeLabels: Record<SponsorPackageType, string> = {
  booth: "Booth",
  symposium: "Symposium",
  bundle: "Bundle",
};

const mediaTypeLabels: Record<SponsorMediaType, string> = {
  past_sponsor_logo: "Past sponsor logos",
  previous_year_impression: "Previous year impressions",
  brochure: "Brochures",
  other: "Other page assets",
};

const applicationStatusClasses: Record<SponsorApplicationStatus, string> = {
  submitted: "badge-info",
  under_review: "badge-warning",
  approved: "badge-success",
  rejected: "badge-error",
  cancelled: "bg-zinc-100 text-zinc-500",
};

const paymentStatusClasses: Record<SponsorPaymentStatus, string> = {
  pending_review: "badge-warning",
  verified: "badge-success",
  rejected: "badge-error",
};

function getPackageAvailability(pkg: SponsorPackage) {
  const quota = pkg.availabilitySource === "components"
    ? pkg.effectiveQuota
    : pkg.quota;
  const reserved = pkg.reservedCount || 0;
  const isUnlimited = quota === null || quota === undefined || quota <= 0;
  const progress = isUnlimited ? 0 : Math.min((reserved / quota) * 100, 100);

  return {
    quota,
    reserved,
    progress,
    label: isUnlimited ? `${reserved}/∞` : `${reserved}/${quota}`,
    sourceLabel: pkg.availabilitySource === "components" ? "Derived from components" : "Package quota",
  };
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toDatePickerValue(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fromDatePickerValue(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return toLocalInput(date.toISOString());
}

function formatMoney(value?: string | number | null, currency = "THB") {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function getAllPackages(sponsorPage: SponsorPage | null) {
  if (!sponsorPage) return [];
  return [
    ...sponsorPage.packages.booth,
    ...sponsorPage.packages.symposium,
    ...sponsorPage.packages.bundle,
  ];
}

function getAllMedia(sponsorPage: SponsorPage | null) {
  if (!sponsorPage) return [];
  return [
    ...sponsorPage.media.pastSponsors,
    ...sponsorPage.media.previousYearImpressions,
    ...sponsorPage.media.brochures,
    ...sponsorPage.media.other,
  ];
}

export default function SponsorsPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [sponsorPage, setSponsorPage] = useState<SponsorPage | null>(null);
  const [applications, setApplications] = useState<SponsorApplication[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [appSearch, setAppSearch] = useState("");
  const [appStatus, setAppStatus] = useState<SponsorApplicationStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<SponsorPaymentStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingOrganizerLogo, setIsUploadingOrganizerLogo] = useState(false);

  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackage);
  const [statModalOpen, setStatModalOpen] = useState(false);
  const [statForm, setStatForm] = useState<StatForm>(emptyStat);
  const [benefitModalOpen, setBenefitModalOpen] = useState(false);
  const [benefitForm, setBenefitForm] = useState<BenefitForm>(emptyBenefit);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineForm, setTimelineForm] = useState<TimelineForm>(emptyTimeline);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaForm, setMediaForm] = useState<MediaForm>(emptyMedia);
  const [selectedApplication, setSelectedApplication] = useState<SponsorApplication | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const allPackages = useMemo(() => getAllPackages(sponsorPage), [sponsorPage]);
  const nonBundlePackages = useMemo(
    () => allPackages.filter((pkg) => pkg.packageType !== "bundle"),
    [allPackages],
  );
  const allMedia = useMemo(() => getAllMedia(sponsorPage), [sponsorPage]);

  const metrics = useMemo(() => {
    const totalPackageValue = allPackages.reduce((sum, pkg) => sum + Number(pkg.price || 0), 0);
    const approvedApplications = applications.filter((app) => app.applicationStatus === "approved").length;
    const verifiedPayments = applications.filter((app) => app.paymentStatus === "verified").length;
    return {
      packages: allPackages.length,
      totalPackageValue,
      approvedApplications,
      verifiedPayments,
      media: allMedia.length,
    };
  }, [allMedia.length, allPackages, applications]);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchSponsorPage();
      fetchApplications(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, appStatus, paymentStatus]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const token = getBackofficeToken();
      const response = await api.backofficeEvents.list(token, "limit=1000");
      const mapped = (response.events || []).map((event) => ({
        id: Number(event.id),
        eventCode: String(event.eventCode || ""),
        eventName: String(event.eventName || ""),
      }));
      setEvents(mapped);
      if (!selectedEventId && mapped.length > 0) {
        setSelectedEventId(mapped[0].id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSponsorPage = async () => {
    if (!selectedEventId) return;
    try {
      const token = getBackofficeToken();
      const response = await api.sponsors.getPage(token, selectedEventId);
      setSponsorPage(response.sponsor);
      const profile = response.sponsor?.profile;
      setProfileForm({
        aboutTitle: profile?.aboutTitle || "",
        aboutDescription: profile?.aboutDescription || "",
        organizerLogoUrl: profile?.organizerLogoUrl || "",
        brochureUrl: profile?.brochureUrl || "",
        registrationOpenAt: toLocalInput(profile?.registrationOpenAt),
        registrationCloseAt: toLocalInput(profile?.registrationCloseAt),
        isPublished: profile?.isPublished || false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load sponsor setup");
    }
  };

  const fetchApplications = async (nextPage = pagination.page) => {
    if (!selectedEventId) return;
    try {
      const token = getBackofficeToken();
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(pagination.limit),
        eventId: String(selectedEventId),
      });
      if (appSearch.trim()) params.set("search", appSearch.trim());
      if (appStatus) params.set("status", appStatus);
      if (paymentStatus) params.set("paymentStatus", paymentStatus);
      const response = await api.sponsors.listApplications(token, params.toString());
      setApplications(response.applications);
      setPagination(response.pagination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load sponsor applications");
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedEventId) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      await api.sponsors.updateProfile(token, selectedEventId, {
        ...profileForm,
        registrationOpenAt: toIso(profileForm.registrationOpenAt),
        registrationCloseAt: toIso(profileForm.registrationCloseAt),
      });
      toast.success("Sponsor profile saved");
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadOrganizerLogo = async (file: File) => {
    if (!selectedEventId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Organizer logo must be an image file");
      return;
    }

    setIsUploadingOrganizerLogo(true);
    try {
      const token = getBackofficeToken();
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.sponsors.uploadOrganizerLogo(token, selectedEventId, formData);
      setProfileForm((prev) => ({ ...prev, organizerLogoUrl: result.organizerLogoUrl }));
      toast.success("Organizer logo uploaded");
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload organizer logo");
    } finally {
      setIsUploadingOrganizerLogo(false);
    }
  };

  const openPackageModal = (pkg?: SponsorPackage) => {
    if (pkg) {
      setPackageForm({
        id: pkg.id,
        packageType: pkg.packageType,
        code: pkg.code,
        optionLabel: pkg.optionLabel || "",
        name: pkg.name,
        description: pkg.description || "",
        price: String(pkg.price || "0"),
        currency: pkg.currency || "THB",
        quota: pkg.packageType === "bundle" ? "0" : String(pkg.quota || 0),
        badgeText: pkg.badgeText || "",
        themeKey: pkg.themeKey || "",
        isRecommended: pkg.isRecommended,
        sortOrder: String(pkg.sortOrder || 0),
        isActive: pkg.isActive,
        featuresText: (pkg.features || []).map((feature) => feature.featureText).join("\n"),
        componentIds: (pkg.components || []).map((component) => component.componentPackageId),
      });
    } else {
      setPackageForm(emptyPackage);
    }
    setPackageModalOpen(true);
  };

  const savePackage = async () => {
    if (!selectedEventId || !packageForm.name || !packageForm.code) {
      toast.error("Package code and name are required");
      return;
    }
    const selectedComponentIds = Array.from(new Set(packageForm.componentIds)).filter(
      (componentId) => nonBundlePackages.some((pkg) => pkg.id === componentId && pkg.id !== packageForm.id),
    );
    if (packageForm.packageType === "bundle" && selectedComponentIds.length < 2) {
      toast.error("Bundle requires at least 2 Booth/Symposium packages");
      return;
    }
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const features = packageForm.featuresText
        .split("\n")
        .map((feature) => feature.trim())
        .filter(Boolean)
        .map((featureText, index) => ({ featureText, sortOrder: index }));
      const payload = {
        packageType: packageForm.packageType,
        code: packageForm.code.trim(),
        optionLabel: packageForm.optionLabel || undefined,
        name: packageForm.name.trim(),
        description: packageForm.description || undefined,
        price: Number(packageForm.price || 0),
        currency: packageForm.currency || "THB",
        quota: packageForm.packageType === "bundle" ? 0 : Number(packageForm.quota || 0),
        badgeText: packageForm.badgeText || undefined,
        themeKey: packageForm.themeKey || undefined,
        isRecommended: packageForm.isRecommended,
        sortOrder: Number(packageForm.sortOrder || 0),
        isActive: packageForm.isActive,
        features,
        components: packageForm.packageType === "bundle"
          ? selectedComponentIds.map((componentPackageId) => ({
            componentPackageId,
            componentRole: allPackages.find((pkg) => pkg.id === componentPackageId)?.packageType,
          }))
          : undefined,
      };

      if (packageForm.id) {
        await api.sponsors.updatePackage(token, packageForm.id, payload);
      } else {
        await api.sponsors.createPackage(token, selectedEventId, payload);
      }

      toast.success(packageForm.id ? "Package updated" : "Package created");
      setPackageModalOpen(false);
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save package");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePackage = async (pkg: SponsorPackage) => {
    if (!window.confirm(`Delete ${pkg.name}?`)) return;
    try {
      const token = getBackofficeToken();
      await api.sponsors.deletePackage(token, pkg.id);
      toast.success("Package deleted");
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete package");
    }
  };

  const openStatModal = (stat?: SponsorStat) => {
    setStatForm(stat ? {
      id: stat.id,
      valueText: stat.valueText,
      label: stat.label,
      description: stat.description || "",
      sortOrder: String(stat.sortOrder || 0),
      isActive: stat.isActive,
    } : emptyStat);
    setStatModalOpen(true);
  };

  const saveStat = async () => {
    if (!selectedEventId || !statForm.valueText || !statForm.label) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const payload = {
        valueText: statForm.valueText,
        label: statForm.label,
        description: statForm.description || undefined,
        sortOrder: Number(statForm.sortOrder || 0),
        isActive: statForm.isActive,
      };
      if (statForm.id) await api.sponsors.updateStat(token, statForm.id, payload);
      else await api.sponsors.createStat(token, selectedEventId, payload);
      toast.success("Stat saved");
      setStatModalOpen(false);
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save stat");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteStat = async (stat: SponsorStat) => {
    if (!window.confirm(`Delete stat ${stat.label}?`)) return;
    const token = getBackofficeToken();
    await api.sponsors.deleteStat(token, stat.id);
    toast.success("Stat deleted");
    fetchSponsorPage();
  };

  const openBenefitModal = (benefit?: SponsorBenefit) => {
    setBenefitForm(benefit ? {
      id: benefit.id,
      title: benefit.title,
      description: benefit.description || "",
      iconKey: benefit.iconKey || "",
      sortOrder: String(benefit.sortOrder || 0),
      isActive: benefit.isActive,
    } : emptyBenefit);
    setBenefitModalOpen(true);
  };

  const saveBenefit = async () => {
    if (!selectedEventId || !benefitForm.title) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const payload = {
        title: benefitForm.title,
        description: benefitForm.description || undefined,
        iconKey: benefitForm.iconKey || undefined,
        sortOrder: Number(benefitForm.sortOrder || 0),
        isActive: benefitForm.isActive,
      };
      if (benefitForm.id) await api.sponsors.updateBenefit(token, benefitForm.id, payload);
      else await api.sponsors.createBenefit(token, selectedEventId, payload);
      toast.success("Benefit saved");
      setBenefitModalOpen(false);
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save benefit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteBenefit = async (benefit: SponsorBenefit) => {
    if (!window.confirm(`Delete ${benefit.title}?`)) return;
    const token = getBackofficeToken();
    await api.sponsors.deleteBenefit(token, benefit.id);
    toast.success("Benefit deleted");
    fetchSponsorPage();
  };

  const openTimelineModal = (timelineItem?: SponsorTimelineItem) => {
    setTimelineForm(timelineItem ? {
      id: timelineItem.id,
      periodLabel: timelineItem.periodLabel,
      title: timelineItem.title,
      description: timelineItem.description || "",
      startDate: toLocalInput(timelineItem.startDate),
      endDate: toLocalInput(timelineItem.endDate),
      isHighlight: timelineItem.isHighlight,
      sortOrder: String(timelineItem.sortOrder || 0),
      isActive: timelineItem.isActive,
    } : emptyTimeline);
    setTimelineModalOpen(true);
  };

  const saveTimelineItem = async () => {
    if (!selectedEventId || !timelineForm.periodLabel || !timelineForm.title) return;
    setIsSubmitting(true);
    try {
      const token = getBackofficeToken();
      const payload = {
        periodLabel: timelineForm.periodLabel,
        title: timelineForm.title,
        description: timelineForm.description || undefined,
        startDate: toIso(timelineForm.startDate),
        endDate: toIso(timelineForm.endDate),
        isHighlight: timelineForm.isHighlight,
        sortOrder: Number(timelineForm.sortOrder || 0),
        isActive: timelineForm.isActive,
      };
      if (timelineForm.id) await api.sponsors.updateTimelineItem(token, timelineForm.id, payload);
      else await api.sponsors.createTimelineItem(token, selectedEventId, payload);
      toast.success("Timeline item saved");
      setTimelineModalOpen(false);
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save timeline item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTimelineItem = async (timelineItem: SponsorTimelineItem) => {
    if (!window.confirm(`Delete ${timelineItem.title}?`)) return;
    const token = getBackofficeToken();
    await api.sponsors.deleteTimelineItem(token, timelineItem.id);
    toast.success("Timeline item deleted");
    fetchSponsorPage();
  };

  const openMediaModal = (media?: SponsorMediaAsset) => {
    setMediaForm(media ? {
      id: media.id,
      mediaType: media.mediaType,
      title: media.title || "",
      caption: media.caption || "",
      fileUrl: media.fileUrl,
      sortOrder: String(media.sortOrder || 0),
      isActive: media.isActive,
      file: null,
    } : emptyMedia);
    setMediaModalOpen(true);
  };

  const saveMedia = async () => {
    if (!selectedEventId) return;
    setIsUploading(true);
    try {
      const token = getBackofficeToken();
      if (mediaForm.file) {
        const formData = new FormData();
        formData.append("file", mediaForm.file);
        formData.append("mediaType", mediaForm.mediaType);
        formData.append("title", mediaForm.title);
        formData.append("caption", mediaForm.caption);
        formData.append("sortOrder", mediaForm.sortOrder || "0");
        formData.append("isActive", String(mediaForm.isActive));
        await api.sponsors.uploadMedia(token, selectedEventId, formData);
      } else if (mediaForm.id) {
        await api.sponsors.updateMedia(token, mediaForm.id, {
          mediaType: mediaForm.mediaType,
          title: mediaForm.title || undefined,
          caption: mediaForm.caption || undefined,
          fileUrl: mediaForm.fileUrl,
          sortOrder: Number(mediaForm.sortOrder || 0),
          isActive: mediaForm.isActive,
        });
      } else {
        await api.sponsors.createMedia(token, selectedEventId, {
          mediaType: mediaForm.mediaType,
          title: mediaForm.title || undefined,
          caption: mediaForm.caption || undefined,
          fileUrl: mediaForm.fileUrl,
          sortOrder: Number(mediaForm.sortOrder || 0),
          isActive: mediaForm.isActive,
        });
      }
      toast.success("Page asset saved");
      setMediaModalOpen(false);
      fetchSponsorPage();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save page asset");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteMedia = async (media: SponsorMediaAsset) => {
    if (!window.confirm("Delete this sponsor page asset?")) return;
    const token = getBackofficeToken();
    await api.sponsors.deleteMedia(token, media.id);
    toast.success("Page asset deleted");
    fetchSponsorPage();
  };

  const loadApplicationDetail = async (applicationId: number) => {
    try {
      const token = getBackofficeToken();
      const response = await api.sponsors.getApplication(token, applicationId);
      setSelectedApplication(response.application);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load application");
    }
  };

  const updateApplicationStatus = async (application: SponsorApplication, status: SponsorApplicationStatus) => {
    const rejectionReason = status === "rejected" ? window.prompt("Reason for rejection") || "" : undefined;
    if (status === "rejected" && !rejectionReason) return;
    try {
      const token = getBackofficeToken();
      await api.sponsors.updateApplicationStatus(token, application.id, {
        status,
        rejectionReason,
      });
      toast.success("Application status updated");
      fetchApplications();
      if (selectedApplication?.id === application.id) loadApplicationDetail(application.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const updatePaymentStatus = async (application: SponsorApplication, nextStatus: SponsorPaymentStatus) => {
    try {
      const token = getBackofficeToken();
      await api.sponsors.updatePaymentStatus(token, application.id, {
        paymentStatus: nextStatus,
      });
      toast.success("Payment status updated");
      fetchApplications();
      if (selectedApplication?.id === application.id) loadApplicationDetail(application.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payment status");
    }
  };

  const tabs: { key: TabKey; label: string; icon: typeof IconBriefcase }[] = [
    { key: "overview", label: "Overview", icon: IconLayoutGrid },
    { key: "profile", label: "Profile", icon: IconFileText },
    { key: "packages", label: "Packages", icon: IconTicket },
    { key: "content", label: "Content", icon: IconClock },
    { key: "media", label: "Page Assets", icon: IconPhoto },
    { key: "applications", label: "Applications", icon: IconUsersGroup },
  ];

  return (
    <AdminLayout title="Sponsor Hub">
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <IconCalendarEvent size={20} className="text-emerald-600" />
            <select
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value ? Number(event.target.value) : "")}
              className="bg-transparent text-sm font-semibold text-zinc-800 outline-none"
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.eventCode} - {event.eventName}
                </option>
              ))}
            </select>
          </div>
          {selectedEvent && (
            <div className="text-sm text-zinc-500">
              Managing sponsor setup for <span className="font-semibold text-zinc-800">{selectedEvent.eventName}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary gap-2"
          onClick={() => {
            fetchSponsorPage();
            fetchApplications();
          }}
          disabled={!selectedEventId}
        >
          <IconLoader2 size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5 mb-6">
        <MetricCard icon={IconBriefcase} label="Packages" value={metrics.packages} tone="emerald" />
        <MetricCard icon={IconCreditCard} label="Package Value" value={formatMoney(metrics.totalPackageValue)} tone="sky" />
        <MetricCard icon={IconCheck} label="Approved" value={metrics.approvedApplications} tone="green" />
        <MetricCard icon={IconUsersGroup} label="Verified Payments" value={metrics.verifiedPayments} tone="amber" />
        <MetricCard icon={IconPhoto} label="Page Assets" value={metrics.media} tone="zinc" />
      </div>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon size={17} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="card flex items-center justify-center py-16 text-zinc-500">
          <IconLoader2 size={28} className="animate-spin text-emerald-600" />
          <span className="ml-3">Loading sponsor workspace...</span>
        </div>
      ) : !selectedEventId ? (
        <div className="card py-16 text-center text-zinc-500">
          Select an event to manage sponsor content.
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab
              sponsorPage={sponsorPage}
              applications={applications}
              onOpenPackage={() => openPackageModal()}
              onOpenMedia={() => openMediaModal()}
              onOpenProfile={() => setActiveTab("profile")}
            />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              form={profileForm}
              setForm={setProfileForm}
              isSubmitting={isSubmitting}
              isUploadingOrganizerLogo={isUploadingOrganizerLogo}
              onSave={handleSaveProfile}
              onUploadOrganizerLogo={handleUploadOrganizerLogo}
            />
          )}

          {activeTab === "packages" && (
            <PackagesTab
              packages={allPackages}
              onCreate={() => openPackageModal()}
              onEdit={openPackageModal}
              onDelete={deletePackage}
            />
          )}

          {activeTab === "content" && (
            <ContentTab
              stats={sponsorPage?.stats || []}
              benefits={sponsorPage?.benefits || []}
              timeline={sponsorPage?.timeline || []}
              onAddStat={() => openStatModal()}
              onEditStat={openStatModal}
              onDeleteStat={deleteStat}
              onAddBenefit={() => openBenefitModal()}
              onEditBenefit={openBenefitModal}
              onDeleteBenefit={deleteBenefit}
              onAddTimeline={() => openTimelineModal()}
              onEditTimeline={openTimelineModal}
              onDeleteTimeline={deleteTimelineItem}
            />
          )}

          {activeTab === "media" && (
            <MediaTab
              media={allMedia}
              onCreate={() => openMediaModal()}
              onEdit={openMediaModal}
              onDelete={deleteMedia}
            />
          )}

          {activeTab === "applications" && (
            <ApplicationsTab
              applications={applications}
              pagination={pagination}
              search={appSearch}
              setSearch={setAppSearch}
              status={appStatus}
              setStatus={setAppStatus}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              onSearch={() => fetchApplications(1)}
              onPageChange={fetchApplications}
              onView={loadApplicationDetail}
              onUpdateStatus={updateApplicationStatus}
              onUpdatePayment={updatePaymentStatus}
            />
          )}
        </>
      )}

      {packageModalOpen && (
        <PackageModal
          form={packageForm}
          setForm={setPackageForm}
          nonBundlePackages={nonBundlePackages}
          isSubmitting={isSubmitting}
          onClose={() => setPackageModalOpen(false)}
          onSave={savePackage}
        />
      )}

      {statModalOpen && (
        <StatModal
          form={statForm}
          setForm={setStatForm}
          isSubmitting={isSubmitting}
          onClose={() => setStatModalOpen(false)}
          onSave={saveStat}
        />
      )}

      {benefitModalOpen && (
        <BenefitModal
          form={benefitForm}
          setForm={setBenefitForm}
          isSubmitting={isSubmitting}
          onClose={() => setBenefitModalOpen(false)}
          onSave={saveBenefit}
        />
      )}

      {timelineModalOpen && (
        <TimelineModal
          form={timelineForm}
          setForm={setTimelineForm}
          isSubmitting={isSubmitting}
          onClose={() => setTimelineModalOpen(false)}
          onSave={saveTimelineItem}
        />
      )}

      {mediaModalOpen && (
        <MediaModal
          form={mediaForm}
          setForm={setMediaForm}
          isSubmitting={isUploading}
          onClose={() => setMediaModalOpen(false)}
          onSave={saveMedia}
        />
      )}

      {selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onUpdateStatus={updateApplicationStatus}
          onUpdatePayment={updatePaymentStatus}
        />
      )}
    </AdminLayout>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof IconBriefcase;
  label: string;
  value: string | number;
  tone: "emerald" | "sky" | "green" | "amber" | "zinc";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    zinc: "bg-zinc-100 text-zinc-500",
  }[tone];

  return (
    <div className="card py-4">
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={22} stroke={1.5} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-zinc-900">{value}</p>
          <p className="text-xs font-medium text-zinc-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  sponsorPage,
  applications,
  onOpenPackage,
  onOpenMedia,
  onOpenProfile,
}: {
  sponsorPage: SponsorPage | null;
  applications: SponsorApplication[];
  onOpenPackage: () => void;
  onOpenMedia: () => void;
  onOpenProfile: () => void;
}) {
  const allPackages = getAllPackages(sponsorPage);
  const pending = applications.filter((app) => app.applicationStatus === "submitted" || app.applicationStatus === "under_review");
  const pageIsPublished = sponsorPage?.profile?.isPublished;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="card">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Sponsor console</p>
            <h2 className="mt-1 text-xl font-bold text-zinc-900">{sponsorPage?.event.eventName || "Selected event"}</h2>
            <p className="mt-1 text-sm text-zinc-500">Backoffice workspace for sponsor landing content and sponsor application review.</p>
          </div>
          <span className={`badge ${pageIsPublished ? "badge-success" : "badge-warning"}`}>
            {pageIsPublished ? "Published" : "Draft"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button type="button" onClick={onOpenProfile} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
            <IconFileText className="mb-3 text-emerald-600" size={24} />
            <p className="font-semibold text-zinc-900">Edit profile</p>
            <p className="mt-1 text-sm text-zinc-500">About section, brochure link, registration window.</p>
          </button>
          <button type="button" onClick={onOpenPackage} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
            <IconTicket className="mb-3 text-emerald-600" size={24} />
            <p className="font-semibold text-zinc-900">Add package</p>
            <p className="mt-1 text-sm text-zinc-500">Booth, symposium, and bundle packages.</p>
          </button>
          <button type="button" onClick={onOpenMedia} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50">
            <IconPhoto className="mb-3 text-emerald-600" size={24} />
            <p className="font-semibold text-zinc-900">Upload page assets</p>
            <p className="mt-1 text-sm text-zinc-500">Past sponsor logos, impressions, and brochures shown on the sponsor page.</p>
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Package</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Quota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {allPackages.slice(0, 6).map((pkg) => {
                const availability = getPackageAvailability(pkg);
                return (
                  <tr key={pkg.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{pkg.name}</td>
                    <td className="px-4 py-3 text-zinc-500">{packageTypeLabels[pkg.packageType]}</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-800">{formatMoney(pkg.price, pkg.currency)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{availability.label}</td>
                  </tr>
                );
              })}
              {allPackages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">No sponsor packages yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Application queue</h3>
          <span className="badge badge-info">{pending.length} pending</span>
        </div>
        <div className="space-y-3">
          {pending.slice(0, 6).map((application) => (
            <div key={application.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{application.companyName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{application.applicationNo}</p>
                </div>
                <span className={`badge ${applicationStatusClasses[application.applicationStatus]}`}>{application.applicationStatus.replace("_", " ")}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-800">{formatMoney(application.totalAmount, application.currency)}</p>
              <p className="mt-1 text-xs text-zinc-400">{formatDate(application.createdAt)}</p>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              No pending sponsor applications.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileTab({
  form,
  setForm,
  isSubmitting,
  isUploadingOrganizerLogo,
  onSave,
  onUploadOrganizerLogo,
}: {
  form: ProfileForm;
  setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  isSubmitting: boolean;
  isUploadingOrganizerLogo: boolean;
  onSave: () => void;
  onUploadOrganizerLogo: (file: File) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <section className="card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Sponsor page profile</h2>
            <p className="mt-1 text-sm text-zinc-500">Page copy, brochure link, publication state, and registration window.</p>
          </div>
          <button type="button" className="btn-primary gap-2" disabled={isSubmitting} onClick={onSave}>
            {isSubmitting ? <IconLoader2 size={18} className="animate-spin" /> : <IconCheck size={18} />}
            Save
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600">About title</span>
            <input className="input-field" value={form.aboutTitle} onChange={(event) => setForm((prev) => ({ ...prev, aboutTitle: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600">About description</span>
            <textarea className="input-field min-h-32" value={form.aboutDescription} onChange={(event) => setForm((prev) => ({ ...prev, aboutDescription: event.target.value }))} />
          </label>
          <div className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600">Organizer logo</span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className="input-field flex-1" value={form.organizerLogoUrl} onChange={(event) => setForm((prev) => ({ ...prev, organizerLogoUrl: event.target.value }))} placeholder="Google Drive URL or https://..." />
              <label className={`btn-secondary min-w-36 justify-center gap-2 ${isUploadingOrganizerLogo ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
                {isUploadingOrganizerLogo ? <IconLoader2 size={18} className="animate-spin" /> : <IconUpload size={18} />}
                Upload
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={isUploadingOrganizerLogo}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) onUploadOrganizerLogo(file);
                  }}
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-zinc-400">Upload stores the file in Google Drive and fills this URL automatically.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600">Brochure URL</span>
            <input className="input-field" value={form.brochureUrl} onChange={(event) => setForm((prev) => ({ ...prev, brochureUrl: event.target.value }))} placeholder="https://..." />
          </label>
        </div>
      </section>

      <aside>
        <section className="card">
          <h3 className="mb-4 font-semibold text-zinc-900">Publication</h3>
          <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Organizer logo preview</p>
            {form.organizerLogoUrl ? (
              <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <Image src={form.organizerLogoUrl} alt="Organizer logo preview" fill className="object-contain p-2" sizes="96px" />
              </div>
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-400">
                No organizer logo
              </div>
            )}
          </div>
          <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
            <span className="text-sm font-medium text-zinc-700">Published</span>
            <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))} />
          </label>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <DateTimePickerField
              label="Registration opens"
              value={form.registrationOpenAt}
              onChange={(value) => setForm((prev) => ({ ...prev, registrationOpenAt: value }))}
              placeholder="Select opening date and time"
            />
            <DateTimePickerField
              label="Registration closes"
              value={form.registrationCloseAt}
              onChange={(value) => setForm((prev) => ({ ...prev, registrationCloseAt: value }))}
              placeholder="Select closing date and time"
            />
          </div>
        </section>

      </aside>
    </div>
  );
}

function PackagesTab({
  packages,
  onCreate,
  onEdit,
  onDelete,
}: {
  packages: SponsorPackage[];
  onCreate: () => void;
  onEdit: (pkg: SponsorPackage) => void;
  onDelete: (pkg: SponsorPackage) => void;
}) {
  return (
    <section className="card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Sponsor packages</h2>
          <p className="mt-1 text-sm text-zinc-500">Manage Booth, Symposium, and Bundle options with price and quota.</p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={onCreate}>
          <IconPlus size={18} />
          Add package
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => {
          const availability = getPackageAvailability(pkg);
          return (
            <article key={pkg.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">{packageTypeLabels[pkg.packageType]}</span>
                    {pkg.isRecommended && <span className="badge badge-warning">Recommended</span>}
                    {pkg.availabilitySource === "components" && <span className="badge bg-blue-50 text-blue-600">Derived quota</span>}
                    {!pkg.isActive && <span className="badge bg-zinc-100 text-zinc-500">Inactive</span>}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-zinc-900">{pkg.name}</h3>
                  <p className="mt-1 text-xs font-mono text-zinc-400">{pkg.code}</p>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-yellow-50 hover:text-yellow-600" onClick={() => onEdit(pkg)} title="Edit package">
                    <IconPencil size={18} />
                  </button>
                  <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(pkg)} title="Delete package">
                    <IconTrash size={18} />
                  </button>
                </div>
              </div>
              <div className="mb-4 flex items-end justify-between gap-3">
                <p className="text-2xl font-bold text-zinc-900">{formatMoney(pkg.price, pkg.currency)}</p>
                <div className="text-right">
                  <p className="text-sm text-zinc-500">{availability.label} reserved</p>
                  {pkg.availabilitySource === "components" && (
                    <p className="mt-1 text-xs text-blue-600">Uses the lowest remaining component quota</p>
                  )}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${availability.progress}%` }}
                />
              </div>
              {(pkg.components || []).length > 0 && (
                <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Components: {(pkg.components || []).map((component) => component.package?.name || component.componentPackageId).join(", ")}
                </div>
              )}
              {(pkg.features || []).length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                  {(pkg.features || []).slice(0, 4).map((feature, index) => (
                    <li key={`${pkg.id}-${index}`} className="flex gap-2">
                      <IconCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{feature.featureText}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
        {packages.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 py-16 text-center text-zinc-400">
            No sponsor packages yet.
          </div>
        )}
      </div>
    </section>
  );
}

function ContentTab(props: {
  stats: SponsorStat[];
  benefits: SponsorBenefit[];
  timeline: SponsorTimelineItem[];
  onAddStat: () => void;
  onEditStat: (stat: SponsorStat) => void;
  onDeleteStat: (stat: SponsorStat) => void;
  onAddBenefit: () => void;
  onEditBenefit: (benefit: SponsorBenefit) => void;
  onDeleteBenefit: (benefit: SponsorBenefit) => void;
  onAddTimeline: () => void;
  onEditTimeline: (timelineItem: SponsorTimelineItem) => void;
  onDeleteTimeline: (timelineItem: SponsorTimelineItem) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <EditableList
        title="Stats"
        description="Flexible numbers for the sponsor landing page."
        icon={IconLayoutGrid}
        onAdd={props.onAddStat}
        emptyText="No stats yet."
      >
        {props.stats.map((stat) => (
          <ListRow
            key={stat.id}
            title={`${stat.valueText} ${stat.label}`}
            subtitle={stat.description || "No description"}
            isActive={stat.isActive}
            onEdit={() => props.onEditStat(stat)}
            onDelete={() => props.onDeleteStat(stat)}
          />
        ))}
      </EditableList>

      <EditableList
        title="Benefits"
        description="Accordion-style sponsor benefits."
        icon={IconBriefcase}
        onAdd={props.onAddBenefit}
        emptyText="No benefits yet."
      >
        {props.benefits.map((benefit) => (
          <ListRow
            key={benefit.id}
            title={benefit.title}
            subtitle={benefit.description || "No description"}
            isActive={benefit.isActive}
            onEdit={() => props.onEditBenefit(benefit)}
            onDelete={() => props.onDeleteBenefit(benefit)}
          />
        ))}
      </EditableList>

      <section className="card xl:col-span-2">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Timeline</h2>
            <p className="mt-1 text-sm text-zinc-500">Sponsor registration milestones and event days.</p>
          </div>
          <button type="button" className="btn-primary gap-2" onClick={props.onAddTimeline}>
            <IconPlus size={18} />
            Add item
          </button>
        </div>
        <div className="space-y-3">
          {props.timeline.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className={`mt-1 h-3 w-3 rounded-full ${item.isHighlight ? "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.12)]" : "bg-zinc-300"}`} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{item.periodLabel}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{item.description || "No description"}</p>
                </div>
              </div>
              <RowActions onEdit={() => props.onEditTimeline(item)} onDelete={() => props.onDeleteTimeline(item)} />
            </div>
          ))}
          {props.timeline.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-zinc-400">No timeline items yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function EditableList({
  title,
  description,
  icon: Icon,
  onAdd,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  icon: typeof IconBriefcase;
  onAdd: () => void;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="card">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Icon size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            <p className="text-sm text-zinc-500">{description}</p>
          </div>
        </div>
        <button type="button" className="btn-secondary gap-2" onClick={onAdd}>
          <IconPlus size={16} />
          Add
        </button>
      </div>
      <div className="space-y-3">
        {hasItems ? children : <div className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">{emptyText}</div>}
      </div>
    </section>
  );
}

function ListRow({
  title,
  subtitle,
  isActive,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 p-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold text-zinc-900">{title}</p>
          {!isActive && <span className="badge bg-zinc-100 text-zinc-500">Inactive</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-yellow-50 hover:text-yellow-600" onClick={onEdit} title="Edit">
        <IconPencil size={18} />
      </button>
      <button type="button" className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600" onClick={onDelete} title="Delete">
        <IconTrash size={18} />
      </button>
    </div>
  );
}

function MediaTab({
  media,
  onCreate,
  onEdit,
  onDelete,
}: {
  media: SponsorMediaAsset[];
  onCreate: () => void;
  onEdit: (media: SponsorMediaAsset) => void;
  onDelete: (media: SponsorMediaAsset) => void;
}) {
  return (
    <section className="card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Sponsor page assets</h2>
          <p className="mt-1 text-sm text-zinc-500">Drive-backed assets managed by staff for the sponsor page. Sponsor-submitted slips and logos live under Applications.</p>
        </div>
        <button type="button" className="btn-primary gap-2" onClick={onCreate}>
          <IconUpload size={18} />
          Add asset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {media.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="relative aspect-[4/3] bg-zinc-100">
              {item.mimeType?.startsWith("image/") || item.fileUrl.includes("/api/files/") ? (
                <Image src={item.fileUrl} alt={item.title || item.fileName || "Sponsor page asset"} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  <IconFileText size={42} />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">{mediaTypeLabels[item.mediaType]}</span>
                {!item.isActive && <span className="badge bg-zinc-100 text-zinc-500">Inactive</span>}
              </div>
              <p className="line-clamp-1 font-semibold text-zinc-900">{item.title || item.fileName || "Untitled asset"}</p>
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.caption || item.fileUrl}</p>
              <div className="mt-4 flex items-center justify-between">
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Open</a>
                <RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
              </div>
            </div>
          </article>
        ))}
        {media.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 py-16 text-center text-zinc-400">
            No sponsor page assets yet.
          </div>
        )}
      </div>
    </section>
  );
}

function ApplicationsTab({
  applications,
  pagination,
  search,
  setSearch,
  status,
  setStatus,
  paymentStatus,
  setPaymentStatus,
  onSearch,
  onPageChange,
  onView,
  onUpdateStatus,
  onUpdatePayment,
}: {
  applications: SponsorApplication[];
  pagination: PaginationType;
  search: string;
  setSearch: (value: string) => void;
  status: SponsorApplicationStatus | "";
  setStatus: (value: SponsorApplicationStatus | "") => void;
  paymentStatus: SponsorPaymentStatus | "";
  setPaymentStatus: (value: SponsorPaymentStatus | "") => void;
  onSearch: () => void;
  onPageChange: (page: number) => void;
  onView: (id: number) => void;
  onUpdateStatus: (application: SponsorApplication, status: SponsorApplicationStatus) => void;
  onUpdatePayment: (application: SponsorApplication, status: SponsorPaymentStatus) => void;
}) {
  return (
    <section className="card">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Sponsor applications</h2>
          <p className="mt-1 text-sm text-zinc-500">Review company details, payment slips, billing data, and logo assets.</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              className="input-field-search md:w-72"
              placeholder="Search company, email, application..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onSearch()}
            />
          </div>
          <select className="input-field md:w-44" value={status} onChange={(event) => setStatus(event.target.value as SponsorApplicationStatus | "")}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="input-field md:w-44" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as SponsorPaymentStatus | "")}>
            <option value="">All payments</option>
            <option value="pending_review">Pending review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="button" className="btn-secondary" onClick={onSearch}>Search</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Application</th>
              <th className="px-4 py-3 text-center">Payment</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {applications.map((application) => (
              <tr key={application.id} className="hover:bg-zinc-50">
                <td className="px-4 py-4">
                  <p className="font-semibold text-zinc-900">{application.companyName}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">{application.applicationNo}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-zinc-700">{application.contactFullName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{application.businessEmail}</p>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-zinc-900">{formatMoney(application.totalAmount, application.currency)}</td>
                <td className="px-4 py-4 text-center">
                  <span className={`badge ${applicationStatusClasses[application.applicationStatus]}`}>{application.applicationStatus.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`badge ${paymentStatusClasses[application.paymentStatus]}`}>{application.paymentStatus.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-center gap-1">
                    <button className="rounded-lg p-2 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => onView(application.id)} title="View application">
                      <IconEye size={18} />
                    </button>
                    <button className="rounded-lg p-2 text-zinc-400 hover:bg-green-50 hover:text-green-600" onClick={() => onUpdateStatus(application, "approved")} title="Approve">
                      <IconCheck size={18} />
                    </button>
                    <button className="rounded-lg p-2 text-zinc-400 hover:bg-sky-50 hover:text-sky-600" onClick={() => onUpdatePayment(application, "verified")} title="Verify payment">
                      <IconCreditCard size={18} />
                    </button>
                    <button className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600" onClick={() => onUpdateStatus(application, "rejected")} title="Reject">
                      <IconX size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-zinc-400">No sponsor applications found.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.total}
          pageSize={pagination.limit}
          onPageChange={onPageChange}
          onPageSizeChange={() => undefined}
          itemName="applications"
        />
      </div>
    </section>
  );
}

function PackageModal({
  form,
  setForm,
  nonBundlePackages,
  isSubmitting,
  onClose,
  onSave,
}: {
  form: PackageForm;
  setForm: React.Dispatch<React.SetStateAction<PackageForm>>;
  nonBundlePackages: SponsorPackage[];
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const availableComponentPackages = nonBundlePackages.filter((pkg) => pkg.id !== form.id);
  const canBuildBundle = availableComponentPackages.length >= 2;

  return (
    <Modal title={form.id ? "Edit sponsor package" : "Create sponsor package"} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Type"
          value={form.packageType}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              packageType: value as SponsorPackageType,
              componentIds: value === "bundle" ? prev.componentIds : [],
            }))
          }
        >
          <option value="booth">Booth</option>
          <option value="symposium">Symposium</option>
          <option value="bundle" disabled={!canBuildBundle && form.packageType !== "bundle"}>Bundle</option>
        </SelectField>
        <InputField label="Code" value={form.code} onChange={(value) => setForm((prev) => ({ ...prev, code: value }))} placeholder="BOOTH-PREMIUM" />
        <InputField label="Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Premium Booth" />
        <InputField label="Option label" value={form.optionLabel} onChange={(value) => setForm((prev) => ({ ...prev, optionLabel: value }))} placeholder="Option 2" />
        <InputField label="Price" type="number" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} />
        {form.packageType === "bundle" ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Bundle quota is derived from the selected component packages. The lowest remaining Booth/Symposium quota controls availability.
          </div>
        ) : (
          <InputField label="Quota" type="number" value={form.quota} onChange={(value) => setForm((prev) => ({ ...prev, quota: value }))} />
        )}
        <InputField label="Currency" value={form.currency} onChange={(value) => setForm((prev) => ({ ...prev, currency: value.toUpperCase().slice(0, 3) }))} />
        <InputField label="Sort order" type="number" value={form.sortOrder} onChange={(value) => setForm((prev) => ({ ...prev, sortOrder: value }))} />
        <InputField label="Badge text" value={form.badgeText} onChange={(value) => setForm((prev) => ({ ...prev, badgeText: value }))} />
        <InputField label="Theme key" value={form.themeKey} onChange={(value) => setForm((prev) => ({ ...prev, themeKey: value }))} placeholder="gold, teal, purple" />
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-zinc-600">Description</span>
        <textarea className="input-field min-h-24" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-zinc-600">Features, one per line</span>
        <textarea className="input-field min-h-32" value={form.featuresText} onChange={(event) => setForm((prev) => ({ ...prev, featuresText: event.target.value }))} />
      </label>
      {form.packageType === "bundle" && (
        <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-800">Bundle components</p>
          <p className="mb-3 mt-1 text-xs text-zinc-500">Select at least 2 Booth/Symposium packages from this event.</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {availableComponentPackages.map((pkg) => (
              <label key={pkg.id} className="flex items-start gap-2 rounded-xl border border-zinc-100 p-3 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={form.componentIds.includes(pkg.id)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      componentIds: event.target.checked
                        ? [...prev.componentIds, pkg.id]
                        : prev.componentIds.filter((id) => id !== pkg.id),
                    }))
                  }
                />
                <span>{pkg.name} <span className="text-zinc-400">({packageTypeLabels[pkg.packageType]})</span></span>
              </label>
            ))}
            {availableComponentPackages.length < 2 && (
              <div className="col-span-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Create at least 2 Booth/Symposium packages before creating a bundle.
              </div>
            )}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-4">
        <CheckboxField label="Recommended" checked={form.isRecommended} onChange={(checked) => setForm((prev) => ({ ...prev, isRecommended: checked }))} />
        <CheckboxField label="Active" checked={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
      </div>
      <ModalActions isSubmitting={isSubmitting} onClose={onClose} onSave={onSave} saveLabel={form.id ? "Save package" : "Create package"} />
    </Modal>
  );
}

function StatModal(props: {
  form: StatForm;
  setForm: React.Dispatch<React.SetStateAction<StatForm>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={props.form.id ? "Edit stat" : "Create stat"} onClose={props.onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InputField label="Value" value={props.form.valueText} onChange={(value) => props.setForm((prev) => ({ ...prev, valueText: value }))} placeholder="5,000+" />
        <InputField label="Label" value={props.form.label} onChange={(value) => props.setForm((prev) => ({ ...prev, label: value }))} placeholder="Attendees" />
        <InputField label="Sort order" type="number" value={props.form.sortOrder} onChange={(value) => props.setForm((prev) => ({ ...prev, sortOrder: value }))} />
      </div>
      <TextAreaField label="Description" value={props.form.description} onChange={(value) => props.setForm((prev) => ({ ...prev, description: value }))} />
      <CheckboxField label="Active" checked={props.form.isActive} onChange={(checked) => props.setForm((prev) => ({ ...prev, isActive: checked }))} />
      <ModalActions isSubmitting={props.isSubmitting} onClose={props.onClose} onSave={props.onSave} saveLabel="Save stat" />
    </Modal>
  );
}

function BenefitModal(props: {
  form: BenefitForm;
  setForm: React.Dispatch<React.SetStateAction<BenefitForm>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={props.form.id ? "Edit benefit" : "Create benefit"} onClose={props.onClose}>
      <InputField label="Title" value={props.form.title} onChange={(value) => props.setForm((prev) => ({ ...prev, title: value }))} />
      <InputField label="Icon key" value={props.form.iconKey} onChange={(value) => props.setForm((prev) => ({ ...prev, iconKey: value }))} placeholder="briefcase, chart, network" />
      <InputField label="Sort order" type="number" value={props.form.sortOrder} onChange={(value) => props.setForm((prev) => ({ ...prev, sortOrder: value }))} />
      <TextAreaField label="Description" value={props.form.description} onChange={(value) => props.setForm((prev) => ({ ...prev, description: value }))} />
      <CheckboxField label="Active" checked={props.form.isActive} onChange={(checked) => props.setForm((prev) => ({ ...prev, isActive: checked }))} />
      <ModalActions isSubmitting={props.isSubmitting} onClose={props.onClose} onSave={props.onSave} saveLabel="Save benefit" />
    </Modal>
  );
}

function TimelineModal(props: {
  form: TimelineForm;
  setForm: React.Dispatch<React.SetStateAction<TimelineForm>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={props.form.id ? "Edit timeline item" : "Create timeline item"} onClose={props.onClose}>
      <InputField label="Period label" value={props.form.periodLabel} onChange={(value) => props.setForm((prev) => ({ ...prev, periodLabel: value }))} placeholder="SEP 2026" />
      <InputField label="Title" value={props.form.title} onChange={(value) => props.setForm((prev) => ({ ...prev, title: value }))} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DateTimePickerField
          label="Start date"
          value={props.form.startDate}
          onChange={(value) => props.setForm((prev) => ({ ...prev, startDate: value }))}
          placeholder="Select start"
        />
        <DateTimePickerField
          label="End date"
          value={props.form.endDate}
          onChange={(value) => props.setForm((prev) => ({ ...prev, endDate: value }))}
          placeholder="Select end"
        />
        <InputField label="Sort order" type="number" value={props.form.sortOrder} onChange={(value) => props.setForm((prev) => ({ ...prev, sortOrder: value }))} />
      </div>
      <TextAreaField label="Description" value={props.form.description} onChange={(value) => props.setForm((prev) => ({ ...prev, description: value }))} />
      <div className="flex flex-wrap gap-4">
        <CheckboxField label="Highlight" checked={props.form.isHighlight} onChange={(checked) => props.setForm((prev) => ({ ...prev, isHighlight: checked }))} />
        <CheckboxField label="Active" checked={props.form.isActive} onChange={(checked) => props.setForm((prev) => ({ ...prev, isActive: checked }))} />
      </div>
      <ModalActions isSubmitting={props.isSubmitting} onClose={props.onClose} onSave={props.onSave} saveLabel="Save timeline" />
    </Modal>
  );
}

function MediaModal(props: {
  form: MediaForm;
  setForm: React.Dispatch<React.SetStateAction<MediaForm>>;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={props.form.id ? "Edit page asset" : "Add page asset"} onClose={props.onClose}>
      <SelectField label="Asset type" value={props.form.mediaType} onChange={(value) => props.setForm((prev) => ({ ...prev, mediaType: value as SponsorMediaType }))}>
        <option value="past_sponsor_logo">Past sponsor logo</option>
        <option value="previous_year_impression">Previous year impression</option>
        <option value="brochure">Brochure</option>
        <option value="other">Other</option>
      </SelectField>
      <InputField label="Title" value={props.form.title} onChange={(value) => props.setForm((prev) => ({ ...prev, title: value }))} />
      <TextAreaField label="Caption" value={props.form.caption} onChange={(value) => props.setForm((prev) => ({ ...prev, caption: value }))} />
      <InputField label="Sort order" type="number" value={props.form.sortOrder} onChange={(value) => props.setForm((prev) => ({ ...prev, sortOrder: value }))} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-zinc-600">Upload file</span>
        <input
          type="file"
          className="input-field"
          accept={props.form.mediaType === "brochure" ? "image/*,.pdf,.doc,.docx" : "image/*"}
          onChange={(event) => props.setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
        />
      </label>
      <InputField label="Or existing file URL" value={props.form.fileUrl} onChange={(value) => props.setForm((prev) => ({ ...prev, fileUrl: value }))} placeholder="https://..." />
      <CheckboxField label="Active" checked={props.form.isActive} onChange={(checked) => props.setForm((prev) => ({ ...prev, isActive: checked }))} />
      <ModalActions isSubmitting={props.isSubmitting} onClose={props.onClose} onSave={props.onSave} saveLabel="Save asset" />
    </Modal>
  );
}

function ApplicationDetailModal({
  application,
  onClose,
  onUpdateStatus,
  onUpdatePayment,
}: {
  application: SponsorApplication;
  onClose: () => void;
  onUpdateStatus: (application: SponsorApplication, status: SponsorApplicationStatus) => void;
  onUpdatePayment: (application: SponsorApplication, status: SponsorPaymentStatus) => void;
}) {
  return (
    <Modal title={application.companyName} onClose={onClose} maxWidth="max-w-4xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 p-4">
          <h3 className="mb-3 font-semibold text-zinc-900">Company contact</h3>
          <InfoRow label="Application" value={application.applicationNo} />
          <InfoRow label="Contact" value={application.contactFullName} />
          <InfoRow label="Email" value={application.businessEmail} />
          <InfoRow label="Phone" value={application.phone} />
          <InfoRow label="Created" value={formatDate(application.createdAt)} />
        </section>
        <section className="rounded-2xl border border-zinc-200 p-4">
          <h3 className="mb-3 font-semibold text-zinc-900">Billing</h3>
          <InfoRow label="Receipt name" value={application.billingName} />
          <InfoRow label="Tax ID" value={application.taxId} />
          <InfoRow label="Address" value={application.billingAddress} />
          <InfoRow label="Total" value={formatMoney(application.totalAmount, application.currency)} />
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 p-4">
        <h3 className="mb-3 font-semibold text-zinc-900">Selected packages</h3>
        <div className="space-y-2">
          {(application.items || []).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm">
              <span className="font-medium text-zinc-900">{item.packageNameSnapshot}</span>
              <span className="text-zinc-500">{item.quantity} x {formatMoney(item.priceSnapshot, application.currency)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocumentLink label="Payment slip" url={application.paymentSlipUrl} fileName={application.paymentSlipFileName} />
        <DocumentLink label="Logo" url={application.logoUrl} fileName={application.logoFileName} />
      </section>

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
        <button className="btn-secondary" onClick={() => onUpdateStatus(application, "under_review")}>Mark review</button>
        <button className="btn-secondary" onClick={() => onUpdatePayment(application, "rejected")}>Reject payment</button>
        <button className="btn-secondary" onClick={() => onUpdateStatus(application, "rejected")}>Reject</button>
        <button className="btn-primary" onClick={() => onUpdatePayment(application, "verified")}>Verify payment</button>
        <button className="btn-primary" onClick={() => onUpdateStatus(application, "approved")}>Approve</button>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-zinc-100 py-2 text-sm last:border-0">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-800">{value || "-"}</span>
    </div>
  );
}

function DocumentLink({ label, url, fileName }: { label: string; url?: string | null; fileName?: string | null }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <p className="text-sm font-semibold text-zinc-900">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
          <IconFileText size={16} />
          {fileName || "Open file"}
        </a>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">No file</p>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 p-6">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <IconX size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  isSubmitting,
  onClose,
  onSave,
  saveLabel,
}: {
  isSubmitting: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-zinc-100 pt-5">
      <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </button>
      <button type="button" className="btn-primary gap-2" onClick={onSave} disabled={isSubmitting}>
        {isSubmitting && <IconLoader2 size={18} className="animate-spin" />}
        {saveLabel}
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <input type={type} className="input-field" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DateTimePickerField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <DatePicker
        selected={toDatePickerValue(value)}
        onChange={(date: Date | null) => onChange(fromDatePickerValue(date))}
        showTimeSelect
        isClearable
        timeIntervals={15}
        timeCaption="Time"
        dateFormat="d MMM yyyy, h:mm aa"
        placeholderText={placeholder || "Select date and time"}
        className="input-field w-full"
        wrapperClassName="w-full"
        calendarClassName="sponsor-datepicker"
        popperClassName="sponsor-datepicker-popper"
        popperPlacement="bottom-start"
        showPopperArrow={false}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <textarea className="input-field min-h-28" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-600">{label}</span>
      <select className="input-field" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
