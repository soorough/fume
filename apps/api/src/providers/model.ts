import { env } from '../config';

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
      signal: AbortSignal.timeout(30000),
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

export function resolveProvider(): ModelProvider {
  return env.DEFAULT_PROVIDER === 'deepseek'
    ? new DeepSeekProvider()
    : new MockProvider();
}
