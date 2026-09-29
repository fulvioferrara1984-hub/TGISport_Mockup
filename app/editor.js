/* Mockup Studio — editor dei template: immagini di base e posizioni (punti trascinabili sulla foto). */
(function (MK) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const C = MK.composizione, G = MK.geo, T = MK.template, A = MK.archivio;
  const COLORI = ['#4f7cff', '#ff6b4a', '#1fc28b', '#ffb020', '#c455ff', '#21b8d8'];
  const ETICHETTE = {
    cerchio: ['alto', 'destra', 'basso', 'sinistra'],
    rettangolo: ['alto sx', 'alto dx', 'basso dx', 'basso sx'],
  };
  const AIUTO = {
    CC: 'Porta i 4 punti sulla linea del cerchio di centrocampo: <b>alto</b> e <b>basso</b> dove la linea di metà campo incrocia il cerchio, <b>destra</b> e <b>sinistra</b> all\'altezza del dischetto. L\'ellisse deve combaciare con il cerchio e il mirino deve cadere sul dischetto: così anche la prospettiva del logo sarà corretta.',
    MATS: 'Porta i 4 angoli sulla faccia del tappeto dove andrà la grafica, nell\'ordine in cui si legge il logo: <b>alto sx, alto dx, basso dx, basso sx</b>. Usa la lente e le frecce della tastiera per la precisione.',
    rettangolo: 'Porta i 4 angoli sull\'area dove andrà la grafica, nell\'ordine in cui si legge il logo: <b>alto sx, alto dx, basso dx, basso sx</b>. Usa la lente e le frecce della tastiera per la precisione.',
  };

  const ed = {
    template: null,
    scenaId: null,
    posId: null,
    punto: null,
    vista: { s: 1, tx: 0, ty: 0 },
    immagine: null,
    composto: null,
    modificato: false,
    azione: null,
    inizializzato: false,
    attesaComposto: 0,
  };
  const cartellaTemplate = new A.Cartella('cartella-templates');

  function avvisa(t, tipo) { MK.app.avvisa(t, tipo); }
  function esc(t) { return MK.app.esc(t); }
  function clona(o) { return JSON.parse(JSON.stringify(o)); }

  function scena() { return ed.template && ed.template.scene.find((s) => s.id === ed.scenaId); }
  function posizione() { const s = scena(); return s && s.posizioni.find((p) => p.id === ed.posId); }
  function formato(s) { return C.formatoScena(s); }

  function segnaModifica() {
    ed.modificato = true;
    aggiornaNotaSalva();
  }

  // ---------- avvio ----------
  function attiva() {
    if (!ed.inizializzato) {
      ed.inizializzato = true;
      collega();
      cartellaTemplate.ripristina().catch(() => {});
      riempiTemplate();
      const attuale = MK.app.stato.template;
      if (attuale) apri(clona(attuale), false);
      else aggiornaTutto();
    } else {
      riempiTemplate();
    }
    requestAnimationFrame(() => { adatta(); disegna(); });
  }

  function riempiTemplate() {
    const sel = $('ed-sel-template');
    sel.innerHTML = '';
    for (const v of T.elenco) {
      const o = document.createElement('option');
      o.value = v.id; o.textContent = v.nome;
      sel.appendChild(o);
    }
    if (ed.template && !T.elenco.some((v) => v.id === ed.template.id)) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = (ed.template.nome || 'Nuovo template') + ' (non salvato)';
      sel.appendChild(o);
    }
    sel.value = ed.template && T.elenco.some((v) => v.id === ed.template.id) ? ed.template.id : '';
  }

  function conferma(testo) {
    return !ed.modificato || window.confirm(testo || 'Ci sono modifiche non salvate a questo template. Vuoi abbandonarle?');
  }

  function apri(t, modificato) {
    ed.template = t;
    ed.modificato = !!modificato;
    ed.scenaId = t.scene.length ? t.scene[0].id : null;
    ed.posId = null;
    ed.punto = null;
    riempiTemplate();
    caricaScena();
  }

  async function caricaScena() {
    const s = scena();
    ed.immagine = null;
    ed.composto = null;
    if (s) {
      if (!ed.posId || !s.posizioni.some((p) => p.id === ed.posId)) ed.posId = s.posizioni.length ? s.posizioni[0].id : null;
      ed.punto = null;
      try {
        ed.immagine = await T.immagineScena(s);
      } catch (e) {
        avvisa('Immagine non leggibile: ' + e.message, 'errore');
      }
    }
    aggiornaTutto();
    adatta();
    ricomponi(false);
  }

  // ---------- pannello ----------
  function aggiornaTutto() {
    const t = ed.template;
    $('ed-nome').value = t ? t.nome : '';
    $('ed-nome').disabled = !t;
    $('ed-file').textContent = t ? nomeFile() : '—';
    riempiScene();
    const s = scena();
    $('ed-passo-scena').hidden = !s;
    if (s) {
      $('ed-nome-scena').value = s.nome;
      document.querySelectorAll('#ed-tipo-scena button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tipo === s.tipo)));
      $('ed-aiuto').innerHTML = AIUTO[s.tipo] || AIUTO[formato(s).forma === 'cerchio' ? 'CC' : 'rettangolo'];
      riempiPosizioni();
    }
    aggiornaPunto();
    aggiornaNotaSalva();
    aggiornaNotaPassword();
    $('ed-messaggio').hidden = !!ed.immagine;
    $('ed-messaggio').textContent = !t ? 'Scegli un template o creane uno nuovo.' : 'Aggiungi un\'immagine di base (JPG o PNG) per iniziare.';
  }

  function nomeFile() {
    const t = ed.template;
    const voce = T.elenco.find((v) => v.id === t.id);
    if (voce) return voce.file;
    if (t.id) return t.id + '.js';
    return T.protezione() ? 'nome neutro, assegnato al salvataggio' : T.slug(t.nome) + '.js';
  }

  function riempiScene() {
    const box = $('ed-scene');
    box.innerHTML = '';
    if (!ed.template) return;
    for (const s of ed.template.scene) {
      const el = document.createElement('div');
      el.className = 'voce' + (s.id === ed.scenaId ? ' attiva' : '');
      el.innerHTML = '<img alt=""><span class="testo"><b></b><small></small></span><button type="button" class="icona" title="Elimina immagine" aria-label="Elimina immagine"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
      el.querySelector('img').src = s.immagine;
      el.querySelector('b').textContent = s.nome;
      el.querySelector('small').textContent = MK.TIPI[s.tipo].nome + ' · ' + s.posizioni.length + (s.posizioni.length === 1 ? ' posizione' : ' posizioni');
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (s.id !== ed.scenaId) { ed.scenaId = s.id; ed.posId = null; caricaScena(); }
      });
      el.querySelector('button').addEventListener('click', () => {
        if (!window.confirm('Eliminare l\'immagine «' + s.nome + '» e le sue posizioni?')) return;
        ed.template.scene = ed.template.scene.filter((x) => x !== s);
        if (ed.scenaId === s.id) ed.scenaId = ed.template.scene.length ? ed.template.scene[0].id : null;
        segnaModifica();
        caricaScena();
      });
      box.appendChild(el);
    }
  }

  function riempiPosizioni() {
    const s = scena();
    const box = $('ed-posizioni');
    box.innerHTML = '';
    s.posizioni.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'voce' + (p.id === ed.posId ? ' attiva' : '');
      el.innerHTML = '<span class="pallino"></span><input type="text" aria-label="Nome posizione"><label class="bordo" title="Allarga il logo oltre i punti (in pixel) per coprire residui di un vecchio logo nella foto"><input type="number" min="0" max="5" step="0.1" aria-label="Bordo in pixel"></label><button type="button" class="icona" title="Elimina posizione" aria-label="Elimina posizione"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
      el.querySelector('.pallino').style.background = COLORI[i % COLORI.length];
      const nome = el.querySelector('input[type=text]');
      nome.value = p.nome;
      nome.addEventListener('input', () => { p.nome = nome.value; segnaModifica(); });
      nome.addEventListener('change', () => { if (!p.nome.trim()) { p.nome = 'Posizione ' + (i + 1); nome.value = p.nome; } });
      const bordo = el.querySelector('input[type=number]');
      bordo.value = p.bordo || 0;
      bordo.addEventListener('change', () => {
        p.bordo = Math.max(0, Math.min(5, Number(bordo.value) || 0));
        bordo.value = p.bordo;
        segnaModifica();
        ricomponi(false);
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('button,input')) return;
        seleziona(p.id, null);
      });
      el.querySelector('button').addEventListener('click', () => {
        s.posizioni = s.posizioni.filter((x) => x !== p);
        if (ed.posId === p.id) { ed.posId = s.posizioni.length ? s.posizioni[0].id : null; ed.punto = null; }
        segnaModifica();
        aggiornaTutto();
        ricomponi(false);
      });
      box.appendChild(el);
    });
    if (!s.posizioni.length) {
      const n = document.createElement('p');
      n.className = 'nota';
      n.textContent = 'Nessuna posizione: aggiungine una e trascina i punti sulla foto.';
      box.appendChild(n);
    }
  }

  function seleziona(posId, punto) {
    ed.posId = posId;
    ed.punto = punto;
    document.querySelectorAll('#ed-posizioni .voce').forEach((el, i) => el.classList.toggle('attiva', scena().posizioni[i].id === posId));
    aggiornaPunto();
    disegna();
  }

  function aggiornaPunto() {
    const p = posizione();
    const box = $('ed-punto');
    if (!p || ed.punto == null) { box.hidden = true; return; }
    box.hidden = false;
    const forma = formato(scena()).forma;
    $('ed-punto-nome').textContent = p.nome + ' · ' + ETICHETTE[forma][ed.punto];
    if (document.activeElement !== $('ed-punto-x')) $('ed-punto-x').value = p.punti[ed.punto][0].toFixed(1);
    if (document.activeElement !== $('ed-punto-y')) $('ed-punto-y').value = p.punti[ed.punto][1].toFixed(1);
  }

  function aggiornaNotaSalva() {
    const nota = $('ed-nota-salva');
    if (!ed.template) { nota.textContent = ''; return; }
    const stato = ed.modificato ? '<b>Modifiche non salvate.</b> ' : '';
    const cifrati = T.protezione() ? ', cifrati con la password del team' : '';
    nota.innerHTML = stato + (A.supportato
      ? 'Scegli la cartella <code>templates</code> di Mockup Studio: verranno scritti <code>' + esc(nomeFile()) + '</code> ed <code>elenco.js</code>' + cifrati + '.'
      : 'Verranno scaricati <code>' + esc(nomeFile()) + '</code> ed <code>elenco.js</code>' + cifrati + ': spostali nella cartella <code>templates</code> (sostituendo il vecchio elenco).');
    $('ed-salva').hidden = !A.supportato;
    $('ed-salva').disabled = !ed.template;
    $('ed-scarica').disabled = !ed.template;
  }

  // ---------- vista (zoom e spostamento) ----------
  function dimPalco() {
    const r = $('ed-palco').getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function adatta() {
    if (!ed.immagine) return;
    const { w, h } = dimPalco();
    if (w < 60 || h < 60) return;
    const iw = ed.immagine.naturalWidth, ih = ed.immagine.naturalHeight, m = 24;
    const s = Math.min((w - 2 * m) / iw, (h - 2 * m) / ih);
    ed.vista = { s, tx: (w - iw * s) / 2, ty: (h - ih * s) / 2 };
    disegna();
  }

  function zoomA(s, cx, cy) {
    const v = ed.vista;
    s = Math.max(0.05, Math.min(40, s));
    const ix = (cx - v.tx) / v.s, iy = (cy - v.ty) / v.s;
    ed.vista = { s, tx: cx - ix * s, ty: cy - iy * s };
    disegna();
  }

  function aSchermo(p) { return [p[0] * ed.vista.s + ed.vista.tx, p[1] * ed.vista.s + ed.vista.ty]; }
  function aImmagine(x, y) { return [(x - ed.vista.tx) / ed.vista.s, (y - ed.vista.ty) / ed.vista.s]; }

  // ---------- disegno ----------
  function ricomponi(bozza) {
    const s = scena();
    if (!s || !ed.immagine) { ed.composto = null; disegna(); return; }
    if (!$('ed-prova').checked || !s.posizioni.length) { ed.composto = null; disegna(); return; }
    const f = formato(s);
    const art = C.artworkProva(f);
    const c = MK.render.creaCanvas(ed.immagine.naturalWidth, ed.immagine.naturalHeight);
    MK.render.contesto(c).drawImage(ed.immagine, 0, 0);
    for (const p of s.posizioni) {
      try {
        const H = G.omografiaPosizione(f.forma, art.width, art.height, p.punti, p.bordo);
        MK.render.deforma(c, art, H, { campioni: bozza ? 1 : 3, opacita: 0.82 });
      } catch (e) { /* punti degeneri durante il trascinamento */ }
    }
    ed.composto = c;
    disegna();
  }

  let rafDisegno = 0;
  function disegna() {
    if (rafDisegno) return;
    rafDisegno = requestAnimationFrame(() => { rafDisegno = 0; disegnaOra(); });
  }

  function disegnaOra() {
    const cv = $('ed-canvas');
    const { w, h } = dimPalco();
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    $('ed-zoom').textContent = ed.immagine ? Math.round(ed.vista.s * 100) + '%' : '';
    if (!ed.immagine) return;
    const v = ed.vista;
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.tx, dpr * v.ty);
    ctx.imageSmoothingEnabled = v.s < 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ed.composto || ed.immagine, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const s = scena();
    if (!s) return;
    const f = formato(s);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.posizioni.forEach((p, i) => disegnaPosizione(ctx, p, f, COLORI[i % COLORI.length], p.id === ed.posId));
    if (ed.azione && ed.azione.tipo === 'punto') disegnaLente();
  }

  function disegnaPosizione(ctx, p, f, colore, selezionata) {
    const v = ed.vista;
    ctx.save();
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([v.s, 0, 0, v.s, v.tx, v.ty])));
    C.tracciaContorno(ctx, f, p.punti);
    ctx.restore();
    ctx.lineWidth = selezionata ? 2 : 1.25;
    ctx.strokeStyle = colore;
    ctx.stroke();
    const S = p.punti.map(aSchermo);
    if (f.forma === 'cerchio') {
      // diametri e centro (immagine del centro del cerchio)
      ctx.beginPath();
      ctx.moveTo(S[0][0], S[0][1]); ctx.lineTo(S[2][0], S[2][1]);
      ctx.moveTo(S[1][0], S[1][1]); ctx.lineTo(S[3][0], S[3][1]);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      try {
        const H = G.omografia(G.puntiArtwork('cerchio', 2, 2), p.punti);
        const c = aSchermo(G.applica(H, 1, 1));
        ctx.beginPath();
        ctx.moveTo(c[0] - 9, c[1]); ctx.lineTo(c[0] + 9, c[1]);
        ctx.moveTo(c[0], c[1] - 9); ctx.lineTo(c[0], c[1] + 9);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } catch (e) { /* degenere */ }
    }
    if (!selezionata) return;
    const etichette = ETICHETTE[f.forma];
    ctx.font = '600 11px -apple-system, system-ui, sans-serif';
    S.forEach((q, k) => {
      const attivo = ed.punto === k;
      ctx.beginPath();
      ctx.arc(q[0], q[1], attivo ? 7 : 6, 0, Math.PI * 2);
      ctx.fillStyle = attivo ? colore : '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = attivo ? '#fff' : colore;
      ctx.stroke();
      const t = etichette[k];
      const tw = ctx.measureText(t).width;
      const lx = q[0] + 10, ly = q[1] - 10;
      ctx.fillStyle = 'rgba(15,17,21,.78)';
      ctx.fillRect(lx - 4, ly - 11, tw + 8, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(t, lx, ly + 1);
    });
  }

  function disegnaLente() {
    const p = posizione();
    const lente = $('ed-lente');
    if (!p || ed.punto == null) { lente.hidden = true; return; }
    const q = p.punti[ed.punto];
    const k = 8, dim = lente.width, meta = dim / 2 / k;
    const ctx = lente.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, dim, dim);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(k, 0, 0, k, -(q[0] - meta) * k, -(q[1] - meta) * k);
    ctx.drawImage(ed.immagine, 0, 0);
    const f = formato(scena());
    C.tracciaContorno(ctx, f, p.punti);
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = '#ff3df2';
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dim / 2, dim / 2 - 14); ctx.lineTo(dim / 2, dim / 2 - 4);
    ctx.moveTo(dim / 2, dim / 2 + 4); ctx.lineTo(dim / 2, dim / 2 + 14);
    ctx.moveTo(dim / 2 - 14, dim / 2); ctx.lineTo(dim / 2 - 4, dim / 2);
    ctx.moveTo(dim / 2 + 4, dim / 2); ctx.lineTo(dim / 2 + 14, dim / 2);
    ctx.stroke();
    lente.hidden = false;
    const sx = aSchermo(q)[0];
    lente.classList.toggle('destra', sx < dimPalco().w / 2);
  }

  // ---------- interazione sulla foto ----------
  function puntoVicino(x, y) {
    const s = scena();
    if (!s) return null;
    const ordine = s.posizioni.slice().sort((a, b) => (a.id === ed.posId ? -1 : b.id === ed.posId ? 1 : 0));
    for (const p of ordine) {
      for (let k = 0; k < 4; k++) {
        const q = aSchermo(p.punti[k]);
        if (Math.hypot(q[0] - x, q[1] - y) <= 10) return { pos: p, k };
      }
    }
    return null;
  }

  function coordinate(e) {
    const r = $('ed-palco').getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function giu(e) {
    if (!ed.immagine || e.button > 1) return;
    const [x, y] = coordinate(e);
    const vicino = e.button === 0 ? puntoVicino(x, y) : null;
    try { $('ed-palco').setPointerCapture(e.pointerId); } catch (err) { /* puntatore non catturabile */ }
    $('ed-palco').focus({ preventScroll: true });
    if (vicino) {
      seleziona(vicino.pos.id, vicino.k);
      const q = vicino.pos.punti[vicino.k];
      const m = aImmagine(x, y);
      ed.azione = { tipo: 'punto', dx: q[0] - m[0], dy: q[1] - m[1] };
      $('ed-palco').classList.add('maniglia');
      disegna();
    } else {
      ed.azione = { tipo: 'pan', x, y, tx: ed.vista.tx, ty: ed.vista.ty, mosso: false };
      $('ed-palco').classList.add('trascina');
    }
  }

  function muovi(e) {
    const [x, y] = coordinate(e);
    const a = ed.azione;
    if (!a || a.tastiera) {
      $('ed-palco').classList.toggle('maniglia', !!puntoVicino(x, y));
      return;
    }
    if (a.tipo === 'punto') {
      const m = aImmagine(x, y);
      const p = posizione();
      p.punti[ed.punto] = [arrot(m[0] + a.dx), arrot(m[1] + a.dy)];
      segnaModifica();
      aggiornaPunto();
      ricomponiPresto();
    } else {
      if (Math.abs(x - a.x) + Math.abs(y - a.y) > 3) a.mosso = true;
      ed.vista.tx = a.tx + (x - a.x);
      ed.vista.ty = a.ty + (y - a.y);
      disegna();
    }
  }

  function su() {
    const a = ed.azione;
    ed.azione = null;
    $('ed-palco').classList.remove('trascina', 'maniglia');
    $('ed-lente').hidden = true;
    if (a && a.tipo === 'punto') ricomponi(false);
    else if (a && a.tipo === 'pan' && !a.mosso) { ed.punto = null; aggiornaPunto(); disegna(); }
  }

  function arrot(v) { return Math.round(v * 100) / 100; }

  function ricomponiPresto() {
    if (ed.attesaComposto) return;
    ed.attesaComposto = requestAnimationFrame(() => { ed.attesaComposto = 0; ricomponi(true); });
  }

  function tasto(e) {
    const p = posizione();
    if (!p || ed.punto == null) return;
    const passi = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = passi[e.key];
    if (!d) return;
    e.preventDefault();
    const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const q = p.punti[ed.punto];
    p.punti[ed.punto] = [arrot(q[0] + d[0] * k), arrot(q[1] + d[1] * k)];
    segnaModifica();
    aggiornaPunto();
    ed.azione = { tipo: 'punto', tastiera: true };
    ricomponi(true);
    clearTimeout(ed.timerTasto);
    ed.timerTasto = setTimeout(() => { ed.azione = null; $('ed-lente').hidden = true; ricomponi(false); }, 700);
  }

  // ---------- azioni ----------
  function idUnico(base, esistenti) {
    let id = base, n = 2;
    while (esistenti.includes(id)) id = base + '-' + n++;
    return id;
  }

  function nuovoTemplate() {
    if (!conferma()) return;
    apri({ id: '', nome: 'Nuovo cliente', scene: [] }, true);
    $('ed-nome').focus();
    $('ed-nome').select();
  }

  async function aggiungiScena(file) {
    if (!ed.template) nuovoTemplate();
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return avvisa('Usa un\'immagine JPG o PNG come base.', 'errore');
    try {
      const url = await MK.loghi.leggiComeDataURL(file);
      const img = await MK.loghi.caricaImmagine(url);
      const usate = ed.template.scene.map((s) => s.tipo);
      const tipo = Object.keys(MK.TIPI).find((k) => !usate.includes(k)) || 'CC';
      const nome = file.name.replace(/\.[a-z0-9]+$/i, '');
      const s = {
        id: idUnico(T.slug(nome), ed.template.scene.map((x) => x.id)),
        tipo,
        nome,
        larghezza: img.naturalWidth,
        altezza: img.naturalHeight,
        immagine: url,
        posizioni: [],
      };
      ed.template.scene.push(s);
      ed.scenaId = s.id;
      ed.posId = null;
      segnaModifica();
      await caricaScena();
      avvisa('Immagine aggiunta: scegli la tipologia e aggiungi le posizioni.', 'ok');
    } catch (e) {
      avvisa(e.message, 'errore');
    }
  }

  function aggiungiPosizione() {
    const s = scena();
    if (!s || !ed.immagine) return;
    const f = formato(s);
    const { w, h } = dimPalco();
    const c = aImmagine(w / 2, h / 2);
    const iw = ed.immagine.naturalWidth;
    const larg = Math.min(iw * 0.3, (w / ed.vista.s) * 0.4);
    let punti;
    if (f.forma === 'cerchio') {
      const alt = larg * 0.22;
      punti = [[c[0], c[1] - alt / 2], [c[0] + larg / 2, c[1]], [c[0], c[1] + alt / 2], [c[0] - larg / 2, c[1]]];
    } else {
      const alt = larg * (f.h / f.w);
      punti = [[c[0] - larg / 2, c[1] - alt / 2], [c[0] + larg / 2, c[1] - alt / 2], [c[0] + larg / 2, c[1] + alt / 2], [c[0] - larg / 2, c[1] + alt / 2]];
    }
    const n = s.posizioni.length + 1;
    const p = {
      id: idUnico('posizione-' + n, s.posizioni.map((x) => x.id)),
      nome: f.forma === 'cerchio' ? 'Cerchio di centrocampo' : 'Posizione ' + n,
      punti: punti.map((q) => [arrot(q[0]), arrot(q[1])]),
      bordo: 0,
    };
    s.posizioni.push(p);
    ed.posId = p.id;
    ed.punto = 0;
    segnaModifica();
    aggiornaTutto();
    ricomponi(false);
  }

  // Cambiando tipologia i punti vengono convertiti (angoli ↔ punti cardinali) mantenendo la stessa superficie.
  function cambiaTipo(tipo) {
    const s = scena();
    if (!s || s.tipo === tipo) return;
    const da = MK.TIPI[s.tipo].forma, a = MK.TIPI[tipo].forma;
    for (const p of s.posizioni) {
      try {
        const H = G.omografia(G.puntiArtwork(da, 1, 1), p.punti);
        p.punti = G.puntiArtwork(a, 1, 1).map((q) => G.applica(H, q[0], q[1]).map(arrot));
      } catch (e) { /* lascia i punti */ }
    }
    s.tipo = tipo;
    segnaModifica();
    aggiornaTutto();
    ricomponi(false);
  }

  function validaPerSalvare() {
    const t = ed.template;
    if (!t) return false;
    t.nome = (t.nome || '').trim();
    if (!t.nome) { avvisa('Dai un nome al template (di solito il nome del cliente).', 'errore'); $('ed-nome').focus(); return false; }
    if (!t.scene.length) { avvisa('Aggiungi almeno un\'immagine di base.', 'errore'); return false; }
    const vuote = t.scene.filter((s) => !s.posizioni.length).map((s) => s.nome);
    if (vuote.length && !window.confirm('Queste immagini non hanno posizioni: ' + vuote.join(', ') + '.\nSalvare comunque?')) return false;
    if (!t.id) t.id = T.nuovoId(t.nome);
    return true;
  }

  async function preparaFile() {
    const t = clona(ed.template);
    T.registraInMemoria(t);
    const voce = T.elenco.find((v) => v.id === t.id);
    return [
      { nome: voce.file, blob: new Blob([await T.fileTemplate(t)], { type: 'text/javascript' }) },
      { nome: 'elenco.js', blob: new Blob([await T.fileElenco()], { type: 'text/javascript' }) },
    ];
  }

  // Chiede (o riusa) l'accesso alla cartella templates: va fatto subito dopo il clic, prima dei calcoli lunghi.
  async function ottieniCartellaTemplate() {
    let ok = false;
    if (cartellaTemplate.handle) { try { ok = await cartellaTemplate.permesso(); } catch (e) { ok = false; } }
    if (!ok) {
      await cartellaTemplate.scegli();
      ok = await cartellaTemplate.permesso();
    }
    if (!ok) throw new Error('accesso alla cartella non concesso');
    if (!(await cartellaTemplate.esiste('elenco.js')) && !window.confirm('La cartella «' + cartellaTemplate.handle.name + '» non contiene elenco.js.\nÈ davvero la cartella "templates" di Mockup Studio?')) {
      cartellaTemplate.handle = null;
      const annullato = new Error('annullato');
      annullato.name = 'AbortError';
      throw annullato;
    }
  }

  // elenco.js per ultimo: se qualcosa si interrompe, l'elenco resta quello di prima.
  async function salvaFiles(files) {
    for (const f of files.filter((x) => x.nome !== 'elenco.js')) await cartellaTemplate.salva(f.nome, f.blob);
    for (const f of files.filter((x) => x.nome === 'elenco.js')) await cartellaTemplate.salva(f.nome, f.blob);
  }

  async function dopoSalvataggio(messaggio) {
    ed.modificato = false;
    riempiTemplate();
    aggiornaTutto();
    avvisa(messaggio, 'ok');
    await MK.app.templateAggiornato(ed.template.id);
  }

  async function salvaInCartella() {
    if (!validaPerSalvare()) return;
    try {
      await ottieniCartellaTemplate();
      const files = await preparaFile();
      await salvaFiles(files);
      await dopoSalvataggio('Template salvato in «' + cartellaTemplate.handle.name + '»: ' + files.map((f) => f.nome).join(' e '));
    } catch (e) {
      if (e.name !== 'AbortError') avvisa('Salvataggio non riuscito: ' + e.message, 'errore');
    }
  }

  async function scaricaFile() {
    if (!validaPerSalvare()) return;
    const files = await preparaFile();
    await A.scaricaTutti(files);
    await dopoSalvataggio('Scaricati ' + files.map((f) => f.nome).join(' e ') + ': spostali nella cartella templates (sostituendo elenco.js).');
  }

  async function importa(file) {
    try {
      const t = await T.leggiFileTemplate(await file.text());
      if (!conferma()) return;
      T.registraInMemoria(t);
      apri(clona(t), true);
      avvisa('Template «' + t.nome + '» importato: salvalo nella cartella templates per ritrovarlo alla prossima apertura.', 'ok');
      await MK.app.templateAggiornato(t.id);
    } catch (e) {
      avvisa('Import non riuscito: ' + e.message, 'errore');
    }
  }

  // ---------- password del team ----------
  function aggiornaNotaPassword() {
    const protetta = !!T.protezione();
    $('ed-nota-password').innerHTML = protetta
      ? 'I template sono cifrati: senza la password nessuno può vedere le foto dei clienti. Cambiandola vengono ricifrati tutti; poi pubblicali su GitHub e comunica la nuova password ai colleghi.'
      : 'Nessuna password: i template sono in chiaro. Impostane una prima di pubblicare la piattaforma su un sito pubblico.';
    $('ed-cambia-password').textContent = protetta ? 'Cambia password' : 'Imposta la password';
  }

  async function cambiaPassword(e) {
    e.preventDefault();
    const nuova = $('ed-nuova-password').value, ripeti = $('ed-conferma-password').value;
    if (nuova.length < 8) return avvisa('La password deve avere almeno 8 caratteri.', 'errore');
    if (nuova !== ripeti) return avvisa('Le due password non coincidono.', 'errore');
    if (ed.modificato && !window.confirm('Le modifiche non salvate al template aperto non verranno incluse. Continuare?')) return;
    const bottone = $('ed-cambia-password');
    const vecchia = { protezione: T.protezione(), chiave: T.chiave() };
    bottone.disabled = true;
    try {
      const inCartella = A.supportato;
      if (inCartella) await ottieniCartellaTemplate();
      bottone.textContent = 'Cifratura in corso…';
      const tutti = [];
      for (const v of T.elenco) tutti.push(await T.carica(v.id));
      const nuovaProt = await MK.cifra.nuovaProtezione(nuova);
      T.impostaProtezione(nuovaProt.protezione, nuovaProt.chiave);
      const files = [];
      for (const t of tutti) {
        const voce = T.elenco.find((v) => v.id === t.id);
        files.push({ nome: voce.file, blob: new Blob([await T.fileTemplate(t)], { type: 'text/javascript' }) });
      }
      files.push({ nome: 'elenco.js', blob: new Blob([await T.fileElenco()], { type: 'text/javascript' }) });
      if (inCartella) await salvaFiles(files);
      else await A.scaricaTutti(files);
      await MK.accesso.aggiornaChiaveRicordata(nuovaProt.chiave, nuovaProt.protezione);
      $('ed-nuova-password').value = '';
      $('ed-conferma-password').value = '';
      $('btn-esci').hidden = false;
      aggiornaNotaSalva();
      avvisa(inCartella
        ? 'Password impostata e template ricifrati. Ora pubblicali su GitHub e comunica la nuova password al team.'
        : 'Password impostata: sposta i file scaricati nella cartella templates, pubblicali su GitHub e comunica la nuova password al team.', 'ok');
    } catch (err) {
      T.impostaProtezione(vecchia.protezione, vecchia.chiave);
      if (err.name !== 'AbortError') avvisa('Cambio password non riuscito: ' + err.message, 'errore');
    } finally {
      bottone.disabled = false;
      aggiornaNotaPassword();
    }
  }

  function fileTrascinato(f) {
    if (/\.(js|json)$/i.test(f.name)) importa(f);
    else aggiungiScena(f);
  }

  // ---------- eventi ----------
  function collega() {
    $('ed-sel-template').addEventListener('change', async (e) => {
      const id = e.target.value;
      if (!id) return;
      if (!conferma()) { riempiTemplate(); return; }
      try {
        apri(clona(await T.carica(id)), false);
      } catch (err) {
        avvisa(err.message, 'errore');
      }
    });
    $('ed-nuovo').addEventListener('click', nuovoTemplate);
    $('ed-importa').addEventListener('change', (e) => { if (e.target.files[0]) importa(e.target.files[0]); e.target.value = ''; });
    $('ed-nome').addEventListener('input', (e) => {
      if (!ed.template) return;
      ed.template.nome = e.target.value;
      segnaModifica();
      $('ed-file').textContent = nomeFile();
    });
    $('ed-file-scena').addEventListener('change', (e) => { if (e.target.files[0]) aggiungiScena(e.target.files[0]); e.target.value = ''; });
    $('ed-nome-scena').addEventListener('input', (e) => {
      const s = scena();
      if (!s) return;
      s.nome = e.target.value;
      segnaModifica();
      const voce = document.querySelector('#ed-scene .voce.attiva b');
      if (voce) voce.textContent = s.nome;
    });
    MK.app.riempiTipi($('ed-tipo-scena'), C.descrizioneFormato);
    $('ed-tipo-scena').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tipo]');
      if (b) cambiaTipo(b.dataset.tipo);
    });
    $('ed-aggiungi-pos').addEventListener('click', aggiungiPosizione);
    $('ed-prova').addEventListener('change', () => ricomponi(false));
    for (const [id, i] of [['ed-punto-x', 0], ['ed-punto-y', 1]]) {
      $(id).addEventListener('change', (e) => {
        const p = posizione();
        const v = parseFloat(String(e.target.value).replace(',', '.'));
        if (!p || ed.punto == null || !isFinite(v)) return;
        p.punti[ed.punto][i] = arrot(v);
        segnaModifica();
        ricomponi(false);
      });
    }
    $('ed-salva').addEventListener('click', salvaInCartella);
    $('ed-form-password').addEventListener('submit', cambiaPassword);
    $('ed-scarica').addEventListener('click', scaricaFile);
    $('ed-adatta').addEventListener('click', adatta);
    $('ed-100').addEventListener('click', () => {
      const { w, h } = dimPalco();
      const p = posizione();
      if (p) {
        const cx = p.punti.reduce((a, q) => a + q[0], 0) / 4, cy = p.punti.reduce((a, q) => a + q[1], 0) / 4;
        ed.vista = { s: 1, tx: w / 2 - cx, ty: h / 2 - cy };
        disegna();
      } else zoomA(1, w / 2, h / 2);
    });

    const palco = $('ed-palco');
    palco.addEventListener('pointerdown', giu);
    palco.addEventListener('pointermove', muovi);
    palco.addEventListener('pointerup', su);
    palco.addEventListener('pointercancel', su);
    palco.addEventListener('wheel', (e) => {
      if (!ed.immagine) return;
      e.preventDefault();
      const [x, y] = coordinate(e);
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      zoomA(ed.vista.s * k, x, y);
    }, { passive: false });
    palco.addEventListener('keydown', tasto);
    window.addEventListener('resize', () => { if (!$('vista-template').hidden) disegna(); });
    window.addEventListener('beforeunload', (e) => {
      if (ed.modificato) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  MK.editor = { attiva, fileTrascinato, stato: ed };
})(window.MK = window.MK || {});
