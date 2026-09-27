/* Mockup Studio — cifratura dei template con la password del team (AES-GCM 256, chiave PBKDF2-SHA256). */
(function (MK) {
  'use strict';

  const ITERAZIONI = 600000;
  const CONTROLLO = 'mockup-studio';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function aBase64(bytes) {
    if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function daBase64(s) {
    if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(s);
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function casuali(n) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b;
  }

  function disponibile() {
    return !!(window.crypto && crypto.subtle);
  }

  async function derivaChiave(password, sale, iterazioni) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: daBase64(sale), iterations: iterazioni || ITERAZIONI },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function cifra(chiave, bytes) {
    const iv = casuali(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, bytes));
    return { iv: aBase64(iv), ct: aBase64(ct) };
  }

  async function decifra(chiave, pacchetto) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(pacchetto.iv) }, chiave, daBase64(pacchetto.ct)));
  }

  const cifraTesto = async (chiave, testo) => cifra(chiave, enc.encode(testo));
  const decifraTesto = async (chiave, pacchetto) => dec.decode(await decifra(chiave, pacchetto));

  // Nuova password: sale casuale + controllo cifrato (serve a riconoscere la password giusta).
  async function nuovaProtezione(password) {
    const sale = aBase64(casuali(16));
    const chiave = await derivaChiave(password, sale, ITERAZIONI);
    return { protezione: { v: 1, iterazioni: ITERAZIONI, sale, controllo: await cifraTesto(chiave, CONTROLLO) }, chiave };
  }

  async function chiaveValida(chiave, protezione) {
    try {
      return (await decifraTesto(chiave, protezione.controllo)) === CONTROLLO;
    } catch (e) {
      return false;
    }
  }

  // Template → pacchetto cifrato: i dati (nomi, posizioni) e ogni foto sono cifrati separatamente.
  async function cifraTemplate(chiave, t) {
    const immagini = [];
    const scene = [];
    for (const s of t.scene) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(s.immagine || '');
      if (!m || !m[2]) throw new Error('Immagine della scena «' + s.nome + '» non leggibile');
      immagini.push(await cifra(chiave, daBase64(m[3])));
      scene.push(Object.assign({}, s, { immagine: { indice: immagini.length - 1, tipo: m[1] || 'image/jpeg' } }));
    }
    const dati = await cifraTesto(chiave, JSON.stringify(Object.assign({}, t, { scene })));
    return { id: t.id, v: 1, dati, immagini };
  }

  async function decifraTemplate(chiave, pacchetto) {
    const t = JSON.parse(await decifraTesto(chiave, pacchetto.dati));
    for (const s of t.scene) {
      const bytes = await decifra(chiave, pacchetto.immagini[s.immagine.indice]);
      s.immagine = 'data:' + s.immagine.tipo + ';base64,' + aBase64(bytes);
    }
    t.id = pacchetto.id;
    return t;
  }

  // Identificativo neutro per i file dei template: nel repository pubblico non compare il nome del cliente.
  function idNeutro() {
    const alfabeto = 'abcdefghijkmnpqrstuvwxyz23456789';
    return 't-' + Array.from(casuali(10), (b) => alfabeto[b % alfabeto.length]).join('');
  }

  MK.cifra = {
    disponibile, derivaChiave, cifraTesto, decifraTesto, nuovaProtezione, chiaveValida, cifraTemplate, decifraTemplate, idNeutro,
  };
})(window.MK = window.MK || {});
