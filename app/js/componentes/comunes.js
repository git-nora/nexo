// Componentes que se usan en varias pantallas.
import { Icono } from '../iconos.js';

// Interruptor sí/no. Uso: <interruptor v-model="valor" etiqueta="Modo silencioso" />
export const Interruptor = {
  name: 'Interruptor',
  props: { modelValue: Boolean, etiqueta: String, deshabilitado: Boolean },
  emits: ['update:modelValue'],
  template: `
    <button type="button" class="interruptor" role="switch" :aria-checked="modelValue ? 'true' : 'false'"
            :aria-label="etiqueta" :disabled="deshabilitado" @click="$emit('update:modelValue', !modelValue)">
      <span></span>
    </button>`
};

// Hoja que sube desde abajo, para los formularios de agregar o editar
export const HojaInferior = {
  name: 'HojaInferior',
  components: { Icono },
  props: { titulo: String },
  emits: ['cerrar'],
  template: `
    <div class="velo" @click.self="$emit('cerrar')" @keydown.esc="$emit('cerrar')">
      <section class="hoja" role="dialog" aria-modal="true" :aria-label="titulo">
        <div class="hoja-encabezado">
          <h2>{{ titulo }}</h2>
          <button type="button" class="boton-icono" aria-label="Cerrar" @click="$emit('cerrar')">
            <icono nombre="cerrar" :tam="20" />
          </button>
        </div>
        <slot></slot>
      </section>
    </div>`
};

// Barra fija de abajo con las 5 secciones principales
export const BarraNavegacion = {
  name: 'BarraNavegacion',
  components: { Icono },
  setup() {
    const secciones = [
      { ruta: '/inicio', texto: 'Inicio', icono: 'inicio' },
      { ruta: '/mensajes', texto: 'Mensajes', icono: 'mensajes' },
      { ruta: '/medicacion', texto: 'Medicación', icono: 'pastilla' },
      { ruta: '/cumpleanos', texto: 'Cumpleaños', icono: 'torta' },
      { ruta: '/mas', texto: 'Más', icono: 'mas' }
    ];
    // "Más" queda marcado también dentro de Familia y Ajustes
    const route = VueRouter.useRoute();
    const activa = (ruta) => route.path === ruta ||
      (ruta === '/mas' && (route.path === '/familia' || route.path === '/ajustes'));
    return { secciones, activa };
  },
  template: `
    <nav class="barra" aria-label="Secciones">
      <ul>
        <li v-for="s in secciones" :key="s.ruta">
          <router-link :to="s.ruta" :class="{ activo: activa(s.ruta) }" :aria-current="activa(s.ruta) ? 'page' : null">
            <icono :nombre="s.icono" />
            <span>{{ s.texto }}</span>
          </router-link>
        </li>
      </ul>
    </nav>`
};
