// Mensajes de voz con el adulto mayor.
// Paso 1: la grabación y la reproducción se simulan (se ve el tiempo y la onda).
// En el paso 5 se graba con el micrófono del celular y se guarda en Firebase.
import { Icono } from '../iconos.js';
import { estado, nuevoId, nombreAdulto } from '../datos-ejemplo.js';

const { ref, onBeforeUnmount } = Vue;

// Alturas de la onda: cambian según el mensaje para que no se vean todas iguales
function onda(id) { return Array.from({ length: 16 }, (_, i) => 6 + ((i * 7 + id * 5) % 19)); }
function minutos(seg) { return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0'); }
function horaActual() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

export const PantallaMensajes = {
  name: 'PantallaMensajes',
  components: { Icono },
  setup() {
    const grabando = ref(false);
    const segundos = ref(0);
    const sonando = ref(null);        // id del mensaje que se está escuchando
    let reloj = null;
    let finSonido = null;

    function empezar() {
      if (grabando.value) return;
      grabando.value = true; segundos.value = 0;
      reloj = setInterval(() => { segundos.value += 1; if (segundos.value >= 60) terminar(); }, 1000);
    }
    function terminar() {
      if (!grabando.value) return;
      clearInterval(reloj); grabando.value = false;
      if (segundos.value < 1) return;       // un toque corto no manda nada
      estado.mensajes.push({ id: nuevoId(), de: 'Vos', mia: true, duracion: segundos.value, hora: horaActual(), escuchado: false });
    }
    function escuchar(m) {
      clearTimeout(finSonido);
      if (sonando.value === m.id) { sonando.value = null; return; }
      sonando.value = m.id;
      finSonido = setTimeout(() => { sonando.value = null; }, m.duracion * 1000);
    }
    onBeforeUnmount(() => { clearInterval(reloj); clearTimeout(finSonido); });

    return { estado, nombreAdulto, grabando, segundos, sonando, empezar, terminar, escuchar, onda, minutos };
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
        <span class="dia">Hoy</span>
        <div v-for="m in estado.mensajes" :key="m.id" class="burbuja-grupo" :class="{ mia: m.mia, reproduciendo: sonando === m.id }">
          <span class="de">{{ m.de }}</span>
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
            {{ m.hora }}
            <template v-if="m.mia">
              · <span :class="{ leido: m.escuchado }">{{ m.escuchado ? '✓✓ Escuchado' : '✓ Enviado' }}</span>
            </template>
          </span>
        </div>
      </div>

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
