/* =============================================================
   ZETAS BARBER — LÓGICA DE LA PÁGINA
   (No hace falta tocar este archivo: todo se configura en config.js)
   ============================================================= */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = n => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
  const pad = n => String(n).padStart(2, "0");
  const aMin = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const aHora = min => pad(Math.floor(min / 60)) + ":" + pad(min % 60);

  const MODO_DEMO = !/^https:\/\/script\.google\.com\//.test(CONFIG.SCRIPT_URL || "");
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const ORIGEN = { lat: CONFIG.ORIGEN_LAT, lng: CONFIG.ORIGEN_LNG };
  const waLink = texto => "https://wa.me/" + CONFIG.WHATSAPP + (texto ? "?text=" + encodeURIComponent(texto) : "");

  /* ---------- Fecha y hora de Argentina (aunque el celu tenga otra zona) ---------- */
  function ahoraAR() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { fecha: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) };
  }
  const isoADate = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const dateAIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sumarDias = (iso, n) => { const d = isoADate(iso); d.setDate(d.getDate() + n); return dateAIso(d); };
  const isoALindo = iso => { const d = isoADate(iso); return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

  function horarioDelDia(iso) {
    if ((CONFIG.DIAS_CERRADOS || []).includes(iso)) return null;
    return CONFIG.HORARIOS[isoADate(iso).getDay()] || null;
  }

  /** ¿El servicio elegido en el formulario es a domicilio? */
  function eligioDomicilio() {
    const r = document.querySelector('#form-reserva input[name="servicio"]:checked');
    const s = r && CONFIG.SERVICIOS.find(x => x.id === r.value);
    return !!(s && s.domicilio);
  }
  // Cuántos minutos antes como mínimo hay que reservar (a domicilio: 24 hs).
  const anticipacionMin = () => eligioDomicilio()
    ? CONFIG.DOMICILIO_HORAS_ANTICIPACION * 60
    : CONFIG.MINUTOS_MINIMOS_ANTES;

  /** Todos los turnos posibles de un día (sin contar los reservados). */
  function turnosDelDia(iso) {
    const h = horarioDelDia(iso);
    if (!h) return [];
    const dur = CONFIG.DURACION_TURNO_MIN;
    const fin = aMin(h.cierra);
    const ahora = ahoraAR();
    // Minutos desde "ahora" hasta el inicio del día elegido.
    const desdeAhora = Math.round((isoADate(iso) - isoADate(ahora.fecha)) / 864e5) * 1440 - ahora.minutos;
    const out = [];
    for (let t = aMin(h.abre); t + dur <= fin; t += dur) { // el turno tiene que TERMINAR dentro del horario
      if (desdeAhora + t > anticipacionMin()) out.push(aHora(t));
    }
    return out;
  }

  /* =============================================================
     CONTENIDO DESDE CONFIG
     ============================================================= */
  function pintarContenido() {
    // Servicios (tarjetas)
    $("#lista-servicios").innerHTML = CONFIG.SERVICIOS.map((s, i) => `
      <article class="service reveal" style="transition-delay:${i * 90}ms">
        <h3 class="service__name">${esc(s.nombre)}</h3>
        <p class="service__desc">${esc(s.descripcion)}</p>
        <p class="service__price">${s.domicilio ? "<small>desde</small>" : ""}${plata(s.domicilio ? CONFIG.DOMICILIO_BASE : s.precio)}${s.domicilio ? `<small>+ ${plata(CONFIG.PRECIO_POR_KM)} por km</small>` : ""}</p>
        ${s.domicilio
          ? `<a href="#domicilio" class="btn btn--ghost">Calcular precio</a>`
          : `<a href="#reservar" class="btn btn--ghost" data-elegir="${esc(s.id)}">Reservar</a>`}
      </article>`).join("");

    // Servicios (opciones del formulario)
    $("#f-servicios").innerHTML = CONFIG.SERVICIOS.map(s => `
      <div class="chip">
        <input type="radio" name="servicio" id="srv-${esc(s.id)}" value="${esc(s.id)}" required>
        <label for="srv-${esc(s.id)}">${esc(s.nombre)} <span>${s.domicilio ? "desde " + plata(CONFIG.DOMICILIO_BASE) : plata(s.precio)}</span></label>
      </div>`).join("");

    $$('[data-precio="base"]').forEach(el => el.textContent = plata(CONFIG.DOMICILIO_BASE));
    $$('[data-precio="km"]').forEach(el => el.textContent = plata(CONFIG.PRECIO_POR_KM));
    $$('[data-texto="direccion"]').forEach(el => el.textContent = CONFIG.DIRECCION_TEXTO);
    $("#domi-aviso").textContent = `El corte a domicilio se reserva con al menos ${CONFIG.DOMICILIO_HORAS_ANTICIPACION} hs de anticipación.`;

    // Horarios: agrupa días consecutivos con el mismo horario (lunes primero)
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const grupos = [];
    orden.forEach(d => {
      const h = CONFIG.HORARIOS[d];
      const clave = h ? h.abre + "-" + h.cierra : "cerrado";
      const ult = grupos[grupos.length - 1];
      if (ult && ult.clave === clave) ult.dias.push(d); else grupos.push({ clave, h, dias: [d] });
    });
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const hoy = isoADate(ahoraAR().fecha).getDay();
    $("#lista-horarios").innerHTML = grupos.map(g => {
      const n = g.dias.map(d => DIAS[d]);
      const nombre = n.length === 1 ? cap(n[0]) : n.length === 2 ? `${cap(n[0])} y ${n[1]}` : `${cap(n[0])} a ${n[n.length - 1]}`;
      return `<li class="${g.dias.includes(hoy) ? "is-today" : ""}"><strong>${nombre}</strong><span>${g.h ? `${g.h.abre} a ${g.h.cierra}` : "Cerrado"}</span></li>`;
    }).join("");

    // Mapa, redes y contacto
    $("#mapa").src = `https://maps.google.com/maps?q=${CONFIG.ORIGEN_LAT},${CONFIG.ORIGEN_LNG}&z=15&hl=es&output=embed`;
    const ig = "https://instagram.com/" + CONFIG.INSTAGRAM;
    const wa = waLink("¡Hola Zetas Barber! Quería consultar por un turno.");
    $("#link-ig").href = ig; $("#link-ig span").textContent = "@" + CONFIG.INSTAGRAM;
    $("#link-wa").href = wa; $("#wa-float").href = wa;
    $("#ft-wa").href = wa; $("#ft-wa").textContent = "WhatsApp: +" + CONFIG.WHATSAPP;
    $("#ft-ig").href = ig; $("#ft-ig").textContent = "Instagram: @" + CONFIG.INSTAGRAM;
    if (CONFIG.EMAIL) { $("#ft-mail-li").hidden = false; $("#ft-mail").href = "mailto:" + CONFIG.EMAIL; $("#ft-mail").textContent = CONFIG.EMAIL; }
    $("#anio").textContent = new Date().getFullYear();
    if (MODO_DEMO) $("#demo-banner").hidden = false;
  }

  /* =============================================================
     MENÚ Y ANIMACIONES
     ============================================================= */
  function iniciarUI() {
    const btn = $(".nav-toggle"), nav = $("#nav");
    const cerrar = () => { nav.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", "Abrir menú"); };
    btn.addEventListener("click", () => {
      const abierto = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(abierto));
      btn.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    });
    $$("a", nav).forEach(a => a.addEventListener("click", cerrar));
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrar(); });

    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(el => el.classList.add("is-visible")); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(el => io.observe(el));
  }

  /* =============================================================
     AUTOCOMPLETADO DE DIRECCIONES
     ============================================================= */
  function autocompletar(input, lista, alElegir) {
    let timer, seq = 0, items = [], activo = -1;
    const cerrar = () => { lista.hidden = true; input.setAttribute("aria-expanded", "false"); activo = -1; };
    const marcar = i => {
      activo = i;
      $$("li", lista).forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
      if (i >= 0) input.setAttribute("aria-activedescendant", lista.id + "-" + i); else input.removeAttribute("aria-activedescendant");
    };
    const elegir = i => {
      const s = items[i]; if (!s) return;
      input.value = [s.titulo, s.detalle].filter(Boolean).join(", ");
      input._sugerencia = s;
      cerrar();
      alElegir(s);
    };

    input.addEventListener("input", () => {
      input._sugerencia = null;
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 4) return cerrar();
      timer = setTimeout(async () => {
        const mio = ++seq;
        try {
          const r = await Mapas.sugerencias(q);
          if (mio !== seq) return;
          items = r;
          if (!r.length) return cerrar();
          lista.innerHTML = r.map((s, i) => `<li role="option" id="${lista.id}-${i}" aria-selected="false">${esc(s.titulo)}${s.detalle ? `<small>${esc(s.detalle)}</small>` : ""}</li>`).join("");
          lista.hidden = false; input.setAttribute("aria-expanded", "true");
        } catch { cerrar(); } // si falla el autocompletado igual se puede calcular con el botón
      }, 350);
    });
    input.addEventListener("keydown", e => {
      if (lista.hidden) { if (e.key === "Enter") { e.preventDefault(); alElegir(null); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); marcar(Math.min(activo + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); marcar(Math.max(activo - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); activo >= 0 ? elegir(activo) : (cerrar(), alElegir(null)); }
      else if (e.key === "Escape") cerrar();
    });
    // mousedown para que no se pierda el clic con el blur
    lista.addEventListener("mousedown", e => {
      const li = e.target.closest("li"); if (!li) return;
      e.preventDefault(); elegir($$("li", lista).indexOf(li));
    });
    input.addEventListener("blur", () => setTimeout(cerrar, 150));
  }

  /* =============================================================
     CALCULADORA DE DOMICILIO (estado compartido con el formulario)
     ============================================================= */
  let domi = null;       // { direccion, lat, lng, km, kmCobrados, precio }
  let calculando = null; // promesa en curso

  const MENSAJES = {
    NO_ENCONTRADA: "No encontramos esa dirección. Probá con calle, número y localidad (ej: “Hipólito Yrigoyen 1200, General Pacheco”) o elegí una opción de la lista.",
    PERMISO: "No nos diste permiso para ver tu ubicación. Podés habilitarlo en la configuración del navegador o escribir tu dirección.",
    GEO_NO_DISPONIBLE: "No pudimos obtener tu ubicación. Probá de nuevo o escribí tu dirección.",
    SIN_RUTA: "No encontramos un camino en auto hasta esa dirección. Revisala o consultanos.",
    SERVICIO: "El servicio de mapas no está respondiendo en este momento.",
    VACIA: "Escribí tu dirección o tocá “Usar mi ubicación”."
  };

  const cajasResultado = () => [$("#calc-result"), $("#f-calc-result")];

  function pintarCargando(texto) {
    cajasResultado().forEach(c => { c.className = c.className.replace(/\bres--\w+/g, "").trim() + " res--loading"; c.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(texto)}`; });
  }
  function pintarError(code, extra) {
    const msg = code === "FUERA_RANGO"
      ? `Esa dirección queda a ${extra} km. Para distancias tan largas coordinamos el precio por WhatsApp.`
      : (MENSAJES[code] || MENSAJES.SERVICIO);
    const sugerirWa = code !== "VACIA" && code !== "PERMISO";
    cajasResultado().forEach(c => {
      c.className = c.className.replace(/\bres--\w+/g, "").trim() + " res--error";
      c.innerHTML = `<p>${esc(msg)}</p>${sugerirWa ? `<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="${waLink("¡Hola! Quería consultar el precio de un corte a domicilio.")}">Consultar por WhatsApp</a>` : ""}`;
    });
  }
  function pintarDomi() {
    const [grande, mini] = cajasResultado();
    [grande, mini].forEach(c => c.className = c.className.replace(/\bres--\w+/g, "").trim());
    if (!domi) { grande.innerHTML = ""; mini.innerHTML = ""; actualizarTotal(); return; }
    const kmTxt = domi.km.toLocaleString("es-AR", { maximumFractionDigits: 1 });
    const desglose = `Base ${plata(CONFIG.DOMICILIO_BASE)} + ${domi.kmCobrados} km × ${plata(CONFIG.PRECIO_POR_KM)} = ${plata(domi.precio)}`;
    grande.innerHTML = `
      <p class="res__km">Distancia en auto: <strong>${kmTxt} km</strong> (se cobran ${domi.kmCobrados} km)</p>
      <p class="res__desglose">${desglose}</p>
      <p class="res__total">${plata(domi.precio)}</p>
      ${domi.direccion ? `<p class="res__dir">📍 ${esc(domi.direccion)}</p>` : ""}
      <a href="#reservar" class="btn btn--gold res__cta" id="calc-reservar">Reservar a domicilio</a>`;
    mini.innerHTML = `<p class="res__km">Distancia: <strong>${kmTxt} km</strong></p><p class="res__desglose" style="margin:0">${desglose}</p>`;
    $("#calc-reservar").addEventListener("click", () => elegirServicio("domicilio"));
    actualizarTotal();
  }

  /**
   * Calcula el precio a domicilio.
   * fuente: { sugerencia } | { texto } | { gps: true }
   */
  async function calcularDomicilio(fuente) {
    $("#e-dir").textContent = "";
    const tarea = (async () => {
      try {
        let destino;
        if (fuente.gps) {
          pintarCargando("Buscando tu ubicación…");
          const c = await Mapas.miUbicacion();
          pintarCargando("Calculando la ruta…");
          destino = { ...c, direccion: await Mapas.direccionDesdeCoords(c.lat, c.lng) };
          const txt = destino.direccion || "Mi ubicación actual";
          $("#calc-dir").value = txt; $("#f-dir").value = txt;
        } else if (fuente.sugerencia && fuente.sugerencia.lat != null) {
          const s = fuente.sugerencia;
          destino = { lat: s.lat, lng: s.lng, direccion: [s.titulo, s.detalle].filter(Boolean).join(", ") };
        } else {
          const texto = (fuente.sugerencia && fuente.sugerencia.texto) || (fuente.texto || "").trim();
          if (!texto) throw new MapaError("VACIA");
          pintarCargando("Buscando la dirección…");
          destino = await Mapas.geocodificar(texto);
          destino.direccion = texto; // se guarda lo que escribió el cliente, más fácil de leer
        }
        pintarCargando("Calculando la distancia en auto…");
        const km = await Mapas.distanciaKm(ORIGEN, destino);
        if (km > CONFIG.DOMICILIO_MAX_KM) { domi = null; actualizarTotal(); pintarError("FUERA_RANGO", Math.round(km)); return null; }
        const kmCobrados = Math.ceil(Math.round(km * 100) / 100); // 4,3 km -> 5 km
        domi = { ...destino, km, kmCobrados, precio: CONFIG.DOMICILIO_BASE + kmCobrados * CONFIG.PRECIO_POR_KM };
        if (!fuente.gps) { $("#calc-dir").value = $("#f-dir").value = fuente.sugerencia ? destino.direccion : (fuente.texto || "").trim(); }
        pintarDomi();
        return domi;
      } catch (e) {
        domi = null; actualizarTotal();
        pintarError(e.code || "SERVICIO");
        return null;
      }
    })();
    calculando = tarea;
    const r = await tarea;
    if (calculando === tarea) calculando = null;
    return r;
  }

  function iniciarCalculadora() {
    const dir = $("#calc-dir"), fdir = $("#f-dir");
    autocompletar(dir, $("#calc-sug"), s => calcularDomicilio(s ? { sugerencia: s } : { texto: dir.value }));
    autocompletar(fdir, $("#f-sug"), s => calcularDomicilio(s ? { sugerencia: s } : { texto: fdir.value }));
    $("#calc-btn").addEventListener("click", () => calcularDomicilio(dir._sugerencia ? { sugerencia: dir._sugerencia } : { texto: dir.value }));
    $("#f-calc").addEventListener("click", () => calcularDomicilio(fdir._sugerencia ? { sugerencia: fdir._sugerencia } : { texto: fdir.value }));
    $("#calc-geo").addEventListener("click", () => calcularDomicilio({ gps: true }));
    $("#f-geo").addEventListener("click", () => calcularDomicilio({ gps: true }));
    // Si cambian la dirección después de calcular, el precio anterior ya no vale.
    [dir, fdir].forEach(inp => inp.addEventListener("input", () => { if (domi) { domi = null; pintarDomi(); } }));
  }

  /* =============================================================
     RESERVAS
     ============================================================= */
  const form = $("#form-reserva");
  let horaElegida = null;
  let consultaSeq = 0;

  const servicioActual = () => {
    const r = $('input[name="servicio"]:checked', form);
    return r ? CONFIG.SERVICIOS.find(s => s.id === r.value) : null;
  };

  function precioActual() {
    const s = servicioActual();
    if (!s) return null;
    if (s.domicilio) return domi ? domi.precio : null;
    return s.precio;
  }

  function actualizarTotal() {
    const s = servicioActual();
    const p = precioActual();
    $("#f-total").textContent = p != null ? plata(p) : (s && s.domicilio ? "Calculá la dirección" : "—");
    $("#f-total").style.fontSize = p != null ? "" : "1.1rem";
  }

  function elegirServicio(id) {
    const r = $("#srv-" + id);
    if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }
  }

  function alCambiarServicio() {
    const s = servicioActual();
    $("#e-servicio").textContent = "";
    const cambioDomicilio = $("#domi-box").hidden !== !(s && s.domicilio);
    $("#domi-box").hidden = !(s && s.domicilio);
    actualizarTotal();
    // A domicilio cambian los días y horarios posibles (24 hs de anticipación).
    if (cambioDomicilio) {
      const iso = $("#f-fecha").value;
      if (iso && !diaAbierto(iso)) $("#f-fecha").value = "";
      pintarDias();
      cargarHorarios();
    }
  }

  function pintarSlots(html) { $("#f-slots").innerHTML = html; }

  /* ---------- Selector de días (igual que en el panel) ---------- */
  const diasReservables = () => {
    const hoy = ahoraAR().fecha;
    const out = [];
    for (let i = 0; i <= CONFIG.DIAS_ANTICIPACION; i++) out.push(sumarDias(hoy, i));
    return out;
  };
  const diaAbierto = iso => !!horarioDelDia(iso) && turnosDelDia(iso).length > 0;

  function pintarDias() {
    const hoy = ahoraAR().fecha;
    const elegido = $("#f-fecha").value;
    const dias = diasReservables();
    const cont = $("#f-dias");
    cont.innerHTML = dias.map(iso => {
      const d = isoADate(iso);
      const abierto = diaAbierto(iso);
      return `<button type="button" class="day" role="radio" data-iso="${iso}" aria-checked="${iso === elegido}"
        aria-label="${isoALindo(iso)}${abierto ? "" : " (sin turnos)"}" ${abierto ? "" : "disabled"}>
        <small>${iso === hoy ? "hoy" : DIAS_CORTO[d.getDay()]}</small><b>${d.getDate()}</b><i>${MESES[d.getMonth()]}</i></button>`;
    }).join("");

    if (elegido) {
      const d = isoADate(elegido);
      const nombre = elegido === hoy ? "Hoy" : elegido === sumarDias(hoy, 1) ? "Mañana" : DIAS[d.getDay()];
      $("#f-fecha-titulo").textContent = `${nombre} ${d.getDate()} ${MESES[d.getMonth()]}`;
      const b = cont.querySelector(`[data-iso="${elegido}"]`);
      if (b) cont.scrollTo({ left: b.offsetLeft - cont.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
    } else {
      $("#f-fecha-titulo").textContent = "Elegí un día";
    }
    const abiertos = dias.filter(diaAbierto);
    $('#reservar [data-mover="-1"]').disabled = !elegido || !abiertos.some(i => i < elegido);
    $('#reservar [data-mover="1"]').disabled = !abiertos.some(i => !elegido || i > elegido);
  }

  function elegirFecha(iso) {
    $("#f-fecha").value = iso;
    pintarDias();
    cargarHorarios();
  }

  // Flechas: saltan al día abierto anterior o siguiente.
  function moverDia(paso) {
    const elegido = $("#f-fecha").value;
    const abiertos = diasReservables().filter(diaAbierto);
    const destino = paso > 0
      ? abiertos.find(i => !elegido || i > elegido)
      : abiertos.filter(i => i < elegido).pop();
    if (destino) elegirFecha(destino);
  }

  async function cargarHorarios() {
    const iso = $("#f-fecha").value;
    horaElegida = null;
    $("#e-fecha").textContent = ""; $("#e-hora").textContent = ""; $("#f-fecha-info").textContent = "";
    if (!iso) return pintarSlots(`<p class="hint">Primero elegí una fecha.</p>`);

    const hoy = ahoraAR().fecha;
    if (iso < hoy) { $("#e-fecha").textContent = "Esa fecha ya pasó. Elegí otra."; return pintarSlots(""); }
    if (iso > sumarDias(hoy, CONFIG.DIAS_ANTICIPACION)) { $("#e-fecha").textContent = `Podés reservar hasta ${CONFIG.DIAS_ANTICIPACION} días para adelante.`; return pintarSlots(""); }
    if (!horarioDelDia(iso)) { $("#e-fecha").textContent = "Ese día no atendemos. Elegí otra fecha."; return pintarSlots(""); }

    const h = horarioDelDia(iso);
    $("#f-fecha-info").textContent = `Ese día atendemos de ${h.abre} a ${h.cierra}.`;
    const posibles = turnosDelDia(iso);
    if (!posibles.length) {
      return pintarSlots(`<p class="slots__msg hint">${eligioDomicilio()
        ? `Los cortes a domicilio se reservan con ${CONFIG.DOMICILIO_HORAS_ANTICIPACION} hs de anticipación. Elegí otro día.`
        : "No quedan turnos para hoy. Elegí otro día."}</p>`);
    }

    const mio = ++consultaSeq;
    pintarSlots(`<p class="slots__msg hint res--loading"><span class="spinner" aria-hidden="true"></span>Buscando turnos libres…</p>`);
    let ocupados = [];
    try {
      ocupados = await consultarOcupados(iso);
    } catch {
      if (mio !== consultaSeq) return;
      return pintarSlots(`<p class="slots__msg error">No pudimos consultar los turnos libres. Probá de nuevo en un momento o <a href="${waLink("¡Hola! Quería sacar un turno para el " + isoALindo(iso) + ".")}" target="_blank" rel="noopener">escribinos por WhatsApp</a>.</p>`);
    }
    if (mio !== consultaSeq) return; // el cliente cambió de fecha mientras tanto

    const libres = posibles.filter(t => !ocupados.includes(t));
    if (!libres.length) return pintarSlots(`<p class="slots__msg hint">Ese día ya está completo. Probá con otra fecha.</p>`);
    pintarSlots(libres.map(t => `<button type="button" class="slot" role="radio" aria-checked="false" data-hora="${t}">${t}</button>`).join(""));
  }

  async function consultarOcupados(iso) {
    if (MODO_DEMO) { await new Promise(r => setTimeout(r, 350)); return []; }
    const url = CONFIG.SCRIPT_URL + "?accion=ocupados&fecha=" + encodeURIComponent(iso) + "&_=" + Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "error");
      return data.ocupados || [];
    } finally { clearTimeout(t); }
  }

  async function guardarReserva(datos) {
    if (MODO_DEMO) { await new Promise(r => setTimeout(r, 700)); return { ok: true, demo: true }; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      // text/plain evita el "preflight" CORS, que Apps Script no soporta.
      const r = await fetch(CONFIG.SCRIPT_URL, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(datos)
      });
      return await r.json();
    } finally { clearTimeout(t); }
  }

  function validar() {
    let ok = true, primero = null;
    const marcarError = (id, inputId, msg) => {
      $(id).textContent = msg;
      if (inputId) $(inputId).setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) { ok = false; primero = primero || $(inputId || id); }
    };
    const nombre = $("#f-nombre").value.trim();
    const telDigitos = $("#f-tel").value.replace(/\D/g, "");
    marcarError("#e-nombre", "#f-nombre", nombre.length < 3 ? "Escribí tu nombre y apellido." : "");
    marcarError("#e-tel", "#f-tel", telDigitos.length < 8 || telDigitos.length > 15 ? "Escribí un teléfono válido (con código de área)." : "");
    marcarError("#e-insta", "#f-insta", limpiarInstagram($("#f-insta").value) ? "" : "Escribí tu usuario de Instagram (por ejemplo: juan.perez).");
    const s = servicioActual();
    marcarError("#e-servicio", null, s ? "" : "Elegí un servicio.");
    if (!s && !primero) primero = $("#f-servicios input");
    if (s && s.domicilio) marcarError("#e-dir", "#f-dir", domi ? "" : "Calculá el precio con tu dirección antes de confirmar.");
    else $("#e-dir").textContent = "";
    marcarError("#e-fecha", null, $("#f-fecha").value ? $("#e-fecha").textContent : "Elegí una fecha.");
    if (!$("#f-fecha").value && !primero) primero = $("#f-dias");
    if (!horaElegida) { $("#e-hora").textContent = "Elegí un horario."; ok = false; primero = primero || $("#f-slots"); }
    if (primero) { primero.scrollIntoView({ behavior: "smooth", block: "center" }); if (primero.focus) primero.focus({ preventScroll: true }); }
    return ok;
  }

  // "@Juan.Perez", "instagram.com/juan.perez/" o "juan.perez" -> "juan.perez" ("" si no es válido)
  function limpiarInstagram(v) {
    const s = String(v || "").trim().toLowerCase()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/[/?#].*$/, "").replace(/^@+/, "");
    return /^[a-z0-9._]{1,30}$/.test(s) ? s : "";
  }

  function mensajeWhatsApp(d) {
    const lineas = [
      "¡Hola Zetas Barber! Reservé un turno desde la web:",
      `• Nombre: ${d.nombre}`,
      `• Teléfono: ${d.telefono}`,
      `• Instagram: @${d.instagram}`,
      `• Servicio: ${d.servicio}`,
      `• Fecha: ${isoALindo(d.fecha)}`,
      `• Hora: ${d.hora}`
    ];
    if (d.direccion) lineas.push(`• Dirección: ${d.direccion} (${d.km} km)`);
    lineas.push(`• Total: ${plata(d.precio)}`);
    if (d.comentarios) lineas.push(`• Comentarios: ${d.comentarios}`);
    return lineas.join("\n");
  }

  function mostrarConfirmacion(d, demo) {
    const filas = [
      ["Servicio", d.servicio],
      ["Fecha", isoALindo(d.fecha)],
      ["Hora", d.hora + " hs"]
    ];
    if (d.direccion) filas.push(["Dirección", d.direccion], ["Distancia", d.km + " km"]);
    $("#modal-resumen").innerHTML = filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")
      + `<div class="sum-total"><dt>Total</dt><dd>${plata(d.precio)}</dd></div>`;
    $("#modal-lead").textContent = demo
      ? "Modo demo: este turno NO se guardó porque la planilla todavía no está conectada."
      : `Te esperamos, ${d.nombre.split(" ")[0]}. Mandanos la confirmación por WhatsApp así la tenemos a mano.`;
    $("#modal-wa").href = waLink(mensajeWhatsApp(d));
    const m = $("#modal-ok");
    if (typeof m.showModal === "function") m.showModal(); else m.setAttribute("open", "");
  }

  function iniciarReservas() {
    pintarDias();
    $("#f-dias").addEventListener("click", e => {
      const b = e.target.closest(".day"); if (b && !b.disabled) elegirFecha(b.dataset.iso);
    });
    $$("#reservar [data-mover]").forEach(b => b.addEventListener("click", () => moverDia(Number(b.dataset.mover))));

    form.addEventListener("change", e => { if (e.target.name === "servicio") alCambiarServicio(); });
    $("#lista-servicios").addEventListener("click", e => {
      const b = e.target.closest("[data-elegir]"); if (b) elegirServicio(b.dataset.elegir);
    });

    $("#f-slots").addEventListener("click", e => {
      const b = e.target.closest(".slot"); if (!b) return;
      $$(".slot", $("#f-slots")).forEach(x => x.setAttribute("aria-checked", String(x === b)));
      horaElegida = b.dataset.hora;
      $("#e-hora").textContent = "";
    });

    [["#f-nombre", "#e-nombre"], ["#f-tel", "#e-tel"], ["#f-insta", "#e-insta"]].forEach(([id, err]) =>
      $(id).addEventListener("input", e => {
        e.target.removeAttribute("aria-invalid");
        $(err).textContent = "";
      }));

    form.addEventListener("submit", async e => {
      e.preventDefault();
      $("#f-msg").textContent = "";
      const btn = $("#f-submit");
      // Si eligió domicilio y escribió la dirección pero no calculó, calcula ahora.
      const s = servicioActual();
      if (s && s.domicilio && !domi && $("#f-dir").value.trim()) {
        btn.disabled = true; btn.textContent = "Calculando domicilio…";
        await (calculando || calcularDomicilio({ texto: $("#f-dir").value }));
        btn.disabled = false; btn.textContent = "Confirmar turno";
      }
      if (!validar()) return;

      const datos = {
        nombre: $("#f-nombre").value.trim(),
        telefono: $("#f-tel").value.trim(),
        instagram: limpiarInstagram($("#f-insta").value),
        servicio: s.nombre,
        fecha: $("#f-fecha").value,      // AAAA-MM-DD
        hora: horaElegida,               // HH:MM
        direccion: s.domicilio ? domi.direccion : "",
        km: s.domicilio ? domi.kmCobrados : "",
        precio: precioActual(),
        comentarios: $("#f-com").value.trim()
      };

      btn.disabled = true; btn.textContent = "Guardando turno…";
      try {
        const r = await guardarReserva(datos);
        if (r && r.ok) {
          mostrarConfirmacion(datos, r.demo);
          form.reset(); domi = null; pintarDomi(); alCambiarServicio();
          elegirFecha(datos.fecha);
        } else if (r && r.error === "FALTA_INSTAGRAM") {
          $("#e-insta").textContent = "Escribí tu usuario de Instagram (por ejemplo: juan.perez).";
          $("#f-insta").focus();
        } else if (r && r.error === "ANTICIPACION") {
          $("#f-msg").textContent = `Los cortes a domicilio se reservan con ${CONFIG.DOMICILIO_HORAS_ANTICIPACION} hs de anticipación. Elegí otro horario.`;
          cargarHorarios();
        } else if (r && r.error === "OCUPADO") {
          $("#f-msg").textContent = "¡Uy! Alguien acaba de reservar ese horario. Elegí otro, por favor.";
          cargarHorarios();
        } else {
          throw new Error((r && r.mensaje) || "error");
        }
      } catch {
        $("#f-msg").innerHTML = `No pudimos guardar el turno. Probá de nuevo o <a href="${waLink(mensajeWhatsApp(datos))}" target="_blank" rel="noopener">reservalo por WhatsApp</a>.`;
      } finally {
        btn.disabled = false; btn.textContent = "Confirmar turno";
      }
    });

    $("#modal-close").addEventListener("click", () => $("#modal-ok").close());
    $("#modal-ok").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  }

  /* ---------- Arranque ---------- */
  pintarContenido();
  iniciarUI();
  iniciarCalculadora();
  iniciarReservas();
})();
