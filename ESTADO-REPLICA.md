# Estado de la reconstrucción WeDo 2.0

Actualizado el 25/10/2026. El objetivo sigue siendo la equivalencia con el programa original. La versión actual utiliza código recuperado y recursos nativos; todavía no se ha demostrado equivalencia total. La evidencia y los límites están en [RECONSTRUCCION-REA.md](RECONSTRUCCION-REA.md).

## Disponible

- Inicio y gestión de proyectos con recursos originales; ajustes con 16 idiomas, introducción animada, barra de herramientas y navegación entre lienzo, actividades, modelos, documentación y ayuda.
- Paleta original de 25 elementos, tiras independientes, parámetros, bucles, comentarios, arrastre y reglas de encaje recuperadas.
- Ejecución de las 17 instrucciones originales, teclas, motor/freno, colores discretos, sonido, pantalla y sensores. Edición durante ejecución y parada selectiva al arrastrar una tira, siguiendo el código recuperado.
- Mensajes del mismo proyecto entre navegadores mediante transporte HTTP/SSE real. Pasarela UDP opcional para comunicarse con el programa nativo desde un servidor dentro de su LAN.
- Teclados originales de números, colores, fondos y sonidos; direccionamiento mediante pulsación larga y hasta tres hubs.
- Documentación Angular original con seis plantillas, formato de texto, medios y exportación.
- Importación/exportación `.proj` y `.wedo`, medios incluidos, duplicación conservando referencias y guardado IndexedDB. Los proyectos antiguos se migran sin borrar localStorage. Grabaciones antiguas `.clipdata` compatibles con el formato NRBF `Single[]`, leído sin deserialización general.
- Cámara, vídeo y captura del lienzo; sensor de sonido con el cálculo recuperado del original.
- Las 32 actividades y sus recursos locales. El visor usa las alturas originales Full/Half/Quarter; las páginas parciales dejan el lienzo accesible debajo.

## Ejecutar

`start.cmd`, o `npm start`, sirve la aplicación en `http://localhost:8080/`. El proceso actual está en segundo plano. No hay inicio automático después de reiniciar Windows. Para Bluetooth, usar Chrome con permisos y Bluetooth del PC activos. El servidor escucha en 127.0.0.1; el despliegue en VPS requiere HTTPS y un proxy inverso.

Los contenidos y recursos recuperados están incluidos en `content/wedo` y `web/original-assets`. La ejecución web no necesita la instalación de Unity ni las herramientas de investigación. El antiguo laboratorio sigue en `/lab/` y no es la copia original.

## Validación y pendientes

Modo local actual: Node inicia `scripts/local-ble-worker.py` mediante Python/Bleak y comparte descubrimiento y notificaciones por SSE, con comandos HTTP del mismo origen. Abrir el panel inicia el escaneo real; cerrar el panel detiene la búsqueda, y cerrar la pestaña libera sus conexiones. No se llama a `requestDevice` ni se muestran controles de autorización en localhost. La fila conecta usando GATT nativo y conserva el intérprete y protocolo WeDo existentes. Prueba de integración con proceso simulado, 3 pruebas del trabajador Python y 88 pruebas de Node pasan. El escaneo real de Windows se inició correctamente, pero no encontró hubs en los 8,5 segundos observados; no se declara verificación física de conexión/luz en esta tanda. Evidencia: `analysis/verification/local-bluetooth`. Integración con el VPS pendiente: el adaptador está en el PC, no en el servidor remoto.

Corregida la alineación de las tiras: se conserva la línea inferior de los cuerpos de los bloques, excluyendo los parámetros. Los bucles más altos crecen hacia arriba; añadirlos o separarlos mantiene la posición del bloque de inicio existente. La detección de proximidad y la previsualización usan esa misma referencia inferior. Comprobado con inicio, bucle, luz interior y continuación, recarga y zoom al 150 %. Capturas en `analysis/verification/loop-baseline`.

Regresión posterior corregida: cuando `getDevices` no existe, devuelve una lista vacía o falla, el panel explica el estado y el botón de actualizar vuelve a permitir buscar mediante el selector del navegador. Se recuperó «Buscar todos los dispositivos» para anuncios que no coinciden con el filtro WeDo. Los hubs conocidos siguen conectando desde su fila y actualizar no abre el selector cuando ya hay dispositivos listados. Se aceptan permisos guardados tanto del servicio principal como del servicio de entrada/salida. Prueba específica: `scripts/check-bluetooth-discovery-fallback-browser.mjs`, cuatro escenarios con transporte simulado.

El panel Bluetooth lista los hubs que el navegador ya ha autorizado. Actualizar y seleccionar una fila conocida no abren el selector; la autorización de un hub nuevo queda en una acción explícita. Se incorporó la notificación del botón físico `1526`, separada de las notificaciones de sensores: resalta únicamente la fila del hub pulsado con `connectionHubDialogHighligthedFrame` y restaura su aspecto al soltar. Los marcos de dispositivo conocido, conectando y conectado siguen `UI.DetectedDevice`; los dispositivos desconectados ya no usan por error el marco verde de conexión. La prueba de navegador verifica estos estados con dos hubs simulados. Una web no puede descubrir dispositivos nunca autorizados sin el permiso del navegador; reproducir el descubrimiento nativo completo requiere un componente local.

Corrección del encaje del 25/10/2026: las instrucciones se unen por proximidad de los bordes de conexión, con previsualización alineada y tolerancia adaptada al zoom, sin exigir que el cursor esté encima del bloque destino. Los bloques alejados quedan separados. Se mantienen las restricciones de inicio y bucles; la tolerancia web de 24 × 32 unidades todavía no constituye una reproducción medida de todos los colliders nativos.

La escritura BLE prefiere ahora `WriteWithoutResponse` cuando está disponible, como `BluetoothIo` en el SDK recuperado, y conserva escritura con respuesta para características que solo admiten esa operación. La nueva prueba completa editor → intérprete → GATT comprueba UUID, formato, color editado, espera, continuación de pantalla y errores de escritura visibles. Pasan 88 pruebas unitarias y los recorridos de proximidad/comandos, editor, gestos y Bluetooth. Evidencia: `analysis/verification/proximity-commands`. El periférico de estas pruebas es simulado: no resuelve por sí solo el fallo comunicado en el hub real.

Las pruebas de unidad y navegador cubren ejecución, archivos nativos, IndexedDB con medios grandes, documentación, cámara y Bluetooth simulado, múltiples hubs, encajes, navegación y parámetros. Incluyen arrastre de la cola completa, cancelación, desplazamiento de paleta, zoom persistente, comentarios y transporte real de mensajes entre tres perfiles aislados. Los scripts usan `scripts/browser-test-support.mjs` para localizar Playwright y Chrome.

La galería local `analysis/verification/comparison.html` permite comparar capturas nativas con la web. Hay mediciones de pantalla, bucles, foco de selección y documentación a 1920×1080. La auditoría de recursos compara los 639 sprites con extracciones aisladas; corrigió colisiones de rutas en Windows. Pasar pruebas o medir una región no demuestra identidad de todas las pantallas.

El recorrido adicional del 25/10/2026 comprobó 122 proyectos (32 actividades, 48 modelos y 42 programas), 500 páginas y 464 recursos, sin errores JavaScript, HTTP ni de carga detectados. Las 500 capturas se toman después de terminar las transiciones y cargar imágenes, incluidas las de fondo. El índice filtrable está en `analysis/verification/all-content/index.html`. Se cubren 11 tipos de plantilla, pero no todos los pasos internos de las presentaciones ni todas las interacciones de cada página.

También pasan la decodificación de 2.711 imágenes con Pillow, los 28 sonidos y los metadatos de 29 vídeos en Chrome. FFmpeg decodificó además los flujos completos de los 29 vídeos sin errores. Los informes están en `analysis/verification/media`. No se reprodujo sonido ni se utilizó cámara, micrófono o hub para estas comprobaciones; decodificar los medios no demuestra identidad visual con Unity.

Anteriormente se comprobó la conexión GATT física al hub «grupo 12» y la aceptación de escrituras de luz. La prueba más reciente, del 25/10/2026, detectó y conectó el hub, pero falló al buscar la característica BLE `1563`, antes de escribir la luz. El resultado está en `analysis/verification/hardware/latest-physical-check.json`. No se han probado motores ni sensores físicos durante esta reconstrucción. Las pruebas simuladas no certifican comportamiento físico ni igualdad visual completa.

Quedan por comprobar físicamente motores, sensores, cámara, micrófono y la pasarela UDP con otro equipo nativo. Los últimos escaneos locales no detectaron el hub. La pasarela UDP está desactivada; un VPS remoto no alcanza la LAN del aula mediante broadcast. El selector Bluetooth y los permisos son propios del navegador. Persisten diferencias de rasterización entre Unity y Chromium y no se han contrastado todas las combinaciones posibles de estados. No se declara una copia exacta total ni un despliegue terminado en el VPS.
