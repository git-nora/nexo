// Audio de los mensajes: grabar con el micrófono del celular y reproducir.
// Se graba en WAV (PCM 16 bits, 16 kHz, mono): es el formato que el ESP32 de NEXO
// puede reproducir por I2S sin decodificar, y que el módulo INMP441 también genera.

export const FRECUENCIA = 16000;            // muestras por segundo
export const MAXIMO_SEGUNDOS = 60;

// --- Grabar ---

// Empieza a grabar. Devuelve { detener(), cancelar() }.
// detener() termina y devuelve { b64, segundos } (b64 = WAV en base64).
export async function empezarGrabacion() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw { code: 'nexo/sin-microfono' };
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (e) {
    throw { code: e && e.name === 'NotAllowedError' ? 'nexo/microfono-bloqueado' : 'nexo/sin-microfono' };
  }
  const Contexto = window.AudioContext || window.webkitAudioContext;
  const ctx = new Contexto();
  await ctx.resume();
  const fuente = ctx.createMediaStreamSource(stream);
  // ScriptProcessor está marcado como viejo, pero funciona en todos los celulares (también iPhone)
  const proceso = ctx.createScriptProcessor(4096, 1, 1);
  const trozos = [];
  proceso.onaudioprocess = (e) => { trozos.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  fuente.connect(proceso);
  proceso.connect(ctx.destination);          // la salida queda en silencio; sin esto Chrome no procesa

  function cerrar() {
    try { fuente.disconnect(); proceso.disconnect(); } catch (e) { /* ya estaba cerrado */ }
    stream.getTracks().forEach((t) => t.stop());   // apaga el micrófono (se va el aviso del celular)
    ctx.close().catch(() => {});
  }

  return {
    cancelar: cerrar,
    async detener() {
      const frecuenciaOriginal = ctx.sampleRate;
      cerrar();
      const total = trozos.reduce((n, t) => n + t.length, 0);
      const todo = new Float32Array(total);
      let pos = 0;
      for (const t of trozos) { todo.set(t, pos); pos += t.length; }
      const muestras = bajarFrecuencia(todo, frecuenciaOriginal, FRECUENCIA).subarray(0, FRECUENCIA * MAXIMO_SEGUNDOS);
      return { b64: aBase64(armarWav(muestras, FRECUENCIA)), segundos: muestras.length / FRECUENCIA };
    }
  };
}

// El celular graba a 44,1 o 48 kHz: se promedia de a grupos para pasar a 16 kHz
function bajarFrecuencia(entrada, de, a) {
  if (de === a) return entrada;
  const razon = de / a;
  const salida = new Float32Array(Math.floor(entrada.length / razon));
  for (let i = 0; i < salida.length; i++) {
    const ini = Math.floor(i * razon), fin = Math.min(Math.floor((i + 1) * razon), entrada.length);
    let suma = 0;
    for (let j = ini; j < fin; j++) suma += entrada[j];
    salida[i] = suma / Math.max(1, fin - ini);
  }
  return salida;
}

// Encabezado WAV de 44 bytes + muestras de 16 bits
function armarWav(muestras, frecuencia) {
  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(buffer);
  const texto = (pos, s) => { for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); v.setUint32(4, 36 + muestras.length * 2, true); texto(8, 'WAVE');
  texto(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true); v.setUint32(28, frecuencia * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  texto(36, 'data'); v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function aBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// --- Reproducir ---

// Un solo reproductor para toda la app. En iPhone, el sonido solo puede arrancar
// dentro del toque: por eso desbloquear() se llama apenas se toca play, antes de bajar el audio.
const reproductor = new Audio();
reproductor.preload = 'auto';
const SILENCIO = 'data:audio/wav;base64,' + aBase64(armarWav(new Float32Array(160), FRECUENCIA));
const enMemoria = new Map();               // id del mensaje -> URL del audio ya bajado

export function desbloquear() {
  reproductor.src = SILENCIO;
  reproductor.play().catch(() => {});
}

export function yaBajado(id) { return enMemoria.has(id); }

// Reproduce el WAV en base64. alTerminar() se llama cuando termina o se corta.
export async function reproducir(id, b64, alTerminar) {
  if (!enMemoria.has(id)) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    enMemoria.set(id, URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
  }
  reproductor.onended = alTerminar;
  reproductor.onerror = alTerminar;
  reproductor.src = enMemoria.get(id);
  await reproductor.play();
}

export function pausar() {
  reproductor.pause();
  reproductor.onended = null;
  reproductor.onerror = null;
}
