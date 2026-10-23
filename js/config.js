/* =============================================================
   ZETAS BARBER — CONFIGURACIÓN
   -------------------------------------------------------------
   Este es el ÚNICO archivo que necesitás tocar para cambiar
   precios, horarios, teléfono, redes o la conexión con la planilla.
   Editalo con cualquier editor de texto (Bloc de notas sirve).
   Respetá las comillas y las comas.
   ============================================================= */

const CONFIG = {
  // ---------- CONEXIÓN CON LA PLANILLA ----------
  // Pegá acá la URL del Web App de Google Apps Script
  // (termina en /exec). Mirá INSTRUCCIONES.md, paso 4.
  // Mientras diga "PEGAR_ACA...", la web funciona en MODO DEMO
  // (no guarda nada, solo muestra cómo se vería).
  SCRIPT_URL: "PEGAR_ACA_LA_URL_DEL_WEB_APP",

  // ---------- DATOS DEL NEGOCIO ----------
  NOMBRE: "Zetas Barber",
  // WhatsApp con código de país, SIN "+", espacios ni guiones.
  // Argentina celular: 549 + código de área sin 0 + número sin 15.
  // Ej: 11 5555-1234  ->  "5491155551234"
  WHATSAPP: "5491100000000",
  INSTAGRAM: "zetasbarber",          // usuario de Instagram, sin @
  EMAIL: "",                          // opcional, dejalo vacío si no querés mostrarlo
  DIRECCION_TEXTO: "Barrio El Zorzal, General Pacheco, Tigre, Buenos Aires",

  // Punto de partida para calcular el corte a domicilio.
  // Para sacar tus coordenadas exactas: abrí Google Maps, tocá y
  // mantené apretado sobre tu local, y copiá los dos números que aparecen.
  // El primero es la LAT, el segundo la LNG.
  // (Estos valores son aproximados al barrio: reemplazalos.)
  ORIGEN_LAT: -34.4565,
  ORIGEN_LNG: -58.6420,

  // ---------- SERVICIOS Y PRECIOS (en pesos) ----------
  SERVICIOS: [
    { id: "corte",        nombre: "Corte",                  precio: 8000,  descripcion: "Corte clásico o moderno, con terminación a navaja." },
    { id: "completo",     nombre: "Corte + cejas + barba",  precio: 10000, descripcion: "El combo completo: corte, perfilado de cejas y barba." },
    { id: "domicilio",    nombre: "Corte a domicilio",      precio: 15000, descripcion: "Vamos a tu casa. Base + costo por kilómetro.", domicilio: true }
  ],
  DOMICILIO_BASE: 15000,   // precio base del corte a domicilio
  PRECIO_POR_KM: 1000,     // se suma por cada km (redondeado hacia arriba)
  DOMICILIO_MAX_KM: 40,    // más lejos que esto, se pide consultar por WhatsApp

  // ---------- HORARIOS ----------
  DURACION_TURNO_MIN: 45,  // duración de cada turno en minutos
  // 0 = domingo, 1 = lunes, ... 6 = sábado. null = cerrado ese día.
  HORARIOS: {
    0: { abre: "12:00", cierra: "18:00" }, // domingo
    1: { abre: "12:00", cierra: "20:00" }, // lunes
    2: { abre: "12:00", cierra: "20:00" }, // martes
    3: { abre: "12:00", cierra: "20:00" }, // miércoles
    4: { abre: "12:00", cierra: "20:00" }, // jueves
    5: { abre: "12:00", cierra: "20:00" }, // viernes
    6: { abre: "12:00", cierra: "18:00" }  // sábado
  },
  // Días puntuales en que NO se atiende (feriados, vacaciones). Formato "AAAA-MM-DD".
  DIAS_CERRADOS: [
    // "2026-12-25",
    // "2027-01-01",
  ],
  DIAS_ANTICIPACION: 30,   // hasta cuántos días para adelante se puede reservar
  MINUTOS_MINIMOS_ANTES: 30, // no se puede reservar un turno que empieza en menos de X minutos
  ZONA_HORARIA: "America/Argentina/Buenos_Aires",

  // ---------- MAPAS / DISTANCIA ----------
  // "osm"    = gratis, sin API key (Photon + Nominatim + OSRM).
  // "google" = Google Maps Distance Matrix (necesita GOOGLE_API_KEY).
  PROVEEDOR_MAPAS: "osm",
  GOOGLE_API_KEY: ""
};
