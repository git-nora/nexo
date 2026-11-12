// "Más": acceso a Familia y Ajustes.
import { Icono } from '../iconos.js';
import { estado } from '../datos-ejemplo.js';

export const PantallaMas = {
  name: 'PantallaMas',
  components: { Icono },
  setup() { return { estado }; },
  template: `
    <div class="pantalla">
      <div class="encabezado"><div><div class="sobre">{{ estado.usuario.nombre }}</div><h1>Más</h1></div></div>
      <div class="lista">
        <router-link to="/familia" class="fila" style="text-decoration: none; color: inherit">
          <div class="circulo-icono" style="background: var(--primario-suave); color: var(--primario)"><icono nombre="familia" :tam="20" /></div>
          <div class="texto"><span class="titulo">Familia</span><span class="detalle">Código, integrantes y permisos</span></div>
          <icono nombre="flecha" :tam="18" />
        </router-link>
        <router-link to="/ajustes" class="fila" style="text-decoration: none; color: inherit">
          <div class="circulo-icono" style="background: var(--primario-suave); color: var(--primario)"><icono nombre="ajustes" :tam="20" /></div>
          <div class="texto"><span class="titulo">Ajustes</span><span class="detalle">Dispositivo, inactividad, tema y cuenta</span></div>
          <icono nombre="flecha" :tam="18" />
        </router-link>
      </div>
    </div>`
};
