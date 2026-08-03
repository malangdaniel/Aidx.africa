export interface PossibleCondition {
  id: string;
  name: string;
  matchPercentage: number;
  confidenceLevel: 'Low' | 'Moderate' | 'High';
  severity: 'Low' | 'Moderate' | 'High' | 'Emergency';
  supportingSymptoms: string[];
  rationale: string;
  expandedDetails?: {
    clinicalRationale: string;
    supportingFindings: string[];
    symptomsAgainst: string[];
    typicalProgression: string;
    whenToSeekUrgentCare: string;
  };
}

export interface OTCMedication {
  id: string;
  name: string;
  strength: string;
  purpose: string;
  dosage: string;
  warnings: string;
  price: number;
  formattedPrice: string;
  inStock: boolean;
}

export interface SpecialistReferral {
  specialty: string;
  reason: string;
  urgency: 'Low' | 'Moderate' | 'High' | 'Immediate';
  estimatedFee: string;
  availableDoctorsCount: number;
}

export interface ClinicalAssessmentData {
  summary: {
    patientSummary: string;
    symptomsReported: string[];
    duration: string;
    symptomCount: number;
    assessmentDurationMinutes: number;
    date: string;
  };
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Emergency';
  confidence: number; // e.g. 89
  clinicalSummaryText: string;
  conditions: PossibleCondition[];
  treatment: {
    selfCareChecklist: string[];
    otcMedications: OTCMedication[];
  };
  specialistReferral: SpecialistReferral;
  redFlags: string[];
}
