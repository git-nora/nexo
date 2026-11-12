// Estado de la app. Todo se llena desde Firebase (ver firebase.js) y se
// actualiza solo cuando alguien de la familia o el dispositivo cambia algo.
// (El archivo conserva su nombre del paso 1 para no romper los imports.)
const { reactive } = Vue;

export const AJUSTES_INICIALES = { silencioso: false, horasInactividad: 6, desde: '08:00', hasta: '22:00' };

export const estado = reactive({
  sesionIniciada: false,
  familiaId: '',                 // vacío = la cuenta todavía no se unió a una familia
  uid: '',                       // identificador de esta cuenta

  usuario: { nombre: '', mail: '', admin: false, puedeEditar: false, telegram: false },

  familia: {
    codigo: '',
    adultoMayor: '',             // nombre de quien usa NEXO (lo pone el administrador)
    dispositivo: '',             // cuenta del dispositivo NEXO (se vincula más adelante)
    enLinea: null,               // null = el dispositivo todavía no se conectó nunca
    ultimoUso: null              // fecha (ms) de la última vez que se usó NEXO
  },

  miembros: [],                  // { id, nombre, color, admin, puedeEditar, telegram, soyYo }
  bloqueados: [],                // { id, nombre }: quitados por quien administra; no pueden volver a sumarse
  avisoIngreso: '',              // mensaje para la pantalla de ingreso (por ejemplo, si te quitaron de la familia)
  alertas: [],                   // { id, tipo: sos|medicacion|llamada|inactividad, detalle, creado }
  mensajes: [],                  // { id, autor, duracion, creado, escuchado, audio }
  remedios: [],                  // { id, nombre, dosis, horas: ['08:00'], dias: [0..6], aviso: texto|audio|ambos }
  tomas: [],                     // { id, remedio, programada, confirmada, horaConfirmada }  (las escribe NEXO)
  cumples: [],                   // { id, nombre, relacion, dia, mes, esFamilia }
  ajustes: { ...AJUSTES_INICIALES }
});

// Nombre para mostrar de quien usa NEXO
export function nombreAdulto() { return estado.familia.adultoMayor || 'tu familiar'; }

// Quién mandó un mensaje: vos, otro familiar o el dispositivo (quien usa NEXO)
export function nombreDe(autor) {
  if (autor === estado.uid) return 'Vos';
  const m = estado.miembros.find((x) => x.id === autor);
  return m ? m.nombre : nombreAdulto();
}

// --- Fechas (Firebase guarda milisegundos) ---
const dosDigitos = (n) => String(n).padStart(2, '0');
export function hora(ms) { const d = new Date(ms); return dosDigitos(d.getHours()) + ':' + dosDigitos(d.getMinutes()); }
export function dia(ms) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dif = Math.round((hoy - d) / 86400000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  return dosDigitos(d.getDate()) + '/' + dosDigitos(d.getMonth() + 1);
}
// "10:42" si es de hoy, "Ayer" o "07/11" si es más viejo
export function cuandoCorto(ms) { const d = dia(ms); return d === 'Hoy' ? hora(ms) : d; }
export function haceCuanto(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return 'hace ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'hace ' + h + (h === 1 ? ' hora' : ' horas');
  return dia(ms) + ' ' + hora(ms);
}

export const NOMBRES_DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const NOMBRES_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
