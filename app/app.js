/* Mockup Studio — schermata "Crea mockup". */
(function (MK) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const L = MK.loghi, C = MK.composizione, A = MK.archivio, R = MK.render;

  const stato = {
    template: null,
    tipo: 'CC',
    scena: null,
    immagine: null,
    sorgente: null,        // file del logo letto
    rifilatoGrezzo: null,  // logo rifilato, senza rimozione dello sfondo
    logo: null,            // { canvas, raggio } pronto per la composizione
    colori: [],
    uniforme: null,        // colore dello sfondo pieno trovato nel file, se c'è
    rilevato: false,       // il file sembra già composto
    fonteComposto: null,
    passthrough: false,    // il PNG del cliente si può salvare identico
    composto: false,
    p: { sfondo: '#ffffff', dimensione: MK.TIPI.CC.dimensione, offX: 0, offY: 0 },
    coloreScelto: false,
    rimuovi: 'no',
    coloreRimozione: '#ffffff',
    tolleranza: 40,
    attive: {},            // id scena -> Set(id posizioni)
    brand: '',
    brandAutomatico: false,
    zoom: 'intera',
    evidenzia: null,
    artwork: null,
    artworkHi: null,
  };
  const cartella = new A.Cartella('cartella-mockup');

  // ---------- utilità ----------
  function esc(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function ricorda(k, v) { try { localStorage.setItem('mockup:' + k, v); } catch (e) { /* facoltativo */ } }
  function ricordato(k) { try { return localStorage.getItem('mockup:' + k); } catch (e) { return null; } }

  function avvisa(testo, tipo) {
    const el = document.createElement('div');
    el.className = 'avviso' + (tipo ? ' ' + tipo : '');
    el.textContent = testo;
    $('avvisi').appendChild(el);
    setTimeout(() => el.remove(), tipo === 'errore' ? 7000 : 4500);
  }

  function caricamento(si) { $('caricamento').hidden = !si; }

  function segna(contenitore, attributo, valore) {
    document.querySelectorAll(contenitore + ' button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attributo] === valore)));
  }

  function formato() { return C.formatoScena(stato.scena); }

  function nomeBrand() {
    return stato.brand.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
  }
  function nomeBase() {
    return (nomeBrand() || 'Brand') + '_' + formato().sigla;
  }

  function suggerisciBrand(nomeFile) {
    return nomeFile.replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(logo|logotipo|marchio|vettoriale|vector|def|final[e]?|hd|hq|rgb|cmyk|positivo|negativo|bianco|nero|white|black|cc|mats|v\d+)\b/gi, '')
      .replace(/\s+/g, ' ').trim();
  }

  // ---------- template e scene ----------
  // Un pulsante per ogni tipologia definita in MK.TIPI (usato anche dall'editor dei template).
  function riempiTipi(contenitore, dettaglio) {
    contenitore.innerHTML = '';
    for (const [chiave, t] of Object.entries(MK.TIPI)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.tipo = chiave;
      const nome = document.createElement('b');
      nome.textContent = t.nome;
      const sotto = document.createElement('small');
      sotto.textContent = dettaglio(t);
      b.append(nome, sotto);
      contenitore.appendChild(b);
    }
  }

  async function avvia() {
    riempiTipi($('sel-tipo'), C.descrizioneFormato);
    collegaEventi();
    segna('#sel-zoom', 'zoom', stato.zoom);
    aggiornaControlli();
    try { await cartella.ripristina(); } catch (e) { /* ok */ }
    aggiornaCartella();
    const elenco = await MK.template.caricaElenco();
    await MK.accesso.sblocca();
    riempiClienti();
    if (!elenco.length) {
      messaggioPalco('Nessun template trovato.<br>Controlla che la cartella <b>templates</b> sia accanto a questa pagina.');
      return;
    }
    const ultimo = ricordato('cliente');
    const tipo = ricordato('tipo');
    if (tipo && MK.TIPI[tipo]) { stato.tipo = tipo; stato.p.dimensione = MK.TIPI[tipo].dimensione; aggiornaControlli(); }
    await selezionaCliente(elenco.some((t) => t.id === ultimo) ? ultimo : elenco[0].id);
  }

  function riempiClienti() {
    const sel = $('sel-cliente');
    const attuale = sel.value;
    sel.innerHTML = '';
    for (const t of MK.template.elenco) {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.nome;
      sel.appendChild(o);
    }
    if (attuale) sel.value = attuale;
  }

  async function selezionaCliente(id) {
    caricamento(true);
    try {
      const t = await MK.template.carica(id);
      stato.template = t;
      $('sel-cliente').value = id;
      ricorda('cliente', id);
      const tipi = [...new Set(t.scene.map((s) => s.tipo))];
      document.querySelectorAll('#sel-tipo button').forEach((b) => {
        b.disabled = !tipi.includes(b.dataset.tipo);
        b.title = b.disabled ? 'Nessuna immagine di questa tipologia per il cliente: aggiungila dalla scheda Template' : '';
      });
      $('nota-tipi').hidden = tipi.length >= Object.keys(MK.TIPI).length;
      if (!tipi.length) {
        messaggioPalco('Questo template non contiene immagini.');
        return;
      }
      await selezionaTipo(tipi.includes(stato.tipo) ? stato.tipo : tipi[0], true);
    } catch (e) {
      avvisa(e.message, 'errore');
    } finally {
      caricamento(false);
    }
  }

  async function selezionaTipo(tipo, forza) {
    if (!stato.template) return;
    const cambiato = tipo !== stato.tipo;
    stato.tipo = tipo;
    ricorda('tipo', tipo);
    segna('#sel-tipo', 'tipo', tipo);
    const scene = stato.template.scene.filter((s) => s.tipo === tipo);
    const sel = $('sel-scena');
    sel.innerHTML = '';
    scene.forEach((s) => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.nome;
      sel.appendChild(o);
    });
    $('campo-scena').hidden = scene.length < 2;
    if (cambiato) {
      stato.p.dimensione = MK.TIPI[tipo].dimensione;
      stato.p.offX = stato.p.offY = 0;
      aggiornaControlli();
    }
    if (scene.length && (cambiato || forza || !stato.scena || stato.scena.tipo !== tipo)) await selezionaScena(scene[0].id);
  }

  async function selezionaScena(id) {
    const scena = stato.template.scene.find((s) => s.id === id);
    if (!scena) return;
    stato.scena = scena;
    $('sel-scena').value = id;
    if (!stato.attive[scena.id]) stato.attive[scena.id] = new Set(scena.posizioni.map((p) => p.id));
    riempiPosizioni();
    caricamento(true);
    try {
      stato.immagine = await MK.template.immagineScena(scena);
    } finally {
      caricamento(false);
    }
    preparaTela();
    if (stato.sorgente) valutaComposto();
    aggiornaInfoLogo();
    aggiornaUscite();
    richiediRender();
  }

  function riempiPosizioni() {
    const lista = $('lista-posizioni');
    lista.innerHTML = '';
    const attive = stato.attive[stato.scena.id];
    for (const pos of stato.scena.posizioni) {
      const el = document.createElement('label');
      el.className = 'posizione' + (attive.has(pos.id) ? ' attiva' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = attive.has(pos.id);
      const nome = document.createElement('span');
      nome.textContent = pos.nome;
      el.append(cb, nome);
      cb.addEventListener('change', () => {
        if (cb.checked) attive.add(pos.id); else attive.delete(pos.id);
        el.classList.toggle('attiva', cb.checked);
        aggiornaUscite();
        if (stato.zoom === 'dettaglio') adattaVista();
        richiediRender();
      });
      el.addEventListener('mouseenter', () => { stato.evidenzia = pos.id; disegnaSovrapposto(); });
      el.addEventListener('mouseleave', () => { stato.evidenzia = null; disegnaSovrapposto(); });
      lista.appendChild(el);
    }
    $('passo-posizioni').hidden = stato.scena.posizioni.length < 2;
  }

  // ---------- logo ----------
  async function caricaLogo(file) {
    $('errore-logo').hidden = true;
    caricamento(true);
    try {
      const s = await L.carica(file);
      stato.sorgente = s;
      stato.coloreScelto = false;
      // il nome brand viene proposto dal nome del file, ma non sovrascrive quello scritto a mano
      if (!$('txt-brand').value.trim() || stato.brandAutomatico) {
        $('txt-brand').value = suggerisciBrand(file.name);
        stato.brand = $('txt-brand').value;
        stato.brandAutomatico = true;
      }
      elaboraLogo(true);
      aggiornaInfoLogo();
      aggiornaUscite();
      richiediRender();
    } catch (e) {
      console.error(e);
      $('errore-logo').textContent = e.message;
      $('errore-logo').hidden = false;
    } finally {
      caricamento(false);
      $('file-logo').value = '';
    }
  }

  function elaboraLogo(nuovo) {
    const s = stato.sorgente;
    if (!s) return;
    const grezzo = s.canvas;
    if (nuovo) {
      stato.uniforme = L.sfondoUniforme(grezzo);
      stato.coloreRimozione = L.inHex(stato.uniforme || L.coloreBordo(grezzo) || [255, 255, 255]);
      // si toglie da solo solo il fondo bianco: un riquadro colorato di solito fa parte del logo
      stato.rimuovi = L.quasiBianco(stato.uniforme) ? 'ovunque' : 'no';
      stato.rifilatoGrezzo = L.rifila(grezzo);
      aggiornaMiniatura();
    }
    const lavoro = stato.rimuovi !== 'no'
      ? L.rimuoviSfondo(grezzo, L.daHex(stato.coloreRimozione), stato.rimuovi, stato.tolleranza)
      : grezzo;
    const canvas = L.rifila(lavoro);
    stato.logo = { canvas, raggio: L.raggioVisibile(canvas) };
    const an = L.analizzaColori(canvas);
    stato.colori = an.colori;
    if (nuovo) {
      valutaComposto();
      if (!stato.coloreScelto) stato.p.sfondo = an.luminanza > 190 ? '#000000' : '#ffffff';
      stato.p.dimensione = MK.TIPI[stato.tipo].dimensione;
      stato.p.offX = stato.p.offY = 0;
    }
    aggiornaControlli();
  }

  function valutaComposto() {
    const s = stato.sorgente;
    if (!s || !stato.scena) return;
    const f = formato();
    const grezzo = s.canvas;
    const esatto = grezzo.width === f.w && grezzo.height === f.h;
    let fonte = null;
    if (L.rilevaComposto(grezzo, f)) fonte = grezzo;
    else if (stato.rifilatoGrezzo && L.rilevaComposto(stato.rifilatoGrezzo, f)) fonte = esatto ? grezzo : stato.rifilatoGrezzo;
    stato.rilevato = !!fonte;
    stato.fonteComposto = fonte;
    stato.composto = !!fonte;
    stato.passthrough = !!fonte && fonte === grezzo && esatto && s.ext === 'png' && s.larghezza === f.w && s.altezza === f.h;
  }

  function aggiornaInfoLogo() {
    const s = stato.sorgente;
    $('drop').hidden = !!s;
    $('file-info').hidden = !s;
    if (!s) { aggiornaControlli(); return; }
    $('file-nome').textContent = s.nome;
    const tipoFile = s.vettoriale ? 'vettoriale' : 'immagine';
    $('file-meta').textContent = s.vettoriale
      ? tipoFile + ' · convertito a ' + stato.rifilatoGrezzo.width + ' × ' + stato.rifilatoGrezzo.height + ' px'
      : tipoFile + ' · ' + s.larghezza + ' × ' + s.altezza + ' px';
    const campoPag = $('campo-pagina');
    campoPag.hidden = !(s.pagine > 1);
    if (s.pagine > 1) {
      const sel = $('sel-pagina');
      if (sel.options.length !== s.pagine) {
        sel.innerHTML = '';
        for (let i = 1; i <= s.pagine; i++) {
          const o = document.createElement('option');
          o.value = i; o.textContent = 'Tavola ' + i + ' di ' + s.pagine;
          sel.appendChild(o);
        }
      }
      sel.value = s.pagina;
    }
    const f = formato();
    const forma = f.forma === 'cerchio' ? 'cerchio ' + f.w + ' px' : 'rettangolo ' + f.w + '×' + f.h;
    const box = $('rilevato');
    if (stato.rilevato) {
      box.className = 'rilevato si';
      box.textContent = stato.passthrough
        ? 'File già pronto (' + forma + '): il PNG di produzione sarà il file originale, identico.'
        : 'Riconosciuto come già composto (' + forma + '): verrà usato così com\'è, portato a ' + f.w + '×' + f.h + ' px.';
    } else if (stato.composto) {
      box.className = 'rilevato attenzione';
      box.textContent = 'Il file non sembra un ' + forma + ' già pronto: usandolo così com\'è verrà adattato (e deformato se le proporzioni non coincidono).';
    } else {
      box.className = 'rilevato no';
      box.textContent = f.forma === 'cerchio'
        ? 'Logo da comporre: verrà inscritto nel cerchio da ' + f.w + ' px con lo sfondo scelto.'
        : 'Logo da comporre: verrà inserito nel rettangolo ' + f.w + '×' + f.h + ' con lo sfondo scelto.';
    }
    $('chk-composto').checked = stato.composto;
    aggiornaControlli();
  }

  // Anteprima del file così com'è arrivato: utile per vedere lo sfondo e prelevarne il colore.
  function aggiornaMiniatura() {
    const img = $('file-miniatura');
    const c = stato.sorgente && stato.sorgente.canvas;
    if (!c) { img.removeAttribute('src'); return; }
    const k = Math.min(1, 560 / c.width, 180 / c.height);
    img.src = (k < 1 ? R.ridimensiona(c, c.width * k, c.height * k) : c).toDataURL('image/png');
  }

  function togliLogo() {
    Object.assign(stato, { sorgente: null, logo: null, rifilatoGrezzo: null, uniforme: null, rilevato: false, fonteComposto: null, passthrough: false, composto: false, colori: [], coloreScelto: false, rimuovi: 'no' });
    aggiornaMiniatura();
    $('errore-logo').hidden = true;
    aggiornaInfoLogo();
    aggiornaUscite();
    richiediRender();
  }

  // ---------- controlli di composizione ----------
  function aggiornaControlli() {
    const p = stato.p;
    $('rng-dim').value = Math.round(p.dimensione * 100);
    $('out-dim').textContent = Math.round(p.dimensione * 100) + '%';
    $('rng-x').value = p.offX * 100;
    $('out-x').textContent = fmt(p.offX * 100);
    $('rng-y').value = p.offY * 100;
    $('out-y').textContent = fmt(p.offY * 100);
    $('col-sfondo').value = p.sfondo;
    if (document.activeElement !== $('hex-sfondo')) $('hex-sfondo').value = p.sfondo.toUpperCase();
    $('rng-tol').value = stato.tolleranza;
    $('out-tol').textContent = stato.tolleranza;
    $('sel-rimuovi').value = stato.rimuovi;
    $('blocco-sfondo-logo').hidden = !(stato.sorgente && !stato.composto);
    const togli = stato.rimuovi !== 'no';
    $('campo-colore-rimozione').hidden = !togli;
    $('campo-tolleranza').hidden = !togli;
    $('col-rimozione').value = stato.coloreRimozione;
    if (document.activeElement !== $('hex-rimozione')) $('hex-rimozione').value = stato.coloreRimozione.toUpperCase();
    $('btn-contagocce').hidden = !('EyeDropper' in window);
    $('nota-sfondo').textContent = !stato.sorgente ? ''
      : L.quasiBianco(stato.uniforme) ? 'Il file ha lo sfondo bianco: viene tolto in automatico.'
      : stato.uniforme ? 'Il file ha uno sfondo pieno colorato: se non fa parte del logo, scegli di toglierlo.'
      : togli ? '' : 'Se il logo ha un riquadro o uno sfondo da eliminare, scegli di togliere il suo colore.';
    $('passo-composizione').classList.toggle('disattivo', !!(stato.sorgente && stato.composto));
    riempiCampioni();
  }

  function fmt(v) {
    const r = Math.round(v * 10) / 10;
    return (r > 0 ? '+' : '') + String(r).replace('.', ',') + '%';
  }

  function riempiCampioni() {
    const box = $('campioni');
    const visti = new Set();
    const lista = [];
    for (const c of stato.colori.concat(['#ffffff', '#000000'])) {
      const k = c.toLowerCase();
      if (!visti.has(k)) { visti.add(k); lista.push(k); }
    }
    box.innerHTML = '';
    lista.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'campione';
      b.style.background = c;
      b.title = c.toUpperCase() + (i < stato.colori.length ? ' (dal logo)' : '');
      b.setAttribute('aria-label', 'Sfondo ' + c.toUpperCase());
      b.setAttribute('aria-pressed', String(c === stato.p.sfondo.toLowerCase()));
      b.addEventListener('click', () => impostaSfondo(c));
      box.appendChild(b);
    });
    if (stato.colori.length) {
      const e = document.createElement('span');
      e.className = 'campioni-etichetta';
      e.textContent = 'Colori presi dal logo, poi bianco e nero';
      box.appendChild(e);
    }
  }

  function impostaSfondo(hex) {
    const rgb = L.daHex(hex);
    if (!rgb) return;
    stato.p.sfondo = L.inHex(rgb);
    stato.coloreScelto = true;
    aggiornaControlli();
    richiediRender();
  }

  // ---------- rendering ----------
  let raf = 0, timerFinale = 0;
  function richiediRender() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render(true);
      clearTimeout(timerFinale);
      timerFinale = setTimeout(() => render(false), 160);
    });
  }

  function calcolaArtwork(bozza) {
    const f = formato();
    if (!stato.sorgente) { stato.artwork = stato.artworkHi = null; return; }
    if (stato.composto) {
      const fonte = stato.fonteComposto || stato.sorgente.canvas;
      stato.artwork = C.adattaComposto(f, fonte, 1);
      const k = Math.max(1, Math.min(3, fonte.width / f.w));
      stato.artworkHi = k > 1.05 ? C.adattaComposto(f, fonte, k) : stato.artwork;
    } else {
      stato.artwork = C.componi(f, stato.logo, stato.p, 1);
      stato.artworkHi = C.componi(f, stato.logo, stato.p, bozza ? 2 : 3);
    }
  }

  function render(bozza) {
    if (!stato.immagine || !stato.scena) return;
    calcolaArtwork(bozza);
    disegnaArtwork();
    const cv = $('cv-mockup');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (stato.artworkHi) {
      const m = C.mockup(stato.immagine, stato.scena, stato.artworkHi, [...stato.attive[stato.scena.id]], { campioni: bozza ? 2 : 4 });
      ctx.drawImage(m, 0, 0);
    }
    disegnaSovrapposto();
  }

  function disegnaArtwork() {
    const cv = $('cv-artwork');
    const f = formato();
    const a = stato.artwork;
    cv.width = f.w; cv.height = f.h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, f.w, f.h);
    if (a) ctx.drawImage(a, 0, 0, f.w, f.h);
    cv.style.opacity = a ? '1' : '.35';
    const info = f.w + ' × ' + f.h + ' px' + (f.forma === 'cerchio' ? '<br>cerchio, fuori trasparente' : '');
    $('misura-png').innerHTML = info + (stato.passthrough && stato.composto ? '<br>file originale del cliente' : '');
  }

  function preparaTela() {
    const w = stato.immagine.naturalWidth, h = stato.immagine.naturalHeight;
    for (const id of ['cv-base', 'cv-mockup', 'cv-sovrapposto']) {
      const cv = $(id);
      cv.width = w; cv.height = h;
    }
    $('cv-base').getContext('2d').drawImage(stato.immagine, 0, 0);
    $('cv-mockup').getContext('2d').clearRect(0, 0, w, h);
    $('misura-mockup').textContent = 'Mockup JPG ' + w + ' × ' + h + ' px';
    $('palco-messaggio').hidden = true;
    adattaVista();
  }

  function disegnaSovrapposto() {
    const cv = $('cv-sovrapposto');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!stato.scena) return;
    const f = formato();
    const attive = stato.attive[stato.scena.id];
    const scala = cv.width / 1920;
    for (const pos of stato.scena.posizioni) {
      const evid = stato.evidenzia === pos.id;
      const vuoto = !stato.sorgente && attive.has(pos.id);
      if (!evid && !vuoto) continue;
      C.tracciaContorno(ctx, f, pos.punti);
      ctx.fillStyle = evid ? 'rgba(47, 85, 228, .28)' : 'rgba(255, 255, 255, .18)';
      ctx.fill();
      ctx.setLineDash([8 * scala, 6 * scala]);
      ctx.lineWidth = 2.5 * scala;
      ctx.strokeStyle = evid ? '#8fa8ff' : '#ffffff';
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function messaggioPalco(html) {
    const el = $('palco-messaggio');
    el.innerHTML = html;
    el.hidden = false;
  }

  function riquadroPosizioni() {
    const attive = stato.attive[stato.scena.id];
    const scelte = stato.scena.posizioni.filter((p) => attive.has(p.id));
    const punti = (scelte.length ? scelte : stato.scena.posizioni).flatMap((p) => p.punti);
    const xs = punti.map((p) => p[0]), ys = punti.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function adattaVista() {
    if (!stato.immagine) return;
    const palco = $('palco'), tela = $('tela');
    const W = stato.immagine.naturalWidth, H = stato.immagine.naturalHeight;
    const pw = palco.clientWidth, ph = palco.clientHeight, m = 28;
    let rx = 0, ry = 0, rw = W, rh = H;
    if (stato.zoom === 'dettaglio' && stato.scena && stato.scena.posizioni.length) {
      const b = riquadroPosizioni();
      const marg = Math.max(b.w, b.h) * 0.18 + 30;
      rx = b.x - marg; ry = b.y - marg; rw = b.w + 2 * marg; rh = b.h + 2 * marg;
    }
    const s = Math.min((pw - 2 * m) / rw, (ph - 2 * m) / rh);
    const tx = (pw - rw * s) / 2 - rx * s, ty = (ph - rh * s) / 2 - ry * s;
    tela.style.width = W + 'px';
    tela.style.height = H + 'px';
    tela.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
  }

  // ---------- uscite e salvataggio ----------
  function aggiornaUscite() {
    if (!stato.scena) return;
    const f = formato();
    const base = nomeBase();
    const w = stato.immagine ? stato.immagine.naturalWidth : 0, h = stato.immagine ? stato.immagine.naturalHeight : 0;
    const vuoto = !nomeBrand();
    $('uscite').innerHTML =
      '<li><code>' + esc(base) + '.png</code><span>produzione ' + f.w + '×' + f.h + '</span></li>' +
      '<li><code>' + esc(base) + '.jpg</code><span>mockup ' + w + '×' + h + '</span></li>';
    $('uscite').style.opacity = vuoto ? '.5' : '1';
    const pronto = !!stato.sorgente;
    $('btn-salva').disabled = !pronto;
    $('btn-png').disabled = !pronto;
    $('btn-jpg').disabled = !pronto;
  }

  function aggiornaCartella() {
    const el = $('cartella');
    if (!A.supportato) {
      el.innerHTML = 'I file verranno scaricati nella cartella <b>Download</b> del browser.';
      return;
    }
    if (cartella.handle) {
      el.innerHTML = 'Salva nella cartella <b>' + esc(cartella.handle.name) + '</b> · <button type="button" class="link" data-azione="scegli">Cambia</button> · <button type="button" class="link" data-azione="download">Usa Download</button>';
    } else {
      el.innerHTML = 'I file andranno nella cartella <b>Download</b> · <button type="button" class="link" data-azione="scegli">Scegli una cartella…</button>';
    }
  }

  async function blobPNG() {
    if (stato.composto && stato.passthrough) return new Blob([stato.sorgente.bytes], { type: 'image/png' });
    calcolaArtwork(false);
    return A.canvasInBlob(stato.artwork, 'image/png');
  }

  async function blobJPG() {
    calcolaArtwork(false);
    const m = C.mockup(stato.immagine, stato.scena, stato.artworkHi, [...stato.attive[stato.scena.id]], { campioni: 4 });
    return A.canvasInBlob(m, 'image/jpeg', 0.95);
  }

  async function salva(quali) {
    if (!stato.sorgente) return avvisa('Carica prima il logo.', 'errore');
    if (!nomeBrand()) {
      $('txt-brand').focus();
      return avvisa('Scrivi il nome del brand: serve per dare il nome ai file.', 'errore');
    }
    if (quali.includes('jpg') && !stato.attive[stato.scena.id].size) {
      return avvisa('Seleziona almeno una posizione per il mockup.', 'errore');
    }
    let inCartella = false;
    if (cartella.handle) {
      try { inCartella = await cartella.permesso(); } catch (e) { inCartella = false; }
      if (!inCartella) avvisa('Accesso alla cartella non concesso: uso i Download.', 'errore');
    }
    caricamento(true);
    try {
      const base = nomeBase();
      const files = [];
      if (quali.includes('png')) files.push({ nome: base + '.png', blob: await blobPNG() });
      if (quali.includes('jpg')) files.push({ nome: base + '.jpg', blob: await blobJPG() });
      const nomi = files.map((f) => f.nome).join(' e ');
      if (inCartella) {
        const esistenti = [];
        for (const f of files) if (await cartella.esiste(f.nome)) esistenti.push(f.nome);
        if (esistenti.length && !window.confirm('Nella cartella «' + cartella.handle.name + '» esiste già ' + esistenti.join(' e ') + '.\nVuoi sostituire?')) return;
        for (const f of files) await cartella.salva(f.nome, f.blob);
        avvisa('Salvati in «' + cartella.handle.name + '»: ' + nomi, 'ok');
      } else {
        await A.scaricaTutti(files);
        avvisa('Scaricati: ' + nomi, 'ok');
      }
    } catch (e) {
      console.error(e);
      avvisa('Salvataggio non riuscito: ' + e.message, 'errore');
    } finally {
      caricamento(false);
    }
  }

  // ---------- eventi ----------
  function collegaEventi() {
    document.querySelectorAll('.schede button').forEach((b) => b.addEventListener('click', () => mostraVista(b.dataset.vista)));
    $('btn-esci').addEventListener('click', () => MK.accesso.esci());

    $('sel-cliente').addEventListener('change', (e) => selezionaCliente(e.target.value));
    $('sel-tipo').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tipo]');
      if (b && !b.disabled) selezionaTipo(b.dataset.tipo);
    });
    $('sel-scena').addEventListener('change', (e) => selezionaScena(e.target.value));

    $('file-logo').addEventListener('change', (e) => { if (e.target.files[0]) caricaLogo(e.target.files[0]); });
    const drop = $('drop');
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('sopra')));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('sopra')));
    window.addEventListener('dragover', (e) => { e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (!f || !$('accesso').hidden) return;
      if (!$('vista-mockup').hidden) caricaLogo(f);
      else if (MK.editor) MK.editor.fileTrascinato(f);
    });
    window.addEventListener('paste', (e) => {
      if ($('vista-mockup').hidden || !$('accesso').hidden || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      const f = e.clipboardData && e.clipboardData.files[0];
      if (f) caricaLogo(f);
    });
    $('btn-cambia-logo').addEventListener('click', togliLogo);
    $('sel-pagina').addEventListener('change', async (e) => {
      caricamento(true);
      try {
        stato.sorgente = await L.cambiaPagina(stato.sorgente, Number(e.target.value));
        elaboraLogo(true);
        aggiornaInfoLogo();
        richiediRender();
      } catch (err) {
        avvisa(err.message, 'errore');
      } finally {
        caricamento(false);
      }
    });
    $('chk-composto').addEventListener('change', (e) => {
      stato.composto = e.target.checked;
      aggiornaInfoLogo();
      richiediRender();
    });

    $('col-sfondo').addEventListener('input', (e) => impostaSfondo(e.target.value));
    $('hex-sfondo').addEventListener('input', (e) => {
      let v = e.target.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) impostaSfondo(v);
    });
    $('hex-sfondo').addEventListener('blur', () => aggiornaControlli());
    $('rng-dim').addEventListener('input', (e) => { stato.p.dimensione = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('rng-x').addEventListener('input', (e) => { stato.p.offX = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('rng-y').addEventListener('input', (e) => { stato.p.offY = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('btn-ricentra').addEventListener('click', () => {
      Object.assign(stato.p, { offX: 0, offY: 0, dimensione: MK.TIPI[stato.tipo].dimensione });
      aggiornaControlli();
      richiediRender();
    });
    $('sel-rimuovi').addEventListener('change', (e) => { stato.rimuovi = e.target.value; elaboraLogo(false); richiediRender(); });
    let timerSfondo = 0;
    const rielaboraPresto = () => {
      clearTimeout(timerSfondo);
      timerSfondo = setTimeout(() => { elaboraLogo(false); richiediRender(); }, 120);
    };
    $('rng-tol').addEventListener('input', (e) => {
      stato.tolleranza = Number(e.target.value);
      $('out-tol').textContent = stato.tolleranza;
      rielaboraPresto();
    });
    // scegliere un colore da togliere attiva la rimozione
    const coloreDaTogliere = (hex) => {
      const rgb = L.daHex(hex);
      if (!rgb || !stato.sorgente) return;
      stato.coloreRimozione = L.inHex(rgb);
      if (stato.rimuovi === 'no') stato.rimuovi = 'ovunque';
      aggiornaControlli();
      rielaboraPresto();
    };
    $('col-rimozione').addEventListener('input', (e) => coloreDaTogliere(e.target.value));
    $('hex-rimozione').addEventListener('input', (e) => {
      let v = e.target.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) coloreDaTogliere(v);
    });
    $('hex-rimozione').addEventListener('blur', () => aggiornaControlli());
    $('btn-contagocce').addEventListener('click', async () => {
      try {
        const scelta = await new window.EyeDropper().open();
        coloreDaTogliere(scelta.sRGBHex);
      } catch (err) { /* prelievo annullato */ }
    });

    $('txt-brand').addEventListener('input', (e) => { stato.brand = e.target.value; stato.brandAutomatico = false; aggiornaUscite(); });
    $('txt-brand').addEventListener('keydown', (e) => { if (e.key === 'Enter') salva(['png', 'jpg']); });
    $('btn-salva').addEventListener('click', () => salva(['png', 'jpg']));
    $('btn-png').addEventListener('click', () => salva(['png']));
    $('btn-jpg').addEventListener('click', () => salva(['jpg']));
    $('cartella').addEventListener('click', async (e) => {
      const azione = e.target.dataset && e.target.dataset.azione;
      if (azione === 'scegli') {
        try { await cartella.scegli(); } catch (err) { if (err.name !== 'AbortError') avvisa(err.message, 'errore'); }
      } else if (azione === 'download') {
        cartella.handle = null;
        await A.scrivi(cartella.chiave, null);
      }
      aggiornaCartella();
    });

    document.querySelectorAll('#sel-zoom button').forEach((b) => b.addEventListener('click', () => {
      stato.zoom = b.dataset.zoom;
      segna('#sel-zoom', 'zoom', stato.zoom);
      adattaVista();
    }));
    const orig = $('btn-originale');
    const mostra = (si) => { $('cv-mockup').style.visibility = si ? 'hidden' : ''; orig.classList.toggle('premuto', si); };
    orig.addEventListener('pointerdown', () => mostra(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => orig.addEventListener(t, () => mostra(false)));
    window.addEventListener('resize', adattaVista);
  }

  function mostraVista(nome) {
    document.querySelectorAll('.schede button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === nome)));
    $('vista-mockup').hidden = nome !== 'mockup';
    $('vista-template').hidden = nome !== 'template';
    if (nome === 'mockup') { adattaVista(); }
    if (nome === 'template' && MK.editor) MK.editor.attiva();
  }

  // Chiamata dall'editor quando un template viene salvato o modificato.
  async function templateAggiornato(id) {
    riempiClienti();
    if (stato.template && stato.template.id === id) {
      stato.template = MK.template.registrati[id];
      const scena = stato.scena && stato.template.scene.find((s) => s.id === stato.scena.id);
      if (scena) {
        stato.scena = scena;
        stato.attive[scena.id] = new Set([...(stato.attive[scena.id] || [])].filter((pid) => scena.posizioni.some((p) => p.id === pid)));
      }
      await selezionaCliente(id);
    }
  }

  MK.app = { riempiTipi, stato, avvisa, esc, ricorda, ricordato, templateAggiornato, mostraVista, caricaLogo, salva, render, blobPNG, blobJPG };
  document.addEventListener('DOMContentLoaded', avvia);
})(window.MK = window.MK || {});
