import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DoctorCredentialsProps {
  data: {
    primaryDegree: string;
    postgraduateQualifications: string[];
    specialty: string;
    subSpecialty: string;
    yearsExperience: string;
    currentAffiliations: string[];
    pastInstitutions: string[];
    certifications: string[];
    fellowships: string[];
  };
  onChange: (field: string, value: any) => void;
}

const PRIMARY_DEGREES = ["MBBS", "MD", "MBChB", "DO", "MBBS/BDS"];
const SPECIALTIES = [
  "General Practice",
  "Internal Medicine",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "Surgery",
  "Orthopedics",
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Psychiatry",
  "Ophthalmology",
  "ENT",
  "Radiology",
  "Anesthesiology",
  "Emergency Medicine",
  "Family Medicine",
  "Oncology",
  "Urology",
  "Nephrology",
  "Gastroenterology",
  "Pulmonology",
  "Endocrinology",
  "Infectious Diseases",
  "Other"
];
const COMMON_CERTIFICATIONS = ["ACLS", "ATLS", "BLS", "PALS", "NRP", "FCPS", "MRCP", "FRCS"];

export function DoctorCredentials({ data, onChange }: DoctorCredentialsProps) {
  const [newQualification, setNewQualification] = useState("");
  const [newAffiliation, setNewAffiliation] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [newFellowship, setNewFellowship] = useState("");

  const addToArray = (field: string, value: string, setter: (v: string) => void) => {
    if (value.trim() && !data[field as keyof typeof data].includes(value.trim())) {
      onChange(field, [...(data[field as keyof typeof data] as string[]), value.trim()]);
      setter("");
    }
  };

  const removeFromArray = (field: string, value: string) => {
    onChange(field, (data[field as keyof typeof data] as string[]).filter(v => v !== value));
  };

  const toggleCertification = (cert: string) => {
    if (data.certifications.includes(cert)) {
      onChange("certifications", data.certifications.filter(c => c !== cert));
    } else {
      onChange("certifications", [...data.certifications, cert]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Degree and Specialty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primaryDegree">Primary Medical Degree</Label>
          <Select value={data.primaryDegree} onValueChange={(v) => onChange("primaryDegree", v)}>
            <SelectTrigger id="primaryDegree">
              <SelectValue placeholder="Select degree" />
            </SelectTrigger>
            <SelectContent>
              {PRIMARY_DEGREES.map(deg => (
                <SelectItem key={deg} value={deg}>{deg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearsExperience">Years of Clinical Experience</Label>
          <Input
            id="yearsExperience"
            type="number"
            placeholder="10"
            min="0"
            max="70"
            value={data.yearsExperience}
            onChange={(e) => onChange("yearsExperience", e.target.value)}
          />
        </div>
      </div>

      {/* Specialty and Sub-specialty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Select value={data.specialty} onValueChange={(v) => onChange("specialty", v)}>
            <SelectTrigger id="specialty">
              <SelectValue placeholder="Select specialty" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALTIES.map(spec => (
                <SelectItem key={spec} value={spec}>{spec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subSpecialty">Sub-specialty (Optional)</Label>
          <Input
            id="subSpecialty"
            placeholder="e.g., Interventional Cardiology"
            value={data.subSpecialty}
            onChange={(e) => onChange("subSpecialty", e.target.value)}
          />
        </div>
      </div>

      {/* Postgraduate Qualifications */}
      <div className="space-y-2">
        <Label>Postgraduate Qualifications</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.postgraduateQualifications.map(qual => (
            <Badge key={qual} variant="secondary" className="gap-1 pr-1">
              {qual}
              <button 
                type="button"
                onClick={() => removeFromArray("postgraduateQualifications", qual)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., MSc, FWACP, FMCP"
            value={newQualification}
            onChange={(e) => setNewQualification(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("postgraduateQualifications", newQualification, setNewQualification))}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={() => addToArray("postgraduateQualifications", newQualification, setNewQualification)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Current Affiliations */}
      <div className="space-y-2">
        <Label>Current Hospital/Clinic Affiliations</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.currentAffiliations.map(aff => (
            <Badge key={aff} variant="secondary" className="gap-1 pr-1">
              {aff}
              <button 
                type="button"
                onClick={() => removeFromArray("currentAffiliations", aff)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Lagos University Teaching Hospital"
            value={newAffiliation}
            onChange={(e) => setNewAffiliation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("currentAffiliations", newAffiliation, setNewAffiliation))}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={() => addToArray("currentAffiliations", newAffiliation, setNewAffiliation)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Past Institutions */}
      <div className="space-y-2">
        <Label>Past Hospitals/Institutions (Optional)</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.pastInstitutions.map(inst => (
            <Badge key={inst} variant="outline" className="gap-1 pr-1">
              {inst}
              <button 
                type="button"
                onClick={() => removeFromArray("pastInstitutions", inst)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Johns Hopkins Hospital"
            value={newInstitution}
            onChange={(e) => setNewInstitution(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("pastInstitutions", newInstitution, setNewInstitution))}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={() => addToArray("pastInstitutions", newInstitution, setNewInstitution)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Certifications */}
      <div className="space-y-2">
        <Label>Certifications</Label>
        <div className="flex flex-wrap gap-2">
          {COMMON_CERTIFICATIONS.map(cert => (
            <Badge
              key={cert}
              variant={data.certifications.includes(cert) ? "default" : "outline"}
              className="cursor-pointer transition-colors"
              onClick={() => toggleCertification(cert)}
            >
              {cert}
            </Badge>
          ))}
        </div>
      </div>

      {/* Fellowships */}
      <div className="space-y-2">
        <Label>Fellowship Memberships</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {data.fellowships.map(fell => (
            <Badge key={fell} variant="secondary" className="gap-1 pr-1">
              {fell}
              <button 
                type="button"
                onClick={() => removeFromArray("fellowships", fell)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Fellow, Royal College of Physicians"
            value={newFellowship}
            onChange={(e) => setNewFellowship(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToArray("fellowships", newFellowship, setNewFellowship))}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={() => addToArray("fellowships", newFellowship, setNewFellowship)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
