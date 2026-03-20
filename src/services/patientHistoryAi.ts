import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export interface GeneratePatientHealthSummaryInput {
    personalDetails: {
        fullName: string;
        age?: number;
        gender?: string;
        bloodGroup?: string;
    };
    medicalHistory: string[];
    surgicalHistory: string[];
    currentMedications: string[];
    allergies: string[];
    familyHistory: string[];
    socialHistory: string;
}

export async function generatePatientHealthSummary(input: GeneratePatientHealthSummaryInput): Promise<{ summary: string }> {
    try {
        const prompt = `Generate a concise clinical health summary for the following patient information. Write it in a professional medical format suitable for doctor review.

Patient: ${input.personalDetails.fullName}
Age: ${input.personalDetails.age || 'Unknown'}
Gender: ${input.personalDetails.gender || 'Unknown'}
Blood Group: ${input.personalDetails.bloodGroup || 'Unknown'}

Medical History: ${input.medicalHistory.length > 0 ? input.medicalHistory.join(', ') : 'None reported'}
Surgical History: ${input.surgicalHistory.length > 0 ? input.surgicalHistory.join(', ') : 'None reported'}
Current Medications: ${input.currentMedications.length > 0 ? input.currentMedications.join(', ') : 'None reported'}
Allergies: ${input.allergies.length > 0 ? input.allergies.join(', ') : 'NKDA'}
Family History: ${input.familyHistory.length > 0 ? input.familyHistory.join(', ') : 'None reported'}
Social History: ${input.socialHistory || 'None reported'}

Provide a structured summary paragraph.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return { summary: response.text() };
    } catch (error) {
        console.error("Error generating health summary:", error);
        return { summary: "Unable to generate summary at this time. Please try again later." };
    }
}
