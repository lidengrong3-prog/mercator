function safeCompare(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyStripeSignature(rawBody, signatureHeader, secret, options = {}) {
  const parts = String(signatureHeader || '').split(',').map((part) => part.trim());
  const timestampText = (parts.find((part) => part.startsWith('t=')) || '').slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  const timestamp = Number(timestampText);
  const tolerance = Math.max(60, Number(options.toleranceSeconds || 300));
  const nowSeconds = Number(options.nowSeconds || Math.floor(Date.now() / 1000));
  if (!Number.isInteger(timestamp) || !signatures.length || Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestampText}.${rawBody}`)));
  const expected = Array.from(digest).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => safeCompare(signature, expected));
}
