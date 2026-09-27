/* Mockup Studio — caricamento e analisi dei loghi (.ai, .pdf, .svg, .png, .jpg, .webp). */
(function (MK) {
  'use strict';

  const R = MK.render;
  const LATO_VETTORIALE = 3000;  // px del lato lungo quando si rasterizza un vettoriale
  const LATO_MAX_RASTER = 5000;  // oltre questa misura i raster vengono ridotti per l'elaborazione
  const PDFJS = {
    base: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',
    lib: ['pdf.min.js', 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ=='],
    worker: ['pdf.worker.min.js', 'sha512-BbrZ76UNZq5BhH7LL7pn9A4TKQpQeNCHOo65/akfelcIBbcVvYWOFQKPXIrykE3qZxYjmDX573oa4Ywsc7rpTw=='],
  };

  function estensione(nome) {
    const m = /\.([a-z0-9]+)$/i.exec(nome || '');
    return m ? m[1].toLowerCase() : '';
  }

  function caricaScript(src, integrity) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src;
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.onload = () => ok();
      s.onerror = () => ko(new Error('Impossibile caricare ' + src));
      document.head.appendChild(s);
    });
  }

  let pdfjsPromessa = null;
  function caricaPdfJs() {
    if (!pdfjsPromessa) {
      pdfjsPromessa = (async () => {
        await caricaScript(PDFJS.base + PDFJS.lib[0], PDFJS.lib[1]);
        // Il worker caricato come script normale gira nella pagina: funziona anche aprendo il file da disco.
        await caricaScript(PDFJS.base + PDFJS.worker[0], PDFJS.worker[1]);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS.base + PDFJS.worker[0];
        return window.pdfjsLib;
      })().catch((e) => {
        pdfjsPromessa = null;
        throw new Error('Per leggere file .ai/.pdf serve la connessione a internet (libreria pdf.js). ' + e.message);
      });
    }
    return pdfjsPromessa;
  }

  function caricaImmagine(url) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error('Immagine non leggibile'));
      img.src = url;
    });
  }

  function leggiComeDataURL(blob) {
    return new Promise((ok, ko) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = () => ko(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  // Riquadro dei pixel non trasparenti (alpha > soglia) oppure null se l'immagine è vuota.
  function riquadroVisibile(canvas, soglia) {
    soglia = soglia == null ? 3 : soglia;
    const w = canvas.width, h = canvas.height;
    const D = R.contesto(canvas).getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const riga = y * w * 4;
      let primo = -1, ultimo = -1;
      for (let x = 0; x < w; x++) if (D[riga + x * 4 + 3] > soglia) { primo = x; break; }
      if (primo < 0) continue;
      for (let x = w - 1; x >= primo; x--) if (D[riga + x * 4 + 3] > soglia) { ultimo = x; break; }
      if (primo < x0) x0 = primo;
      if (ultimo > x1) x1 = ultimo;
      if (y < y0) y0 = y;
      y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function ritaglia(canvas, box) {
    if (!box) return canvas;
    if (box.x === 0 && box.y === 0 && box.w === canvas.width && box.h === canvas.height) return canvas;
    const c = R.creaCanvas(box.w, box.h);
    R.contesto(c).drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return c;
  }

  function rifila(canvas) {
    return ritaglia(canvas, riquadroVisibile(canvas));
  }

  // ---------- lettura dei formati ----------

  async function daRaster(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (e) {
      const img = await caricaImmagine(await leggiComeDataURL(file));
      bmp = img;
    }
    const w = bmp.width, h = bmp.height;
    const k = Math.min(1, LATO_MAX_RASTER / Math.max(w, h));
    const c = R.creaCanvas(w * k, h * k);
    R.contesto(c).drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return { canvas: c, larghezza: w, altezza: h };
  }

  async function daSvg(file) {
    const testo = await file.text();
    const doc = new DOMParser().parseFromString(testo, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
      throw new Error('Il file SVG non è valido');
    }
    const num = (v) => (v && !/%$/.test(v.trim()) ? parseFloat(v) : NaN);
    let w = num(svg.getAttribute('width')), h = num(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const vbOk = vb.length === 4 && vb.every(isFinite) && vb[2] > 0 && vb[3] > 0;
    if (vbOk) { w = vb[2]; h = vb[3]; }
    else {
      if (!(w > 0 && h > 0)) { w = 1000; h = 1000; }
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    const k = LATO_VETTORIALE / Math.max(w, h);
    const W = Math.round(w * k), H = Math.round(h * k);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const xml = new XMLSerializer().serializeToString(svg);
    const img = await caricaImmagine('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml));
    const c = R.creaCanvas(W, H);
    R.contesto(c).drawImage(img, 0, 0, W, H);
    return { canvas: c, larghezza: W, altezza: H };
  }

  async function renderPdfViewport(pagina, viewport, W, H) {
    const c = R.creaCanvas(W || Math.ceil(viewport.width), H || Math.ceil(viewport.height));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    await pagina.render({ canvasContext: ctx, viewport, background: 'rgba(0,0,0,0)' }).promise;
    return c;
  }

  // Rasterizza una pagina PDF/AI inquadrando solo il contenuto visibile, ad alta risoluzione.
  async function renderPaginaPdf(pdf, n) {
    const pagina = await pdf.getPage(n);
    try {
      const testo = (await pagina.getTextContent()).items.map((i) => i.str).join(' ');
      if (/without PDF Content|senza contenuto PDF/i.test(testo)) {
        throw new Error('Questo file .ai è stato salvato senza "Crea file compatibile PDF": in Illustrator risalvalo con quell\'opzione attiva, oppure esportalo in PDF/SVG/PNG.');
      }
    } catch (e) {
      if (/compatibile PDF/.test(e.message)) throw e;
    }
    const vp1 = pagina.getViewport({ scale: 1 });
    const s1 = 1200 / Math.max(vp1.width, vp1.height);
    const bassa = await renderPdfViewport(pagina, pagina.getViewport({ scale: s1 }));
    const box = riquadroVisibile(bassa, 0);
    if (!box) throw new Error('La pagina ' + n + ' del file è vuota');
    const bw = (box.w + 2) / s1, bh = (box.h + 2) / s1; // in punti PDF, con 1px di margine
    let s2 = LATO_VETTORIALE / Math.max(bw, bh);
    s2 = Math.min(s2, Math.sqrt(24e6 / (bw * bh)));
    const pad = 4;
    const vp2 = pagina.getViewport({
      scale: s2,
      offsetX: -((box.x - 1) / s1) * s2 + pad,
      offsetY: -((box.y - 1) / s1) * s2 + pad,
    });
    const alta = await renderPdfViewport(pagina, vp2, Math.ceil(bw * s2) + 2 * pad, Math.ceil(bh * s2) + 2 * pad);
    return { canvas: alta, larghezza: alta.width, altezza: alta.height };
  }

  async function daPdf(file, bytes) {
    const pdfjs = await caricaPdfJs();
    let pdf;
    try {
      pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false }).promise;
    } catch (e) {
      throw new Error('Impossibile leggere il file: se è un .ai, risalvalo da Illustrator con "Crea file compatibile PDF" attivo (oppure esportalo in PDF/SVG/PNG).');
    }
    const r = await renderPaginaPdf(pdf, 1);
    return Object.assign(r, { pdf, pagine: pdf.numPages });
  }

  /** Legge un file logo e lo restituisce come canvas (non rifilato) con i metadati utili. */
  async function carica(file) {
    const ext = estensione(file.name);
    const bytes = await file.arrayBuffer();
    let r, vettoriale = false;
    if (ext === 'ai' || ext === 'pdf' || file.type === 'application/pdf' || file.type === 'application/illustrator') {
      r = await daPdf(file, bytes); vettoriale = true;
    } else if (ext === 'svg' || file.type === 'image/svg+xml') {
      r = await daSvg(file); vettoriale = true;
    } else if (/^(png|jpe?g|webp|gif|bmp|avif)$/.test(ext) || /^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(file.type)) {
      r = await daRaster(file);
    } else if (ext === 'eps' || ext === 'ps') {
      throw new Error('Il formato EPS non è leggibile dal browser: esporta il logo in PDF, SVG o PNG (oppure .ai compatibile PDF).');
    } else if (ext === 'psd' || ext === 'tif' || ext === 'tiff') {
      throw new Error('Formato .' + ext + ' non supportato: esporta il logo in PNG (con trasparenza) o PDF.');
    } else {
      throw new Error('Formato non riconosciuto (.' + (ext || '?') + '). Usa .ai, .pdf, .svg, .png o .jpg.');
    }
    return {
      nome: file.name,
      ext,
      mime: file.type,
      bytes,
      vettoriale,
      pdf: r.pdf || null,
      pagine: r.pagine || 1,
      pagina: 1,
      canvas: r.canvas,
      larghezza: r.larghezza,
      altezza: r.altezza,
    };
  }

  async function cambiaPagina(sorgente, n) {
    const r = await renderPaginaPdf(sorgente.pdf, n);
    return Object.assign({}, sorgente, { pagina: n, canvas: r.canvas, larghezza: r.larghezza, altezza: r.altezza });
  }

  // ---------- analisi ----------

  // Il file è già l'artwork finale? (cerchio pieno con angoli trasparenti, oppure rettangolo pieno del formato giusto)
  function rilevaComposto(canvas, formato) {
    const w = canvas.width, h = canvas.height;
    if (w < 16 || h < 8) return false;
    const ctx = R.contesto(canvas);
    const px = (fx, fy) => {
      const x = Math.min(w - 1, Math.max(0, Math.round(fx * (w - 1))));
      const y = Math.min(h - 1, Math.max(0, Math.round(fy * (h - 1))));
      return ctx.getImageData(x, y, 1, 1).data[3];
    };
    if (formato.forma === 'cerchio') {
      if (Math.abs(w - h) > Math.max(2, w * 0.01)) return false;
      const i = 0.015, j = 0.04;
      const angoli = [px(j, j), px(1 - j, j), px(j, 1 - j), px(1 - j, 1 - j)];
      const bordi = [px(0.5, i), px(1 - i, 0.5), px(0.5, 1 - i), px(i, 0.5)];
      return angoli.every((a) => a < 20) && bordi.every((a) => a > 200) && px(0.5, 0.5) > 200;
    }
    const target = formato.w / formato.h;
    if (Math.abs(w / h - target) / target > 0.015) return false;
    const angoli = [px(0.005, 0.03), px(0.995, 0.03), px(0.005, 0.97), px(0.995, 0.97)];
    return angoli.every((a) => a > 230);
  }

  // Colori principali del logo (per proporre lo sfondo) e luminanza media.
  function analizzaColori(canvas) {
    const k = Math.min(1, 160 / Math.max(canvas.width, canvas.height));
    const c = k < 1 ? R.ridimensiona(canvas, canvas.width * k, canvas.height * k) : canvas;
    const D = R.contesto(c).getImageData(0, 0, c.width, c.height).data;
    const conteggi = new Map();
    let somma = 0, peso = 0;
    for (let o = 0; o < D.length; o += 4) {
      const a = D[o + 3];
      if (a < 160) continue;
      const r = D[o], g = D[o + 1], b = D[o + 2];
      somma += (0.2126 * r + 0.7152 * g + 0.0722 * b) * a; peso += a;
      const chiave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const v = conteggi.get(chiave);
      if (v) { v.n++; v.r += r; v.g += g; v.b += b; } else conteggi.set(chiave, { n: 1, r, g, b });
    }
    const gruppi = [...conteggi.values()].sort((a, b) => b.n - a.n);
    const scelti = [];
    for (const gr of gruppi) {
      const col = [gr.r / gr.n, gr.g / gr.n, gr.b / gr.n].map(Math.round);
      if (scelti.every((s) => Math.max(Math.abs(s[0] - col[0]), Math.abs(s[1] - col[1]), Math.abs(s[2] - col[2])) > 40)) scelti.push(col);
      if (scelti.length >= 5) break;
    }
    return { colori: scelti.map(inHex), luminanza: peso ? somma / peso : 128 };
  }

  // Pixel dei quattro bordi dell'immagine (campionati), come [r, g, b, a].
  function campioniBordo(canvas) {
    const w = canvas.width, h = canvas.height;
    const ctx = R.contesto(canvas);
    const bordi = [ctx.getImageData(0, 0, w, 1).data, ctx.getImageData(0, h - 1, w, 1).data,
      ctx.getImageData(0, 0, 1, h).data, ctx.getImageData(w - 1, 0, 1, h).data];
    const campioni = [];
    const passo = Math.max(1, Math.floor((w + h) / 400));
    for (const D of bordi) {
      for (let i = 0; i < D.length / 4; i += passo) campioni.push([D[i * 4], D[i * 4 + 1], D[i * 4 + 2], D[i * 4 + 3]]);
    }
    return campioni;
  }

  // Sfondo pieno e uniforme (es. JPG su bianco)? Restituisce il colore oppure null.
  function sfondoUniforme(canvas) {
    const campioni = campioniBordo(canvas);
    if (campioni.some((c) => c[3] < 250)) return null;
    const med = [0, 1, 2].map((i) => campioni.map((c) => c[i]).sort((a, b) => a - b)[campioni.length >> 1]);
    const vicini = campioni.filter((c) => Math.max(Math.abs(c[0] - med[0]), Math.abs(c[1] - med[1]), Math.abs(c[2] - med[2])) < 30).length;
    return vicini / campioni.length > 0.9 ? med : null;
  }

  // Colore pieno più frequente sul bordo: è la proposta per "colore da togliere" (null se il bordo è trasparente).
  function coloreBordo(canvas) {
    const gruppi = new Map();
    for (const c of campioniBordo(canvas)) {
      if (c[3] < 250) continue;
      const k = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
      const g = gruppi.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      g.n++; g.r += c[0]; g.g += c[1]; g.b += c[2];
      gruppi.set(k, g);
    }
    let meglio = null;
    for (const g of gruppi.values()) if (!meglio || g.n > meglio.n) meglio = g;
    return meglio ? [meglio.r / meglio.n, meglio.g / meglio.n, meglio.b / meglio.n].map(Math.round) : null;
  }

  // Fondo bianco o quasi (il caso tipico da togliere, a differenza dei loghi dentro un riquadro colorato).
  function quasiBianco(rgb) {
    return !!rgb && Math.min(rgb[0], rgb[1], rgb[2]) > 225 && Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) < 25;
  }

  // Rende trasparente lo sfondo uniforme: 'ovunque' (tutti i pixel di quel colore) o 'contorno' (solo quelli collegati al bordo).
  function rimuoviSfondo(canvas, colore, modo, tolleranza) {
    const w = canvas.width, h = canvas.height;
    const out = R.copia(canvas);
    const ctx = R.contesto(out);
    const img = ctx.getImageData(0, 0, w, h);
    const D = img.data;
    const [cr, cg, cb] = colore;
    const lo = tolleranza * 0.5, hi = tolleranza * 1.5;
    const dist = (o) => Math.max(Math.abs(D[o] - cr), Math.abs(D[o + 1] - cg), Math.abs(D[o + 2] - cb));
    let ammessi = null;
    if (modo === 'contorno') {
      ammessi = new Uint8Array(w * h);
      const coda = new Int32Array(w * h);
      let testa = 0, fine = 0;
      const prova = (i) => { if (!ammessi[i] && (D[i * 4 + 3] < 16 || dist(i * 4) < hi)) { ammessi[i] = 1; coda[fine++] = i; } };
      for (let x = 0; x < w; x++) { prova(x); prova((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { prova(y * w); prova(y * w + w - 1); }
      while (testa < fine) {
        const i = coda[testa++], x = i % w, y = (i / w) | 0;
        if (x > 0) prova(i - 1);
        if (x < w - 1) prova(i + 1);
        if (y > 0) prova(i - w);
        if (y < h - 1) prova(i + w);
      }
    }
    for (let i = 0, n = w * h; i < n; i++) {
      if (ammessi && !ammessi[i]) continue;
      const o = i * 4;
      if (D[o + 3] === 0) continue;
      const d = dist(o);
      if (d >= hi) continue;
      const f = d <= lo ? 0 : (d - lo) / (hi - lo);
      if (f > 0) {
        // toglie la contaminazione del colore di sfondo dai pixel di bordo
        D[o] = (D[o] - (1 - f) * cr) / f;
        D[o + 1] = (D[o + 1] - (1 - f) * cg) / f;
        D[o + 2] = (D[o + 2] - (1 - f) * cb) / f;
      }
      D[o + 3] = D[o + 3] * f;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // Distanza massima dei pixel visibili dal centro del riquadro: serve per inscrivere il logo nel cerchio.
  function raggioVisibile(canvas) {
    const k = Math.min(1, 1000 / Math.max(canvas.width, canvas.height));
    const c = k < 1 ? R.ridimensiona(canvas, canvas.width * k, canvas.height * k) : canvas;
    const w = c.width, h = c.height;
    const D = R.contesto(c).getImageData(0, 0, w, h).data;
    const cx = w / 2, cy = h / 2;
    let max2 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (D[(y * w + x) * 4 + 3] < 24) continue;
        // angolo del pixel più lontano dal centro
        const dx = Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx));
        const dy = Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy));
        const d2 = dx * dx + dy * dy;
        if (d2 > max2) max2 = d2;
      }
    }
    return Math.sqrt(max2) / k || Math.hypot(canvas.width, canvas.height) / 2;
  }

  function inHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function daHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  MK.loghi = {
    carica, cambiaPagina, rifila, riquadroVisibile, rilevaComposto, analizzaColori, sfondoUniforme, coloreBordo, quasiBianco,
    rimuoviSfondo, raggioVisibile, inHex, daHex, estensione, leggiComeDataURL, caricaImmagine,
  };
})(window.MK = window.MK || {});
