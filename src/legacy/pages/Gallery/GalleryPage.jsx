import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import Navbar from '../../componen/Navbar/Navbar';
import Footer from '../../componen/Footer/Footer';
import galeriImage from '../../assets/galeri.jpeg';
import './GalleryPage.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

export default function GalleryPage() {
  const [items, setItems] = React.useState([]);
  const [state, setState] = React.useState('loading');

  React.useEffect(() => {
    let active = true;
    api('/api/news')
      .then(news => { if (active) { setItems(Array.isArray(news) ? news.filter(item => item.imageUrl) : []); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  return <div className="gallery-page">
    <Navbar />
    <main>
      <header className="gallery-hero">
        <picture className="page-hero-media" aria-hidden="true">
          <img src={galeriImage} alt="" width="1100" height="618" fetchPriority="high" />
        </picture>
        <div className="gallery-shell">
          <p className="gallery-eyebrow">Dokumentasi kegiatan</p>
          <h1>Momen PERGUNU Situbondo</h1>
          <p>Foto kegiatan yang dibagikan melalui berita resmi PERGUNU.</p>
        </div>
      </header>
      <section className="gallery-shell gallery-content" aria-live="polite">
        {state === 'loading' && <p className="gallery-message" role="status">Memuat dokumentasi…</p>}
        {state === 'error' && <p className="gallery-message gallery-message-error" role="alert">Dokumentasi belum dapat dimuat. Silakan muat ulang halaman ini.</p>}
        {state === 'ready' && items.length === 0 && <div className="gallery-empty"><span aria-hidden="true">📷</span><h2>Dokumentasi akan segera hadir</h2><p>Foto kegiatan akan tampil di sini setelah admin menerbitkan berita dengan gambar.</p><Link to="/berita">Lihat berita</Link></div>}
        {state === 'ready' && items.length > 0 && <div className="gallery-grid">
          {items.map((item, index) => <Link key={item.id} to={`/berita/${item.id}`} className={`gallery-card gallery-card-${(index % 5) + 1}`}>
            <img src={item.imageUrl} alt={`Dokumentasi ${item.title}`} loading="lazy" decoding="async" />
            <span className="gallery-card-overlay"><strong>{item.title}</strong>{item.publishedAt && <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>}</span>
          </Link>)}
        </div>}
      </section>
    </main>
    <Footer />
  </div>;
}
