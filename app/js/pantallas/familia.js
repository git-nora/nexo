// Familia: código para sumar familiares, integrantes y permisos.
// Solo el administrador ve y cambia los permisos de edición.
import { Icono } from '../iconos.js';
import { Interruptor } from '../componentes/comunes.js';
import { estado } from '../datos-ejemplo.js';
import { cambiarPermiso, mensajeDeError } from '../firebase.js';

const { ref } = Vue;

export const PantallaFamilia = {
  name: 'PantallaFamilia',
  components: { Icono, Interruptor },
  setup() {
    const copiado = ref('');
    const error = ref('');
    async function permiso(m, valor) {
      error.value = '';
      try { await cambiarPermiso(m.id, valor); } catch (e) { error.value = mensajeDeError(e); }
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
    return { estado, copiado, error, permiso, compartir };
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
        </div>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="estado.miembros.length === 1" class="nota">Por ahora sos la única persona. Compartí el código para que se sumen.</p>
      <p class="nota">
        <template v-if="estado.usuario.admin">Solo vos, como quien administra, ves los permisos. </template>
        El color es el que usa cada nombre en NEXO. Para recibir avisos urgentes, cada familiar conecta su Telegram desde Ajustes.
      </p>
    </div>`
};
