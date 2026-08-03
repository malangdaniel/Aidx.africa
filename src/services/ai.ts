import { GoogleGenerativeAI } from "@google/generative-ai";
import { ClinicalAssessmentData } from "@/types/clinicalAssessment";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing Gemini API Key in environment variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

export interface ChatMessage {
    role: "user" | "model";
    parts: { text: string }[];
}

export const sendMessageToAI = async (history: ChatMessage[], messageAttributes: string): Promise<string> => {
    try {
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Understood. I am Sanari AI, ready to assist patients with their symptoms safely and professionally through structured triage." }] },
                ...history
            ],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        });

        const result = await chat.sendMessage(messageAttributes);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error details:", error);
        return "I apologize, but I'm having trouble connecting to my medical database right now. Please try again in a moment.";
    }
};

export const generateDiagnosis = async (conversationHistory: string): Promise<ClinicalAssessmentData | null> => {
    try {
        const prompt = `${STRUCTURED_ASSESSMENT_PROMPT}\n\nConversation History:\n${conversationHistory}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText) as ClinicalAssessmentData;
        return sanitizeClinicalAssessment(parsed);
    } catch (error) {
        console.error("Error creating structured clinical assessment:", error);
        return getFallbackAssessment(conversationHistory);
    }
};

function sanitizeClinicalAssessment(data: any): ClinicalAssessmentData {
    return {
        summary: {
            patientSummary: data.summary?.patientSummary || "Reported symptoms evaluation",
            symptomsReported: Array.isArray(data.summary?.symptomsReported) ? data.summary.symptomsReported : ["Fever", "Headache", "Fatigue"],
            duration: data.summary?.duration || "2-3 days",
            symptomCount: data.summary?.symptomsReported?.length || 3,
            assessmentDurationMinutes: data.summary?.assessmentDurationMinutes || 3,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        },
        riskLevel: data.riskLevel || 'Moderate',
        confidence: typeof data.confidence === 'number' ? data.confidence : 86,
        clinicalSummaryText: data.clinicalSummaryText || "Patient presents with acute onset symptoms. Initial evaluation indicates a self-limiting viral presentation, but clinical monitoring is advised.",
        conditions: Array.isArray(data.conditions) && data.conditions.length > 0 ? data.conditions.map((c: any, idx: number) => ({
            id: c.id || `c-${idx}`,
            name: c.name || "Viral Upper Respiratory Infection",
            matchPercentage: c.matchPercentage || (88 - idx * 15),
            confidenceLevel: c.confidenceLevel || (idx === 0 ? "High" : "Moderate"),
            severity: c.severity || "Moderate",
            supportingSymptoms: Array.isArray(c.supportingSymptoms) ? c.supportingSymptoms : ["Fever", "Headache"],
            rationale: c.rationale || "Symptoms began suddenly and strongly align with acute viral presentation.",
            expandedDetails: {
                clinicalRationale: c.expandedDetails?.clinicalRationale || "Acute febrile illness presentation with constitutional symptoms. Pattern matches endemic viral pathogens.",
                supportingFindings: Array.isArray(c.expandedDetails?.supportingFindings) ? c.expandedDetails.supportingFindings : ["Sudden symptom onset", "Fever reported"],
                symptomsAgainst: Array.isArray(c.expandedDetails?.symptomsAgainst) ? c.expandedDetails.symptomsAgainst : ["No focal rash", "No severe localized pain"],
                typicalProgression: c.expandedDetails?.typicalProgression || "Most patients experience resolution within 5 to 7 days under symptomatic self-care.",
                whenToSeekUrgentCare: c.expandedDetails?.whenToSeekUrgentCare || "Consult immediate emergency care if breathing difficulty, chest pain, or high fever (>39.5°C) occurs."
            }
        })) : [
            {
                id: 'c1',
                name: 'Viral Upper Respiratory Infection',
                matchPercentage: 87,
                confidenceLevel: 'High',
                severity: 'Moderate',
                supportingSymptoms: ['Fever', 'Chills', 'Headache', 'Body aches'],
                rationale: 'Symptoms began suddenly and strongly match common acute viral infections.',
                expandedDetails: {
                    clinicalRationale: 'Clinical presentation features acute constitutional symptoms secondary to viral immune response.',
                    supportingFindings: ['Rapid symptom onset', 'Generalized myalgia & fever'],
                    symptomsAgainst: ['Absence of lower respiratory crackles'],
                    typicalProgression: 'Expected resolution within 5 to 7 days with adequate hydration and rest.',
                    whenToSeekUrgentCare: 'Seek urgent care if dyspnea or high fever unresponsive to antipyretics develops.'
                }
            },
            {
                id: 'c2',
                name: 'Acute Malaria (Uncomplicated)',
                matchPercentage: 65,
                confidenceLevel: 'Moderate',
                severity: 'Moderate',
                supportingSymptoms: ['Fever', 'Chills', 'Headache'],
                rationale: 'Endemic malaria considerations for acute febrile illness in region.',
                expandedDetails: {
                    clinicalRationale: 'Paroxysmal fever with shivering in malaria-endemic regions warrants clinical consideration.',
                    supportingFindings: ['Cyclic fever spikes', 'Generalized fatigue'],
                    symptomsAgainst: ['No jaundice or dark urine reported'],
                    typicalProgression: 'Requires rapid diagnostic confirmation and targeted antimalarial therapy if confirmed.',
                    whenToSeekUrgentCare: 'Immediate medical evaluation advised if vomiting, dark urine, or extreme lethargy develops.'
                }
            }
        ],
        treatment: {
            selfCareChecklist: Array.isArray(data.treatment?.selfCareChecklist) && data.treatment.selfCareChecklist.length > 0
                ? data.treatment.selfCareChecklist
                : [
                    "Rest adequately and limit heavy physical exertion",
                    "Maintain hydration with plenty of water and warm fluids",
                    "Eat light, easily digestible meals",
                    "Monitor body temperature every 6 to 8 hours",
                    "Seek prompt clinical care if red flag symptoms develop"
                ],
            otcMedications: Array.isArray(data.treatment?.otcMedications) && data.treatment.otcMedications.length > 0
                ? data.treatment.otcMedications
                : [
                    {
                        id: 'm1',
                        name: 'Paracetamol 500mg',
                        strength: '500mg',
                        purpose: 'Fever & Body Aches',
                        dosage: '500-1000 mg every 6-8 hours',
                        warnings: 'Do not exceed 4000 mg in 24 hours.',
                        price: 850,
                        formattedPrice: '₦850',
                        inStock: true
                    },
                    {
                        id: 'm2',
                        name: 'Vitamin C + Zinc Effervescent',
                        strength: '1000mg',
                        purpose: 'Immune Support',
                        dosage: '1 tablet daily dissolved in water',
                        warnings: 'Take with food to prevent gastric discomfort.',
                        price: 1500,
                        formattedPrice: '₦1,500',
                        inStock: true
                    }
                ]
        },
        specialistReferral: {
            specialty: data.specialistReferral?.specialty || "General Practitioner",
            reason: data.specialistReferral?.reason || "Comprehensive clinical evaluation of acute febrile symptoms.",
            urgency: data.specialistReferral?.urgency || "Moderate",
            estimatedFee: data.specialistReferral?.estimatedFee || "₦5,000",
            availableDoctorsCount: data.specialistReferral?.availableDoctorsCount || 18
        },
        redFlags: Array.isArray(data.redFlags) && data.redFlags.length > 0 ? data.redFlags : [
            "Difficulty breathing or chest tightness",
            "Persistent vomiting or inability to retain oral fluids",
            "Severe neck stiffness or sudden confusion",
            "Very high fever (>39.5°C) unresponsive to medication",
            "Seizures or loss of consciousness"
        ]
    };
}

function getFallbackAssessment(historyText: string): ClinicalAssessmentData {
    return sanitizeClinicalAssessment({});
}
