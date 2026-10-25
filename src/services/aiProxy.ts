import { supabase } from "@/integrations/supabase/client";

export interface ProxyContents {
    role: "user" | "model";
    parts: { text: string }[];
}

export interface AiProxyOptions {
    contents: ProxyContents[];
    systemInstruction?: string;
    generationConfig?: {
        maxOutputTokens?: number;
        temperature?: number;
    };
}

/**
 * Calls the Supabase `ai-proxy` edge function, which holds the Gemini API key
 * server-side. Requires a signed-in user.
 *
 * @throws Error with a descriptive message if the call fails or the user is not signed in.
 */
export async function callAiProxy(options: AiProxyOptions): Promise<string> {
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
        body: options,
    });

    if (error) {
        throw new Error(`AI proxy error: ${error.message}`);
    }

    if (data?.error) {
        throw new Error(`AI proxy returned an error: ${data.error}`);
    }

    if (typeof data?.text !== "string") {
        throw new Error("AI proxy returned an unexpected response format.");
    }

    return data.text;
}
