# MetroLab

**EU** · Metrologia dimentsionaleko ariketak entrenatzeko aplikazioa (OPE, 1508 espezialitatea: *Fabrikazio Mekanikoaren Antolamendua eta Proiektuak*): tresnen irakurketa, galga-blokeak, sinu-erregela, konoak, hiru harien metodoa, profilak arrabolekin, tenperatura-zuzenketa eta kalibre finkoak. Zuzenketa deterministikoa da: bi ebazle independente eta Python orakulu bat.

**ES** · Aplicación para entrenar ejercicios de metrología dimensional (OPE, especialidad 1508: *Organización y Proyectos de Fabricación Mecánica*): lectura de instrumentos, bloques patrón, regla de senos, conos, método de los tres alambres, perfiles con rodillos, corrección por temperatura y calibres fijos. La corrección es determinista: dos solucionadores independientes y un oráculo en Python.

Web: https://letitbe010.github.io/MetroLab/

## Garapena / Desarrollo

```bash
npm install
npm run dev
npm test
npm run oracle:py   # Python oracle (pip install -r tools/oracle/requirements.txt)
```

Lizentzia / Licencia: kodea MIT; edukia CC BY-SA 4.0 (ikus `LICENSE`).
