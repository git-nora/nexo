/* ============================================================================
   PROYECTO INTEGRADOR - Dispositivo de comunicación familiar por voz
   (nombre del producto a definir)
   ----------------------------------------------------------------------------
   Público: adultos mayores a los que les cuesta usar el celular.
   La familia manda audios y recordatorios desde una PWA; el dispositivo
   avisa con luz (halo de LEDs) y sonido, y la persona responde con su voz
   apretando un solo botón.

   Placa: ESP32-S3 DevKitC-1 (N16R8)       Lenguaje: C++ (Arduino)
   Pantalla: TFT 2,8" ILI9341 320x240 (horizontal)

   ---- ESTA VERSIÓN: SIMULACIÓN EN WOKWI (entrega 1) ----
   Funciona de verdad: hora por internet (NTP), clima real (Open-Meteo),
   pantalla, 3 botones, halo de 16 LEDs, sonidos, sensor de luz (LDR),
   recordatorios de medicación, cumpleaños, SOS y aviso por inactividad.

   Lo que todavía NO existe (entrega 2): Firebase y la PWA. Mientras tanto,
   la llegada de audios y recordatorios se simula escribiendo comandos en
   el Monitor Serie (escribir "ayuda" para ver la lista).

   Limitaciones de Wokwi: no tiene micrófono ni parlante. En la simulación
   el parlante se reemplaza por un buzzer y la grabación se representa con
   el temporizador y el halo. En el prototipo físico se usan el micrófono
   INMP441 y el amplificador MAX98357A (pines ya reservados más abajo).

   Conexiones (ver diagram.json):
     Pantalla ILI9341 : CS=10  MOSI=11  SCK=12  MISO=13  DC=9  RST=14  LED=21
     Botón HABLAR     : GPIO 39 (el otro extremo a GND)
     Botón CONFIRMAR  : GPIO 40 (el otro extremo a GND)
     Botón SOS        : GPIO 41 (el otro extremo a GND)
     Halo WS2812B     : DIN=42 (16 LEDs)
     Sensor de luz    : GPIO 1 (entrada analógica)
     Buzzer           : GPIO 7 (solo simulación)
     Micrófono INMP441: SCK=4  WS=5  SD=6      (solo prototipo físico)
     Amp. MAX98357A   : BCLK=15 LRC=16 DIN=17  (solo prototipo físico)
   ============================================================================ */


/* ============================================================================
   1. LIBRERÍAS
   ============================================================================ */
#include <WiFi.h>              // Conexión a la red Wi-Fi (incluida en el ESP32)
#include <WiFiClientSecure.h>  // Conexiones seguras HTTPS (clima y WhatsApp)
#include <HTTPClient.h>        // Hacer pedidos web (GET) de forma sencilla
#include <time.h>              // Manejo de fecha y hora (struct tm, NTP)
#include <SPI.h>               // Bus SPI que usa la pantalla
#include <Adafruit_GFX.h>      // Funciones de dibujo: texto, círculos, rectángulos
#include <Adafruit_ILI9341.h>  // Controlador específico de la pantalla ILI9341
#include <Adafruit_NeoPixel.h> // Control de los LEDs WS2812B del halo
#include <ArduinoJson.h>       // Leer la respuesta del servicio de clima (JSON)
#include "fuentes.h"           // Nuestras tipografías con tildes (ver archivo)


/* ============================================================================
   2. CONFIGURACIÓN GENERAL
   Todo lo que se puede ajustar sin tocar la lógica del programa.
   ============================================================================ */

// 1 = simulación (tiempos cortos para mostrarle a Facu)
// 0 = uso real (tiempos reales)
#define MODO_SIMULACION 1

// --- Red Wi-Fi --- (red abierta "Wokwi-GUEST" para simulación)
const char* WIFI_NOMBRE = "Wokwi-GUEST";
const char* WIFI_CLAVE  = "";

// --- Hora --- Argentina: UTC-3 sin horario de verano.
// En formato POSIX el signo va invertido: "<-03>3" significa UTC-3.
const char* ZONA_HORARIA = "<-03>3";

// --- Ubicación para el clima --- (en la entrega 2 se carga desde la PWA)
const char* CIUDAD   = "Ciudad de Buenos Aires";
const float LATITUD  = -34.6037;
const float LONGITUD = -58.3816;

// --- Usuario del dispositivo ---
const char* NOMBRE_USUARIO = "Nora";   // Aparece en los avisos a la familia

// --- Familia que recibe los avisos (SOS, medicación, inactividad) ---
// Se usan DOS canales para que, si uno falla, el otro avise igual:
//   * WhatsApp, mediante el servicio gratuito CallMeBot (no oficial).
//     Cada familiar lo activa una vez y recibe su "apikey".
//   * Telegram, mediante la API oficial de bots de Telegram.
//     Se crea un bot con @BotFather (da el TOKEN) y cada familiar
//     le escribe /start al bot; su número de chat se obtiene con @userinfobot.
// Lo que quede vacío ("") no se usa. Si un familiar no tiene ningún canal
// configurado, el aviso solo se muestra en el Monitor Serie (simulado).

const char* TELEGRAM_TOKEN = "";  // NO subir el token real a GitHub;   // Ej: "123456789:AAH...", lo entrega @BotFather

struct Contacto {
  const char* nombre;         // Nombre para mostrar
  const char* telefono;       // WhatsApp con código de país, ej: "+5491112345678"
  const char* apikey;         // Clave que entrega CallMeBot
  const char* telegramChat;   // Número de chat de Telegram, ej: "123456789"
};
Contacto familia[] = {
  // nombre   WhatsApp  apikey  Telegram
  { "Nora",   "",       "",     "" },
  { "Andrés",   "",       "",   "" },
};
const int CANTIDAD_FAMILIARES = sizeof(familia) / sizeof(familia[0]);

// --- Tiempos (en milisegundos) ---
const unsigned long DURACION_MAX_GRABACION_MS = 60UL * 1000;  // Audio de hasta 1 minuto
const unsigned long DURACION_MIN_GRABACION_MS = 1000;         // Menos de 1 s = toque accidental
const unsigned long TIEMPO_SOS_MS             = 3000;
const unsigned long TIEMPO_MANTENER_MS        = 500;          // Botón blanco: más de 0,5 s = "mantener"
const unsigned long TIEMPO_SELECCION_MS       = 10UL * 1000;  // La lista de nombres se cierra sola         // Mantener SOS 3 segundos
const unsigned long TIEMPO_ANTIRREBOTE_MS     = 30;           // Filtro de rebote de botones
const unsigned long INTERVALO_CLIMA_MS        = 15UL * 60 * 1000; // Clima cada 15 minutos
const unsigned long INTERVALO_REPETIR_MED_MS  = 30UL * 1000;  // Repetir sonido de medicación
const unsigned long TIEMPO_AVISO_AUDIO_MS     = 30UL * 1000;  // Tarjeta "audio nuevo" visible
const unsigned long TIEMPO_AVISO_CUMPLE_MS    = 2UL * 60 * 1000;
const unsigned long TIEMPO_PANTALLA_SOS_MS    = 15UL * 1000;
#if MODO_SIMULACION
const unsigned long ESPERA_CONFIRMACION_MED_MS = 60UL * 1000;      // Demo: 1 minuto
const unsigned long LIMITE_INACTIVIDAD_MS      = 1UL * 60 * 1000;  // Demo: 1 minutos
#else
const unsigned long ESPERA_CONFIRMACION_MED_MS = 20UL * 60 * 1000;      // Real: 20 minutos
const unsigned long LIMITE_INACTIVIDAD_MS      = 6UL * 60 * 60 * 1000;  // Real: 6 horas
#endif
const int HORA_INICIO_CONTROL_INACTIVIDAD = 8;   // Solo se controla de 8 a 21 h
const int HORA_FIN_CONTROL_INACTIVIDAD    = 21;
const int HORA_AVISO_CUMPLE               = 9;   // Los cumpleaños se avisan desde las 9 h

// --- Sensor de luz (LDR) ---
// Lectura de 0 a 4095: cuanto MÁS oscuro, MAYOR es el valor.
// Se usan dos umbrales distintos (histéresis) para que no "titile"
// entre modo día y modo noche cuando la luz está justo en el límite.
const int UMBRAL_NOCHE = 3500;   // Más de esto: se considera de noche (~8 lux)
const int UMBRAL_DIA   = 3000;   // Menos de esto: vuelve a modo día (~25 lux)

// --- Brillo ---
const int   BRILLO_PANTALLA_DIA   = 255;  // 0 a 255 (PWM de la luz de fondo)
const int   BRILLO_PANTALLA_NOCHE = 40;
const float BRILLO_HALO_DIA       = 0.50; // 50 % del máximo (cuida consumo y vista)
const float BRILLO_HALO_NOCHE     = 0.12;


/* ============================================================================
   3. PINES
   ============================================================================ */
const int PIN_TFT_CS   = 10;  // Selección de la pantalla (SPI)
const int PIN_TFT_DC   = 9;   // Dato/Comando de la pantalla
const int PIN_TFT_RST  = 14;  // Reinicio de la pantalla
const int PIN_TFT_MOSI = 11;  // Datos hacia la pantalla (SPI)
const int PIN_TFT_SCK  = 12;  // Reloj del SPI
const int PIN_TFT_MISO = 13;  // Datos desde la pantalla (SPI)
const int PIN_TFT_LUZ  = 21;  // Luz de fondo (brillo por PWM)

const int PIN_BOTON_HABLAR    = 39;  // Botón grande de arriba
const int PIN_BOTON_CONFIRMAR = 40;  // Botón verde: escuchar / confirmar
const int PIN_BOTON_SOS       = 41;  // Botón rojo: SOS

const int PIN_HALO   = 42;  // Datos de la tira WS2812B
const int PIN_LDR    = 1;   // Sensor de luz (ADC1, funciona con Wi-Fi activo)
const int PIN_BUZZER = 7;   // Sonido en la simulación

// Reservados para el prototipo físico (no se usan en Wokwi):
const int PIN_MIC_SCK = 4, PIN_MIC_WS = 5, PIN_MIC_SD = 6;      // INMP441
const int PIN_AMP_BCLK = 15, PIN_AMP_LRC = 16, PIN_AMP_DIN = 17; // MAX98357A

const int CANTIDAD_LEDS_HALO = 16;
const int ANCHO_PANTALLA = 320;
const int ALTO_PANTALLA  = 240;
const int ROTACION_PANTALLA = 3;  // Horizontal (con 1 se ve dada vuelta en Wokwi)


/* ============================================================================
   4. COLORES
   Pantalla: formato RGB565 (16 bits).  Halo: formato 0xRRGGBB (24 bits).
   ============================================================================ */
const uint16_t COLOR_FONDO         = 0x0000;  // Negro
const uint16_t COLOR_TEXTO         = 0xFFFF;  // Blanco
const uint16_t COLOR_TEXTO_SUAVE   = 0xB5D7;  // Gris claro (fecha)
const uint16_t COLOR_AYUDA         = 0x5B0C;  // Gris oscuro (indicaciones)
const uint16_t COLOR_HORA          = 0x4E9C;  // Celeste 
const uint16_t COLOR_NOCHE_TEXTO   = 0x6B8F;  // Versiones atenuadas de noche
const uint16_t COLOR_NOCHE_HORA    = 0x2BF0;
const uint16_t COLOR_AZUL          = 0x3C1E;
const uint16_t COLOR_NARANJA       = 0xF4E1;
const uint16_t COLOR_VERDE         = 0x262B;
const uint16_t COLOR_ROJO          = 0xEA28;
const uint16_t COLOR_AMARILLO      = 0xFE62;
const uint16_t COLOR_NUBE          = 0xCEBC;
const uint16_t COLOR_GOTA          = 0x653F;
const uint16_t COLOR_BARRA_FONDO   = 0x2966;
// Un color distinto para cada familiar (pantalla y halo), así se reconoce sin leer
const uint16_t COLOR_PERSONAS[] = { 0x9AFF, 0x1655, 0xFAD2, 0xFD84 };  // Violeta, turquesa, rosa, ámbar

const uint32_t HALO_AZUL    = 0x2060FF;  // Audio nuevo / reproduciendo
const uint32_t HALO_NARANJA = 0xFF6A00;  // Medicación
const uint32_t HALO_VERDE   = 0x00D040;  // Cumpleaños / confirmado
const uint32_t HALO_ROJO    = 0xFF0000;  // SOS
const uint32_t HALO_BLANCO  = 0xC0E0FF;  // Grabando
const uint32_t HALO_CELESTE = 0x00C8D0;  // Enviando
const uint32_t HALO_PERSONAS[] = { 0x9B5CFF, 0x14C8A8, 0xFF5A96, 0xFFB020 };  // Mismos colores que arriba


/* ============================================================================
   5. TIPOS DE DATOS PROPIOS
   ============================================================================ */

// Estados de la "máquina de estados": el dispositivo siempre está en
// UNO de estos estados, y cada estado define qué se ve y qué hace cada botón.
enum Estado {
  REPOSO,             // Reloj, fecha y clima
  AVISO_AUDIO,        // Llegó un audio y todavía no se escuchó
  REPRODUCIENDO,      // Escuchando un audio
  GRABANDO,           // Botón HABLAR apretado: grabando respuesta
  ENVIANDO,           // Subiendo el audio grabado
  RECORDATORIO_MED,   // Hora de tomar una medicación
  AVISO_CUMPLE,       // Hoy cumple años alguien de la familia
  SOS_ACTIVO,         // Se pidió ayuda
  MENSAJE_TEMPORAL,   // Cartel breve (ej: "Audio enviado") que se va solo
  ELIGIENDO           // Lista de nombres: a quién mandarle un audio o pedir que llamen
};

// Qué puede pasar con un botón en cada vuelta del loop()
enum EventoBoton { SIN_EVENTO, SE_PRESIONO, SE_SOLTO };

// Cómo se muestra un recordatorio de medicación (lo elige la familia)
enum ModoAviso { SOLO_TEXTO, SOLO_AUDIO, TEXTO_Y_AUDIO };

// Íconos que sabe dibujar la pantalla
enum Icono { ICONO_AUDIO, ICONO_MICROFONO, ICONO_PASTILLA, ICONO_TORTA,
             ICONO_SOS, ICONO_OK, ICONO_ENVIO, ICONO_ALERTA, ICONO_SILENCIO, ICONO_SONIDO,
             ICONO_PERSONA, ICONO_FAMILIA, ICONO_TELEFONO };

// Qué se interpretó del botón blanco: un toque corto o mantenerlo apretado
enum AccionBlanco { BLANCO_NADA, BLANCO_TOQUE, BLANCO_MANTENIDO };

// Datos de cada botón físico (para antirrebote y pulsación larga)
struct Boton {
  int pin;                        // Pin al que está conectado
  bool presionado;                // Estado ya filtrado (sin rebote)
  bool lecturaAnterior;           // Última lectura cruda
  unsigned long ultimoCambio;     // Momento del último cambio de lectura
  unsigned long presionadoDesde;  // Momento en que se apretó
};

// Un recordatorio de medicación
struct Medicacion {
  int hora;             // 0 a 23
  int minuto;           // 0 a 59
  const char* nombre;   // Nombre del remedio
  const char* dosis;    // Ej: "10 mg"
  ModoAviso modo;       // Texto, audio o ambos
};

// Un cumpleaños para recordar (de la familia o de otras personas)
struct Cumpleanos {
  int dia;
  int mes;
  const char* nombre;     // Ej: "Sofía"
  const char* relacion;   // Ej: "nieta", "vecina", "amiga del club"
  bool esDeLaFamilia;     // true  = está en la app: se le puede mandar un saludo por audio
                          // false = solo recordatorio (se la saluda por otro medio)
};

// Un audio recibido
struct AudioRecibido {
  String remitente;     // Quién lo mandó
  int duracionSeg;      // Duración en segundos
};

// Una nota musical: frecuencia en Hz (0 = silencio) y duración en ms
struct Nota {
  int frecuencia;
  int duracion;
};


/* ============================================================================
   6. DATOS DE LA AGENDA (en la entrega 2 vienen desde la PWA / Firebase)
   ============================================================================ */
Medicacion agendaMedicacion[] = {
  {  8, 0, "Enalapril",  "10 mg",  TEXTO_Y_AUDIO },
  { 14, 0, "Metformina", "850 mg", SOLO_TEXTO    },
  { 20, 0, "Enalapril",  "10 mg",  SOLO_AUDIO    },
};
const int CANTIDAD_MEDICACIONES = sizeof(agendaMedicacion) / sizeof(agendaMedicacion[0]);

Cumpleanos agendaCumples[] = {
  // día mes  nombre    relación          ¿familia?
  { 15,  3, "Sofía",  "nieta",           true  },
  {  2, 11, "Juan",   "hijo",            true  },
  {  8,  5, "Rosa",   "vecina",          false },
  { 21,  9, "Elena",  "amiga del club",  false },
};
const int CANTIDAD_CUMPLES = sizeof(agendaCumples) / sizeof(agendaCumples[0]);

// Nombres de los días (tm_wday: 0 = domingo)
const char* DIAS_SEMANA[] = { "DOMINGO", "LUNES", "MARTES", "MIÉRCOLES",
                              "JUEVES", "VIERNES", "SÁBADO" };


/* ============================================================================
   7. SONIDOS (melodías cortas para el buzzer)
   ============================================================================ */
// Notas usadas (Hz): DO5=523 MI5=659 SOL5=784 LA5=880 SI5=988
//                   DO6=1047 MI6=1319 SOL6=1568
// Los silencios cortos entre notas ({0, ms}) hacen que suene más suave y claro.
const Nota MELODIA_AUDIO_NUEVO[]  = { {1047, 80}, {0, 30}, {1319, 80}, {0, 30}, {1568, 160} }; // Do-Mi-Sol ascendente
const Nota MELODIA_MEDICACION[]   = { {784, 120}, {0, 50}, {1047, 120}, {0, 50}, {1319, 220},  // Sol-Do-Mi
                                      {0, 200}, {784, 120}, {0, 50}, {1047, 120}, {0, 50}, {1319, 220} };
const Nota MELODIA_CUMPLE[]       = { {784, 180}, {0, 20}, {784, 90}, {0, 20}, {880, 300}, {0, 20},  // "Feliz cumpleaños"
                                      {784, 300}, {0, 20}, {1047, 300}, {0, 20}, {988, 500} };       // (dominio público)
const Nota MELODIA_SOS[]          = { {880, 220}, {1175, 220}, {880, 220}, {1175, 220}, {880, 220}, {1175, 300} };
const Nota MELODIA_INICIO_GRAB[]  = { {1568, 60} };                                   // "Bip" corto: empezá a hablar
const Nota MELODIA_ENVIADO[]      = { {1047, 90}, {0, 30}, {1568, 160} };             // Do-Sol: listo
const Nota MELODIA_ERROR[]        = { {659, 90}, {0, 30}, {523, 140} };               // Mi-Do descendente: suave
const Nota MELODIA_VOZ_SIMULADA[] = { {523, 120}, {0, 80}, {659, 120}, {0, 80}, {587, 160} };

// Cuenta cuántos elementos tiene un arreglo (para pasarle el largo a la función)
#define CANTIDAD(arreglo) (sizeof(arreglo) / sizeof(arreglo[0]))


/* ============================================================================
   8. OBJETOS Y VARIABLES GLOBALES
   ============================================================================ */
Adafruit_ILI9341 tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST);  // Pantalla (SPI por hardware)
Adafruit_NeoPixel halo(CANTIDAD_LEDS_HALO, PIN_HALO, NEO_GRB + NEO_KHZ800);  // Halo

// Botones: { pin, presionado, lecturaAnterior, ultimoCambio, presionadoDesde }
Boton botonHablar    = { PIN_BOTON_HABLAR,    false, false, 0, 0 };
Boton botonConfirmar = { PIN_BOTON_CONFIRMAR, false, false, 0, 0 };
Boton botonSOS       = { PIN_BOTON_SOS,       false, false, 0, 0 };

// Máquina de estados
Estado estadoActual = REPOSO;
unsigned long inicioEstado = 0;   // Cuándo se entró al estado actual

// Modos
bool modoNoche = false;           // Lo decide el sensor de luz
bool modoSilencioso = false;      // Lo elige el usuario: solo luz, sin sonido

// Cola de audios recibidos sin escuchar
const int MAX_AUDIOS = 5;
AudioRecibido colaAudios[MAX_AUDIOS];
int cantidadAudios = 0;
AudioRecibido audioEnCurso;           // El que se está reproduciendo
bool audioEnCursoEsNuevo = false;     // false = es una repetición
AudioRecibido ultimoAudioEscuchado;   // Para poder repetirlo
bool hayUltimoAudio = false;
String ultimoRemitente = "la familia";  // A quién se responde por defecto
String destinatario = "";                // A quién va el audio que se está grabando

// Lista para elegir destinatario: primero cada familiar, después
// "Toda la familia" y por último "Pedir que me llamen"
int opcionElegida = 0;
bool decidiendoBlanco = false;           // Se apretó el blanco y todavía no se sabe si es toque o mantener

// Grabación
unsigned long duracionGrabadaMs = 0;
int ultimoSegundoMostrado = -1;

// Medicación, cumpleaños e inactividad
int medPendiente = -1;          // Índice de medicación esperando mostrarse (-1 = ninguna)
int medActual = -1;             // Índice de la que se está mostrando
bool familiaAvisadaMed = false;
unsigned long ultimoSonidoMed = 0;
int cumplePendiente = -1;
int cumpleActual = -1;
int ultimoMinutoAgenda = -1;
int ultimoDiaCumple = -1;
unsigned long ultimaInteraccion = 0;
bool inactividadAvisada = false;

// SOS
bool sosYaDisparado = false;    // Evita disparar dos veces con la misma pulsación

// Mensaje temporal
Icono msgIcono;
String msgTitulo, msgDetalle;
uint16_t msgColor;
unsigned long msgDuracion = 0;

// Reloj y clima
int ultimoMinutoDibujado = -1;
float temperaturaActual = 0;
int codigoClima = -1;           // Código WMO del clima (-1 = sin datos)
bool esDeDia = true;
unsigned long ultimaConsultaClima = 0;
bool climaPendienteDeDibujar = false;

// Conexión, sensor y sonido
unsigned long ultimoIntentoWiFi = 0;
unsigned long ultimaLecturaLuz = 0;
unsigned long ultimoLatido = 0;
unsigned long ultimaActualizacionHalo = 0;
unsigned long ultimaActualizacionPantalla = 0;
const Nota* melodiaActual = nullptr;  // Melodía que está sonando (nullptr = ninguna)
int largoMelodia = 0;
int indiceNota = 0;
unsigned long finNotaActual = 0;

// Lectura del Monitor Serie
String bufferSerie = "";
unsigned long ultimoCaracterSerie = 0;


/* ============================================================================
   9. DECLARACIÓN DE FUNCIONES (prototipos)
   Le avisa al compilador que estas funciones existen; están más abajo.
   ============================================================================ */
EventoBoton leerBoton(Boton &boton);
unsigned long tiempoPresionado(const Boton &boton);
void cambiarEstado(Estado nuevoEstado);
void dibujarPantallaEstado();
void dibujarPantallaReposo(bool completa);
void dibujarTarjeta(Icono icono, uint16_t colorIcono, const String &titulo,
                    const String &detalle, uint16_t colorDetalle, const String &ayuda);
void dibujarIcono(Icono icono, int cx, int cy, uint16_t color);
void dibujarIconoClima(int codigo, bool deDia, int cx, int cy);
void dibujarNube(int cx, int cy, uint16_t color);
void dibujarBarraProgreso(float fraccion, uint16_t color);
void textoCentrado(const String &texto, const GFXfont *fuente, int yBase, uint16_t color);
int  anchoTexto(const String &texto, const GFXfont *fuente);
String aLatin1(const String &utf8);
void mostrarMensajeTemporal(Icono icono, const String &titulo, const String &detalle,
                            uint16_t color, unsigned long duracionMs);
void actualizarHalo();
void haloApagado();
void haloPulso(uint32_t color, unsigned long periodoMs);
void haloProgreso(uint32_t color, float fraccion);
void haloGiro(uint32_t color);
uint32_t escalarColor(uint32_t color, float factor);
void reproducirMelodia(const Nota *melodia, int largo);
void actualizarMelodia();
bool puedeSonar(bool urgente);
bool conectarWiFi(unsigned long tiempoMaximoMs);
void mantenerConexion();
bool obtenerHora(struct tm &hora);
bool actualizarClima();
void recibirAudio(const String &remitente, int duracionSeg);
void iniciarReproduccion();
void terminarReproduccion();
void iniciarGrabacion(const String &para);
AccionBlanco interpretarBotonBlanco(EventoBoton evento);
void abrirSeleccion();
void ejecutarOpcion(int opcion);
void pedirLlamada();
void dibujarSeleccion();
int  cantidadOpciones();
uint32_t colorHaloOpcion(int opcion);
void terminarGrabacion();
void iniciarRecordatorioMed(int indice);
void iniciarCumple(int indice);
void dispararSOS();
void dispararAvisoInactividad();
void revisarAgenda();
int  buscarCumpleDeHoy(int desde);
void revisarInactividad();
void revisarSOS(EventoBoton evento);
void actualizarModoNoche(bool forzar);
void registrarInteraccion();
void avisarFamilia(const String &mensaje);
bool enviarWhatsApp(const Contacto &contacto, const String &mensaje);
bool enviarTelegram(const Contacto &contacto, const String &mensaje);
bool pedidoWeb(const String &url);
String codificarURL(const String &texto);
String horaComoTexto();
void leerComandoSerie();
void procesarComando(String comando);
void mostrarAyudaSerie();
void mostrarEstadoSerie();


/* ============================================================================
   10. setup(): se ejecuta UNA vez al encender
   ============================================================================ */
void setup() {
  // --- Comunicación serie para mensajes y comandos de prueba ---
  Serial.begin(115200);
  delay(300);
  Serial.println();
  Serial.println("=== Dispositivo de comunicación familiar - Simulación ===");

  // --- Botones: entrada con resistencia pull-up interna ---
  // Sin apretar, el pin lee HIGH (3,3 V). Al apretar, el botón lo une a GND
  // y lee LOW. Así no hacen falta resistencias externas.
  pinMode(PIN_BOTON_HABLAR, INPUT_PULLUP);
  pinMode(PIN_BOTON_CONFIRMAR, INPUT_PULLUP);
  pinMode(PIN_BOTON_SOS, INPUT_PULLUP);

  // --- Buzzer y sensor de luz ---
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(12);           // Lecturas analógicas de 0 a 4095

  // --- Luz de fondo de la pantalla (PWM: 0 = apagada, 255 = máximo) ---
  pinMode(PIN_TFT_LUZ, OUTPUT);
  analogWrite(PIN_TFT_LUZ, BRILLO_PANTALLA_DIA);

  // --- Halo de LEDs: iniciar y dejar apagado ---
  halo.begin();
  halo.clear();
  halo.show();

  // --- Pantalla: iniciar el bus SPI con nuestros pines y configurarla ---
  SPI.begin(PIN_TFT_SCK, PIN_TFT_MISO, PIN_TFT_MOSI, PIN_TFT_CS);
  tft.begin();
  tft.setRotation(ROTACION_PANTALLA);  // Horizontal: 320 x 240
  tft.setTextWrap(false);              // Nunca partir un texto en dos renglones
  tft.fillScreen(COLOR_FONDO);
  textoCentrado("Hola " + String(NOMBRE_USUARIO), &TituloInter16pt8b, 105, COLOR_TEXTO);
  textoCentrado("Conectando...", &TextoInter13pt8b, 145, COLOR_TEXTO_SUAVE);

  // --- Wi-Fi (si falla, el dispositivo sigue andando y reintenta solo) ---
  conectarWiFi(15000);

  // --- Hora por internet (NTP) con la zona horaria de Argentina ---
  configTzTime(ZONA_HORARIA, "pool.ntp.org", "time.google.com");
  struct tm hora;
  for (int intento = 0; intento < 20 && !obtenerHora(hora); intento++) {
    delay(250);                       // Esperar hasta 5 s la primera sincronización
  }
  Serial.println("[HORA] " + horaComoTexto());

  // --- Primera lectura del clima y del sensor de luz ---
  actualizarClima();
  actualizarModoNoche(true);

  // --- Dejar todo listo para empezar ---
  ultimaInteraccion = millis();
  mostrarAyudaSerie();
  cambiarEstado(REPOSO);
}


/* ============================================================================
   11. loop(): se repite continuamente
   Cada vuelta dura unos pocos milisegundos. Nada en el loop se queda
   "esperando" (no se usa delay), así los botones responden siempre.
   ============================================================================ */
void loop() {
  // --- 11.1 Leer los tres botones (devuelven SE_PRESIONO, SE_SOLTO o nada) ---
  EventoBoton evHablar    = leerBoton(botonHablar);
  EventoBoton evConfirmar = leerBoton(botonConfirmar);
  EventoBoton evSOS       = leerBoton(botonSOS);

  // Cualquier botón que se apriete cuenta como "actividad" de la persona
  if (evHablar == SE_PRESIONO || evConfirmar == SE_PRESIONO || evSOS == SE_PRESIONO) {
    registrarInteraccion();
  }

  // --- 11.2 Tareas que corren siempre, en cualquier estado ---
  leerComandoSerie();          // Comandos de prueba (simulan la nube)
  actualizarModoNoche(false);  // Sensor de luz
  actualizarMelodia();         // Avanza la melodía que esté sonando
  revisarAgenda();             // ¿Es hora de una medicación o un cumpleaños?
  revisarInactividad();        // ¿Pasó demasiado tiempo sin uso?
  revisarSOS(evSOS);           // El SOS funciona desde cualquier estado

  // El botón blanco tiene dos usos: TOCAR (elegir a quién) o MANTENER (hablar)
  AccionBlanco blanco = interpretarBotonBlanco(evHablar);

  unsigned long tiempoEnEstado = millis() - inicioEstado;

  // --- 11.3 Lógica según el estado actual ---
  switch (estadoActual) {

    case REPOSO:
      // Primero, los recordatorios que quedaron pendientes
      if (medPendiente >= 0) {
        iniciarRecordatorioMed(medPendiente);
      } else if (cumplePendiente >= 0) {
        iniciarCumple(cumplePendiente);
      } else if (blanco == BLANCO_MANTENIDO) {
        iniciarGrabacion(ultimoRemitente);     // Mantener: responder al último que escribió
      } else if (blanco == BLANCO_TOQUE) {
        abrirSeleccion();                      // Tocar: elegir a quién hablarle
      } else if (evConfirmar == SE_PRESIONO) {
        if (cantidadAudios > 0 || hayUltimoAudio) {
          iniciarReproduccion();               // Escuchar nuevo o repetir el último
        } else if (puedeSonar(false)) {
          reproducirMelodia(MELODIA_ERROR, CANTIDAD(MELODIA_ERROR));  // No hay audios
        }
      } else {
        // Redibujar el reloj solo cuando cambia el minuto (evita parpadeos)
        struct tm hora;
        if (obtenerHora(hora) && hora.tm_min != ultimoMinutoDibujado) {
          dibujarPantallaReposo(false);
        }
        if (climaPendienteDeDibujar) {
          dibujarPantallaReposo(false);
        }
        // Clima cada 15 minutos (solo en reposo, porque la consulta tarda ~1 s)
        if (millis() - ultimaConsultaClima > INTERVALO_CLIMA_MS) {
          actualizarClima();
        }
      }
      break;

    case AVISO_AUDIO:
      if (medPendiente >= 0) {
        iniciarRecordatorioMed(medPendiente);  // La medicación tiene prioridad
      } else if (evConfirmar == SE_PRESIONO) {
        iniciarReproduccion();
      } else if (blanco == BLANCO_MANTENIDO) {
        iniciarGrabacion(ultimoRemitente);     // Responder a quien mandó el audio
      } else if (blanco == BLANCO_TOQUE) {
        abrirSeleccion();
      } else if (tiempoEnEstado > TIEMPO_AVISO_AUDIO_MS) {
        cambiarEstado(REPOSO);  // Vuelve al reloj; el halo azul sigue avisando
      }
      break;

    case REPRODUCIENDO: {
      float avance = (float)tiempoEnEstado / (audioEnCurso.duracionSeg * 1000.0);
      if (evConfirmar == SE_PRESIONO || avance >= 1.0) {
        terminarReproduccion();                // Terminó o lo detuvieron
      } else if (millis() - ultimaActualizacionPantalla > 200) {
        ultimaActualizacionPantalla = millis();
        dibujarBarraProgreso(avance, COLOR_AZUL);
      }
      break;
    }

    case GRABANDO: {
      // En el prototipo físico, acá se leen las muestras del micrófono
      // INMP441 por I2S y se guardan en la PSRAM. Wokwi no tiene micrófono.
      if (evHablar == SE_SOLTO || tiempoEnEstado >= DURACION_MAX_GRABACION_MS) {
        duracionGrabadaMs = tiempoEnEstado;
        terminarGrabacion();
      } else {
        int restantes = (DURACION_MAX_GRABACION_MS - tiempoEnEstado) / 1000;
        if (restantes != ultimoSegundoMostrado) {  // Actualizar una vez por segundo
          ultimoSegundoMostrado = restantes;
          tft.fillRect(0, 140, ANCHO_PANTALLA, 40, COLOR_FONDO);
          textoCentrado("Quedan " + String(restantes) + " s", &TituloInter16pt8b, 168,
                        restantes <= 10 ? COLOR_NARANJA : COLOR_HORA);
        }
      }
      break;
    }

    case ENVIANDO:
      // Simula la subida del audio (en la entrega 2: subida real a Firebase)
      if (tiempoEnEstado > 1500) {
        Serial.println("[NUBE] Audio de " + String(duracionGrabadaMs / 1000) +
                       " s enviado a " + destinatario);
        if (puedeSonar(false)) reproducirMelodia(MELODIA_ENVIADO, CANTIDAD(MELODIA_ENVIADO));
        mostrarMensajeTemporal(ICONO_OK, "Audio enviado", "a " + destinatario,
                               COLOR_VERDE, 2500);
      }
      break;

    case RECORDATORIO_MED:
      if (evConfirmar == SE_PRESIONO) {
        // La persona confirmó que tomó la medicación
        Medicacion &med = agendaMedicacion[medActual];
        Serial.println("[NUBE] Toma registrada: " + String(med.nombre) + " a las " + horaComoTexto());
        if (familiaAvisadaMed) {
          avisarFamilia("✅ " + String(NOMBRE_USUARIO) + " confirmó (tarde) que tomó " + med.nombre);
        }
        medActual = -1;
        if (puedeSonar(false)) reproducirMelodia(MELODIA_ENVIADO, CANTIDAD(MELODIA_ENVIADO));
        mostrarMensajeTemporal(ICONO_OK, "¡Muy bien!", "Quedó registrado", COLOR_VERDE, 3000);
      } else {
        // Repetir el sonido cada 30 s hasta que confirme
        if (millis() - ultimoSonidoMed > INTERVALO_REPETIR_MED_MS) {
          ultimoSonidoMed = millis();
          if (puedeSonar(true)) reproducirMelodia(MELODIA_MEDICACION, CANTIDAD(MELODIA_MEDICACION));
        }
        // Si no confirma a tiempo, avisar a la familia (una sola vez)
        if (!familiaAvisadaMed && tiempoEnEstado > ESPERA_CONFIRMACION_MED_MS) {
          familiaAvisadaMed = true;
          Medicacion &med = agendaMedicacion[medActual];
          avisarFamilia("⚠️ " + String(NOMBRE_USUARIO) + " no confirmó la toma de " +
                        med.nombre + " " + med.dosis + " (" + horaComoTexto() + ")");
          dibujarPantallaEstado();  // Actualiza la indicación en pantalla
        }
      }
      break;

    case AVISO_CUMPLE:
      if (blanco == BLANCO_MANTENIDO && agendaCumples[cumpleActual].esDeLaFamilia) {
        // Solo a la familia se le puede mandar un saludo por audio
        String cumpleanero = agendaCumples[cumpleActual].nombre;
        cumplePendiente = buscarCumpleDeHoy(cumpleActual + 1);  // ¿Hay otro cumple hoy?
        cumpleActual = -1;
        iniciarGrabacion(cumpleanero);                          // El saludo va al cumpleañero
      } else if (evConfirmar == SE_PRESIONO || tiempoEnEstado > TIEMPO_AVISO_CUMPLE_MS) {
        cumplePendiente = buscarCumpleDeHoy(cumpleActual + 1);
        cumpleActual = -1;
        cambiarEstado(REPOSO);
      }
      break;

    case SOS_ACTIVO:
      if (evConfirmar == SE_PRESIONO || tiempoEnEstado > TIEMPO_PANTALLA_SOS_MS) {
        cambiarEstado(REPOSO);
      }
      break;

    case ELIGIENDO:
      if (blanco == BLANCO_TOQUE) {
        opcionElegida = (opcionElegida + 1) % cantidadOpciones();  // Siguiente (vuelve al principio)
        inicioEstado = millis();                                   // Reinicia los 10 s de espera
        dibujarSeleccion();
      } else if (blanco == BLANCO_MANTENIDO) {
        ejecutarOpcion(opcionElegida);                             // Hablar o pedir llamada
      } else if (evConfirmar == SE_PRESIONO || tiempoEnEstado > TIEMPO_SELECCION_MS) {
        cambiarEstado(REPOSO);                                     // Salir sin hacer nada
      }
      break;

    case MENSAJE_TEMPORAL:
      if (tiempoEnEstado > msgDuracion) {
        cambiarEstado(cantidadAudios > 0 ? AVISO_AUDIO : REPOSO);
      }
      break;
  }

  // --- 11.4 Animación del halo y mantenimiento de la conexión ---
  actualizarHalo();
  mantenerConexion();
}


/* ============================================================================
   12. FUNCIONES DE BOTONES
   ============================================================================ */

// Lee un botón con antirrebote. Recibe el botón POR REFERENCIA (&) para
// poder guardar en él su estado entre una llamada y otra.
// Devuelve SE_PRESIONO o SE_SOLTO solo en el instante en que cambia.
EventoBoton leerBoton(Boton &boton) {
  bool lectura = (digitalRead(boton.pin) == LOW);   // LOW = apretado (pull-up)

  if (lectura != boton.lecturaAnterior) {           // La lectura cambió:
    boton.ultimoCambio = millis();                  // empezar a medir
    boton.lecturaAnterior = lectura;
  }

  // Solo se acepta el cambio si la lectura se mantuvo estable 30 ms
  if ((millis() - boton.ultimoCambio) > TIEMPO_ANTIRREBOTE_MS && lectura != boton.presionado) {
    boton.presionado = lectura;
    if (boton.presionado) {
      boton.presionadoDesde = millis();
      return SE_PRESIONO;
    }
    return SE_SOLTO;
  }
  return SIN_EVENTO;
}

// Devuelve hace cuántos milisegundos se mantiene apretado (0 si está suelto)
unsigned long tiempoPresionado(const Boton &boton) {
  return boton.presionado ? millis() - boton.presionadoDesde : 0;
}


/* ============================================================================
   13. MÁQUINA DE ESTADOS Y ACCIONES
   ============================================================================ */

// Cambia de estado, guarda el momento del cambio y redibuja la pantalla
void cambiarEstado(Estado nuevoEstado) {
  estadoActual = nuevoEstado;
  inicioEstado = millis();
  ultimoSegundoMostrado = -1;
  dibujarPantallaEstado();
}

// Llega un audio nuevo (en la simulación, con el comando "audio")
void recibirAudio(const String &remitente, int duracionSeg) {
  if (cantidadAudios == MAX_AUDIOS) {                 // Cola llena: descartar el más viejo
    for (int i = 1; i < MAX_AUDIOS; i++) colaAudios[i - 1] = colaAudios[i];
    cantidadAudios--;
  }
  colaAudios[cantidadAudios].remitente = remitente;
  colaAudios[cantidadAudios].duracionSeg = duracionSeg;
  cantidadAudios++;
  ultimoRemitente = remitente;                        // La respuesta va a quien escribió
  Serial.println("[NUBE] Llegó un audio de " + remitente + " (" + String(duracionSeg) + " s)");

  // Si está libre, mostrar el aviso; si está ocupado, queda en espera
  if (estadoActual == REPOSO || estadoActual == AVISO_AUDIO) {
    if (puedeSonar(false)) reproducirMelodia(MELODIA_AUDIO_NUEVO, CANTIDAD(MELODIA_AUDIO_NUEVO));
    cambiarEstado(AVISO_AUDIO);
  }
}

// Empieza a reproducir el primer audio de la cola (o repite el último)
void iniciarReproduccion() {
  if (cantidadAudios > 0) {
    audioEnCurso = colaAudios[0];
    audioEnCursoEsNuevo = true;
  } else {
    audioEnCurso = ultimoAudioEscuchado;
    audioEnCursoEsNuevo = false;
  }
  Serial.println("[AUDIO] Reproduciendo audio de " + audioEnCurso.remitente);
  // En el prototipo físico: se descarga y se envía al amplificador MAX98357A.
  // En la simulación: una melodía corta representa la voz.
  reproducirMelodia(MELODIA_VOZ_SIMULADA, CANTIDAD(MELODIA_VOZ_SIMULADA));
  cambiarEstado(REPRODUCIENDO);
}

// Termina la reproducción y marca el audio como escuchado ("doble tilde")
void terminarReproduccion() {
  if (audioEnCursoEsNuevo) {
    Serial.println("[NUBE] ✓✓ Audio de " + audioEnCurso.remitente + " marcado como ESCUCHADO");
    for (int i = 1; i < cantidadAudios; i++) colaAudios[i - 1] = colaAudios[i];  // Sacarlo de la cola
    cantidadAudios--;
  }
  ultimoAudioEscuchado = audioEnCurso;
  hayUltimoAudio = true;
  ultimoRemitente = audioEnCurso.remitente;
  cambiarEstado(cantidadAudios > 0 ? AVISO_AUDIO : REPOSO);
}

// Botón blanco mantenido: empieza a grabar un audio para "para"
void iniciarGrabacion(const String &para) {
  destinatario = para;
  Serial.println("[MIC] Grabando audio para " + destinatario + "...");
  if (puedeSonar(false)) reproducirMelodia(MELODIA_INICIO_GRAB, CANTIDAD(MELODIA_INICIO_GRAB));
  cambiarEstado(GRABANDO);
}

// Botón HABLAR soltado (o llegó al minuto): decide si se envía o se descarta
void terminarGrabacion() {
  if (duracionGrabadaMs < DURACION_MIN_GRABACION_MS) {
    Serial.println("[MIC] Grabación muy corta: descartada");
    mostrarMensajeTemporal(ICONO_MICROFONO, "Mantené apretado", "el botón para hablar",
                           COLOR_NARANJA, 2500);
  } else {
    Serial.println("[MIC] Grabación terminada: " + String(duracionGrabadaMs / 1000) + " s");
    cambiarEstado(ENVIANDO);
  }
}

// Muestra el recordatorio de medicación número "indice" de la agenda
void iniciarRecordatorioMed(int indice) {
  medPendiente = -1;
  medActual = indice;
  familiaAvisadaMed = false;
  ultimoSonidoMed = millis();
  Medicacion &med = agendaMedicacion[indice];
  Serial.println("[AGENDA] Medicación: " + String(med.nombre) + " " + med.dosis);
  if (med.modo != SOLO_TEXTO) {
    // En el prototipo físico se reproduce el audio grabado por la familia
    Serial.println("[AUDIO] Reproduciendo mensaje de voz de la familia para este recordatorio");
  }
  if (puedeSonar(true)) reproducirMelodia(MELODIA_MEDICACION, CANTIDAD(MELODIA_MEDICACION));
  cambiarEstado(RECORDATORIO_MED);
}

// Muestra el aviso de cumpleaños número "indice" de la agenda
void iniciarCumple(int indice) {
  cumplePendiente = -1;
  cumpleActual = indice;
  Cumpleanos &c = agendaCumples[indice];
  Serial.println("[AGENDA] Hoy cumple años: " + String(c.nombre) + " (" + c.relacion + ")" +
                 (c.esDeLaFamilia ? " - se le puede mandar un saludo" : " - solo recordatorio"));
  if (puedeSonar(false)) reproducirMelodia(MELODIA_CUMPLE, CANTIDAD(MELODIA_CUMPLE));
  cambiarEstado(AVISO_CUMPLE);
}

// Botón SOS mantenido 3 s: pantalla roja y aviso a toda la familia
void dispararSOS() {
  Serial.println("[SOS] ¡SOS activado!");
  reproducirMelodia(MELODIA_SOS, CANTIDAD(MELODIA_SOS));   // Suena siempre (urgente)
  cambiarEstado(SOS_ACTIVO);                               // Primero la pantalla...
  avisarFamilia("🔴 SOS: " + String(NOMBRE_USUARIO) +
                " pidió ayuda desde su dispositivo (" + horaComoTexto() + ")");  // ...después el aviso
}

// Aviso de inactividad (automático o con el comando "inactivo")
void dispararAvisoInactividad() {
  inactividadAvisada = true;
  // Si el dispositivo está libre, se muestra un cartel para que la persona sepa
  if (estadoActual == REPOSO || estadoActual == AVISO_AUDIO) {
    mostrarMensajeTemporal(ICONO_ALERTA, "¿Todo bien?", "Avisamos a tu familia", COLOR_NARANJA, 5000);
  }
  avisarFamilia("ℹ️ " + String(NOMBRE_USUARIO) + " no usó el dispositivo en las últimas horas (" +
                horaComoTexto() + "). Quizás convenga llamar.");
}

// Muestra un cartel que desaparece solo después de "duracionMs"
void mostrarMensajeTemporal(Icono icono, const String &titulo, const String &detalle,
                            uint16_t color, unsigned long duracionMs) {
  msgIcono = icono;
  msgTitulo = titulo;
  msgDetalle = detalle;
  msgColor = color;
  msgDuracion = duracionMs;
  cambiarEstado(MENSAJE_TEMPORAL);
}


/* ----------------------------------------------------------------------------
   13.1 ELEGIR A QUIÉN HABLARLE (botón blanco)
   ---------------------------------------------------------------------------- */

// Decide si el botón blanco se TOCÓ (soltado antes de 0,5 s) o se MANTUVO.
// "Mantener" se detecta mientras sigue apretado, así la grabación empieza
// enseguida (suena un "bip") y no se pierde lo que la persona dice.
AccionBlanco interpretarBotonBlanco(EventoBoton evento) {
  if (evento == SE_PRESIONO) {
    decidiendoBlanco = true;                          // Todavía no se sabe
  }
  if (decidiendoBlanco && botonHablar.presionado && tiempoPresionado(botonHablar) >= TIEMPO_MANTENER_MS) {
    decidiendoBlanco = false;
    return BLANCO_MANTENIDO;
  }
  if (decidiendoBlanco && evento == SE_SOLTO) {
    decidiendoBlanco = false;
    return BLANCO_TOQUE;
  }
  return BLANCO_NADA;
}

// Cantidad de opciones de la lista: cada familiar + "Toda la familia" + "Pedir que me llamen"
int cantidadOpciones() {
  return CANTIDAD_FAMILIARES + 2;
}

// Abre la lista empezando por la última persona que escribió (si está en la lista)
void abrirSeleccion() {
  opcionElegida = 0;
  for (int i = 0; i < CANTIDAD_FAMILIARES; i++) {
    if (ultimoRemitente == familia[i].nombre) opcionElegida = i;
  }
  cambiarEstado(ELIGIENDO);
}

// Ejecuta la opción elegida al mantener el botón blanco
void ejecutarOpcion(int opcion) {
  if (opcion < CANTIDAD_FAMILIARES) {
    iniciarGrabacion(familia[opcion].nombre);         // Audio para un familiar
  } else if (opcion == CANTIDAD_FAMILIARES) {
    iniciarGrabacion("toda la familia");              // Audio para todos
  } else {
    pedirLlamada();                                   // Pedido de llamada
  }
}

// Avisa a la familia que la persona quiere hablar (sin ser una emergencia)
void pedirLlamada() {
  Serial.println("[LLAMADA] Pedido de llamada");
  if (puedeSonar(false)) reproducirMelodia(MELODIA_ENVIADO, CANTIDAD(MELODIA_ENVIADO));
  mostrarMensajeTemporal(ICONO_TELEFONO, "Pedido enviado", "Avisamos a tu familia",
                         COLOR_VERDE, 4000);                      // Primero la pantalla...
  avisarFamilia("📞 " + String(NOMBRE_USUARIO) + " quiere hablar con ustedes. " +
                "Pide que la llamen cuando puedan (" + horaComoTexto() + ")");  // ...después el aviso
}

// Color del halo para cada opción de la lista
uint32_t colorHaloOpcion(int opcion) {
  if (opcion < CANTIDAD_FAMILIARES) return HALO_PERSONAS[opcion % 4];
  if (opcion == CANTIDAD_FAMILIARES) return HALO_BLANCO;
  return HALO_VERDE;
}

// Pantalla de la lista: una opción por vez, con letra grande
void dibujarSeleccion() {
  String nombre, pregunta, accion;
  Icono icono;
  uint16_t color;
  if (opcionElegida < CANTIDAD_FAMILIARES) {
    nombre = familia[opcionElegida].nombre;
    icono = ICONO_PERSONA;
    color = COLOR_PERSONAS[opcionElegida % 4];
    pregunta = "¿A quién le hablás?";
    accion = "Mantenelo: hablar";
  } else if (opcionElegida == CANTIDAD_FAMILIARES) {
    nombre = "Toda la familia";
    icono = ICONO_FAMILIA;
    color = COLOR_TEXTO;
    pregunta = "¿A quién le hablás?";
    accion = "Mantenelo: hablar";
  } else {
    nombre = "Pedir que me llamen";
    icono = ICONO_TELEFONO;
    color = COLOR_VERDE;
    pregunta = "¿Querés que te llamen?";
    accion = "Mantenelo: pedir";
  }

  tft.fillScreen(COLOR_FONDO);
  textoCentrado(pregunta, &TextoInter13pt8b, 28, COLOR_AYUDA);
  dibujarIcono(icono, ANCHO_PANTALLA / 2, 82, color);
  // El nombre va con la letra más grande que entre en el ancho de la pantalla
  const GFXfont *fuente = anchoTexto(nombre, &TempInter22pt8b) <= 290 ? &TempInter22pt8b
                                                                     : &TituloInter16pt8b;
  textoCentrado(nombre, fuente, 160, color);
  textoCentrado("Tocá el blanco: otro", &TextoInter13pt8b, 202, COLOR_AYUDA);
  textoCentrado(accion, &TextoInter13pt8b, 228, COLOR_AYUDA);
}


/* ============================================================================
   14. REVISIONES PERIÓDICAS (agenda, inactividad, SOS, luz)
   ============================================================================ */

// Una vez por minuto, compara la hora con la agenda
void revisarAgenda() {
  struct tm hora;
  if (!obtenerHora(hora) || hora.tm_min == ultimoMinutoAgenda) return;
  ultimoMinutoAgenda = hora.tm_min;

  for (int i = 0; i < CANTIDAD_MEDICACIONES; i++) {
    if (agendaMedicacion[i].hora == hora.tm_hour && agendaMedicacion[i].minuto == hora.tm_min) {
      medPendiente = i;   // Se muestra apenas el dispositivo esté libre
    }
  }

  // Cumpleaños: se revisa una vez por día, a partir de las 9 h
  if (hora.tm_hour >= HORA_AVISO_CUMPLE && hora.tm_yday != ultimoDiaCumple) {
    ultimoDiaCumple = hora.tm_yday;
    cumplePendiente = buscarCumpleDeHoy(0);   // El primero de hoy (si hay varios, siguen después)
  }
}

// Busca, a partir de la posición "desde", el próximo cumpleaños que sea hoy.
// Devuelve su posición en la agenda, o -1 si no hay ninguno.
int buscarCumpleDeHoy(int desde) {
  struct tm hora;
  if (!obtenerHora(hora)) return -1;
  for (int i = desde; i < CANTIDAD_CUMPLES; i++) {
    if (agendaCumples[i].dia == hora.tm_mday && agendaCumples[i].mes == hora.tm_mon + 1) {
      return i;
    }
  }
  return -1;
}

// Si es de día y nadie tocó el dispositivo en mucho tiempo, avisa a la familia
void revisarInactividad() {
  if (inactividadAvisada) return;
  struct tm hora;
  if (!obtenerHora(hora)) return;
  bool horarioDeControl = hora.tm_hour >= HORA_INICIO_CONTROL_INACTIVIDAD &&
                          hora.tm_hour < HORA_FIN_CONTROL_INACTIVIDAD;
  if (horarioDeControl && millis() - ultimaInteraccion > LIMITE_INACTIVIDAD_MS) {
    dispararAvisoInactividad();
  }
}

// El SOS se dispara solo si se mantiene apretado 3 segundos seguidos
void revisarSOS(EventoBoton evento) {
  if (evento == SE_PRESIONO) {
    sosYaDisparado = false;
    Serial.println("[SOS] Mantener apretado 3 segundos para pedir ayuda...");
  }
  if (botonSOS.presionado && !sosYaDisparado && tiempoPresionado(botonSOS) >= TIEMPO_SOS_MS) {
    sosYaDisparado = true;
    dispararSOS();
  }
}

// Lee el sensor de luz cada medio segundo y activa o desactiva el modo noche
void actualizarModoNoche(bool forzar) {
  if (!forzar && millis() - ultimaLecturaLuz < 500) return;
  ultimaLecturaLuz = millis();

  int lectura = analogRead(PIN_LDR);       // 0 (mucha luz) a 4095 (oscuro)
  bool antes = modoNoche;
  if (!modoNoche && lectura > UMBRAL_NOCHE) modoNoche = true;
  else if (modoNoche && lectura < UMBRAL_DIA) modoNoche = false;

  if (modoNoche != antes || forzar) {
    analogWrite(PIN_TFT_LUZ, modoNoche ? BRILLO_PANTALLA_NOCHE : BRILLO_PANTALLA_DIA);
    if (modoNoche != antes) {
      Serial.println(modoNoche ? "[LUZ] Modo noche activado" : "[LUZ] Modo día activado");
      if (estadoActual == REPOSO) dibujarPantallaReposo(true);  // Colores atenuados
    }
  }
}

// La persona usó el dispositivo: se reinicia el control de inactividad
void registrarInteraccion() {
  ultimaInteraccion = millis();
  inactividadAvisada = false;
}


/* ============================================================================
   15. PANTALLA
   ============================================================================ */

// Dibuja lo que corresponde al estado actual
void dibujarPantallaEstado() {
  switch (estadoActual) {
    case REPOSO:
      dibujarPantallaReposo(true);
      break;
    case AVISO_AUDIO: {
      String titulo = cantidadAudios > 1 ? String(cantidadAudios) + " audios nuevos" : "Audio nuevo";
      dibujarTarjeta(ICONO_AUDIO, COLOR_AZUL, titulo, "de " + colaAudios[0].remitente,
                     COLOR_AZUL, "Botón verde: escuchar");
      break;
    }
    case REPRODUCIENDO:
      dibujarTarjeta(ICONO_AUDIO, COLOR_AZUL, "Audio de " + audioEnCurso.remitente, "",
                     COLOR_AZUL, "Botón verde: detener");
      dibujarBarraProgreso(0, COLOR_AZUL);
      break;
    case GRABANDO:
      dibujarTarjeta(ICONO_MICROFONO, COLOR_ROJO, "Para " + destinatario, "", COLOR_HORA,
                     "Soltá para enviar");
      break;
    case ENVIANDO:
      dibujarTarjeta(ICONO_ENVIO, COLOR_HORA, "Enviando...", "a " + destinatario,
                     COLOR_HORA, "");
      break;
    case RECORDATORIO_MED: {
      Medicacion &med = agendaMedicacion[medActual];
      String detalle = (med.modo == SOLO_AUDIO) ? "(mensaje de voz)"
                                                : String(med.nombre) + " " + med.dosis;
      String ayuda = familiaAvisadaMed ? "Avisamos a tu familia" : "Botón verde: ya la tomé";
      dibujarTarjeta(ICONO_PASTILLA, COLOR_NARANJA, "Tu medicación", detalle,
                     COLOR_NARANJA, ayuda);
      break;
    }
    case AVISO_CUMPLE: {
      Cumpleanos &c = agendaCumples[cumpleActual];
      // A la familia se la puede saludar con un audio; al resto, solo se recuerda
      String ayuda = c.esDeLaFamilia ? "Botón blanco: saludar" : "Botón verde: cerrar";
      dibujarTarjeta(ICONO_TORTA, COLOR_VERDE, "Hoy cumple años",
                     String(c.nombre) + " (" + c.relacion + ")", COLOR_VERDE, ayuda);
      break;
    }
    case SOS_ACTIVO:
      dibujarTarjeta(ICONO_SOS, COLOR_ROJO, "Pedido de ayuda", "Avisamos a tu familia",
                     COLOR_ROJO, "Botón verde: cerrar");
      break;
    case MENSAJE_TEMPORAL:
      dibujarTarjeta(msgIcono, msgColor, msgTitulo, msgDetalle, msgColor, "");
      break;
    case ELIGIENDO:
      dibujarSeleccion();
      break;
  }
}

// Pantalla de reposo: día, fecha, hora grande y clima.
// completa = true borra todo; false solo redibuja las franjas que cambian.
void dibujarPantallaReposo(bool completa) {
  if (completa) tft.fillScreen(COLOR_FONDO);

  uint16_t colorTexto = modoNoche ? COLOR_NOCHE_TEXTO : COLOR_TEXTO;
  uint16_t colorSuave = modoNoche ? COLOR_NOCHE_TEXTO : COLOR_TEXTO_SUAVE;
  uint16_t colorHora  = modoNoche ? COLOR_NOCHE_HORA  : COLOR_HORA;

  struct tm hora;
  bool horaOk = obtenerHora(hora);

  // --- Franja 1 y 2: día de la semana y fecha ---
  tft.fillRect(0, 0, ANCHO_PANTALLA, 84, COLOR_FONDO);
  if (horaOk) {
    char fecha[40];
    snprintf(fecha, sizeof(fecha), "%02d-%02d-%04d", hora.tm_mday, hora.tm_mon + 1, hora.tm_year + 1900);
    textoCentrado(DIAS_SEMANA[hora.tm_wday], &TituloInter16pt8b, 44, colorTexto);
    textoCentrado(fecha, &TextoInter13pt8b, 76, colorSuave);
  } else {
    textoCentrado("Sin hora", &TextoInter13pt8b, 60, colorSuave);
  }

  // --- Franja 3: hora grande + "hs." más chico al lado ---
  tft.fillRect(0, 86, ANCHO_PANTALLA, 86, COLOR_FONDO);
  char textoHora[12];
  if (horaOk) snprintf(textoHora, sizeof(textoHora), "%02d:%02d", hora.tm_hour, hora.tm_min);
  else        snprintf(textoHora, sizeof(textoHora), "--:--");
  int anchoHora = anchoTexto(textoHora, &HoraInter46pt7b);
  int anchoHs   = anchoTexto("hs.", &TextoInter13pt8b);
  int x = (ANCHO_PANTALLA - (anchoHora + 8 + anchoHs)) / 2;
  tft.setFont(&HoraInter46pt7b);
  tft.setTextColor(colorHora);
  tft.setCursor(x, 160);
  tft.print(textoHora);
  tft.setFont(&TextoInter13pt8b);
  tft.setTextColor(colorSuave);
  tft.setCursor(x + anchoHora + 8, 160);
  tft.print("hs.");
  ultimoMinutoDibujado = horaOk ? hora.tm_min : -1;

  // --- Franja 4: ícono del clima + temperatura, abajo y centrados ---
  tft.fillRect(0, 178, ANCHO_PANTALLA, 62, COLOR_FONDO);
  if (codigoClima >= 0) {
    String temp = aLatin1(String((int)round(temperaturaActual)) + "°C");
    int anchoTemp = anchoTexto(temp, &TempInter22pt8b);
    int xIcono = (ANCHO_PANTALLA - (46 + 12 + anchoTemp)) / 2;
    dibujarIconoClima(codigoClima, esDeDia, xIcono + 23, 206);
    tft.setFont(&TempInter22pt8b);
    tft.setTextColor(colorTexto);
    tft.setCursor(xIcono + 46 + 12, 220);
    tft.print(temp);
  }
  climaPendienteDeDibujar = false;

  // --- Indicadores chicos: audios sin escuchar y falta de conexión ---
  if (cantidadAudios > 0) {
    tft.fillCircle(296, 22, 14, COLOR_AZUL);
    tft.setFont(&TextoInter13pt8b);
    tft.setTextColor(COLOR_TEXTO);
    String n = String(cantidadAudios);
    tft.setCursor(296 - anchoTexto(n, &TextoInter13pt8b) / 2 - 1, 30);
    tft.print(n);
  }
  if (modoSilencioso) {             // Indicador chico de "sin sonido"
    tft.setFont(NULL);
    tft.setTextSize(1);
    tft.setTextColor(COLOR_AYUDA);
    tft.setCursor(6, 228);
    tft.print("SILENCIO");
  }
  if (WiFi.status() != WL_CONNECTED) {
    tft.setFont(NULL);              // Fuente chica incorporada
    tft.setTextSize(1);
    tft.setTextColor(COLOR_AYUDA);
    tft.setCursor(6, 6);
    tft.print("SIN WI-FI");
  }
}

// Tarjeta genérica para avisos: ícono arriba, título, detalle y ayuda abajo.
// Se usa para todos los estados (diseño uniforme).
void dibujarTarjeta(Icono icono, uint16_t colorIcono, const String &titulo,
                    const String &detalle, uint16_t colorDetalle, const String &ayuda) {
  tft.fillScreen(COLOR_FONDO);
  dibujarIcono(icono, ANCHO_PANTALLA / 2, 58, colorIcono);
  // Si el título es muy largo, se usa la letra más chica para que entre
  const GFXfont *fuenteTitulo = anchoTexto(titulo, &TituloInter16pt8b) > 300 ? &TextoInter13pt8b
                                                                             : &TituloInter16pt8b;
  textoCentrado(titulo, fuenteTitulo, 132, COLOR_TEXTO);
  if (detalle.length() > 0) {
    // Si el detalle es largo, se usa la letra más chica para que entre
    const GFXfont *fuente = anchoTexto(detalle, &TituloInter16pt8b) > 300 ? &TextoInter13pt8b
                                                                          : &TituloInter16pt8b;
    textoCentrado(detalle, fuente, 168, colorDetalle);
  }
  if (ayuda.length() > 0) {
    textoCentrado(ayuda, &TextoInter13pt8b, 222, COLOR_AYUDA);
  }
}

// Barra de progreso horizontal (fraccion de 0.0 a 1.0)
void dibujarBarraProgreso(float fraccion, uint16_t color) {
  const int x = 60, y = 158, ancho = 200, alto = 12;
  if (fraccion > 1) fraccion = 1;
  tft.fillRoundRect(x, y, ancho, alto, alto / 2, COLOR_BARRA_FONDO);
  int lleno = ancho * fraccion;
  if (lleno >= alto) tft.fillRoundRect(x, y, lleno, alto, alto / 2, color);
}

// Escribe un texto centrado horizontalmente. yBase es la línea de apoyo.
void textoCentrado(const String &texto, const GFXfont *fuente, int yBase, uint16_t color) {
  String t = aLatin1(texto);
  tft.setFont(fuente);
  tft.setTextColor(color);
  int16_t x1, y1;
  uint16_t ancho, alto;
  tft.getTextBounds(t, 0, yBase, &x1, &y1, &ancho, &alto);  // Medir el texto
  tft.setCursor((ANCHO_PANTALLA - ancho) / 2 - x1, yBase);
  tft.print(t);
}

// Devuelve el ancho en píxeles que ocupa un texto con una fuente
int anchoTexto(const String &texto, const GFXfont *fuente) {
  String t = aLatin1(texto);
  tft.setFont(fuente);
  int16_t x1, y1;
  uint16_t ancho, alto;
  tft.getTextBounds(t, 0, 100, &x1, &y1, &ancho, &alto);
  return ancho;
}

// Convierte texto UTF-8 (como se escribe en el código) a Latin-1 (como
// están guardadas nuestras fuentes). Ej: "á" ocupa 2 bytes en UTF-8 (C3 A1)
// y 1 byte en Latin-1 (E1). Los emojis y otros símbolos se descartan.
String aLatin1(const String &utf8) {
  String salida;
  salida.reserve(utf8.length());
  for (unsigned int i = 0; i < utf8.length(); i++) {
    uint8_t c = utf8[i];
    if (c < 0x80) {
      salida += (char)c;                                // Letra común (ASCII)
    } else if ((c == 0xC2 || c == 0xC3) && i + 1 < utf8.length()) {
      uint8_t siguiente = utf8[++i];
      salida += (char)(c == 0xC2 ? siguiente : siguiente + 0x40);
    }
  }
  return salida;
}

// Dibuja un ícono de unos 70 px centrado en (cx, cy) con figuras simples
void dibujarIcono(Icono icono, int cx, int cy, uint16_t color) {
  switch (icono) {
    case ICONO_AUDIO:   // Parlante con dos ondas de sonido
      tft.fillRoundRect(cx - 32, cy - 12, 18, 24, 3, color);
      tft.fillTriangle(cx - 16, cy - 12, cx + 2, cy - 30, cx + 2, cy + 30, color);
      tft.fillTriangle(cx - 16, cy - 12, cx + 2, cy + 30, cx - 16, cy + 12, color);
      for (int r = 0; r < 4; r++) {               // Ondas (cuartos de círculo, 4 px de grosor)
        tft.drawCircleHelper(cx + 6, cy, 14 + r, 2 | 4, color);
        tft.drawCircleHelper(cx + 6, cy, 27 + r, 2 | 4, color);
      }
      break;
    case ICONO_MICROFONO:
      tft.fillRoundRect(cx - 13, cy - 34, 26, 46, 13, color);              // Cápsula
      for (int r = 0; r < 4; r++) tft.drawCircleHelper(cx, cy - 2, 21 + r, 4 | 8, color);  // Soporte
      tft.fillRect(cx - 2, cy + 21, 5, 9, color);                          // Pie
      tft.fillRoundRect(cx - 14, cy + 29, 29, 5, 2, color);                // Base
      break;
    case ICONO_PASTILLA:   // Cápsula mitad color, mitad blanca
      tft.fillRoundRect(cx - 42, cy - 18, 84, 36, 18, color);
      tft.fillRoundRect(cx, cy - 18, 42, 36, 18, COLOR_TEXTO);
      tft.fillRect(cx, cy - 18, 20, 36, COLOR_TEXTO);
      tft.fillRoundRect(cx - 30, cy - 10, 18, 5, 2, COLOR_TEXTO);   // Brillo
      break;
    case ICONO_TORTA:      // Torta de dos pisos con tres velitas
      tft.fillRoundRect(cx - 36, cy + 4, 72, 28, 5, color);         // Piso de abajo
      tft.fillRect(cx - 36, cy + 4, 72, 6, COLOR_TEXTO);            // Crema
      for (int i = -3; i <= 3; i++) tft.fillCircle(cx + i * 10, cy + 10, 3, COLOR_TEXTO);
      tft.fillRoundRect(cx - 24, cy - 14, 48, 20, 4, color);        // Piso de arriba
      tft.fillRect(cx - 24, cy - 14, 48, 5, COLOR_TEXTO);
      for (int i = -1; i <= 1; i++) {                                // Velitas y llamas
        tft.fillRect(cx + i * 14 - 2, cy - 30, 5, 16, COLOR_TEXTO);
        tft.fillCircle(cx + i * 14, cy - 35, 4, COLOR_AMARILLO);
      }
      break;
    case ICONO_SOS:
      tft.fillCircle(cx, cy, 34, color);
      tft.setFont(&TituloInter16pt8b);
      tft.setTextColor(COLOR_TEXTO);
      tft.setCursor(cx - anchoTexto("SOS", &TituloInter16pt8b) / 2 - 1, cy + 11);
      tft.print("SOS");
      break;
    case ICONO_OK:   // Círculo con tilde de "listo"
      tft.fillCircle(cx, cy, 34, color);
      for (int g = -3; g <= 3; g++) {
        tft.drawLine(cx - 16, cy + g, cx - 5, cy + 11 + g, COLOR_FONDO);
        tft.drawLine(cx - 5, cy + 11 + g, cx + 17, cy - 11 + g, COLOR_FONDO);
      }
      break;
    case ICONO_ENVIO:   // Círculo con flecha hacia arriba
      tft.fillCircle(cx, cy, 34, color);
      tft.fillTriangle(cx, cy - 22, cx - 16, cy - 4, cx + 16, cy - 4, COLOR_FONDO);
      tft.fillRect(cx - 5, cy - 6, 11, 26, COLOR_FONDO);
      break;
    case ICONO_SILENCIO:   // Parlante tachado
    case ICONO_SONIDO:     // Parlante con ondas
      tft.fillRoundRect(cx - 32, cy - 12, 18, 24, 3, color);
      tft.fillTriangle(cx - 16, cy - 12, cx + 2, cy - 30, cx + 2, cy + 30, color);
      tft.fillTriangle(cx - 16, cy - 12, cx + 2, cy + 30, cx - 16, cy + 12, color);
      if (icono == ICONO_SILENCIO) {
        for (int g = -3; g <= 3; g++) {          // Cruz roja gruesa
          tft.drawLine(cx + 10 + g, cy - 15, cx + 36 + g, cy + 15, COLOR_ROJO);
          tft.drawLine(cx + 36 + g, cy - 15, cx + 10 + g, cy + 15, COLOR_ROJO);
        }
      } else {
        for (int r = 0; r < 4; r++) {
          tft.drawCircleHelper(cx + 6, cy, 14 + r, 2 | 4, color);
          tft.drawCircleHelper(cx + 6, cy, 27 + r, 2 | 4, color);
        }
      }
      break;
    case ICONO_PERSONA:    // Cabeza y hombros
      tft.fillCircle(cx, cy - 14, 15, color);
      tft.fillRoundRect(cx - 26, cy + 6, 52, 30, 15, color);
      break;
    case ICONO_FAMILIA:    // Tres personas
      tft.fillCircle(cx - 24, cy - 8, 10, color);
      tft.fillRoundRect(cx - 40, cy + 6, 32, 24, 10, color);
      tft.fillCircle(cx + 24, cy - 8, 10, color);
      tft.fillRoundRect(cx + 8, cy + 6, 32, 24, 10, color);
      tft.fillCircle(cx, cy - 16, 13, color);
      tft.fillRoundRect(cx - 20, cy + 2, 40, 32, 13, color);
      break;
    case ICONO_TELEFONO:   // Celular con ondas de llamada
      tft.fillRoundRect(cx - 17, cy - 32, 34, 64, 7, color);
      tft.fillRect(cx - 12, cy - 24, 24, 44, COLOR_FONDO);       // Pantalla
      tft.fillCircle(cx, cy + 26, 3, COLOR_FONDO);               // Botón
      for (int r = 0; r < 3; r++) {
        tft.drawCircleHelper(cx + 18, cy - 20, 10 + r, 2, color);  // Ondas
        tft.drawCircleHelper(cx + 18, cy - 20, 19 + r, 2, color);
      }
      break;
    case ICONO_ALERTA:
      tft.fillTriangle(cx, cy - 32, cx - 36, cy + 30, cx + 36, cy + 30, color);
      tft.fillRect(cx - 3, cy - 12, 7, 26, COLOR_FONDO);
      tft.fillRect(cx - 3, cy + 18, 7, 7, COLOR_FONDO);
      break;
  }
}

// Dibuja una nube con tres círculos y una base redondeada
void dibujarNube(int cx, int cy, uint16_t color) {
  tft.fillCircle(cx - 10, cy + 3, 9, color);
  tft.fillCircle(cx + 1, cy - 4, 12, color);
  tft.fillCircle(cx + 12, cy + 4, 8, color);
  tft.fillRoundRect(cx - 19, cy + 2, 39, 11, 5, color);
}

// Elige y dibuja el ícono del clima según el código WMO de Open-Meteo:
// 0 despejado, 1-2 parcialmente nublado, 3 nublado, 45-48 niebla,
// 51-67 y 80-82 lluvia, 71-77 y 85-86 nieve, 95-99 tormenta.
void dibujarIconoClima(int codigo, bool deDia, int cx, int cy) {
  uint16_t colorSol = modoNoche ? COLOR_NOCHE_TEXTO : COLOR_AMARILLO;
  uint16_t colorNube = modoNoche ? COLOR_NOCHE_TEXTO : COLOR_NUBE;

  if (codigo <= 2) {
    // Sol (de día) o luna (de noche)
    int sx = (codigo == 0) ? cx : cx - 7;
    int sy = (codigo == 0) ? cy : cy - 7;
    if (deDia) {
      tft.fillCircle(sx, sy, 10, colorSol);
      for (int i = 0; i < 8; i++) {               // 8 rayos alrededor
        float a = i * PI / 4;
        for (int g = -1; g <= 1; g++) {
          tft.drawLine(sx + cos(a) * 14 + g, sy + sin(a) * 14, sx + cos(a) * 20 + g, sy + sin(a) * 20, colorSol);
        }
      }
    } else {
      tft.fillCircle(sx, sy, 13, colorSol);
      tft.fillCircle(sx + 7, sy - 5, 11, COLOR_FONDO);   // "Muerde" el círculo: luna
    }
    if (codigo > 0) dibujarNube(cx + 4, cy + 4, colorNube);
  } else if (codigo == 45 || codigo == 48) {
    for (int i = 0; i < 3; i++) tft.fillRoundRect(cx - 20, cy - 12 + i * 10, 40, 5, 2, colorNube);
  } else if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) {
    dibujarNube(cx, cy - 6, colorNube);
    for (int i = -1; i <= 1; i++) {               // Tres gotas
      int gx = cx + i * 11, gy = cy + 16;
      tft.fillTriangle(gx, gy - 6, gx - 3, gy, gx + 3, gy, COLOR_GOTA);
      tft.fillCircle(gx, gy + 1, 3, COLOR_GOTA);
    }
  } else if ((codigo >= 71 && codigo <= 77) || codigo == 85 || codigo == 86) {
    dibujarNube(cx, cy - 6, colorNube);
    for (int i = -1; i <= 1; i++) tft.fillCircle(cx + i * 11, cy + 17, 3, COLOR_TEXTO);
  } else if (codigo >= 95) {
    dibujarNube(cx, cy - 6, colorNube);
    tft.fillTriangle(cx + 2, cy + 6, cx - 7, cy + 18, cx + 1, cy + 18, colorSol);   // Rayo
    tft.fillTriangle(cx - 1, cy + 16, cx + 7, cy + 16, cx - 4, cy + 28, colorSol);
  } else {
    dibujarNube(cx, cy, colorNube);               // Nublado (y cualquier otro)
  }
}


/* ============================================================================
   16. HALO DE LEDs
   Los 16 LEDs rodean la pantalla en sentido horario empezando arriba a la
   izquierda: 0-4 arriba, 5-7 derecha, 8-12 abajo, 13-15 izquierda.
   ============================================================================ */

// Elige la animación según lo que esté pasando (cada 30 ms)
void actualizarHalo() {
  if (millis() - ultimaActualizacionHalo < 30) return;
  ultimaActualizacionHalo = millis();
  unsigned long t = millis() - inicioEstado;

  // Prioridad máxima: el SOS mientras se mantiene apretado (se va llenando en rojo)
  if (botonSOS.presionado && !sosYaDisparado) {
    haloProgreso(HALO_ROJO, (float)tiempoPresionado(botonSOS) / TIEMPO_SOS_MS);
    return;
  }

  switch (estadoActual) {
    case GRABANDO:          // Se llena a medida que pasa el minuto
      haloProgreso(HALO_BLANCO, (float)t / DURACION_MAX_GRABACION_MS);
      break;
    case REPRODUCIENDO:
      haloProgreso(HALO_AZUL, (float)t / (audioEnCurso.duracionSeg * 1000.0));
      break;
    case ENVIANDO:
      haloGiro(HALO_CELESTE);
      break;
    case RECORDATORIO_MED:
      haloPulso(HALO_NARANJA, 1500);
      break;
    case AVISO_CUMPLE:
      haloPulso(HALO_VERDE, 2000);
      break;
    case SOS_ACTIVO:
      haloPulso(HALO_ROJO, 800);
      break;
    case MENSAJE_TEMPORAL:
      if (msgIcono == ICONO_OK) {   // "Listo": halo verde fijo
        halo.fill(escalarColor(HALO_VERDE, 1.0));
        halo.show();
      } else {
        haloApagado();
      }
      break;
    case ELIGIENDO:         // Color fijo de la persona (u opción) que se está mostrando
      halo.fill(escalarColor(colorHaloOpcion(opcionElegida), 1.0));
      halo.show();
      break;
    default:                // REPOSO y AVISO_AUDIO
      if (cantidadAudios > 0) haloPulso(HALO_AZUL, 2000);   // Hay audios sin escuchar
      else haloApagado();
      break;
  }
}

void haloApagado() {
  halo.clear();
  halo.show();
}

// Todos los LEDs "respiran": suben y bajan de brillo suavemente
void haloPulso(uint32_t color, unsigned long periodoMs) {
  float fase = (millis() % periodoMs) / (float)periodoMs;   // 0.0 a 1.0
  float intensidad = 0.15 + 0.85 * (0.5 - 0.5 * cos(fase * 2 * PI));
  halo.fill(escalarColor(color, intensidad));
  halo.show();
}

// Enciende una parte de los LEDs según la fracción (barra de progreso circular)
void haloProgreso(uint32_t color, float fraccion) {
  if (fraccion > 1) fraccion = 1;
  int encendidos = round(fraccion * CANTIDAD_LEDS_HALO);
  for (int i = 0; i < CANTIDAD_LEDS_HALO; i++) {
    halo.setPixelColor(i, i < encendidos ? escalarColor(color, 1.0) : escalarColor(color, 0.06));
  }
  halo.show();
}

// Un punto de luz con "estela" que gira alrededor de la pantalla
void haloGiro(uint32_t color) {
  int cabeza = (millis() / 60) % CANTIDAD_LEDS_HALO;
  halo.clear();
  for (int k = 0; k < 4; k++) {
    int i = (cabeza - k + CANTIDAD_LEDS_HALO) % CANTIDAD_LEDS_HALO;
    halo.setPixelColor(i, escalarColor(color, 1.0 - k * 0.25));
  }
  halo.show();
}

// Ajusta un color 0xRRGGBB por un factor (0 a 1) y por el brillo de día/noche
uint32_t escalarColor(uint32_t color, float factor) {
  float brillo = factor * (modoNoche ? BRILLO_HALO_NOCHE : BRILLO_HALO_DIA);
  uint8_t r = ((color >> 16) & 0xFF) * brillo;
  uint8_t g = ((color >> 8) & 0xFF) * brillo;
  uint8_t b = (color & 0xFF) * brillo;
  return halo.Color(r, g, b);
}


/* ============================================================================
   17. SONIDO
   ============================================================================ */

// Empieza a tocar una melodía. No se queda esperando: la función
// actualizarMelodia() (llamada en cada loop) pasa de una nota a la siguiente.
void reproducirMelodia(const Nota *melodia, int largo) {
  melodiaActual = melodia;
  largoMelodia = largo;
  indiceNota = 0;
  if (melodia[0].frecuencia > 0) tone(PIN_BUZZER, melodia[0].frecuencia);
  else noTone(PIN_BUZZER);
  finNotaActual = millis() + melodia[0].duracion;
}

void actualizarMelodia() {
  if (melodiaActual == nullptr || millis() < finNotaActual) return;
  indiceNota++;
  if (indiceNota >= largoMelodia) {          // Terminó la melodía
    noTone(PIN_BUZZER);
    melodiaActual = nullptr;
    return;
  }
  const Nota &nota = melodiaActual[indiceNota];
  if (nota.frecuencia > 0) tone(PIN_BUZZER, nota.frecuencia);
  else noTone(PIN_BUZZER);
  finNotaActual = millis() + nota.duracion;
}

// Decide si se puede hacer sonido. El modo silencioso calla todo menos lo
// urgente; de noche solo suena lo urgente (medicación y SOS).
bool puedeSonar(bool urgente) {
  if (modoSilencioso) return false;
  if (modoNoche && !urgente) return false;
  return true;
}


/* ============================================================================
   18. CONEXIÓN, HORA Y CLIMA
   ============================================================================ */

// Intenta conectarse al Wi-Fi durante un tiempo máximo. Devuelve true si lo logró.
bool conectarWiFi(unsigned long tiempoMaximoMs) {
  Serial.print("[WIFI] Conectando a " + String(WIFI_NOMBRE));
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NOMBRE, WIFI_CLAVE, 6);   // Canal 6: conexión más rápida en Wokwi
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < tiempoMaximoMs) {
    delay(250);
    Serial.print(".");
  }
  ultimoIntentoWiFi = millis();
  bool conectado = (WiFi.status() == WL_CONNECTED);
  if (conectado) Serial.println(" conectado. IP: " + WiFi.localIP().toString());
  else Serial.println(" sin conexión");
  return conectado;
}

// Reintenta el Wi-Fi si se cortó y envía un "latido" (dispositivo en línea)
void mantenerConexion() {
  if (WiFi.status() != WL_CONNECTED && millis() - ultimoIntentoWiFi > 30000) {
    ultimoIntentoWiFi = millis();
    Serial.println("[WIFI] Reintentando conexión...");
    WiFi.reconnect();
  }
  if (millis() - ultimoLatido > 5UL * 60 * 1000) {
    ultimoLatido = millis();
    // Entrega 2: se escribe la hora en Firebase y la PWA muestra "en línea"
    Serial.println("[NUBE] Latido: dispositivo en línea (" + horaComoTexto() + ")");
  }
}

// Obtiene la hora local. Devuelve false si todavía no se sincronizó.
bool obtenerHora(struct tm &hora) {
  if (!getLocalTime(&hora, 10)) return false;   // Espera como máximo 10 ms
  return hora.tm_year > (2020 - 1900);          // Año válido = ya sincronizó
}

// Hora actual como texto "HH:MM" (para los mensajes)
String horaComoTexto() {
  struct tm hora;
  if (!obtenerHora(hora)) return "--:--";
  char texto[12];
  snprintf(texto, sizeof(texto), "%02d:%02d", hora.tm_hour, hora.tm_min);
  return String(texto);
}

// Pide el clima actual a Open-Meteo (gratis, sin registro). true = éxito.
bool actualizarClima() {
  ultimaConsultaClima = millis();
  if (WiFi.status() != WL_CONNECTED) return false;

  String url = "https://api.open-meteo.com/v1/forecast?latitude=" + String(LATITUD, 4) +
               "&longitude=" + String(LONGITUD, 4) +
               "&current=temperature_2m,weather_code,is_day";

  WiFiClientSecure cliente;
  cliente.setInsecure();   // Simplificación: no verifica el certificado del servidor
  HTTPClient http;
  http.begin(cliente, url);
  http.setTimeout(6000);
  int codigoHttp = http.GET();

  if (codigoHttp != 200) {
    Serial.println("[CLIMA] Error " + String(codigoHttp) + ", se reintenta en 1 minuto");
    http.end();
    ultimaConsultaClima = millis() - INTERVALO_CLIMA_MS + 60000;
    return false;
  }

  // Respuesta de ejemplo: {"current":{"temperature_2m":18.3,"weather_code":2,"is_day":1}}
  JsonDocument datos;
  DeserializationError error = deserializeJson(datos, http.getString());
  http.end();
  if (error) {
    Serial.println("[CLIMA] Respuesta inválida");
    return false;
  }
  temperaturaActual = datos["current"]["temperature_2m"].as<float>();
  codigoClima = datos["current"]["weather_code"].as<int>();
  esDeDia = datos["current"]["is_day"].as<int>() == 1;
  climaPendienteDeDibujar = true;
  Serial.println("[CLIMA] " + String(CIUDAD) + ": " + String(temperaturaActual, 1) +
                 " °C, código " + String(codigoClima));
  return true;
}


/* ============================================================================
   19. AVISOS A LA FAMILIA (WhatsApp vía CallMeBot y Telegram)
   ============================================================================ */

// Manda el mensaje a todos los familiares, por cada canal que tengan configurado
void avisarFamilia(const String &mensaje) {
  Serial.println("[AVISO] A la familia: " + mensaje);
  for (int i = 0; i < CANTIDAD_FAMILIARES; i++) {
    const Contacto &c = familia[i];
    bool tieneWhatsApp = strlen(c.telefono) > 0 && strlen(c.apikey) > 0;
    bool tieneTelegram = strlen(c.telegramChat) > 0 && strlen(TELEGRAM_TOKEN) > 0;
    String linea = "        -> " + String(c.nombre) + ":";

    if (!tieneWhatsApp && !tieneTelegram) {
      Serial.println(linea + " sin configurar (solo simulado)");
      continue;                                   // Pasa al siguiente familiar
    }
    if (tieneWhatsApp) {
      linea += enviarWhatsApp(c, mensaje) ? " WhatsApp OK" : " WhatsApp ERROR";
    }
    if (tieneTelegram) {
      linea += enviarTelegram(c, mensaje) ? " | Telegram OK" : " | Telegram ERROR";
    }
    Serial.println(linea);
  }
  // Entrega 2: el aviso también queda registrado en Firebase y se ve en la PWA
}

// WhatsApp mediante el servicio gratuito CallMeBot
bool enviarWhatsApp(const Contacto &contacto, const String &mensaje) {
  String url = "https://api.callmebot.com/whatsapp.php?phone=" + codificarURL(contacto.telefono) +
               "&text=" + codificarURL(mensaje) + "&apikey=" + contacto.apikey;
  return pedidoWeb(url);
}

// Telegram mediante la API oficial de bots (método sendMessage)
bool enviarTelegram(const Contacto &contacto, const String &mensaje) {
  String url = "https://api.telegram.org/bot" + String(TELEGRAM_TOKEN) +
               "/sendMessage?chat_id=" + contacto.telegramChat + "&text=" + codificarURL(mensaje);
  return pedidoWeb(url);
}

// Hace un pedido web (GET) por HTTPS. Devuelve true si el servidor respondió OK (200).
bool pedidoWeb(const String &url) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure cliente;
  cliente.setInsecure();       // Simplificación: no verifica el certificado
  HTTPClient http;
  http.begin(cliente, url);
  http.setTimeout(8000);
  int codigoHttp = http.GET();
  http.end();
  return codigoHttp == 200;
}

// Prepara un texto para ir dentro de una dirección web: los espacios,
// tildes y emojis se reemplazan por códigos %XX
String codificarURL(const String &texto) {
  const char *hex = "0123456789ABCDEF";
  String salida;
  for (unsigned int i = 0; i < texto.length(); i++) {
    uint8_t c = texto[i];
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      salida += (char)c;
    } else {
      salida += '%';
      salida += hex[c >> 4];
      salida += hex[c & 0x0F];
    }
  }
  return salida;
}


/* ============================================================================
   20. COMANDOS DE PRUEBA POR MONITOR SERIE
   Reemplazan a la nube (Firebase) hasta la entrega 2.
   ============================================================================ */

// Junta los caracteres que llegan hasta formar una línea completa
void leerComandoSerie() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (bufferSerie.length() > 0) procesarComando(bufferSerie);
      bufferSerie = "";
    } else {
      bufferSerie += c;
      ultimoCaracterSerie = millis();
    }
  }
  // Si no llegó el "Enter", se procesa igual después de medio segundo
  if (bufferSerie.length() > 0 && millis() - ultimoCaracterSerie > 500) {
    procesarComando(bufferSerie);
    bufferSerie = "";
  }
}

// Interpreta un comando escrito en el Monitor Serie
void procesarComando(String comando) {
  comando.trim();
  String minusculas = comando;
  minusculas.toLowerCase();
  registrarInteraccion();

  if (minusculas.startsWith("audio")) {
    String remitente = comando.substring(5);   // Lo que sigue a "audio" es el nombre
    remitente.trim();
    if (remitente.length() == 0) remitente = "Mamá";
    recibirAudio(remitente, 8);                // Audio simulado de 8 segundos
  } else if (minusculas.startsWith("med")) {
    int numero = comando.substring(3).toInt();  // "med 2" = segunda medicación
    if (numero < 1 || numero > CANTIDAD_MEDICACIONES) numero = 1;
    medPendiente = numero - 1;
    if (estadoActual != REPOSO && estadoActual != AVISO_AUDIO) {
      Serial.println("(se mostrará cuando el dispositivo esté libre)");
    }
  } else if (minusculas.startsWith("cumple")) {
    int numero = comando.substring(6).toInt();  // "cumple 3" = tercer cumpleaños de la agenda
    if (numero < 1 || numero > CANTIDAD_CUMPLES) numero = 1;
    cumplePendiente = numero - 1;
  } else if (minusculas == "inactivo") {
    dispararAvisoInactividad();
  } else if (minusculas == "silencio") {
    modoSilencioso = !modoSilencioso;
    Serial.println(modoSilencioso ? "Modo silencioso: solo luz" : "Modo silencioso desactivado");
    if (estadoActual == REPOSO || estadoActual == AVISO_AUDIO) {
      if (modoSilencioso) mostrarMensajeTemporal(ICONO_SILENCIO, "Modo silencioso", "Solo luz, sin sonido", COLOR_HORA, 2500);
      else mostrarMensajeTemporal(ICONO_SONIDO, "Sonido activado", "", COLOR_HORA, 2500);
    }
  } else if (minusculas == "estado") {
    mostrarEstadoSerie();
  } else {
    mostrarAyudaSerie();
  }
}

void mostrarAyudaSerie() {
  Serial.println();
  Serial.println("----- COMANDOS DE PRUEBA (simulan lo que llega de la nube) -----");
  Serial.println("  audio          -> llega un audio de Mamá");
  Serial.println("  audio Abuelo   -> llega un audio de otra persona");
  Serial.println("  med / med 2    -> recordatorio de medicación (1, 2 o 3)");
  Serial.println("  cumple / cumple 3 -> cumpleaños (1-2: familia, 3-4: otras personas)");
  Serial.println("  inactivo       -> fuerza el aviso por inactividad");
  Serial.println("  silencio       -> activa/desactiva el modo silencioso");
  Serial.println("  estado         -> muestra el estado actual");
  Serial.println("BOTONES: blanco = tocar para elegir a quién / mantener para hablar");
  Serial.println("         verde = escuchar/confirmar");
  Serial.println("         rojo = SOS (mantener 3 segundos)");
  Serial.println("SENSOR DE LUZ: bajar los lux para probar el modo noche");
  Serial.println("----------------------------------------------------------------");
}

void mostrarEstadoSerie() {
  Serial.println("----- ESTADO -----");
  const char *nombres[] = { "REPOSO", "AVISO_AUDIO", "REPRODUCIENDO", "GRABANDO", "ENVIANDO",
                            "RECORDATORIO_MED", "AVISO_CUMPLE", "SOS_ACTIVO", "MENSAJE_TEMPORAL",
                            "ELIGIENDO" };
  Serial.println("Estado: " + String(nombres[estadoActual]) +
                 " | Hora: " + horaComoTexto() +
                 " | Audios sin escuchar: " + String(cantidadAudios) +
                 " | Noche: " + (modoNoche ? "sí" : "no") +
                 " | Silencioso: " + (modoSilencioso ? "sí" : "no") +
                 " | Luz (LDR): " + String(analogRead(PIN_LDR)) +
                 " | Wi-Fi: " + (WiFi.status() == WL_CONNECTED ? "sí" : "no"));
}


