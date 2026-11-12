// Ajustes: dispositivo, aviso por inactividad, tema y cuenta.
import { Icono } from '../iconos.js';
import { Interruptor } from '../componentes/comunes.js';
import { estado } from '../datos-ejemplo.js';
import { tema, cambiarTema } from '../tema.js';

const { ref } = Vue;

export const PantallaAjustes = {
  name: 'PantallaAjustes',
  components: { Icono, Interruptor },
  setup() {
    const router = VueRouter.useRouter();
    const editandoNombre = ref(false);
    const nombreNuevo = ref('');

    function cambiarHoras(delta) {
      const h = estado.ajustes.horasInactividad + delta;
      if (h >= 1 && h <= 24) estado.ajustes.horasInactividad = h;
    }
    function empezarNombre() { nombreNuevo.value = estado.usuario.nombre; editandoNombre.value = true; }
    function guardarNombre() {
      if (nombreNuevo.value.trim()) estado.usuario.nombre = nombreNuevo.value.trim();
      editandoNombre.value = false;
    }
    // Paso 1: simula la conexión. En el paso 4 abre el bot de Telegram de NEXO.
    function conectarTelegram() { estado.usuario.telegram = !estado.usuario.telegram; }
    function cerrarSesion() { estado.sesionIniciada = false; router.push('/ingreso'); }

    return { estado, tema, cambiarTema, cambiarHoras, editandoNombre, nombreNuevo, empezarNombre, guardarNombre, conectarTelegram, cerrarSesion };
  },
  template: `
    <div class="pantalla">
      <div class="encabezado">
        <div><router-link to="/mas" class="volver">‹ Más</router-link><h1>Ajustes</h1></div>
      </div>

      <div class="etiqueta-seccion">Dispositivo</div>
      <div class="lista">
        <div class="fila">
          <div class="texto"><span class="titulo" style="font-weight: 600">Perfil</span></div>
          <span class="detalle" style="font-size: 15px">Adulto mayor</span>
        </div>
        <div class="fila">
          <div class="texto">
            <span class="titulo" style="font-weight: 600">Modo silencioso</span>
            <span class="detalle">Solo luz, sin sonido (salvo SOS)</span>
          </div>
          <interruptor v-model="estado.ajustes.silencioso" etiqueta="Modo silencioso" />
        </div>
      </div>

      <div class="etiqueta-seccion">Aviso por inactividad</div>
      <div class="lista">
        <div class="fila" style="flex-wrap: wrap">
          <div class="texto"><span class="titulo" style="font-weight: 600">Avisar después de</span></div>
          <div class="contador">
            <button type="button" class="boton-icono" aria-label="Menos horas" @click="cambiarHoras(-1)" style="font-size: 20px; font-weight: 700">−</button>
            <output aria-live="polite">{{ estado.ajustes.horasInactividad }} {{ estado.ajustes.horasInactividad === 1 ? 'hora' : 'horas' }}</output>
            <button type="button" class="boton-icono" aria-label="Más horas" @click="cambiarHoras(1)" style="font-size: 20px; font-weight: 700">+</button>
          </div>
        </div>
        <div class="fila" style="flex-direction: column; align-items: stretch; gap: 8px">
          <span class="titulo" style="font-weight: 600">Contar solo entre</span>
          <div class="horario">
            <label for="desde" class="detalle">Desde</label>
            <input id="desde" type="time" v-model="estado.ajustes.desde">
            <label for="hasta" class="detalle">hasta</label>
            <input id="hasta" type="time" v-model="estado.ajustes.hasta">
          </div>
          <span class="detalle">Fuera de ese horario no cuenta, para no avisar por las horas de sueño.</span>
        </div>
      </div>

      <div class="etiqueta-seccion">Apariencia y cuenta</div>
      <div class="lista">
        <div class="fila">
          <div class="texto"><span class="titulo" style="font-weight: 600">Tema</span></div>
          <div class="segmentos" role="group" aria-label="Tema" style="min-width: 170px">
            <button type="button" :aria-pressed="tema.modo === 'claro' ? 'true' : 'false'" @click="cambiarTema('claro')">Claro</button>
            <button type="button" :aria-pressed="tema.modo === 'oscuro' ? 'true' : 'false'" @click="cambiarTema('oscuro')">Oscuro</button>
          </div>
        </div>
        <div class="fila">
          <div class="texto"><span class="titulo" style="font-weight: 600">Tu nombre en NEXO</span></div>
          <form v-if="editandoNombre" @submit.prevent="guardarNombre" style="display: flex; gap: 8px; align-items: center">
            <label for="nombre-nexo" class="detalle" style="position: absolute; left: -9999px">Tu nombre en NEXO</label>
            <input id="nombre-nexo" type="text" v-model="nombreNuevo" style="width: 120px; height: 44px; border-radius: 12px; padding: 0 10px; border: 1.5px solid var(--borde); background: var(--fondo)">
            <button type="submit" class="boton-texto">Listo</button>
          </form>
          <button v-else type="button" class="boton-texto" @click="empezarNombre">{{ estado.usuario.nombre }} ›</button>
        </div>
        <div class="fila">
          <div class="texto">
            <span class="titulo" style="font-weight: 600">Telegram para avisos</span>
            <span class="detalle">{{ estado.usuario.telegram ? 'Te llegan los avisos urgentes' : 'Conectalo para recibir SOS y alertas' }}</span>
          </div>
          <button type="button" class="boton-texto" :style="{ color: estado.usuario.telegram ? 'var(--verde)' : 'var(--enlace)' }" @click="conectarTelegram">
            {{ estado.usuario.telegram ? 'Conectado' : 'Conectar' }}
          </button>
        </div>
        <button type="button" class="boton-texto boton-peligro" style="width: 100%; min-height: 52px" @click="cerrarSesion">Cerrar sesión</button>
      </div>
    </div>`
};
