import { api } from '../../../api';
// StatusTracker Component - Komponen untuk melacak status pendaftaran
// Memungkinkan user untuk cek status pendaftaran dengan memasukkan email
import React, { useState } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import './StatusTracker.css';

const StatusTracker = () => {
  const [ref, isVisible] = useScrollAnimation(0.1);
  
  // State untuk menyimpan email yang diinput user
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  
  // State untuk menyimpan data status pendaftaran
  const [status, setStatus] = useState(null);
  
  // State untuk menunjukkan loading indicator
  const [loading, setLoading] = useState(false);
  
  // State untuk menyimpan error message
  const [error, setError] = useState('');

  // API Base URL
  const API_BASE = '/api';

  // Fungsi untuk validasi format email
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Fungsi untuk mengecek status pendaftaran berdasarkan email
  const checkStatus = async () => {
    // Reset error dan status sebelumnya
    setError('');
    setStatus(null);
    
    // Validasi email kosong
    if (!email.trim()) {
      setError('Silakan masukkan email Anda');
      return;
    }
    
    // Validasi format email
    if (!isValidEmail(email)) {
      setError('Format email tidak valid. Contoh: nama@email.com');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔍 Checking status for:', email);
      
      const result = await api('/api/application-status', { json: { email, reference } });
      const data = { success: true, application: { email, status: result.status, submittedAt: result.submitted_at, processedAt: result.processed_at, notes: result.rejection_reason }, message: `Referensi: ${result.reference}` };

      if (data.success && data.application) {
        // Email ditemukan - tampilkan status
        setStatus({
          email: data.application.email,
          fullName: data.application.fullName,
          status: data.application.status,
          submittedDate: new Date(data.application.submittedAt).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          processedDate: data.application.processedAt ? 
            new Date(data.application.processedAt).toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : null,
          message: data.message,
          notes: data.application.notes || '',
          position: data.application.position,
          school: data.application.school
        });
      } else {
        // Email tidak ditemukan
        setStatus({
          email: email,
          status: 'not_found',
          submittedDate: '-',
          message: data.message || 'Email tidak terdaftar dalam sistem kami. Pastikan Anda telah melakukan pendaftaran.'
        });
      }
    } catch (err) {
      console.error('❌ Error checking status:', err);
      setError(err.message || 'Terjadi kesalahan saat mengecek status. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && email.trim() && !loading) {
      checkStatus();
    }
  };

  // Fungsi untuk reset form
  const resetForm = () => {
    setEmail('');
    setStatus(null);
    setError('');
  };

  return (
    <div className={`status-tracker ${isVisible ? 'animate-in' : ''}`} ref={ref}>
      <div className="tracker-header">
        <h2>🔍 Cek Status Pendaftaran</h2>
        <p>Masukkan nomor referensi dan email yang Anda gunakan saat mendaftar</p>
      </div>

      <div className="tracker-form">
        <input aria-label="Nomor referensi" placeholder="Nomor referensi pendaftaran" value={reference} onChange={e => setReference(e.target.value)} onKeyPress={handleKeyPress} className="email-input" disabled={loading} />
        <input
          type="email"
          placeholder="Masukkan email Anda (contoh: nama@email.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          className="email-input"
          disabled={loading}
        />
        <button 
          onClick={checkStatus}
          disabled={!email.trim() || !reference.trim() || loading}
          className="check-btn"
        >
          {loading ? '⏳ Mengecek...' : '🔍 Cek Status'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Status Result */}
      {status && (
        <div className={`status-result ${status.status}`}>
          <div className="status-header">
            <span className="status-icon">
              {status.status === 'pending' && '⏳'}
              {status.status === 'approved' && '✅'}
              {status.status === 'rejected' && '❌'}
              {status.status === 'not_found' && '🔍'}
              {status.status === 'error' && '⚠️'}
            </span>
            <h3>
              {status.status === 'pending' && 'Pendaftaran Sedang Diproses'}
              {status.status === 'approved' && 'Pendaftaran Disetujui'}
              {status.status === 'rejected' && 'Pendaftaran Perlu Diperbaiki'}
              {status.status === 'not_found' && 'Pendaftaran Tidak Ditemukan'}
              {status.status === 'error' && 'Terjadi Kesalahan'}
            </h3>
          </div>
          
          <div className="status-details">
            {status.fullName && (
              <p><strong>Nama:</strong> {status.fullName}</p>
            )}
            <p><strong>Email:</strong> {status.email}</p>
            {status.position && status.position !== 'N/A' && (
              <p><strong>Posisi:</strong> {status.position}</p>
            )}
            {status.school && status.school !== 'N/A' && (
              <p><strong>Sekolah:</strong> {status.school}</p>
            )}
            <p><strong>Tanggal Pendaftaran:</strong> {status.submittedDate}</p>
            {status.processedDate && (
              <p><strong>Tanggal Diproses:</strong> {status.processedDate}</p>
            )}
            <p><strong>Pesan:</strong> {status.message}</p>
            {status.notes && status.notes.trim() !== '' && (
              <p><strong>Catatan Admin:</strong> {status.notes}</p>
            )}
          </div>

          {/* Action buttons based on status */}
          {status.status === 'approved' && (
            <div className="next-steps success-steps">
              <h4>🎉 Langkah Selanjutnya:</h4>
              <ul>
                <li>✅ Cek email Anda untuk tautan pengaturan password</li>
                <li>🔐 Buat password melalui tautan, lalu login</li>
                <li>📥 Mulai download sertifikat di dashboard</li>
              </ul>
              <div className="action-buttons">
                <a href="/login" className="btn-action btn-primary">
                  🚀 Login Sekarang
                </a>
                <button onClick={resetForm} className="btn-action btn-secondary">
                  🔄 Cek Email Lain
                </button>
              </div>
            </div>
          )}

          {status.status === 'pending' && (
            <div className="next-steps warning-steps">
              <h4>⏳ Harap Bersabar:</h4>
              <ul>
                <li>📋 Pendaftaran Anda sedang direview admin</li>
                <li>⏰ Maksimal 2x24 jam untuk konfirmasi</li>
                <li>📧 Anda akan menerima email setelah diproses</li>
                <li>📞 Hubungi admin jika lebih dari 2 hari</li>
              </ul>
              <div className="action-buttons">
                <button onClick={resetForm} className="btn-action btn-secondary">
                  � Cek Email Lain
                </button>
              </div>
            </div>
          )}

          {status.status === 'not_found' && (
            <div className="next-steps info-steps">
              <h4>📝 Apa yang harus dilakukan:</h4>
              <ul>
                <li>✉️ Pastikan email yang dimasukkan benar</li>
                <li>📝 Jika belum daftar, silakan isi form pendaftaran</li>
                <li>📞 Hubungi admin jika yakin sudah mendaftar</li>
              </ul>
              <div className="action-buttons">
                <a href="/daftar" className="btn-action btn-primary">
                  📝 Daftar Sekarang
                </a>
                <button onClick={resetForm} className="btn-action btn-secondary">
                  🔄 Coba Email Lain
                </button>
              </div>
            </div>
          )}

          {status.status === 'rejected' && (
            <div className="next-steps error-steps">
              <h4>🔄 Langkah Selanjutnya:</h4>
              <ul>
                <li>📧 Cek email untuk detail alasan penolakan</li>
                <li>✏️ Perbaiki data sesuai saran admin</li>
                <li>📝 Daftar ulang dengan data yang sudah diperbaiki</li>
                <li>📞 Hubungi admin jika ada yang kurang jelas</li>
              </ul>
              <div className="action-buttons">
                <a href="/daftar" className="btn-action btn-primary">
                  📝 Daftar Ulang
                </a>
                <button onClick={resetForm} className="btn-action btn-secondary">
                  🔄 Cek Email Lain
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusTracker;
