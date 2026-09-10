export const PRODUCTION_ACCEPTANCE_SCENARIOS = Object.freeze([
  'rate_limit',
  'quota',
  'provider_timeout',
]);

const encoder = new TextEncoder();

export function productionAcceptanceMessage(issuedAt, userId, scenario, requestId) {
  return `v1\n${issuedAt}\n${userId}\n${scenario}\n${requestId}`;
}

function decodeHex(value) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

export async function verifyProductionAcceptanceFault(headers, options) {
  const scenario = String(headers.get('X-JAY-Acceptance-Scenario') || '').trim();
  const proof = String(headers.get('X-JAY-Acceptance') || '').trim();
  if (!scenario && !proof) return { requested: false, scenario: null, error: null };
  if (!scenario || !proof || !PRODUCTION_ACCEPTANCE_SCENARIOS.includes(scenario)) {
    return { requested: true, scenario: null, error: 'ACCEPTANCE_SIGNATURE_INVALID' };
  }

  const parts = proof.split('.');
  const issuedAt = Number(parts[0]);
  const signature = parts.length === 2 ? decodeHex(parts[1]) : null;
  const nowMs = Number(options.nowMs ?? Date.now());
  const maxAgeSeconds = Math.max(1, Number(options.maxAgeSeconds ?? 300));
  if (!Number.isInteger(issuedAt) || !signature || Math.abs(Math.floor(nowMs / 1000) - issuedAt) > maxAgeSeconds) {
    return { requested: true, scenario: null, error: 'ACCEPTANCE_SIGNATURE_INVALID' };
  }

  const serviceKey = String(options.serviceKey || '');
  const userId = String(options.userId || '');
  const requestId = String(options.requestId || '');
  if (!serviceKey || !userId || !requestId) {
    return { requested: true, scenario: null, error: 'ACCEPTANCE_SIGNATURE_INVALID' };
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(serviceKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(productionAcceptanceMessage(issuedAt, userId, scenario, requestId)),
    );
    return valid
      ? { requested: true, scenario, error: null }
      : { requested: true, scenario: null, error: 'ACCEPTANCE_SIGNATURE_INVALID' };
  } catch {
    return { requested: true, scenario: null, error: 'ACCEPTANCE_SIGNATURE_INVALID' };
  }
}
