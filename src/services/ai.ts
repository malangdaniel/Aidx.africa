import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT, DIAGNOSIS_PROMPT } from "../config/prompts";

// Initialize Gemini AI
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing Gemini API Key in environment variables!");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface ChatMessage {
    role: "user" | "model";
    parts: { text: string }[];
}

export const sendMessageToAI = async (history: ChatMessage[], messageAttributes: string): Promise<string> => {
    try {
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am sophie AI, ready to assist patients with their symptoms safely and professionally." }]
                },
                ...history
            ],
            generationConfig: {
                maxOutputTokens: 500,
            },
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

        // Clean up potential markdown code blocks if the model adds them
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error creating diagnosis:", error);
        return null;
    }
};
