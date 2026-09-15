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

function env(name: string): string {
  return String(Deno.env.get(name) || '').trim();
}

function baseUrl(value: string, fallback: string): string {
  return (value || fallback).replace(/\/$/, '');
}

export function providerConfig(provider: GatewayProvider): ProviderConfig | null {
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
      const botId = env('COZE_BOT_ID');
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
  if (config.style === 'coze_chat') return `${config.url}/open_api/v3/chat`;
  return `${config.url}/chat/completions`;
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
  options: { maxTokens: number; temperature: number; withSearch: boolean; userId: string },
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
      auto_save_history: false,
      additional_messages: messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : message.role,
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

function textFrom(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return textFrom(row.text || row.content || row.output_text);
      }
      return '';
    }).filter(Boolean).join('\n').trim();
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return textFrom(row.text || row.content || row.output_text);
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
      content = dataRow.messages.map((item) => item && typeof item === 'object'
        ? textFrom((item as Record<string, unknown>).content)
        : '').filter(Boolean).join('\n').trim();
    }
  } else {
    const choice = Array.isArray(result.choices) ? result.choices[0] : null;
    const message = choice && typeof choice === 'object' ? (choice as Record<string, unknown>).message : null;
    content = textFrom(message) || textFrom(result.content);
  }
  const usage = result.usage && typeof result.usage === 'object' ? result.usage as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || usage.input_tokens || 0));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || usage.output_tokens || 0));
  const totalTokens = Math.max(0, Number(usage.total_tokens || 0), inputTokens + outputTokens);
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
