# Mockup Studio · TGI Sport

Strumento per preparare in pochi secondi i mockup per i clienti: si trascina il logo, si sceglie lo sfondo e le posizioni, e si salvano insieme **PNG di produzione** e **JPG del mockup** con il nome del brand.

Funziona interamente nel browser: i loghi caricati e i mockup creati restano sul computer di chi li usa e non vengono inviati da nessuna parte.

## Come si apre

- **Online**: apri il link del sito del team e inserisci la **password del team** (chiedila al referente del progetto). Con *Ricorda su questo computer* la si scrive una volta sola; *Esci* in alto a destra la dimentica.
- **Dal computer**: doppio clic su **`Mockup Studio.html`** nella cartella del progetto (serve la stessa password).

Consigliato **Google Chrome** (o Edge): permette di salvare direttamente in una cartella a scelta. Con Safari i file finiscono nella cartella Download.

> I file `.ai` e `.pdf` vengono letti con una libreria (pdf.js) caricata da internet al momento: per quei formati serve la connessione.

## Tipologie di mockup

| Tipologia | Area nella foto | PNG di produzione | Nome dei file |
|---|---|---|---|
| Centro campo | cerchio (4 punti sul cerchio) | 500 × 500, cerchio | `Brand_CC` |
| Tappeti | rettangolo (4 angoli) | 900 × 100 | `Brand_MATS` |
| Additional | rettangolo (4 angoli) | 248 × 100 | `Brand_Additional` |
| Retroporta ground | rettangolo (4 angoli) | 700 × 200 | `Brand_Retroporta_ground` |
| Retroporta vertical | rettangolo (4 angoli) | 480 × 181 | `Brand_Retroporta_vertical` |

Per ogni cliente compaiono le tipologie per cui il template ha almeno un'immagine; le altre sono in grigio e si aggiungono dalla scheda *Template*.

## Creare un mockup

1. **Cliente e tipologia**: scegli il cliente e la tipologia (vedi tabella sopra).
2. **Logo**: trascina il file del cliente (`.ai`, `.pdf`, `.svg`, `.png`, `.jpg`) nel riquadro, oppure incollalo con ⌘V.
   - Se il file è **già composto** (PNG 500×500 con il cerchio e gli angoli trasparenti, oppure 900×100 pieno), viene riconosciuto e usato così com'è: il PNG di produzione è il file originale, identico.
   - Altrimenti il logo viene **composto** automaticamente: inscritto nel cerchio da 500 px (CC) o centrato nel rettangolo 900×100 (MATS).
   - Sotto il nome del file compare l'anteprima del file originale, su scacchiera: così si vede subito se ha uno sfondo.
3. **Composizione**: colore di sfondo (ci sono i colori presi dal logo, bianco e nero, o un colore qualsiasi), dimensione e posizione del logo.
   - **Sfondo del file del logo**: toglie un colore dal file, *ovunque* oppure *solo attorno al logo* (utile se dentro al logo ci sono parti dello stesso colore da tenere). Il colore si sceglie con il selettore, scrivendo il codice o con il contagocce (Chrome), anche prelevandolo dall'anteprima del file. I fondi bianchi vengono tolti in automatico; con *Tolleranza* si regola quanto togliere.
4. **Posizioni**: per i tappeti scegli dove inserire il logo. Passando il mouse su una posizione, si evidenzia nell'anteprima.
5. **Salva**: scrivi il nome del brand e premi *Salva PNG + JPG*. Si ottengono:
   - `Brand_<tipologia>.png` (es. `Brand_CC.png`, `Brand_Retroporta_ground.png`) → file per la produzione
   - `Brand_<tipologia>.jpg` → mockup da inviare al cliente

In anteprima: *Dettaglio* ingrandisce sulle posizioni, *Tieni premuto: originale* mostra la foto senza logo.

## Aggiungere o modificare un cliente (template)

**Prima di iniziare:** servono le foto di base del cliente, meglio in **JPG** 1920×1080 (in PNG il template pesa circa il triplo) e, se possibile, senza loghi già applicati. Lavora sulla copia della cartella del progetto sul tuo computer, con Chrome.

Nella scheda **Template**:

1. *+ Nuovo* e scrivi il nome del cliente (per modificarne uno esistente, sceglilo dal menu).
2. **Centro campo**: *+ Aggiungi immagine* → foto del centrocampo → tipologia *Centro campo* → *+ Aggiungi posizione*. Porta i 4 punti sulla linea del cerchio: *alto* e *basso* dove la linea di metà campo incrocia il cerchio, *destra* e *sinistra* all'altezza del dischetto. L'ellisse deve combaciare con il cerchio e il mirino cadere sul dischetto.
3. **Tappeti, Additional, Retroporta ground e vertical**: *+ Aggiungi immagine* → foto → scegli la tipologia → *+ Aggiungi posizione* per ogni area. Porta i 4 angoli sull'area dove andrà la grafica, nell'ordine in cui si legge il logo (alto sx, alto dx, basso dx, basso sx).
4. **Dai un nome chiaro alle posizioni** (es. *Esterno sinistra*): è quello che si vede in *Crea mockup*.
5. **Bordo (px)**: lascia 0 con foto pulite; metti 0,6–0,7 se nella foto c'è già un vecchio logo da coprire.
6. **Controlla** con *Mostra artwork di prova*: il motivo deve coprire esattamente la zona e la scritta *ALTO* deve stare dalla parte lontana del campo.
7. *Salva nella cartella templates* e scegli la cartella `templates` del progetto (solo la prima volta). I file vengono salvati **già cifrati** con la password del team. Con Safari: *Scarica i file* e sposta i due file nella cartella `templates`, sostituendo `elenco.js`.
8. Prova il nuovo cliente in *Crea mockup* con un logo di `loghi-di-prova`.
9. **Pubblica** per i colleghi: in GitHub Desktop scrivi una descrizione generica (es. "Aggiornamento template": il repository è pubblico), *Commit to main*, poi *Push origin*. Il sito si aggiorna da solo in un paio di minuti.

Strumenti utili nell'editor: rotella per lo zoom, trascina lo sfondo per spostarti, frecce per muovere il punto selezionato (⇧ = 10 px, ⌥ = 0,1 px), lente d'ingrandimento durante lo spostamento.

## Password del team

- I template (foto dei clienti, posizioni e nomi) sono **cifrati** con la password del team (AES-256, chiave derivata con PBKDF2): senza password nel repository pubblico si vedono solo dati illeggibili. Il codice della piattaforma invece è visibile a tutti, come in ogni repository pubblico.
- **Cambiarla** (per esempio quando qualcuno lascia il team): scheda *Template* → *Password del team* → scrivi due volte la nuova password → scegli la cartella `templates`. Tutti i template vengono ricifrati: poi pubblicali su GitHub e comunica la nuova password ai colleghi.
- Non caricare mai su GitHub template non cifrati né file con la password.

## Cartelle

```
Mockup Studio.html   ← da aprire (index.html la apre in automatico sul sito)
app/                 ← programma (non serve toccarlo)
templates/           ← un file cifrato per cliente + elenco.js
Logo/                ← logo TGI Sport mostrato nella piattaforma
loghi-di-prova/      ← loghi finti per fare prove
```

La cartella `export/`, le foto originali dei clienti e i file di sistema `.DS_Store` sono esclusi da GitHub (vedi `.gitignore`).

## Limiti attuali

- File `.ai` salvati **senza** "Crea file compatibile PDF" non sono leggibili: vanno risalvati con quell'opzione o esportati in PDF/SVG/PNG. Anche EPS, PSD e TIFF vanno esportati in un altro formato.
- Se la foto di base contiene già dei loghi, le posizioni non selezionate mostrano quello che c'è nella foto.
