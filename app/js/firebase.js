// Conexión con Firebase: cuentas (Authentication) y base de datos (Realtime Database).
// Firebase guarda las contraseñas hasheadas: la app nunca las guarda ni las ve.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getDatabase, ref, get, set, update, push, remove, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';
import { estado, AJUSTES_INICIALES } from './datos-ejemplo.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'es';          // los mails de Firebase llegan en español
const db = getDatabase(app);

// Colores para los nombres en NEXO (se asignan en orden de llegada)
const COLORES = ['#1F6FB2', '#7A4FB0', '#B5307A', '#2E7D5B', '#B35A0E', '#3D6E8C', '#8A6D1D', '#A33A3A'];

// El código se guarda sin guion y en mayúsculas: "4f7k-2q" -> "4F7K2Q"
export function normalizarCodigo(texto) { return (texto || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function mostrarCodigo(c) { return c.length === 6 ? c.slice(0, 4) + '-' + c.slice(4) : c; }

// Traduce los errores de Firebase a mensajes claros
export function mensajeDeError(e) {
  const textos = {
    'auth/email-already-in-use': 'Ya hay una cuenta con ese mail. Usá «Iniciar sesión».',
    'auth/invalid-email': 'Revisá el mail: tiene que ser como nombre@mail.com.',
    'auth/weak-password': 'La contraseña es muy débil: usá al menos 8 caracteres.',
    'auth/invalid-credential': 'El mail o la contraseña no son correctos.',
    'auth/wrong-password': 'El mail o la contraseña no son correctos.',
    'auth/user-not-found': 'No hay ninguna cuenta con ese mail. Usá «Crear cuenta».',
    'auth/too-many-requests': 'Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.',
    'auth/network-request-failed': 'No hay conexión a internet. Revisala y probá de nuevo.',
    'PERMISSION_DENIED': 'No tenés permiso para hacer eso.'
  };
  if (e && /PERMISSION_DENIED|permission/i.test(String(e.code) + ' ' + String(e.message))) return textos.PERMISSION_DENIED;
  return textos[e && e.code] || 'Algo salió mal. Probá de nuevo en un momento.';
}

// --- Cuentas ---

export async function crearCuenta(mail, clave) {
  await createUserWithEmailAndPassword(auth, mail, clave);
}

export async function iniciarSesion(mail, clave) {
  await signInWithEmailAndPassword(auth, mail, clave);
}

export async function recuperarClave(mail) {
  await sendPasswordResetEmail(auth, mail);
}

export async function cerrarSesion() {
  dejarDeEscuchar();
  await signOut(auth);
}

// Une al usuario a la familia del código. Si el código todavía no existe,
// crea la familia y el usuario queda como administrador (es el primero).
export async function unirseAFamilia(codigoEscrito, nombre) {
  const uid = auth.currentUser.uid;
  const fid = normalizarCodigo(codigoEscrito);
  const existe = (await get(ref(db, 'codigos/' + fid))).exists();
  const cambios = {};
  if (!existe) {
    cambios['codigos/' + fid] = { admin: uid, creado: serverTimestamp() };
    cambios['familias/' + fid + '/info'] = { codigo: fid, admin: uid, adultoMayor: '', creada: serverTimestamp() };
    cambios['familias/' + fid + '/miembros/' + uid] = { nombre, color: COLORES[0], admin: true, puedeEditar: true, telegram: false };
  } else {
    cambios['familias/' + fid + '/miembros/' + uid] = {
      nombre, color: COLORES[Math.floor(Math.random() * COLORES.length)], admin: false, puedeEditar: false, telegram: false
    };
  }
  cambios['usuarios/' + uid] = { familiaId: fid };
  await update(ref(db), cambios);
  return { creoLaFamilia: !existe };
}

// --- Datos de la familia (se actualizan solos cuando alguien cambia algo) ---

let desuscribir = [];
function dejarDeEscuchar() { desuscribir.forEach((f) => f()); desuscribir = []; }

function escucharFamilia(fid) {
  dejarDeEscuchar();
  const uid = auth.currentUser.uid;
  desuscribir.push(onValue(ref(db, 'familias/' + fid + '/info'), (s) => {
    const info = s.val() || {};
    estado.familia.codigo = mostrarCodigo(info.codigo || fid);
    estado.familia.adultoMayor = info.adultoMayor || '';
    estado.familia.dispositivo = info.dispositivo || '';
  }));
  desuscribir.push(onValue(ref(db, 'familias/' + fid + '/miembros'), (s) => {
    const miembros = s.val() || {};
    estado.miembros = Object.entries(miembros).map(([id, m]) => ({ id, ...m, soyYo: id === uid }))
      .sort((a, b) => (b.admin - a.admin) || a.nombre.localeCompare(b.nombre));
    const yo = miembros[uid] || {};
    estado.usuario.nombre = yo.nombre || '';
    estado.usuario.admin = !!yo.admin;
    estado.usuario.puedeEditar = !!yo.puedeEditar;
    estado.usuario.telegram = !!yo.telegram;
  }));

  // Listas: Firebase las guarda como objetos { id: datos }; la app las usa como arreglos
  const lista = (nodo, armar, orden) => desuscribir.push(onValue(ref(db, 'familias/' + fid + '/' + nodo), (s) => {
    estado[nodo] = Object.entries(s.val() || {}).map(([id, d]) => armar(id, d)).sort(orden);
  }));
  const arreglo = (v) => (Array.isArray(v) ? v : Object.values(v || {})).filter((x) => x !== null && x !== undefined);

  lista('remedios', (id, d) => ({ id, nombre: d.nombre, dosis: d.dosis || '', horas: arreglo(d.horas).sort(), dias: arreglo(d.dias), aviso: d.aviso }),
    (a, b) => (a.horas[0] || '').localeCompare(b.horas[0] || '') || a.nombre.localeCompare(b.nombre));
  lista('cumples', (id, d) => ({ id, relacion: '', ...d }), (a, b) => a.nombre.localeCompare(b.nombre));
  lista('mensajes', (id, d) => ({ id, ...d }), (a, b) => a.creado - b.creado);                 // viejos arriba, como un chat
  lista('alertas', (id, d) => ({ id, detalle: '', ...d }), (a, b) => b.creado - a.creado);     // nuevas arriba
  lista('tomas', (id, d) => ({ id, ...d }), (a, b) => b.programada - a.programada);

  desuscribir.push(onValue(ref(db, 'familias/' + fid + '/ajustes'), (s) => {
    estado.ajustes = { ...AJUSTES_INICIALES, ...(s.val() || {}) };
  }));
  desuscribir.push(onValue(ref(db, 'familias/' + fid + '/estado'), (s) => {
    const e = s.val();
    estado.familia.enLinea = e ? !!e.enLinea : null;
    estado.familia.ultimoUso = e && e.ultimoUso ? e.ultimoUso : null;
  }));
}

// Vacía todo lo de la familia (al cerrar sesión)
function limpiarFamilia() {
  Object.assign(estado.familia, { codigo: '', adultoMayor: '', dispositivo: '', enLinea: null, ultimoUso: null });
  for (const k of ['miembros', 'alertas', 'mensajes', 'remedios', 'tomas', 'cumples']) estado[k] = [];
  estado.ajustes = { ...AJUSTES_INICIALES };
}

// Cambios que hace la app
export async function cambiarPermiso(idMiembro, puedeEditar) {
  await update(ref(db, 'familias/' + estado.familiaId + '/miembros/' + idMiembro), { puedeEditar });
}
export async function cambiarMiNombre(nombre) {
  await update(ref(db, 'familias/' + estado.familiaId + '/miembros/' + auth.currentUser.uid), { nombre });
}
export async function cambiarNombreAdultoMayor(nombre) {
  await update(ref(db, 'familias/' + estado.familiaId + '/info'), { adultoMayor: nombre });
}

const rutaFamilia = (nodo) => 'familias/' + estado.familiaId + '/' + nodo;

// Medicación y cumpleaños (solo admin y habilitados; las reglas lo controlan)
// id vacío = nuevo
async function guardarEn(nodo, id, datos) {
  const destino = id ? ref(db, rutaFamilia(nodo) + '/' + id) : push(ref(db, rutaFamilia(nodo)));
  await set(destino, datos);
}
export const guardarRemedio = (id, datos) => guardarEn('remedios', id, datos);
export const borrarRemedio = (id) => remove(ref(db, rutaFamilia('remedios') + '/' + id));
export const guardarCumple = (id, datos) => guardarEn('cumples', id, datos);
export const borrarCumple = (id) => remove(ref(db, rutaFamilia('cumples') + '/' + id));

// Mensajes de voz. El audio en sí se suma en el paso 5; por ahora se guarda la duración.
export async function enviarMensaje(duracion) {
  await set(push(ref(db, rutaFamilia('mensajes'))), { autor: auth.currentUser.uid, duracion, creado: serverTimestamp(), escuchado: false });
}
export const marcarEscuchado = (id) => update(ref(db, rutaFamilia('mensajes') + '/' + id), { escuchado: true });
export const borrarMensaje = (id) => remove(ref(db, rutaFamilia('mensajes') + '/' + id));

// Alertas: las crea NEXO; la familia las borra cuando ya las atendió
export const atenderAlerta = (id) => remove(ref(db, rutaFamilia('alertas') + '/' + id));

// Ajustes del dispositivo (cualquier integrante)
export const guardarAjustes = (cambios) => update(ref(db, rutaFamilia('ajustes')), cambios);

// Lee a qué familia pertenece la cuenta y empieza a escuchar sus datos.
// "turno" evita que una lectura vieja pise a una más nueva (por ejemplo,
// justo después de crear la cuenta y unirse a la familia).
let turno = 0;
export async function cargarPerfil() {
  const mio = ++turno;
  const usuario = auth.currentUser;
  if (!usuario) return;
  estado.usuario.mail = usuario.email;
  const datos = (await get(ref(db, 'usuarios/' + usuario.uid))).val();
  if (mio !== turno) return;
  estado.uid = usuario.uid;
  if (datos && datos.familiaId) {
    if (estado.familiaId !== datos.familiaId) escucharFamilia(datos.familiaId);
    estado.familiaId = datos.familiaId;
  } else {
    estado.familiaId = '';
  }
}

// Avisa cada vez que cambia la sesión. Llama a listo() la primera vez.
export function vigilarSesion(listo) {
  let primeraVez = true;
  onAuthStateChanged(auth, async (usuario) => {
    estado.sesionIniciada = !!usuario;
    if (usuario) {
      try { await cargarPerfil(); } catch (e) { /* sin conexión: se reintenta al volver a entrar */ }
    } else {
      turno++;
      dejarDeEscuchar();
      estado.familiaId = '';
      Object.assign(estado.usuario, { nombre: '', mail: '', admin: false, puedeEditar: false, telegram: false });
      estado.uid = '';
      limpiarFamilia();
    }
    if (primeraVez) { primeraVez = false; listo(); }
  });
}
