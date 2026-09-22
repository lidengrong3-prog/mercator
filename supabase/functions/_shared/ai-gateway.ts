/**
 * Provider-neutral AI gateway primitives. Secrets are read only from the
 * Edge Function environment; this module never returns them to callers.
 */
export type GatewayProvider = 'deepseek' | 'coze' | 'doubao' | 'openai' | 'codex' | 'workbuddy';
export type ProviderStyle = 'openai_chat' | 'openai_responses' | 'coze_chat';

export type ProviderConfig = {
  provider: GatewayProvider;
  style: ProviderStyle;
  key: string;
  url: string;
  model: string;
  botId?: string;
};

export type ProviderConfigOptions = {
  taskType?: string;
  agentKey?: string;
};

export async function cozeScopedIdentity(workspaceId: string, userId: string): Promise<{ userId: string; workspaceId: string }> {
  const digest = async (label: string, value: string) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`jay-coze:${label}:${value}`));
    return Array.from(new Uint8Array(bytes)).map((item) => item.toString(16).padStart(2, '0')).join('');
  };
  const [scope, subject] = await Promise.all([digest('workspace', workspaceId), digest('user', `${workspaceId}:${userId}`)]);
  return { workspaceId: `scope_${scope.slice(0, 48)}`, userId: `user_${subject.slice(0, 48)}` };
}

function env(name: string): string {
  return String(Deno.env.get(name) || '').trim();
}

function baseUrl(value: string, fallback: string): string {
  return (value || fallback).replace(/\/$/, '');
}

function cozeBotId(taskType = '', agentKey = ''): string {
  const task = String(taskType).toLowerCase();
  const agent = String(agentKey).toLowerCase();
  const taskEnv = task === 'report' || agent === 'report_generator'
    ? 'COZE_BOT_ID_REPORT'
    : task === 'course_qa' || agent === 'course_assistant'
      ? 'COZE_BOT_ID_COURSE'
      : task === 'market_qa' || agent === 'market_analyst'
        ? 'COZE_BOT_ID_MARKET_QA'
        : '';
  return (taskEnv ? env(taskEnv) : '') || env('COZE_BOT_ID');
}

export function providerConfig(provider: GatewayProvider, options: ProviderConfigOptions = {}): ProviderConfig | null {
  switch (provider) {
    case 'deepseek': {
      const key = env('DEEPSEEK_API_KEY');
      return key ? {
        provider, style: 'openai_chat', key,
        url: baseUrl(env('DEEPSEEK_API_URL'), 'https://api.deepseek.com'),
        model: env('DEEPSEEK_MODEL') || 'deepseek-chat',
      } : null;
    }
    case 'doubao': {
      const key = env('DOUBAO_API_KEY') || env('ARK_API_KEY');
      return key ? {
        provider, style: 'openai_chat', key,
        url: baseUrl(env('DOUBAO_API_URL') || env('ARK_BASE_URL'), 'https://ark.cn-beijing.volces.com/api/v3'),
        model: env('DOUBAO_MODEL') || env('ARK_MODEL') || '',
      } : null;
    }
    case 'openai': {
      const key = env('OPENAI_API_KEY');
      return key ? {
        provider, style: 'openai_responses', key,
        url: baseUrl(env('OPENAI_API_URL'), 'https://api.openai.com/v1'),
        model: env('OPENAI_MODEL') || 'gpt-4.1-mini',
      } : null;
    }
    case 'codex': {
      const key = env('CODEX_API_KEY') || env('OPENAI_API_KEY');
      return key ? {
        provider, style: 'openai_responses', key,
        url: baseUrl(env('CODEX_API_URL') || env('OPENAI_API_URL'), 'https://api.openai.com/v1'),
        model: env('CODEX_MODEL') || env('OPENAI_MODEL') || 'gpt-5-codex',
      } : null;
    }
    case 'coze': {
      const key = env('COZE_API_TOKEN') || env('COZE_API_KEY');
      const botId = cozeBotId(options.taskType, options.agentKey);
      return key && botId ? {
        provider, style: 'coze_chat', key, botId,
        url: baseUrl(env('COZE_API_URL'), 'https://api.coze.cn'),
        model: env('COZE_MODEL') || `bot:${botId}`,
      } : null;
    }
    case 'workbuddy':
    default:
      // WorkBuddy stays intentionally unavailable until its official API,
      // webhook, or MCP contract has been confirmed.
      return null;
  }
}

export function providerEndpoint(config: ProviderConfig): string {
  if (config.style === 'openai_responses') return `${config.url}/responses`;
  if (config.style === 'coze_chat') return `${config.url}/v3/chat`;
  return `${config.url}/chat/completions`;
}

/**
 * Return a stable, non-secret identity for the active adapter configuration.
 * The API key is deliberately excluded so this value is safe to persist in
 * request and provider-attempt audit rows.
 */
export async function providerConfigFingerprint(config: ProviderConfig): Promise<string> {
  const material = [config.provider, config.style, config.url, config.model, config.botId || ''].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return `sha256:${Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function responsesInput(messages: Array<{ role: string; content: string }>) {
  return messages.map((message) => ({
    role: message.role,
    content: [{ type: 'input_text', text: message.content }],
  }));
}

export function providerRequestBody(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  options: { maxTokens: number; temperature: number; withSearch: boolean; userId: string; workspaceId?: string; taskType?: string; agentKey?: string },
): Record<string, unknown> {
  if (config.style === 'openai_responses') {
    const body: Record<string, unknown> = {
      model: config.model,
      input: responsesInput(messages),
      max_output_tokens: options.maxTokens,
      temperature: options.temperature,
      store: false,
    };
    // Responses web search is opt-in and can be disabled independently of
    // the regular RAG path. It is never enabled for Codex maintenance calls.
    if (options.withSearch && config.provider === 'openai' && env('OPENAI_ENABLE_WEB_SEARCH') === 'true') {
      body.tools = [{ type: 'web_search_preview' }];
    }
    return body;
  }
  if (config.style === 'coze_chat') {
    return {
      bot_id: config.botId,
      user_id: options.userId.slice(0, 128),
      stream: false,
      // Message list is read after the asynchronous chat completes. Coze
      // only exposes that conversation history when auto-save is enabled.
      auto_save_history: true,
      ...(options.workspaceId || options.taskType || options.agentKey ? {
        custom_variables: {
          workspace_id: String(options.workspaceId || '').slice(0, 128),
          task_type: String(options.taskType || '').slice(0, 60),
          agent_key: String(options.agentKey || '').slice(0, 80),
          locale: 'zh-CN',
        },
      } : {}),
      additional_messages: messages.map((message) => ({
        // Coze Chat v3 accepts user/assistant message roles. System
        // instructions are already configured on the Bot; send request-scoped
        // context as a user message instead of producing an invalid payload.
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
        content_type: 'text',
      })),
    };
  }
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    stream: false,
  };
  // DeepSeek's OpenAI-compatible endpoint does not guarantee web search. The
  // experimental fields are sent only when requested; the caller retries
  // without them when the provider rejects them.
  if (options.withSearch && config.provider === 'deepseek') {
    body.web_search = { type: 'enabled' };
    body.plugins = ['web_search'];
  }
  return body;
}

export type ParsedProviderResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

function decodeEscapedText(value: string): string {
  return value
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_match, codePoint: string) => {
      const value = Number.parseInt(codePoint, 16);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : _match;
    })
    .replace(/\\u([0-9a-f]{4})/gi, (_match, codeUnit: string) => String.fromCharCode(Number.parseInt(codeUnit, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

const COZE_CONTROL_TYPES = new Set([
  'generate_answer_finish',
  'generate_answer_start',
  'message_start',
  'message_end',
  'chat_start',
  'chat_end',
  'workflow_start',
  'workflow_finish',
  'workflow_finished',
]);

function controlEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const type = String(row.msg_type || '').trim().toLowerCase();
  return Boolean(type) && (COZE_CONTROL_TYPES.has(type) || /(?:^|_)(?:start|finish|finished|end)$/.test(type));
}

function stripCozeControlEvents(value: string): string {
  const lines = value.split(/\r?\n/).filter((line) => {
    const raw = line.trim();
    if (!raw) return true;
    try {
      const parsed = JSON.parse(raw);
      return !controlEnvelope(parsed);
    } catch {
      const normalized = raw.replace(/\\"/g, '"');
      return !/^\{\s*["']msg_type["']\s*:\s*["'][^"']+["'][\s\S]*\}\s*$/.test(normalized);
    }
  });
  // Workflow nodes occasionally concatenate the event to an answer line.
  return lines.join('\n')
    .replace(/\{\s*["']msg_type["']\s*:\s*["'][^"']+["'][^{}]*\}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textFrom(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    const raw = stripCozeControlEvents(value.trim());
    // Coze may return a text message as a JSON-encoded string. Unwrap only
    // known structured text values and cap recursion for untrusted responses.
    if (depth < 3 && /^[\[{\"]/.test(raw)) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed !== value) {
          const nested = textFrom(parsed, depth + 1);
          if (nested) return nested;
        }
      } catch {
        // Ordinary Markdown beginning with a bracket is valid text; preserve it.
      }
    }
    return decodeEscapedText(raw);
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return textFrom(row.text || row.content || row.output_text || row.answer, depth + 1);
      }
      return '';
    }).filter(Boolean).join('\n').trim();
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (controlEnvelope(row)) return '';
    return textFrom(row.text || row.content || row.output_text || row.answer || row.message, depth + 1);
  }
  return '';
}

export function parseProviderResult(config: ProviderConfig, result: Record<string, unknown>): ParsedProviderResult {
  let content = '';
  if (config.style === 'openai_responses') {
    content = textFrom(result.output_text);
    if (!content && Array.isArray(result.output)) {
      content = result.output.map((item) => {
        if (!item || typeof item !== 'object') return '';
        const row = item as Record<string, unknown>;
        return textFrom(row.content || row.text || row.output_text);
      }).filter(Boolean).join('\n').trim();
    }
  } else if (config.style === 'coze_chat') {
    const data = typeof result.data === 'string'
      ? (() => { try { return JSON.parse(result.data as string); } catch { return result.data; } })()
      : result.data;
    const dataRow = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    content = textFrom(result.content) || textFrom(result.message) || textFrom(dataRow.content) || textFrom(dataRow.message);
    if (!content && Array.isArray(dataRow.messages)) {
      const answerMessages = dataRow.messages.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const row = item as Record<string, unknown>;
        return String(row.type || '').toLowerCase() === 'answer'
          || String(row.role || '').toLowerCase() === 'assistant';
      });
      content = (answerMessages.length ? answerMessages : dataRow.messages).map((item) => item && typeof item === 'object'
        ? textFrom((item as Record<string, unknown>).content)
        : '').filter(Boolean).join('\n').trim();
    }
  } else {
    const choice = Array.isArray(result.choices) ? result.choices[0] : null;
    const message = choice && typeof choice === 'object' ? (choice as Record<string, unknown>).message : null;
    content = textFrom(message) || textFrom(result.content);
  }
  const resultData = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {};
  const usageValue = result.usage || resultData.usage;
  const usage = usageValue && typeof usageValue === 'object' ? usageValue as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || usage.input_tokens || usage.input_count || 0));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || usage.output_tokens || usage.output_count || 0));
  const totalTokens = Math.max(0, Number(usage.total_tokens || usage.token_count || 0), inputTokens + outputTokens);
  return { content, inputTokens, outputTokens, totalTokens };
}

export function providerErrorCode(status: number): string {
  if (status === 401) return 'AI_PROVIDER_AUTH_FAILED';
  if (status === 403) return 'AI_PROVIDER_FORBIDDEN';
  if (status === 402) return 'AI_QUOTA_EXCEEDED';
  if (status === 429) return 'AI_RATE_LIMITED';
  return status >= 500 ? 'AI_PROVIDER_UNAVAILABLE' : 'AI_PROVIDER_ERROR';
}

export function providerTaskAllowed(provider: GatewayProvider, taskType: string): boolean {
  if (provider === 'codex') return ['code', 'automation', 'system_maintenance'].includes(taskType);
  if (provider === 'workbuddy') return false;
  return true;
}
