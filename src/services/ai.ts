import { ClinicalAssessmentData } from "@/types/clinicalAssessment";
import { callAiProxy, ProxyContents } from "./aiProxy";

// ---------------------------------------------------------------------------
// System prompt (kept here, sent as systemInstruction to the proxy)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Sanari AI Medical Assistant, an advanced AI clinical support assistant designed to help patients understand possible medical conditions based on their symptoms.

Your responsibilities:
1. Ask structured follow-up medical questions one at a time before concluding.
2. Gather clinical information conversationally until sufficient confidence is reached.
3. Detect medical emergencies immediately and advise emergency medical care.
4. Recommend the most appropriate medical specialist.
5. Recommend ONLY safe over-the-counter (OTC) medications when appropriate.
6. Never prescribe controlled medications, narcotics, or restricted drugs.
7. Never claim certainty or pretend to be a licensed doctor.
8. If confidence is low, clearly state uncertainty.
9. Always prioritize patient safety.
10. Include red flag warnings whenever symptoms suggest serious illness.
11. Be conversational, empathetic, calm, and professional.
12. Do NOT output long medical reports or test recommendations in conversation. Focus on asking key triage questions.
13. If symptoms indicate a life-threatening condition:
- Warn the patient clearly
- Advise immediate emergency care
14. Avoid hallucinating fake medical facts. Use evidence-based medical reasoning inspired by CDC, Mayo Clinic, MedlinePlus, WHO.
15. End conversational triage responses concisely.`;

const STRUCTURED_ASSESSMENT_PROMPT = `Based on the following conversation between a patient and an AI health assistant, generate a preliminary clinical assessment in JSON format matching this exact schema:

{
  "summary": {
    "patientSummary": "Brief patient-centric summary of primary complaint",
    "symptomsReported": ["symptom 1", "symptom 2"],
    "duration": "e.g., 2-3 days",
    "symptomCount": 4,
    "assessmentDurationMinutes": 3,
    "date": "Today"
  },
  "riskLevel": "Low" | "Moderate" | "High" | "Emergency",
  "confidence": 85,
  "clinicalSummaryText": "2-4 concise sentences synthesizing patient clinical presentation.",
  "conditions": [
    {
      "id": "c1",
      "name": "Condition Name",
      "matchPercentage": 87,
      "confidenceLevel": "High" | "Moderate" | "Low",
      "severity": "Moderate" | "Low" | "High" | "Emergency",
      "supportingSymptoms": ["Fever", "Headache"],
      "rationale": "Brief rationale for this match.",
      "expandedDetails": {
        "clinicalRationale": "Detailed clinical reasoning behind this differential diagnosis.",
        "supportingFindings": ["Acute onset", "Reported fever > 38C"],
        "symptomsAgainst": ["No cough reported"],
        "typicalProgression": "Usually resolves within 5-7 days with supportive care.",
        "whenToSeekUrgentCare": "Seek urgent care if fever exceeds 39.5C or shortness of breath develops."
      }
    }
  ],
  "treatment": {
    "selfCareChecklist": [
      "Rest adequately and avoid strenuous exertion",
      "Stay hydrated with water and oral electrolyte solutions",
      "Monitor body temperature twice daily"
    ],
    "otcMedications": [
      {
        "id": "m1",
        "name": "Paracetamol",
        "strength": "500mg",
        "purpose": "Fever & Body Aches",
        "dosage": "500-1000mg every 6-8 hours as needed (Max 4g/day)",
        "warnings": "Do not exceed maximum daily dose. Avoid alcohol.",
        "price": 850,
        "formattedPrice": "₦850",
        "inStock": true
      }
    ]
  },
  "specialistReferral": {
    "specialty": "General Practitioner",
    "reason": "Initial clinical evaluation of acute febrile illness",
    "urgency": "Moderate",
    "estimatedFee": "₦5,000",
    "availableDoctorsCount": 18
  },
  "redFlags": [
    "Difficulty breathing or chest tightness",
    "Persistent vomiting or inability to keep fluids down",
    "Severe neck stiffness or sudden confusion",
    "High fever (>39.5°C) unresponsive to antipyretics"
  ]
}

IMPORTANT: Return ONLY valid JSON. No markdown backticks, no markdown text. Do NOT include any laboratory test or investigation recommendations.`;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface ChatMessage {
    role: "user" | "model";
    parts: { text: string }[];
}

// ---------------------------------------------------------------------------
// sendMessageToAI
// ---------------------------------------------------------------------------
export const sendMessageToAI = async (
    history: ChatMessage[],
    messageText: string
): Promise<string> => {
    try {
        const contents: ProxyContents[] = [
            ...history,
            { role: "user", parts: [{ text: messageText }] },
        ];

        return await callAiProxy({
            contents,
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        });
    } catch (error) {
        console.error("AI proxy error:", error);
        return "I apologize, but I'm having trouble connecting to my medical database right now. Please try again in a moment.";
    }
};

// ---------------------------------------------------------------------------
// generateDiagnosis
// ---------------------------------------------------------------------------
export const generateDiagnosis = async (
    conversationHistory: string
): Promise<ClinicalAssessmentData | null> => {
    try {
        const userMessage = `${STRUCTURED_ASSESSMENT_PROMPT}\n\nConversation History:\n${conversationHistory}`;

        const text = await callAiProxy({
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
        });

        const cleanText = text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const parsed = JSON.parse(cleanText) as ClinicalAssessmentData;
        return sanitizeClinicalAssessment(parsed);
    } catch (error) {
        console.error("Error creating structured clinical assessment:", error);
        return null;
    }
};

// ---------------------------------------------------------------------------
// sanitizeClinicalAssessment
//
// Patient-safety rule: missing conditions → return null (caller treats as
// failure). Harmless display-only fields may keep safe defaults.
// ---------------------------------------------------------------------------
function sanitizeClinicalAssessment(
    data: any
): ClinicalAssessmentData | null {
    // Critical fields: conditions must be present and non-empty
    if (!Array.isArray(data.conditions) || data.conditions.length === 0) {
        return null;
    }

    // riskLevel, confidence, and redFlags must come from the AI
    if (
        !data.riskLevel ||
        typeof data.confidence !== "number" ||
        !Array.isArray(data.redFlags) ||
        data.redFlags.length === 0
    ) {
        return null;
    }

    return {
        summary: {
            patientSummary:
                data.summary?.patientSummary || "Reported symptoms evaluation",
            symptomsReported: Array.isArray(data.summary?.symptomsReported)
                ? data.summary.symptomsReported
                : [],
            duration: data.summary?.duration || "Unknown",
            symptomCount: data.summary?.symptomsReported?.length ?? 0,
            assessmentDurationMinutes:
                data.summary?.assessmentDurationMinutes || 0,
            date: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            }),
        },
        riskLevel: data.riskLevel,
        confidence: data.confidence,
        clinicalSummaryText: data.clinicalSummaryText || "",
        conditions: data.conditions.map((c: any, idx: number) => ({
            id: c.id || `c-${idx}`,
            name: c.name,
            matchPercentage: c.matchPercentage,
            confidenceLevel: c.confidenceLevel,
            severity: c.severity,
            supportingSymptoms: Array.isArray(c.supportingSymptoms)
                ? c.supportingSymptoms
                : [],
            rationale: c.rationale || "",
            expandedDetails: {
                clinicalRationale: c.expandedDetails?.clinicalRationale || "",
                supportingFindings: Array.isArray(
                    c.expandedDetails?.supportingFindings
                )
                    ? c.expandedDetails.supportingFindings
                    : [],
                symptomsAgainst: Array.isArray(c.expandedDetails?.symptomsAgainst)
                    ? c.expandedDetails.symptomsAgainst
                    : [],
                typicalProgression:
                    c.expandedDetails?.typicalProgression || "",
                whenToSeekUrgentCare:
                    c.expandedDetails?.whenToSeekUrgentCare || "",
            },
        })),
        treatment: {
            selfCareChecklist:
                Array.isArray(data.treatment?.selfCareChecklist) &&
                data.treatment.selfCareChecklist.length > 0
                    ? data.treatment.selfCareChecklist
                    : [],
            otcMedications:
                Array.isArray(data.treatment?.otcMedications) &&
                data.treatment.otcMedications.length > 0
                    ? data.treatment.otcMedications
                    : [],
        },
        specialistReferral: {
            specialty:
                data.specialistReferral?.specialty || "General Practitioner",
            reason: data.specialistReferral?.reason || "",
            urgency: data.specialistReferral?.urgency || "Moderate",
            estimatedFee: data.specialistReferral?.estimatedFee || "",
            availableDoctorsCount:
                data.specialistReferral?.availableDoctorsCount ?? 0,
        },
        redFlags: data.redFlags,
    };
}
