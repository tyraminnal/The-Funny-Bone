export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Tried in order when the main model is overloaded or rate limited.
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-latest'];

// Give up on a model that hasn't answered in this long and try the next one.
const ATTEMPT_TIMEOUT_MS = 18_000;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

// Calls Gemini and returns its JSON reply parsed against the given schema,
// plus the model that answered.
export async function generateJson<T>(parts: Part[], responseSchema: object): Promise<{ data: T; model: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError(500, 'GEMINI_API_KEY is not set');

    const models = [GEMINI_MODEL, ...FALLBACK_MODELS.filter((m) => m !== GEMINI_MODEL)];
    let lastError = new GeminiError(500, 'No models tried');

    for (const model of models) {
        let response: Response;
        try {
            response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts }],
                        generationConfig: { temperature: 1.0, responseMimeType: 'application/json', responseSchema },
                    }),
                    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
                }
            );
        } catch (err) {
            lastError = new GeminiError(504, `${model}: ${err instanceof Error ? err.message : 'request failed'}`);
            continue;
        }

        if (!response.ok) {
            lastError = new GeminiError(response.status, `${model}: ${await response.text()}`);
            // Busy or out of quota: try the next model. Anything else is a real error.
            if (response.status === 429 || response.status >= 500 || response.status === 404) continue;
            throw lastError;
        }

        const data = await response.json();
        const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        try {
            return { data: JSON.parse(text) as T, model };
        } catch {
            throw new GeminiError(422, `Unparseable reply from ${model}: ${JSON.stringify(data).slice(0, 500)}`);
        }
    }

    throw lastError;
}

export const HOUSE_RULES = `Rules:
- Keep it PG-13. No slurs, no punching down, no jokes about anyone's body, race, religion, gender, or sexuality.
- Never try to identify real people in a photo or guess their names.
- Specific beats generic. Make the joke about something real.`;
