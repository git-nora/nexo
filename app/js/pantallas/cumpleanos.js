// Cumpleaños: el próximo arriba, después familia y otras personas.
import { Icono } from '../iconos.js';
import { HojaInferior, Interruptor } from '../componentes/comunes.js';
import { estado, nombreAdulto, NOMBRES_MESES } from '../datos-ejemplo.js';
import { guardarCumple, borrarCumple, mensajeDeError } from '../firebase.js';

const { ref, reactive, computed } = Vue;

// Días que faltan desde hoy hasta el próximo cumpleaños (0 = hoy)
function diasHasta(c) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  let fecha = new Date(hoy.getFullYear(), c.mes - 1, c.dia);
  if (fecha < hoy) fecha = new Date(hoy.getFullYear() + 1, c.mes - 1, c.dia);
  return Math.round((fecha - hoy) / 86400000);
}
const fechaCorta = (c) => c.dia + ' ' + NOMBRES_MESES[c.mes - 1].slice(0, 3);

export const PantallaCumpleanos = {
  name: 'PantallaCumpleanos',
  components: { Icono, HojaInferior, Interruptor },
  setup() {
    const puedeEditar = computed(() => estado.usuario.admin || estado.usuario.puedeEditar);
    const ordenados = computed(() => [...estado.cumples].sort((a, b) => diasHasta(a) - diasHasta(b)));
    const proximo = computed(() => ordenados.value[0]);
    const familia = computed(() => ordenados.value.filter(c => c.esFamilia));
    const otros = computed(() => ordenados.value.filter(c => !c.esFamilia));
    const textoFaltan = (c) => { const d = diasHasta(c); return d === 0 ? 'Es hoy' : d === 1 ? 'Es mañana' : 'Faltan ' + d + ' días'; };

    const abierta = ref(false);
    const editando = ref(null);
    const form = reactive({ nombre: '', relacion: '', dia: 1, mes: 1, esFamilia: true });
    const error = ref('');
    const guardando = ref(false);

    function abrir(c) {
      editando.value = c || null;
      Object.assign(form, c ? { ...c } : { nombre: '', relacion: '', dia: 1, mes: 1, esFamilia: true });
      error.value = '';
      abierta.value = true;
    }
    async function guardar() {
      if (guardando.value) return;
      if (!form.nombre.trim()) { error.value = 'Escribí el nombre.'; return; }
      if (form.nombre.trim().length > 40 || form.relacion.trim().length > 40) { error.value = 'Nombre y relación pueden tener hasta 40 letras.'; return; }
      const maximo = new Date(2024, form.mes, 0).getDate();      // 2024 es bisiesto: acepta 29/2
      if (form.dia > maximo) { error.value = 'Ese mes tiene ' + maximo + ' días.'; return; }
      const datos = { nombre: form.nombre.trim(), relacion: form.relacion.trim(), dia: Number(form.dia), mes: Number(form.mes), esFamilia: form.esFamilia };
      guardando.value = true; error.value = '';
      try {
        await guardarCumple(editando.value ? editando.value.id : null, datos);
        abierta.value = false;
      } catch (e) { error.value = mensajeDeError(e); }
      finally { guardando.value = false; }
    }
    async function borrar() {
      try { await borrarCumple(editando.value.id); abierta.value = false; }
      catch (e) { error.value = mensajeDeError(e); }
    }

    return { estado, nombreAdulto, puedeEditar, guardando, proximo, familia, otros, textoFaltan, fechaCorta, abierta, editando, form, error, abrir, guardar, borrar, NOMBRES_MESES };
  },
  template: `
    <div class="pantalla">
      <div class="encabezado">
        <div>
          <div class="sobre">Avisos en NEXO</div>
          <h1>Cumpleaños</h1>
        </div>
        <button v-if="puedeEditar" type="button" class="boton-agregar" @click="abrir()">
          <icono nombre="agregar" :tam="18" :grosor="2.4" />Agregar
        </button>
      </div>

      <div v-if="proximo" class="proximo">
        <div class="calendario"><b>{{ proximo.dia }}</b><small>{{ NOMBRES_MESES[proximo.mes - 1].slice(0, 3) }}</small></div>
        <div>
          <div style="font-size: 13px; font-weight: 700; color: var(--verde)">Próximo · {{ textoFaltan(proximo) }}</div>
          <div style="font-size: 17px; font-weight: 700">{{ proximo.nombre }}{{ proximo.relacion ? ' (' + proximo.relacion.toLowerCase() + ')' : '' }}</div>
          <div class="nota">{{ proximo.esFamilia ? 'Se lo va a poder saludar con un audio' : 'Va a aparecer como recordatorio' }}</div>
        </div>
      </div>

      <template v-for="grupo in [{ titulo: 'Familia', items: familia, nota: 'Se puede saludar con un audio desde NEXO.' },
                                 { titulo: 'Otras personas', items: otros, nota: 'Solo recordatorio en la pantalla.' }]" :key="grupo.titulo">
        <h2 class="seccion">{{ grupo.titulo }}</h2>
        <div class="lista">
          <component :is="puedeEditar ? 'button' : 'div'" v-for="c in grupo.items" :key="c.id" class="fila"
                     :type="puedeEditar ? 'button' : null" @click="puedeEditar && abrir(c)"
                     style="width: 100%; border-left: none; border-right: none; border-top: none; background: transparent; text-align: left">
            <div class="texto">
              <span class="titulo" style="font-weight: 600">{{ c.nombre }}</span>
              <span class="detalle">{{ c.relacion }}</span>
            </div>
            <span class="fecha">{{ fechaCorta(c) }}</span>
          </component>
          <div v-if="!grupo.items.length" class="vacio">Sin cumpleaños cargados.</div>
        </div>
        <p class="nota">{{ grupo.nota }}</p>
      </template>

      <hoja-inferior v-if="abierta" :titulo="editando ? 'Editar cumpleaños' : 'Nuevo cumpleaños'" @cerrar="abierta = false">
        <form class="formulario" @submit.prevent="guardar" novalidate>
          <div class="campo">
            <label for="cum-nombre">Nombre</label>
            <input id="cum-nombre" type="text" placeholder="Ej.: Sofía" v-model="form.nombre">
          </div>
          <div class="campo">
            <label for="cum-relacion">¿Quién es para {{ nombreAdulto() }}?</label>
            <input id="cum-relacion" type="text" placeholder="Ej.: Nieta, vecina, médico" v-model="form.relacion">
          </div>
          <div class="dos-columnas">
            <div class="campo">
              <label for="cum-dia">Día</label>
              <select id="cum-dia" v-model.number="form.dia">
                <option v-for="d in 31" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div class="campo">
              <label for="cum-mes">Mes</label>
              <select id="cum-mes" v-model.number="form.mes">
                <option v-for="(m, i) in NOMBRES_MESES" :key="i" :value="i + 1">{{ m }}</option>
              </select>
            </div>
          </div>
          <div class="tarjeta" style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
            <div>
              <div style="font-weight: 600">Es de la familia</div>
              <div class="nota">Si es de la familia, se lo puede saludar con un audio.</div>
            </div>
            <interruptor v-model="form.esFamilia" etiqueta="Es de la familia" />
          </div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button type="submit" class="boton-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
          <button v-if="editando" type="button" class="boton-texto boton-peligro" @click="borrar">Borrar este cumpleaños</button>
        </form>
      </hoja-inferior>
    </div>`
};
