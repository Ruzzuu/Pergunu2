import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, formatDate, formatMoney } from './api';
import { useAuth } from './AuthContext';
import Turnstile from './Turnstile';
import logo from './assets/logo.png';
import hero from './assets/hero.png';
import about from './assets/about.png';
import fallbackImage from './assets/noimage.png';

function Notice({ value }) {
  if (!value) return null;
  const message = typeof value === 'string' ? value : value.message;
  const kind = typeof value === 'string' ? 'success' : value.kind || 'error';
  return <div className={`notice ${kind}`}>{message}</div>;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const leave = async () => { await logout(); navigate('/'); };
  return <>
    <header className="site-header">
      <Link className="brand" to="/"><img src={logo} alt="Logo PERGUNU" /><span>PERGUNU <small>Situbondo</small></span></Link>
      <nav>
        <Link to="/#berita">Berita</Link><Link to="/beasiswa">Beasiswa</Link><Link to="/#daftar">Pendaftaran</Link>
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
        {user?.role === 'user' && <Link to="/akun">Akun</Link>}
        {user ? <button className="link-button" onClick={leave}>Keluar</button> : <Link className="nav-cta" to="/masuk">Masuk</Link>}
      </nav>
    </header>
    <main>{children}</main>
    <footer><img src={logo} alt="" /><div><strong>PERGUNU Situbondo</strong><p>Persatuan Guru Nahdlatul Ulama Kabupaten Situbondo</p></div><p>© {new Date().getFullYear()} PERGUNU Situbondo</p></footer>
  </>;
}

function Home() {
  const [news, setNews] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  useEffect(() => {
    Promise.all([api('/api/news'), api('/api/scholarships')]).then(([n, s]) => { setNews(n); setScholarships(s); }).catch(() => {});
  }, []);
  return <Shell>
    <section className="hero">
      <div><p className="eyebrow">Website resmi PERGUNU Situbondo</p><h1>Menguatkan guru, memajukan pendidikan.</h1><p>Informasi organisasi, program beasiswa, pendaftaran anggota, dan sertifikat dalam satu tempat.</p><div className="hero-actions"><a className="button" href="#daftar">Daftar anggota</a><Link className="button secondary" to="/beasiswa">Lihat beasiswa</Link></div></div>
      <img src={hero} alt="Kegiatan PERGUNU Situbondo" />
    </section>
    <section className="section split"><img src={about} alt="Tentang PERGUNU" /><div><p className="eyebrow">Tentang kami</p><h2>Wadah guru Nahdlatul Ulama</h2><p>PERGUNU membangun jejaring, meningkatkan kompetensi, dan memperjuangkan kesejahteraan guru serta tenaga kependidikan.</p></div></section>
    <section className="section" id="berita"><div className="section-heading"><div><p className="eyebrow">Kabar terbaru</p><h2>Berita PERGUNU</h2></div></div><div className="card-grid">
      {news.slice(0, 6).map((item) => <article className="card" key={item.id}><img src={item.imageUrl || fallbackImage} onError={(event) => { event.currentTarget.src = fallbackImage; }} alt="" /><div><span className="pill">{item.category}</span><h3><Link to={`/berita/${item.slug}`}>{item.title}</Link></h3><p>{item.summary || 'Baca informasi selengkapnya.'}</p><small>{formatDate(item.publishedAt)}</small></div></article>)}
      {!news.length && <Empty text="Belum ada berita yang diterbitkan." />}
    </div></section>
    <section className="section soft"><div className="section-heading"><div><p className="eyebrow">Program pendidikan</p><h2>Beasiswa dibuka</h2></div><Link to="/beasiswa">Lihat semua</Link></div><div className="compact-grid">
      {scholarships.filter((item) => item.status === 'open').slice(0, 3).map((item) => <article className="compact-card" key={item.id}><span className="pill open">Dibuka</span><h3>{item.title}</h3><strong>{formatMoney(item.amount)}</strong><p>Batas: {formatDate(item.deadline)}</p><Link to={`/beasiswa/${item.id}`}>Lihat program →</Link></article>)}
      {!scholarships.some((item) => item.status === 'open') && <Empty text="Belum ada beasiswa yang dibuka." />}
    </div></section>
    <MembershipForm />
    <StatusForm />
  </Shell>;
}

function MembershipForm() {
  const [form, setForm] = useState({});
  const [token, setToken] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const result = await api('/api/membership-applications', { json: { ...form, turnstileToken: token } });
      setNotice(`Pendaftaran diterima. Simpan nomor referensi: ${result.reference}`); setForm({});
    } catch (error) { setNotice({ message: error.message }); } finally { setBusy(false); }
  };
  return <section className="section form-section" id="daftar"><div><p className="eyebrow">Keanggotaan</p><h2>Daftar sebagai anggota</h2><p>Setelah admin menyetujui pendaftaran, Anda menerima tautan untuk membuat kata sandi sendiri.</p></div><form onSubmit={submit} className="panel form-grid"><Notice value={notice} /><label>Nama lengkap<input required name="fullName" value={form.fullName || ''} onChange={update} /></label><label>Email<input required type="email" name="email" value={form.email || ''} onChange={update} /></label><label>Nomor telepon<input name="phone" value={form.phone || ''} onChange={update} /></label><label>Jabatan<input name="position" value={form.position || ''} onChange={update} /></label><label>Sekolah/instansi<input name="school" value={form.school || ''} onChange={update} /></label><label>Cabang daerah<input name="regionalBranch" value={form.regionalBranch || ''} onChange={update} /></label><label className="full">Alamat<textarea name="address" value={form.address || ''} onChange={update} /></label><Turnstile onToken={setToken} /><button className="button full" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim pendaftaran'}</button></form></section>;
}

function StatusForm() {
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const submit = async (event) => { event.preventDefault(); setNotice(null); try { setResult(await api('/api/application-status', { json: form })); } catch (error) { setResult(null); setNotice({ message: error.message }); } };
  return <section className="section status-section"><div><p className="eyebrow">Pelacakan</p><h2>Cek status pendaftaran</h2><p>Gunakan email dan nomor referensi yang diterima saat mendaftar.</p></div><form className="inline-form" onSubmit={submit}><Notice value={notice} /><input required name="reference" placeholder="ANG-20260910-XXXXXXXX" onChange={(e) => setForm({ ...form, reference: e.target.value })} /><input required type="email" name="email" placeholder="nama@email.com" onChange={(e) => setForm({ ...form, email: e.target.value })} /><button className="button">Periksa</button>{result && <div className="status-result"><strong>{result.reference}</strong><span className={`pill ${result.status}`}>{result.status}</span><p>Dikirim {formatDate(result.submitted_at)}</p>{result.rejection_reason && <p>Catatan: {result.rejection_reason}</p>}</div>}</form></section>;
}

function NewsDetail() {
  const { id } = useParams(); const [item, setItem] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api(`/api/news/${id}`).then(setItem).catch((e) => setError(e.message)); }, [id]);
  return <Shell><section className="article">{error && <Notice value={{ message: error }} />}{!item && !error && <p>Memuat…</p>}{item && <><p className="eyebrow">{item.category}</p><h1>{item.title}</h1><p className="article-meta">{item.author || 'Tim PERGUNU'} · {formatDate(item.publishedAt)}</p><img src={item.imageUrl || fallbackImage} onError={(e) => { e.currentTarget.src = fallbackImage; }} alt="" /><div className="article-body" dangerouslySetInnerHTML={{ __html: item.content }} /></>}</section></Shell>;
}

function Scholarships() {
  const [items, setItems] = useState([]); useEffect(() => { api('/api/scholarships').then(setItems); }, []);
  return <Shell><section className="page-head"><p className="eyebrow">Program pendidikan</p><h1>Beasiswa</h1><p>Program dukungan pendidikan yang tersedia melalui PERGUNU Situbondo.</p></section><section className="section compact-grid">{items.map((item) => <article className="compact-card" key={item.id}><span className={`pill ${item.status}`}>{item.status}</span><h2>{item.title}</h2><strong>{formatMoney(item.amount)}</strong><p>{item.description}</p><p>Batas: {formatDate(item.deadline)}</p><Link to={`/beasiswa/${item.id}`}>Detail dan pendaftaran →</Link></article>)}{!items.length && <Empty text="Belum ada program beasiswa." />}</section></Shell>;
}

function ScholarshipDetail() {
  const { id } = useParams(); const [item, setItem] = useState(null); const [form, setForm] = useState({}); const [token, setToken] = useState(''); const [notice, setNotice] = useState(null);
  useEffect(() => { api('/api/scholarships').then((all) => setItem(all.find((row) => row.id === id))); }, [id]);
  const submit = async (event) => { event.preventDefault(); setNotice(null); try { const result = await api('/api/scholarship-applications', { json: { ...form, scholarshipId: id, turnstileToken: token } }); setNotice(`Pendaftaran diterima. Referensi: ${result.reference}`); setForm({}); } catch (error) { setNotice({ message: error.message }); } };
  if (!item) return <Shell><section className="section"><p>Memuat program…</p></section></Shell>;
  return <Shell><section className="page-head"><span className={`pill ${item.status}`}>{item.status}</span><h1>{item.title}</h1><strong>{formatMoney(item.amount)}</strong><p>{item.description}</p><p>Batas pendaftaran: {formatDate(item.deadline)}</p></section><section className="section two-column"><div><h2>Persyaratan</h2><ul>{item.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div>{item.status === 'open' && <form className="panel form-grid" onSubmit={submit}><h2 className="full">Form pendaftaran</h2><Notice value={notice} /><label>Nama lengkap<input required value={form.fullName || ''} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label>Email<input required type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>Telepon<input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="full">Alasan mendaftar<textarea value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label><Turnstile onToken={setToken} /><button className="button full">Kirim pendaftaran</button></form>}</section></Shell>;
}

function Login() {
  const { login } = useAuth(); const navigate = useNavigate(); const [form, setForm] = useState({}); const [token, setToken] = useState(''); const [notice, setNotice] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setNotice(null); try { const user = await login(form.identifier, form.password, token); navigate(user.role === 'admin' ? '/admin' : '/akun'); } catch (error) { setNotice({ message: error.message }); } finally { setBusy(false); } };
  return <Shell><section className="auth-page"><form className="panel auth-card" onSubmit={submit}><img src={logo} alt="" /><h1>Masuk</h1><Notice value={notice} /><label>Email atau username<input required autoComplete="username" onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></label><label>Kata sandi<input required type="password" autoComplete="current-password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><Turnstile onToken={setToken} /><button className="button" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button><Link to="/lupa-password">Lupa kata sandi?</Link></form></section></Shell>;
}

function ForgotPassword() {
  const [email, setEmail] = useState(''); const [token, setToken] = useState(''); const [notice, setNotice] = useState(null);
  const submit = async (event) => { event.preventDefault(); await api('/api/auth/request-reset', { json: { email, turnstileToken: token } }); setNotice('Jika akun ditemukan, tautan pengaturan ulang telah dikirim.'); };
  return <Shell><section className="auth-page"><form className="panel auth-card" onSubmit={submit}><h1>Lupa kata sandi</h1><Notice value={notice} /><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><Turnstile onToken={setToken} /><button className="button">Kirim tautan</button></form></section></Shell>;
}

function PasswordSetup() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const { refresh } = useAuth(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [notice, setNotice] = useState(null);
  const purpose = params.get('purpose') === 'reset' ? 'reset' : 'invitation';
  const submit = async (event) => { event.preventDefault(); if (password !== confirm) return setNotice({ message: 'Konfirmasi kata sandi tidak sama.' }); try { await api(purpose === 'reset' ? '/api/auth/reset-password' : '/api/auth/accept-invitation', { json: { token: params.get('token'), password } }); if (purpose === 'invitation') await refresh(); setNotice('Kata sandi berhasil dibuat.'); window.setTimeout(() => navigate(purpose === 'invitation' ? '/akun' : '/masuk'), 700); } catch (error) { setNotice({ message: error.message }); } };
  return <Shell><section className="auth-page"><form className="panel auth-card" onSubmit={submit}><h1>Atur kata sandi</h1><p>Gunakan minimal 12 karakter.</p><Notice value={notice} /><label>Kata sandi baru<input required minLength="12" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>Ulangi kata sandi<input required minLength="12" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label><button className="button">Simpan</button></form></section></Shell>;
}

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <section className="auth-page">Memuat akun…</section>;
  if (!user) return <Navigate to="/masuk" replace />;
  if (role && user.role !== role) return <Navigate to="/akun" replace />;
  return children;
}

function UserAccount() {
  const { user } = useAuth(); const [certificates, setCertificates] = useState([]); const [notice, setNotice] = useState(null);
  useEffect(() => { api('/api/account/certificates').then(setCertificates).catch((error) => setNotice({ message: error.message })); }, []);
  return <Shell><section className="dashboard"><div className="dashboard-head"><div><p className="eyebrow">Akun anggota</p><h1>Halo, {user.fullName}</h1><p>{user.email}</p></div></div><div className="panel"><h2>Sertifikat</h2><Notice value={notice} /><div className="table-wrap"><table><thead><tr><th>Nama</th><th>Tanggal</th><th>Status</th><th></th></tr></thead><tbody>{certificates.map((cert) => <tr key={cert.id}><td>{cert.title}<small>{cert.originalName}</small></td><td>{formatDate(cert.uploadedAt)}</td><td>{cert.missingFile ? 'Perlu diunggah ulang' : 'Tersedia'}</td><td>{cert.downloadUrl && <a className="button small" href={cert.downloadUrl}>Unduh</a>}</td></tr>)}</tbody></table></div>{!certificates.length && <Empty text="Belum ada sertifikat untuk akun ini." />}</div></section></Shell>;
}

function Empty({ text }) { return <div className="empty">{text}</div>; }

function Admin() {
  const [tab, setTab] = useState('applications');
  return <Shell><section className="dashboard"><div className="dashboard-head"><div><p className="eyebrow">Panel pengelola</p><h1>Administrasi PERGUNU</h1></div></div><div className="tabs">{[['applications','Pendaftaran'],['news','Berita'],['scholarships','Beasiswa'],['users','Pengguna']].map(([key,label]) => <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>{label}</button>)}</div>{tab === 'applications' && <ApplicationsAdmin />}{tab === 'news' && <NewsAdmin />}{tab === 'scholarships' && <ScholarshipsAdmin />}{tab === 'users' && <UsersAdmin />}</section></Shell>;
}

function ApplicationsAdmin() {
  const [type, setType] = useState('membership'); const [items, setItems] = useState([]); const [notice, setNotice] = useState(null);
  const load = useCallback(() => api(`/api/admin/applications?type=${type}`).then((result) => setItems(result.items)).catch((e) => setNotice({ message: e.message })), [type]);
  useEffect(() => { load(); }, [load]);
  const decide = async (item, status) => { const rejectionReason = status === 'rejected' ? window.prompt('Alasan penolakan:') : null; if (status === 'rejected' && !rejectionReason) return; try { await api(`/api/admin/applications/${type}/${item.id}`, { method: 'PATCH', json: { status, rejectionReason } }); setNotice(`Pendaftaran ${status}.`); load(); } catch (e) { setNotice({ message: e.message }); } };
  return <div className="panel"><div className="panel-head"><h2>Pendaftaran</h2><select value={type} onChange={(e) => setType(e.target.value)}><option value="membership">Anggota</option><option value="scholarship">Beasiswa</option></select></div><Notice value={notice} /><div className="table-wrap"><table><thead><tr><th>Referensi</th><th>Pendaftar</th><th>Tanggal</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.reference}</td><td>{item.fullName}<small>{item.email}</small></td><td>{formatDate(item.submittedAt)}</td><td><span className={`pill ${item.status}`}>{item.status}</span></td><td className="actions"><button onClick={() => decide(item, 'approved')}>Setujui</button><button className="danger" onClick={() => decide(item, 'rejected')}>Tolak</button></td></tr>)}</tbody></table></div>{!items.length && <Empty text="Belum ada pendaftaran." />}</div>;
}

const blankNews = { title: '', summary: '', content: '', author: '', category: 'umum', published: true, featured: false };
function NewsAdmin() {
  const [items, setItems] = useState([]); const [form, setForm] = useState(blankNews); const [notice, setNotice] = useState(null); const [image, setImage] = useState(null);
  const load = useCallback(() => api('/api/admin/news').then(setItems).catch((e) => setNotice({ message: e.message })), []); useEffect(() => { load(); }, [load]);
  const submit = async (event) => { event.preventDefault(); try { let imageKey = form.imageKey; if (image) { const data = new FormData(); data.set('image', image); imageKey = (await api('/api/admin/media/images', { method: 'POST', body: data })).key; } const path = form.id ? `/api/admin/news/${form.id}` : '/api/admin/news'; await api(path, { method: form.id ? 'PUT' : 'POST', json: { ...form, imageKey } }); setForm(blankNews); setImage(null); setNotice('Berita tersimpan.'); load(); } catch (e) { setNotice({ message: e.message }); } };
  const remove = async (id) => { if (!window.confirm('Hapus berita ini?')) return; await api(`/api/admin/news/${id}`, { method: 'DELETE' }); load(); };
  return <div className="admin-grid"><form className="panel form-grid" onSubmit={submit}><h2 className="full">{form.id ? 'Edit berita' : 'Berita baru'}</h2><Notice value={notice} /><label className="full">Judul<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label className="full">Ringkasan<textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label><label>Penulis<input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label><label>Kategori<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label className="full">Isi HTML<textarea className="editor" required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label><label className="full">Gambar cover<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setImage(e.target.files[0])} /></label><label className="check"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Terbitkan</label><label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Berita utama</label><div className="actions full"><button className="button">Simpan</button>{form.id && <button type="button" onClick={() => setForm(blankNews)}>Batal</button>}</div></form><div className="panel"><h2>Daftar berita</h2><div className="stack">{items.map((item) => <article className="admin-item" key={item.id}><div><strong>{item.title}</strong><small>{item.publishedAt ? formatDate(item.publishedAt) : 'Draf'} · {item.category}</small></div><div className="actions"><button onClick={() => setForm({ ...item, content: item.content, imageKey: item.imageUrl?.split('/').pop() })}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Hapus</button></div></article>)}</div></div></div>;
}

const blankScholarship = { title: '', amount: '', startsAt: '', deadline: '', status: 'draft', description: '', requirements: '' };
function ScholarshipsAdmin() {
  const [items, setItems] = useState([]); const [form, setForm] = useState(blankScholarship); const [notice, setNotice] = useState(null);
  const load = useCallback(() => api('/api/admin/scholarships').then(setItems), []); useEffect(() => { load(); }, [load]);
  const submit = async (event) => { event.preventDefault(); try { const payload = { ...form, amount: form.amount === '' ? null : Number(form.amount), requirements: typeof form.requirements === 'string' ? form.requirements.split('\n').filter(Boolean) : form.requirements }; await api(form.id ? `/api/admin/scholarships/${form.id}` : '/api/admin/scholarships', { method: form.id ? 'PUT' : 'POST', json: payload }); setForm(blankScholarship); setNotice('Beasiswa tersimpan.'); load(); } catch (e) { setNotice({ message: e.message }); } };
  const remove = async (item) => { if (!window.confirm(`Hapus ${item.title}?`)) return; try { await api(`/api/admin/scholarships/${item.id}`, { method: 'DELETE' }); setNotice('Beasiswa dihapus.'); load(); } catch (e) { setNotice({ message: e.message }); } };
  return <div className="admin-grid"><form className="panel form-grid" onSubmit={submit}><h2 className="full">{form.id ? 'Edit beasiswa' : 'Beasiswa baru'}</h2><Notice value={notice} /><label className="full">Nama program<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Nominal<input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="draft">Draf</option><option value="open">Dibuka</option><option value="closed">Ditutup</option></select></label><label>Mulai<input type="date" value={form.startsAt || ''} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label><label>Batas<input type="date" value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label><label className="full">Deskripsi<textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className="full">Persyaratan, satu per baris<textarea value={Array.isArray(form.requirements) ? form.requirements.join('\n') : form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></label><div className="actions full"><button className="button">Simpan</button>{form.id && <button type="button" onClick={() => setForm(blankScholarship)}>Batal</button>}</div></form><div className="panel"><h2>Daftar beasiswa</h2><div className="stack">{items.map((item) => <article className="admin-item" key={item.id}><div><strong>{item.title}</strong><small>{item.status} · {formatMoney(item.amount)}</small></div><div className="actions"><button onClick={() => setForm({ ...item, amount: item.amount ?? '' })}>Edit</button><button className="danger" onClick={() => remove(item)}>Hapus</button></div></article>)}</div></div></div>;
}

function UsersAdmin() {
  const [items, setItems] = useState([]); const [notice, setNotice] = useState(null); const [uploadFor, setUploadFor] = useState(null); const [file, setFile] = useState(null); const [certificates, setCertificates] = useState([]);
  const load = useCallback(() => api('/api/admin/users').then(setItems).catch((e) => setNotice({ message: e.message })), []); useEffect(() => { load(); }, [load]);
  const change = async (user, changes) => { try { await api(`/api/admin/users/${user.id}`, { method: 'PATCH', json: changes }); load(); } catch (e) { setNotice({ message: e.message }); } };
  const invite = async (user) => { try { await api(`/api/admin/users/${user.id}/invite`, { method: 'POST', json: {} }); setNotice(`Undangan dikirim ke ${user.email}.`); } catch (e) { setNotice({ message: e.message }); } };
  const openCertificates = async (user) => { setUploadFor(user); try { setCertificates(await api(`/api/admin/users/${user.id}/certificates`)); } catch (e) { setNotice({ message: e.message }); } };
  const upload = async (event) => { event.preventDefault(); if (!file) return; const data = new FormData(); data.set('certificate', file); data.set('title', event.currentTarget.title.value); try { await api(`/api/admin/users/${uploadFor.id}/certificates`, { method: 'POST', body: data }); setNotice('Sertifikat tersimpan.'); setFile(null); await openCertificates(uploadFor); } catch (e) { setNotice({ message: e.message }); } };
  const deleteCertificate = async (certificate) => { if (!window.confirm(`Hapus ${certificate.title}?`)) return; try { await api(`/api/admin/certificates/${certificate.id}`, { method: 'DELETE' }); await openCertificates(uploadFor); } catch (e) { setNotice({ message: e.message }); } };
  return <div className="panel"><h2>Pengguna</h2><Notice value={notice} />{uploadFor && <><form className="upload-bar" onSubmit={upload}><strong>Sertifikat: {uploadFor.fullName}</strong><input name="title" required placeholder="Nama sertifikat" /><input required type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} /><button className="button small">Unggah</button><button type="button" onClick={() => { setUploadFor(null); setCertificates([]); }}>Tutup</button></form><div className="stack certificate-list">{certificates.map((certificate) => <article className="admin-item" key={certificate.id}><div><strong>{certificate.title}</strong><small>{certificate.originalName} · {certificate.missingFile ? 'file hilang' : formatDate(certificate.uploadedAt)}</small></div><button className="danger" onClick={() => deleteCertificate(certificate)}>Hapus</button></article>)}{!certificates.length && <Empty text="Belum ada sertifikat." />}</div></>}<div className="table-wrap"><table><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{items.map((user) => <tr key={user.id}><td>{user.fullName}<small>{user.email}</small></td><td><select value={user.role} onChange={(e) => change(user, { role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></select></td><td><select value={user.status} onChange={(e) => change(user, { status: e.target.value })}><option value="invited">Diundang</option><option value="active">Aktif</option><option value="suspended">Ditangguhkan</option><option value="rejected">Ditolak</option></select></td><td className="actions"><button onClick={() => invite(user)}>Kirim undangan</button><button onClick={() => openCertificates(user)}>Sertifikat</button></td></tr>)}</tbody></table></div></div>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Home />} /><Route path="/berita/:id" element={<NewsDetail />} />
    <Route path="/beasiswa" element={<Scholarships />} /><Route path="/beasiswa/:id" element={<ScholarshipDetail />} />
    <Route path="/masuk" element={<Login />} /><Route path="/lupa-password" element={<ForgotPassword />} /><Route path="/atur-password" element={<PasswordSetup />} />
    <Route path="/akun" element={<Protected><UserAccount /></Protected>} />
    <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
