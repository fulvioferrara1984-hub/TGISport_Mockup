# Mockup Studio · TGI Sport

Strumento per preparare in pochi secondi i mockup per i clienti: si trascina il logo, si sceglie lo sfondo e le posizioni, e si salvano insieme **PNG di produzione** e **JPG del mockup** con il nome del brand.

Funziona interamente nel browser: i loghi caricati e i mockup creati restano sul computer di chi li usa e non vengono inviati da nessuna parte.

L'interfaccia è in inglese: in questa guida i nomi di sezioni e pulsanti sono scritti come compaiono a schermo.

## Come si apre

- **Online**: apri il link del sito del team e inserisci la **password del team** (chiedila al referente del progetto). Con *Remember on this computer* la si scrive una volta sola; *Sign out* in alto a destra la dimentica.
- **Dal computer**: doppio clic su **`Mockup Studio.html`** nella cartella del progetto (serve la stessa password).

Consigliato **Google Chrome** (o Edge): permette di salvare direttamente in una cartella a scelta. Con Safari i file finiscono nella cartella Download.

> I file `.ai` e `.pdf` vengono letti con una libreria (pdf.js) caricata da internet al momento: per quei formati serve la connessione.

## Tipologie di mockup

| Tipologia | Area nella foto | PNG di produzione | Nome dei file |
|---|---|---|---|
| Centre circle (centro campo) | cerchio (4 punti sul cerchio) | 500 × 500, cerchio | `Brand_CC` |
| Mats (tappeti) | rettangolo (4 angoli) | 900 × 100 | `Brand_MATS` |
| Additional | rettangolo (4 angoli) | 248 × 100 | `Brand_Additional` |
| Behind goal ground (retroporta ground) | rettangolo (4 angoli) | 700 × 200 | `Brand_Retroporta_ground` |
| Behind goal vertical (retroporta vertical) | rettangolo (4 angoli) | 480 × 181 | `Brand_Retroporta_vertical` |

Per ogni cliente compaiono le tipologie per cui il template ha almeno un'immagine; le altre sono in grigio e si aggiungono dalla scheda *Templates*.

## Creare un mockup (*Create mockup*)

1. **Client and type**: scegli il cliente e la tipologia (vedi tabella sopra).
2. **Logo**: trascina il file del cliente (`.ai`, `.pdf`, `.svg`, `.png`, `.jpg`) nel riquadro, oppure incollalo con ⌘V.
   - Se il file è **già composto** (PNG 500×500 con il cerchio e gli angoli trasparenti, oppure 900×100 pieno), viene riconosciuto e usato così com'è: il PNG di produzione è il file originale, identico.
   - Altrimenti il logo viene **composto** automaticamente: inscritto nel cerchio da 500 px (CC) o centrato nel rettangolo 900×100 (MATS).
   - Sotto il nome del file compare l'anteprima del file originale, su scacchiera: così si vede subito se ha uno sfondo.
3. **Composition**, nell'ordine:
   - **Logo file background**: toglie un colore dal file, *everywhere* oppure *only around the logo* (utile se dentro al logo ci sono parti dello stesso colore da tenere). Il colore si sceglie con il selettore, scrivendo il codice o con il contagocce (Chrome), anche prelevandolo dall'anteprima del file. I fondi bianchi vengono tolti in automatico; con *Tolerance* si regola quanto togliere.
   - **Logo colour**: *Original* oppure *Change colour*, che ricolora tutto il logo in tinta unita (es. logo nero → giallo). Va fatto dopo aver tolto lo sfondo del file, altrimenti si colora anche quello.
   - **Artwork background**: un colore (quelli presi dal logo, bianco, nero o uno qualsiasi) oppure **trasparente** (il primo quadratino a scacchi): il PNG di produzione avrà solo il logo. Nel mockup attorno al logo si vede la foto, quindi serve una foto senza vecchi loghi in quella posizione.
   - Dimensione e posizione del logo.
4. **Positions**: scegli dove inserire il logo; passando il mouse su una posizione, si evidenzia nell'anteprima. Se l'immagine ha delle **competizioni** (es. tappeti Inter), scegli *Domestico* o *Internazionale*: sulle posizioni fisse (i tappeti interni) va la grafica di quella competizione.
5. **Save**: scrivi il nome del brand (*Brand name*) e premi *Save PNG + JPG*. Si ottengono:
   - `Brand_<tipologia>.png` (es. `Brand_CC.png`, `Brand_Retroporta_ground.png`) → file per la produzione
   - `Brand_<tipologia>.jpg` → mockup da inviare al cliente; se c'è una competizione il suo nome è aggiunto al JPG (es. `Brand_MATS_Internazionale.jpg`)

In anteprima: *Detail* ingrandisce sulle posizioni, *Hold for original* (tenuto premuto) mostra la foto senza logo.

## Aggiungere o modificare un cliente (template)

**Prima di iniziare:** servono le foto di base del cliente, 1920×1080, **pulite** (senza loghi nelle aree da usare): così le posizioni non selezionate e i loghi su sfondo trasparente mostrano la superficie vera. Le foto in PNG vengono salvate in automatico come JPG di alta qualità, per tenere leggeri i template. Lavora sulla copia della cartella del progetto sul tuo computer, con Chrome.

Nella scheda **Templates**:

1. *+ New* e scrivi il nome del cliente (per modificarne uno esistente, sceglilo dal menu).
2. **Centro campo**: *+ Add image* → foto del centrocampo → tipologia *Centre circle* → *+ Add position*. Porta i 4 punti sulla linea del cerchio: *top* e *bottom* dove la linea di metà campo incrocia il cerchio, *right* e *left* all'altezza del dischetto. L'ellisse deve combaciare con il cerchio e il mirino cadere sul dischetto.
3. **Tappeti, Additional, Retroporta ground e vertical**: *+ Add image* → foto → scegli la tipologia → una posizione per ogni area (vedi sotto). Porta i 4 angoli sull'area dove andrà la grafica, nell'ordine in cui si legge il logo (*top left*, *top right*, *bottom right*, *bottom left*).
   - Per ogni area usa **+ Logo position** (riceve il logo del brand) oppure **+ Competition position** (es. i tappeti interni enilive / 1xbet). La nuova posizione compare al centro della vista: **trascinala dall'interno** fin sulla zona giusta, poi sistema i 4 punti. Il tipo si cambia anche dopo, con *Logo / Competition* sotto il nome della posizione.
   - **Competizioni** (*Competitions*): la prima *Competition position* copia in automatico le competizioni da un cliente che le ha già (es. Inter: *Domestico* = enilive, *Internazionale* = 1xbet). Si possono anche copiare con *Copy from a client…* o aggiungere a mano con *+ Add artwork* (stesso formato della tipologia, es. 900×100) e rinominare. In *Create mockup* compare la scelta della competizione.
   - **Spessore dei tappeti** (*Mat thickness*, solo nel mockup, non nel PNG di produzione): spunta *Add thickness in the mockup* e scegli colore (*Colour*), profondità in pixel (*Depth*) e lato (*Side*). *Automatic* mette lo spessore in alto e sul lato corto più basso (*Goal on the left* → a sinistra, *Goal on the right* → a destra). Vale per tutti i tappeti dell'immagine, competizioni comprese.
4. **Dai un nome chiaro alle posizioni** (es. *Esterno sinistra*): è quello che si vede in *Create mockup*.
5. **Bleed (px)**: lascia 0 con foto pulite; metti 0,6–0,7 se nella foto c'è già un vecchio logo da coprire.
6. **Controlla** con *Show test artwork*: il motivo deve coprire esattamente la zona e la scritta *TOP* deve stare dalla parte lontana del campo.
7. *Save to the templates folder* e scegli la cartella `templates` del progetto (solo la prima volta). I file vengono salvati **già cifrati** con la password del team. Con Safari: *Download the files* e sposta i due file nella cartella `templates`, sostituendo `elenco.js`.
8. Prova il nuovo cliente in *Create mockup* con un logo di `loghi-di-prova`.
9. **Pubblica** per i colleghi: in GitHub Desktop scrivi una descrizione generica (es. "Aggiornamento template": il repository è pubblico), *Commit to main*, poi *Push origin*. Il sito si aggiorna da solo in un paio di minuti.

### Sostituire una foto (es. con quella pulita)

1. Scheda **Templates** → scegli il cliente → clicca l'immagine nell'elenco *Images*.
2. **Replace the photo (positions are kept)** → scegli la nuova foto. Posizioni e competizioni restano quelle di prima:
   - stessa inquadratura e stessa misura: i punti combaciano già;
   - stessa inquadratura ma risoluzione diversa (es. 3840×2160): i punti vengono riportati in scala da soli;
   - proporzioni diverse: la piattaforma lo segnala e i punti vanno ricontrollati.
3. Controlla con *Show test artwork* che le aree combacino. Con le foto pulite il **Bleed** delle posizioni può tornare a 0.
4. Salva nella cartella `templates` e pubblica.

Strumenti utili nell'editor: rotella per lo zoom; trascina **dentro** una posizione per spostarla tutta, **su un punto** per spostare solo quello; trascina lo sfondo (o tieni premuta la barra spaziatrice e trascina) per spostare la vista; frecce per muovere il punto selezionato, oppure tutta la posizione se non è selezionato un punto (⇧ = 10 px, ⌥ = 0,1 px); lente d'ingrandimento durante lo spostamento dei punti.

## Password del team

- I template (foto dei clienti, posizioni e nomi) sono **cifrati** con la password del team (AES-256, chiave derivata con PBKDF2): senza password nel repository pubblico si vedono solo dati illeggibili. Il codice della piattaforma invece è visibile a tutti, come in ogni repository pubblico.
- **Cambiarla** (per esempio quando qualcuno lascia il team): scheda *Templates* → *Team password* → scrivi due volte la nuova password → *Change password* → scegli la cartella `templates`. Tutti i template vengono ricifrati: poi pubblicali su GitHub e comunica la nuova password ai colleghi.
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

- File `.ai` salvati **senza** "Crea file compatibile PDF" (*Create PDF Compatible File* in Illustrator in inglese) non sono leggibili: vanno risalvati con quell'opzione o esportati in PDF/SVG/PNG. Anche EPS, PSD e TIFF vanno esportati in un altro formato.
- Se la foto di base contiene già dei loghi, le posizioni non selezionate mostrano quello che c'è nella foto.
