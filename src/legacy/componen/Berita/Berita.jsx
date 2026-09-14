import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import './Berita.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function NewsImage({ item }) {
  const [missing, setMissing] = React.useState(false);
  if (!item.imageUrl || missing) return <div className="news-image-placeholder" aria-hidden="true">PERGUNU</div>;
  return <img src={item.imageUrl} alt={`Gambar berita ${item.title}`} loading="lazy" decoding="async" onError={() => setMissing(true)} />;
}

export default function Berita() {
  const [ref, isVisible] = useScrollAnimation();
  const [news, setNews] = React.useState([]);
  const [state, setState] = React.useState('loading');

  React.useEffect(() => {
    let active = true;
    api('/api/news')
      .then((items) => { if (active) { setNews(Array.isArray(items) ? items : []); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  const preview = news.slice(0, 3);
  return (
    <section className={`berita-section ${isVisible ? 'animate' : ''}`} id="berita" ref={ref}>
      <div className="berita-wrapper">
        <div className="berita-heading">
          <div>
            <p className="berita-label">Berita</p>
            <h2>Informasi terbaru PERGUNU</h2>
            <p className="berita-intro">Pengumuman, kegiatan, dan kabar terbaru dari PERGUNU.</p>
          </div>
          {state === 'ready' && news.length > 0 && <Link className="berita-all-link" to="/berita">Lihat semua berita <span aria-hidden="true">→</span></Link>}
        </div>

        {state === 'loading' && <div className="berita-message" role="status">Memuat berita…</div>}
        {state === 'error' && <div className="berita-message berita-message-error" role="alert">Berita belum dapat dimuat. Silakan coba lagi nanti.</div>}
        {state === 'ready' && news.length === 0 && <div className="berita-empty"><span aria-hidden="true">📰</span><h3>Belum ada berita dipublikasikan</h3><p>Silakan kembali lagi untuk informasi terbaru dari PERGUNU.</p></div>}
        {state === 'ready' && preview.length > 0 && (
          <div className="berita-grid">
            {preview.map((item) => (
              <article key={item.id} className="berita-card">
                <Link to={`/berita/${item.id}`} className="berita-card-link" aria-label={`Baca berita: ${item.title}`}>
                  <div className="berita-card-image"><NewsImage item={item} /></div>
                  <div className="berita-card-content">
                    <div className="berita-card-meta"><span>{item.category || 'Umum'}</span>{item.publishedAt && <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>}</div>
                    <h3>{item.title}</h3>
                    {item.summary && <p>{item.summary}</p>}
                    <span className="berita-read-more">Baca selengkapnya <span aria-hidden="true">→</span></span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
