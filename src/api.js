export async function api(path, options = {}) {
  const init = {
    method: options.method || (options.json ? 'POST' : 'GET'),
    credentials: 'include',
    headers: { Accept: 'application/json', ...(options.headers || {}) }
  };
  if (options.json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.json);
  } else if (options.body) init.body = options.body;
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({ data: null, error: { message: 'Respons server tidak valid.' } }));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Permintaan gagal (${response.status})`);
    error.code = payload.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export function formatMoney(value) {
  if (value === null || value === undefined) return 'Tidak disebutkan';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}
