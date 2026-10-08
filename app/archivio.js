/* Mockup Studio — salvataggio dei file: cartella scelta (Chrome/Edge) oppure download. */
(function (MK) {
  'use strict';

  // ---- piccolo archivio chiave/valore su IndexedDB (per ricordare le cartelle scelte) ----
  function db() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open('mockup-studio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  }
  async function leggi(chiave) {
    try {
      const d = await db();
      return await new Promise((ok, ko) => {
        const r = d.transaction('kv').objectStore('kv').get(chiave);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
    } catch (e) { return undefined; }
  }
  async function scrivi(chiave, valore) {
    try {
      const d = await db();
      await new Promise((ok, ko) => {
        const t = d.transaction('kv', 'readwrite');
        t.objectStore('kv').put(valore, chiave);
        t.oncomplete = ok;
        t.onerror = () => ko(t.error);
      });
    } catch (e) { /* non indispensabile */ }
  }

  const supportato = typeof window.showDirectoryPicker === 'function';

  function Cartella(chiave) {
    this.chiave = chiave;
    this.handle = null;
  }
  Cartella.prototype.ripristina = async function () {
    if (!supportato) return null;
    const h = await leggi(this.chiave);
    if (h && h.kind === 'directory') this.handle = h;
    return this.handle;
  };
  Cartella.prototype.scegli = async function () {
    const h = await window.showDirectoryPicker({ id: this.chiave, mode: 'readwrite' });
    this.handle = h;
    await scrivi(this.chiave, h);
    return h;
  };
  Cartella.prototype.permesso = async function () {
    if (!this.handle) return false;
    const opz = { mode: 'readwrite' };
    if ((await this.handle.queryPermission(opz)) === 'granted') return true;
    return (await this.handle.requestPermission(opz)) === 'granted';
  };
  Cartella.prototype.esiste = async function (nome) {
    try { await this.handle.getFileHandle(nome); return true; } catch (e) { return false; }
  };
  Cartella.prototype.salva = async function (nome, blob) {
    const fh = await this.handle.getFileHandle(nome, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  };

  function scarica(nome, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function scaricaTutti(files) {
    for (let i = 0; i < files.length; i++) {
      if (i) await new Promise((r) => setTimeout(r, 400));
      scarica(files[i].nome, files[i].blob);
    }
  }

  function blobGrezzo(canvas, tipo, qualita) {
    return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Export failed'))), tipo, qualita));
  }

  // I PNG salvati portano il profilo colore sRGB (come i JPG): senza, alcuni programmi, per esempio Photoshop con
  // un altro spazio di lavoro, li mostrano con colori diversi da quelli visti nella piattaforma.
  async function canvasInBlob(canvas, tipo, qualita) {
    const b = await blobGrezzo(canvas, tipo, qualita);
    return tipo === 'image/png' ? pngConProfilo(b) : b;
  }

  // Profilo sRGB del browser, preso dal JPG che il browser stesso produce (segmento APP2 ICC_PROFILE).
  let profiloSrgb = null;
  function profiloDelBrowser() {
    if (!profiloSrgb) {
      profiloSrgb = (async () => {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        c.getContext('2d', { colorSpace: 'srgb' }).fillRect(0, 0, 1, 1);   // senza contesto il browser non mette il profilo
        const j = new Uint8Array(await (await blobGrezzo(c, 'image/jpeg', 0.9)).arrayBuffer());
        for (let i = 2; i + 4 < j.length && j[i] === 0xff;) {
          const marcatore = j[i + 1], n = (j[i + 2] << 8) | j[i + 3];
          if (marcatore === 0xe2 && String.fromCharCode(...j.subarray(i + 4, i + 16)) === 'ICC_PROFILE\0' && j[i + 17] === 1) return j.slice(i + 18, i + 2 + n);
          if (marcatore === 0xda) break;
          i += 2 + n;
        }
        return null;
      })().catch(() => null);
    }
    return profiloSrgb;
  }

  let tabellaCrc = null;
  function crc32(dati) {
    if (!tabellaCrc) {
      tabellaCrc = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        tabellaCrc[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < dati.length; i++) c = tabellaCrc[(c ^ dati[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Inserisce il chunk iCCP (profilo compresso) subito dopo IHDR; se qualcosa non va, il PNG resta com'era.
  async function pngConProfilo(blob) {
    try {
      const icc = await profiloDelBrowser();
      if (!icc || typeof CompressionStream !== 'function') return blob;
      const png = new Uint8Array(await blob.arrayBuffer());
      const testo = (da, a) => String.fromCharCode(...png.subarray(da, a));
      if (testo(12, 16) !== 'IHDR') return blob;
      const fineIhdr = 20 + new DataView(png.buffer).getUint32(8);
      const compresso = new Uint8Array(await new Response(new Blob([icc]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
      const chunk = new Uint8Array(12 + 6 + compresso.length);   // lunghezza, "iCCP", "sRGB\0", metodo 0, dati, CRC
      const dv = new DataView(chunk.buffer);
      dv.setUint32(0, 6 + compresso.length);
      chunk.set([0x69, 0x43, 0x43, 0x50, 0x73, 0x52, 0x47, 0x42, 0, 0], 4);
      chunk.set(compresso, 14);
      dv.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));
      return new Blob([png.subarray(0, fineIhdr), chunk, png.subarray(fineIhdr)], { type: 'image/png' });
    } catch (e) {
      return blob;
    }
  }

  MK.archivio = { supportato, Cartella, scarica, scaricaTutti, canvasInBlob, leggi, scrivi };
})(window.MK = window.MK || {});
