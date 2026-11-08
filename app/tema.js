/* Mockup Studio — tema scuro (predefinito) o chiaro, come nella Piattaforma TGI Sport.
   Sta nel <head>, così il tema è applicato prima del primo disegno. La scelta resta nel browser del dispositivo. */
(function () {
  'use strict';

  const CHIAVE = 'tgi-tema';
  const radice = document.documentElement;

  function salvato() {
    try { return localStorage.getItem(CHIAVE) === 'chiaro' ? 'chiaro' : 'scuro'; } catch (e) { return 'scuro'; }
  }

  function cambia() {
    const nuovo = radice.dataset.tema === 'chiaro' ? 'scuro' : 'chiaro';
    radice.dataset.tema = nuovo;
    try { localStorage.setItem(CHIAVE, nuovo); } catch (e) { /* archivio bloccato: il tema vale per questa visita */ }
  }

  radice.dataset.tema = salvato();
  document.addEventListener('click', (e) => { if (e.target.closest('[data-cambia-tema]')) cambia(); });
})();
