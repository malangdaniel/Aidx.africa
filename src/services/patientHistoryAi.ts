import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// --- Schemas (Adapted from user template) ---

const PersonalDetailsSchema = z.object({
    fullName: z.string().describe('The full name of the patient.'),
    age: z.number().describe('The age of the patient.'),
    sex: z.string().describe('The sex of the patient.'),
    address: z.string().describe('The address of the patient.'),
    ethnicity: z.string().optional().describe('The ethnicity of the patient.'),
    occupation: z.string().describe('The occupation of the patient.'),
    maritalStatus: z.string().optional().describe('The marital status of the patient.'),
});

const MedicationSchema = z.object({
    name: z.string(),
    dosage: z.string(),
});

const PastConditionSchema = z.object({
    name: z.string(),
    details: z.string(),
});

const MedicalHistorySchema = z.object({
    currentMedications: z.array(MedicationSchema).optional(),
    pastChronicDiseases: z.array(z.string()).optional(),
    otherPastConditions: z.array(PastConditionSchema).optional(),
    familyHistory: z.array(z.string()).optional(),
    socialHistory: z.string().optional().describe("A summary of social history, e.g., smoking, alcohol use."),
    allergies: z.array(z.string()).optional(),
});


export const GeneratePatientHealthSummaryInputSchema = z.object({
    personalDetails: PersonalDetailsSchema.describe(
        "The patient's personal demographic and contact information."
    ),
    medicalHistory: MedicalHistorySchema,
    labResultsDataUri: z
        .string()
        .optional()
        .describe(
            "An image of the patient's lab results, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. This is optional."
        ),
    symptoms: z.string().describe('The presenting complaints from the patient.'),
});
export type GeneratePatientHealthSummaryInput = z.infer<
    typeof GeneratePatientHealthSummaryInputSchema
>;

const GeneratePatientHealthSummaryOutputSchema = z.object({
    summary: z.string().describe('The summarized view of the patient health in a structured, clinical format.'),
});
export type GeneratePatientHealthSummaryOutput = z.infer<
    typeof GeneratePatientHealthSummaryOutputSchema
>;

// --- Implementation ---

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing Gemini API Key in environment variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function buildPrompt(input: GeneratePatientHealthSummaryInput): string {
    const { personalDetails, medicalHistory, symptoms } = input;

    // Helper to format list items
    const formatList = (items: string[]) => items.join(", ");

    return `You are an expert medical summarizer. Your task is to generate a structured, professional clinical summary for a doctor to review. Use the provided patient data. The Hospital Number should be a placeholder like 'GSH/00XXXX'.

Use the following format strictly:

Patient Name: ${personalDetails.fullName}
Hospital Number: GSH/00XXXX
Age: ${personalDetails.age} years
Sex: ${personalDetails.sex}
Occupation: ${personalDetails.occupation}
Marital Status: ${personalDetails.maritalStatus || 'Not specified'}
Address: ${personalDetails.address || 'Not specified'}

Presenting Complaints:
- ${symptoms}

History of Present Illness:
Based on the presenting complaints, elaborate on the history.

Past Medical History:
${medicalHistory.pastChronicDiseases?.length ? `- Chronic Diseases: ${formatList(medicalHistory.pastChronicDiseases)}.` : ''}
${medicalHistory.otherPastConditions?.length ? `- Other Conditions: ${medicalHistory.otherPastConditions.map(c => `${c.name} (${c.details})`).join(", ")}.` : ''}
${medicalHistory.allergies?.length ? `- Allergies: ${formatList(medicalHistory.allergies)}.` : ''}
${(!medicalHistory.pastChronicDiseases?.length && !medicalHistory.otherPastConditions?.length) ? '- No other significant past medical or surgical history unless provided.' : ''}

Drug History:
${medicalHistory.currentMedications?.length
            ? `- Current Medications: ${medicalHistory.currentMedications.map(m => `${m.name} ${m.dosage}`).join(", ")}.`
            : '- No current medications reported.'
        }

Social History:
- ${medicalHistory.socialHistory || 'None reported.'}

Family History:
${medicalHistory.familyHistory?.length
            ? `- ${formatList(medicalHistory.familyHistory)}`
            : '- No significant family history reported.'
        }

Review of Systems:
- Systemically well apart from the presenting complaints unless otherwise specified.
- CNS: No headaches, visual changes, or seizures
- Respiratory: No wheeze or hemoptysis
- Cardiovascular: Positive for orthopnea and PND if mentioned in symptoms
- GIT: No abdominal pain, jaundice, or bleeding per rectum
- GU: No dysuria, frequency, or hematuria

${input.labResultsDataUri ? "Lab Results:\n(Review of attached image has been requested)\n" : ""}
`;
}

export async function generatePatientHealthSummary(
    input: GeneratePatientHealthSummaryInput
): Promise<GeneratePatientHealthSummaryOutput> {
    try {
        const promptText = buildPrompt(input);
        let result;

        if (input.labResultsDataUri) {
            // If there's an image, we need to send it as a separate part
            // Data URI format: data:image/jpeg;base64,...
            const matches = input.labResultsDataUri.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                throw new Error("Invalid image format");
            }

            const mimeType = matches[1];
            const data = matches[2];

            result = await model.generateContent([
                promptText,
                { inlineData: { mimeType, data } }
            ]);
        } else {
            result = await model.generateContent(promptText);
        }

        const response = await result.response;
        return { summary: response.text() };
    } catch (error) {
        console.error("Error generating health summary:", error);
        throw error;
    }
}
