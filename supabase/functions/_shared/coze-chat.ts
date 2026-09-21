import type { ProviderConfig } from './ai-gateway.ts';

type JsonObject = Record<string, unknown>;

export type CozeChatOptions = {
  body: JsonObject;
  signal: AbortSignal;
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
  fetcher?: typeof fetch;
};

function jsonResponse(body: JsonObject, status: number, providerErrorCode = ''): Response {
  const safeProviderCode = String(providerErrorCode || '').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(safeProviderCode ? { 'X-JAY-Provider-Error-Code': safeProviderCode } : {}),
    },
  });
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function cozeErrorStatus(result: JsonObject, httpStatus = 502): number {
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) return httpStatus;
  const code = Number(result.code || 0);
  const message = String(result.msg || result.message || '').toLowerCase();
  if ([401, 4100, 4101].includes(code) || /unauthori|invalid token|access token|认证|令牌/.test(message)) return 401;
  if (code === 429 || /rate.?limit|too many|frequency|频率|限流/.test(message)) return 429;
  return httpStatus >= 400 && httpStatus < 500 ? httpStatus : 502;
}

async function readCozeResponse(response: Response): Promise<{ result: JsonObject; error: Response | null }> {
  let result: JsonObject;
  try {
    result = objectValue(await response.json());
  } catch {
    return { result: {}, error: jsonResponse({ code: 'COZE_INVALID_RESPONSE', message: 'Coze returned invalid JSON' }, 502) };
  }
  if (!response.ok || Number(result.code || 0) !== 0) {
    return { result, error: jsonResponse(result, cozeErrorStatus(result, response.status), String(result.code || response.status)) };
  }
  return { result, error: null };
}

function queryUrl(base: string, path: string, conversationId: string, chatId: string): string {
  const query = new URLSearchParams({ conversation_id: conversationId, chat_id: chatId });
  return `${base}${path}?${query.toString()}`;
}

function waitForPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('The Coze request timed out', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('The Coze request timed out', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Coze Chat v3 is asynchronous even when stream=false. Create a chat, poll
 * its status, then list messages and return a normalized provider response.
 */
export async function invokeCozeChat(config: ProviderConfig, options: CozeChatOptions): Promise<Response> {
  const fetcher = options.fetcher || fetch;
  const headers = { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
  const createdResponse = await fetcher(`${config.url}/v3/chat`, {
    method: 'POST', headers, body: JSON.stringify(options.body), signal: options.signal,
  });
  const created = await readCozeResponse(createdResponse);
  if (created.error) return created.error;
  const createdData = objectValue(created.result.data);
  const chatId = String(createdData.id || createdData.chat_id || '');
  const conversationId = String(createdData.conversation_id || '');
  if (!chatId || !conversationId) {
    return jsonResponse({ code: 'COZE_CHAT_ID_MISSING', message: 'Coze did not return chat and conversation identifiers' }, 502);
  }

  const terminalFailure = new Set(['failed', 'canceled', 'cancelled', 'requires_action']);
  let chatData = createdData;
  let status = String(chatData.status || '').toLowerCase();
  const pollIntervalMs = Math.max(200, Math.min(3_000, Number(options.pollIntervalMs || 500)));
  const pollMaxAttempts = Math.max(1, Math.min(120, Number(options.pollMaxAttempts || 60)));
  for (let attempt = 0; status !== 'completed' && attempt < pollMaxAttempts; attempt += 1) {
    if (terminalFailure.has(status)) {
      const lastError = objectValue(chatData.last_error || chatData.error);
      const upstreamCode = String(lastError.code || lastError.error_code || status);
      const message = String(lastError.msg || lastError.message || status);
      return jsonResponse({ code: 'COZE_CHAT_FAILED', message, data: chatData }, 502, upstreamCode);
    }
    await waitForPoll(pollIntervalMs, options.signal);
    const retrieveResponse = await fetcher(queryUrl(config.url, '/v3/chat/retrieve', conversationId, chatId), {
      // Coze's official SDK uses POST for retrieve; GET returns 405.
      method: 'POST', headers, signal: options.signal,
    });
    const retrieved = await readCozeResponse(retrieveResponse);
    if (retrieved.error) return retrieved.error;
    chatData = objectValue(retrieved.result.data);
    status = String(chatData.status || '').toLowerCase();
  }
  if (status !== 'completed') {
    throw new DOMException('The Coze chat polling timed out', 'AbortError');
  }

  const messagesResponse = await fetcher(queryUrl(config.url, '/v3/chat/message/list', conversationId, chatId), {
    method: 'GET', headers, signal: options.signal,
  });
  const messagesResult = await readCozeResponse(messagesResponse);
  if (messagesResult.error) return messagesResult.error;
  const messagesData = messagesResult.result.data;
  const messages = Array.isArray(messagesData)
    ? messagesData
    : Array.isArray(objectValue(messagesData).messages) ? objectValue(messagesData).messages : [];
  return jsonResponse({
    code: 0,
    data: { chat_id: chatId, conversation_id: conversationId, status, messages, usage: chatData.usage || createdData.usage || {} },
  }, 200);
}
