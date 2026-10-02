/* Mockup Studio — accesso con la password del team. */
(function (MK) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CHIAVE_RICORDATA = 'chiave-team';

  // La chiave (non esportabile) può restare nel browser, così la password si scrive una volta sola.
  async function chiaveRicordata(protezione) {
    const r = await MK.archivio.leggi(CHIAVE_RICORDATA);
    if (r && r.chiave && r.sale === protezione.sale && (await MK.cifra.chiaveValida(r.chiave, protezione))) return r.chiave;
    return null;
  }

  async function ricorda(chiave, protezione, si) {
    await MK.archivio.scrivi(CHIAVE_RICORDATA, si ? { chiave, sale: protezione.sale } : null);
  }

  function chiediPassword(protezione) {
    return new Promise((fatto) => {
      const box = $('accesso'), form = $('accesso-form'), campo = $('accesso-password');
      const errore = $('accesso-errore'), bottone = $('accesso-entra');
      box.hidden = false;
      box.classList.remove('in-attesa');
      requestAnimationFrame(() => campo.focus());
      const invio = async (e) => {
        e.preventDefault();
        if (!campo.value) return;
        bottone.disabled = true;
        bottone.textContent = 'Checking…';
        errore.hidden = true;
        try {
          const chiave = await MK.cifra.derivaChiave(campo.value, protezione.sale, protezione.iterazioni);
          if (!(await MK.cifra.chiaveValida(chiave, protezione))) {
            errore.textContent = 'Wrong password.';
            errore.hidden = false;
            campo.select();
            return;
          }
          await ricorda(chiave, protezione, $('accesso-ricorda').checked);
          form.removeEventListener('submit', invio);
          campo.value = '';
          box.hidden = true;
          fatto(chiave);
        } catch (err) {
          errore.textContent = 'Sign-in failed: ' + err.message;
          errore.hidden = false;
        } finally {
          bottone.disabled = false;
          bottone.textContent = 'Sign in';
        }
      };
      form.addEventListener('submit', invio);
    });
  }

  // Si risolve quando si può usare la piattaforma (subito se non è protetta o se il browser ricorda la password).
  async function sblocca() {
    const box = $('accesso');
    const protezione = MK.template.protezione();
    if (!protezione) { box.hidden = true; return; }
    $('btn-esci').hidden = false;
    if (!MK.cifra.disponibile()) {
      box.classList.remove('in-attesa');
      $('accesso-form').innerHTML = '<p class="errore">This browser cannot open the protected templates. Please use an up-to-date version of Google Chrome.</p>';
      return new Promise(() => {});
    }
    let chiave = null;
    try { chiave = await chiaveRicordata(protezione); } catch (e) { chiave = null; }
    if (chiave) box.hidden = true;
    else chiave = await chiediPassword(protezione);
    await MK.template.impostaChiave(chiave);
  }

  async function esci() {
    await MK.archivio.scrivi(CHIAVE_RICORDATA, null);
    location.reload();
  }

  // Dopo un cambio password il browser di chi l'ha cambiata la ricorda già.
  async function aggiornaChiaveRicordata(chiave, protezione) {
    const r = await MK.archivio.leggi(CHIAVE_RICORDATA);
    if (r) await ricorda(chiave, protezione, true);
  }

  MK.accesso = { sblocca, esci, aggiornaChiaveRicordata };
})(window.MK = window.MK || {});
