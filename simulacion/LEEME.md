# Dispositivo de comunicación familiar – Simulación (entrega 1)

Simulación en **Wokwi** de NEXO, un asistente de mesa para adultos mayores. Recibe audios y recordatorios de la familia, avisa con luz y sonido, y permite responder con la voz apretando un solo botón.

## Archivos

| Archivo | Qué es |
|---|---|
| `sketch/sketch.ino` | Programa principal en C++, comentado por bloques |
| `sketch/fuentes.h` | Tipografías con tildes y números grandes (son datos, no hace falta leerlas) |
| `sketch/diagram.json` | Circuito de Wokwi: componentes y cables |
| `sketch/libraries.txt` | Librerías que Wokwi tiene que instalar |
| `herramientas/generar_diagrama.py` | Script que generó `diagram.json` (opcional) |
| `vista_previa_pantallas.png` | Cómo se ve cada pantalla |

## Cargarlo en Wokwi (unos 10 minutos)

1. Entrá a **wokwi.com** con tu cuenta y elegí **New Project → ESP32**.
2. En la pestaña **sketch.ino**, borrá todo y pegá el contenido de `sketch/sketch.ino`.
3. En la pestaña **diagram.json**, borrá todo y pegá el contenido de `sketch/diagram.json`. El circuito aparece armado a la derecha.
4. Agregá la fuente de letras: tocá la flechita ▾ al lado de las pestañas, elegí **New file…**, nombrala exactamente `fuentes.h` y pegá el contenido de `sketch/fuentes.h`. Es un archivo largo y es normal.
5. Agregá las librerías: tocá la flechita ▾, elegí **New file…**, nombrala `libraries.txt` y pegá estas 4 líneas:
   ```
   Adafruit GFX Library
   Adafruit ILI9341
   Adafruit NeoPixel
   ArduinoJson
   ```
   Otra forma es usar el botón **Library Manager** y buscar cada una.
6. Tocá **▶ (Start)**. La primera compilación tarda 1 o 2 minutos.
7. Tocá **Save** y después **Share**. Copiá el enlace público: es el que pide la consigna.

> **Orientación de la pantalla:** ya viene corregida (`ROTACION_PANTALLA = 3`). Si alguna vez se ve dada vuelta, se cambia por `1`.

## Cómo probarlo

**Botones:** se aprietan con el mouse o con el teclado, haciendo clic primero sobre el circuito.

| Botón | Tecla | Función |
|---|---|---|
| Blanco – HABLAR | `H` | **Tocar:** muestra la lista (cada familiar, "Toda la familia", "Pedir que me llamen") y cada toque pasa a la siguiente opción. **Mantener:** graba un audio (hasta 60 s) para la persona que se ve en pantalla. Desde el reloj, mantener le responde al último que escribió. |
| Verde – ESCUCHAR / CONFIRMAR | `V` | Escucha el audio, confirma la medicación o cierra avisos |
| Rojo – SOS | `S` (mantener 3 s) | Pide ayuda: avisa a la familia por WhatsApp y/o Telegram |

**Monitor Serie** (abajo): escribir y apretar Enter. Reemplaza a la nube hasta la entrega 2.

| Comando | Qué simula |
|---|---|
| `audio` | Llega un audio de Mamá |
| `audio Abuelo` | Llega un audio de otra persona |
| `med`, `med 2`, `med 3` | Recordatorio de medicación (1: texto y audio · 2: solo texto · 3: solo audio) |
| `cumple`, `cumple 3` | Aviso de cumpleaños (1-2: familia, se los puede saludar con un audio · 3-4: otras personas, solo recordatorio) |
| `inactivo` | Fuerza el aviso por falta de uso |
| `silencio` | Activa o desactiva el modo silencioso (solo luz) |
| `estado` | Muestra el estado interno |

**Sensor de luz:** hacé clic en el sensor y bajá los lux a menos de 8. La pantalla pasa a modo noche (colores atenuados, halo más tenue y sin sonidos que no sean urgentes).

### Guion sugerido para la demo (3 minutos)

1. Mostrar la pantalla de reposo: día, fecha, hora y clima reales de Buenos Aires.
2. Escribir `audio`: el halo pulsa en azul, suena el aviso y aparece "Audio nuevo de Mamá".
3. Apretar **V** para escucharlo: el halo y la barra muestran el avance. En el Monitor Serie aparece "✓✓ escuchado" (doble tilde).
4. Mantener **H** unos segundos y soltar: el halo se llena mientras graba y el audio se envía a quien escribió.
5. Tocar **H** varias veces: van apareciendo los nombres en grande, cada uno con su color. En "Pedir que me llamen", mantener **H**: la familia recibe el pedido.
6. Escribir `med`: halo naranja y nombre del remedio. Esperar 1 minuto sin confirmar para mostrar el aviso a la familia, o apretar **V** para confirmar.
7. Mantener **S** 3 segundos: el halo se llena en rojo y se dispara el SOS.
8. Bajar la luz del sensor: modo noche.

## Conexiones

| Componente | Pin del ESP32-S3 |
|---|---|
| Pantalla ILI9341 | CS 10 · MOSI 11 · SCK 12 · MISO 13 · DC 9 · RST 14 · LED 21 · VCC 3V3 |
| Botón HABLAR / CONFIRMAR / SOS | 39 / 40 / 41 (el otro extremo a GND) |
| Halo (16 LEDs WS2812B) | DIN 42 · alimentación 5 V |
| Sensor de luz (LDR) | AO → 1 |
| Buzzer (solo simulación) | 7 |
| Micrófono INMP441 (solo prototipo físico) | SCK 4 · WS 5 · SD 6 |
| Amplificador MAX98357A (solo prototipo físico) | BCLK 15 · LRC 16 · DIN 17 |

## Limitaciones que hay que declarar

- **Wokwi no tiene micrófono ni parlante.** El parlante se reemplaza por un buzzer, y la grabación y la reproducción se representan con el tiempo, el halo y la barra de progreso. En el prototipo físico se usan el INMP441 y el MAX98357A, y los pines ya quedaron reservados.
- **No hay nube todavía.** Los audios y recordatorios se simulan con comandos del Monitor Serie. En la entrega 2, Firebase y la PWA ocupan ese lugar y el resto del código no cambia.
- **Avisos a la familia (WhatsApp y Telegram):** sin configurar, los avisos se muestran solo en el Monitor Serie. Si se cargan los datos en `familia[]` y `TELEGRAM_TOKEN`, se envían de verdad. Se usan dos canales para que, si uno falla, el otro avise igual.
  - **WhatsApp:** usa CallMeBot, que es gratuito pero no oficial. Al momento de esta entrega el servicio no aceptaba usuarios nuevos ("bot lleno"): es justamente el riesgo que motivó agregar un segundo canal.
  - **Telegram:** usa la API oficial de bots de Telegram, que es gratuita y no tiene cupos.
  - **No guardar claves reales** en el proyecto público de Wokwi ni en GitHub.
- **Tiempos acortados para la demo** (`MODO_SIMULACION 1`): la medicación avisa a la familia al minuto y la inactividad a los 5 minutos. En uso real son 20 minutos y 6 horas.
- **HTTPS sin verificar el certificado** (`setInsecure`), por simplicidad. En un producto real se valida el certificado.

## Subir a GitHub

1. En **github.com** tocá **New repository**. Ponele un nombre (por ejemplo `proyecto-integrador`), elegí **Public** y tildá **Add a README**.
2. Dentro del repositorio tocá **Add file → Upload files**, arrastrá la carpeta completa y tocá **Commit changes**.
3. Cada mejora que hagan, súbanla de la misma forma con un mensaje que diga qué cambió (por ejemplo "Agrega aviso de cumpleaños"). Ese historial es el "versionado" que pide la consigna.
