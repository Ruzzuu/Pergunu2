import { useEffect, useId, useRef } from 'react';

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function Turnstile({ onToken }) {
  const elementId = `turnstile-${useId().replaceAll(':', '')}`;
  const widgetId = useRef(null);

  useEffect(() => {
    if (!siteKey) {
      onToken('');
      return undefined;
    }
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(`#${elementId}`, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken('')
      });
    };
    const existing = document.querySelector('script[data-pergunu-turnstile]');
    if (existing) {
      const timer = window.setInterval(render, 100);
      render();
      return () => { cancelled = true; window.clearInterval(timer); };
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.pergunuTurnstile = 'true';
    script.onload = render;
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [elementId, onToken]);

  if (!siteKey) return <p className="form-note">Turnstile nonaktif di lingkungan lokal.</p>;
  return <div id={elementId} className="turnstile" />;
}
