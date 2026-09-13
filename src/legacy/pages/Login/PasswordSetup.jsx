import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import Turnstile from '../../../Turnstile';
import { synchronizeSession } from '../../services/cloudflare';
import logo from '../../assets/logo.png';
import PasswordVisibilityField from '../../componen/PasswordVisibilityField/PasswordVisibilityField';
import './Login.css';

export default function PasswordSetup({ request = false }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (request) {
        await api('/api/auth/request-reset', { json: { email, turnstileToken: token } });
        setMessage('Jika email terdaftar, tautan pengaturan ulang akan dikirim.');
      } else {
        const reset = params.get('purpose') === 'reset';
        await api(`/api/auth/${reset ? 'reset-password' : 'accept-invitation'}`, { json: { password, token: params.get('token') } });
        if (reset) navigate('/login');
        else { const user = await synchronizeSession({ force: true }); navigate(user?.role === 'admin' ? '/admin' : '/user-dashboard'); }
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <div className="login-container">
    <Link to="/" className="back-home">← Back to Home</Link>
    <div className="login-left"><div className="login-overlay"><img src={logo} alt="Logo PERGUNU" className="login-logo" /><h2>Hey! Welcome</h2><p>Join us and give information to people</p></div></div>
    <div className="login-right"><div className="login-box"><h2>{request ? 'Lupa Password' : 'Atur Password'}</h2>
      <form onSubmit={submit}>
        {request ? <><input aria-label="Email" type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} /><Turnstile onToken={setToken} /></> : <PasswordVisibilityField aria-label="Password baru" id="new-password" autoComplete="new-password" minLength={8} required placeholder="Password baru (minimal 8 karakter)" value={password} onChange={e => setPassword(e.target.value)} label="Password baru" />}
        <button className="login-button" disabled={busy}>{busy ? 'Memproses...' : request ? 'Kirim tautan' : 'Simpan password'}</button>
        {message && <p role="status" className="api-message">{message}</p>}
      </form><p className="create-account"><Link to="/login">Kembali ke login</Link></p>
    </div></div>
  </div>;
}
