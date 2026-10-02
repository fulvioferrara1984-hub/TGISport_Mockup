/* Mockup Studio — archivio dei template (clienti, immagini di base e posizioni). */
(function (MK) {
  'use strict';

  const CARTELLA = 'templates/';
  const elenco = [];          // [{ id, nome, file }] — con la password, i nomi sono in chiaro solo dopo l'accesso
  const registrati = {};      // id -> template in chiaro
  const cifrati = {};         // id -> template ancora cifrato
  const inAttesa = {};        // id -> funzione che segnala l'arrivo del file
  const immagini = new Map(); // dataURL -> Promise<HTMLImageElement>
  const sicurezza = { protezione: null, chiave: null };

  // API globale usata dai file in templates/ (funziona anche aprendo la pagina da disco).
  window.MockupTool = {
    elencoTemplate(lista, protezione) {
      elenco.length = 0;
      (lista || []).forEach((t) => elenco.push(Object.assign({}, t)));
      sicurezza.protezione = protezione || null;
    },
    registraTemplate(t) {
      registrati[t.id] = t;
      arrivato(t.id);
    },
    registraTemplateCifrato(pacchetto) {
      cifrati[pacchetto.id] = pacchetto;
      arrivato(pacchetto.id);
    },
  };

  function arrivato(id) {
    if (inAttesa[id]) { inAttesa[id](); delete inAttesa[id]; }
  }

  function caricaScript(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      // sul web evita la cache; aprendo la pagina da disco (file://) il file viene sempre riletto
      s.src = /^https?:$/.test(location.protocol) ? src + '?t=' + Date.now() : src;
      s.onload = () => { s.remove(); ok(); };
      s.onerror = () => { s.remove(); ko(new Error('File not found: ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function caricaElenco() {
    try {
      await caricaScript(CARTELLA + 'elenco.js');
    } catch (e) {
      console.warn(e);
    }
    return elenco;
  }

  // Dopo l'accesso: memorizza la chiave e rende leggibili i nomi dei clienti.
  async function impostaChiave(chiave) {
    sicurezza.chiave = chiave;
    for (const v of elenco) {
      if (v.nome && typeof v.nome === 'object') v.nome = await MK.cifra.decifraTesto(chiave, v.nome);
    }
  }

  async function carica(id) {
    if (registrati[id]) return registrati[id];
    const voce = elenco.find((t) => t.id === id);
    if (!voce) throw new Error('Unknown template: ' + id);
    if (!cifrati[id]) {
      const segnale = new Promise((ok) => { inAttesa[id] = ok; });
      await caricaScript(CARTELLA + voce.file);
      if (!registrati[id] && !cifrati[id]) {
        await Promise.race([segnale, new Promise((_, ko) => setTimeout(() => ko(new Error('The file ' + voce.file + ' does not contain the expected template')), 4000))]);
      }
    }
    if (registrati[id]) return registrati[id];
    if (!sicurezza.chiave) throw new Error('The team password is needed to open this template');
    try {
      registrati[id] = await MK.cifra.decifraTemplate(sicurezza.chiave, cifrati[id]);
    } catch (e) {
      throw new Error('Cannot open the template: it is encrypted with a different password');
    }
    delete cifrati[id];
    return registrati[id];
  }

  function registraInMemoria(t) {
    registrati[t.id] = t;
    const voce = elenco.find((v) => v.id === t.id);
    if (voce) voce.nome = t.nome;
    else elenco.push({ id: t.id, nome: t.nome, file: t.id + '.js' });
  }

  function immagineScena(scena) {
    const url = scena.immagine;
    if (!immagini.has(url)) immagini.set(url, MK.loghi.caricaImmagine(url));
    return immagini.get(url);
  }

  // Contenuto dei file da salvare nella cartella templates/ (cifrati se la piattaforma ha la password).
  async function fileTemplate(t) {
    if (sicurezza.protezione) {
      const pacchetto = await MK.cifra.cifraTemplate(sicurezza.chiave, t);
      return '/* Template Mockup Studio, cifrato con la password del team */\nMockupTool.registraTemplateCifrato(' + JSON.stringify(pacchetto) + ');\n';
    }
    return '/* Template Mockup Studio: ' + t.nome.replace(/\*\//g, '') + ' */\nMockupTool.registraTemplate(' + JSON.stringify(t) + ');\n';
  }

  async function fileElenco() {
    const righe = [];
    for (const v of elenco) {
      const nome = sicurezza.protezione ? await MK.cifra.cifraTesto(sicurezza.chiave, v.nome) : v.nome;
      righe.push('  ' + JSON.stringify({ id: v.id, nome, file: v.file }));
    }
    const protezione = sicurezza.protezione ? ',\n' + JSON.stringify(sicurezza.protezione) : '';
    return '/* Elenco dei template di Mockup Studio' + (sicurezza.protezione ? ' (nomi cifrati con la password del team)' : '') + ' */\n' +
      'MockupTool.elencoTemplate([\n' + righe.join(',\n') + '\n]' + protezione + ');\n';
  }

  // Legge un file template esportato (anche da un'altra postazione), cifrato o in chiaro.
  async function leggiFileTemplate(testo) {
    const t = testo.trim();
    let m = /registraTemplateCifrato\(([\s\S]*)\);?\s*$/.exec(t);
    if (m) {
      if (!sicurezza.chiave) throw new Error('The team password is needed');
      try {
        return await MK.cifra.decifraTemplate(sicurezza.chiave, JSON.parse(m[1]));
      } catch (e) {
        throw new Error('The file is encrypted with a different password');
      }
    }
    m = /registraTemplate\(([\s\S]*)\);?\s*$/.exec(t);
    if (!m) throw new Error('The file is not a Mockup Studio template');
    const tpl = JSON.parse(m[1]);
    if (!tpl.id || !Array.isArray(tpl.scene)) throw new Error('Incomplete template');
    return tpl;
  }

  function slug(testo) {
    return (testo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'template';
  }

  // Id (e quindi nome del file) per un nuovo template: neutro se la piattaforma è protetta.
  function nuovoId(nome) {
    const esistenti = elenco.map((v) => v.id);
    let id = sicurezza.protezione ? MK.cifra.idNeutro() : slug(nome);
    let n = 2;
    while (esistenti.includes(id)) id = sicurezza.protezione ? MK.cifra.idNeutro() : slug(nome) + '-' + n++;
    return id;
  }

  function impostaProtezione(protezione, chiave) {
    sicurezza.protezione = protezione;
    sicurezza.chiave = chiave;
  }

  MK.template = {
    elenco, registrati, caricaElenco, carica, impostaChiave, registraInMemoria, immagineScena,
    fileTemplate, fileElenco, leggiFileTemplate, slug, nuovoId, impostaProtezione,
    protezione: () => sicurezza.protezione,
    chiave: () => sicurezza.chiave,
  };
})(window.MK = window.MK || {});
