export function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max);
}

export function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}

export function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function asInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
