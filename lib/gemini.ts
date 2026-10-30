// Which models to call, in what order, lives in the llm_models table now (see lib/pipeline.ts).
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Give up on a model that hasn't answered in this long and try the next one.
const ATTEMPT_TIMEOUT_MS = 18_000;

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export interface GeminiReply {
    text: string;
    inputTokens: number | null;
    outputTokens: number | null;
}

// One call to one Gemini model. With a schema the reply is JSON text; without one it's plain text.
export async function callGemini(opts: {
    model: string;
    baseUrl?: string | null;
    parts: Part[];
    temperature: number;
    schema?: object | null;
}): Promise<GeminiReply> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError(500, 'GEMINI_API_KEY is not set');

    let response: Response;
    try {
        response = await fetch(`${opts.baseUrl || DEFAULT_BASE_URL}/models/${opts.model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: opts.parts }],
                generationConfig: {
                    temperature: opts.temperature,
                    ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
                },
            }),
            signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        });
    } catch (err) {
        throw new GeminiError(504, err instanceof Error ? err.message : 'request failed');
    }

    if (!response.ok) {
        throw new GeminiError(response.status, (await response.text()).slice(0, 2000));
    }

    const data = await response.json();
    return {
        text: data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '',
        inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
    };
}

export const HOUSE_RULES = `Rules:
- Keep it PG-13. No slurs, no punching down, no jokes about anyone's body, race, religion, gender, or sexuality.
- Never try to identify real people in a photo or guess their names.
- Specific beats generic. Make the joke about something real.`;
