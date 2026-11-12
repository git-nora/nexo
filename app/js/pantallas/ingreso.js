// Pantalla de ingreso: crear cuenta (primera vez), iniciar sesión,
// o completar la unión a la familia si la cuenta quedó sin familia.
// Las cuentas las maneja Firebase Authentication, que guarda las contraseñas hasheadas.
import { Icono } from '../iconos.js';
import { estado } from '../datos-ejemplo.js';
import { crearCuenta, iniciarSesion, recuperarClave, cerrarSesion, unirseAFamilia, cargarPerfil, normalizarCodigo, mensajeDeError } from '../firebase.js';

const { ref, reactive, computed } = Vue;

export const PantallaIngreso = {
  name: 'PantallaIngreso',
  components: { Icono },
  setup() {
    const router = VueRouter.useRouter();
    // 'registro', 'sesion' o 'completar' (ya tiene cuenta pero todavía no se unió a una familia)
    const modo = ref(estado.sesionIniciada ? 'completar' : 'registro');
    const ocupado = ref(false);
    const datos = reactive({ mail: '', clave: '', codigo: '', nombre: '' });
    const error = ref('');
    const aviso = ref('');
    const verClave = ref(false);            // el ojito muestra u oculta la contraseña
    const esRegistro = computed(() => modo.value === 'registro');
    const esCompletar = computed(() => modo.value === 'completar');
    const pideFamilia = computed(() => esRegistro.value || esCompletar.value);

    function cambiarModo(m) { modo.value = m; error.value = ''; aviso.value = ''; }

    function validar() {
      if (!esCompletar.value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.mail.trim())) return 'Revisá el mail: tiene que ser como nombre@mail.com.';
        if (datos.clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
      }
      if (pideFamilia.value) {
        if (normalizarCodigo(datos.codigo).length !== 6) return 'El código de familia tiene 6 letras y números, como 4F7K-2Q.';
        if (!datos.nombre.trim()) return 'Escribí cómo te llama tu familiar (por ejemplo, Mamá).';
      }
      return '';
    }

    async function entrar() {
      error.value = validar(); aviso.value = '';
      if (error.value || ocupado.value) return;
      ocupado.value = true;
      try {
        if (modo.value === 'sesion') {
          await iniciarSesion(datos.mail.trim(), datos.clave);
          await cargarPerfil();
          if (!estado.familiaId) { modo.value = 'completar'; return; }   // la cuenta existe pero no tiene familia
        } else {
          if (esRegistro.value) await crearCuenta(datos.mail.trim(), datos.clave);
          await unirseAFamilia(datos.codigo, datos.nombre.trim());
          await cargarPerfil();
        }
        router.push('/inicio');
      } catch (e) {
        error.value = mensajeDeError(e);
        if (esRegistro.value && estado.sesionIniciada) modo.value = 'completar';  // se creó la cuenta pero no se unió
      } finally {
        ocupado.value = false;
      }
    }

    async function olvideClave() {
      error.value = ''; aviso.value = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.mail.trim())) {
        aviso.value = 'Escribí tu mail arriba y volvé a tocar «¿Olvidaste tu contraseña?».';
        return;
      }
      try {
        await recuperarClave(datos.mail.trim());
        aviso.value = 'Listo. Si hay una cuenta con ese mail, te llega un mensaje para crear una contraseña nueva. Mirá también en spam.';
      } catch (e) { error.value = mensajeDeError(e); }
    }

    async function salir() { await cerrarSesion(); modo.value = 'sesion'; error.value = ''; }

    return { estado, modo, datos, error, aviso, verClave, ocupado, esRegistro, esCompletar, pideFamilia, cambiarModo, entrar, olvideClave, salir };
  },
  template: `
    <div class="pantalla">
      <div class="marca">
        <div class="logo"><icono nombre="corazon" :tam="30" /></div>
        <div>
          <div class="nombre">NEXO</div>
          <div class="lema">«Tu familia, siempre cerca»</div>
        </div>
      </div>

      <div v-if="!esCompletar" class="segmentos" role="group" aria-label="Tipo de ingreso">
        <button type="button" :aria-pressed="!esRegistro ? 'true' : 'false'" @click="cambiarModo('sesion')">Iniciar sesión</button>
        <button type="button" :aria-pressed="esRegistro ? 'true' : 'false'" @click="cambiarModo('registro')">Crear cuenta</button>
      </div>

      <div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700">{{ esCompletar ? 'Unite a tu familia' : esRegistro ? 'Crear tu cuenta' : 'Hola de nuevo' }}</h1>
        <p class="nota" style="font-size: 15px; margin-top: 6px">
          <template v-if="esCompletar">Tu cuenta ({{ estado.usuario.mail }}) todavía no está en ninguna familia. Escribí el código del dispositivo.</template>
          <template v-else-if="esRegistro">La primera vez te unís a la familia con el código del dispositivo.</template>
          <template v-else>Entrá con tu mail y tu contraseña.</template>
        </p>
      </div>

      <form class="formulario" @submit.prevent="entrar" novalidate>
        <template v-if="!esCompletar">
        <div class="campo">
          <label for="mail">Mail</label>
          <input id="mail" type="email" autocomplete="email" placeholder="tunombre@mail.com" v-model="datos.mail">
        </div>
        <div class="campo">
          <label for="clave">Contraseña</label>
          <div class="campo-clave">
            <input id="clave" :type="verClave ? 'text' : 'password'" :autocomplete="esRegistro ? 'new-password' : 'current-password'"
                   placeholder="Mínimo 8 caracteres" v-model="datos.clave">
            <button type="button" class="ver-clave" @click="verClave = !verClave"
                    :aria-label="verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="verClave ? 'true' : 'false'">
              <icono :nombre="verClave ? 'ojoTachado' : 'ojo'" :tam="22" />
            </button>
          </div>
        </div>
        </template>
        <template v-if="pideFamilia">
          <div class="campo">
            <label for="codigo">Código de familia</label>
            <input id="codigo" type="text" autocapitalize="characters" placeholder="Ej.: 4F7K-2Q"
                   style="letter-spacing: 2px" v-model="datos.codigo">
            <span class="ayuda">Aparece en la pantalla de NEXO. Se pide solo esta vez. La primera persona que lo usa queda como quien administra la familia.</span>
          </div>
          <div class="campo">
            <label for="nombre">¿Quién sos?</label>
            <input id="nombre" type="text" placeholder="Ej.: Mamá" v-model="datos.nombre">
            <span class="ayuda">Así aparece tu nombre en NEXO. Lo podés cambiar en Ajustes.</span>
          </div>
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="aviso" class="aviso-ok" role="status">{{ aviso }}</p>
        <button type="submit" class="boton-primario" :disabled="ocupado" :aria-busy="ocupado ? 'true' : 'false'">
          {{ ocupado ? 'Un momento…' : esCompletar ? 'Unirme y entrar' : esRegistro ? 'Crear cuenta y entrar' : 'Entrar' }}
        </button>
        <button v-if="esCompletar" type="button" class="boton-texto" style="align-self: center" @click="salir">Usar otra cuenta</button>
        <button v-if="modo === 'sesion'" type="button" class="boton-texto" style="align-self: center" @click="olvideClave">
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </div>`
};
