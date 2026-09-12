import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import './NewsList.css';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function CoverImage({ item }) {
  const [missing, setMissing] = React.useState(false);
  if (!item.imageUrl || missing) return <div className="news-list-placeholder" aria-hidden="true">PERGUNU</div>;
  return <img src={item.imageUrl} alt="" onError={() => setMissing(true)} />;
}

export default function NewsList() {
  const [news, setNews] = React.useState([]);
  const [state, setState] = React.useState('loading');

  React.useEffect(() => {
    let active = true;
    api('/api/news')
      .then((items) => { if (active) { setNews(items); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, []);

  return <main className="news-list-page">
    <header className="news-list-hero">
      <div className="news-list-shell">
        <p>Berita PERGUNU</p>
        <h1>Informasi dan kegiatan terbaru</h1>
        <span>Semua berita yang telah dipublikasikan oleh PERGUNU.</span>
      </div>
    </header>
    <section className="news-list-shell news-list-content" aria-live="polite">
      {state === 'loading' && <p className="news-list-message" role="status">Memuat berita…</p>}
      {state === 'error' && <p className="news-list-message news-list-error" role="alert">Berita belum dapat dimuat. Silakan muat ulang halaman ini.</p>}
      {state === 'ready' && news.length === 0 && <div className="news-list-empty"><span aria-hidden="true">📰</span><h2>Belum ada berita dipublikasikan</h2><p>Informasi terbaru akan tampil di halaman ini setelah dipublikasikan oleh admin.</p><Link to="/">Kembali ke beranda</Link></div>}
      {state === 'ready' && news.length > 0 && <div className="news-list-grid">
        {news.map((item) => <article key={item.id} className="news-list-card">
          <Link to={`/berita/${item.id}`} className="news-list-card-link">
            <div className="news-list-cover"><CoverImage item={item} /></div>
            <div className="news-list-card-content">
              <div className="news-list-meta"><span>{item.category || 'Umum'}</span>{item.publishedAt && <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>}</div>
              <h2>{item.title}</h2>
              {item.summary && <p>{item.summary}</p>}
              <span className="news-list-read">Baca berita <span aria-hidden="true">→</span></span>
            </div>
          </Link>
        </article>)}
      </div>}
    </section>
  </main>;
}
