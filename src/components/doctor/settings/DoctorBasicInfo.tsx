import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { AvatarUpload } from "@/components/shared/AvatarUpload";
import { useAuth } from "@/contexts/AuthContext";

interface DoctorBasicInfoProps {
  data: {
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
  };
  firstName: string;
  lastName: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onChange: (field: string, value: any) => void;
}

const PROFESSIONAL_TITLES = ["Dr.", "Prof.", "Consultant", "Specialist", "Resident"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const COMMON_LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin", "French", "Arabic", "Spanish", "Portuguese"];
const LICENSING_AUTHORITIES = [
  "Medical and Dental Council of Nigeria (MDCN)",
  "General Medical Council (GMC) - UK",
  "Medical Board - USA",
  "Health Professions Council of South Africa (HPCSA)",
  "Other"
];

export function DoctorBasicInfo({ data, firstName, lastName, onFirstNameChange, onLastNameChange, onChange }: DoctorBasicInfoProps) {
  const { user } = useAuth();
  
  const addLanguage = (lang: string) => {
    if (lang && !data.languages.includes(lang)) {
      onChange("languages", [...data.languages, lang]);
    }
  };

  const removeLanguage = (lang: string) => {
    onChange("languages", data.languages.filter(l => l !== lang));
  };

  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'DR';

  return (
    <div className="space-y-5">
      {/* Profile Photo */}
      <div className="flex flex-col items-center gap-2 pb-4 border-b">
        <AvatarUpload
          userId={user?.id || ''}
          currentAvatarUrl={data.profilePhoto}
          fallbackInitials={initials}
          onUploadComplete={(url) => onChange("profilePhoto", url)}
          size="lg"
        />
        <p className="text-xs text-muted-foreground">Tap to upload professional photo</p>
      </div>

      {/* Name and Title */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="professionalTitle">Professional Title</Label>
          <Select value={data.professionalTitle} onValueChange={(v) => onChange("professionalTitle", v)}>
            <SelectTrigger id="professionalTitle">
              <SelectValue placeholder="Select title" />
            </SelectTrigger>
            <SelectContent>
              {PROFESSIONAL_TITLES.map(title => (
                <SelectItem key={title} value={title}>{title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => onFirstNameChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => onLastNameChange(e.target.value)}
          />
        </div>
      </div>

      {/* About */}
      <div className="space-y-2">
        <Label htmlFor="about">About Dr {lastName || ""}</Label>
        <Textarea
          id="about"
          rows={5}
          maxLength={1200}
          placeholder="Introduce yourself to patients: your approach to care, focus areas, and experience."
          value={data.about || ""}
          onChange={(e) => onChange("about", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This appears in the "About" section of your public profile. {(data.about || "").length}/1200
        </p>
      </div>

      {/* Gender and Location */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="gender">Gender (Optional)</Label>
          <Select value={data.gender} onValueChange={(v) => onChange("gender", v)}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country of Practice</Label>
          <Input
            id="country"
            placeholder="Nigeria"
            value={data.country}
            onChange={(e) => onChange("country", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City / State</Label>
          <Input
            id="city"
            placeholder="Lagos"
            value={data.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </div>
      </div>

      {/* Languages */}
      <div className="space-y-2">
        <Label>Languages Spoken</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.languages.map(lang => (
            <Badge key={lang} variant="secondary" className="gap-1 pr-1">
              {lang}
              <button 
                type="button"
                onClick={() => removeLanguage(lang)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Select onValueChange={addLanguage}>
          <SelectTrigger>
            <SelectValue placeholder="Add a language" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_LANGUAGES.filter(l => !data.languages.includes(l)).map(lang => (
              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Medical Registration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">Medical Registration Number</Label>
          <Input
            id="registrationNumber"
            placeholder="MDCN/R/12345"
            value={data.registrationNumber}
            onChange={(e) => onChange("registrationNumber", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="licensingAuthority">Licensing Authority</Label>
          <Select value={data.licensingAuthority} onValueChange={(v) => onChange("licensingAuthority", v)}>
            <SelectTrigger id="licensingAuthority">
              <SelectValue placeholder="Select authority" />
            </SelectTrigger>
            <SelectContent>
              {LICENSING_AUTHORITIES.map(auth => (
                <SelectItem key={auth} value={auth}>{auth}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearOfGraduation">Year of Graduation</Label>
          <Input
            id="yearOfGraduation"
            type="number"
            placeholder="2015"
            min="1950"
            max={new Date().getFullYear()}
            value={data.yearOfGraduation}
            onChange={(e) => onChange("yearOfGraduation", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
