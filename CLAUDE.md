# MetroLab – arau nagusiak
Espezifikazio osoa: `../MetroLab_argibideak.md`.

- Zehaztasuna > dena. core/-n akats batek erabiltzailearen ikaskuntza hondatzen du.
- Aritmetika: arrazional zehatzak (src/core/rational.ts); trigonometria amaieran. Angeluak: α (osoa) eta α/2 (erdi-angelua) beti bereizita, izenez eta UIn.
- Formula itxi guztiak B-ko geometria konputazionalarekin egiaztatuta. Datu-taulak (galga-multzoak, hariak, konoak, ISO azpimultzoa) iturriarekin eta testekin.
- ISO 286 azpimultzoa proiektu honetan sortua da (DoikuntzaLab ez dago); bi iturrirekin alderatua eta erabiltzaileak egiaztatua.
- Sorgailuak biribildutako "neurriak" erakusten ditu; erantzuna horietatik kalkulatzen da.
- Bi ebazle independente (A eta B) + Python orakulua. Bat ez badatoz → ariketa ez da erakusten.
- Erantzun zuzena erakutsitako datuetatik kalkulatzen da beti.
- Kanpoko iturrien soluzioak ez dira inoiz egiatzat hartzen: beti berriz ebatzi.
- Golden testak (tests/golden) ez dira inoiz aldatzen inplementazioari egokitzeko.
- Zuzenketan ez da AArik erabiltzen. Teoriako eta ebatzietako zenbakiak ebazletik txertatzen dira. Teoria TS objektu gisa, ez MDX.
- UI elebiduna: eu (lehenetsia) / es. Terminologia: espezifikazioko §13.3.
- GitHub: biltegia sortu edo push egin aurretik, erabiltzaileari baieztapena eskatu. Despliegea, CI berde badago soilik.
- Fase bat ez da amaitutzat jotzen bere test guztiak berde egon arte.
- core/-k ez du UIren ezer inportatzen (ESLint-ek debekatzen du).
- Zuzentzailea (src/core/grader.ts): luzerak ±0,001 mm; irakurketak eta kalibre-neurriak zehatz; angeluak ±0,01°; C ±% 0,1 erlatiboa. MetroLab-en aukerak (erabiltzaileak berretsi gabe): hautaketa-errorea ±0,0002 mm, batez bestekoaren errore absolutua ±0,0001 mm, errore erlatiboa ±% 0,5 erlatiboa. Erantzun zuzenaren berdina ematen duen "akatsa" ez da diagnostikatzen.
- Sorgailua: txantiloi bakoitzak A klasikoa (pilak), d₂ < M, bolak zuloaren barruan, sinu-erregela ≤ 45° eta akats guztiak bereizgarriak izatea eskatzen ditu (generator/verify.ts). Pool-a: src/data/pool-ope.json (eskuz) + `npm run pin` (finkatutakoak, seed 1).
- Kodea, iruzkinak eta commit-mezuak ingelesez. Commit-egilea: Letitbe010 noreply helbidearekin.
