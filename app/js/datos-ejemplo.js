// Datos de EJEMPLO para el paso 1 (diseño y navegación).
// En el paso 4 todo esto se reemplaza por los datos reales de Firebase.
const { reactive } = Vue;

export const estado = reactive({
  sesionIniciada: false,

  usuario: { nombre: 'Mamá', mail: '', admin: true, puedeEditar: true, telegram: true },

  familia: {
    codigo: '4F7K-2Q',
    adultoMayor: 'Abuela',
    enLinea: true,
    ultimoUso: 'hace 12 min'
  },

  // tipo: sos | medicacion | llamada | inactividad
  alertas: [
    { id: 1, tipo: 'sos', titulo: 'Pidió ayuda (SOS)', detalle: 'Mantuvo apretado el botón rojo', hora: '10:42' },
    { id: 2, tipo: 'medicacion', titulo: 'Medicación sin confirmar', detalle: 'Enalapril 10 mg · toma de las 08:00', hora: '08:20' },
    { id: 3, tipo: 'llamada', titulo: 'Pidió que la llamen', detalle: 'Desde «Pedir que me llamen»', hora: 'Ayer' }
  ],

  // mia: true = lo mandó este familiar; escuchado: la Abuela ya lo escuchó
  mensajes: [
    { id: 1, de: 'Abuela', mia: false, duracion: 12, hora: '10:15' },
    { id: 2, de: 'Vos', mia: true, duracion: 8, hora: '10:20', escuchado: true },
    { id: 3, de: 'Abuela', mia: false, duracion: 5, hora: '10:31' },
    { id: 4, de: 'Vos', mia: true, duracion: 15, hora: '10:40', escuchado: false }
  ],

  // dias: 0 = domingo ... 6 = sábado. aviso: texto | audio | ambos
  remedios: [
    { id: 1, nombre: 'Enalapril', dosis: '10 mg', horas: ['08:00', '20:00'], dias: [0, 1, 2, 3, 4, 5, 6], aviso: 'ambos' },
    { id: 2, nombre: 'Metformina', dosis: '850 mg', horas: ['13:00'], dias: [1, 2, 3, 4, 5], aviso: 'texto' }
  ],

  tomas: [
    { id: 1, remedio: 'Enalapril 10 mg', cuando: 'Hoy · 08:00', confirmada: false, horaConfirmada: '' },
    { id: 2, remedio: 'Enalapril 10 mg', cuando: 'Ayer · 20:00', confirmada: true, horaConfirmada: '20:04' },
    { id: 3, remedio: 'Metformina 850 mg', cuando: 'Ayer · 13:00', confirmada: true, horaConfirmada: '13:02' },
    { id: 4, remedio: 'Enalapril 10 mg', cuando: 'Ayer · 08:00', confirmada: true, horaConfirmada: '08:10' }
  ],

  cumples: [
    { id: 1, nombre: 'Sofía', relacion: 'Nieta', dia: 14, mes: 11, esFamilia: true },
    { id: 2, nombre: 'Carlos', relacion: 'Hijo', dia: 2, mes: 2, esFamilia: true },
    { id: 3, nombre: 'Marta', relacion: 'Amiga del barrio', dia: 20, mes: 12, esFamilia: false },
    { id: 4, nombre: 'Dr. Pérez', relacion: 'Médico de cabecera', dia: 8, mes: 3, esFamilia: false }
  ],

  miembros: [
    { id: 1, nombre: 'Mamá', color: '#1F6FB2', telegram: true, admin: true, puedeEditar: true, soyYo: true },
    { id: 2, nombre: 'Carlos', color: '#7A4FB0', telegram: true, admin: false, puedeEditar: true },
    { id: 3, nombre: 'Sofía', color: '#B5307A', telegram: false, admin: false, puedeEditar: false },
    { id: 4, nombre: 'Abuelo', color: '#2E7D5B', telegram: true, admin: false, puedeEditar: false }
  ],

  ajustes: { silencioso: false, horasInactividad: 6, desde: '08:00', hasta: '22:00' }
});

// Número nuevo para identificar lo que se agrega en el paso 1
let ultimoId = 100;
export function nuevoId() { ultimoId += 1; return ultimoId; }

export const NOMBRES_DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const NOMBRES_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
