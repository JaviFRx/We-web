# Objetivo: copia exacta de WeDo 2.0 en el navegador

La implementación WeDo Lab anterior es un prototipo distinto del original. No satisface el requisito de copia exacta. Se conserva en `/lab/`, con sus proyectos locales, como referencia de implementación; ya no es la página inicial.

## Disponible ahora

- `http://localhost:8080/` abre el visor original de contenidos en `/original/#/library`.
- Se sirven los archivos incluidos en `content/wedo`, con imágenes, traducciones y vídeos. El servidor no depende de WeDo instalado; basta con Node.js 22 o posterior y una copia completa del proyecto.
- Se conservan HTML, Angular, CSS, traducciones e imágenes del visor original. La adaptación elimina en memoria el reemplazo ActiveX de XMLHttpRequest y sustituye el canal de mensajes Unity por un adaptador local para ruta, idioma y navegación del visor.
- Se han abierto las 32 actividades con sus plantillas sin errores JavaScript ni HTTP observados; se verificó avanzar en la lección Fuerzas. No equivale a verificar cada página, vídeo, modelo o interacción de todas las lecciones.
- El servidor permanece en segundo plano. `start.cmd` comprueba si responde y lo inicia si es necesario. Tras reiniciar Windows hay que volver a ejecutarlo. No hay inicio automático configurado.

## Pendiente para equivalencia completa

- Pantalla de inicio y gestión de proyectos con la apariencia y comportamiento originales.
- Editor Unity: geometría, iconos, conexiones y arrastre de bloques, parámetros, zoom, múltiples tiras y comentarios.
- Semántica de todas las instrucciones originales, mensajes, sonido, sensores y ejecución concurrente.
- Puente entre actividades y editor; cualquier acción que dependa de Unity no debe considerarse implementada por cargar el visor.
- Importación/exportación `.proj` y equivalencia de guardado. Los recursos multimedia del visor están incluidos; esto no implementa las funciones del editor Unity.
- Validación física de hub, motor, luz y sensores.

No se afirma haber convertido el ejecutable Unity a una web ni haber completado una réplica exacta. El visor de actividades es solo una parte del producto.

## Pruebas

`scripts/check-original-browser.mjs`, con Playwright disponible, comprueba redirección inicial, las 32 rutas de actividades, navegación de una lección, errores JS/HTTP, respuestas parciales para medios y rechazo de rutas externas. Lee el catálogo servido por la web, sin necesitar informes locales de `analysis`. `WEDO_TEST_URL` permite probar otro puerto. `tests/portable.test.mjs` arranca el servidor desde otra carpeta, sin `WEDO_CONTENT_ROOT`, y comprueba el catálogo y un rango de vídeo incluido. Los recursos se leen exclusivamente bajo la raíz de contenidos. La escucha sigue limitada a 127.0.0.1.
