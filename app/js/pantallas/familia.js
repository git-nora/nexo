// Familia: código para sumar familiares, integrantes y permisos.
// Solo el administrador ve y cambia los permisos de edición.
import { Icono } from '../iconos.js';
import { Interruptor, HojaInferior } from '../componentes/comunes.js';
import { estado } from '../datos-ejemplo.js';
import { cambiarPermiso, quitarMiembro, permitirVolver, mensajeDeError } from '../firebase.js';

const { ref } = Vue;

export const PantallaFamilia = {
  name: 'PantallaFamilia',
  components: { Icono, Interruptor, HojaInferior },
  setup() {
    const copiado = ref('');
    const error = ref('');
    async function permiso(m, valor) {
      error.value = '';
      try { await cambiarPermiso(m.id, valor); } catch (e) { error.value = mensajeDeError(e); }
    }
    // Quitar a alguien: primero se confirma en una hoja abajo
    const aQuitar = ref(null);
    const ocupado = ref(false);
    async function confirmarQuitar() {
      if (ocupado.value) return;
      ocupado.value = true; error.value = '';
      try { await quitarMiembro(aQuitar.value); aQuitar.value = null; }
      catch (e) { error.value = mensajeDeError(e); aQuitar.value = null; }
      finally { ocupado.value = false; }
    }
    async function dejarVolver(b) {
      error.value = '';
      try { await permitirVolver(b.id); } catch (e) { error.value = mensajeDeError(e); }
    }
    async function compartir() {
      const de = estado.familia.adultoMayor ? ' de ' + estado.familia.adultoMayor : '';
      const texto = 'Sumate a NEXO' + de + '. Instalá la app desde ' + location.href.split('#')[0] + ' y usá el código ' + estado.familia.codigo;
      try {
        await navigator.clipboard.writeText(texto);
        copiado.value = 'Código copiado. Pegalo en un mensaje para tu familiar.';
      } catch (e) {
        copiado.value = 'No se pudo copiar solo. Anotá el código: ' + estado.familia.codigo;
      }
    }
    return { estado, copiado, error, permiso, compartir, aQuitar, ocupado, confirmarQuitar, dejarVolver };
  },
  template: `
    <div class="pantalla">
      <div class="encabezado">
        <div><router-link to="/mas" class="volver">‹ Más</router-link><h1>Familia</h1></div>
      </div>

      <div class="codigo-familia">
        <div style="font-size: 14px; font-weight: 600">Código de familia</div>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap">
          <span class="codigo">{{ estado.familia.codigo }}</span>
          <button type="button" class="boton-agregar" @click="compartir"><icono nombre="compartir" :tam="18" />Compartir</button>
        </div>
        <p class="nota">{{ copiado || 'Pasáselo a otro familiar para que cree su cuenta y se sume.' }}</p>
      </div>

      <h2 class="seccion">En el dispositivo</h2>
      <div class="lista">
        <div v-for="m in estado.miembros" :key="m.id" class="fila miembro">
          <div class="arriba">
            <div class="avatar" :style="{ background: m.color }">{{ m.nombre[0] }}</div>
            <div class="texto">
              <span class="titulo">{{ m.nombre }}</span>
              <span class="detalle" :style="{ color: m.telegram ? 'var(--verde)' : 'var(--tenue)' }">
                {{ m.telegram ? 'Telegram conectado' : 'Telegram sin conectar' }}
              </span>
            </div>
            <span v-if="m.admin" class="insignia">Administra{{ m.soyYo ? ' · Vos' : '' }}</span>
          </div>
          <div v-if="estado.usuario.admin && !m.admin" class="permiso">
            <span>Puede editar medicación y cumpleaños</span>
            <interruptor :model-value="!!m.puedeEditar" @update:model-value="(v) => permiso(m, v)"
                         :etiqueta="'Permitir a ' + m.nombre + ' editar medicación y cumpleaños'" />
          </div>
          <button v-if="estado.usuario.admin && !m.admin" type="button" class="boton-texto boton-peligro"
                  style="align-self: flex-start; padding-left: 52px" @click="aQuitar = m">Quitar de la familia</button>
        </div>
      </div>
      <template v-if="estado.usuario.admin && estado.bloqueados.length">
        <h2 class="seccion">Quitados de la familia</h2>
        <div class="lista">
          <div v-for="b in estado.bloqueados" :key="b.id" class="fila">
            <div class="texto">
              <span class="titulo" style="font-weight: 600">{{ b.nombre }}</span>
              <span class="detalle">No puede volver a sumarse con el código</span>
            </div>
            <button type="button" class="boton-texto" @click="dejarVolver(b)">Permitir volver</button>
          </div>
        </div>
      </template>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="estado.miembros.length === 1" class="nota">Por ahora sos la única persona. Compartí el código para que se sumen.</p>
      <p class="nota">
        <template v-if="estado.usuario.admin">Solo vos, como quien administra, ves los permisos. </template>
        El color es el que usa cada nombre en NEXO. Para recibir avisos urgentes, cada familiar conecta su Telegram desde Ajustes.
      </p>

      <hoja-inferior v-if="aQuitar" :titulo="'¿Quitar a ' + aQuitar.nombre + '?'" @cerrar="aQuitar = null">
        <div class="formulario">
          <p style="margin: 0">{{ aQuitar.nombre }} deja de ver los mensajes, la medicación y los avisos de esta familia,
            y no va a poder volver a sumarse con el código hasta que vos lo permitas.</p>
          <p class="nota" style="margin: 0">Los mensajes que mandó quedan en el chat.</p>
          <button type="button" class="boton-primario" style="background: var(--rojo)" :disabled="ocupado" @click="confirmarQuitar">
            {{ ocupado ? 'Quitando…' : 'Sí, quitar a ' + aQuitar.nombre }}
          </button>
          <button type="button" class="boton-texto" @click="aQuitar = null">Cancelar</button>
        </div>
      </hoja-inferior>
    </div>`
};
