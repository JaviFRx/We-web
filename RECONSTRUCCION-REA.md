# Reconstrucción de WeDo 2.0 a partir del original

## Criterio de aceptación

El objetivo es equivalencia visual y de comportamiento con la instalación original de WeDo 2.0. El visor de contenidos, el taller `/lab/` y el editor añadido en `web/programming.js` no constituyen una copia completa. Las pruebas del prototipo verifican su propio funcionamiento, no equivalencia con Unity.

No se considerará terminado un componente por parecerse a una captura. Se necesita identificar sus recursos y estado en el original, reconstruir sus transiciones y comparar los mismos escenarios, incluidos cancelación, arrastre, ejecución, parada, desconexión y persistencia.

## Evidencia retenida (24/10/2026)

Objetivo: `C:/Program Files (x86)/WeDo 2.0/WeDo 2.0_Data/Managed/Assembly-CSharp.dll`.

- SHA-256: `579d17be8a501080ee008202814764ad10c8c50d6c34ab2d37481fe46b29bdae`.
- Inventario REA: `analysis/app-members.json`, Evidence `ev_4093b10a8296d9ed2698010039073cbb0504fae7107c10c9b40af79472f534dc`.
- Grafo estático REA: `analysis/managed-graph.json`, Evidence `ev_d33220b05259fb8e723c17ccca9403af58e8eefc6cfe079f35a1780e3b7cc415`. Contiene 640 tipos, 4.346 métodos y 3.177 campos. Es proyección de metadatos, no una ejecución ni un grafo completo de dependencias de la aplicación.
- Reconstrucción C# con ILSpy 11.1.0.9782, importada en REA: `analysis/managed-reconstruction/reconstruction.evidence.json`, Evidence `ev_5b66caca102b61138439ad743ac5bb056c1403d5bd12f46a3cda1ac13e0d6a98`. Vincula 31 métodos seleccionados a tokens, firmas e IL del artefacto. El manifiesto conserva hashes de 22 archivos de clases recuperadas. No es el código fuente original ni una demostración de equivalencia en ejecución.
- Recursos Unity: `analysis/unity-assets/manifest.json`, 2.126 PNG y árboles serializados. `layout-index.json` enlaza 12 raíces de interfaz con sus componentes y sprites; `FINDINGS.md` detalla la extracción. Extracción complementaria con UnityPy y recuperación de tipos; no se atribuye a REA. El manifiesto conserva hashes de archivos de origen y rutas de objetos. Quedan 2 MonoBehaviours y 14 texturas sin decodificar.

Geometría de autoría recuperada: lienzo de referencia 1024×768 con ajuste a altura; panel de paleta de altura 120; vista de paleta de altura 80; fila de dispositivo de tamaño preferido 442×80. Estos datos no son medidas finales de pantalla: deben aplicarse las transformaciones, escalado y cambios de estado de los scripts originales.

Los informes y extracciones están en `analysis/`, carpeta local ignorada por Git. No se modificó la instalación original. Los scripts reproducibles están en `scripts/recover-managed-editor.ps1`, `scripts/project-rea-graph.mjs` y `scripts/import-managed-reconstruction.mjs`; la proyección e importación comprueban que la DLL coincide con la evidencia retenida.

## Reconstrucción implementada y comprobada

El editor utiliza los recursos originales y conserva 25 entradas de paleta, 17 instrucciones, 7 tipos de parámetro, tiras independientes, bucles, comentarios y direcciones de hasta tres hubs. Los módulos `original-runtime.js`, `original-snapping.js` y `original-addressing.js` se apoyan en los cuerpos C# recuperados. La luz es discreta; la potencia inicial es 8; el estado persiste por puerto; el motor temporizado frena con 127; terminar una tira no implica frenado automático.

La biblioteca de proyectos, barra de herramientas, teclados de parámetros y captura utilizan sprites y geometría nativos. La documentación, actividades, modelos y ayuda conservan el Angular original. El visor respeta los tamaños Full/Half/Quarter recuperados, con las páginas parciales sobre el lienzo. La evidencia adicional del visor es `ev_8f0bab7c85992547436240ce296a4e3a2ff987a0ce03e23ea1f49e9f8f1780b3` y la del direccionamiento es `ev_ac57750f0b3c1de3e6e4b6e00972f3401fb89727c6b06b5a4bea2a14d582a331`.

Los formatos `.proj` y `.wedo` mantienen la estructura nativa y sus medios. La duplicación reubica referencias sin modificar texto libre. IndexedDB conserva los datos y migra localStorage sin borrarlo. El sensor de sonido usa pico positivo, los umbrales originales y promedio de dos medidas. El sonido vuelve a evaluar el parámetro para calcular la espera, como hace el original.

La semántica de pulsación se corrigió leyendo `InstructionBlockView.DidSingleTap`: Start inicia; StartOnKeyPress envía la tecla; ciertos bloques alternan modo; los bloques ordinarios no ejecutan por pulsación. Las pruebas anteriores del prototipo no demostraban equivalencia y se sustituyeron.

## Verificación y límites

Las pruebas automáticas cubren protocolo BLE con transportes simulados, motor/freno, estados de ejecución, direcciones multi-hub, formatos nativos, duplicación, almacenamiento, documentación, cámara, micrófono, encajes y gestos en Chrome. Los scripts `scripts/check-*-browser.mjs` conservan escenarios reproducibles. No se han accionado motores físicos durante esta reconstrucción.

La edición durante ejecución se contrastó con el código nativo: arrastrar detiene la ejecución que corresponde, conserva las demás tiras y mantiene las acciones temporizadas pendientes. Se verificaron cambios de parámetros, traslado entre bucles, interrupciones y cancelación de arrastre. La paleta desplaza su contenido antes de crear una instancia al salir; los desplazamientos iniciales se derivan de la cámara ortográfica y los pivotes originales.

La auditoría visual conserva capturas del ejecutable y Chromium a 1920×1080. Se corrigieron geometría de bucles, parámetros, tipografía, controles de zoom, documentación y composición del sombreado. El documento vacío coincide en su área de contenido con tolerancia RGB de 8 niveles; no se extiende esa medida al resto de pantallas. La galería `analysis/verification/comparison.html` distingue regiones medidas de comparaciones pendientes.

La auditoría de los 639 sprites detectó dos colisiones de nombres de archivo en Windows: `Export/export` y `Background/background`. El generador asigna rutas distintas; la comprobación contra extracciones aisladas no encuentra diferencias. La causa eran archivos sobrescritos, no recursos originales obsoletos ni un fallo demostrado de los atlas.

Se incorporó el lector restringido de grabaciones NRBF `Single[]` y un transporte de mensajes real entre navegadores, probado con tres perfiles aislados. La pasarela UDP del protocolo original es opcional y permanece desactivada. Sus pruebas usan un socket simulado; no demuestran interoperabilidad con otro equipo físico.

Siguen pendientes de equivalencia completa todas las combinaciones de estados y la comprobación física con motores, sensores, cámara y micrófono. El selector Bluetooth, los permisos, el cierre de pestañas y ciertos formatos de grabación dependen del navegador. La rasterización de Unity y Chromium no es idéntica. El 25/10/2026 se detectó y conectó «grupo 12», pero faltó la característica BLE `1563` y no se pudo completar la prueba de luz; el siguiente escaneo no lo detectó. No se sustituyen esas comprobaciones por resultados simulados.

Estado: reconstrucción funcional basada en recursos y código recuperados. No se declara copia exacta total ni paridad demostrada únicamente por pasar pruebas.
