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
- Kodea, iruzkinak eta commit-mezuak ingelesez. Commit-egilea: Letitbe010 noreply helbidearekin.
