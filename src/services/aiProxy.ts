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
 * Normalizes multi-turn Gemini conversation contents:
 * 1. Filters out empty text parts
 * 2. Ensures the first turn is 'user'
 * 3. Collapses consecutive turns with the same role into a single turn (Gemini requirement)
 */
function normalizeContents(contents: ProxyContents[]): ProxyContents[] {
    const cleaned = contents
        .map((c) => ({
            role: c.role,
            parts: c.parts.filter(
                (p) => typeof p.text === "string" && p.text.trim().length > 0
            ),
        }))
        .filter((c) => c.parts.length > 0);

    if (cleaned.length === 0) {
        return [];
    }

    // Collapse consecutive same-role turns into one turn
    const normalized: ProxyContents[] = [];
    for (const item of cleaned) {
        const last = normalized[normalized.length - 1];
        if (last && last.role === item.role) {
            last.parts.push(...item.parts);
        } else {
            normalized.push({
                role: item.role,
                parts: [...item.parts],
            });
        }
    }

    // Gemini requires the first turn to be 'user'
    while (normalized.length > 0 && normalized[0].role !== "user") {
        normalized.shift();
    }

    return normalized;
}

/**
 * Calls the Supabase `ai-proxy` edge function, which holds the Gemini API key
 * server-side. Requires a signed-in user with an active session token.
 *
 * @throws Error with a descriptive message if the call fails or the user is not signed in.
 */
export async function callAiProxy(options: AiProxyOptions): Promise<string> {
    // 1. Ensure active session and retrieve token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
        throw new Error("You must be logged in to use the AI chat. Please sign in and try again.");
    }

    const normalizedContents = normalizeContents(options.contents);
    if (normalizedContents.length === 0) {
        throw new Error("Cannot send empty conversation to AI.");
    }

    const payload: AiProxyOptions = {
        ...options,
        contents: normalizedContents,
    };

    // 2. Invoke edge function with explicit Authorization header
    const { data, error } = await supabase.functions.invoke("ai-proxy", {
        body: payload,
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
    });

    // 3. Extract detailed error message from response if non-2xx
    if (error) {
        let details = error.message;
        if ("context" in error && error.context) {
            try {
                const response = error.context as Response;
                const body = await response.clone().json();
                if (body?.error) {
                    details = typeof body.error === "string" ? body.error : JSON.stringify(body.error);
                } else if (body?.message) {
                    details = body.message;
                }
            } catch {
                try {
                    const text = await (error.context as Response).clone().text();
                    if (text) details = text;
                } catch {
                    // Ignore text parsing fallback
                }
            }
        }
        console.error("AI Proxy Error details:", details);
        throw new Error(details);
    }

    if (data?.error) {
        const errorMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
        console.error("AI Proxy returned error:", errorMsg);
        throw new Error(errorMsg);
    }

    if (typeof data?.text !== "string") {
        throw new Error("AI proxy returned an unexpected response format.");
    }

    return data.text;
}
