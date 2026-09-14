import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from "../../componen/Navbar/Navbar";
import Footer from "../../componen/Footer/Footer";
import Sponsor from "../../componen/Sponsor/Sponsor";
import beasiswaPoster from "../../assets/beasiswa_poster.png";
import sponsorHeroSmall from "../../assets/beasiswa-poster-768.avif";
import sponsorHeroLarge from "../../assets/beasiswa-poster-1600.avif";
import './SponsorPage.css';

const SponsorPage = () => {
  const location = useLocation();

  // Force immediate scroll to top when route changes
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 0);
  }, []);

  return (
    <div className="sponsor-page">
      <Navbar />
      <div className="page-content">
        {/* Hero Section untuk halaman Sponsor */}
        <section className="sponsor-page-hero">
          <picture className="page-hero-media" aria-hidden="true">
            <source
              type="image/avif"
              srcSet={`${sponsorHeroSmall} 768w, ${sponsorHeroLarge} 1600w`}
              sizes="100vw"
            />
            <img src={beasiswaPoster} alt="" width="1600" height="1067" fetchPriority="high" />
          </picture>
          <div className="container">
            <div className="sponsor-hero-content">
              <h1 className="sponsor-page-title">Partner & Sponsor</h1>
              <p className="sponsor-page-subtitle">
                Berkolaborasi dengan berbagai institusi dan organisasi untuk kemajuan 
                pendidikan Indonesia dan pengembangan PERGUNU Situbondo
              </p>
              <div className="sponsor-hero-stats">
                <div className="sponsor-stat-item">
                  <span className="sponsor-stat-number">50+</span>
                  <span className="sponsor-stat-label">Mitra Kerjasama</span>
                </div>
                <div className="sponsor-stat-item">
                  <span className="sponsor-stat-number">25+</span>
                  <span className="sponsor-stat-label">Sponsor Aktif</span>
                </div>
                <div className="sponsor-stat-item">
                  <span className="sponsor-stat-number">10</span>
                  <span className="sponsor-stat-label">Tahun Pengalaman</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Sponsor - sama seperti di homepage */}
        <Sponsor />
      </div>
      <Footer />
    </div>
  );
};

export default SponsorPage;
