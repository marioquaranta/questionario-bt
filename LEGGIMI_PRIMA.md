# Better Together - test-dev: inviti personalizzati e doppioni (SIMULAZIONE)

**NON caricare questo pacchetto nel repository `test` dei volontari.**

## Pubblicazione separata

1. Crea un repository pubblico GitHub chiamato `test-dev`, se non esiste.
2. Carica nella ROOT SOLO i sei file del sito: `index.html`, `styles.css`, `questions.js`, `app.js`, `logo.png`, `demo-soci.js`.
3. Attiva GitHub Pages dal branch `main`, cartella `/ (root)`.
4. Apri `https://marioquaranta.github.io/test-dev/`.

Se hai scelto un altro nome per il repository, l'indirizzo cambia di conseguenza; i link vengono generati in base all'indirizzo effettivo della pagina.

## Prove consigliate

1. Dalla pagina principale, fai clic su **Simula invio email**. Ripeti: non devono risultare altri invii nuovi.
2. Per uno dei dieci soci fittizi, premi **Copia email** e **Copia WhatsApp**: i due testi devono contenere ESATTAMENTE lo stesso link personale per quel socio.
3. Apri il link e rispondi a due o tre domande. Chiudi la scheda, riapri lo stesso link sullo stesso browser: le risposte e la pagina devono essere recuperate.
4. Apri un secondo socio: non deve vedere le risposte del primo.
5. Simula il sollecito WhatsApp, poi ripeti: non devono partire doppi solleciti. La simulazione esclude chi e' completato in questo browser.
6. Per provare il blocco dopo completamento, compila l'intero questionario di uno dei soci fittizi. Riapri il link: deve apparire la pagina di completamento, non un nuovo questionario.
7. Usa **Esporta piano invii CSV** per controllare la tabella di simulazione e **Esporta risposte CSV locali** per verificare le prove del browser.
8. **Azzera tutta la simulazione** quando vuoi ricominciare.

## Vincoli importanti

- Questo sito **non invia email o messaggi WhatsApp reali**. "Simula" significa soltanto registrare localmente un evento fittizio.
- Tutto e' salvato con `localStorage` nel browser: link e risposte non sono condivisi tra smartphone e computer diversi. Il CSV elenca soltanto le compilazioni effettuate da quello stesso browser.
- Il blocco dei doppioni qui e' una **simulazione sul browser**, NON una protezione centralizzata. Lo stesso link aperto su un altro dispositivo consentirebbe una nuova compilazione indipendente.
- I dieci codici sono fittizi e pubblici all'interno del sito. Non inserire nomi, numeri, email o risposte reali, ne' usare questa struttura per la raccolta ufficiale.
- Per un test reale di invii, ripresa su dispositivi diversi e unicita' della compilazione serviranno un backend e un database (sul futuro server dell'associazione o su un servizio temporaneo), con controllo atomico del completamento sul server.
- B7N e B9 contengono ancora elenchi dimostrativi di attivita' e sedi.

## File della versione

`questions.js` riprende la versione piu' recente del questionario, con le correzioni F1, A3, B5, D1, D2, F3, E3. Non modifica il repository `test` dei volontari.
