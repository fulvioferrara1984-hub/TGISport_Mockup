/* Mockup Studio — tipologie di mockup e composizione dell'artwork di produzione. */
(function (MK) {
  'use strict';

  const R = MK.render;

  // Tipologie di mockup e formati di produzione (la sigla finisce nel nome dei file: Brand_<sigla>.png/.jpg).
  // Aggiungere una tipologia qui basta per averla in tutta la piattaforma; una scena può sovrascrivere w/h con `formato`.
  MK.TIPI = {
    CC: { sigla: 'CC', nome: 'Centro campo', forma: 'cerchio', w: 500, h: 500, dimensione: 0.8 },
    MATS: { sigla: 'MATS', nome: 'Tappeti', forma: 'rettangolo', w: 900, h: 100, dimensione: 0.7 },
    ADDITIONAL: { sigla: 'Additional', nome: 'Additional', forma: 'rettangolo', w: 248, h: 100, dimensione: 0.7 },
    RETROPORTA_GROUND: { sigla: 'Retroporta_ground', nome: 'Retroporta ground', forma: 'rettangolo', w: 700, h: 200, dimensione: 0.7 },
    RETROPORTA_VERTICAL: { sigla: 'Retroporta_vertical', nome: 'Retroporta vertical', forma: 'rettangolo', w: 480, h: 181, dimensione: 0.7 },
  };

  function descrizioneFormato(t) {
    return t.forma === 'cerchio' ? 'cerchio ' + t.w + ' px' : t.w + ' × ' + t.h + ' px';
  }

  function formatoScena(scena) {
    const base = MK.TIPI[scena.tipo];
    return Object.assign({}, base, scena.formato || {});
  }

  /**
   * Artwork composto: sfondo tinta unita + logo centrato (scalato e spostabile).
   * Per il cerchio il logo è inscritto in base alla sua forma reale, poi tutto viene ritagliato a disco.
   *  logo: { canvas, raggio }  ·  p: { sfondo, dimensione, offX, offY }  ·  scala: moltiplicatore di risoluzione
   */
  function componi(formato, logo, p, scala) {
    const W = Math.round(formato.w * scala), H = Math.round(formato.h * scala);
    const c = R.creaCanvas(W, H);
    const x = R.contesto(c);
    x.fillStyle = p.sfondo;
    x.fillRect(0, 0, W, H);
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
      x.fillText('ALTO', W / 2, H * 0.12);
      mascheraCerchio(c);
    } else {
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#e8364f'); g.addColorStop(1, '#2c5bd8');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff';
      const testo = 'PROVA ' + formato.w + '×' + formato.h;
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

  /** Disegna il mockup: immagine di base + artwork deformato in ogni posizione richiesta. */
  function mockup(immagine, scena, artwork, idPosizioni, opzioni) {
    const c = R.creaCanvas(immagine.naturalWidth || immagine.width, immagine.naturalHeight || immagine.height);
    R.contesto(c).drawImage(immagine, 0, 0);
    const formato = formatoScena(scena);
    for (const pos of scena.posizioni) {
      if (!idPosizioni.includes(pos.id)) continue;
      const H = MK.geo.omografiaPosizione(formato.forma, artwork.width, artwork.height, pos.punti, pos.bordo);
      R.deforma(c, artwork, H, opzioni);
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

  MK.composizione = { descrizioneFormato, formatoScena, componi, adattaComposto, artworkProva, mockup, mascheraCerchio, tracciaContorno };
})(window.MK = window.MK || {});
