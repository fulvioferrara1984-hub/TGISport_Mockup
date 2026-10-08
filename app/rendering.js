/* Mockup Studio — rendering: ridimensionamento di qualità e deformazione prospettica con antialiasing. */
(function (MK) {
  'use strict';

  function creaCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function contesto(c) {
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    return x;
  }

  // Ridimensiona con riduzioni successive a metà (evita l'aliasing delle riduzioni forti).
  function ridimensiona(src, w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    let cur = src, cw = src.width, ch = src.height;
    while (cw > w * 2 || ch > h * 2) {
      const nw = cw > w * 2 ? Math.ceil(cw / 2) : cw;
      const nh = ch > h * 2 ? Math.ceil(ch / 2) : ch;
      const c = creaCanvas(nw, nh);
      contesto(c).drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    const out = creaCanvas(w, h);
    contesto(out).drawImage(cur, 0, 0, w, h);
    return out;
  }

  function lanczos3(x) {
    if (x === 0) return 1;
    if (x <= -3 || x >= 3) return 0;
    const px = Math.PI * x;
    return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
  }

  // Pesi del ricampionamento lungo un asse (da → a pixel): per ogni pixel d'uscita, primo pixel sorgente e pesi.
  function pesiAsse(da, a) {
    const scala = da / a, passo = 1 / Math.max(1, scala), raggio = 3 * Math.max(1, scala);
    const inizio = new Int32Array(a), pesi = [];
    for (let i = 0; i < a; i++) {
      const centro = (i + 0.5) * scala - 0.5;
      const s = Math.max(0, Math.ceil(centro - raggio)), e = Math.min(da - 1, Math.floor(centro + raggio));
      const w = new Float32Array(e - s + 1);
      let tot = 0;
      for (let j = s; j <= e; j++) tot += (w[j - s] = lanczos3((j - centro) * passo));
      for (let k = 0; k < w.length; k++) w[k] /= tot;
      inizio[i] = s;
      pesi.push(w);
    }
    return { inizio, pesi };
  }

  // Ricampiona alla misura esatta w × h con il filtro di Lanczos (separabile, alfa premoltiplicata): nitido come
  // un buon programma di grafica. Le riduzioni oltre 3× vengono prima dimezzate in fretta, senza perdere dettaglio.
  function ricampiona(src, w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    let cur = src, cw = src.width, ch = src.height;
    while (cw > w * 3 || ch > h * 3) {
      const nw = cw > w * 3 ? Math.ceil(cw / 2) : cw;
      const nh = ch > h * 3 ? Math.ceil(ch / 2) : ch;
      const c = creaCanvas(nw, nh);
      contesto(c).drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    if (!(cur instanceof HTMLCanvasElement)) cur = copia(cur);
    const S = contesto(cur).getImageData(0, 0, cw, ch).data;
    const P = new Float32Array(cw * ch * 4);
    for (let o = 0; o < S.length; o += 4) {
      const a = S[o + 3] / 255;
      P[o] = S[o] * a; P[o + 1] = S[o + 1] * a; P[o + 2] = S[o + 2] * a; P[o + 3] = S[o + 3];
    }
    // orizzontale: cw → w
    const X = pesiAsse(cw, w), M = new Float32Array(w * ch * 4);
    for (let y = 0; y < ch; y++) {
      const riga = y * cw * 4;
      for (let x = 0; x < w; x++) {
        const q = X.pesi[x];
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0, o = riga + X.inizio[x] * 4; k < q.length; k++, o += 4) {
          const p = q[k];
          r += P[o] * p; g += P[o + 1] * p; b += P[o + 2] * p; a += P[o + 3] * p;
        }
        const o = (y * w + x) * 4;
        M[o] = r; M[o + 1] = g; M[o + 2] = b; M[o + 3] = a;
      }
    }
    // verticale: ch → h, poi alfa di nuovo separata
    const Y = pesiAsse(ch, h), c = creaCanvas(w, h), ctx = contesto(c), img = ctx.createImageData(w, h), D = img.data;
    for (let y = 0; y < h; y++) {
      const q = Y.pesi[y], s = Y.inizio[y];
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0, o = (s * w + x) * 4; k < q.length; k++, o += w * 4) {
          const p = q[k];
          r += M[o] * p; g += M[o + 1] * p; b += M[o + 2] * p; a += M[o + 3] * p;
        }
        if (a < 0.5) continue;
        const o = (y * w + x) * 4, f = 255 / a;
        D[o] = r * f; D[o + 1] = g * f; D[o + 2] = b * f; D[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Disegna un'immagine in un rettangolo con ridimensionamento di qualità. Con `alta` (anteprima definitiva e file
  // salvati) il rettangolo viene portato a pixel interi e l'immagine ricampionata in un solo passaggio: così non si
  // aggiungono sfocature e i dettagli fini (testi piccoli, linee) restano netti e con il loro colore.
  function disegnaHQ(ctx, img, dx, dy, dw, dh, alta) {
    if (dw <= 0 || dh <= 0) return;
    if (alta) {
      const x = Math.round(dx), y = Math.round(dy);
      const w = Math.max(1, Math.round(dx + dw) - x), h = Math.max(1, Math.round(dy + dh) - y);
      ctx.drawImage(ricampiona(img, w, h), x, y);
      return;
    }
    const ridotta = img.width > dw * 2 || img.height > dh * 2
      ? ridimensiona(img, Math.max(1, Math.ceil(dw)), Math.max(1, Math.ceil(dh)))
      : img;
    ctx.drawImage(ridotta, dx, dy, dw, dh);
  }

  // Estensione orizzontale del quadrilatero C nella fascia di righe [ya, yb].
  function spanRiga(C, ya, yb) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < 4; i++) {
      const p = C[i], q = C[(i + 1) % 4];
      if (p[1] >= ya && p[1] <= yb) { mn = Math.min(mn, p[0]); mx = Math.max(mx, p[0]); }
      for (const yy of [ya, yb]) {
        if ((p[1] - yy) * (q[1] - yy) < 0) {
          const x = p[0] + ((yy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
          mn = Math.min(mn, x); mx = Math.max(mx, x);
        }
      }
    }
    return mn <= mx ? [mn, mx] : null;
  }

  /**
   * Compone `art` sopra il canvas `dest` applicando l'omografia H (coordinate artwork → immagine).
   * Ogni pixel viene supercampionato (N×N) con interpolazione bilineare su una copia dell'artwork
   * pre-ridotta a ~2× l'ingombro finale: bordi puliti e nessun aliasing anche con forti compressioni.
   */
  function deforma(dest, art, H, opzioni) {
    const N = (opzioni && opzioni.campioni) || 4;
    const opacita = opzioni && opzioni.opacita != null ? opzioni.opacita : 1;
    const aw = art.width, ah = art.height;
    const C = [[0, 0], [aw, 0], [aw, ah], [0, ah]].map((p) => MK.geo.applica(H, p[0], p[1]));
    if (C.some((p) => !isFinite(p[0]) || !isFinite(p[1]))) return;

    let x0 = Math.floor(Math.min(...C.map((p) => p[0]))) - 1;
    let x1 = Math.ceil(Math.max(...C.map((p) => p[0]))) + 1;
    let y0 = Math.floor(Math.min(...C.map((p) => p[1]))) - 1;
    let y1 = Math.ceil(Math.max(...C.map((p) => p[1]))) + 1;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0);
    x1 = Math.min(dest.width, x1); y1 = Math.min(dest.height, y1);
    if (x1 <= x0 || y1 <= y0) return;

    const lato = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const fw = Math.max(lato(C[0], C[1]), lato(C[3], C[2]));
    const fh = Math.max(lato(C[0], C[3]), lato(C[1], C[2]));
    const pw = Math.max(2, Math.min(aw, Math.ceil(fw * 2)));
    const ph = Math.max(2, Math.min(ah, Math.ceil(fh * 2)));
    const pre = pw === aw && ph === ah ? art : ridimensiona(art, pw, ph);
    const sx = pw / aw, sy = ph / ah;

    const Hi = MK.geo.inversa(H);
    const T = [Hi[0] * sx, Hi[1] * sx, Hi[2] * sx, Hi[3] * sy, Hi[4] * sy, Hi[5] * sy, Hi[6], Hi[7], Hi[8]];

    const tex = contesto(pre).getImageData(0, 0, pw, ph).data;
    const P = new Float32Array(pw * ph * 4);
    for (let i = 0, n = pw * ph; i < n; i++) {
      const o = i * 4, a = tex[o + 3] / 255;
      P[o] = tex[o] * a; P[o + 1] = tex[o + 1] * a; P[o + 2] = tex[o + 2] * a; P[o + 3] = a;
    }

    const bw = x1 - x0, bh = y1 - y0;
    const dctx = contesto(dest);
    const img = dctx.getImageData(x0, y0, bw, bh);
    const D = img.data;
    const inv = opacita / (N * N);
    const offs = [];
    for (let k = 0; k < N; k++) offs.push((k + 0.5) / N);

    for (let y = y0; y < y1; y++) {
      const span = spanRiga(C, y, y + 1);
      if (!span) continue;
      const xs = Math.max(x0, Math.floor(span[0]) - 1);
      const xe = Math.min(x1, Math.ceil(span[1]) + 1);
      for (let x = xs; x < xe; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < N; j++) {
          const Y = y + offs[j];
          for (let i = 0; i < N; i++) {
            const X = x + offs[i];
            const w = T[6] * X + T[7] * Y + T[8];
            const u = (T[0] * X + T[1] * Y + T[2]) / w - 0.5;
            const v = (T[3] * X + T[4] * Y + T[5]) / w - 0.5;
            const iu = Math.floor(u), iv = Math.floor(v);
            if (iu < -1 || iv < -1 || iu >= pw || iv >= ph) continue;
            const fu = u - iu, fv = v - iv;
            const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
            const in0 = iv >= 0, in1 = iv + 1 < ph, jn0 = iu >= 0, jn1 = iu + 1 < pw;
            if (in0 && jn0) { const o = (iv * pw + iu) * 4; r += P[o] * w00; g += P[o + 1] * w00; b += P[o + 2] * w00; a += P[o + 3] * w00; }
            if (in0 && jn1) { const o = (iv * pw + iu + 1) * 4; r += P[o] * w10; g += P[o + 1] * w10; b += P[o + 2] * w10; a += P[o + 3] * w10; }
            if (in1 && jn0) { const o = ((iv + 1) * pw + iu) * 4; r += P[o] * w01; g += P[o + 1] * w01; b += P[o + 2] * w01; a += P[o + 3] * w01; }
            if (in1 && jn1) { const o = ((iv + 1) * pw + iu + 1) * 4; r += P[o] * w11; g += P[o + 1] * w11; b += P[o + 2] * w11; a += P[o + 3] * w11; }
          }
        }
        if (a <= 0) continue;
        r *= inv; g *= inv; b *= inv; a *= inv;
        const o = ((y - y0) * bw + (x - x0)) * 4;
        const da = D[o + 3] / 255, k = da * (1 - a), ra = a + k;
        if (ra <= 0) continue;
        D[o] = (r + D[o] * k) / ra;
        D[o + 1] = (g + D[o + 1] * k) / ra;
        D[o + 2] = (b + D[o + 2] * k) / ra;
        D[o + 3] = ra * 255;
      }
    }
    dctx.putImageData(img, x0, y0);
  }

  function copia(src) {
    const c = creaCanvas(src.width, src.height);
    contesto(c).drawImage(src, 0, 0);
    return c;
  }

  MK.render = { creaCanvas, contesto, ridimensiona, ricampiona, disegnaHQ, deforma, copia };
})(window.MK = window.MK || {});
