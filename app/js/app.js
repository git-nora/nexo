// Punto de entrada de la app NEXO Familia (Vue 3 + Vue Router, sin compilar).
import { Icono } from './iconos.js';
import { BarraNavegacion } from './componentes/comunes.js';
import { estado } from './datos-ejemplo.js';
import { aplicarTema } from './tema.js';
import { vigilarSesion } from './firebase.js';
import { PantallaIngreso } from './pantallas/ingreso.js';
import { PantallaInicio } from './pantallas/inicio.js';
import { PantallaMensajes } from './pantallas/mensajes.js';
import { PantallaMedicacion } from './pantallas/medicacion.js';
import { PantallaCumpleanos } from './pantallas/cumpleanos.js';
import { PantallaMas } from './pantallas/mas.js';
import { PantallaFamilia } from './pantallas/familia.js';
import { PantallaAjustes } from './pantallas/ajustes.js';

const { createApp, computed, watch } = Vue;

// Rutas: cada pantalla tiene su dirección (#/inicio, #/mensajes, ...)
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/inicio' },
    { path: '/ingreso', component: PantallaIngreso },
    { path: '/inicio', component: PantallaInicio },
    { path: '/mensajes', component: PantallaMensajes },
    { path: '/medicacion', component: PantallaMedicacion },
    { path: '/cumpleanos', component: PantallaCumpleanos },
    { path: '/mas', component: PantallaMas },
    { path: '/familia', component: PantallaFamilia },
    { path: '/ajustes', component: PantallaAjustes },
    { path: '/:pathMatch(.*)*', redirect: '/inicio' }
  ],
  scrollBehavior: () => ({ top: 0 })
});

// Sin sesión, o con sesión pero sin familia, solo se puede ver la pantalla de ingreso
const puedeEntrar = () => estado.sesionIniciada && !!estado.familiaId;
router.beforeEach((destino) => {
  if (!puedeEntrar() && destino.path !== '/ingreso') return '/ingreso';
  if (puedeEntrar() && destino.path === '/ingreso') return '/inicio';
  return true;
});

const App = {
  components: { BarraNavegacion, Icono },
  setup() {
    const route = VueRouter.useRoute();
    const router = VueRouter.useRouter();
    const conBarra = computed(() => route.path !== '/ingreso');
    // Si la sesión se cierra (desde Ajustes o porque venció), vuelve a ingreso
    watch(() => estado.sesionIniciada, (hay) => { if (!hay && route.path !== '/ingreso') router.push('/ingreso'); });
    // Si quien administra te quita de la familia, también vuelve a ingreso
    watch(() => estado.familiaId, (id) => { if (!id && route.path !== '/ingreso') router.push('/ingreso'); });
    return { conBarra };
  },
  template: `
    <div class="app" :class="{ 'con-barra': conBarra }">
      <main><router-view></router-view></main>
      <barra-navegacion v-if="conBarra"></barra-navegacion>
    </div>`
};

aplicarTema();
// Espera a saber si hay una sesión guardada antes de mostrar la app
vigilarSesion(() => {
  createApp(App).component('icono', Icono).use(router).mount('#app');
});

// Instalar como app: registra el service worker (solo funciona en https o localhost)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline: la app funciona igual */ });
}
