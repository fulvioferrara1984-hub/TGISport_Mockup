/* Mockup Studio — tipologie di mockup e composizione dell'artwork di produzione. */
(function (MK) {
  'use strict';

  const R = MK.render;

  // Tipologie di mockup e formati di produzione (la sigla finisce nel nome dei file: Brand_<sigla>.png/.jpg).
  // Aggiungere una tipologia qui basta per averla in tutta la piattaforma; una scena può sovrascrivere w/h con `formato`.
  // piuBrand: nello stesso mockup si possono mettere due brand diversi, uno per posizione.
  MK.TIPI = {
    CC: { sigla: 'CC', nome: 'Centre circle', forma: 'cerchio', w: 500, h: 500, dimensione: 0.8 },
    MATS: { sigla: 'MATS', nome: 'Mats', forma: 'rettangolo', w: 900, h: 100, dimensione: 0.7, piuBrand: true },
    ADDITIONAL: { sigla: 'Additional', nome: 'Additional', forma: 'rettangolo', w: 248, h: 100, dimensione: 0.7 },
    RETROPORTA_GROUND: { sigla: 'Retroporta_ground', nome: 'Behind goal ground', forma: 'rettangolo', w: 700, h: 200, dimensione: 0.7 },
    RETROPORTA_VERTICAL: { sigla: 'Retroporta_vertical', nome: 'Behind goal vertical', forma: 'rettangolo', w: 480, h: 181, dimensione: 0.7 },
  };

  function descrizioneFormato(t) {
    return t.forma === 'cerchio' ? t.w + ' px circle' : t.w + ' × ' + t.h + ' px';
  }

  function formatoScena(scena) {
    const base = MK.TIPI[scena.tipo];
    return Object.assign({}, base, scena.formato || {});
  }

  /**
   * Artwork composto: sfondo tinta unita (oppure trasparente se p.sfondo è null) + logo centrato (scalato e spostabile).
   * Per il cerchio il logo è inscritto in base alla sua forma reale, poi tutto viene ritagliato a disco.
   *  logo: { canvas, raggio }  ·  p: { sfondo, dimensione, offX, offY }  ·  scala: moltiplicatore di risoluzione
   */
  function componi(formato, logo, p, scala) {
    const W = Math.round(formato.w * scala), H = Math.round(formato.h * scala);
    const c = R.creaCanvas(W, H);
    const x = R.contesto(c);
    if (p.sfondo) {
      x.fillStyle = p.sfondo;
      x.fillRect(0, 0, W, H);
    }
    if (logo) {
      const lw = logo.canvas.width, lh = logo.canvas.height;
      const s0 = formato.forma === 'cerchio' ? W / 2 / logo.raggio : Math.min(W / lw, H / lh);
      const s = s0 * p.dimensione;
      const dw = lw * s, dh = lh * s;
      const cx = W / 2 + p.offX * W, cy = H / 2 + p.offY * H;
      R.disegnaHQ(x, logo.canvas, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    if (formato.forma === 'cerchio') mascheraCerchio(c);
    return c;
  }

  function mascheraCerchio(c) {
    const x = R.contesto(c);
    x.save();
    x.globalCompositeOperation = 'destination-in';
    x.beginPath();
    x.arc(c.width / 2, c.height / 2, c.width / 2, 0, Math.PI * 2);
    x.fillStyle = '#000';
    x.fill();
    x.restore();
    return c;
  }

  // Porta un file già composto alle misure di produzione (per il cerchio garantisce il disco pulito).
  function adattaComposto(formato, canvas, scala) {
    const W = Math.round(formato.w * scala), H = Math.round(formato.h * scala);
    const c = R.creaCanvas(W, H);
    R.disegnaHQ(R.contesto(c), canvas, 0, 0, W, H);
    if (formato.forma === 'cerchio') mascheraCerchio(c);
    return c;
  }

  // Artwork di prova usato nell'editor dei template per verificare le posizioni.
  function artworkProva(formato) {
    const W = formato.w * 2, H = formato.h * 2;
    const c = R.creaCanvas(W, H);
    const x = R.contesto(c);
    if (formato.forma === 'cerchio') {
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, W, H);
      const n = 10;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if ((i + j) % 2) { x.fillStyle = '#e8364f'; x.fillRect((i * W) / n, (j * H) / n, W / n + 1, H / n + 1); }
      }
      x.strokeStyle = '#111'; x.lineWidth = W * 0.012;
      x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.moveTo(0, H / 2); x.lineTo(W, H / 2); x.stroke();
      x.fillStyle = '#111';
      x.font = 'bold ' + Math.round(H * 0.1) + 'px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('TOP', W / 2, H * 0.12);
      mascheraCerchio(c);
    } else {
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#e8364f'); g.addColorStop(1, '#2c5bd8');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff';
      const testo = 'TEST ' + formato.w + '×' + formato.h;
      let corpo = Math.round(H * 0.5);
      x.font = 'bold ' + corpo + 'px system-ui, sans-serif';
      const largo = x.measureText(testo).width;
      if (largo > W * 0.86) {
        corpo = Math.floor((corpo * W * 0.86) / largo);
        x.font = 'bold ' + corpo + 'px system-ui, sans-serif';
      }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(testo, W / 2, H / 2);
      x.fillRect(0, 0, W * 0.02, H);
    }
    return c;
  }

  // ---------- spessore dei tappeti (solo nel mockup) ----------
  // Il "retro" del tappeto è la faccia spostata in alto e verso il lato corto scelto: la sagoma grigia è
  // l'inviluppo convesso di faccia e retro, poi la grafica copre la faccia e resta visibile solo lo spessore.
  const SPESSORE_PREDEFINITO = { colore: '#a0a0a0', profondita: 4, lato: 'auto' };

  function vettoreSpessore(spessore, punti) {
    const d = Number(spessore && spessore.profondita) || 0;
    if (d <= 0) return null;
    let lato = spessore.lato;
    if (lato !== 'sinistra' && lato !== 'destra') {
      // automatico: si vede il lato corto più basso nella foto (quello più vicino alla telecamera)
      const ySinistra = (punti[0][1] + punti[3][1]) / 2, yDestra = (punti[1][1] + punti[2][1]) / 2;
      lato = ySinistra >= yDestra ? 'sinistra' : 'destra';
    }
    return [lato === 'sinistra' ? -d : d, -d];
  }

  function inviluppoConvesso(punti) {
    const p = punti.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const giro = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const sotto = [], sopra = [];
    for (const q of p) {
      while (sotto.length >= 2 && giro(sotto[sotto.length - 2], sotto[sotto.length - 1], q) <= 0) sotto.pop();
      sotto.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (sopra.length >= 2 && giro(sopra[sopra.length - 2], sopra[sopra.length - 1], q) <= 0) sopra.pop();
      sopra.push(q);
    }
    return sotto.slice(0, -1).concat(sopra.slice(0, -1));
  }

  function disegnaSpessore(ctx, spessore, punti) {
    const e = vettoreSpessore(spessore, punti);
    if (!e) return;
    const sagoma = inviluppoConvesso(punti.concat(punti.map(([x, y]) => [x + e[0], y + e[1]])));
    ctx.beginPath();
    sagoma.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = spessore.colore || SPESSORE_PREDEFINITO.colore;
    ctx.fill();
  }

  /**
   * Disegna il mockup: immagine di base, poi la grafica della competizione nelle posizioni fisse
   * (opzioni.grafica, se c'è) e infine l'artwork del brand nelle posizioni scelte.
   * artwork è un canvas per tutte le posizioni, oppure una funzione (posizione) → canvas quando i brand sono più di uno.
   * Se l'immagine ha lo spessore impostato, ogni tappeto disegnato riceve prima la sua sagoma grigia.
   */
  function mockup(immagine, scena, artwork, idPosizioni, opzioni) {
    const c = R.creaCanvas(immagine.naturalWidth || immagine.width, immagine.naturalHeight || immagine.height);
    const ctx = R.contesto(c);
    ctx.drawImage(immagine, 0, 0);
    const formato = formatoScena(scena);
    const spessore = formato.forma === 'rettangolo' ? scena.spessore : null;
    const disegna = (art, pos) => {
      if (spessore) disegnaSpessore(ctx, spessore, pos.punti);
      const H = MK.geo.omografiaPosizione(formato.forma, art.width, art.height, pos.punti, pos.bordo);
      R.deforma(c, art, H, opzioni);
    };
    const grafica = opzioni && opzioni.grafica;
    if (grafica) for (const pos of scena.posizioni) if (pos.fissa) disegna(grafica, pos);
    if (artwork) {
      for (const pos of scena.posizioni) {
        if (pos.fissa || !idPosizioni.includes(pos.id)) continue;
        const art = typeof artwork === 'function' ? artwork(pos) : artwork;
        if (art) disegna(art, pos);
      }
    }
    return c;
  }

  // Traccia (senza disegnarlo) il contorno di una posizione: ellisse per il cerchio, quadrilatero per i tappeti.
  function tracciaContorno(ctx, formato, punti) {
    ctx.beginPath();
    if (formato.forma === 'cerchio') {
      const H = MK.geo.omografia(MK.geo.puntiArtwork('cerchio', 2, 2), punti);
      for (let i = 0; i <= 120; i++) {
        const t = (i / 120) * Math.PI * 2;
        const p = MK.geo.applica(H, 1 + Math.cos(t), 1 + Math.sin(t));
        if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
    } else {
      punti.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    }
    ctx.closePath();
  }

  MK.composizione = { SPESSORE_PREDEFINITO, disegnaSpessore, descrizioneFormato, formatoScena, componi, adattaComposto, artworkProva, mockup, mascheraCerchio, tracciaContorno };
})(window.MK = window.MK || {});
