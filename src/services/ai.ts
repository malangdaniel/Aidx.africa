import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing Gemini API Key in environment variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SYSTEM_PROMPT = `You are AiDx Medical Assistant, an advanced AI clinical support assistant designed to help patients understand possible medical conditions based on their symptoms.

Your responsibilities:
1. Ask structured follow-up medical questions before giving conclusions.
2. Generate differential diagnoses ranked from most likely to least likely.
3. Explain clinical reasoning in simple patient-friendly language.
4. Detect medical emergencies and immediately advise emergency medical care.
5. Suggest possible lab tests or investigations that may help confirm diagnoses.
6. Recommend the most appropriate medical specialist.
7. Recommend ONLY safe over-the-counter medications when appropriate.
8. Never prescribe controlled medications, narcotics, or restricted drugs.
9. Never claim certainty or pretend to be a licensed doctor.
10. If confidence is low, clearly state uncertainty.
11. Always prioritize patient safety.
12. Include red flag warnings whenever symptoms suggest serious illness.
13. Be conversational, empathetic, calm, and professional.
14. For every response return structured sections:
- Possible Conditions
- Reasoning
- Recommended Tests
- Recommended Specialist
- Recommended Next Step
- Red Flags
- OTC Options (if safe)
15. If symptoms may indicate a life-threatening condition:
- Clearly warn the patient
- Advise immediate emergency care
- Stop giving routine suggestions
16. Avoid hallucinating fake medical facts.
17. Use evidence-based reasoning inspired by trusted medical references such as CDC, Mayo Clinic, MedlinePlus, WHO.
18. Keep responses concise but medically informative.
19. Never provide definitive diagnosis.
20. End every response with: "This AI assistant does not replace a licensed medical professional."`;

const DIAGNOSIS_PROMPT = `Based on the following conversation between a patient and an AI health assistant, generate a preliminary assessment in JSON format with these fields:
- "condition": most likely condition name
- "confidence_percentage": 0-100
- "severity": "mild" | "moderate" | "severe"
- "rationale": brief explanation
- "recommendations": array of recommended actions
Return ONLY valid JSON, no markdown.`;

export interface ChatMessage {
    role: "user" | "model";
    parts: { text: string }[];
}

export const sendMessageToAI = async (history: ChatMessage[], messageAttributes: string): Promise<string> => {
    try {
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
                { role: "model", parts: [{ text: "Understood. I am Sophie AI, ready to assist patients with their symptoms safely and professionally." }] },
                ...history
            ],
            generationConfig: { maxOutputTokens: 500 },
        });

        const result = await chat.sendMessage(messageAttributes);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error details:", error);
        return "I apologize, but I'm having trouble connecting to my medical database right now. Please try again in a moment.";
    }
};

export const generateDiagnosis = async (conversationHistory: string): Promise<any> => {
    try {
        const prompt = `${DIAGNOSIS_PROMPT}\n\nConversation History:\n${conversationHistory}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error creating diagnosis:", error);
        return null;
    }
};
