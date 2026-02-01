import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DoctorExpertiseProps {
  data: {
    conditionsTreated: string[];
    clinicalInterests: string[];
    ageGroups: string[];
    consultationScopes: string[];
  };
  onChange: (field: string, value: any) => void;
}

const COMMON_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Malaria",
  "Typhoid",
  "HIV/AIDS",
  "Tuberculosis",
  "Arthritis",
  "Back Pain",
  "Anxiety",
  "Depression",
  "Allergies",
  "Skin Infections",
  "Urinary Tract Infections",
  "Respiratory Infections",
  "Gastrointestinal Issues",
  "Heart Disease",
  "Stroke",
  "Cancer",
  "Pregnancy Care",
  "Child Health",
  "Women's Health",
  "Men's Health",
  "Sexual Health",
  "Mental Health",
  "Obesity",
  "Thyroid Disorders",
  "Kidney Disease",
  "Liver Disease"
];

const CLINICAL_INTERESTS = [
  "Diabetes Care",
  "Cardiovascular Health",
  "Infectious Diseases",
  "Preventive Medicine",
  "Mental Wellness",
  "Maternal Health",
  "Pediatric Care",
  "Geriatric Medicine",
  "Sports Medicine",
  "Pain Management",
  "Lifestyle Medicine",
  "Telemedicine",
  "Chronic Disease Management",
  "Urgent Care",
  "Travel Medicine",
  "Occupational Health"
];

const AGE_GROUPS = [
  { id: "children", label: "Children (0-12 years)" },
  { id: "adolescents", label: "Adolescents (13-17 years)" },
  { id: "adults", label: "Adults (18-64 years)" },
  { id: "elderly", label: "Elderly (65+ years)" }
];

const CONSULTATION_SCOPES = [
  { id: "general", label: "General Consultation", description: "First-time consultations and general health concerns" },
  { id: "chronic", label: "Chronic Disease Management", description: "Ongoing care for long-term conditions" },
  { id: "followup", label: "Follow-up Reviews", description: "Review appointments for existing patients" },
  { id: "secondOpinion", label: "Second Opinions", description: "Expert review of existing diagnoses" }
];

export function DoctorExpertise({ data, onChange }: DoctorExpertiseProps) {
  const toggleCondition = (condition: string) => {
    if (data.conditionsTreated.includes(condition)) {
      onChange("conditionsTreated", data.conditionsTreated.filter(c => c !== condition));
    } else {
      onChange("conditionsTreated", [...data.conditionsTreated, condition]);
    }
  };

  const toggleInterest = (interest: string) => {
    if (data.clinicalInterests.includes(interest)) {
      onChange("clinicalInterests", data.clinicalInterests.filter(i => i !== interest));
    } else {
      onChange("clinicalInterests", [...data.clinicalInterests, interest]);
    }
  };

  const toggleAgeGroup = (group: string) => {
    if (data.ageGroups.includes(group)) {
      onChange("ageGroups", data.ageGroups.filter(g => g !== group));
    } else {
      onChange("ageGroups", [...data.ageGroups, group]);
    }
  };

  const toggleScope = (scope: string) => {
    if (data.consultationScopes.includes(scope)) {
      onChange("consultationScopes", data.consultationScopes.filter(s => s !== scope));
    } else {
      onChange("consultationScopes", [...data.consultationScopes, scope]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Conditions Treated */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Conditions Commonly Treated</Label>
        <p className="text-sm text-muted-foreground">Select conditions you regularly treat. This helps match you with the right patients.</p>
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-muted/30">
          {COMMON_CONDITIONS.map(condition => (
            <Badge
              key={condition}
              variant={data.conditionsTreated.includes(condition) ? "default" : "outline"}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => toggleCondition(condition)}
            >
              {condition}
            </Badge>
          ))}
        </div>
        {data.conditionsTreated.length > 0 && (
          <p className="text-xs text-muted-foreground">{data.conditionsTreated.length} conditions selected</p>
        )}
      </div>

      {/* Clinical Interests */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Clinical Interests</Label>
        <p className="text-sm text-muted-foreground">Areas of medicine you're particularly interested in or specialized.</p>
        <div className="flex flex-wrap gap-2">
          {CLINICAL_INTERESTS.map(interest => (
            <Badge
              key={interest}
              variant={data.clinicalInterests.includes(interest) ? "secondary" : "outline"}
              className="cursor-pointer transition-all hover:scale-105"
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </Badge>
          ))}
        </div>
      </div>

      {/* Age Groups */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Age Groups Treated</Label>
        <p className="text-sm text-muted-foreground">Which age groups do you typically consult with?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AGE_GROUPS.map(group => (
            <div
              key={group.id}
              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                data.ageGroups.includes(group.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => toggleAgeGroup(group.id)}
            >
              <Checkbox 
                checked={data.ageGroups.includes(group.id)}
                onCheckedChange={() => toggleAgeGroup(group.id)}
              />
              <Label className="cursor-pointer font-normal">{group.label}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Consultation Scope */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Consultation Scope</Label>
        <p className="text-sm text-muted-foreground">What types of consultations do you offer?</p>
        <div className="space-y-2">
          {CONSULTATION_SCOPES.map(scope => (
            <div
              key={scope.id}
              className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                data.consultationScopes.includes(scope.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => toggleScope(scope.id)}
            >
              <Checkbox 
                checked={data.consultationScopes.includes(scope.id)}
                onCheckedChange={() => toggleScope(scope.id)}
                className="mt-0.5"
              />
              <div>
                <Label className="cursor-pointer font-medium">{scope.label}</Label>
                <p className="text-sm text-muted-foreground">{scope.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
