/* =============================================================
   ZETAS BARBER — Planilla y panel de turnos
   -------------------------------------------------------------
   Pegá TODO este código en Extensiones > Apps Script de tu
   planilla de Google Sheets (ver INSTRUCCIONES.md).
   - La página web pregunta qué horarios están ocupados (doGet)
     y manda las reservas nuevas (doPost).
   - El panel (archivo "Panel") te muestra la agenda del día en
     el celu: confirmar, marcar realizado, cancelar, agregar
     turnos a mano y bloquear horarios.
   ============================================================= */

var NOMBRE_HOJA = 'Reservas';
var ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
var ESTADO_INICIAL = 'Pendiente';
var ESTADOS = ['Pendiente', 'Confirmado', 'Realizado', 'Cancelado', 'No vino', 'Bloqueado'];
// Si en la columna "Estado" dice alguno de estos, ese horario queda libre.
var ESTADOS_QUE_LIBERAN = ['cancelado', 'cancelada', 'anulado', 'no vino'];

// 👉 Mismos horarios que en js/config.js de la página. Se usan para
//    mostrar los turnos libres en el panel. Si cambiás uno, cambiá el otro.
var DURACION_TURNO_MIN = 45;
var HORARIOS = {
  0: ['12:00', '18:00'], // domingo
  1: ['12:00', '20:00'], // lunes
  2: ['12:00', '20:00'], // martes
  3: ['12:00', '20:00'], // miércoles
  4: ['12:00', '20:00'], // jueves
  5: ['12:00', '20:00'], // viernes
  6: ['12:00', '18:00']  // sábado
};
// 👉 Servicios y precios para cargar turnos a mano desde el panel.
var SERVICIOS = [
  ['Corte', 8000],
  ['Corte + cejas + barba', 10000],
  ['Corte a domicilio', 15000]
];
// 👉 Horas de anticipación mínimas para el corte a domicilio (igual que en js/config.js).
var DOMICILIO_HORAS_ANTICIPACION = 24;
// 👉 Dirección de la página (para el botón "Ver la página" del panel).
var SITIO_URL = 'https://zetasbarber.com';

var COLUMNAS = [
  'Fecha de registro', 'Nombre', 'Teléfono', 'Instagram', 'Servicio', 'Fecha del turno', 'Hora',
  'Dirección (si es a domicilio)', 'Km', 'Precio total', 'Comentarios', 'Estado'
];
// Posición (empezando en 0) de cada columna.
var C = { REG: 0, NOMBRE: 1, TEL: 2, INSTA: 3, SERVICIO: 4, FECHA: 5, HORA: 6, DIR: 7, KM: 8, PRECIO: 9, COM: 10, ESTADO: 11 };


/* =============================================================
   PÁGINA WEB (pública)
   ============================================================= */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.accion === 'ocupados') {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '')) return responder({ ok: false, error: 'FECHA_INVALIDA' });
      return responder({ ok: true, fecha: p.fecha, ocupados: horariosOcupados(isoATexto(p.fecha)) });
    } catch (err) {
      return responder({ ok: false, error: 'ERROR', mensaje: String(err) });
    }
  }
  // Sin "accion": es el dueño abriendo el panel desde el celu.
  if (esDueno_()) {
    return HtmlService.createHtmlOutputFromFile('Panel')
      .setTitle('Zetas Barber · Turnos')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
  return responder({ ok: true, mensaje: 'Zetas Barber: el script está funcionando.' });
}

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var hoy = Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd');
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') && d.fecha < hoy) return responder({ ok: false, error: 'FECHA_PASADA' });
    // Desde la web el Instagram es obligatorio (desde el panel no).
    if (!limpiarInstagram_(d.instagram)) return responder({ ok: false, error: 'FALTA_INSTAGRAM' });
    // El corte a domicilio se reserva con anticipación (desde el panel sí se puede cargar igual).
    if (/domicilio/i.test(String(d.servicio || '')) && /^\d{2}:\d{2}$/.test(String(d.hora || ''))) {
      var inicio = Utilities.parseDate(d.fecha + ' ' + d.hora, ZONA_HORARIA, 'yyyy-MM-dd HH:mm');
      if (inicio.getTime() - Date.now() < DOMICILIO_HORAS_ANTICIPACION * 3600 * 1000) {
        return responder({ ok: false, error: 'ANTICIPACION' });
      }
    }
    return responder(guardarTurno_(d, ESTADO_INICIAL));
  } catch (err) {
    return responder({ ok: false, error: 'ERROR', mensaje: String(err) });
  }
}

// Valida y agrega una fila. Devuelve { ok, fila } o { ok:false, error }.
function guardarTurno_(d, estado) {
  var nombre = limpiar(d.nombre, 80);
  var telefono = limpiar(d.telefono, 25);
  var servicio = limpiar(d.servicio, 60);
  var instagram = limpiarInstagram_(d.instagram);
  var hora = String(d.hora || '');
  if (!nombre || !servicio) return { ok: false, error: 'FALTAN_DATOS' };
  if (estado !== 'Bloqueado' && !telefono) return { ok: false, error: 'FALTAN_DATOS' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') || !/^\d{2}:\d{2}$/.test(hora)) {
    return { ok: false, error: 'FECHA_INVALIDA' };
  }
  var fechaTexto = isoATexto(d.fecha);

  // Bloqueo: si dos personas reservan al mismo tiempo, se atienden de a una.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (horariosOcupados(fechaTexto).indexOf(hora) !== -1) return { ok: false, error: 'OCUPADO' };

    var hoja = obtenerHoja();
    var fila = hoja.getLastRow() + 1;
    var rango = hoja.getRange(fila, 1, 1, COLUMNAS.length);
    rango.setNumberFormats([[
      'dd/MM/yyyy HH:mm', '@', '@', '@', '@', '@', '@', '@', '0', '$#,##0', '@', '@'
    ]]);
    rango.setValues([[
      new Date(),
      nombre,
      telefono,
      instagram ? '@' + instagram : '',
      servicio,
      fechaTexto,
      hora,
      limpiar(d.direccion, 200),
      d.km === '' || d.km == null ? '' : Number(d.km),
      Number(d.precio) || 0,
      limpiar(d.comentarios, 400),
      estado
    ]]);
    SpreadsheetApp.flush();
    return { ok: true, fila: fila };
  } finally {
    lock.releaseLock();
  }
}


/* =============================================================
   PANEL (solo el dueño)
   ============================================================= */

// El panel solo se abre con el link de la implementación "Panel"
// (acceso: Solo yo). En la implementación pública, Google no informa
// quién visita, así que ahí no se muestra.
function esDueno_() {
  var activo = Session.getActiveUser().getEmail();
  return !!activo && activo === Session.getEffectiveUser().getEmail();
}
function soloDueno_() {
  if (!esDueno_()) throw new Error('No tenés permiso para usar el panel.');
}

// Todo lo que el panel necesita para mostrar un día.
function panelDia(iso) {
  soloDueno_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) iso = hoyIso_();
  var fechaTexto = isoATexto(iso);
  var filas = leerFilas_();

  var turnos = filas.filter(function (t) { return t.fecha === fechaTexto; })
    .sort(function (a, b) { return a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0; });

  // Próximos 14 días: cuántos turnos activos hay en cada uno.
  var proximos = [];
  for (var i = 0; i < 14; i++) {
    var dIso = sumarDias_(hoyIso_(), i);
    var dTxt = isoATexto(dIso);
    proximos.push({
      iso: dIso,
      abierto: !!HORARIOS[diaSemana_(dIso)],
      cantidad: filas.filter(function (t) { return t.fecha === dTxt && activo_(t.estado) && t.estado !== 'Bloqueado'; }).length
    });
  }

  return {
    iso: iso,
    hoy: hoyIso_(),
    ahora: Utilities.formatDate(new Date(), ZONA_HORARIA, 'HH:mm'),
    horario: HORARIOS[diaSemana_(iso)] || null,
    grilla: grilla_(iso),
    turnos: turnos,
    proximos: proximos,
    servicios: SERVICIOS,
    estados: ESTADOS,
    sitio: SITIO_URL
  };
}

function cambiarEstado(fila, fechaTexto, hora, estado) {
  soloDueno_();
  if (ESTADOS.indexOf(estado) === -1) throw new Error('Estado desconocido.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var hoja = obtenerHoja();
    controlarFila_(hoja, fila, fechaTexto, hora);
    // Reactivar un turno cancelado: solo si nadie tomó ese horario mientras tanto.
    if (!activo_(String(hoja.getRange(fila, C.ESTADO + 1).getValue())) && activo_(estado) &&
        horariosOcupados(fechaTexto).indexOf(hora) !== -1) {
      throw new Error('Ese horario ya lo tomó otra persona.');
    }
    hoja.getRange(fila, C.ESTADO + 1).setValue(estado);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function agregarTurnoPanel(d) {
  soloDueno_();
  var r = guardarTurno_(d, d.bloquear ? 'Bloqueado' : 'Confirmado');
  if (!r.ok) {
    throw new Error({
      OCUPADO: 'Ese horario ya está ocupado.',
      FALTAN_DATOS: 'Completá nombre, teléfono y servicio.',
      FECHA_INVALIDA: 'Revisá la fecha y la hora.'
    }[r.error] || 'No se pudo guardar.');
  }
  return r;
}

// Antes de tocar una fila, se fija que siga siendo el mismo turno
// (por si ordenaste o borraste filas en la planilla mientras tanto).
function controlarFila_(hoja, fila, fechaTexto, hora) {
  if (fila < 2 || fila > hoja.getLastRow()) throw new Error('La planilla cambió. Actualizá el panel.');
  var v = hoja.getRange(fila, 1, 1, COLUMNAS.length).getValues()[0];
  if (normalizarFecha(v[C.FECHA]) !== fechaTexto || normalizarHora(v[C.HORA]) !== hora) {
    throw new Error('La planilla cambió. Actualizá el panel.');
  }
}


/* =============================================================
   AYUDANTES
   ============================================================= */

function leerFilas_() {
  var hoja = obtenerHoja();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  return hoja.getRange(2, 1, ultima - 1, COLUMNAS.length).getValues().map(function (r, i) {
    return {
      fila: i + 2,
      nombre: String(r[C.NOMBRE] || ''),
      telefono: String(r[C.TEL] || ''),
      instagram: limpiarInstagram_(r[C.INSTA]),
      servicio: String(r[C.SERVICIO] || ''),
      fecha: normalizarFecha(r[C.FECHA]),
      hora: normalizarHora(r[C.HORA]),
      direccion: String(r[C.DIR] || ''),
      km: r[C.KM] === '' ? '' : Number(r[C.KM]),
      precio: Number(r[C.PRECIO]) || 0,
      comentarios: String(r[C.COM] || ''),
      estado: String(r[C.ESTADO] || '').trim() || ESTADO_INICIAL
    };
  }).filter(function (t) { return t.fecha && t.hora; });
}

function activo_(estado) {
  return ESTADOS_QUE_LIBERAN.indexOf(String(estado || '').trim().toLowerCase()) === -1;
}

// Devuelve ["12:00", "13:30", ...] reservados para una fecha "dd/MM/yyyy".
function horariosOcupados(fechaTexto) {
  return leerFilas_()
    .filter(function (t) { return t.fecha === fechaTexto && activo_(t.estado); })
    .map(function (t) { return t.hora; });
}

// Todos los turnos posibles de un día según HORARIOS y DURACION_TURNO_MIN.
function grilla_(iso) {
  var h = HORARIOS[diaSemana_(iso)];
  if (!h) return [];
  var aMin = function (s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; };
  var out = [];
  for (var t = aMin(h[0]); t + DURACION_TURNO_MIN <= aMin(h[1]); t += DURACION_TURNO_MIN) {
    out.push(('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2));
  }
  return out;
}

function obtenerHoja() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(NOMBRE_HOJA);
  if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
    darFormato();
  } else if (String(hoja.getRange(1, C.INSTA + 1).getValue()) !== 'Instagram') {
    // Planilla anterior sin la columna Instagram: se agrega al lado de Teléfono.
    hoja.insertColumnAfter(C.TEL + 1);
    hoja.getRange(1, C.INSTA + 1).setValue('Instagram');
    darFormato();
  }
  return hoja;
}

// "@Juan.Perez", "instagram.com/juan.perez/" o "juan.perez" -> "juan.perez"
function limpiarInstagram_(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?#].*$/, '').replace(/^@+/, '');
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : '';
}

/* Le da formato a la planilla: títulos, anchos, menú de estados y colores.
   Se aplica sola al crear la hoja. Si ya la tenías creada, elegí
   "darFormato" arriba y tocá Ejecutar una vez. */
function darFormato() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOMBRE_HOJA);
  if (!hoja) return obtenerHoja();
  hoja.getRange(1, 1, 1, COLUMNAS.length)
    .setFontWeight('bold').setBackground('#1c1c1c').setFontColor('#f0c873').setVerticalAlignment('middle');
  hoja.setRowHeight(1, 34);
  hoja.setFrozenRows(1);
  hoja.setColumnWidths(1, COLUMNAS.length, 130);
  hoja.setColumnWidth(C.NOMBRE + 1, 180);
  hoja.setColumnWidth(C.INSTA + 1, 150);
  hoja.setColumnWidth(C.SERVICIO + 1, 180);
  hoja.setColumnWidth(C.DIR + 1, 260);
  hoja.setColumnWidth(C.KM + 1, 60);
  hoja.setColumnWidth(C.COM + 1, 260);

  var filas = Math.max(hoja.getMaxRows() - 1, 1000);
  var rEstado = hoja.getRange(2, C.ESTADO + 1, filas, 1);
  rEstado.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS, true).setAllowInvalid(true).build());

  // Colores por estado en toda la fila.
  var rTodo = hoja.getRange(2, 1, filas, COLUMNAS.length);
  var col = String.fromCharCode(65 + C.ESTADO); // "K"
  var colores = [
    ['Confirmado', '#d9ead3'], ['Realizado', '#cfe2f3'], ['Cancelado', '#f4cccc'],
    ['No vino', '#fce5cd'], ['Bloqueado', '#d9d9d9'], ['Pendiente', '#fff2cc']
  ];
  var reglas = colores.map(function (c) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + col + '2="' + c[0] + '"')
      .setBackground(c[1]).setRanges([rTodo]).build();
  });
  hoja.setConditionalFormatRules(reglas);
  return hoja;
}

function hoyIso_() { return Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd'); }
function diaSemana_(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getDay(); }
function sumarDias_(iso, n) {
  var p = iso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

// "2026-10-25" -> "25/10/2026"
function isoATexto(iso) {
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

// Acepta fechas que Sheets haya convertido a "fecha" o texto escrito a mano.
function normalizarFecha(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA_HORARIA, 'dd/MM/yyyy');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3];
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return s;
}

function normalizarHora(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA_HORARIA, 'HH:mm');
  var m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

// Recorta el texto y evita que alguien meta fórmulas en la planilla.
function limpiar(v, max) {
  var s = String(v == null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ---------- Prueba manual ----------
   Elegí "probar" en la barra de arriba y tocá "Ejecutar".
   La primera vez te pide permisos: aceptalos (es tu propio script).
   Crea la hoja "Reservas" con los títulos y muestra los turnos de hoy. */
function probar() {
  obtenerHoja();
  var hoy = Utilities.formatDate(new Date(), ZONA_HORARIA, 'dd/MM/yyyy');
  Logger.log('Hoja lista. Turnos ocupados hoy (' + hoy + '): ' + JSON.stringify(horariosOcupados(hoy)));
}
