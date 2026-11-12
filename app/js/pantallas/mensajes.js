// Mensajes de voz con el adulto mayor.
// Se graba con el micrófono del celular (mantener apretado), se guarda en Firebase
// y se reproduce al tocar play. Ver audio.js para el formato (WAV 16 kHz).
import { Icono } from '../iconos.js';
import { estado, nombreAdulto, nombreDe, hora, dia } from '../datos-ejemplo.js';
import { enviarMensaje, obtenerAudio, marcarEscuchado, mensajeDeError } from '../firebase.js';
import { empezarGrabacion, desbloquear, reproducir, pausar, MAXIMO_SEGUNDOS } from '../audio.js';

const { ref, onBeforeUnmount } = Vue;

// Alturas de la onda: cambian según el mensaje para que no se vean todas iguales
function onda(id) {
  const n = [...String(id)].reduce((t, c) => t + c.charCodeAt(0), 0);
  return Array.from({ length: 16 }, (_, i) => 6 + ((i * 7 + n * 5) % 19));
}
function minutos(seg) { return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); }

export const PantallaMensajes = {
  name: 'PantallaMensajes',
  components: { Icono },
  setup() {
    const grabando = ref(false);
    const enviando = ref(false);
    const segundos = ref(0);
    const sonando = ref(null);        // id del mensaje que se está escuchando
    const cargando = ref(null);       // id del mensaje cuyo audio se está bajando
    const error = ref('');
    let reloj = null;
    let grabacion = null;             // la grabación en curso
    let soltado = false;              // se soltó el botón antes de que el micrófono arrancara

    async function empezar() {
      if (grabando.value || enviando.value) return;
      error.value = ''; soltado = false;
      parar();
      grabando.value = true; segundos.value = 0;
      try {
        const g = await empezarGrabacion();
        if (soltado) { g.cancelar(); grabando.value = false; return; }   // fue un toque corto
        grabacion = g;
        reloj = setInterval(() => { segundos.value += 1; if (segundos.value >= MAXIMO_SEGUNDOS) terminar(); }, 1000);
      } catch (e) {
        grabando.value = false;
        error.value = mensajeDeError(e);
      }
    }
    async function terminar() {
      soltado = true;
      if (!grabacion) return;
      clearInterval(reloj);
      const g = grabacion; grabacion = null;
      grabando.value = false;
      const r = await g.detener();
      if (r.segundos < 1) { error.value = 'Mantené apretado el botón mientras hablás (al menos 1 segundo).'; return; }
      enviando.value = true;
      try { await enviarMensaje(Math.min(MAXIMO_SEGUNDOS, Math.max(1, Math.round(r.segundos))), r.b64); }
      catch (e) { error.value = mensajeDeError(e); }
      finally { enviando.value = false; }
    }

    const esMio = (m) => m.autor === estado.uid;
    // Muestra el día solo cuando cambia respecto del mensaje anterior
    const nuevoDia = (i) => i === 0 || dia(estado.mensajes[i].creado) !== dia(estado.mensajes[i - 1].creado);

    function parar() { pausar(); sonando.value = null; }
    async function escuchar(m) {
      if (sonando.value === m.id || cargando.value === m.id) { parar(); cargando.value = null; return; }
      parar();
      error.value = '';
      if (!m.audio) { error.value = mensajeDeError({ code: 'nexo/sin-sonido' }); return; }
      desbloquear();                   // en iPhone el sonido tiene que arrancar dentro del toque
      cargando.value = m.id;
      try {
        const b64 = await obtenerAudio(m.id);
        if (cargando.value !== m.id) return;          // tocaron otro mensaje mientras bajaba
        cargando.value = null;
        if (!b64) { error.value = 'No se encontró el audio de este mensaje.'; return; }
        sonando.value = m.id;
        await reproducir(m.id, b64, () => { if (sonando.value === m.id) sonando.value = null; });
        // Si lo mandó NEXO (no un familiar), queda marcado como escuchado por la familia
        const deNexo = !estado.miembros.some((x) => x.id === m.autor);
        if (deNexo && !m.escuchado) marcarEscuchado(m.id).catch(() => {});
      } catch (e) {
        cargando.value = null; sonando.value = null;
        error.value = e && e.name === 'NotAllowedError'
          ? 'El celular no dejó reproducir el audio. Tocá play de nuevo.'
          : mensajeDeError(e);
      }
    }
    onBeforeUnmount(() => {
      clearInterval(reloj);
      if (grabacion) grabacion.cancelar();
      parar();
    });

    return { estado, nombreAdulto, nombreDe, hora, dia, esMio, nuevoDia, error, grabando, enviando, segundos, sonando, cargando, empezar, terminar, escuchar, onda, minutos };
  },
  template: `
    <div class="pantalla mensajes-pantalla">
      <div class="encabezado">
        <div>
          <div class="sobre">Mensajes con</div>
          <h1>{{ nombreAdulto() }}</h1>
        </div>
      </div>

      <div class="chat" aria-live="polite">
        <div v-if="!estado.mensajes.length" class="vacio" style="text-align: center">
          Todavía no hay mensajes. Mantené apretado el micrófono para mandarle un audio a {{ nombreAdulto() }}.
        </div>
        <template v-for="(m, i) in estado.mensajes" :key="m.id">
        <span v-if="nuevoDia(i)" class="dia">{{ dia(m.creado) }}</span>
        <div class="burbuja-grupo" :class="{ mia: esMio(m), reproduciendo: sonando === m.id }">
          <span class="de">{{ nombreDe(m.autor) }}</span>
          <div class="burbuja">
            <button type="button" class="reproducir" @click="escuchar(m)"
                    :aria-label="(sonando === m.id ? 'Pausar' : cargando === m.id ? 'Cargando' : 'Escuchar') + ' audio de ' + minutos(m.duracion)">
              <span v-if="cargando === m.id" class="girando" aria-hidden="true"></span>
              <svg v-else-if="sonando !== m.id" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
            </button>
            <div class="onda" aria-hidden="true">
              <i v-for="(h, i) in onda(m.id)" :key="i" :style="{ height: h + 'px', animationDelay: (i * 60) + 'ms' }"></i>
            </div>
            <span class="duracion">{{ minutos(m.duracion) }}</span>
          </div>
          <span class="pie">
            {{ hora(m.creado) }}
            <template v-if="esMio(m)">
              · <span :class="{ leido: m.escuchado }">{{ m.escuchado ? '✓✓ Escuchado' : '✓ Enviado' }}</span>
            </template>
          </span>
        </div>
        </template>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="grabar-zona">
        <button type="button" class="grabar" :class="{ activo: grabando }"
                aria-label="Mantené apretado para grabar un audio"
                @pointerdown.prevent="empezar" @pointerup="terminar" @pointerleave="terminar" @pointercancel="terminar"
                @keydown.space.prevent="empezar" @keyup.space="terminar" @contextmenu.prevent>
          <icono nombre="microfono" :tam="36" />
        </button>
        <span class="grabar-texto" aria-live="polite">
          {{ enviando ? 'Enviando…' : grabando ? 'Grabando… ' + minutos(segundos) + ' · soltá para enviar' : 'Mantené apretado para grabar' }}
        </span>
      </div>
    </div>`
};
