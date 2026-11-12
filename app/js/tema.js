// Modo claro / oscuro. Se guarda en el celular para que la próxima vez
// la app abra con el mismo modo. Si nunca se eligió, sigue al celular.
const { reactive } = Vue;

function leerGuardado() {
  try { return localStorage.getItem('nexo-tema'); } catch (e) { return null; }
}

function modoDelSistema() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export const tema = reactive({ modo: leerGuardado() || modoDelSistema() });

export function aplicarTema() {
  document.documentElement.setAttribute('data-theme', tema.modo === 'oscuro' ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tema.modo === 'oscuro' ? '#0E1621' : '#F4F6F9');
}

export function cambiarTema(modo) {
  tema.modo = modo;
  try { localStorage.setItem('nexo-tema', modo); } catch (e) { /* sin almacenamiento: solo dura esta sesión */ }
  aplicarTema();
}
