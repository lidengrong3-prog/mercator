import {
  parseProviderResult,
  providerRequestBody,
  providerTaskAllowed,
  type ProviderConfig,
} from './ai-gateway.ts';

const messages = [
  { role: 'system', content: 'You are a test assistant.' },
  { role: 'user', content: '分析当前市场' },
];

Deno.test('Responses adapter uses input/max_output_tokens and parses output_text usage', () => {
  const config: ProviderConfig = { provider: 'openai', style: 'openai_responses', key: 'test', url: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' };
  const body = providerRequestBody(config, messages, { maxTokens: 500, temperature: 0.2, withSearch: false, userId: 'user-1' });
  if (!Array.isArray(body.input) || body.max_output_tokens !== 500 || body.messages) throw new Error('invalid Responses request body');
  const parsed = parseProviderResult(config, { output_text: '回答', usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 } });
  if (parsed.content !== '回答' || parsed.inputTokens !== 12 || parsed.outputTokens !== 8 || parsed.totalTokens !== 20) throw new Error('invalid Responses result parsing');
});

Deno.test('Coze adapter carries bot chat messages and parses assistant content', () => {
  const config: ProviderConfig = { provider: 'coze', style: 'coze_chat', key: 'test', url: 'https://api.coze.cn', model: 'bot:test', botId: 'bot-1' };
  const body = providerRequestBody(config, messages, { maxTokens: 500, temperature: 0.2, withSearch: false, userId: 'user-1' });
  if (body.bot_id !== 'bot-1' || !Array.isArray(body.additional_messages)) throw new Error('invalid Coze request body');
  const parsed = parseProviderResult(config, { code: 0, data: { messages: [{ role: 'assistant', content: 'Coze 回答' }] } });
  if (parsed.content !== 'Coze 回答') throw new Error('invalid Coze result parsing');
});

Deno.test('Codex is restricted to maintenance tasks and WorkBuddy remains disabled', () => {
  if (providerTaskAllowed('codex', 'market_qa') || !providerTaskAllowed('codex', 'code')) throw new Error('Codex task policy is invalid');
  if (providerTaskAllowed('workbuddy', 'code')) throw new Error('WorkBuddy must remain disabled');
});
