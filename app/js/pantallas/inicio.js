// Pantalla de inicio: estado del dispositivo, alertas y accesos rápidos.
import { Icono } from '../iconos.js';
import { estado, nombreAdulto, cuandoCorto, haceCuanto } from '../datos-ejemplo.js';
import { atenderAlerta, mensajeDeError } from '../firebase.js';
import { tema, cambiarTema } from '../tema.js';

// Cada tipo de alerta usa el mismo color que el halo de NEXO
const ESTILO_ALERTA = {
  sos: { icono: 'sos', color: 'var(--rojo)', fondo: 'var(--rojo-suave)', titulo: 'Pidió ayuda (SOS)' },
  medicacion: { icono: 'pastilla', color: 'var(--naranja)', fondo: 'var(--naranja-suave)', titulo: 'Medicación sin confirmar' },
  llamada: { icono: 'telefono', color: 'var(--azul)', fondo: 'var(--azul-suave)', titulo: 'Pidió una llamada' },
  inactividad: { icono: 'reloj', color: 'var(--naranja)', fondo: 'var(--naranja-suave)', titulo: 'Sin actividad' }
};
const { ref } = Vue;

export const PantallaInicio = {
  name: 'PantallaInicio',
  components: { Icono },
  setup() {
    const alternarTema = () => cambiarTema(tema.modo === 'oscuro' ? 'claro' : 'oscuro');
    const accesos = [
      { ruta: '/mensajes', texto: 'Enviar audio', icono: 'microfono' },
      { ruta: '/medicacion', texto: 'Medicación', icono: 'pastilla' },
      { ruta: '/cumpleanos', texto: 'Cumpleaños', icono: 'torta' },
      { ruta: '/familia', texto: 'Familia', icono: 'familia' }
    ];
    const error = ref('');
    async function atendida(a) {
      error.value = '';
      try { await atenderAlerta(a.id); } catch (e) { error.value = mensajeDeError(e); }
    }
    return { estado, nombreAdulto, cuandoCorto, haceCuanto, tema, alternarTema, accesos, ESTILO_ALERTA, error, atendida };
  },
  template: `
    <div class="pantalla">
      <div class="encabezado">
        <div>
          <div class="sobre">Hola, {{ estado.usuario.nombre }}</div>
          <h1>{{ estado.familia.adultoMayor ? 'NEXO de ' + estado.familia.adultoMayor : 'Tu NEXO' }}</h1>
        </div>
        <button type="button" class="boton-icono" @click="alternarTema"
                :aria-label="tema.modo === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
          <icono :nombre="tema.modo === 'oscuro' ? 'sol' : 'luna'" :tam="22" />
        </button>
      </div>

      <div class="tarjeta estado">
        <div class="punto" :class="{ apagado: !estado.familia.enLinea }"></div>
        <div v-if="estado.familia.enLinea === null">
          <div style="font-size: 16px; font-weight: 700">Esperando al dispositivo</div>
          <div class="nota" style="font-size: 14px">NEXO todavía no se conectó a esta familia.</div>
        </div>
        <div v-else>
          <div style="font-size: 16px; font-weight: 700">{{ estado.familia.enLinea ? 'En línea' : 'Sin conexión' }}</div>
          <div class="nota" style="font-size: 14px">Último uso: {{ estado.familia.ultimoUso ? haceCuanto(estado.familia.ultimoUso) : 'sin datos' }}</div>
        </div>
      </div>

      <h2 class="seccion">Alertas</h2>
      <div class="lista">
        <div v-for="a in estado.alertas" :key="a.id" class="fila">
          <div class="circulo-icono" :style="{ color: ESTILO_ALERTA[a.tipo].color, background: ESTILO_ALERTA[a.tipo].fondo }">
            <icono :nombre="ESTILO_ALERTA[a.tipo].icono" :tam="20" />
          </div>
          <div class="texto">
            <span class="titulo">{{ ESTILO_ALERTA[a.tipo].titulo }}</span>
            <span class="detalle">{{ a.detalle || cuandoCorto(a.creado) }}</span>
          </div>
          <span class="detalle" style="font-weight: 600">{{ cuandoCorto(a.creado) }}</span>
          <button type="button" class="boton-icono" @click="atendida(a)"
                  :aria-label="'Marcar como atendida: ' + ESTILO_ALERTA[a.tipo].titulo" title="Ya la atendí">
            <icono nombre="ok" :tam="18" :grosor="2.4" />
          </button>
        </div>
        <div v-if="!estado.alertas.length" class="vacio">Sin alertas. Todo tranquilo.</div>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="estado.alertas.length" class="nota">Tocá ✓ cuando ya la atendiste: se borra para toda la familia.</p>

      <h2 class="seccion">Accesos rápidos</h2>
      <div class="accesos">
        <router-link v-for="q in accesos" :key="q.ruta" :to="q.ruta">
          <icono :nombre="q.icono" :tam="22" /><span>{{ q.texto }}</span>
        </router-link>
      </div>
    </div>`
};
