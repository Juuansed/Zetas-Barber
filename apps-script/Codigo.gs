/* =============================================================
   ZETAS BARBER — Script de la planilla de turnos
   -------------------------------------------------------------
   Pegá TODO este código en Extensiones > Apps Script de tu
   planilla de Google Sheets (ver INSTRUCCIONES.md).
   - doGet:  la web pregunta qué horarios están ocupados en una fecha.
   - doPost: la web manda una reserva nueva y se agrega como fila.
   ============================================================= */

var NOMBRE_HOJA = 'Reservas';
var ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
var ESTADO_INICIAL = 'Pendiente';
// Si en la columna "Estado" escribís alguno de estos, ese horario se libera.
var ESTADOS_QUE_LIBERAN = ['cancelado', 'cancelada', 'anulado', 'no vino'];

var COLUMNAS = [
  'Fecha de registro', 'Nombre', 'Teléfono', 'Servicio', 'Fecha del turno', 'Hora',
  'Dirección (si es a domicilio)', 'Km', 'Precio total', 'Comentarios', 'Estado'
];
// Posición (empezando en 0) de las columnas que se usan para chequear duplicados.
var COL_FECHA = 4, COL_HORA = 5, COL_ESTADO = 10;


/* ---------- La web pide los horarios ocupados de una fecha ---------- */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.accion === 'ocupados') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '')) return responder({ ok: false, error: 'FECHA_INVALIDA' });
      return responder({ ok: true, fecha: p.fecha, ocupados: horariosOcupados(isoATexto(p.fecha)) });
    }
    return responder({ ok: true, mensaje: 'Zetas Barber: el script está funcionando.' });
  } catch (err) {
    return responder({ ok: false, error: 'ERROR', mensaje: String(err) });
  }
}


/* ---------- La web manda una reserva nueva ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Validaciones básicas
    var nombre = limpiar(d.nombre, 80);
    var telefono = limpiar(d.telefono, 25);
    var servicio = limpiar(d.servicio, 60);
    var hora = String(d.hora || '');
    if (!nombre || !telefono || !servicio) return responder({ ok: false, error: 'FALTAN_DATOS' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') || !/^\d{2}:\d{2}$/.test(hora)) {
      return responder({ ok: false, error: 'FECHA_INVALIDA' });
    }
    var hoy = Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd');
    if (d.fecha < hoy) return responder({ ok: false, error: 'FECHA_PASADA' });

    var fechaTexto = isoATexto(d.fecha);

    // Bloqueo: si dos personas reservan al mismo tiempo, se atienden de a una.
    lock.waitLock(20000);

    if (horariosOcupados(fechaTexto).indexOf(hora) !== -1) {
      return responder({ ok: false, error: 'OCUPADO' });
    }

    var hoja = obtenerHoja();
    var fila = hoja.getLastRow() + 1;
    var rango = hoja.getRange(fila, 1, 1, COLUMNAS.length);
    rango.setNumberFormats([[
      'dd/MM/yyyy HH:mm', '@', '@', '@', '@', '@', '@', '0', '$#,##0', '@', '@'
    ]]);
    rango.setValues([[
      new Date(),
      nombre,
      telefono,
      servicio,
      fechaTexto,
      hora,
      limpiar(d.direccion, 200),
      d.km === '' || d.km == null ? '' : Number(d.km),
      Number(d.precio) || 0,
      limpiar(d.comentarios, 400),
      ESTADO_INICIAL
    ]]);
    SpreadsheetApp.flush();

    return responder({ ok: true, fila: fila });
  } catch (err) {
    return responder({ ok: false, error: 'ERROR', mensaje: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}


/* ---------- Ayudantes ---------- */

// Devuelve ["12:00", "13:30", ...] reservados para una fecha "dd/MM/yyyy".
function horariosOcupados(fechaTexto) {
  var hoja = obtenerHoja();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  var datos = hoja.getRange(2, 1, ultima - 1, COLUMNAS.length).getValues();
  var ocupados = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var estado = String(fila[COL_ESTADO] || '').trim().toLowerCase();
    if (ESTADOS_QUE_LIBERAN.indexOf(estado) !== -1) continue;
    if (normalizarFecha(fila[COL_FECHA]) !== fechaTexto) continue;
    var h = normalizarHora(fila[COL_HORA]);
    if (h) ocupados.push(h);
  }
  return ocupados;
}

function obtenerHoja() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(NOMBRE_HOJA);
  if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
      .setFontWeight('bold').setBackground('#1c1c1c').setFontColor('#f0c873');
    hoja.setFrozenRows(1);
    hoja.setColumnWidths(1, COLUMNAS.length, 140);
    hoja.setColumnWidth(7, 260);
    hoja.setColumnWidth(10, 260);
    // Menú desplegable en "Estado" para cambiarlo con un toque.
    var regla = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pendiente', 'Confirmado', 'Realizado', 'Cancelado', 'No vino'], true)
      .setAllowInvalid(true).build();
    hoja.getRange(2, COL_ESTADO + 1, 1000, 1).setDataValidation(regla);
  }
  return hoja;
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
