import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
export default function SessionGate({ admin = false, children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    let active = true;
    const hasAuthHint = Boolean(localStorage.getItem('adminAuth') || localStorage.getItem('userAuth'));
    if (!hasAuthHint) {
      setState('denied');
      return () => { active = false; };
    }
    api('/api/auth/me').then(({ user }) => { if (active) setState(user && (!admin || user.role === 'admin') ? 'allowed' : 'denied'); }).catch(() => { if (active) setState('denied'); });
    return () => { active = false; };
  }, [admin]);
  return state === 'loading' ? <p role="status">Memuat...</p> : state === 'allowed' ? children : <Navigate to="/login" replace />;
}
