# Zetas Barber — Guía paso a paso

Esta guía es para que conectes la página con tu planilla de Google, cambies tus datos y la publiques en internet. No hace falta saber programar. Tardás unos 15 minutos.

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página web. |
| `js/config.js` | **El único archivo que vas a editar:** precios, horarios, WhatsApp, Instagram, ubicación y la URL de la planilla. |
| `apps-script/Codigo.gs` | El código que va pegado en tu planilla de Google. |
| `apps-script/Panel.html` | El panel de turnos para el celu (también va pegado en la planilla). |
| `css/`, `js/app.js`, `js/mapas.js`, `img/` | Diseño, funcionamiento y logo. No hace falta tocarlos. |

Para editar `config.js`: clic derecho → **Abrir con** → **Bloc de notas**. Cambiá solo lo que está entre comillas o los números, y guardá.

---

## Paso 1 — Crear la planilla

1. Entrá a <https://sheets.google.com> con tu cuenta de Gmail.
2. Tocá **En blanco** (el cuadro con el **+**).
3. Arriba a la izquierda, donde dice "Hoja de cálculo sin título", escribí **Turnos Zetas Barber**.

No hace falta escribir los títulos de las columnas: el script los crea solo.

## Paso 2 — Pegar el script

1. En la planilla, andá al menú **Extensiones** → **Apps Script**. Se abre otra pestaña.
2. Vas a ver un archivo `Código.gs` con algo escrito (`function myFunction() {...}`). **Borrá todo.**
3. Abrí el archivo `apps-script/Codigo.gs` de esta carpeta con el Bloc de notas, seleccioná todo (**Ctrl + A**), copialo (**Ctrl + C**) y pegalo en Apps Script (**Ctrl + V**).
4. Tocá el ícono del **disquete** (Guardar) o **Ctrl + S**.
5. Ahora el panel: a la izquierda, al lado de "Archivos", tocá el **+** → **HTML**. Escribí el nombre **Panel** (así, con P mayúscula y sin ".html") y Enter.
6. Borrá lo que trae ese archivo nuevo, abrí `apps-script/Panel.html` de esta carpeta con el Bloc de notas, copiá todo y pegalo ahí. Guardá.
7. Arriba, a la izquierda, cambiá el nombre del proyecto "Proyecto sin título" por **Zetas Barber**.

> **¿Ya tenías la planilla armada de antes?** Reemplazá el código de `Código.gs` por el nuevo, agregá el archivo **Panel** (pasos 5 y 6) y después, en la barra de arriba, elegí **darFormato** y tocá **▶ Ejecutar** una vez: le pone colores por estado y agrega "Bloqueado" a la lista. Tus turnos no se tocan. Después seguí con "Si cambiás el script más adelante" y con el paso 4b.

## Paso 3 — Probar y dar permisos

1. En la barra de arriba, al lado de **Ejecutar**, hay un desplegable con nombres de funciones. Elegí **probar**.
2. Tocá **▶ Ejecutar**.
3. Te va a pedir permisos:
   - Tocá **Revisar permisos** y elegí tu cuenta.
   - Si aparece "**Google no verificó esta app**": es normal, porque la app la hiciste vos. Tocá **Configuración avanzada** → **Ir a Zetas Barber (no seguro)**.
   - Tocá **Permitir**.
4. Abajo tiene que decir "Hoja lista…". Volvé a la pestaña de la planilla: ya existe la hoja **Reservas** con todas las columnas.

## Paso 4 — Publicarlo como Web App

1. En Apps Script, arriba a la derecha, tocá el botón azul **Implementar** → **Nueva implementación**.
2. Al lado de "Seleccionar tipo", tocá el **engranaje ⚙** → **Aplicación web**.
3. Completá así:
   - **Descripción:** Turnos web
   - **Ejecutar como:** **Yo** (tu mail)
   - **Quién tiene acceso:** **Cualquier usuario** ← muy importante
4. Tocá **Implementar** (si te pide permisos de nuevo, aceptá igual que en el paso 3).
5. Aparece la **URL de la aplicación web**, que termina en `/exec`. Tocá **Copiar**.

> Para comprobar que anda, abrí esa URL en una ventana de incógnito. Tiene que aparecer un texto que dice `"Zetas Barber: el script está funcionando."`

## Paso 4b — Publicar el panel de turnos (solo para vos)

El panel es como el de Furia: una pantalla para el celu donde ves la agenda del día y manejás los turnos. Se publica aparte y **solo vos** lo podés abrir, porque muestra nombres y teléfonos de tus clientes.

1. En Apps Script, **Implementar** → **Nueva implementación** → engranaje ⚙ → **Aplicación web**.
2. Completá así:
   - **Descripción:** Panel
   - **Ejecutar como:** **Yo**
   - **Quién tiene acceso:** **Solo yo** ← importante, no "Cualquier usuario"
3. **Implementar** y copiá esa URL (es distinta de la del paso 4).
4. Abrila en el celu con la misma cuenta de Google de la planilla y guardala: en Chrome, menú ⋮ → **Agregar a la pantalla principal**. Te queda como una app.

**Qué podés hacer en el panel:**
- Ver los turnos de cada día, con los próximos 14 días arriba (el número es la cantidad de turnos).
- Ver cuánta plata tenés prevista en el día y cuánto ya cobraste (los turnos marcados **Realizado**).
- Cambiar el estado de un turno: Pendiente, Confirmado, Realizado, Cancelado o No vino.
- Mandarle un recordatorio por WhatsApp al cliente con un toque, o llamarlo.
- **+ Turno:** cargar un turno que te pidieron por teléfono o en persona.
- **Bloquear:** cerrar un horario (almuerzo, trámite) para que nadie lo reserve en la web. **Liberar** lo vuelve a abrir.

> La URL del paso 4 (la pública) es la que va en la página web. La del 4b es solo para vos: no la compartas.

## Paso 5 — Pegar la URL en la página

1. Abrí `js/config.js` con el Bloc de notas.
2. Buscá esta línea:
   ```js
   SCRIPT_URL: "PEGAR_ACA_LA_URL_DEL_WEB_APP",
   ```
3. Reemplazá el texto entre comillas por la URL que copiaste. Tiene que quedar así (con tu URL):
   ```js
   SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   ```
4. Guardá. Listo: el cartel amarillo de "Modo demo" desaparece y cada reserva se carga como una fila nueva en la planilla.

## Paso 6 — Cargar tus datos

En `js/config.js` cambiá:

- **`WHATSAPP`**: tu número con 549 adelante, sin 0 ni 15, sin espacios. Ej: si tu celu es 11 5555-1234 → `"5491155551234"`.
- **`INSTAGRAM`**: tu usuario sin @.
- **`ORIGEN_LAT` y `ORIGEN_LNG`**: la ubicación exacta de la barbería, que es desde donde se calcula el domicilio. Para sacarlas: abrí Google Maps, mantené apretado sobre tu local hasta que aparezca un pin, y arriba (o abajo en el celu) salen dos números como `-34.4565, -58.6420`. El primero va en `ORIGEN_LAT` y el segundo en `ORIGEN_LNG`. **Los que vienen puestos son aproximados al barrio, así que cambialos.**
- **Precios** (`SERVICIOS`, `DOMICILIO_BASE`, `PRECIO_POR_KM`): solo el número, sin puntos ni $. Ej: `12000`.
- **Horarios** (`HORARIOS`) y **duración del turno** (`DURACION_TURNO_MIN`).
- **Feriados o vacaciones** (`DIAS_CERRADOS`): agregá fechas así: `"2026-12-25",`.

## Paso 7 — Descargar la planilla como Excel

En la planilla de Google: **Archivo** → **Descargar** → **Microsoft Excel (.xlsx)**. Se baja al celu o a la compu.

## Cómo manejar los turnos día a día

- Lo más cómodo es usar el **panel** del paso 4b desde el celu.
- En la planilla, cada reserva nueva aparece abajo de todo con estado **Pendiente**, y cada fila se pinta según el estado: amarillo pendiente, verde confirmado, celeste realizado, rojo cancelado, naranja no vino, gris bloqueado.
- También podés cambiar el estado directo en la planilla, tocando la celda de la columna **Estado**.
- Si ponés **Cancelado** o **No vino**, ese horario vuelve a quedar libre en la web.
- Para filtrar (por ejemplo, ver solo un día): **Datos** → **Crear un filtro**, y usá la flechita del título "Fecha del turno".
- Si cambiás los horarios o precios en `js/config.js`, cambialos también arriba de todo en `Codigo.gs` (`HORARIOS` y `SERVICIOS`), así el panel muestra lo mismo.

## Si cambiás el script más adelante

Si editás `Codigo.gs`, guardá y andá a **Implementar** → **Gestionar implementaciones** → **lápiz ✏** → en **Versión** elegí **Nueva versión** → **Implementar**. Así la URL sigue siendo la misma y no tenés que tocar la página. Hacelo con las **dos** implementaciones (la pública y la del Panel).

## Poner la página en internet (gratis)

La forma más simple es **Netlify Drop**:

1. Entrá a <https://app.netlify.com/drop> y creá una cuenta gratis.
2. Arrastrá la **carpeta completa** de la página a esa ventana.
3. En unos segundos te da un link (`algo.netlify.app`). Desde **Site configuration** podés cambiarle el nombre, por ejemplo `zetasbarber.netlify.app`, o conectar un dominio propio `.com.ar`.
4. Cuando quieras actualizar la página (por ejemplo, después de cambiar precios), volvé a arrastrar la carpeta en **Deploys**.

Cuando tengas la dirección definitiva, abrí `index.html` con el Bloc de notas, buscá `https://www.zetasbarber.com.ar/` y reemplazala por tu dirección real.

> **Importante:** el botón "Usar mi ubicación" solo funciona cuando la página está publicada con `https://`. Si abrís el archivo directo desde la compu, puede que el navegador no lo permita.

## Para aparecer en Google

1. Creá o reclamá tu ficha en **Google Business Profile** (<https://business.google.com>) con el nombre, la dirección, los horarios y el link de tu página. Es lo que más ayuda a aparecer en "barbería en Pacheco".
2. Opcional: registrá la página en **Google Search Console** (<https://search.google.com/search-console>) para que Google la encuentre más rápido.

## Sobre el cálculo de distancia

- Se usan servicios gratuitos de OpenStreetMap: **Photon** (autocompletar), **Nominatim** (buscar la dirección) y **OSRM** (distancia en ruta en auto). No necesitan clave ni cuenta, y para el movimiento de una barbería alcanzan de sobra.
- Si alguna vez querés usar Google Maps: creá una API key en Google Cloud con **Maps JavaScript API**, **Places API** y **Distance Matrix API** habilitadas (restringila a tu dominio), y en `config.js` poné `PROVEEDOR_MAPAS: "google"` y tu clave en `GOOGLE_API_KEY`. No hay que cambiar nada más.
- Los km se redondean siempre hacia arriba (4,3 km = 5 km). Más de `DOMICILIO_MAX_KM` (40 km), la página sugiere consultar por WhatsApp.

## Problemas comunes

| Qué pasa | Solución |
|---|---|
| Sigue apareciendo "Modo demo" | La URL en `config.js` no está bien pegada. Tiene que empezar con `https://script.google.com/` y terminar en `/exec`, y quedar entre comillas. |
| "No pudimos consultar los turnos libres" | En el paso 4, "Quién tiene acceso" tiene que ser **Cualquier usuario**. Revisalo en Gestionar implementaciones. |
| Cambié el script y no toma los cambios | Hacé una **Nueva versión** (ver "Si cambiás el script más adelante"). |
| Las reservas no aparecen | Fijate que la hoja se llame exactamente **Reservas** y no le cambies el orden a las columnas. |
