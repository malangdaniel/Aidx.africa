import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, User, GraduationCap, Stethoscope, Calendar, Save } from "lucide-react";
import { toast } from "sonner";
import { DoctorBasicInfo } from "./DoctorBasicInfo";
import { DoctorCredentials } from "./DoctorCredentials";
import { DoctorExpertise } from "./DoctorExpertise";
import { DoctorAvailability } from "./DoctorAvailability";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DoctorProfileSettingsProps {
  onSaved?: () => void;
}

// Default state factory
const getDefaultBasicInfo = () => ({
  professionalTitle: "",
  profilePhoto: "",
  gender: "",
  country: "",
  city: "",
  languages: [] as string[],
  registrationNumber: "",
  licensingAuthority: "",
  yearOfGraduation: ""
});

const getDefaultCredentials = () => ({
  primaryDegree: "",
  postgraduateQualifications: [] as string[],
  specialty: "",
  subSpecialty: "",
  yearsExperience: "",
  currentAffiliations: [] as string[],
  pastInstitutions: [] as string[],
  certifications: [] as string[],
  fellowships: [] as string[]
});

const getDefaultExpertise = () => ({
  conditionsTreated: [] as string[],
  clinicalInterests: [] as string[],
  ageGroups: [] as string[],
  consultationScopes: [] as string[]
});

const getDefaultAvailability = () => ({
  consultationModes: [] as string[],
  availableDays: [] as string[],
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
  timezone: "Africa/Lagos (WAT)",
  avgResponseTime: "",
  maxConsultationsPerDay: "10",
  emergencyAvailable: false,
  onCallStatus: false,
  consultPrice: ""
});

export function DoctorProfileSettings({ onSaved }: DoctorProfileSettingsProps) {
  const { user, profile, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [basicInfo, setBasicInfo] = useState(getDefaultBasicInfo());
  const [credentials, setCredentials] = useState(getDefaultCredentials());
  const [expertise, setExpertise] = useState(getDefaultExpertise());
  const [availability, setAvailability] = useState(getDefaultAvailability());

  // Load existing data
  useEffect(() => {
    const loadDoctorProfile = async () => {
      if (!user) return;
      
      try {
        // Load profile first/last name
        if (profile) {
          setFirstName(profile.first_name || "");
          setLastName(profile.last_name || "");
          
          // Load from profile metadata if exists
          const meta = profile.metadata || {};
          if (meta.doctorProfile) {
            const dp = meta.doctorProfile;
            setBasicInfo(prev => ({ ...prev, ...dp.basicInfo }));
            setCredentials(prev => ({ ...prev, ...dp.credentials }));
            setExpertise(prev => ({ ...prev, ...dp.expertise }));
            setAvailability(prev => ({ ...prev, ...dp.availability }));
          }
        }

        // Load from doctors table
        const { data: doctorData, error } = await supabase
          .from("doctors")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (doctorData) {
          // Map doctors table fields
          setCredentials(prev => ({
            ...prev,
            specialty: doctorData.specialties?.[0] || prev.specialty
          }));
          setAvailability(prev => ({
            ...prev,
            consultPrice: doctorData.consult_price?.toString() || prev.consultPrice
          }));
          setBasicInfo(prev => ({
            ...prev,
            registrationNumber: doctorData.license_number || prev.registrationNumber
          }));
        }
      } catch (error) {
        console.error("Error loading doctor profile:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadDoctorProfile();
  }, [user, profile]);

  const handleBasicInfoChange = (field: string, value: any) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleCredentialsChange = (field: string, value: any) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleExpertiseChange = (field: string, value: any) => {
    setExpertise(prev => ({ ...prev, [field]: value }));
  };

  const handleAvailabilityChange = (field: string, value: any) => {
    setAvailability(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setLoading(true);

    try {
      // Prepare the doctor profile data
      const doctorProfile = {
        basicInfo,
        credentials,
        expertise,
        availability
      };

      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
          metadata: {
            ...profile.metadata,
            doctorProfile
          }
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // Check if doctor record exists
      const { data: existingDoctor } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const doctorTableData = {
        user_id: user.id,
        license_number: basicInfo.registrationNumber,
        specialties: credentials.specialty ? [credentials.specialty] : [],
        consult_price: parseFloat(availability.consultPrice) || 0,
        bio: `${basicInfo.professionalTitle} ${firstName} ${lastName} - ${credentials.specialty || "Medical Professional"}`,
        updated_at: new Date().toISOString()
      };

      if (existingDoctor) {
        // Update existing
        const { error: doctorError } = await supabase
          .from("doctors")
          .update(doctorTableData)
          .eq("id", existingDoctor.id);
        
        if (doctorError) throw doctorError;
      } else {
        // Insert new
        const { error: doctorError } = await supabase
          .from("doctors")
          .insert(doctorTableData);
        
        if (doctorError) throw doctorError;
      }

      await refetchProfile();
      toast.success("Doctor profile saved successfully");
      onSaved?.();
    } catch (error: any) {
      console.error("Error saving doctor profile:", error);
      toast.error("Failed to save profile: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="basic" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-4 mb-4">
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
          <TabsContent value="basic" className="mt-0 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Basic Identification</h3>
              <p className="text-sm text-muted-foreground">Your professional identity and trust credentials</p>
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
              <p className="text-sm text-muted-foreground">Your qualifications, experience, and affiliations</p>
            </div>
            <DoctorCredentials
              data={credentials}
              onChange={handleCredentialsChange}
            />
          </TabsContent>

          <TabsContent value="expertise" className="mt-0 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Areas of Expertise</h3>
              <p className="text-sm text-muted-foreground">Help patients find you for the right conditions</p>
            </div>
            <DoctorExpertise
              data={expertise}
              onChange={handleExpertiseChange}
            />
          </TabsContent>

          <TabsContent value="availability" className="mt-0 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Consultation Settings</h3>
              <p className="text-sm text-muted-foreground">Configure your availability and booking preferences</p>
            </div>
            <DoctorAvailability
              data={availability}
              onChange={handleAvailabilityChange}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <div className="pt-4 border-t mt-4">
        <Button onClick={handleSave} disabled={loading} className="w-full gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
