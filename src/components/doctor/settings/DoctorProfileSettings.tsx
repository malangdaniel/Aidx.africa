import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Loader2,
  User,
  GraduationCap,
  Stethoscope,
  Calendar,
  Send,
  X,
  Clock,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { DoctorBasicInfo } from "./DoctorBasicInfo";
import { DoctorCredentials } from "./DoctorCredentials";
import { DoctorExpertise } from "./DoctorExpertise";
import { DoctorAvailability } from "./DoctorAvailability";
import { ScrollArea } from "@/components/ui/scroll-area";
import { diffObject, hasKeys, isSameValue } from "@/lib/profileChanges";

interface DoctorProfileSettingsProps {
  onSaved?: () => void;
}

export interface DoctorBasicInfoData {
  professionalTitle: string;
  about: string;
  profilePhoto: string;
  gender: string;
  country: string;
  city: string;
  languages: string[];
  registrationNumber: string;
  licensingAuthority: string;
  yearOfGraduation: string;
}

export interface DoctorCredentialsData {
  primaryDegree: string;
  postgraduateQualifications: string[];
  specialty: string;
  subSpecialty: string;
  yearsExperience: string;
  currentAffiliations: string[];
  pastInstitutions: string[];
  certifications: string[];
  fellowships: string[];
}

export interface DoctorExpertiseData {
  conditionsTreated: string[];
  clinicalInterests: string[];
  ageGroups: string[];
  consultationScopes: string[];
}

export interface DoctorAvailabilityData {
  consultationModes: string[];
  availableDays: string[];
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
  avgResponseTime: string;
  maxConsultationsPerDay: string;
  emergencyAvailable: boolean;
  onCallStatus: boolean;
  consultPrice: string;
}

export interface PendingDoctorChangesPayload {
  /** Only the fields the doctor actually edited (diff against live data). */
  pendingChanges: {
    firstName?: string;
    lastName?: string;
    basicInfo?: Partial<DoctorBasicInfoData>;
    credentials?: Partial<DoctorCredentialsData>;
    expertise?: Partial<DoctorExpertiseData>;
    availability?: Partial<DoctorAvailabilityData>;
  };
  pendingChangesStatus: "pending" | "approved" | "rejected";
  pendingChangesSubmittedAt: string;
  pendingChangesRejectionReason: string | null;
}

export const getDefaultBasicInfo = (): DoctorBasicInfoData => ({
  professionalTitle: "",
  about: "",
  profilePhoto: "",
  gender: "",
  country: "",
  city: "",
  languages: [],
  registrationNumber: "",
  licensingAuthority: "",
  yearOfGraduation: "",
});

export const getDefaultCredentials = (): DoctorCredentialsData => ({
  primaryDegree: "",
  postgraduateQualifications: [],
  specialty: "",
  subSpecialty: "",
  yearsExperience: "",
  currentAffiliations: [],
  pastInstitutions: [],
  certifications: [],
  fellowships: [],
});

export const getDefaultExpertise = (): DoctorExpertiseData => ({
  conditionsTreated: [],
  clinicalInterests: [],
  ageGroups: [],
  consultationScopes: [],
});

export const getDefaultAvailability = (): DoctorAvailabilityData => ({
  consultationModes: ["chat", "audio", "video"],
  availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
  timezone: "Africa/Lagos (WAT)",
  avgResponseTime: "Within 30 minutes",
  maxConsultationsPerDay: "10",
  emergencyAvailable: false,
  onCallStatus: false,
  consultPrice: "5000",
});

export function DoctorProfileSettings({ onSaved }: DoctorProfileSettingsProps) {
  const { user, profile, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [basicInfo, setBasicInfo] = useState<DoctorBasicInfoData>(getDefaultBasicInfo());
  const [credentials, setCredentials] = useState<DoctorCredentialsData>(getDefaultCredentials());
  const [expertise, setExpertise] = useState<DoctorExpertiseData>(getDefaultExpertise());
  const [availability, setAvailability] = useState<DoctorAvailabilityData>(getDefaultAvailability());

  // Current LIVE data, used as the baseline so we only submit fields that were edited
  const [liveSnapshot, setLiveSnapshot] = useState<{
    firstName: string;
    lastName: string;
    basicInfo: DoctorBasicInfoData;
    credentials: DoctorCredentialsData;
    expertise: DoctorExpertiseData;
    availability: DoctorAvailabilityData;
  } | null>(null);

  // Pending changes review state
  const [pendingStatus, setPendingStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const loadDoctorProfile = useCallback(async () => {
    if (!user) return;

    try {
      let liveFirstName = "";
      let liveLastName = "";
      let liveBasic = getDefaultBasicInfo();
      let liveCred = getDefaultCredentials();
      let liveExp = getDefaultExpertise();
      let liveAvail = getDefaultAvailability();

      // 1. Load from profile table & live metadata
      if (profile) {
        liveFirstName = profile.first_name || "";
        liveLastName = profile.last_name || "";

        const meta = (profile.metadata as Record<string, any>) || {};
        if (meta.doctorProfile) {
          const dp = meta.doctorProfile;
          if (dp.basicInfo) liveBasic = { ...liveBasic, ...dp.basicInfo };
          if (dp.credentials) liveCred = { ...liveCred, ...dp.credentials };
          if (dp.expertise) liveExp = { ...liveExp, ...dp.expertise };
          if (dp.availability) liveAvail = { ...liveAvail, ...dp.availability };
        }
      }

      // 2. Load from doctors table (live source of truth for specialties, consult price, bio)
      const { data: doctorData } = await supabase
        .from("doctors")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (doctorData) {
        liveCred = {
          ...liveCred,
          specialty: doctorData.specialties?.[0] || liveCred.specialty,
        };
        liveAvail = {
          ...liveAvail,
          consultPrice: doctorData.consult_price?.toString() || liveAvail.consultPrice,
        };
        liveBasic = {
          ...liveBasic,
          registrationNumber: doctorData.license_number || liveBasic.registrationNumber,
          about: liveBasic.about || doctorData.bio || "",
        };
      }

      // Remember the live baseline so submissions can be diffed against it
      setLiveSnapshot({
        firstName: liveFirstName,
        lastName: liveLastName,
        basicInfo: liveBasic,
        credentials: liveCred,
        expertise: liveExp,
        availability: liveAvail,
      });

      // 3. Inspect pending_doctor_changes in profile.metadata
      const meta = (profile?.metadata as Record<string, any>) || {};
      const pendingBlob = meta.pending_doctor_changes as PendingDoctorChangesPayload | undefined;

      if (pendingBlob && pendingBlob.pendingChangesStatus === "pending") {
        setPendingStatus("pending");
        setSubmittedAt(pendingBlob.pendingChangesSubmittedAt || null);
        setRejectionReason(null);

        // Pre-populate with currently pending changes so the doctor sees what's queued
        const pc = pendingBlob.pendingChanges;
        if (pc) {
          setFirstName(pc.firstName ?? liveFirstName);
          setLastName(pc.lastName ?? liveLastName);
          setBasicInfo({ ...liveBasic, ...(pc.basicInfo || {}) });
          setCredentials({ ...liveCred, ...(pc.credentials || {}) });
          setExpertise({ ...liveExp, ...(pc.expertise || {}) });
          setAvailability({ ...liveAvail, ...(pc.availability || {}) });
          return;
        }
      } else if (pendingBlob && pendingBlob.pendingChangesStatus === "rejected") {
        setPendingStatus("rejected");
        setSubmittedAt(pendingBlob.pendingChangesSubmittedAt || null);
        setRejectionReason(pendingBlob.pendingChangesRejectionReason || "No specific reason provided.");
      } else if (pendingBlob && pendingBlob.pendingChangesStatus === "approved") {
        setPendingStatus("approved");
        setSubmittedAt(pendingBlob.pendingChangesSubmittedAt || null);
        setRejectionReason(null);
      } else {
        setPendingStatus(null);
        setSubmittedAt(null);
        setRejectionReason(null);
      }

      // Apply live data
      setFirstName(liveFirstName);
      setLastName(liveLastName);
      setBasicInfo(liveBasic);
      setCredentials(liveCred);
      setExpertise(liveExp);
      setAvailability(liveAvail);
    } catch (error) {
      console.error("Error loading doctor profile:", error);
    } finally {
      setInitialLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    loadDoctorProfile();
  }, [loadDoctorProfile]);

  const handleBasicInfoChange = (field: string, value: any) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleCredentialsChange = (field: string, value: any) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpertiseChange = (field: string, value: any) => {
    setExpertise((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailability((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user || !profile || !liveSnapshot) return;

    // Build a diff: only fields that differ from the live data are submitted
    const changes: PendingDoctorChangesPayload["pendingChanges"] = {};
    if (!isSameValue(firstName, liveSnapshot.firstName)) changes.firstName = firstName;
    if (!isSameValue(lastName, liveSnapshot.lastName)) changes.lastName = lastName;
    const basicDiff = diffObject(liveSnapshot.basicInfo, basicInfo);
    const credDiff = diffObject(liveSnapshot.credentials, credentials);
    const expDiff = diffObject(liveSnapshot.expertise, expertise);
    const availDiff = diffObject(liveSnapshot.availability, availability);
    if (hasKeys(basicDiff)) changes.basicInfo = basicDiff;
    if (hasKeys(credDiff)) changes.credentials = credDiff;
    if (hasKeys(expDiff)) changes.expertise = expDiff;
    if (hasKeys(availDiff)) changes.availability = availDiff;

    if (!hasKeys(changes)) {
      toast.info(
        pendingStatus === "pending"
          ? "Nothing differs from your live profile. Use Cancel Request to withdraw the pending request."
          : "You haven't changed anything yet."
      );
      return;
    }

    setLoading(true);

    try {
      const now = new Date().toISOString();
      const pendingChangesPayload: PendingDoctorChangesPayload = {
        pendingChanges: changes,
        pendingChangesStatus: "pending",
        pendingChangesSubmittedAt: now,
        pendingChangesRejectionReason: null,
      };

      const existingMeta = (profile.metadata as Record<string, any>) || {};
      // Cast so the payload satisfies the generated Json type for metadata.
      const updatedMeta = {
        ...existingMeta,
        pending_doctor_changes: pendingChangesPayload,
      } as unknown as Record<string, any>;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          metadata: updatedMeta,
          updated_at: now,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      await refetchProfile();
      setPendingStatus("pending");
      setSubmittedAt(now);
      setRejectionReason(null);

      toast.success("Profile changes submitted for admin review");
      onSaved?.();
    } catch (error: any) {
      console.error("Error submitting doctor profile changes:", error);
      toast.error("Failed to submit profile changes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPending = async () => {
    if (!user || !profile) return;
    setCancelling(true);

    try {
      const existingMeta = { ...((profile.metadata as Record<string, any>) || {}) };
      delete existingMeta.pending_doctor_changes;

      const { error } = await supabase
        .from("profiles")
        .update({
          metadata: existingMeta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      await refetchProfile();
      setPendingStatus(null);
      setSubmittedAt(null);
      setRejectionReason(null);

      // Reload live data
      await loadDoctorProfile();
      toast.success("Pending profile changes have been cancelled");
    } catch (error: any) {
      console.error("Error cancelling pending changes:", error);
      toast.error("Failed to cancel pending changes: " + error.message);
    } finally {
      setCancelling(false);
    }
  };

  const getButtonText = () => {
    if (pendingStatus === "rejected") return "Resubmit Changes";
    if (pendingStatus === "pending") return "Update Pending Request";
    return "Submit Changes for Review";
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Pending status banner */}
      {pendingStatus === "pending" && (
        <Alert className="border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-amber-900 dark:text-amber-200">
            Changes Under Review
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Your profile changes are under review by an administrator. Live data remains visible to
            patients until approved.
            {submittedAt && (
              <span className="block mt-0.5 text-muted-foreground dark:text-amber-400/80">
                Submitted on {new Date(submittedAt).toLocaleDateString()} at{" "}
                {new Date(submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Rejected status banner */}
      {pendingStatus === "rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Profile Changes Rejected</AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-1">
            <p>
              Your profile changes were rejected:{" "}
              <span className="font-medium">{rejectionReason || "No specific reason provided."}</span>
            </p>
            <p className="text-[11px] opacity-90">
              Please review the feedback, adjust your details below, and resubmit for review.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Approved recently notice */}
      {pendingStatus === "approved" && (
        <Alert className="border-emerald-400 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="font-semibold text-emerald-900 dark:text-emerald-200">
            Changes Approved
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
            Your latest profile changes have been approved and published to your live profile.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-4 mb-4 flex-shrink-0">
          <TabsTrigger value="basic" className="gap-1.5 text-xs sm:text-sm">
            <User className="h-4 w-4 hidden sm:inline" />
            Basic
          </TabsTrigger>
          <TabsTrigger value="credentials" className="gap-1.5 text-xs sm:text-sm">
            <GraduationCap className="h-4 w-4 hidden sm:inline" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="expertise" className="gap-1.5 text-xs sm:text-sm">
            <Stethoscope className="h-4 w-4 hidden sm:inline" />
            Expertise
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-4 w-4 hidden sm:inline" />
            Availability
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <TabsContent value="basic" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Basic Identification</h3>
                <p className="text-sm text-muted-foreground">
                  Your professional identity and trust credentials
                </p>
              </div>
              <DoctorBasicInfo
                data={basicInfo}
                firstName={firstName}
                lastName={lastName}
                onFirstNameChange={setFirstName}
                onLastNameChange={setLastName}
                onChange={handleBasicInfoChange}
              />
            </TabsContent>

            <TabsContent value="credentials" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Professional Credentials</h3>
                <p className="text-sm text-muted-foreground">
                  Your qualifications, experience, and affiliations
                </p>
              </div>
              <DoctorCredentials
                data={credentials}
                onChange={handleCredentialsChange}
              />
            </TabsContent>

            <TabsContent value="expertise" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Areas of Expertise</h3>
                <p className="text-sm text-muted-foreground">
                  Help patients find you for the right conditions
                </p>
              </div>
              <DoctorExpertise
                data={expertise}
                onChange={handleExpertiseChange}
              />
            </TabsContent>

            <TabsContent value="availability" className="mt-0 space-y-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Consultation Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Configure your availability and booking preferences
                </p>
              </div>
              <DoctorAvailability
                data={availability}
                onChange={handleAvailabilityChange}
              />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      <div className="pt-4 border-t mt-4 flex-shrink-0 flex flex-col sm:flex-row gap-2">
        {pendingStatus === "pending" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelPending}
            disabled={cancelling || loading}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2 sm:w-auto"
          >
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel Pending Changes
          </Button>
        )}

        <Button
          onClick={handleSave}
          disabled={loading || cancelling}
          className="flex-1 gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
}
