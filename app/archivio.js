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

  function canvasInBlob(canvas, tipo, qualita) {
    return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Export failed'))), tipo, qualita));
  }

  MK.archivio = { supportato, Cartella, scarica, scaricaTutti, canvasInBlob, leggi, scrivi };
})(window.MK = window.MK || {});
