// Pantalla de ingreso: crear cuenta (primera vez) o iniciar sesión.
// En el paso 2 esto se conecta con Firebase Authentication, que guarda
// las contraseñas hasheadas. Por ahora solo valida los datos y entra.
import { Icono } from '../iconos.js';
import { estado } from '../datos-ejemplo.js';

const { ref, reactive, computed } = Vue;

export const PantallaIngreso = {
  name: 'PantallaIngreso',
  components: { Icono },
  setup() {
    const router = VueRouter.useRouter();
    const modo = ref('registro');            // 'registro' o 'sesion'
    const datos = reactive({ mail: '', clave: '', codigo: '', nombre: '' });
    const error = ref('');
    const aviso = ref('');
    const verClave = ref(false);            // el ojito muestra u oculta la contraseña
    const esRegistro = computed(() => modo.value === 'registro');

    function cambiarModo(m) { modo.value = m; error.value = ''; aviso.value = ''; }

    function validar() {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.mail.trim())) return 'Revisá el mail: tiene que ser como nombre@mail.com.';
      if (datos.clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
      if (esRegistro.value) {
        if (datos.codigo.trim().length < 6) return 'Escribí el código de familia que aparece en la pantalla de NEXO.';
        if (!datos.nombre.trim()) return 'Escribí cómo te llama tu familiar (por ejemplo, Mamá).';
      }
      return '';
    }

    function entrar() {
      error.value = validar();
      if (error.value) return;
      if (esRegistro.value) estado.usuario.nombre = datos.nombre.trim();
      estado.usuario.mail = datos.mail.trim();
      estado.sesionIniciada = true;
      router.push('/inicio');
    }

    function olvideClave() {
      error.value = '';
      aviso.value = datos.mail
        ? 'Te vamos a mandar un mail para crear una contraseña nueva (se activa en el paso 2).'
        : 'Escribí tu mail arriba y volvé a tocar «¿Olvidaste tu contraseña?».';
    }

    return { modo, datos, error, aviso, verClave, esRegistro, cambiarModo, entrar, olvideClave };
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

      <div class="segmentos" role="group" aria-label="Tipo de ingreso">
        <button type="button" :aria-pressed="!esRegistro ? 'true' : 'false'" @click="cambiarModo('sesion')">Iniciar sesión</button>
        <button type="button" :aria-pressed="esRegistro ? 'true' : 'false'" @click="cambiarModo('registro')">Crear cuenta</button>
      </div>

      <div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700">{{ esRegistro ? 'Crear tu cuenta' : 'Hola de nuevo' }}</h1>
        <p class="nota" style="font-size: 15px; margin-top: 6px">
          {{ esRegistro ? 'La primera vez te unís a la familia con el código del dispositivo.' : 'Entrá con tu mail y tu contraseña.' }}
        </p>
      </div>

      <form class="formulario" @submit.prevent="entrar" novalidate>
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
        <template v-if="esRegistro">
          <div class="campo">
            <label for="codigo">Código de familia</label>
            <input id="codigo" type="text" autocapitalize="characters" placeholder="Ej.: 4F7K-2Q"
                   style="letter-spacing: 2px" v-model="datos.codigo">
            <span class="ayuda">Aparece en la pantalla de NEXO. Se pide solo esta vez.</span>
          </div>
          <div class="campo">
            <label for="nombre">¿Quién sos?</label>
            <input id="nombre" type="text" placeholder="Ej.: Mamá" v-model="datos.nombre">
            <span class="ayuda">Así aparece tu nombre en NEXO. Lo podés cambiar en Ajustes.</span>
          </div>
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="aviso" class="aviso-ok" role="status">{{ aviso }}</p>
        <button type="submit" class="boton-primario">{{ esRegistro ? 'Crear cuenta y entrar' : 'Entrar' }}</button>
        <button v-if="!esRegistro" type="button" class="boton-texto" style="align-self: center" @click="olvideClave">
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </div>`
};
