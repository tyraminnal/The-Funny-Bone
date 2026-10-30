import type { SupabaseClient } from '@supabase/supabase-js';
import { GeminiError, HOUSE_RULES, type Part, callGemini } from './gemini';

// Runs a prompt chain from the database and logs every model call, so Funny
// Bone HQ can show what was asked, what came back, and how long it took.
// Server only: needs the service role client.

export type ChainKind = 'captions' | 'battle' | 'meme';

interface Model {
    id: number;
    api_model_id: string;
    llm_providers: { slug: string; api_base_url: string | null };
}

interface Step {
    id: number;
    step_order: number;
    name: string;
    prompt_template: string;
    output_format: 'text' | 'json';
    include_image: boolean;
    temperature: number;
    llm_model_id: number | null;
}

interface Chain {
    id: number;
    weight: number;
    steps: Step[];
}

export interface RequestHandle {
    id: string;
    startedAt: number;
}

// Busy, out of quota, unknown model, or a provider we can't call: try the next model.
const retryable = (status: number) => status === 429 || status === 404 || status >= 500;

function render(template: string, vars: Record<string, string>): string {
    return template
        .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
        .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
        .trim();
}

// Picks one of the feature's chains at random, weighted by prompt_chain_mix.
async function pickChain(admin: SupabaseClient, kind: ChainKind): Promise<Chain> {
    const { data, error } = await admin
        .from('prompt_chains')
        .select('id, prompt_chain_mix(weight), prompt_chain_steps(id, step_order, name, prompt_template, output_format, include_image, temperature, llm_model_id)')
        .eq('used_for', kind)
        .order('id');
    if (error) throw new GeminiError(500, `prompt chains: ${error.message}`);

    const chains: Chain[] = (data ?? [])
        .map((c) => {
            const mix = c.prompt_chain_mix as { weight: number } | { weight: number }[] | null;
            return {
                id: c.id as number,
                weight: (Array.isArray(mix) ? mix[0]?.weight : mix?.weight) ?? 0,
                steps: ((c.prompt_chain_steps ?? []) as Step[]).sort((a, b) => a.step_order - b.step_order),
            };
        })
        .filter((c) => c.steps.length > 0);
    if (chains.length === 0) throw new GeminiError(500, `No prompt chain is set up for ${kind}`);

    const total = chains.reduce((s, c) => s + c.weight, 0);
    if (total === 0) return chains[0];
    let roll = Math.random() * total;
    return chains.find((c) => (roll -= c.weight) < 0) ?? chains[chains.length - 1];
}

async function activeModels(admin: SupabaseClient): Promise<Model[]> {
    const { data, error } = await admin
        .from('llm_models')
        .select('id, api_model_id, llm_providers(slug, api_base_url)')
        .eq('is_active', true)
        .order('priority')
        .order('id');
    if (error) throw new GeminiError(500, `llm models: ${error.message}`);
    return (data ?? []) as unknown as Model[];
}

// Campus terms and few-shot examples, formatted for {{terms}} and {{examples}}.
async function promptExtras(admin: SupabaseClient, kind: ChainKind): Promise<{ terms: string; examples: string }> {
    const [{ data: terms }, { data: examples }] = await Promise.all([
        admin.from('terms').select('term, definition').order('term').limit(40),
        kind === 'meme'
            ? Promise.resolve({ data: [] })
            : admin
                  .from('generation_examples')
                  .select('image_description, caption, voice')
                  .eq('used_for', kind)
                  .eq('is_active', true)
                  .order('created_at', { ascending: false })
                  .limit(6),
    ]);
    return {
        terms: terms?.length
            ? `Campus words the audience knows (use one only if it fits naturally):\n${terms.map((t) => `- ${t.term}: ${t.definition}`).join('\n')}`
            : '',
        examples: examples?.length
            ? `Captions that got big laughs before, for the style. Don't copy them:\n${examples
                  .map((e) => `- Photo: ${e.image_description}${e.voice ? ` (voice: ${e.voice})` : ''}. Caption: "${e.caption}"`)
                  .join('\n')}`
            : '',
    };
}

async function log(admin: SupabaseClient, row: Record<string, unknown>) {
    const { error } = await admin.from('llm_responses').insert(row);
    if (error) console.error('LLM response log error:', error);
}

// Runs one step, falling back through the active models. Logs every attempt.
async function runStep(
    admin: SupabaseClient,
    request: RequestHandle,
    step: Step,
    models: Model[],
    prompt: string,
    image: Part | null,
    schema: object | null,
): Promise<{ text: string; model: string }> {
    const preferred = models.find((m) => m.id === step.llm_model_id);
    const order = preferred ? [preferred, ...models.filter((m) => m !== preferred)] : models;
    if (order.length === 0) throw new GeminiError(500, 'No active LLM models');

    let lastError = new GeminiError(500, 'No models tried');
    for (const model of order) {
        const started = Date.now();
        let text: string | null = null;
        let tokens: { inputTokens: number | null; outputTokens: number | null } = { inputTokens: null, outputTokens: null };
        let error: GeminiError | null = null;

        if (model.llm_providers.slug !== 'google') {
            error = new GeminiError(501, `The app can't call ${model.llm_providers.slug} models yet`);
        } else {
            try {
                const reply = await callGemini({
                    model: model.api_model_id,
                    baseUrl: model.llm_providers.api_base_url,
                    parts: image ? [{ text: prompt }, image] : [{ text: prompt }],
                    temperature: Number(step.temperature),
                    schema,
                });
                text = reply.text;
                tokens = reply;
            } catch (err) {
                error = err instanceof GeminiError ? err : new GeminiError(500, String(err));
            }
        }

        await log(admin, {
            request_id: request.id,
            step_id: step.id,
            step_order: step.step_order,
            llm_model_id: model.id,
            model: model.api_model_id,
            prompt,
            response_text: text,
            http_status: error ? error.status : 200,
            error: error?.message ?? null,
            duration_ms: Date.now() - started,
            input_tokens: tokens.inputTokens,
            output_tokens: tokens.outputTokens,
        });

        if (text !== null) return { text, model: model.api_model_id };
        lastError = new GeminiError(error!.status, `${model.api_model_id}: ${error!.message}`);
        if (!retryable(error!.status)) throw lastError;
    }
    throw lastError;
}

export async function failRequest(admin: SupabaseClient, request: RequestHandle, error: string) {
    await admin
        .from('generation_requests')
        .update({ status: 'failed', error: error.slice(0, 2000), duration_ms: Date.now() - request.startedAt, finished_at: new Date().toISOString() })
        .eq('id', request.id);
}

export async function finishRequest(
    admin: SupabaseClient,
    request: RequestHandle,
    links: { generation_id?: string; battle_id?: string; meme_id?: string; image_url?: string },
) {
    await admin
        .from('generation_requests')
        .update({ status: 'succeeded', ...links, duration_ms: Date.now() - request.startedAt, finished_at: new Date().toISOString() })
        .eq('id', request.id);
}

// Picks a chain for the feature, runs its steps in order, and parses the last
// step's reply against the schema. The request is left "running": call
// finishRequest or failRequest once the result is saved (or isn't). If the
// chain itself fails, the request is marked failed and a GeminiError is thrown.
export async function runChain<T>(
    admin: SupabaseClient,
    opts: {
        kind: ChainKind;
        userId: string | null;
        vars: Record<string, string>;
        image?: { mimeType: string; base64: string };
        schema: object;
    },
): Promise<{ data: T; model: string; prompt: string; request: RequestHandle }> {
    const [chain, models, extras] = await Promise.all([
        pickChain(admin, opts.kind),
        activeModels(admin),
        promptExtras(admin, opts.kind),
    ]);

    const startedAt = Date.now();
    const { data: row, error } = await admin
        .from('generation_requests')
        .insert({ kind: opts.kind, user_id: opts.userId, chain_id: chain.id })
        .select('id')
        .single();
    if (error || !row) throw new GeminiError(500, `generation request: ${error?.message}`);
    const request = { id: row.id as string, startedAt };

    const image: Part | null = opts.image ? { inline_data: { mime_type: opts.image.mimeType, data: opts.image.base64 } } : null;
    const vars: Record<string, string> = { house_rules: HOUSE_RULES, ...extras, ...opts.vars, previous_output: '' };
    const prompts: string[] = [];

    try {
        let reply = { text: '', model: '' };
        for (const [i, step] of chain.steps.entries()) {
            const last = i === chain.steps.length - 1;
            const prompt = render(step.prompt_template, vars);
            prompts.push(chain.steps.length > 1 ? `## Step ${step.step_order}: ${step.name}\n${prompt}` : prompt);
            reply = await runStep(admin, request, step, models, prompt, step.include_image ? image : null, last ? opts.schema : null);
            vars.previous_output = reply.text.trim();
        }

        let data: T;
        try {
            data = JSON.parse(reply.text) as T;
        } catch {
            throw new GeminiError(422, `Unparseable reply from ${reply.model}: ${reply.text.slice(0, 500)}`);
        }
        return { data, model: reply.model, prompt: prompts.join('\n\n'), request };
    } catch (err) {
        await failRequest(admin, request, err instanceof Error ? err.message : String(err));
        throw err;
    }
}
