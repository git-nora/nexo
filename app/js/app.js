// Punto de entrada de la app NEXO Familia (Vue 3 + Vue Router, sin compilar).
import { Icono } from './iconos.js';
import { BarraNavegacion } from './componentes/comunes.js';
import { estado } from './datos-ejemplo.js';
import { aplicarTema } from './tema.js';
import { PantallaIngreso } from './pantallas/ingreso.js';
import { PantallaInicio } from './pantallas/inicio.js';
import { PantallaMensajes } from './pantallas/mensajes.js';
import { PantallaMedicacion } from './pantallas/medicacion.js';
import { PantallaCumpleanos } from './pantallas/cumpleanos.js';
import { PantallaMas } from './pantallas/mas.js';
import { PantallaFamilia } from './pantallas/familia.js';
import { PantallaAjustes } from './pantallas/ajustes.js';

const { createApp, computed } = Vue;

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

// Sin sesión iniciada solo se puede ver la pantalla de ingreso
router.beforeEach((destino) => {
  if (!estado.sesionIniciada && destino.path !== '/ingreso') return '/ingreso';
  if (estado.sesionIniciada && destino.path === '/ingreso') return '/inicio';
  return true;
});

const App = {
  components: { BarraNavegacion, Icono },
  setup() {
    const route = VueRouter.useRoute();
    const conBarra = computed(() => route.path !== '/ingreso');
    return { conBarra };
  },
  template: `
    <div class="app" :class="{ 'con-barra': conBarra }">
      <main><router-view></router-view></main>
      <barra-navegacion v-if="conBarra"></barra-navegacion>
    </div>`
};

aplicarTema();
createApp(App).component('icono', Icono).use(router).mount('#app');

// Instalar como app: registra el service worker (solo funciona en https o localhost)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline: la app funciona igual */ });
}
