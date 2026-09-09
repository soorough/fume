import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config';

// Alexa gives a skill ~8s total. The Lambda, the hop to this API, memory
// retrieval and the message write all come out of that budget, so the model
// gets about half. A longer timeout does not fail gracefully — Alexa simply
// abandons the session and the user hears nothing.
const MODEL_TIMEOUT_MS = 5000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  messages: ChatMessage[];
  temperature?: number;
}

export interface ModelProvider {
  name: string;
  generate(req: GenerateRequest): Promise<{ text: string }>;
}

export class MockProvider implements ModelProvider {
  name = 'mock';

  async generate(req: GenerateRequest): Promise<{ text: string }> {
    const last = [...req.messages].reverse().find((m) => m.role === 'user');
    return {
      text: last ? `(mock) you said: ${last.content}` : '(mock) hello.',
    };
  }
}

export class DeepSeekProvider implements ModelProvider {
  name = 'deepseek';

  async generate({
    messages,
    temperature = 0.7,
  }: GenerateRequest): Promise<{ text: string }> {
    const res = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.DEEPSEEK_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL,
        messages,
        temperature,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`deepseek ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices[0]?.message?.content;
    if (!text) throw new Error('deepseek returned no text');
    return { text };
  }
}

export class ClaudeProvider implements ModelProvider {
  name = 'claude';

  private client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY ?? '',
    timeout: MODEL_TIMEOUT_MS,
    maxRetries: 0,
  });

  async generate({
    messages,
  }: GenerateRequest): Promise<{ text: string }> {
    // Anthropic takes the system prompt as its own parameter rather than a
    // message role, so lift every system turn out of the conversation.
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1000,
      // Low effort keeps the turn inside Alexa's window while staying on the
      // stronger model; the persona already caps replies at a few sentences.
      output_config: { effort: 'low' },
      ...(system ? { system } : {}),
      messages: turns,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw new Error('claude returned no text');
    return { text };
  }
}

export function resolveProvider(): ModelProvider {
  switch (env.DEFAULT_PROVIDER) {
    case 'claude':
      return new ClaudeProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    default:
      return new MockProvider();
  }
}
