import { useEffect, useRef, useState } from "react";

import { cs } from "@/lib/i18n/cs";

/**
 * HTML podpis v izolovaném `<iframe srcDoc>` — bez Tailwind preflight resetu
 * tabulek, fontů a marginů z parent aplikace.
 *
 * Převzato z vividbooks CRM (`831f9ae6`) beze změny chování; jen popisek
 * iframu jde přes `src/lib/i18n/cs.ts`.
 */
export function EmailSignaturePreview({
  html,
  isDark,
}: {
  html: string;
  isDark: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(48);

  const srcDoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent;color:${isDark ? "#e7e7e6" : "#1f2024"};font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  a{color:${isDark ? "#7cb6ff" : "#0a66c2"};}
  img{max-width:100%;height:auto;}
  table{border-collapse:collapse;}
</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;

    const measure = () => {
      try {
        const doc = el.contentDocument;
        if (!doc) return;
        /* Berou se MAX z body i documentElement scrollHeight — některé prohlížeče
         * vrací 0 na jednom z nich, dokud se layout neustálí. */
        const bodyH = doc.body?.scrollHeight ?? 0;
        const htmlH = doc.documentElement?.scrollHeight ?? 0;
        const measured = Math.max(bodyH, htmlH);
        if (measured <= 0) return;
        const next = Math.min(2000, Math.max(40, measured));
        setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
      } catch {
        /* cross-origin — nemělo by nastat s allow-same-origin */
      }
    };

    const onLoad = () => {
      measure();
      try {
        const doc = el.contentDocument;
        if (!doc?.body) return;
        const ro = new ResizeObserver(measure);
        ro.observe(doc.body);
        ro.observe(doc.documentElement);

        /* Obrázky v podpisu načítají async — připojíme listener i na load
         * každého <img>, abychom přeměřili po dokončení decode. */
        const imgs = Array.from(doc.images);
        const onImg = () => measure();
        imgs.forEach((img) => {
          if (!img.complete) {
            img.addEventListener("load", onImg, { once: true });
            img.addEventListener("error", onImg, { once: true });
          }
        });

        /* Záložní timery — kdyby ResizeObserver minul některou layout fázi. */
        const t1 = setTimeout(measure, 250);
        const t2 = setTimeout(measure, 800);
        const t3 = setTimeout(measure, 2000);

        const cleanup = () => {
          ro.disconnect();
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
        el.addEventListener("unload", cleanup, { once: true });
      } catch {
        /* viz výše */
      }
    };

    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      /* allow-same-origin (BEZ allow-scripts) — parent může číst contentDocument
       * a měřit scrollHeight, ale scripty v HTML podpisu se NESPUSTÍ. */
      sandbox="allow-same-origin"
      title={cs.posta.podpis.nahled}
      className="block w-full border-0"
      style={{ height: `${height}px` }}
    />
  );
}
