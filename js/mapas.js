/* =============================================================
   MAPAS: direcciones y distancia en ruta.
   -------------------------------------------------------------
   Dos proveedores con la misma interfaz:
     - "osm"    (gratis, sin key): Photon para autocompletar,
                Nominatim para buscar direcciones, OSRM para la ruta.
     - "google" (con API key): Places + Geocoder + Distance Matrix.
   Se elige con CONFIG.PROVEEDOR_MAPAS en config.js.
   ============================================================= */

class MapaError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const Mapas = (() => {
  const TIMEOUT_MS = 12000;
  // Caja aproximada de zona norte del GBA, para priorizar resultados cercanos.
  const VIEWBOX = "-58.95,-34.30,-58.40,-34.65";

  async function fetchJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { "Accept": "application/json" } });
      if (!r.ok) throw new MapaError("SERVICIO", "HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (e instanceof MapaError) throw e;
      throw new MapaError("SERVICIO", e.message);
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------------- Proveedor gratuito (OpenStreetMap) ---------------- */
  const osm = {
    async sugerencias(texto) {
      const url = "https://photon.komoot.io/api/?limit=6"
        + "&q=" + encodeURIComponent(texto)
        + "&lat=" + CONFIG.ORIGEN_LAT + "&lon=" + CONFIG.ORIGEN_LNG
        + "&bbox=-73.6,-55.1,-53.6,-21.8"; // Argentina
      const data = await fetchJSON(url);
      return (data.features || []).map(f => {
        const p = f.properties || {};
        const calle = [p.street || p.name, p.housenumber].filter(Boolean).join(" ");
        const titulo = calle || p.name || "";
        const detalle = [p.district || p.locality, p.city, p.state].filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i).join(", ");
        return { titulo, detalle, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      }).filter(s => s.titulo);
    },

    async geocodificar(texto) {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar"
        + "&accept-language=es&viewbox=" + VIEWBOX
        + "&q=" + encodeURIComponent(texto);
      let data = await fetchJSON(url);
      if (!data.length) {
        // Segundo intento con Photon, que tolera mejor los errores de tipeo.
        const s = await osm.sugerencias(texto).catch(() => []);
        if (s.length) return { lat: s[0].lat, lng: s[0].lng, direccion: [s[0].titulo, s[0].detalle].filter(Boolean).join(", ") };
        throw new MapaError("NO_ENCONTRADA");
      }
      return { lat: +data[0].lat, lng: +data[0].lon, direccion: data[0].display_name };
    },

    async direccionDesdeCoords(lat, lng) {
      try {
        const d = await fetchJSON("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es"
          + "&lat=" + lat + "&lon=" + lng);
        const a = d.address || {};
        const calle = [a.road, a.house_number].filter(Boolean).join(" ");
        const zona = a.suburb || a.neighbourhood || a.city_district || a.town || a.city || "";
        return [calle, zona].filter(Boolean).join(", ") || d.display_name || "";
      } catch { return ""; }
    },

    async distanciaKm(origen, destino) {
      const url = "https://router.project-osrm.org/route/v1/driving/"
        + origen.lng + "," + origen.lat + ";" + destino.lng + "," + destino.lat
        + "?overview=false&alternatives=false";
      const data = await fetchJSON(url);
      if (data.code !== "Ok" || !data.routes || !data.routes.length) throw new MapaError("SIN_RUTA");
      return data.routes[0].distance / 1000;
    }
  };

  /* ---------------- Proveedor Google Maps (opcional) ----------------
     Para usarlo: en config.js poné PROVEEDOR_MAPAS: "google" y tu
     GOOGLE_API_KEY (con Maps JavaScript API, Places API y
     Distance Matrix API habilitadas). Nada más cambia. */
  let googleListo = null;
  function cargarGoogle() {
    if (googleListo) return googleListo;
    googleListo = new Promise((resolve, reject) => {
      window.__zetasGoogleOk = () => resolve(window.google);
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?libraries=places&language=es&region=AR&callback=__zetasGoogleOk&key="
        + encodeURIComponent(CONFIG.GOOGLE_API_KEY);
      s.async = true;
      s.onerror = () => { googleListo = null; reject(new MapaError("SERVICIO")); };
      document.head.appendChild(s);
    });
    return googleListo;
  }

  const google_ = {
    async sugerencias(texto) {
      const g = await cargarGoogle();
      const svc = new g.maps.places.AutocompleteService();
      const preds = await new Promise(res => svc.getPlacePredictions({
        input: texto, componentRestrictions: { country: "ar" },
        locationBias: { radius: 30000, center: { lat: CONFIG.ORIGEN_LAT, lng: CONFIG.ORIGEN_LNG } }
      }, r => res(r || [])));
      // Google no da coordenadas en la sugerencia: se buscan al elegirla.
      return preds.map(p => ({
        titulo: p.structured_formatting.main_text,
        detalle: p.structured_formatting.secondary_text || "",
        lat: null, lng: null, texto: p.description
      }));
    },
    async geocodificar(texto) {
      const g = await cargarGoogle();
      const geo = new g.maps.Geocoder();
      try {
        const { results } = await geo.geocode({ address: texto, region: "ar" });
        if (!results.length) throw new MapaError("NO_ENCONTRADA");
        const l = results[0].geometry.location;
        return { lat: l.lat(), lng: l.lng(), direccion: results[0].formatted_address };
      } catch (e) {
        if (e instanceof MapaError) throw e;
        throw new MapaError(String(e.code || e).includes("ZERO_RESULTS") ? "NO_ENCONTRADA" : "SERVICIO");
      }
    },
    async direccionDesdeCoords(lat, lng) {
      try {
        const g = await cargarGoogle();
        const { results } = await new g.maps.Geocoder().geocode({ location: { lat, lng } });
        return results[0] ? results[0].formatted_address : "";
      } catch { return ""; }
    },
    async distanciaKm(origen, destino) {
      const g = await cargarGoogle();
      const svc = new g.maps.DistanceMatrixService();
      const r = await svc.getDistanceMatrix({
        origins: [origen], destinations: [destino],
        travelMode: g.maps.TravelMode.DRIVING, unitSystem: g.maps.UnitSystem.METRIC
      }).catch(() => { throw new MapaError("SERVICIO"); });
      const el = r.rows[0] && r.rows[0].elements[0];
      if (!el || el.status !== "OK") throw new MapaError("SIN_RUTA");
      return el.distance.value / 1000;
    }
  };

  const prov = () => (CONFIG.PROVEEDOR_MAPAS === "google" && CONFIG.GOOGLE_API_KEY ? google_ : osm);

  function miUbicacion() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new MapaError("GEO_NO_DISPONIBLE"));
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        err => reject(new MapaError(err.code === 1 ? "PERMISO" : "GEO_NO_DISPONIBLE")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }

  return {
    sugerencias: t => prov().sugerencias(t),
    geocodificar: t => prov().geocodificar(t),
    direccionDesdeCoords: (a, b) => prov().direccionDesdeCoords(a, b),
    distanciaKm: (o, d) => prov().distanciaKm(o, d),
    miUbicacion
  };
})();
