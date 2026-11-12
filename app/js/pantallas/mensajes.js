// Mensajes de voz con el adulto mayor.
// Los mensajes (quién, cuándo, cuánto dura, si se escuchó) ya se guardan en Firebase.
// El sonido todavía se simula: en el paso 5 se graba con el micrófono y se reproduce de verdad.
import { Icono } from '../iconos.js';
import { estado, nombreAdulto, nombreDe, hora, dia } from '../datos-ejemplo.js';
import { enviarMensaje, marcarEscuchado, mensajeDeError } from '../firebase.js';

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
    const segundos = ref(0);
    const sonando = ref(null);        // id del mensaje que se está escuchando
    const error = ref('');
    let reloj = null;
    let finSonido = null;

    function empezar() {
      if (grabando.value) return;
      grabando.value = true; segundos.value = 0;
      reloj = setInterval(() => { segundos.value += 1; if (segundos.value >= 60) terminar(); }, 1000);
    }
    async function terminar() {
      if (!grabando.value) return;
      clearInterval(reloj); grabando.value = false;
      if (segundos.value < 1) return;       // un toque corto no manda nada
      error.value = '';
      try { await enviarMensaje(Math.min(segundos.value, 60)); } catch (e) { error.value = mensajeDeError(e); }
    }
    const esMio = (m) => m.autor === estado.uid;
    // Muestra el día solo cuando cambia respecto del mensaje anterior
    const nuevoDia = (i) => i === 0 || dia(estado.mensajes[i].creado) !== dia(estado.mensajes[i - 1].creado);
    function escuchar(m) {
      clearTimeout(finSonido);
      if (sonando.value === m.id) { sonando.value = null; return; }
      sonando.value = m.id;
      // Si lo mandó NEXO (no un familiar), queda marcado como escuchado por la familia
      const deNexo = !estado.miembros.some((x) => x.id === m.autor);
      if (deNexo && !m.escuchado) marcarEscuchado(m.id).catch(() => {});
      finSonido = setTimeout(() => { sonando.value = null; }, m.duracion * 1000);
    }
    onBeforeUnmount(() => { clearInterval(reloj); clearTimeout(finSonido); });

    return { estado, nombreAdulto, nombreDe, hora, dia, esMio, nuevoDia, error, grabando, segundos, sonando, empezar, terminar, escuchar, onda, minutos };
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
                    :aria-label="(sonando === m.id ? 'Pausar' : 'Escuchar') + ' audio de ' + minutos(m.duracion)">
              <svg v-if="sonando !== m.id" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
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
          {{ grabando ? 'Grabando… ' + minutos(segundos) + ' · soltá para enviar' : 'Mantené apretado para grabar' }}
        </span>
      </div>
    </div>`
};
