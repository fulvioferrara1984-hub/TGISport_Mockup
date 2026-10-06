/* Mockup Studio — schermata "Crea mockup". */
(function (MK) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const L = MK.loghi, C = MK.composizione, A = MK.archivio, R = MK.render;

  // Tutto ciò che riguarda un logo: file letto, composizione e nome del brand. Con "Two brands" i loghi sono due.
  function nuovoLogo() {
    return {
      sorgente: null,        // file del logo letto
      rifilatoGrezzo: null,  // logo rifilato, senza rimozione dello sfondo
      logo: null,            // { canvas, raggio } pronto per la composizione
      colori: [],
      uniforme: null,        // colore dello sfondo pieno trovato nel file, se c'è
      rilevato: false,       // il file sembra già composto
      fonteComposto: null,
      passthrough: false,    // il PNG del cliente si può salvare identico
      composto: false,
      p: { sfondo: '#ffffff', coloreLogo: null, dimensione: MK.TIPI.CC.dimensione, offX: 0, offY: 0 },
      coloreScelto: false,
      ultimoColoreLogo: '#ffffff',
      logoPieno: false,      // il logo elaborato ha ancora un fondo pieno (angoli opachi)
      rimuovi: 'no',
      coloreRimozione: '#ffffff',
      tolleranza: 40,
      brand: '',
      brandAutomatico: false,
      esporta: true,         // con due brand: il suo PNG di produzione va salvato
      tinta: { sorgente: null, colore: null, canvas: null },  // logo ricolorato, memorizzato finché non cambia
      artwork: null,
      artworkHi: null,
    };
  }

  const stato = {
    template: null,
    tipo: 'CC',
    scena: null,
    immagine: null,
    loghi: [nuovoLogo(), nuovoLogo()],
    attivo: 0,             // indice del logo che si sta modificando (schede Logo 1 / Logo 2)
    piuBrand: false,       // scelta "Two brands" (vale solo per le tipologie che lo prevedono)
    attive: {},            // id scena -> Set(id posizioni), con un solo brand
    assegnate: {},         // id scena -> Map(id posizione -> indice del logo), con due brand
    variante: {},          // id scena -> id della competizione scelta
    grafiche: {},          // id competizione -> canvas della grafica (scena corrente)
    zoom: 'intera',
    evidenzia: null,
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

  // "a", "a and b", "a, b and c"
  function elenca(voci) {
    return voci.length < 3 ? voci.join(' and ') : voci.slice(0, -1).join(', ') + ' and ' + voci[voci.length - 1];
  }

  function formato() { return C.formatoScena(stato.scena); }

  // ---------- uno o due brand ----------
  function attivo() { return stato.loghi[stato.attivo]; }

  // Due brand: solo per le tipologie che lo prevedono (es. i tappeti) e con almeno due posizioni per il logo.
  function dueBrandPossibile() {
    return !!(stato.scena && formato().piuBrand && stato.scena.posizioni.filter((p) => !p.fissa).length >= 2);
  }
  function dueBrand() { return stato.piuBrand && dueBrandPossibile(); }

  // Con due brand: logo di ogni posizione (all'inizio alternati nell'ordine delle posizioni: 1, 2, 1…).
  function assegnazioni() {
    const id = stato.scena.id;
    if (!stato.assegnate[id]) stato.assegnate[id] = new Map(stato.scena.posizioni.filter((p) => !p.fissa).map((p, i) => [p.id, i % 2]));
    return stato.assegnate[id];
  }

  // Posizioni che ricevono un logo nel mockup.
  function posizioniScelte() {
    return dueBrand() ? [...assegnazioni().keys()] : [...stato.attive[stato.scena.id]];
  }

  // Logo che va in una posizione (null se nessuno).
  function logoDi(pos) {
    if (!dueBrand()) return stato.loghi[0];
    const i = assegnazioni().get(pos.id);
    return i == null ? null : stato.loghi[i];
  }

  // Indici dei loghi presenti nel mockup: con due brand, quelli assegnati ad almeno una posizione.
  function loghiNelMockup() {
    return dueBrand() ? [...new Set(assegnazioni().values())].sort((a, b) => a - b) : [0];
  }

  // Loghi da comporre: il primo, oppure tutti e due.
  function loghiInUso() { return dueBrand() ? stato.loghi : [stato.loghi[0]]; }

  function campoBrand(i) { return $(i ? 'txt-brand-2' : 'txt-brand'); }

  // ---------- nomi dei file ----------
  function nomeBrand(i) {
    return stato.loghi[i].brand.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
  }
  // Nome del brand nei file (segnaposto finché non è scritto).
  function nomeNeiFile(i) {
    return nomeBrand(i) || (dueBrand() ? 'Brand' + (i + 1) : 'Brand');
  }
  function etichettaLogo(i) { return nomeBrand(i) || 'Logo ' + (i + 1); }
  // PNG di produzione: uno per brand (Brand_<sigla>.png).
  function nomeBase(i) {
    return nomeNeiFile(i) + '_' + formato().sigla;
  }
  // Il mockup cambia con la competizione, il PNG di produzione no: la competizione va solo nel nome del JPG.
  // Con due brand il JPG porta i nomi di quelli presenti nel mockup (es. Adidas_Nike_MATS_Domestic.jpg).
  function nomeJpg() {
    const v = varianteScelta();
    const indici = loghiNelMockup().length ? loghiNelMockup() : [0];
    return indici.map((i) => nomeNeiFile(i)).join('_') + '_' + formato().sigla +
      (v ? '_' + v.nome.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_') : '');
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
      messaggioPalco('No templates found.<br>Check that the <b>templates</b> folder is next to this page.');
      return;
    }
    const ultimo = ricordato('cliente');
    const tipo = ricordato('tipo');
    if (tipo && MK.TIPI[tipo]) {
      stato.tipo = tipo;
      for (const l of stato.loghi) l.p.dimensione = MK.TIPI[tipo].dimensione;
      aggiornaControlli();
    }
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
        b.title = b.disabled ? 'This client has no image of this type: add one in the Templates tab' : '';
      });
      $('nota-tipi').hidden = tipi.length >= Object.keys(MK.TIPI).length;
      if (!tipi.length) {
        messaggioPalco('This template has no images.');
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
      for (const l of stato.loghi) {
        l.p.dimensione = MK.TIPI[tipo].dimensione;
        l.p.offX = l.p.offY = 0;
      }
      aggiornaControlli();
    }
    if (scene.length && (cambiato || forza || !stato.scena || stato.scena.tipo !== tipo)) await selezionaScena(scene[0].id);
  }

  async function selezionaScena(id) {
    const scena = stato.template.scene.find((s) => s.id === id);
    if (!scena) return;
    stato.scena = scena;
    $('sel-scena').value = id;
    if (!stato.attive[scena.id]) stato.attive[scena.id] = new Set(scena.posizioni.filter((p) => !p.fissa).map((p) => p.id));
    const varianti = scena.varianti || [];
    if (varianti.length && !varianti.some((v) => v.id === stato.variante[scena.id])) stato.variante[scena.id] = varianti[0].id;
    aggiornaBrand();
    riempiPosizioni();
    caricamento(true);
    try {
      stato.immagine = await MK.template.immagineScena(scena);
      stato.grafiche = {};
      for (const v of varianti) stato.grafiche[v.id] = R.copia(await MK.template.immagineScena({ immagine: v.artwork }));
    } finally {
      caricamento(false);
    }
    preparaTela();
    for (const l of stato.loghi) if (l.sorgente) valutaComposto(l);
    aggiornaMiniatura();
    aggiornaInfoLogo();
    aggiornaUscite();
    richiediRender();
  }

  // Scelta "One brand / Two brands", schede dei loghi e testi che dipendono dal logo attivo.
  function aggiornaBrand() {
    const due = dueBrand();
    if (!due) stato.attivo = 0;
    $('blocco-brand').hidden = !dueBrandPossibile();
    segna('#sel-brand', 'brand', due ? 'due' : 'uno');
    $('sel-logo').hidden = !due;
    segna('#sel-logo', 'logo', String(stato.attivo));
    document.querySelectorAll('#sel-logo button').forEach((b) => {
      const i = Number(b.dataset.logo), l = stato.loghi[i];
      b.querySelector('small').textContent = l.sorgente ? nomeBrand(i) || l.sorgente.nome : 'No file yet';
    });
    $('comp-logo').textContent = due ? '· ' + etichettaLogo(stato.attivo) : '';
    $('etichetta-brand').textContent = due ? 'Logo 1 brand name' : 'Brand name';
    $('campo-brand-2').hidden = !due;
  }

  // Dopo il cambio fra uno e due brand o del logo da modificare.
  function cambioLogo() {
    $('errore-logo').hidden = true;
    aggiornaBrand();
    aggiornaMiniatura();
    aggiornaInfoLogo();
    riempiPosizioni();
    aggiornaUscite();
    if (stato.zoom === 'dettaglio') adattaVista();
    richiediRender();
  }

  // Il nome del brand compare nelle schede, nella scelta delle posizioni e nei nomi dei file.
  function nomeCambiato() {
    aggiornaBrand();
    aggiornaEtichetteLoghi();
    aggiornaUscite();
    if (stato.scena) disegnaArtwork();
  }

  function aggiornaEtichetteLoghi() {
    document.querySelectorAll('#lista-posizioni .ruolo button[data-logo]').forEach((b) => {
      if (b.dataset.logo !== '') b.textContent = b.title = etichettaLogo(Number(b.dataset.logo));
    });
  }

  function riempiPosizioni() {
    const lista = $('lista-posizioni');
    lista.innerHTML = '';
    const scegliere = stato.scena.posizioni.filter((p) => !p.fissa);
    const due = dueBrand();
    for (const pos of scegliere) {
      const el = due ? rigaAssegna(pos) : rigaPosizione(pos);
      el.addEventListener('mouseenter', () => { stato.evidenzia = pos.id; disegnaSovrapposto(); });
      el.addEventListener('mouseleave', () => { stato.evidenzia = null; disegnaSovrapposto(); });
      lista.appendChild(el);
    }
    riempiCompetizioni();
    const conVarianti = !!(stato.scena.varianti && stato.scena.varianti.length);
    $('etichetta-posizioni').textContent = due ? 'Logo on each position' : 'Logo positions';
    $('etichetta-posizioni').hidden = !conVarianti && !due;
    $('campo-posizioni').hidden = scegliere.length < 2;
    $('passo-posizioni').hidden = scegliere.length < 2 && !conVarianti;
  }

  // Un solo brand: la spunta decide se la posizione riceve il logo.
  function rigaPosizione(pos) {
    const attive = stato.attive[stato.scena.id];
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
      posizioniCambiate();
    });
    return el;
  }

  // Due brand: per ogni posizione si sceglie il logo, oppure nessuno.
  function rigaAssegna(pos) {
    const a = assegnazioni();
    const el = document.createElement('div');
    el.className = 'posizione assegna' + (a.has(pos.id) ? ' attiva' : '');
    const nome = document.createElement('span');
    nome.textContent = pos.nome;
    const scelta = document.createElement('div');
    scelta.className = 'ruolo';
    scelta.setAttribute('role', 'radiogroup');
    scelta.setAttribute('aria-label', 'Logo on ' + pos.nome);
    const attuale = a.has(pos.id) ? String(a.get(pos.id)) : '';
    for (const [valore, testo] of [['0', etichettaLogo(0)], ['1', etichettaLogo(1)], ['', 'None']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.logo = valore;
      b.textContent = b.title = testo;
      b.setAttribute('aria-checked', String(valore === attuale));
      scelta.appendChild(b);
    }
    scelta.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-logo]');
      if (!b) return;
      if (b.dataset.logo === '') a.delete(pos.id); else a.set(pos.id, Number(b.dataset.logo));
      scelta.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      el.classList.toggle('attiva', a.has(pos.id));
      posizioniCambiate();
    });
    el.append(nome, scelta);
    return el;
  }

  function posizioniCambiate() {
    aggiornaUscite();
    if (stato.zoom === 'dettaglio') adattaVista();
    richiediRender();
  }

  // Competizioni (es. Domestico / Internazionale): decidono la grafica delle posizioni fisse.
  function riempiCompetizioni() {
    const varianti = stato.scena.varianti || [];
    const box = $('sel-variante');
    $('blocco-competizione').hidden = !varianti.length;
    box.innerHTML = '';
    for (const v of varianti) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.variante = v.id;
      b.setAttribute('aria-checked', String(v.id === stato.variante[stato.scena.id]));
      const nome = document.createElement('b');
      nome.textContent = v.nome;
      const img = document.createElement('img');
      img.src = v.artwork;
      img.alt = '';
      b.append(nome, img);
      b.addEventListener('mouseenter', () => { stato.evidenzia = '__fisse'; disegnaSovrapposto(); });
      b.addEventListener('mouseleave', () => { stato.evidenzia = null; disegnaSovrapposto(); });
      box.appendChild(b);
    }
  }

  function varianteScelta() {
    const varianti = (stato.scena && stato.scena.varianti) || [];
    return varianti.find((v) => v.id === stato.variante[stato.scena.id]) || null;
  }

  function opzioniMockup(campioni) {
    const v = varianteScelta();
    return { campioni, grafica: v ? stato.grafiche[v.id] : null };
  }

  // ---------- logo ----------
  // Il file va nel logo attivo in quel momento, anche se intanto si cambia scheda.
  async function caricaLogo(file) {
    const i = stato.attivo, l = attivo();
    $('errore-logo').hidden = true;
    caricamento(true);
    try {
      const s = await L.carica(file);
      l.sorgente = s;
      l.coloreScelto = false;
      // il nome brand viene proposto dal nome del file, ma non sovrascrive quello scritto a mano
      const campo = campoBrand(i);
      if (!campo.value.trim() || l.brandAutomatico) {
        campo.value = suggerisciBrand(file.name);
        l.brand = campo.value;
        l.brandAutomatico = true;
      }
      elaboraLogo(l, true);
      nomeCambiato();
      aggiornaInfoLogo();
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

  function elaboraLogo(l, nuovo) {
    const s = l.sorgente;
    if (!s) return;
    const grezzo = s.canvas;
    if (nuovo) {
      l.uniforme = L.sfondoUniforme(grezzo);
      l.coloreRimozione = L.inHex(l.uniforme || L.coloreBordo(grezzo) || [255, 255, 255]);
      // si toglie da solo solo il fondo bianco: un riquadro colorato di solito fa parte del logo
      l.rimuovi = L.quasiBianco(l.uniforme) ? 'ovunque' : 'no';
      l.rifilatoGrezzo = L.rifila(grezzo);
      aggiornaMiniatura();
    }
    const lavoro = l.rimuovi !== 'no'
      ? L.rimuoviSfondo(grezzo, L.daHex(l.coloreRimozione), l.rimuovi, l.tolleranza)
      : grezzo;
    const canvas = L.rifila(lavoro);
    l.logo = { canvas, raggio: L.raggioVisibile(canvas) };
    l.logoPieno = angoliOpachi(canvas);
    const an = L.analizzaColori(canvas);
    l.colori = an.colori;
    if (nuovo) {
      valutaComposto(l);
      if (!l.coloreScelto) l.p.sfondo = an.luminanza > 190 ? '#000000' : '#ffffff';
      l.p.dimensione = MK.TIPI[stato.tipo].dimensione;
      l.p.offX = l.p.offY = 0;
      l.p.coloreLogo = null;
    }
    aggiornaControlli();
  }

  function angoliOpachi(c) {
    const x = R.contesto(c);
    return [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]]
      .every(([px, py]) => x.getImageData(px, py, 1, 1).data[3] > 250);
  }

  // Logo in tinta unica (se richiesto): stessa forma e trasparenza, colore sostituito. Memorizzato finché non cambia.
  function logoPerComposizione(l) {
    if (!l.p.coloreLogo || !l.logo) return l.logo;
    if (l.tinta.sorgente !== l.logo.canvas || l.tinta.colore !== l.p.coloreLogo) {
      const c = R.copia(l.logo.canvas);
      const x = R.contesto(c);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = l.p.coloreLogo;
      x.fillRect(0, 0, c.width, c.height);
      l.tinta = { sorgente: l.logo.canvas, colore: l.p.coloreLogo, canvas: c };
    }
    return { canvas: l.tinta.canvas, raggio: l.logo.raggio };
  }

  function valutaComposto(l) {
    const s = l.sorgente;
    if (!s || !stato.scena) return;
    const f = formato();
    const grezzo = s.canvas;
    const esatto = grezzo.width === f.w && grezzo.height === f.h;
    let fonte = null;
    if (L.rilevaComposto(grezzo, f)) fonte = grezzo;
    else if (l.rifilatoGrezzo && L.rilevaComposto(l.rifilatoGrezzo, f)) fonte = esatto ? grezzo : l.rifilatoGrezzo;
    l.rilevato = !!fonte;
    l.fonteComposto = fonte;
    l.composto = !!fonte;
    l.passthrough = !!fonte && fonte === grezzo && esatto && s.ext === 'png' && s.larghezza === f.w && s.altezza === f.h;
  }

  function aggiornaInfoLogo() {
    const l = attivo();
    const s = l.sorgente;
    $('drop').hidden = !!s;
    $('file-info').hidden = !s;
    if (!s) { aggiornaControlli(); return; }
    $('file-nome').textContent = s.nome;
    const tipoFile = s.vettoriale ? 'vector' : 'image';
    $('file-meta').textContent = s.vettoriale
      ? tipoFile + ' · converted to ' + l.rifilatoGrezzo.width + ' × ' + l.rifilatoGrezzo.height + ' px'
      : tipoFile + ' · ' + s.larghezza + ' × ' + s.altezza + ' px';
    const campoPag = $('campo-pagina');
    campoPag.hidden = !(s.pagine > 1);
    if (s.pagine > 1) {
      const sel = $('sel-pagina');
      if (sel.options.length !== s.pagine) {
        sel.innerHTML = '';
        for (let i = 1; i <= s.pagine; i++) {
          const o = document.createElement('option');
          o.value = i; o.textContent = 'Artboard ' + i + ' of ' + s.pagine;
          sel.appendChild(o);
        }
      }
      sel.value = s.pagina;
    }
    const f = formato();
    const forma = f.forma === 'cerchio' ? f.w + ' px circle' : f.w + '×' + f.h + ' rectangle';
    const box = $('rilevato');
    if (l.rilevato) {
      box.className = 'rilevato si';
      box.textContent = l.passthrough
        ? 'Ready-made file (' + forma + '): the production PNG will be the original file, unchanged.'
        : 'Recognised as already composed (' + forma + '): it will be used as it is, resized to ' + f.w + '×' + f.h + ' px.';
    } else if (l.composto) {
      box.className = 'rilevato attenzione';
      box.textContent = 'The file does not look like a ready-made ' + forma + ': used as it is, it will be resized (and distorted if the proportions differ).';
    } else {
      box.className = 'rilevato no';
      box.textContent = f.forma === 'cerchio'
        ? 'Logo to compose: it will be inscribed in the ' + f.w + ' px circle on the chosen background.'
        : 'Logo to compose: it will be placed in the ' + f.w + '×' + f.h + ' rectangle on the chosen background.';
    }
    $('chk-composto').checked = l.composto;
    aggiornaControlli();
  }

  // Anteprima del file così com'è arrivato: utile per vedere lo sfondo e prelevarne il colore.
  function aggiornaMiniatura() {
    const img = $('file-miniatura');
    const s = attivo().sorgente;
    const c = s && s.canvas;
    if (!c) { img.removeAttribute('src'); return; }
    const k = Math.min(1, 560 / c.width, 180 / c.height);
    img.src = (k < 1 ? R.ridimensiona(c, c.width * k, c.height * k) : c).toDataURL('image/png');
  }

  function togliLogo() {
    Object.assign(attivo(), { sorgente: null, logo: null, rifilatoGrezzo: null, uniforme: null, rilevato: false, fonteComposto: null, passthrough: false, composto: false, colori: [], coloreScelto: false, rimuovi: 'no' });
    aggiornaMiniatura();
    $('errore-logo').hidden = true;
    aggiornaBrand();
    aggiornaInfoLogo();
    aggiornaUscite();
    richiediRender();
  }

  // ---------- controlli di composizione (del logo attivo) ----------
  function aggiornaControlli() {
    const l = attivo();
    const p = l.p;
    $('rng-dim').value = Math.round(p.dimensione * 100);
    $('out-dim').textContent = Math.round(p.dimensione * 100) + '%';
    $('rng-x').value = p.offX * 100;
    $('out-x').textContent = fmt(p.offX * 100);
    $('rng-y').value = p.offY * 100;
    $('out-y').textContent = fmt(p.offY * 100);
    if (p.sfondo) $('col-sfondo').value = p.sfondo;
    if (document.activeElement !== $('hex-sfondo')) $('hex-sfondo').value = p.sfondo ? p.sfondo.toUpperCase() : '';
    $('nota-trasparente').hidden = !!p.sfondo;
    const inTinta = !!p.coloreLogo;
    $('blocco-colore-logo').hidden = !(l.sorgente && !l.composto);
    segna('#sel-colore-logo', 'coloreLogo', inTinta ? 'tinta' : 'originale');
    $('campo-colore-logo').hidden = !inTinta;
    $('col-logo').value = p.coloreLogo || l.ultimoColoreLogo;
    if (document.activeElement !== $('hex-logo')) $('hex-logo').value = (p.coloreLogo || l.ultimoColoreLogo).toUpperCase();
    $('nota-colore-logo').textContent = inTinta && l.logoPieno
      ? 'The logo still has its background: remove it above, otherwise it turns into a solid block of colour.'
      : '';
    $('rng-tol').value = l.tolleranza;
    $('out-tol').textContent = l.tolleranza;
    $('sel-rimuovi').value = l.rimuovi;
    $('blocco-sfondo-logo').hidden = !(l.sorgente && !l.composto);
    const togli = l.rimuovi !== 'no';
    $('campo-colore-rimozione').hidden = !togli;
    $('campo-tolleranza').hidden = !togli;
    $('col-rimozione').value = l.coloreRimozione;
    if (document.activeElement !== $('hex-rimozione')) $('hex-rimozione').value = l.coloreRimozione.toUpperCase();
    $('btn-contagocce').hidden = !('EyeDropper' in window);
    $('nota-sfondo').textContent = !l.sorgente ? ''
      : L.quasiBianco(l.uniforme) ? 'The file has a white background: it is removed automatically.'
      : l.uniforme ? 'The file has a solid coloured background: if it is not part of the logo, choose to remove it.'
      : togli ? '' : 'If the logo has a box or background to get rid of, choose to remove its colour.';
    $('passo-composizione').classList.toggle('disattivo', !!(l.sorgente && l.composto));
    riempiCampioni();
    riempiCampioniLogo();
  }

  function fmt(v) {
    const r = Math.round(v * 10) / 10;
    return (r > 0 ? '+' : '') + String(r) + '%';
  }

  function riempiCampioni() {
    const l = attivo();
    const box = $('campioni');
    const visti = new Set();
    const lista = [];
    for (const c of l.colori.concat(['#ffffff', '#000000'])) {
      const k = c.toLowerCase();
      if (!visti.has(k)) { visti.add(k); lista.push(k); }
    }
    box.innerHTML = '';
    const trasparente = document.createElement('button');
    trasparente.type = 'button';
    trasparente.className = 'campione trasparente';
    trasparente.title = 'No background (transparent)';
    trasparente.setAttribute('aria-label', 'No background, transparent');
    trasparente.setAttribute('aria-pressed', String(!l.p.sfondo));
    trasparente.addEventListener('click', () => impostaSfondo(null));
    box.appendChild(trasparente);
    lista.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'campione';
      b.style.background = c;
      b.title = c.toUpperCase() + (i < l.colori.length ? ' (from the logo)' : '');
      b.setAttribute('aria-label', 'Background ' + c.toUpperCase());
      b.setAttribute('aria-pressed', String(c === (l.p.sfondo || '').toLowerCase()));
      b.addEventListener('click', () => impostaSfondo(c));
      box.appendChild(b);
    });
    const e = document.createElement('span');
    e.className = 'campioni-etichetta';
    e.textContent = l.colori.length ? 'Transparent, colours from the logo, white and black' : 'Transparent, white and black';
    box.appendChild(e);
  }

  function riempiCampioniLogo() {
    const l = attivo();
    const box = $('campioni-logo');
    const visti = new Set();
    box.innerHTML = '';
    for (const c of ['#ffffff', '#000000'].concat(l.colori)) {
      const k = c.toLowerCase();
      if (visti.has(k)) continue;
      visti.add(k);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'campione';
      b.style.background = k;
      b.title = k.toUpperCase();
      b.setAttribute('aria-label', 'Logo colour ' + k.toUpperCase());
      b.setAttribute('aria-pressed', String(k === (l.p.coloreLogo || '').toLowerCase()));
      b.addEventListener('click', () => impostaColoreLogo(k));
      box.appendChild(b);
    }
  }

  function impostaColoreLogo(hex) {
    const l = attivo();
    if (hex === null) {
      l.p.coloreLogo = null;
    } else {
      const rgb = L.daHex(hex);
      if (!rgb) return;
      l.p.coloreLogo = l.ultimoColoreLogo = L.inHex(rgb);
    }
    aggiornaControlli();
    richiediRender();
  }

  function impostaSfondo(hex) {
    const l = attivo();
    if (hex === null) {
      l.p.sfondo = null;
    } else {
      const rgb = L.daHex(hex);
      if (!rgb) return;
      l.p.sfondo = L.inHex(rgb);
    }
    l.coloreScelto = true;
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

  function calcolaArtwork(l, bozza) {
    const f = formato();
    if (!l.sorgente) { l.artwork = l.artworkHi = null; return; }
    if (l.composto) {
      const fonte = l.fonteComposto || l.sorgente.canvas;
      l.artwork = C.adattaComposto(f, fonte, 1);
      const k = Math.max(1, Math.min(3, fonte.width / f.w));
      l.artworkHi = k > 1.05 ? C.adattaComposto(f, fonte, k) : l.artwork;
    } else {
      const logo = logoPerComposizione(l);
      l.artwork = C.componi(f, logo, l.p, 1);
      l.artworkHi = C.componi(f, logo, l.p, bozza ? 2 : 3);
    }
  }

  // Mockup con i loghi nelle posizioni scelte: con due brand ogni posizione riceve l'artwork del suo logo.
  function mockupCompleto(campioni) {
    const artwork = dueBrand() ? (pos) => { const l = logoDi(pos); return l && l.artworkHi; } : stato.loghi[0].artworkHi;
    return C.mockup(stato.immagine, stato.scena, artwork, posizioniScelte(), opzioniMockup(campioni));
  }

  function render(bozza) {
    if (!stato.immagine || !stato.scena) return;
    const usati = loghiInUso();
    for (const l of usati) calcolaArtwork(l, bozza);
    disegnaArtwork();
    const cv = $('cv-mockup');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (usati.some((l) => l.artworkHi) || varianteScelta()) ctx.drawImage(mockupCompleto(bozza ? 2 : 4), 0, 0);
    disegnaSovrapposto();
  }

  // PNG di produzione del logo attivo (con due brand, il suo nome sopra le misure).
  function disegnaArtwork() {
    const cv = $('cv-artwork');
    const f = formato();
    const l = attivo();
    const a = l.artwork;
    cv.width = f.w; cv.height = f.h;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, f.w, f.h);
    if (a) ctx.drawImage(a, 0, 0, f.w, f.h);
    cv.style.opacity = a ? '1' : '.35';
    const info = f.w + ' × ' + f.h + ' px' + (f.forma === 'cerchio' ? '<br>circle, transparent outside' : '');
    $('misura-png').innerHTML = (dueBrand() ? esc(etichettaLogo(stato.attivo)) + '<br>' : '') + info + (l.passthrough && l.composto ? '<br>original client file' : '');
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

  // Posizione evidenziata (passandoci sopra col mouse) e posizioni scelte il cui logo non è ancora caricato.
  function disegnaSovrapposto() {
    const cv = $('cv-sovrapposto');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!stato.scena) return;
    const f = formato();
    const scelte = posizioniScelte();
    const scala = cv.width / 1920;
    for (const pos of stato.scena.posizioni) {
      const evid = stato.evidenzia === pos.id || (stato.evidenzia === '__fisse' && pos.fissa);
      const l = pos.fissa ? null : logoDi(pos);
      const vuoto = !pos.fissa && scelte.includes(pos.id) && !(l && l.sorgente);
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
    const ids = posizioniScelte();
    const scelte = stato.scena.posizioni.filter((p) => ids.includes(p.id));
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
  // Con due brand c'è un PNG di produzione per logo, ognuno con la sua spunta per salvarlo o no.
  function aggiornaUscite() {
    if (!stato.scena) return;
    const f = formato();
    const w = stato.immagine ? stato.immagine.naturalWidth : 0, h = stato.immagine ? stato.immagine.naturalHeight : 0;
    const due = dueBrand();
    let righe = '';
    if (due) {
      stato.loghi.forEach((l, i) => {
        const si = !!l.sorgente && l.esporta;
        righe += '<li' + (si ? '' : ' class="spento"') + '><label><input type="checkbox" data-logo="' + i + '"' + (si ? ' checked' : '') + (l.sorgente ? '' : ' disabled') + '>' +
          '<code>' + esc(nomeBase(i)) + '.png</code></label><span>' + (l.sorgente ? 'production ' + f.w + '×' + f.h : 'logo ' + (i + 1) + ' not loaded') + '</span></li>';
      });
    } else {
      righe += '<li><code>' + esc(nomeBase(0)) + '.png</code><span>production ' + f.w + '×' + f.h + '</span></li>';
    }
    righe += '<li><code>' + esc(nomeJpg()) + '.jpg</code><span>mockup ' + w + '×' + h + '</span></li>';
    $('uscite').innerHTML = righe;
    const coinvolti = due ? [...new Set([0, 1].filter((i) => stato.loghi[i].sorgente).concat(loghiNelMockup()))] : [0];
    $('uscite').style.opacity = coinvolti.some((i) => !nomeBrand(i)) ? '.5' : '1';
    const pronto = loghiInUso().some((l) => l.sorgente);
    $('btn-salva').disabled = !pronto;
    $('btn-png').disabled = !pronto;
    $('btn-jpg').disabled = !pronto;
  }

  function aggiornaCartella() {
    const el = $('cartella');
    if (!A.supportato) {
      el.innerHTML = 'Files will be downloaded to the <b>Downloads</b> folder.';
      return;
    }
    if (cartella.handle) {
      el.innerHTML = 'Saving to the <b>' + esc(cartella.handle.name) + '</b> folder · <button type="button" class="link" data-azione="scegli">Change</button> · <button type="button" class="link" data-azione="download">Use Downloads</button>';
    } else {
      el.innerHTML = 'Files will go to the <b>Downloads</b> folder · <button type="button" class="link" data-azione="scegli">Choose a folder…</button>';
    }
  }

  async function blobPNG(i = 0) {
    const l = stato.loghi[i];
    if (l.composto && l.passthrough) return new Blob([l.sorgente.bytes], { type: 'image/png' });
    calcolaArtwork(l, false);
    return A.canvasInBlob(l.artwork, 'image/png');
  }

  async function blobJPG() {
    for (const l of loghiInUso()) calcolaArtwork(l, false);
    return A.canvasInBlob(mockupCompleto(4), 'image/jpeg', 0.95);
  }

  // Che cosa si può salvare: { png: indici dei loghi dei PNG di produzione } oppure { errore, campo da evidenziare }.
  function controllaSalvataggio(conPng, conJpg) {
    if (!dueBrand()) {
      if (!stato.loghi[0].sorgente) return { errore: 'Load a logo first.' };
      if (!nomeBrand(0)) return { errore: 'Enter the brand name: it is used to name the files.', campo: campoBrand(0) };
      if (conJpg && !stato.attive[stato.scena.id].size) return { errore: 'Select at least one position for the mockup.' };
      return { png: conPng ? [0] : [] };
    }
    if (!stato.loghi.some((l) => l.sorgente)) return { errore: 'Load a logo first.' };
    // "Save PNG + JPG" con nessun PNG spuntato salva solo il JPG
    const png = conPng ? [0, 1].filter((i) => stato.loghi[i].sorgente && stato.loghi[i].esporta) : [];
    if (conPng && !conJpg && !png.length) return { errore: 'Tick at least one production file to save.' };
    const nelMockup = conJpg ? loghiNelMockup() : [];
    if (conJpg && !nelMockup.length) return { errore: 'Choose a logo for at least one position.' };
    const senzaFile = nelMockup.find((i) => !stato.loghi[i].sorgente);
    if (senzaFile != null) return { errore: 'Logo ' + (senzaFile + 1) + ' has no file yet: load it, or set its positions to None.' };
    const senzaNome = [0, 1].find((i) => (png.includes(i) || nelMockup.includes(i)) && !nomeBrand(i));
    if (senzaNome != null) return { errore: 'Enter the brand name of logo ' + (senzaNome + 1) + ': it is used to name the files.', campo: campoBrand(senzaNome) };
    if (png.length === 2 && nomeBase(0).toLowerCase() === nomeBase(1).toLowerCase()) {
      return { errore: 'The two brands have the same name: their production files would overwrite each other.' };
    }
    return { png };
  }

  async function salva(quali) {
    const conPng = quali.includes('png'), conJpg = quali.includes('jpg');
    const esito = controllaSalvataggio(conPng, conJpg);
    if (esito.errore) {
      if (esito.campo) esito.campo.focus();
      return avvisa(esito.errore, 'errore');
    }
    const png = esito.png;
    let inCartella = false;
    if (cartella.handle) {
      try { inCartella = await cartella.permesso(); } catch (e) { inCartella = false; }
      if (!inCartella) avvisa('Folder access not granted: saving to Downloads instead.', 'errore');
    }
    caricamento(true);
    try {
      const files = [];
      for (const i of png) files.push({ nome: nomeBase(i) + '.png', blob: await blobPNG(i) });
      if (conJpg) files.push({ nome: nomeJpg() + '.jpg', blob: await blobJPG() });
      const nomi = elenca(files.map((f) => f.nome));
      if (inCartella) {
        const esistenti = [];
        for (const f of files) if (await cartella.esiste(f.nome)) esistenti.push(f.nome);
        if (esistenti.length && !window.confirm('The folder “' + cartella.handle.name + '” already contains ' + elenca(esistenti) + '.\nOverwrite?')) return;
        for (const f of files) await cartella.salva(f.nome, f.blob);
        avvisa('Saved to “' + cartella.handle.name + '”: ' + nomi, 'ok');
      } else {
        await A.scaricaTutti(files);
        avvisa('Downloaded: ' + nomi, 'ok');
      }
    } catch (e) {
      console.error(e);
      avvisa('Save failed: ' + e.message, 'errore');
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

    $('sel-brand').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-brand]');
      if (!b || (b.dataset.brand === 'due') === stato.piuBrand) return;
      stato.piuBrand = b.dataset.brand === 'due';
      // passando a due brand si apre subito il secondo logo, se il primo è già caricato
      stato.attivo = stato.piuBrand && stato.loghi[0].sorgente && !stato.loghi[1].sorgente ? 1 : 0;
      cambioLogo();
    });
    $('sel-logo').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-logo]');
      if (!b || Number(b.dataset.logo) === stato.attivo) return;
      stato.attivo = Number(b.dataset.logo);
      cambioLogo();
    });

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
      const l = attivo();
      caricamento(true);
      try {
        l.sorgente = await L.cambiaPagina(l.sorgente, Number(e.target.value));
        elaboraLogo(l, true);
        aggiornaInfoLogo();
        richiediRender();
      } catch (err) {
        avvisa(err.message, 'errore');
      } finally {
        caricamento(false);
      }
    });
    $('chk-composto').addEventListener('change', (e) => {
      attivo().composto = e.target.checked;
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
    $('sel-colore-logo').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-colore-logo]');
      if (b) impostaColoreLogo(b.dataset.coloreLogo === 'tinta' ? attivo().ultimoColoreLogo : null);
    });
    $('col-logo').addEventListener('input', (e) => impostaColoreLogo(e.target.value));
    $('hex-logo').addEventListener('input', (e) => {
      let v = e.target.value.trim();
      if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) impostaColoreLogo(v);
    });
    $('hex-logo').addEventListener('blur', () => aggiornaControlli());
    $('sel-variante').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-variante]');
      if (!b || !stato.scena) return;
      stato.variante[stato.scena.id] = b.dataset.variante;
      segna('#sel-variante', 'variante', b.dataset.variante);
      aggiornaUscite();
      richiediRender();
    });
    $('rng-dim').addEventListener('input', (e) => { attivo().p.dimensione = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('rng-x').addEventListener('input', (e) => { attivo().p.offX = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('rng-y').addEventListener('input', (e) => { attivo().p.offY = e.target.value / 100; aggiornaControlli(); richiediRender(); });
    $('btn-ricentra').addEventListener('click', () => {
      Object.assign(attivo().p, { offX: 0, offY: 0, dimensione: MK.TIPI[stato.tipo].dimensione });
      aggiornaControlli();
      richiediRender();
    });
    $('sel-rimuovi').addEventListener('change', (e) => {
      const l = attivo();
      l.rimuovi = e.target.value;
      elaboraLogo(l, false);
      richiediRender();
    });
    let timerSfondo = 0;
    const rielaboraPresto = () => {
      const l = attivo();
      clearTimeout(timerSfondo);
      timerSfondo = setTimeout(() => { elaboraLogo(l, false); richiediRender(); }, 120);
    };
    $('rng-tol').addEventListener('input', (e) => {
      attivo().tolleranza = Number(e.target.value);
      $('out-tol').textContent = attivo().tolleranza;
      rielaboraPresto();
    });
    // scegliere un colore da togliere attiva la rimozione
    const coloreDaTogliere = (hex) => {
      const l = attivo();
      const rgb = L.daHex(hex);
      if (!rgb || !l.sorgente) return;
      l.coloreRimozione = L.inHex(rgb);
      if (l.rimuovi === 'no') l.rimuovi = 'ovunque';
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

    [0, 1].forEach((i) => {
      const campo = campoBrand(i);
      campo.addEventListener('input', () => { stato.loghi[i].brand = campo.value; stato.loghi[i].brandAutomatico = false; nomeCambiato(); });
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') salva(['png', 'jpg']); });
    });
    $('uscite').addEventListener('change', (e) => {
      if (e.target.dataset.logo == null) return;
      stato.loghi[Number(e.target.dataset.logo)].esporta = e.target.checked;
      aggiornaUscite();
    });
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
        const a = stato.assegnate[scena.id];
        if (a) for (const pid of [...a.keys()]) if (!scena.posizioni.some((p) => p.id === pid && !p.fissa)) a.delete(pid);
      }
      await selezionaCliente(id);
    }
  }

  MK.app = { riempiTipi, stato, avvisa, esc, ricorda, ricordato, templateAggiornato, mostraVista, caricaLogo, salva, render, blobPNG, blobJPG };
  document.addEventListener('DOMContentLoaded', avvia);
})(window.MK = window.MK || {});
