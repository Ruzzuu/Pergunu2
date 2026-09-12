import { api } from '../../api';

export const newsView = n => ({ ...n, image: n.imageUrl || '', publishDate: n.publishedAt });
export const scholarshipView = s => ({ ...s, judul: s.title, nominal: s.amount, tanggal_mulai: s.startsAt, deskripsi: s.description, persyaratan: s.requirements, kategori: s.category, status: s.status === 'open' ? 'Aktif' : 'Ditutup' });
export const certificateView = c => ({ ...c, fileName: c.originalName, uploadDate: c.uploadedAt, fileUrl: c.downloadUrl });
const userView = u => ({ ...u, username: u.username || '', position: u.position || '', address: u.address || '', phone: u.phone || '', certificates: (u.certificates || []).map(certificateView) });

// Explicit compatibility boundary for the original components, never a global fetch override.
export async function legacyFetch(input, init = {}) {
  const url = new URL(input, window.location.origin);
  const path = url.pathname.replace(/^\/api/, '');
  const method = init.method || 'GET';
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
  let data;
  try {
    if (path.startsWith('/news')) {
      const [, , id, action] = path.split('/');
      const admin = window.location.pathname === '/admin';
      if (method === 'GET') {
        data = await api(id ? `/api/news/${id}` : admin ? '/api/admin/news' : '/api/news');
        data = Array.isArray(data) ? data.map(newsView) : newsView(data);
      } else if (action === 'feature') {
        const current = (await api('/api/admin/news')).find(n => n.id === id);
        data = newsView(await api(`/api/admin/news/${id}`, { method: 'PUT', json: { ...current, imageKey: current.imageUrl?.split('/').pop(), featured: true, published: !!current.publishedAt } }));
      } else {
        data = await api(`/api/admin/news${id ? `/${id}` : ''}`, { method, ...(body ? { json: { ...body, imageKey: body.image?.startsWith('/media/images/') ? body.image.split('/').pop() : undefined } } : {}) });
        if (method !== 'DELETE') data = newsView(data);
      }
    } else if (path.startsWith('/beasiswa-applications')) {
      data = await api('/api/scholarship-applications', { json: { ...body, scholarshipId: body.beasiswaId, reason: body.motivation } });
    } else if (path.startsWith('/beasiswa')) {
      const [, , id, category] = path.split('/');
      if (method === 'GET') {
        let list = await api(window.location.pathname === '/admin' ? '/api/admin/scholarships' : '/api/scholarships');
        if (id === 'kategori') list = list.filter(s => s.category === decodeURIComponent(category));
        data = id && id !== 'kategori' ? scholarshipView(list.find(s => s.id === id) || {}) : list.map(scholarshipView);
      } else {
        data = await api(`/api/admin/scholarships${id ? `/${id}` : ''}`, { method, ...(body ? { json: { title: body.judul, amount: Number(String(body.nominal).replace(/[^0-9]/g, '')), startsAt: body.tanggal_mulai, deadline: body.deadline, description: body.deskripsi, requirements: body.persyaratan, category: body.kategori, status: (!body.status || /aktif|dibuka|open/i.test(body.status)) ? 'open' : 'closed' } } : {}) });
        if (method !== 'DELETE') data = scholarshipView(data);
      }
    } else if (path === '/upload/image') {
      data = await api('/api/admin/media/images', { method: 'POST', body });
    } else if (path === '/upload-certificate') {
      const id = body.get('userId');
      data = { certificate: certificateView(await api(`/api/admin/users/${id}/certificates`, { method: 'POST', body })) };
    } else if (path.startsWith('/delete-certificate/')) {
      data = await api(`/api/admin/certificates/${path.split('/').pop()}`, { method: 'DELETE' });
    } else if (path.startsWith('/users')) {
      const id = path.split('/')[2];
      const admin = window.location.pathname === '/admin';
      if (method === 'GET' || (method === 'PATCH' && body.certificates)) {
        if (admin) {
          const users = await api('/api/admin/users');
          data = await Promise.all(users.filter(u => !id || u.id === id).map(async u => userView({ ...u, certificates: await api(`/api/admin/users/${u.id}/certificates`) })));
          if (id) data = data[0];
        } else {
          const { user } = await api('/api/auth/me');
          data = userView({ ...user, certificates: await api('/api/account/certificates') });
        }
      } else data = await api(`/api/admin/users${id ? `/${id}` : ''}`, { method, ...(body ? { json: body } : {}) });
    } else if (path === '/applications' && method === 'POST') {
      data = await api('/api/membership-applications', { json: { ...body, regionalBranch: body.pw, localBranch: body.pc } });
    } else throw new Error(`Endpoint belum didukung: ${path}`);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message, message: error.message }, { status: error.status || 500 });
  }
}

export async function synchronizeSession() {
  for (const key of ['adminAuth', 'userAuth', 'loggedInUser', 'currentUser', 'applications', 'applications_mode', 'users']) localStorage.removeItem(key);
  try {
    const { user } = await api('/api/auth/me');
    const display = { ...user, userId: user.id };
    localStorage.setItem(user.role === 'admin' ? 'adminAuth' : 'userAuth', JSON.stringify(display));
    return user;
  } catch { return null; }
}

export async function logoutSession() {
  await api('/api/auth/logout', { method: 'POST', json: {} });
  for (const key of ['adminAuth', 'userAuth', 'loggedInUser', 'currentUser']) localStorage.removeItem(key);
}
