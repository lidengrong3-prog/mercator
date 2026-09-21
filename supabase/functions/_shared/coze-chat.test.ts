import { invokeCozeChat } from './coze-chat.ts';
import type { ProviderConfig } from './ai-gateway.ts';

const config: ProviderConfig = {
  provider: 'coze', style: 'coze_chat', key: 'test-token', url: 'https://api.coze.cn', model: 'bot:test', botId: 'bot-1',
};

Deno.test('Coze v3 adapter creates, polls, and reads answer messages', async () => {
  const calls: string[] = [];
  const methods: string[] = [];
  const responses = [
    { code: 0, data: { id: 'chat-1', conversation_id: 'conversation-1', status: 'in_progress' } },
    { code: 0, data: { id: 'chat-1', conversation_id: 'conversation-1', status: 'completed' } },
    { code: 0, data: { messages: [{ type: 'answer', content: '报告已完成' }, { type: 'verbose', content: 'ignored' }] } },
  ];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    methods.push(String(init?.method || 'GET'));
    return new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const result = await invokeCozeChat(config, {
    body: { bot_id: 'bot-1', user_id: 'user-1', stream: false },
    signal: new AbortController().signal,
    pollIntervalMs: 1,
    pollMaxAttempts: 3,
    fetcher,
  });
  const body = await result.json();
  if (result.status !== 200 || body.data.messages[0].content !== '报告已完成') throw new Error('Coze async flow failed');
  if (!calls[0].endsWith('/v3/chat') || !calls[1].includes('/v3/chat/retrieve?') || !calls[2].includes('/v3/chat/message/list?')) throw new Error(`unexpected Coze endpoints: ${calls}`);
  if (methods.join(',') !== 'POST,POST,GET') throw new Error(`unexpected Coze methods: ${methods}`);
});

Deno.test('Coze v3 adapter maps API authentication errors', async () => {
  const result = await invokeCozeChat(config, {
    body: { bot_id: 'bot-1' },
    signal: new AbortController().signal,
    fetcher: (async () => new Response(JSON.stringify({ code: 4101, msg: 'invalid token' }), { status: 200 })) as typeof fetch,
  });
  if (result.status !== 401) throw new Error(`expected 401, received ${result.status}`);
  if (result.headers.get('X-JAY-Provider-Error-Code') !== '4101') throw new Error('Coze error code was not preserved safely');
});
