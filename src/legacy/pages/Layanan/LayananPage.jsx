import React from 'react';
import Navbar from "../../componen/Navbar/Navbar";
import Footer from "../../componen/Footer/Footer";
import Layanan from "../../componen/Layanan/Layanan";
import bagroundlayanan from "../../assets/bagroundlayanan.png";
import './LayananPage.css';

const LayananPage = () => {
  return (
    <div className="layanan-page">
      <Navbar />
      <div className="page-content">
        {/* Hero Section untuk halaman Layanan */}
        <section 
          className="page-hero"
          style={{
            backgroundImage: `url(${bagroundlayanan})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <div className="container">
            <div className="hero-content">
              <h1 className="page-title">Layanan PERGUNU</h1>
              <p className="page-subtitle">
                Memberikan berbagai layanan terbaik untuk mendukung pengembangan 
                kualitas pendidikan dan pemberdayaan guru di seluruh Indonesia
              </p>
              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-number">15+</span>
                  <span className="stat-label">Layanan Utama</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">1000+</span>
                  <span className="stat-label">Guru Terbantu</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">24/7</span>
                  <span className="stat-label">Dukungan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="quick-access" aria-labelledby="quick-access-title">
          <div className="quick-access-shell">
            <div className="quick-access-heading"><p>Akses cepat</p><h2 id="quick-access-title">Layanan digital PERGUNU</h2><span>Gunakan layanan resmi berikut untuk kebutuhan pembelajaran dan administrasi.</span></div>
            <div className="quick-access-grid">
              <a className="quick-access-card" href="https://www.appsheet.com/start/071609a0-2a6b-4c04-ab88-ab0e50f13d9e" target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span><h3>Aplikasi JAGO</h3><p>Buka aplikasi layanan JAGO PERGUNU.</p><strong>Buka JAGO</strong></a>
              <a className="quick-access-card" href="https://pergunu.github.io/ujian-online/" target="_blank" rel="noreferrer"><span aria-hidden="true">✦</span><h3>Portal Ujian Online</h3><p>Akses portal ujian online PERGUNU Situbondo.</p><strong>Buka portal</strong></a>
              <a className="quick-access-card" href="https://wa.me/6289631011926" target="_blank" rel="noreferrer"><span aria-hidden="true">◌</span><h3>Hubungi Admin</h3><p>Tanyakan layanan dan informasi kegiatan melalui WhatsApp.</p><strong>Chat admin</strong></a>
            </div>
          </div>
        </section>

        {/* Section Layanan - sama seperti di homepage */}
        <Layanan />
      </div>
      <Footer />
    </div>
  );
};

export default LayananPage;
