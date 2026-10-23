# WeDo Lab

**Cambio de objetivo: copia exacta del original.** La entrada `http://localhost:8080/` muestra ahora el visor original de actividades instalado en este PC. El prototipo descrito más abajo se conserva en `http://localhost:8080/lab/`. Estado y pendientes de la réplica: [ESTADO-REPLICA.md](ESTADO-REPLICA.md).

Ejecuta `start.cmd` para iniciar el servidor en segundo plano. No necesitas mantener su ventana abierta. El servidor se deja activo para usar la aplicación; después de reiniciar Windows, ejecuta de nuevo `start.cmd`.

Primera versión independiente de un taller web para WeDo 2.0. Investigación del programa instalado mediante REA; interfaz y motor de ejecución propios. No es una conversión completa del programa LEGO.

## Abrir

1. Ejecuta `E:\Wedo\start.cmd` y mantén esa ventana abierta.
2. Abre http://localhost:8080 en Chrome o Edge.
3. Pulsa **Iniciar** para probar el ejemplo en el simulador.

El servidor solo escucha en este PC (127.0.0.1). No hay cuentas, servicios externos ni publicación en Internet. La web no requiere instalación de dependencias: `npm start` también sirve si tienes Node. Para detener el servidor, pulsa Ctrl+C en su ventana.

## Funciones disponibles

- Añadir, editar, ordenar y eliminar bloques de motor, luz y espera.
- Repetir toda la secuencia con un bloque final; no hay bucles anidados.
- Simulación visual de comandos, ejecución y parada. Cada ejecución tiene un límite de 60 segundos y se cancela al ocultar la pestaña.
- Biblioteca de hasta 200 proyectos: crear, buscar, abrir, renombrar, duplicar y eliminar. Migración automática del proyecto de la versión anterior.
- Descargar y abrir copias `.wedoweb.json`, incluyendo notas y progreso de actividades. Los archivos se importan como proyectos nuevos.
- Seis actividades propias con programa inicial, cuatro pasos marcables y cuaderno de observaciones. Filtro por nivel.
- Catálogo de referencia de las 32 actividades detectadas en el original; las lecciones originales completas no están recreadas.
- Protección ante datos locales corruptos, falta de espacio y cambios desde otra pestaña: se muestra el error y no se sobrescriben datos en conflicto. Los proyectos solo están en ese navegador; descarga copias para conservarlos fuera de él.
- Adaptador Web Bluetooth experimental: selección del hub, motor en puerto 1 o 2 y luz RGB.

Para probar el hardware, enciende el hub, pulsa **Conectar hub**, selecciónalo y elige el puerto que contiene el motor. La aplicación cambia a **Hub real** al conectar. Se envía potencia directa de −100 a 100; valores pequeños pueden no mover el motor. La visualización muestra comandos, no telemetría. Una pérdida de conexión o el cierre del navegador no garantiza entregar la orden de parada: esta primera versión no implementa un watchdog en el hub.

## Estado y límites

Bluetooth real no probado con hardware. Sensores de distancia e inclinación, sonido, mensajes, actividades educativas, múltiples tiras y proyectos originales `.proj` pendientes. La apariencia, repetición de secuencia y modelo de proyecto web son decisiones de esta implementación: no se ha demostrado equivalencia con la aplicación original. Los recursos visuales del original no se incluyen.

Web Bluetooth requiere un navegador compatible y un contexto seguro; localhost permite el desarrollo local. Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API

## REA instalado y utilizado

REA 6.7.0 y Node 22.23.4 están aislados en `tools/rea`, con lockfile npm. No se ha registrado un servidor MCP ni modificado la configuración global de Codex; se utilizó la CLI real.

```powershell
.\rea.cmd --help
powershell -ExecutionPolicy Bypass -File .\scripts\analyze.ps1
```

El script lee únicamente las DLL seleccionadas y conserva resultados completos en `analysis`. `analysis/findings.json` resume identidades SHA-256, Evidence IDs y límites. No ejecutar el script es necesario para usar la web.

Objetivo observado: `C:\Program Files (x86)\WeDo 2.0\WeDo 2.0_Data\Managed`. REA identificó Unity/Mono CIL. Las dos DLL analizadas declaran tipos de instrucciones y servicios de motor/sensores; cobertura estática completa según el proveedor no implica cobertura funcional completa del producto.

Referencias:

- REA: https://github.com/morluto/rea
- Análisis .NET: https://github.com/morluto/rea/blob/main/docs/managed-code-analysis.md
- Referencia de interoperabilidad BLE (UUID, paquetes, modo RGB): https://github.com/scratchfoundation/scratch-vm/blob/develop/src/extensions/scratch3_wedo2/index.js . Se consultaron constantes y formato del protocolo; no se incorporó la implementación de Scratch ni sus imágenes.

## Validación

`npm test`: cinco pruebas de validación, codificación BLE, repetición, cancelación y parada ante errores.

`scripts/check-browser.mjs`: prueba con Playwright de carga, persistencia, añadir bloques, iniciar/parar, intento sin hub y anchura móvil; necesita el servidor iniciado y un módulo Playwright disponible. En este PC se usó el Playwright ya instalado en `E:/CodeAdventur/node_modules/playwright-core` mediante la variable `PLAYWRIGHT_MODULE`. No es una dependencia de la aplicación. Capturas en `analysis/web-desktop.png` y `analysis/web-mobile.png`.

Próximas validaciones: conexión con un hub físico y motor, contraste de semántica de bloques con el original, implementación de sensores y compatibilidad de proyectos. No se ha publicado la web.

## Actividades y proyectos (ampliación)

`scripts/check-library-browser.mjs` verifica migración del proyecto anterior, filtros, apertura de actividades, notas y progreso tras recargar, duplicación, renombrado, búsqueda, eliminación, móvil, conflictos entre pestañas y conservación de almacenamiento corrupto. Comprobaciones realizadas con éxito, además de las pruebas previas del editor.

Inventario local en `analysis/activities-findings.json`: 32 actividades, 122 archivos de metadatos, 70 declaraciones de métodos relacionados con proyectos vinculadas a Evidence de REA. Los metadatos educativos se inspeccionaron leyendo los archivos locales; no se atribuyen a una ejecución de REA. Las guías propias no incluyen instrucciones de montaje ni imágenes oficiales.
