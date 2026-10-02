/* Mockup Studio — geometria: omografie (trasformazioni prospettiche) tra piani. */
(function (MK) {
  'use strict';

  // Risolve A·x = b (A: n×n, array di righe) con eliminazione di Gauss e pivot parziale.
  function risolvi(A, b) {
    const n = b.length;
    const M = A.map((riga, i) => riga.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) throw new Error('Degenerate points: cannot compute the perspective');
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }

  // Normalizzazione di Hartley: centra i punti e li scala a distanza media √2.
  function normalizzatore(punti) {
    const cx = punti.reduce((s, p) => s + p[0], 0) / punti.length;
    const cy = punti.reduce((s, p) => s + p[1], 0) / punti.length;
    const d = punti.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / punti.length || 1;
    const k = Math.SQRT2 / d;
    return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
  }

  function moltiplica(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  }

  function inversa(H) {
    const [a, b, c, d, e, f, g, h, i] = H;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-15) throw new Error('Non-invertible transformation');
    const inv = [
      A, -(b * i - c * h), b * f - c * e,
      B, a * i - c * g, -(a * f - c * d),
      C, -(a * h - b * g), a * e - b * d,
    ].map((v) => v / det);
    return normalizza(inv);
  }

  function normalizza(H) {
    const s = Math.abs(H[8]) > 1e-15 ? H[8] : 1;
    return H.map((v) => v / s);
  }

  // Omografia H tale che dst ≈ H·src, da 4 corrispondenze di punti [[x,y],…].
  function omografia(src, dst) {
    const Ts = normalizzatore(src), Td = normalizzatore(dst);
    const s = src.map((p) => applica(Ts, p[0], p[1]));
    const d = dst.map((p) => applica(Td, p[0], p[1]));
    const A = [], b = [];
    for (let k = 0; k < 4; k++) {
      const [x, y] = s[k], [u, v] = d[k];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = risolvi(A, b);
    const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    return normalizza(moltiplica(inversa(Td), moltiplica(Hn, Ts)));
  }

  function applica(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  // Punti di controllo nello spazio dell'artwork (w×h) in base alla modalità della posizione.
  //  - 'cerchio': punti cardinali del cerchio inscritto [alto, destra, basso, sinistra]
  //  - 'rettangolo': angoli [alto-sx, alto-dx, basso-dx, basso-sx]
  function puntiArtwork(forma, w, h) {
    if (forma === 'cerchio') return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
    return [[0, 0], [w, 0], [w, h], [0, h]];
  }

  // Direzioni "verso l'esterno" dei punti di controllo, nello spazio artwork.
  function direzioniEsterne(forma) {
    if (forma === 'cerchio') return [[0, -1], [1, 0], [0, 1], [-1, 0]];
    return null;
  }

  function intersezioneRette(p1, d1, p2, d2) {
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-12) return null;
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
    return [p1[0] + t * d1[0], p1[1] + t * d1[1]];
  }

  // Allarga la posizione di `bordo` pixel immagine verso l'esterno (copre residui del vecchio logo).
  function espandi(forma, w, h, punti, bordo) {
    if (!bordo) return punti;
    if (forma === 'cerchio') {
      const H = omografia(puntiArtwork(forma, w, h), punti);
      const src = puntiArtwork(forma, w, h), dir = direzioniEsterne(forma);
      return src.map((p, k) => {
        const eps = 0.5;
        const a = applica(H, p[0], p[1]);
        const b = applica(H, p[0] + dir[k][0] * eps, p[1] + dir[k][1] * eps);
        const scala = Math.hypot(b[0] - a[0], b[1] - a[1]) / eps; // px immagine per unità artwork
        const delta = bordo / scala;
        return applica(H, p[0] + dir[k][0] * delta, p[1] + dir[k][1] * delta);
      });
    }
    // quadrilatero: sposta ogni lato lungo la sua normale esterna e ricalcola gli angoli
    const c = punti.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    const lati = punti.map((p, i) => {
      const q = punti[(i + 1) % 4];
      const d = [q[0] - p[0], q[1] - p[1]];
      const L = Math.hypot(d[0], d[1]) || 1;
      let n = [-d[1] / L, d[0] / L];
      const m = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]];
      if (n[0] * m[0] + n[1] * m[1] < 0) n = [-n[0], -n[1]];
      return { p: [p[0] + n[0] * bordo, p[1] + n[1] * bordo], d };
    });
    return punti.map((p, i) => {
      const prec = lati[(i + 3) % 4], succ = lati[i];
      return intersezioneRette(prec.p, prec.d, succ.p, succ.d) || p;
    });
  }

  // Omografia artwork → immagine per una posizione del template.
  function omografiaPosizione(forma, w, h, punti, bordo) {
    return omografia(puntiArtwork(forma, w, h), espandi(forma, w, h, punti, bordo || 0));
  }

  MK.geo = { omografia, inversa, applica, moltiplica, puntiArtwork, espandi, omografiaPosizione };
})(window.MK = window.MK || {});
