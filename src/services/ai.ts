import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing Gemini API Key in environment variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const SYSTEM_PROMPT = `You are Sophie AI, a medical assistant for AiDx Health. You help patients understand their symptoms, provide general health guidance, and recommend when to see a doctor. You are not a replacement for professional medical advice. Always be empathetic, clear, and professional. If symptoms sound serious or life-threatening, strongly recommend immediate medical attention.`;

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
