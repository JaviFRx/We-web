# WeDo web

Reconstrucción de WeDo 2.0 basada en el código recuperado de la instalación local y sus recursos originales. La entrada muestra el inicio, los proyectos y el editor de programación. Estado y límites: [ESTADO-REPLICA.md](ESTADO-REPLICA.md). Procedencia y evidencia: [RECONSTRUCCION-REA.md](RECONSTRUCCION-REA.md).

## Ejecutar

1. Instala Node.js 22 o posterior.
2. Conserva el repositorio completo, incluidas `content/wedo` y `web/original-assets`.
3. Ejecuta `start.cmd` en Windows para iniciar en segundo plano, o `npm start` en una terminal.
4. Abre `http://localhost:8080/` en Chrome o Edge. Para conectar, enciende el hub y selecciónalo mediante el botón de conexión.

No hace falta instalar Unity, WeDo, REA ni paquetes npm para servir la aplicación. Después de reiniciar Windows hay que ejecutar de nuevo `start.cmd`. El servidor escucha en `127.0.0.1`; `PORT` cambia el puerto y `WEDO_CONTENT_ROOT` permite otra carpeta de contenidos. El laboratorio anterior permanece en `/lab/`.

## Funciones

En `localhost` y `127.0.0.1`, el panel usa el puente Bluetooth local: escanea automáticamente al abrirse, lista los hubs anunciándose y conecta al pulsar su fila, sin selector del navegador. El botón físico identifica su fila. Requiere Python con Bleak; en este PC ya está disponible en `tools/ble-diagnostic`. Para preparar otro Windows:

```powershell
py -3 -m venv tools/ble-diagnostic
tools\ble-diagnostic\Scripts\python.exe -m pip install bleak==3.0.2
```

`WEDO_BLE_PYTHON` permite indicar otro intérprete con Bleak instalado. El servidor inicia el proceso automáticamente al usar Bluetooth. El puente solo acepta peticiones del mismo origen local, separa las conexiones por pestaña y libera los hubs al cerrar la pestaña. `?bluetooth=web` conserva el transporte anterior para diagnóstico. En un VPS, este proceso no puede acceder al adaptador Bluetooth del PC del usuario: integrar el puente de cada PC con el dominio remoto sigue pendiente.

La aplicación conserva las 32 actividades y su visor Angular, la paleta de 25 elementos, 17 instrucciones, parámetros, tiras independientes, bucles, comentarios, zoom, ajustes con 16 idiomas e introducción. Incluye documentación con seis plantillas, imágenes, exportación JPEG/PDF, sonidos, pantalla, cámara y micrófono.

Los proyectos se guardan en IndexedDB. Los archivos `.proj` y `.wedo` mantienen los datos y medios nativos; se admite el audio antiguo `.clipdata` de tipo NRBF `Single[]` mediante un lector limitado. La edición durante ejecución sigue la parada selectiva y las esperas recuperadas del original. El adaptador Bluetooth admite hasta tres hubs y direccionamiento por puerto.

Para unir instrucciones, aproxima sus bordes de conexión durante el arrastre y suelta cuando se alineen. Para observar un color durante varios segundos, usa `Inicio → Luz (6) → Esperar (3)`: al terminar el programa, WeDo devuelve la luz al azul. Cambiar el parámetro por sí solo no ejecuta el bloque.

## Archivos

Desde el inicio:

- **Ctrl+O**: importar `.proj`, `.wedo` o `.json`. También se pueden arrastrar archivos sobre la galería.
- **Ctrl+Mayús+S**: exportar la tarjeta enfocada o el proyecto actual. En macOS se acepta Cmd.

La tarjeta de importación y el botón de exportación solo aparecen con idioma japonés en Windows, según `LobbyManager.isImportExportAvailable`. Los atajos mantienen acceso a los archivos sin añadir controles al inicio español. El icono de salida vuelve al programa: el navegador no permite cerrar una pestaña abierta por el usuario como lo hace el ejecutable nativo.

## Mensajes entre equipos

Los navegadores conectados al mismo servidor intercambian mensajes del mismo identificador de proyecto mediante HTTP/SSE. Importar el mismo proyecto conserva ese identificador. Proyectos distintos no reciben esos mensajes.

La pasarela para el protocolo UDP nativo está desactivada. `WEDO_LAN_BRIDGE=1` la habilita en el puerto 61557; requiere que el servidor esté en la LAN del programa nativo. Un VPS remoto no alcanza el aula por broadcast. En un proxy HTTPS, configura `WEDO_PUBLIC_ORIGIN` con el origen público para validar las peticiones de mensajes. El proxy debe permitir SSE sin almacenar la respuesta completa.

## Pruebas y capturas

Con el servidor iniciado:

```powershell
npm test
node scripts/verify-runtime.mjs
node scripts/audit-original-visual.mjs
node scripts/audit-all-content-browser.mjs
node scripts/audit-original-media-browser.mjs
node scripts/audit-video-integrity.mjs
node scripts/build-content-audit-gallery.mjs
```

Las pruebas de navegador usan `scripts/browser-test-support.mjs`, que localiza Playwright y Chrome; `PLAYWRIGHT_MODULE` permite indicar otra instalación. Los informes fechados se guardan en `analysis/verification/runtime`. La galería `analysis/verification/comparison.html` compara capturas nativas y web, con superposición y regiones medidas.

La galería `analysis/verification/all-content/index.html` reúne las capturas del recorrido por actividades, modelos y programas, con filtros y enlaces a los informes. La auditoría espera a que terminen las transiciones y comprueba también las imágenes de fondo. El informe de medios distingue la decodificación de audio de la lectura de metadatos de vídeo en Chrome. La comprobación adicional `audit-video-integrity.mjs` requiere FFmpeg y decodifica todos los flujos de vídeo y audio sin reproducirlos; no acredita su representación visual en cada fotograma ni la salida física de sonido. `scripts/audit-image-integrity.py` permite repetir la decodificación de imágenes con Python y Pillow.

La auditoría de recursos comprobó 639 sprites contra extracciones aisladas y corrigió colisiones de nombres en Windows. Las pruebas distinguen transportes y dispositivos simulados de conexiones HTTP reales. No acreditan motores, sensores, cámara, micrófono ni interoperabilidad UDP físicos. El 25/10/2026 se detectó y conectó «grupo 12», pero la prueba de luz falló al no encontrar la característica BLE `1563`; el siguiente escaneo no lo detectó. La rasterización, los permisos y el selector Bluetooth del navegador no son idénticos a Unity; no se declara una copia exacta total ni un despliegue terminado en el VPS.

## Investigación

REA 6.7.0 y Node 22.23.4 están aislados en `tools/rea`. `rea.cmd` ejecuta la CLI real. Se conservaron identidades SHA-256, evidencias de métodos CIL, resultados de ILSpy y extracción UnityPy; sus procedencias se documentan por separado. La ejecución web utiliza recursos locales y no busca archivos en `Program Files`. Los recursos mantienen sus avisos originales.

- REA: https://github.com/morluto/rea
- Análisis administrado: https://github.com/morluto/rea/blob/main/docs/managed-code-analysis.md
- Referencia BLE consultada: https://github.com/scratchfoundation/scratch-vm/blob/develop/src/extensions/scratch3_wedo2/index.js
