import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export interface GeneratePatientHealthSummaryInput {
    personalDetails: {
        fullName: string;
        age?: number;
        sex?: string;
        address?: string;
        ethnicity?: string;
        occupation?: string;
        maritalStatus?: string;
        gender?: string;
        bloodGroup?: string;
    };
    medicalHistory: {
        currentMedications: Array<{ name: string; dosage: string }>;
        pastChronicDiseases: string[];
        otherPastConditifons: Array<{ name: string; details: string }>;
        familyHistory: string[];
        allergies: string[];
        socialHistory: string;
    };
    symptoms: string;
    labResultsDataUri?: string;
}

export async function generatePatientHealthSummary(input: GeneratePatientHealthSummaryInput): Promise<{ summary: string }> {
    try {
        const meds = input.medicalHistory.currentMedications.map(m => `${m.name} (${m.dosage})`).join(', ') || 'None';
        const prompt = `Generate a concise clinical health summary for the following patient. Write in professional medical format.

Patient: ${input.personalDetails.fullName}
Age: ${input.personalDetails.age || 'Unknown'}, Sex: ${input.personalDetails.sex || 'Unknown'}
Address: ${input.personalDetails.address || 'N/A'}

Current Medications: ${meds}
Past Chronic Diseases: ${input.medicalHistory.pastChronicDiseases.join(', ') || 'None'}
Other Conditions: ${input.medicalHistory.otherPastConditifons.map(c => `${c.name}: ${c.details}`).join(', ') || 'None'}
Family History: ${input.medicalHistory.familyHistory.join(', ') || 'None'}
Allergies: ${input.medicalHistory.allergies.join(', ') || 'NKDA'}
Social History: ${input.medicalHistory.socialHistory || 'None'}
Current Symptoms: ${input.symptoms}

Provide a structured clinical summary paragraph.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { summary: response.text() };
    } catch (error) {
        console.error("Error generating health summary:", error);
        return { summary: "Unable to generate summary at this time. Please try again later." };
    }
}
