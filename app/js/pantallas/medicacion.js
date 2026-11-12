// Medicación: lista de remedios, formulario para agregar/editar y registro de tomas.
// Solo pueden agregar o editar el administrador y quienes él habilite.
import { Icono } from '../iconos.js';
import { HojaInferior } from '../componentes/comunes.js';
import { estado, nombreAdulto, dia, hora, NOMBRES_DIAS } from '../datos-ejemplo.js';
import { guardarRemedio, borrarRemedio, mensajeDeError } from '../firebase.js';

const { ref, reactive, computed } = Vue;

const TEXTO_AVISO = { texto: 'solo texto', audio: 'solo audio', ambos: 'texto y audio' };

function textoDias(dias) {
  if (dias.length === 7) return 'Todos los días';
  if (dias.length === 5 && [1, 2, 3, 4, 5].every(d => dias.includes(d))) return 'Lunes a viernes';
  const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return [...dias].sort().map(d => nombres[d]).join(', ');
}

export const PantallaMedicacion = {
  name: 'PantallaMedicacion',
  components: { Icono, HojaInferior },
  setup() {
    const puedeEditar = computed(() => estado.usuario.admin || estado.usuario.puedeEditar);
    const abierta = ref(false);
    const editando = ref(null);                 // remedio que se edita, o null si es nuevo
    const form = reactive({ nombre: '', dosis: '', horas: ['08:00'], dias: [0, 1, 2, 3, 4, 5, 6], aviso: 'ambos' });
    const error = ref('');
    const guardando = ref(false);

    function abrir(r) {
      editando.value = r || null;
      Object.assign(form, r
        ? { nombre: r.nombre, dosis: r.dosis, horas: [...r.horas], dias: [...r.dias], aviso: r.aviso }
        : { nombre: '', dosis: '', horas: ['08:00'], dias: [0, 1, 2, 3, 4, 5, 6], aviso: 'ambos' });
      error.value = '';
      abierta.value = true;
    }
    function alternarDia(d) {
      const i = form.dias.indexOf(d);
      if (i >= 0) form.dias.splice(i, 1); else form.dias.push(d);
    }
    async function guardar() {
      if (guardando.value) return;
      if (!form.nombre.trim()) { error.value = 'Escribí el nombre del remedio.'; return; }
      const horas = form.horas.filter(Boolean).sort();
      if (!horas.length) { error.value = 'Agregá al menos un horario.'; return; }
      if (!form.dias.length) { error.value = 'Elegí al menos un día.'; return; }
      if (form.nombre.trim().length > 40) { error.value = 'El nombre puede tener hasta 40 letras.'; return; }
      if (form.dosis.trim().length > 30) { error.value = 'La dosis puede tener hasta 30 letras.'; return; }
      const datos = { nombre: form.nombre.trim(), dosis: form.dosis.trim(), horas: [...new Set(horas)], dias: [...form.dias].sort(), aviso: form.aviso };
      guardando.value = true; error.value = '';
      try {
        await guardarRemedio(editando.value ? editando.value.id : null, datos);
        abierta.value = false;
      } catch (e) { error.value = mensajeDeError(e); }
      finally { guardando.value = false; }
    }
    async function borrar() {
      try { await borrarRemedio(editando.value.id); abierta.value = false; }
      catch (e) { error.value = mensajeDeError(e); }
    }
    const cuandoToma = (t) => dia(t.programada) + ' · ' + hora(t.programada);

    return { estado, nombreAdulto, puedeEditar, guardando, cuandoToma, hora, abierta, editando, form, error, abrir, alternarDia, guardar, borrar, textoDias, TEXTO_AVISO, NOMBRES_DIAS };
  },
  template: `
    <div class="pantalla">
      <div class="encabezado">
        <div>
          <div class="sobre">De {{ nombreAdulto() }}</div>
          <h1>Medicación</h1>
        </div>
        <button v-if="puedeEditar" type="button" class="boton-agregar" @click="abrir()">
          <icono nombre="agregar" :tam="18" :grosor="2.4" />Agregar
        </button>
      </div>

      <div v-for="r in estado.remedios" :key="r.id" class="tarjeta" style="display: flex; flex-direction: column; gap: 10px">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px">
          <div>
            <div style="font-size: 17px; font-weight: 700">{{ r.nombre }}</div>
            <div class="nota" style="font-size: 14px">{{ r.dosis ? r.dosis + ' · ' : '' }}{{ textoDias(r.dias) }}</div>
          </div>
          <button v-if="puedeEditar" type="button" class="boton-icono" :aria-label="'Editar ' + r.nombre" @click="abrir(r)">
            <icono nombre="editar" :tam="18" />
          </button>
        </div>
        <div class="chips">
          <span v-for="h in r.horas" :key="h" class="chip naranja">{{ h }}</span>
          <span class="chip">Aviso: {{ TEXTO_AVISO[r.aviso] }}</span>
        </div>
      </div>
      <div v-if="!estado.remedios.length" class="tarjeta nota">Todavía no hay remedios cargados.</div>
      <p v-if="!puedeEditar" class="nota">Solo pueden cambiar la medicación las personas que habilitó quien administra la familia.</p>

      <h2 class="seccion">Registro de tomas</h2>
      <div class="lista">
        <div v-for="t in estado.tomas" :key="t.id" class="fila">
          <div class="circulo-icono" style="width: 30px; height: 30px; border-radius: 15px"
               :style="{ color: t.confirmada ? 'var(--verde)' : 'var(--naranja)', background: t.confirmada ? 'var(--verde-suave)' : 'var(--naranja-suave)' }">
            <icono :nombre="t.confirmada ? 'ok' : 'alerta'" :tam="16" :grosor="2.6" />
          </div>
          <div class="texto">
            <span class="titulo" style="font-weight: 600">{{ t.remedio }}</span>
            <span class="detalle">{{ cuandoToma(t) }}</span>
          </div>
          <span style="font-size: 13px; font-weight: 700" :style="{ color: t.confirmada ? 'var(--verde)' : 'var(--naranja)' }">
            {{ t.confirmada ? 'Tomada ' + (t.horaConfirmada ? hora(t.horaConfirmada) : '') : 'Sin confirmar' }}
          </span>
        </div>
        <div v-if="!estado.tomas.length" class="vacio">Todavía no hay tomas. NEXO las anota cuando suena cada aviso.</div>
      </div>

      <hoja-inferior v-if="abierta" :titulo="editando ? 'Editar remedio' : 'Nuevo remedio'" @cerrar="abierta = false">
        <form class="formulario" @submit.prevent="guardar" novalidate>
          <div class="campo">
            <label for="med-nombre">Nombre</label>
            <input id="med-nombre" type="text" placeholder="Ej.: Enalapril" v-model="form.nombre">
          </div>
          <div class="campo">
            <label for="med-dosis">Dosis</label>
            <input id="med-dosis" type="text" placeholder="Ej.: 10 mg" v-model="form.dosis">
          </div>
          <div class="campo">
            <span class="rotulo">Horarios</span>
            <div v-for="(h, i) in form.horas" :key="i" style="display: flex; gap: 8px">
              <input type="time" :aria-label="'Horario ' + (i + 1)" v-model="form.horas[i]" style="flex: 1">
              <button v-if="form.horas.length > 1" type="button" class="boton-icono" :aria-label="'Quitar horario ' + (i + 1)"
                      @click="form.horas.splice(i, 1)" style="height: 50px; width: 50px">
                <icono nombre="cerrar" :tam="18" />
              </button>
            </div>
            <button type="button" class="boton-texto" style="align-self: flex-start; padding-left: 0" @click="form.horas.push('')">
              + Agregar otro horario
            </button>
          </div>
          <div class="campo">
            <span class="rotulo" id="med-dias">Días</span>
            <div class="dias" role="group" aria-labelledby="med-dias">
              <button v-for="(n, d) in NOMBRES_DIAS" :key="d" type="button"
                      :aria-pressed="form.dias.includes(d) ? 'true' : 'false'" @click="alternarDia(d)">{{ n }}</button>
            </div>
          </div>
          <div class="campo">
            <span class="rotulo" id="med-aviso">Cómo avisa NEXO</span>
            <div class="segmentos" role="group" aria-labelledby="med-aviso">
              <button type="button" :aria-pressed="form.aviso === 'texto' ? 'true' : 'false'" @click="form.aviso = 'texto'">Texto</button>
              <button type="button" :aria-pressed="form.aviso === 'audio' ? 'true' : 'false'" @click="form.aviso = 'audio'">Audio</button>
              <button type="button" :aria-pressed="form.aviso === 'ambos' ? 'true' : 'false'" @click="form.aviso = 'ambos'">Los dos</button>
            </div>
          </div>
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <button type="submit" class="boton-primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
          <button v-if="editando" type="button" class="boton-texto boton-peligro" @click="borrar">Borrar este remedio</button>
        </form>
      </hoja-inferior>
    </div>`
};
