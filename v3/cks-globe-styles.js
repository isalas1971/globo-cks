/**
 * cks-globe-styles.js  —  v1.4.0   (V3: lista colapsable + estilos de globo)
 * ----------------------------------------------------------------------------
 * <cks-globe-styles> — derivado de <cks-globe-collapsible> (V2), que NO se
 * modifica. Tag, clase y global propios: pueden convivir en la misma página.
 *
 * Atributos:
 *   variant="accordion" (default) → cada región (Norteamérica, LATAM…) se pliega.
 *   variant="panel"               → un solo botón pliega/despliega toda la lista.
 *   start="collapsed" (default) | "expanded" → estado inicial.
 *   globe-style="atlas" (default) | "classic" | "night" | "hologram" | "dots" | "brand"
 *   style-selector="off"          → oculta el desplegable de estilos.
 *   fit                           → modo embed: ocupa exactamente el alto del iframe/ventana
 *                                   y se autoajusta (globo flexible, lista compacta que se
 *                                   achica si hace falta) para que NUNCA aparezca scrollbar.
 *   Evento: 'globestylechange' (detail.style) cuando el visitante cambia el estilo.
 *
 * Globo terráqueo wireframe interactivo con países rellenos (earcut +
 * subdivisión post) + bordes con corte de antimeridiano, drag con inercia,
 * tooltip por raycaster, lista bilingüe en wrapper glassmorphism. Cámara
 * con auto-fit por viewport para que la esfera siempre entre completa.
 *
 *   <script type="module" src=".../cks-globe-styles.js"></script>
 *   <cks-globe-styles variant="accordion" globe-style="atlas"></cks-globe-styles>
 * ----------------------------------------------------------------------------
 */

import * as THREE  from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { feature } from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';

/* ========================================================================== */
/*  Data + i18n                                                               */
/* ========================================================================== */

const LOCATIONS = {
  northAmerica: [
    { id: 'miami',       lat: 25.7617,  lng: -80.1918,  es: 'Miami, FL',        en: 'Miami, FL' },
    { id: 'denver',      lat: 39.7392,  lng: -104.9903, es: 'Denver, CO',       en: 'Denver, CO' },
    { id: 'losangeles',  lat: 34.0522,  lng: -118.2437, es: 'Los Angeles, CA',  en: 'Los Angeles, CA' },
    { id: 'neworleans',  lat: 29.9511,  lng: -90.0715,  es: 'New Orleans, LA',  en: 'New Orleans, LA' },
    { id: 'sanantonio',  lat: 29.4241,  lng: -98.4936,  es: 'San Antonio, TX',  en: 'San Antonio, TX' },
  ],
  latam: [
    { id: 'mexico',      lat: 23.6345,  lng: -102.5528, es: 'México',     en: 'Mexico' },
    { id: 'costarica',   lat: 9.7489,   lng: -83.7534,  es: 'Costa Rica', en: 'Costa Rica' },
    { id: 'panama',      lat: 8.5380,   lng: -80.7821,  es: 'Panamá',     en: 'Panama' },
    { id: 'ecuador',     lat: -1.8312,  lng: -78.1834,  es: 'Ecuador',    en: 'Ecuador' },
    { id: 'colombia',    lat: 4.5709,   lng: -74.2973,  es: 'Colombia',   en: 'Colombia' },
    { id: 'peru',        lat: -9.1899,  lng: -75.0152,  es: 'Perú',       en: 'Peru' },
    { id: 'chile',       lat: -35.6751, lng: -71.5430,  es: 'Chile',      en: 'Chile' },
    { id: 'bolivia',     lat: -16.2902, lng: -63.5887,  es: 'Bolivia',    en: 'Bolivia' },
    { id: 'paraguay',    lat: -23.4425, lng: -58.4438,  es: 'Paraguay',   en: 'Paraguay' },
    { id: 'uruguay',     lat: -32.5228, lng: -55.7658,  es: 'Uruguay',    en: 'Uruguay' },
    { id: 'argentina',   lat: -38.4161, lng: -63.6167,  es: 'Argentina',  en: 'Argentina' },
    { id: 'guatemala',   lat: 15.7835,  lng: -90.2308,  es: 'Guatemala',  en: 'Guatemala' },
  ],
  europe: [
    { id: 'spain',       lat: 40.4637,  lng: -3.7492,   es: 'España',       en: 'Spain' },
    { id: 'uk',          lat: 55.3781,  lng: -3.4360,   es: 'Reino Unido',  en: 'United Kingdom' },
    { id: 'switzerland', lat: 46.8182,  lng: 8.2275,    es: 'Suiza',        en: 'Switzerland' },
    { id: 'italy',       lat: 41.8719,  lng: 12.5674,   es: 'Italia',       en: 'Italy' },
  ],
  asia: [
    { id: 'israel',      lat: 31.0461,  lng: 34.8516,   es: 'Israel',       en: 'Israel' },
  ],
};

const I18N = {
  es: { categories: { northAmerica: 'NORTEAMÉRICA', latam: 'LATAM', europe: 'EUROPA', asia: 'ASIA' },
        panel: 'PAÍSES', expandAll: 'Expandir todo', collapseAll: 'Contraer todo', styleLabel: 'Estilo del globo',
        intro: 'Hoy trabajamos con:',
        titleA: 'No importa en qué lugar del planeta te encuentres.', titleB: 'Nos encanta trabajar con todo el mundo :)' },
  en: { categories: { northAmerica: 'NORTH AMERICA', latam: 'LATAM', europe: 'EUROPE', asia: 'ASIA' },
        panel: 'COUNTRIES', expandAll: 'Expand all', collapseAll: 'Collapse all', styleLabel: 'Globe style',
        intro: 'Today we work with:',
        titleA: 'It doesn’t matter where on the planet you are.', titleB: 'We love working with the whole world :)' },
};

const CATEGORY_ORDER  = ['northAmerica', 'latam', 'europe', 'asia'];
const DESKTOP_COLUMNS = [['northAmerica', 'latam'], ['europe', 'asia']];

/* Estilos del globo. Colores como 0xRRGGBB.
 *   mode        'fill' (países rellenos + borde) | 'dots' (matriz de puntos)
 *   border      null → sin borde de país
 *   accent      marcador activo/hover + acento de la UI (listas, brújula)
 *   idle        marcador inactivo
 *   glow        halo atmosférico en el borde del globo (null = sin halo) */
const GLOBE_STYLES = {
  classic: {
    es: 'Clásico', en: 'Classic', mode: 'fill',
    ocean: 0x16365A, land: 0xE6ECF0, border: 0x6E7C86, lineScale: 1,
    grid: 0xFFFFFF, gridOpacity: 0.07,
    accent: 0x3B43FC, idle: 0x7B868C, idleOpacity: 0.4, glow: null,
  },
  night: {
    es: 'Noche', en: 'Night', mode: 'fill',
    ocean: 0x07142A, land: 0x1C3A66, border: 0x3E6AA8, lineScale: 1,
    grid: 0x6C8FD0, gridOpacity: 0.12,
    accent: 0x7C84FF, idle: 0xA9BCDD, idleOpacity: 0.65,
    glow: { color: 0x3B43FC, intensity: 1.0 },
  },
  hologram: {
    es: 'Holograma', en: 'Hologram', mode: 'fill',
    ocean: 0x041224, land: 0x0A2D4E, border: 0x5CE1FF, lineScale: 1.3,
    grid: 0x5CE1FF, gridOpacity: 0.16,
    accent: 0x5CE1FF, idle: 0x6FA9C4, idleOpacity: 0.7,
    glow: { color: 0x35C8FF, intensity: 1.1 },
  },
  dots: {
    es: 'Puntos', en: 'Dots', mode: 'dots',
    ocean: 0x0B1D38, land: 0xD7E1EE, border: null,
    grid: 0xFFFFFF, gridOpacity: 0.05,
    accent: 0x7C84FF, idle: 0x8FA2BC, idleOpacity: 0.7,
    glow: { color: 0x3B43FC, intensity: 0.6 },
  },
  brand: {
    es: 'Azul CKS', en: 'CKS blue', mode: 'fill',
    ocean: 0x1B2296, land: 0xE9EBFF, border: 0x7F86F0, lineScale: 1,
    grid: 0xFFFFFF, gridOpacity: 0.10,
    accent: 0x3B43FC, idle: 0x5A62B5, idleOpacity: 0.55,
    glow: { color: 0x3B43FC, intensity: 1.2 },
  },
  atlas: {
    es: 'Atlas', en: 'Atlas', mode: 'fill',
    ocean: 0x0F2A3F, land: 0xD9C6A0, border: 0x8B7650, lineScale: 1,
    grid: 0xFFFFFF, gridOpacity: 0.06,
    accent: 0xE8892B, idle: 0x8C7B5A, idleOpacity: 0.55, glow: null,
  },
};
const DEFAULT_STYLE = 'atlas';
const css = (n) => '#' + n.toString(16).padStart(6, '0');

/* Cámara auto-fit: FOV fijo, FIT_RADIUS = radio esfera + margen para halos. */
const FOV_DEG    = 45;
const FOV_RAD    = FOV_DEG * Math.PI / 180;
const FIT_RADIUS = 1.5;

/* ========================================================================== */
/*  Helpers geométricos                                                       */
/* ========================================================================== */

/** Proyección lat/lng → punto 3D en esfera de radio dado. */
function latLngToVec3(lat, lng, radius) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  );
}

function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function easeOutCubic(t)   { return 1 - Math.pow(1 - t, 3); }
function clamp(v, lo, hi)  { return Math.min(hi, Math.max(lo, v)); }

function detectLang() {
  const raw = (document.documentElement.getAttribute('lang') || '').toLowerCase().trim();
  return raw.startsWith('en') ? 'en' : 'es';
}

function shortestAngle(from, to) {
  let d = to - from;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distancia de cámara mínima para que un círculo de radio FIT_RADIUS entre en
 *  el canvas en ambos ejes según el aspect ratio. */
function getBaseCameraZ(width, height) {
  const aspect    = width / height;
  const distVert  = FIT_RADIUS / Math.tan(FOV_RAD / 2);
  const distHoriz = FIT_RADIUS / (Math.tan(FOV_RAD / 2) * aspect);
  return Math.max(distVert, distHoriz);
}

/** Yaw/pitch tales que la rotación Y(yaw)·X(pitch) lleve `localPos` al frente
 *  (eje z+ de cámara). Ver derivación en bloque inline. */
function yawPitchForFront(localPos) {
  const p = localPos.clone().normalize();
  const yaw   = Math.asin(clamp(-p.x, -1, 1));
  const pitch = Math.atan2(p.y, p.z);
  return { yaw, pitch };
}

/* ========================================================================== */
/*  Helpers de países (rasterizado a textura equirectangular)                 */
/* ========================================================================== */

/** Detecta si un ring (en lng/lat originales) abarca prácticamente toda la
 *  esfera longitudinalmente — caso Antártica. */
function spansFullLng(ring) {
  let min = Infinity, max = -Infinity;
  for (const [lng] of ring) {
    if (lng < min) min = lng;
    if (lng > max) max = lng;
  }
  return max - min > 350;
}

/** Desenrolla un ring que cruza el antimeridiano: suma ±360 a lngs sucesivas
 *  para que los deltas sean continuos. El polígono resultante puede tener
 *  lngs fuera de [-180, 180] — el canvas se encarga al dibujar tres copias
 *  desplazadas ±360 y dejar que el clipping recorte. */
function unwrapLng(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const dlng = ring[i][0] - ring[i - 1][0];
    if (dlng >  180) offset -= 360;
    if (dlng < -180) offset += 360;
    out.push([ring[i][0] + offset, ring[i][1]]);
  }
  return out;
}

/** Construye un canvas equirectangular con océano + países dibujados, listo
 *  para usar como textura en una esfera (THREE.SphereGeometry mapea UV a
 *  lng/lat por defecto). Render 2D — sin earcut, sin subdivisión, sin
 *  problemas de antimeridiano: solo path 2D + fill/stroke. */
function buildEarthTextureCanvas(features, palette, { width = 4096, height = 2048 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  /* Fondo océano */
  ctx.fillStyle = palette.ocean;
  ctx.fillRect(0, 0, width, height);

  const projX = lng => ((lng + 180) / 360) * width;
  const projY = lat => ((90 - lat) / 180) * height;

  /* Path de un ring a tres offsets (-360, 0, +360) para wrap horizontal. */
  function tracePath(ring) {
    for (let shift = -360; shift <= 360; shift += 360) {
      for (let i = 0; i < ring.length; i++) {
        const x = projX(ring[i][0] + shift);
        const y = projY(ring[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  }

  ctx.fillStyle   = palette.land;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth   = Math.max(1, width / 2400) * (palette.lineScale || 1);
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';

  for (const f of features) {
    const polys = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;

    for (const rings of polys) {
      /* Detectar Antártica ANTES de desenrollar (mejor heurística). */
      const isAntarctic = spansFullLng(rings[0]);

      const unwrapped = rings.map(unwrapLng);

      /* Antártica: agregar dos vértices en lat=-90 para cerrar el polígono
         por el polo sur. Eso pinta el casquete antártico hasta el borde
         inferior del canvas (que es el polo sur en equirectangular). */
      if (isAntarctic) {
        const outer = unwrapped[0];
        const lastLng  = outer[outer.length - 1][0];
        const firstLng = outer[0][0];
        outer.push([lastLng,  -90]);
        outer.push([firstLng, -90]);
      }

      /* Fill con even-odd para soportar agujeros (lagos / enclaves). */
      ctx.beginPath();
      for (const ring of unwrapped) tracePath(ring);
      ctx.fill('evenodd');

      /* Bordes — un stroke por ring, sin cerrar los segmentos sintéticos
         del polo sur (evita una raya horizontal a lat -90 en Antártica). */
      for (let r = 0; r < unwrapped.length; r++) {
        const ring = unwrapped[r];
        const limit = (isAntarctic && r === 0) ? ring.length - 2 : ring.length;
        for (let shift = -360; shift <= 360; shift += 360) {
          ctx.beginPath();
          for (let i = 0; i < limit; i++) {
            const x = projX(ring[i][0] + shift);
            const y = projY(ring[i][1]);
            if (i === 0) ctx.moveTo(x, y);
            else         ctx.lineTo(x, y);
          }
          if (palette.border) ctx.stroke();
        }
      }
    }
  }

  return canvas;
}

/** Estilo 'dots': rasteriza tierra en una máscara y dibuja una grilla de puntos.
 *  El paso horizontal se corrige por 1/cos(lat) para que los puntos se vean
 *  redondos y parejos sobre la esfera. */
function buildDotsTextureCanvas(features, st, { width = 4096, height = 2048 } = {}) {
  const mw = 2048, mh = 1024;
  const mask = buildEarthTextureCanvas(
    features, { ocean: '#000000', land: '#FFFFFF', border: null }, { width: mw, height: mh });
  const md = mask.getContext('2d').getImageData(0, 0, mw, mh).data;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css(st.ocean);
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = css(st.land);

  const step = height / 84;
  const r = step * 0.33;
  for (let y = step / 2; y < height; y += step) {
    const lat = 90 - (y / height) * 180;
    const k = Math.max(0.12, Math.cos(lat * Math.PI / 180));
    const n = Math.max(1, Math.round(width / (step / k)));
    const my = Math.min(mh - 1, Math.floor(y * mh / height));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (width / n);
      const mx = Math.min(mw - 1, Math.floor(x * mw / width));
      if (md[(my * mw + mx) * 4] > 127) {
        ctx.beginPath();
        ctx.ellipse(x, y, r / k, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvas;
}

/** Carga TopoJSON de world-atlas y devuelve features GeoJSON. */
async function loadCountries() {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const topo = await res.json();
    return feature(topo, topo.objects.countries).features;
  } catch (err) {
    console.warn('CKS Globe: countries failed', err);
    return null;
  }
}

/* ========================================================================== */
/*  Estilos                                                                   */
/* ========================================================================== */

/* ========================================================================== */
/*  Compass SVG  (brújula 8 puntas con etiquetas N/E/S/O)                      */
/* ========================================================================== */

const COMPASS_SVG = `
<svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <circle r="40" fill="none" stroke="currentColor" stroke-width="0.9"/>
  <g stroke="currentColor" stroke-width="0.9" stroke-linecap="round" fill="none">
    <line transform="rotate(45)"  y1="-42" y2="-37"/>
    <line transform="rotate(135)" y1="-42" y2="-37"/>
    <line transform="rotate(225)" y1="-42" y2="-37"/>
    <line transform="rotate(315)" y1="-42" y2="-37"/>
  </g>
  <g fill="currentColor" font-size="11" font-weight="700"
     text-anchor="middle" font-family="Open Sans, system-ui, sans-serif">
    <text x="0"   y="-44">N</text>
    <text x="44"  y="4">E</text>
    <text x="0"   y="50">S</text>
    <text x="-44" y="4">O</text>
  </g>
  ${[0, 90, 180, 270].map(deg => `
    <g transform="rotate(${deg})">
      <polygon points="0,-32 0,0 -6,-7" fill="currentColor" opacity="0.45"/>
      <polygon points="0,-32 6,-7 0,0" fill="currentColor"/>
    </g>`).join('')}
  ${[45, 135, 225, 315].map(deg => `
    <g transform="rotate(${deg})">
      <polygon points="0,-22 0,0 -5,-5" fill="currentColor" opacity="0.45"/>
      <polygon points="0,-22 5,-5 0,0" fill="currentColor"/>
    </g>`).join('')}
  <circle r="1.4" fill="currentColor"/>
</svg>`;

const STYLES = /* css */ `
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600&display=swap');

  :host {
    --accent: #3B43FC;
    display: block;
    width: 100%;
    background: #0A1628;
    color: #FFFFFF;
    font-family: 'Open Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    box-sizing: border-box;
  }

  *, *::before, *::after { box-sizing: border-box; }

  .section {
    width: 100%;
    padding: clamp(48px, 8vh, 96px) clamp(24px, 5vw, 80px);
    display: grid;
    grid-template-columns: 38% 62%;
    gap: clamp(24px, 4vw, 56px);
    align-items: center;
    position: relative;
    isolation: isolate;
  }

  .left  { min-width: 0; position: relative; z-index: 2; }
  .right {
    position: relative;
    z-index: 1;
    min-width: 0;
    height: min(72vh, 680px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Título: arriba, alineado a la izquierda, ocupa todo el ancho de la sección. */
  .map-title {
    grid-column: 1 / -1;
    margin: 0;
    text-align: left;
    font-family: inherit;
    font-weight: 300;
    font-size: clamp(20px, 2vw, 30px);
    line-height: 1.25;
    color: #FFFFFF;
    text-wrap: balance;
    overflow-wrap: break-word;
  }
  .map-title b { display: block; font-weight: 600; }

  /* Frase sobre el listado de países. */
  .intro {
    margin: 0;
    font-family: inherit;
    font-weight: 300;
    font-size: clamp(15px, 1.15vw, 19px);
    line-height: 1.3;
    color: #FFFFFF;
    text-wrap: balance;
    overflow-wrap: break-word;
  }
  .wrapper-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
    margin-bottom: clamp(8px, 1.4vh, 14px);
  }
  .wrapper-head .expand-all { margin: 0 0 0 auto; display: inline-block; }
  .lists-wrapper > .intro { margin-bottom: clamp(8px, 1.4vh, 14px); }

  .lists-wrapper {
    background: rgba(10, 22, 40, 0.6);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: clamp(12px, 1.5vw, 20px);
  }

  .lists {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(14px, 1.8vw, 26px);
    align-items: start;
  }
  .col { display: flex; flex-direction: column; gap: clamp(8px, 1.4vh, 14px); min-width: 0; }

  .cat-header {
    margin: 0 0 6px;
    color: var(--accent);
    font-family: inherit;
    font-weight: 600;
    font-size: clamp(10px, 0.75vw, 11.5px);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .cat-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0 12px;
  }
  /* LATAM: 6+6 en desktop */
  .cat[data-cat="latam"] .cat-list {
    grid-template-columns: 1fr 1fr;
    grid-auto-flow: column;
    grid-template-rows: repeat(6, auto);
  }

  .cat-item button {
    appearance: none;
    background: transparent;
    border: 0;
    padding: 2px 0;
    margin: 0;
    color: #FFFFFF;
    font-family: inherit;
    font-weight: 400;
    font-size: clamp(12px, 0.88vw, 13.5px);
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
    position: relative;
    transition: color 180ms ease, font-weight 180ms ease;
    display: inline-block;
  }
  .cat-item button::after {
    content: "";
    position: absolute;
    left: 0; right: 100%; bottom: 3px;
    height: 1px;
    background: var(--accent);
    transition: right 220ms ease;
  }
  .cat-item button:hover::after,
  .cat-item button:focus-visible::after { right: 0; }
  .cat-item button:hover { color: var(--accent); }
  .cat-item button[aria-pressed="true"] {
    color: var(--accent);
    font-weight: 600;
  }
  .cat-item button[aria-pressed="true"]::after { right: 100%; }
  .cat-item button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
    border-radius: 2px;
  }

  .canvas-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 320px;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }
  canvas.dragging { cursor: grabbing; }
  canvas.over-marker { cursor: pointer; }

  .tooltip {
    position: absolute;
    top: 0; left: 0;
    background: rgba(10, 22, 40, 0.92);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    color: #FFFFFF;
    font-family: inherit;
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 6px;
    pointer-events: none;
    transform: translate(-50%, -130%);
    white-space: nowrap;
    opacity: 0;
    transition: opacity 140ms ease;
    z-index: 5;
  }
  .tooltip.visible { opacity: 1; }

  /* Botón brújula: reset a polo norte arriba. */
  .compass {
    position: absolute;
    bottom: clamp(8px, 2vh, 20px);
    right:  clamp(8px, 2vw, 20px);
    width:  clamp(36px, 3.6vw, 46px);
    height: clamp(36px, 3.6vw, 46px);
    padding: 0;
    appearance: none;
    background: transparent;
    border: 0;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6;
    transition: color 200ms ease, transform 240ms cubic-bezier(.2,.7,.2,1);
  }
  .compass svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
    /* Refleja el yaw del globo en tiempo real. Variable seteada desde JS. */
    transform: rotate(var(--compass-yaw, 0deg));
    will-change: transform;
  }
  .compass:hover,
  .compass:focus-visible {
    color: var(--accent);
    transform: scale(1.06);
  }
  .compass:active { transform: scale(0.94); }
  .compass:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent);
    outline-offset: 4px;
    border-radius: 999px;
  }
  @media (prefers-reduced-motion: reduce) {
    .compass { transition-duration: 80ms !important; }
    .compass:hover, .compass:focus-visible, .compass:active { transform: none; }
  }

  /* ----- V2: colapsables ----- */
  .chev {
    flex: none;
    width: 10px; height: 10px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg) translate(-2px, -2px);
    transition: transform 240ms cubic-bezier(.2,.7,.2,1);
  }
  [aria-expanded="true"] > .chev { transform: rotate(225deg) translate(-2px, -2px); }

  .toggle {
    appearance: none;
    background: transparent;
    border: 0;
    margin: 0;
    padding: 2px 0;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--accent);
    font-family: inherit;
    font-weight: 600;
    font-size: clamp(10px, 0.75vw, 11.5px);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;
    transition: color 180ms ease;
  }
  .toggle:hover { color: #FFFFFF; }
  .toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }
  .toggle .count {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.55);
    font-weight: 400;
    letter-spacing: 0.04em;
  }
  .cat .cat-header { margin: 0; }
  .cat-body.open .cat-list { padding-top: 4px; }

  .panel-bar { display: flex; align-items: center; gap: 12px; }
  .panel-bar .toggle { font-size: clamp(11px, 0.8vw, 12.5px); }
  .panel-bar .count { margin-left: 0; }
  .panel-bar .chev { margin-left: auto; }
  .expand-all {
    appearance: none;
    background: transparent;
    border: 0;
    margin: 0 0 clamp(8px, 1.4vh, 14px) auto;
    padding: 2px 0;
    display: block;
    color: rgba(255, 255, 255, 0.65);
    font-family: inherit;
    font-size: 11px;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color 180ms ease;
  }
  .expand-all:hover { color: var(--accent); }
  .expand-all:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }

  /* Cuerpo plegable: 0fr → 1fr anima la altura sin medirla. */
  .cat-body, .panel-body {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    transition: grid-template-rows 280ms cubic-bezier(.2,.7,.2,1), visibility 0s linear 280ms;
  }
  .cat-body.open, .panel-body.open {
    grid-template-rows: 1fr;
    visibility: visible;
    transition: grid-template-rows 280ms cubic-bezier(.2,.7,.2,1), visibility 0s;
  }
  .cat-body > .inner, .panel-body > .inner { overflow: hidden; min-height: 0; }
  .panel-body.open > .inner { padding-top: clamp(8px, 1.4vh, 14px); }
  /* En modo panel las regiones no se pliegan: sin botón, header normal. */
  :host([variant="panel"]) .cat-header { margin: 0 0 6px; }

  @media (prefers-reduced-motion: reduce) {
    .chev, .cat-body, .panel-body { transition-duration: 1ms !important; transition-delay: 0s !important; }
  }

  /* ----- V3: selector de estilo ----- */
  .style-picker {
    position: absolute;
    top: clamp(8px, 2vh, 20px);
    right: clamp(8px, 2vw, 20px);
    z-index: 7;
  }
  .style-btn {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 8px 14px;
    background: rgba(10, 22, 40, 0.6);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    color: #FFFFFF;
    font-family: inherit;
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: border-color 180ms ease;
  }
  .style-btn:hover { border-color: color-mix(in srgb, var(--accent) 60%, transparent); }
  .style-btn:focus-visible, .style-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .sw {
    flex: none;
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.35);
  }
  .style-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 190px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: rgba(10, 22, 40, 0.92);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }
  .style-menu[hidden] { display: none; }
  .style-opt {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 8px 10px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: #FFFFFF;
    font-family: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .style-opt:hover, .style-opt:focus-visible { background: rgba(255, 255, 255, 0.08); }
  .style-opt[aria-selected="true"] { color: var(--accent); font-weight: 600; }
  .style-opt[aria-selected="true"]::after { content: "✓"; margin-left: auto; }

  /* ----- Tablet y mobile (<1200px): apilado (modo normal) ----- */
  @media (max-width: 1199.98px) {
    :host(:not([fit])) .section {
      grid-template-columns: 1fr;
      padding: clamp(40px, 6vh, 72px) clamp(20px, 5vw, 32px);
      gap: clamp(28px, 4vh, 48px);
      align-items: stretch;
    }
    :host(:not([fit])) .left  { order: 2; }
    :host(:not([fit])) .right {
      order: 1;
      height: min(60vh, 480px);
      min-height: min(60vh, 480px);
    }
    :host(:not([fit])) .map-title { order: 0; }
    :host(:not([fit])) .lists { grid-template-columns: 1fr; gap: clamp(8px, 1.4vh, 12px); }
    :host(:not([fit])) .col   { gap: clamp(8px, 1.4vh, 12px); }
    :host(:not([fit])) .cat-list,
    :host(:not([fit])) .cat[data-cat="latam"] .cat-list {
      grid-template-columns: 1fr 1fr;
      grid-auto-flow: row;
      grid-template-rows: none;
      gap: 0 12px;
    }
  }
  @media (max-width: 399.98px) {
    .cat-list,
    .cat[data-cat="latam"] .cat-list { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cat-item button,
    .cat-item button::after { transition-duration: 80ms !important; }
  }

  /* ----- Modo fit (embed en iframe): ocupa exactamente el alto disponible, sin scrollbar ----- */
  :host([fit]) { height: 100vh; height: 100dvh; overflow: hidden; }
  :host([fit]) .section {
    height: 100%;
    padding: clamp(10px, 2.4vh, 26px) clamp(14px, 3vw, 48px);
    gap: clamp(8px, 1.8vh, 18px) clamp(18px, 3vw, 40px);
    grid-template-columns: minmax(0, 38fr) minmax(0, 62fr);
    grid-template-rows: auto minmax(0, 1fr);
    align-items: center;
    overflow: hidden;
  }
  :host([fit]) .map-title { font-size: clamp(16px, min(2vw, 3.4vh), 30px); line-height: 1.2; }
  :host([fit]) .right { height: 100%; min-height: 0; }
  :host([fit]) .canvas-wrap { min-height: 0; }
  /* Fit: apila recién por debajo de 960px de ancho. */
  @media (max-width: 959.98px) {
    :host([fit]) .section {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-items: stretch;
    }
    :host([fit]) .map-title { order: 0; }
    :host([fit]) .right { order: 1; height: 100%; min-height: 0; }
    :host([fit]) .left  { order: 2; }
    :host([fit]) .canvas-wrap { min-height: 110px; }
    :host([fit]) .lists { grid-template-columns: 1fr; gap: clamp(8px, 1.4vh, 12px); }
    :host([fit]) .col   { gap: clamp(8px, 1.4vh, 12px); }
    :host([fit]) .cat-list,
    :host([fit]) .cat[data-cat="latam"] .cat-list {
      grid-template-columns: 1fr 1fr;
      grid-auto-flow: row;
      grid-template-rows: none;
      gap: 0 12px;
    }
  }
  @media (max-width: 399.98px) {
    :host([fit]) .cat-list,
    :host([fit]) .cat[data-cat="latam"] .cat-list { grid-template-columns: 1fr; }
  }
`;

/* ========================================================================== */
/*  Custom Element                                                            */
/* ========================================================================== */

class CKSGlobeStyles extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this._lang = detectLang();
    this._variant = 'accordion';
    this._startExpanded = false;
    this._styleKey = DEFAULT_STYLE;
    this._style = GLOBE_STYLES[DEFAULT_STYLE];
    this._features = null;
    this._pickerRefs = null;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Three.js handles */
    this._three = null;
    this._countries = null;       // { texture }
    this._baseZ = 3;              // recalculado por viewport
    this._isZooming = false;      // bandera para que el resize no pise el zoom

    /* Estado de rotación: yaw/pitch acumulados. */
    this._yaw = 0;
    this._pitch = 0;
    this._pitchLimit = 85 * Math.PI / 180;

    /* Drag + inercia */
    this._drag = null;
    this._inertia = null;
    this._dragSensitivity = 0.005;
    this._lastDragMoved = false;

    /* Idle */
    this._idleSpeed = 0;
    this._idleTarget = 0.0008;
    this._idleResumeAt = 0;
    this._globeHover = false;

    /* Click anim */
    this._clickAnim = null;
    this._cameraAnim = null;

    /* Markers */
    this._activeId = null;
    this._hoveredListId = null;
    this._hoveredGlobeId = null;

    this._rafId = null;
    this._lastTime = 0;
    this._refs = {};

    /* Bindings */
    this._onItemClick    = this._onItemClick.bind(this);
    this._onItemEnter    = this._onItemEnter.bind(this);
    this._onItemLeave    = this._onItemLeave.bind(this);
    this._onResize       = this._onResize.bind(this);
    this._onReducedMotionChange = this._onReducedMotionChange.bind(this);
    this._onPointerDown  = this._onPointerDown.bind(this);
    this._onPointerMove  = this._onPointerMove.bind(this);
    this._onPointerUp    = this._onPointerUp.bind(this);
    this._onPointerEnter = this._onPointerEnter.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onCanvasClick  = this._onCanvasClick.bind(this);
    this._onCompassClick = this._onCompassClick.bind(this);
  }

  /* ===== Lifecycle ===== */

  static get observedAttributes() { return ['globe-style']; }

  attributeChangedCallback(name, _old, val) {
    if (name !== 'globe-style' || !GLOBE_STYLES[val] || val === this._styleKey) return;
    if (this._three) this._applyGlobeStyle(val);
    else { this._styleKey = val; this._style = GLOBE_STYLES[val]; }
  }

  connectedCallback() {
    this._variant = this.getAttribute('variant') === 'panel' ? 'panel' : 'accordion';
    this._startExpanded = this.getAttribute('start') === 'expanded';
    const gs = this.getAttribute('globe-style');
    if (GLOBE_STYLES[gs]) { this._styleKey = gs; this._style = GLOBE_STYLES[gs]; }
    this._rmMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (this._rmMql.addEventListener) this._rmMql.addEventListener('change', this._onReducedMotionChange);
    else this._rmMql.addListener(this._onReducedMotionChange);

    this._langObserver = new MutationObserver(() => {
      const next = detectLang();
      if (next !== this._lang) { this._lang = next; this._applyI18n(); }
    });
    this._langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    this._renderUI();
    this._initThree();
    this._buildScene();
    this._bindCanvasEvents();
    this._loadCountries();
    this._startLoop();

    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(this);
    /* Modo fit: también reacciona al tamaño de la lista (expandir/contraer) y del canvas. */
    this._ro.observe(this._refs.left);
    this._ro.observe(this._refs.canvasWrap);
  }

  disconnectedCallback() {
    if (this._rafId != null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._langObserver) { this._langObserver.disconnect(); this._langObserver = null; }
    if (this._ro)           { this._ro.disconnect();           this._ro = null; }
    if (this._rmMql) {
      if (this._rmMql.removeEventListener) this._rmMql.removeEventListener('change', this._onReducedMotionChange);
      else this._rmMql.removeListener(this._onReducedMotionChange);
      this._rmMql = null;
    }
    this._unbindCanvasEvents();
    this._closePicker();
    this._disposeThree();
  }

  /* ===== UI ===== */

  _renderUI() {
    const root = this.shadowRoot;
    const style = document.createElement('style');
    style.textContent = STYLES;
    root.appendChild(style);

    const section = document.createElement('section');
    section.className = 'section';

    /* Columna izquierda: wrapper glass + listas. */
    const left = document.createElement('div');
    left.className = 'left';

    const wrapper = document.createElement('div');
    wrapper.className = 'lists-wrapper';
    const isPanel = this._variant === 'panel';
    const total = CATEGORY_ORDER.reduce((n, k) => n + LOCATIONS[k].length, 0);
    let panelToggle = null, panelBody = null, expandAll = null;

    const intro = document.createElement('p');
    intro.className = 'intro';

    if (isPanel) {
      wrapper.appendChild(intro);
      const bar = document.createElement('div');
      bar.className = 'panel-bar';
      panelToggle = document.createElement('button');
      panelToggle.type = 'button';
      panelToggle.className = 'toggle';
      const pl = document.createElement('span'); pl.className = 'label';
      const pc = document.createElement('span'); pc.className = 'count'; pc.textContent = String(total);
      const pv = document.createElement('span'); pv.className = 'chev'; pv.setAttribute('aria-hidden', 'true');
      panelToggle.append(pl, pc, pv);
      panelToggle.addEventListener('click', () => this._setPanel(!this._panelOpen()));
      bar.appendChild(panelToggle);
      wrapper.appendChild(bar);
      panelBody = document.createElement('div');
      panelBody.className = 'panel-body';
      panelBody.id = 'panel-body';
      panelToggle.setAttribute('aria-controls', 'panel-body');
      panelToggle._label = pl;
    } else {
      expandAll = document.createElement('button');
      expandAll.type = 'button';
      expandAll.className = 'expand-all';
      expandAll.addEventListener('click', () => {
        const anyClosed = CATEGORY_ORDER.some((k) => !this._catOpen(k));
        CATEGORY_ORDER.forEach((k) => this._setCat(k, anyClosed));
      });
      const head = document.createElement('div');
      head.className = 'wrapper-head';
      head.append(intro, expandAll);
      wrapper.appendChild(head);
    }

    const lists = document.createElement('div');
    lists.className = 'lists';
    const categoryNodes = {};

    DESKTOP_COLUMNS.forEach((colKeys) => {
      const col = document.createElement('div');
      col.className = 'col';
      colKeys.forEach((catKey) => {
        const cat = document.createElement('div');
        cat.className = 'cat';
        cat.dataset.cat = catKey;

        const header = document.createElement('h3');
        header.className = 'cat-header';
        let label = header, toggle = null, body = null;
        if (!isPanel) {
          toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'toggle';
          label = document.createElement('span'); label.className = 'label';
          const cnt = document.createElement('span'); cnt.className = 'count'; cnt.textContent = String(LOCATIONS[catKey].length);
          const chev = document.createElement('span'); chev.className = 'chev'; chev.setAttribute('aria-hidden', 'true');
          toggle.append(label, cnt, chev);
          toggle.id = 'tgl-' + catKey;
          toggle.setAttribute('aria-controls', 'body-' + catKey);
          toggle.addEventListener('click', () => this._setCat(catKey, !this._catOpen(catKey)));
          header.appendChild(toggle);
        }
        cat.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'cat-list';

        LOCATIONS[catKey].forEach((loc) => {
          const li = document.createElement('li');
          li.className = 'cat-item';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.id = loc.id;
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = loc[this._lang];
          btn.addEventListener('click',      this._onItemClick);
          btn.addEventListener('mouseenter', this._onItemEnter);
          btn.addEventListener('mouseleave', this._onItemLeave);
          btn.addEventListener('focus',      this._onItemEnter);
          btn.addEventListener('blur',       this._onItemLeave);
          li.appendChild(btn);
          ul.appendChild(li);
        });

        if (isPanel) {
          cat.appendChild(ul);
        } else {
          body = document.createElement('div');
          body.className = 'cat-body';
          body.id = 'body-' + catKey;
          body.setAttribute('role', 'region');
          body.setAttribute('aria-labelledby', 'tgl-' + catKey);
          const inner = document.createElement('div');
          inner.className = 'inner';
          inner.appendChild(ul);
          body.appendChild(inner);
          cat.appendChild(body);
        }
        col.appendChild(cat);
        categoryNodes[catKey] = { cat, header: label, toggle, body, ul };
      });
      lists.appendChild(col);
    });

    if (isPanel) {
      const inner = document.createElement('div');
      inner.className = 'inner';
      inner.appendChild(lists);
      panelBody.appendChild(inner);
      wrapper.appendChild(panelBody);
    } else {
      wrapper.appendChild(lists);
    }
    left.appendChild(wrapper);
    section.appendChild(left);

    /* Columna derecha: canvas + tooltip. */
    const right = document.createElement('div');
    right.className = 'right';
    const mapTitle = document.createElement('h2');
    mapTitle.className = 'map-title';
    const titleA = document.createElement('span');
    const titleB = document.createElement('b');
    mapTitle.append(titleA, titleB);
    section.insertBefore(mapTitle, left);
    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'canvas-wrap';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    canvasWrap.appendChild(canvas);

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    canvasWrap.appendChild(tooltip);

    /* Brújula — reset orientación (polo norte arriba). */
    const compass = document.createElement('button');
    compass.type = 'button';
    compass.className = 'compass';
    compass.setAttribute('aria-label', 'Restablecer orientación al polo norte');
    compass.setAttribute('title', 'Norte arriba');
    compass.innerHTML = COMPASS_SVG;
    compass.addEventListener('click', this._onCompassClick);
    canvasWrap.appendChild(compass);

    /* Selector de estilo del globo (desplegable). */
    this._pickerRefs = null;
    if (this.getAttribute('style-selector') !== 'off') {
      const picker = document.createElement('div');
      picker.className = 'style-picker';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'style-btn';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'style-menu');
      const sw = document.createElement('span'); sw.className = 'sw'; sw.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span'); name.className = 'name';
      const chev = document.createElement('span'); chev.className = 'chev'; chev.setAttribute('aria-hidden', 'true');
      btn.append(sw, name, chev);

      const menu = document.createElement('div');
      menu.className = 'style-menu';
      menu.id = 'style-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;

      const opts = {};
      Object.keys(GLOBE_STYLES).forEach((key) => {
        const o = document.createElement('button');
        o.type = 'button';
        o.className = 'style-opt';
        o.setAttribute('role', 'option');
        o.dataset.key = key;
        const osw = document.createElement('span'); osw.className = 'sw'; osw.setAttribute('aria-hidden', 'true');
        osw.style.background = 'linear-gradient(135deg, ' + css(GLOBE_STYLES[key].land) + ' 0 46%, ' + css(GLOBE_STYLES[key].ocean) + ' 46%)';
        const oname = document.createElement('span');
        o.append(osw, oname);
        o._name = oname;
        o.addEventListener('click', () => {
          this._applyGlobeStyle(key);
          this.dispatchEvent(new CustomEvent('globestylechange', { detail: { style: key }, bubbles: true, composed: true }));
          this._closePicker(true);
        });
        opts[key] = o;
        menu.appendChild(o);
      });

      btn.addEventListener('click', () => (menu.hidden ? this._openPicker() : this._closePicker()));
      picker.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { this._closePicker(true); return; }
        if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
        ev.preventDefault();
        if (menu.hidden) { this._openPicker(); return; }
        const list = Object.values(opts);
        const i = list.indexOf(this.shadowRoot.activeElement);
        const next = ev.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
        list[next].focus();
      });
      this._onDocPointerDown = (ev) => { if (!ev.composedPath().includes(picker)) this._closePicker(); };

      picker.append(btn, menu);
      canvasWrap.appendChild(picker);
      this._pickerRefs = { picker, btn, menu, opts, sw, name };
    }

    right.appendChild(canvasWrap);
    section.appendChild(right);

    root.appendChild(section);

    this._refs = { left, right, intro, titleA, titleB, section, lists, canvasWrap, canvas, tooltip, compass, categories: categoryNodes, panelToggle, panelBody, expandAll };
    if (isPanel) this._setPanel(this._startExpanded);
    else CATEGORY_ORDER.forEach((k) => this._setCat(k, this._startExpanded));
    this._applyI18n();
  }

  /* ===== Selector de estilo ===== */

  _openPicker() {
    const p = this._pickerRefs;
    if (!p) return;
    p.menu.hidden = false;
    p.btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', this._onDocPointerDown);
    p.opts[this._styleKey].focus();
  }

  _closePicker(refocus) {
    const p = this._pickerRefs;
    if (!p) return;
    document.removeEventListener('pointerdown', this._onDocPointerDown);
    p.menu.hidden = true;
    p.btn.setAttribute('aria-expanded', 'false');
    if (refocus) p.btn.focus();
  }

  _syncPicker() {
    const p = this._pickerRefs;
    if (!p) return;
    const t = I18N[this._lang];
    const st = this._style;
    p.name.textContent = st[this._lang];
    p.sw.style.background = 'linear-gradient(135deg, ' + css(st.land) + ' 0 46%, ' + css(st.ocean) + ' 46%)';
    p.btn.setAttribute('aria-label', t.styleLabel + ': ' + st[this._lang]);
    Object.keys(p.opts).forEach((key) => {
      p.opts[key]._name.textContent = GLOBE_STYLES[key][this._lang];
      p.opts[key].setAttribute('aria-selected', key === this._styleKey ? 'true' : 'false');
    });
  }

  /** Aplica un preset: colores de UI/marcadores/grilla, halo y textura. */
  _applyGlobeStyle(key) {
    if (!GLOBE_STYLES[key]) key = DEFAULT_STYLE;
    this._styleKey = key;
    const st = this._style = GLOBE_STYLES[key];
    this._refs.section.style.setProperty('--accent', css(st.accent));
    const t = this._three;
    if (t) {
      if (!t.ocean.material.map) t.ocean.material.color.setHex(st.ocean);
      t.gridLines.material.color.setHex(st.grid);
      t.gridLines.material.opacity = st.gridOpacity;
      t.markers.forEach((m) => m.ring.material.color.setHex(st.accent));
      this._setGlow(st.glow);
      this._rebuildTexture();
    }
    this._syncPicker();
  }

  _setGlow(glow) {
    const t = this._three;
    if (t.glow) {
      t.scene.remove(t.glow);
      t.glow.geometry.dispose();
      t.glow.material.dispose();
      t.glow = null;
    }
    if (!glow) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(glow.color) }, uK: { value: glow.intensity } },
      vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uK; varying vec3 vN; void main() { float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0, 0.0, 1.0))), 3.0) * uK; gl_FragColor = vec4(uColor * i, i); }',
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), mat);
    t.scene.add(mesh);
    t.glow = mesh;
  }

  _rebuildTexture() {
    if (!this._features || !this._three) return;
    const st = this._style;
    const canvasEl = st.mode === 'dots'
      ? buildDotsTextureCanvas(this._features, st)
      : buildEarthTextureCanvas(this._features, {
          ocean: css(st.ocean), land: css(st.land),
          border: st.border != null ? css(st.border) : null, lineScale: st.lineScale,
        });

    const texture = new THREE.CanvasTexture(canvasEl);
    if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this._three.renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const oceanMat = this._three.ocean.material;
    const prev = oceanMat.map;
    oceanMat.map = texture;
    /* MeshBasicMaterial multiplica color × textura: blanco para no teñir. */
    oceanMat.color.set(0xFFFFFF);
    oceanMat.needsUpdate = true;
    if (prev) prev.dispose();
    this._countries = { texture };
  }

  /* ===== Colapsables ===== */

  _catOpen(k)   { return this._refs.categories[k].body.classList.contains('open'); }
  _panelOpen()  { return this._refs.panelBody.classList.contains('open'); }

  _setCat(k, open) {
    const n = this._refs.categories[k];
    if (!n || !n.body) return;
    n.body.classList.toggle('open', open);
    n.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    this._syncExpandAll();
  }

  _setPanel(open) {
    this._refs.panelBody.classList.toggle('open', open);
    this._refs.panelToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  _syncExpandAll() {
    const btn = this._refs.expandAll;
    if (!btn) return;
    const t = I18N[this._lang];
    const anyClosed = CATEGORY_ORDER.some((k) => !this._catOpen(k));
    btn.textContent = anyClosed ? t.expandAll : t.collapseAll;
  }

  /** Abre la región/panel que contiene `id` (si estaba plegado) al activarlo desde el globo. */
  _revealItem(id) {
    if (this._variant === 'panel') { if (!this._panelOpen()) this._setPanel(true); return; }
    const k = CATEGORY_ORDER.find((c) => LOCATIONS[c].some((l) => l.id === id));
    if (k && !this._catOpen(k)) this._setCat(k, true);
  }

  _applyI18n() {
    const t = I18N[this._lang];
    this._refs.intro.textContent = t.intro;
    this._refs.titleA.textContent = t.titleA;
    this._refs.titleB.textContent = t.titleB;
    CATEGORY_ORDER.forEach((catKey) => {
      const node = this._refs.categories[catKey];
      if (!node) return;
      node.header.textContent = t.categories[catKey];
      node.ul.querySelectorAll('button[data-id]').forEach((b) => {
        const loc = LOCATIONS[catKey].find(l => l.id === b.dataset.id);
        if (loc) b.textContent = loc[this._lang];
      });
    });
    if (this._refs.panelToggle) this._refs.panelToggle._label.textContent = t.panel;
    this._syncExpandAll();
    this._syncPicker();
    if (this._refs.tooltip.classList.contains('visible') && this._hoveredGlobeId) {
      this._refs.tooltip.textContent = this._labelFor(this._hoveredGlobeId);
    }
  }

  _labelFor(id) {
    for (const cat of CATEGORY_ORDER) {
      const loc = LOCATIONS[cat].find(l => l.id === id);
      if (loc) return loc[this._lang];
    }
    return '';
  }

  /* ===== Three setup ===== */

  _initThree() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this._refs.canvas, antialias: true, alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 100);
    camera.position.set(0, 0, this._baseZ);

    /* Grupo padre rotante — todas las capas rotan juntas. */
    const group = new THREE.Group();
    scene.add(group);

    this._three = {
      renderer, scene, camera, group,
      ocean: null,
      gridLines: null,
      markers: new Map(),
      raycaster: new THREE.Raycaster(),
      markerHits: [],
      markerIdByUuid: new Map(),
    };
  }

  _buildScene() {
    const { group, scene } = this._three;
    const RADIUS = 1;

    /* 0) Esfera océano OPACA — ocluye hemisferio trasero por depth test.
       Geom. de alta resolución para que el limbo del globo sea liso. */
    const oceanMat = new THREE.MeshBasicMaterial({ color: this._style.ocean });
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(0.998, 96, 72), oceanMat);
    group.add(ocean);
    this._three.ocean = ocean;

    /* 1) Grid lat/lng — meridianos cada 60°, paralelos cada 30°.
       Muy tenue: solo sugiere la esfera sobre el océano. Sobre la tierra
       prácticamente no se ve (la tierra está unas micras por encima). */
    const gridMat = new THREE.LineBasicMaterial({
      color: 0xFFFFFF, transparent: true, opacity: 0.07, depthWrite: false,
    });
    const gridPositions = [];
    for (let lng = -180; lng < 180; lng += 60) {
      const segs = 64;
      for (let i = 0; i < segs; i++) {
        const lat0 = -90 + (180 * i / segs);
        const lat1 = -90 + (180 * (i + 1) / segs);
        const a = latLngToVec3(lat0, lng, RADIUS * 1.001);
        const b = latLngToVec3(lat1, lng, RADIUS * 1.001);
        gridPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const segs = 96;
      for (let i = 0; i < segs; i++) {
        const lng0 = -180 + (360 * i / segs);
        const lng1 = -180 + (360 * (i + 1) / segs);
        const a = latLngToVec3(lat, lng0, RADIUS * 1.001);
        const b = latLngToVec3(lat, lng1, RADIUS * 1.001);
        gridPositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridLines = new THREE.LineSegments(gridGeo, gridMat);
    group.add(gridLines);
    this._three.gridLines = gridLines;

    /* 3) Markers (esfera + hit ampliado + ring para halo). */
    const markerGeo = new THREE.SphereGeometry(0.012, 12, 12);
    Object.values(LOCATIONS).flat().forEach((loc) => {
      const pos = latLngToVec3(loc.lat, loc.lng, RADIUS * 1.005);
      const mat = new THREE.MeshBasicMaterial({
        color: this._style.idle, transparent: true, opacity: this._style.idleOpacity,
      });
      const mesh = new THREE.Mesh(markerGeo, mat);
      mesh.position.copy(pos);
      mesh.userData.id = loc.id;

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.copy(pos);
      hit.userData.id = loc.id;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.016, 0.022, 32),
        new THREE.MeshBasicMaterial({
          color: this._style.accent, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));

      group.add(mesh);
      group.add(hit);
      group.add(ring);

      this._three.markers.set(loc.id, { mesh, ring, hit, localPos: pos.clone() });
      this._three.markerHits.push(hit);
      this._three.markerIdByUuid.set(hit.uuid, loc.id);
    });

    this._applyGlobeStyle(this._styleKey);
    this._applyGroupRotation();
    this._onResize(); // setea camera.aspect + baseZ desde el viewport actual
  }

  async _loadCountries() {
    const features = await loadCountries();
    if (!features || !this._three) return;

    this._features = features;
    this._rebuildTexture();
  }

  _disposeThree() {
    if (!this._three) return;
    const { renderer, ocean, gridLines, markers } = this._three;
    if (ocean)     { ocean.geometry.dispose();     ocean.material.dispose(); }
    if (gridLines) { gridLines.geometry.dispose(); gridLines.material.dispose(); }
    if (this._three.glow) { this._three.glow.geometry.dispose(); this._three.glow.material.dispose(); }
    markers.forEach(({ mesh, ring, hit }) => {
      mesh.geometry.dispose(); mesh.material.dispose();
      ring.geometry.dispose(); ring.material.dispose();
      hit.geometry.dispose();  hit.material.dispose();
    });
    if (this._countries && this._countries.texture) {
      this._countries.texture.dispose();
      this._countries = null;
    }
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    this._three = null;
  }

  /* ===== Loop ===== */

  _startLoop() {
    this._lastTime = performance.now();
    const loop = () => {
      this._rafId = requestAnimationFrame(loop);
      this._tick();
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _tick() {
    if (!this._three) return;
    const { renderer, scene, camera, markers } = this._three;
    const now = performance.now();
    const dt = now - this._lastTime;
    this._lastTime = now;
    const frameRatio = dt / (1000 / 60);

    /* Click animation: slerp + zoom 10% */
    if (this._clickAnim) {
      const a = this._clickAnim;
      const u = clamp((now - a.startedAt) / a.duration, 0, 1);
      const e = easeInOutCubic(u);
      this._yaw   = a.fromYaw   + (a.toYaw   - a.fromYaw)   * e;
      this._pitch = a.fromPitch + (a.toPitch - a.fromPitch) * e;
      if (u >= 1) this._clickAnim = null;
    }
    if (this._cameraAnim) {
      const a = this._cameraAnim;
      const u = clamp((now - a.startedAt) / a.duration, 0, 1);
      const zMax = this._baseZ;
      const zMin = this._baseZ * 0.9;
      let z;
      if (u < 0.5) z = zMax + (zMin - zMax) * easeInOutCubic(u / 0.5);
      else         z = zMin + (zMax - zMin) * easeInOutCubic((u - 0.5) / 0.5);
      camera.position.z = z;
      if (u >= 1) {
        this._cameraAnim = null;
        this._isZooming = false;
        camera.position.z = this._baseZ;
      }
    }

    /* Inercia post-drag */
    if (this._inertia && !this._drag && !this._clickAnim) {
      this._yaw   += this._inertia.vYaw   * frameRatio;
      this._pitch += this._inertia.vPitch * frameRatio;
      this._pitch = clamp(this._pitch, -this._pitchLimit, this._pitchLimit);
      const decay = Math.pow(0.95, frameRatio);
      this._inertia.vYaw   *= decay;
      this._inertia.vPitch *= decay;
      if (Math.hypot(this._inertia.vYaw, this._inertia.vPitch) < 0.0005) this._inertia = null;
    }

    /* Idle rotation con fade-in/out de velocidad. */
    const idleAllowed = !this._drag && !this._inertia && !this._clickAnim
                      && !this._globeHover && now >= this._idleResumeAt
                      && !this._reducedMotion;
    const idleGoal = idleAllowed ? this._idleTarget : 0;
    const smoothing = 1 - Math.pow(1 - 0.06, frameRatio);
    this._idleSpeed += (idleGoal - this._idleSpeed) * smoothing;
    if (this._idleSpeed > 1e-7) this._yaw += this._idleSpeed * frameRatio;

    this._applyGroupRotation();
    this._updateCompass();

    /* Estados de markers (activo > hover > inactivo). */
    markers.forEach((m, id) => {
      const isActive = (id === this._activeId);
      const isHover  = !isActive && (id === this._hoveredListId || id === this._hoveredGlobeId);
      if (isActive) {
        m.mesh.material.color.setHex(this._style.accent);
        m.mesh.material.opacity = 1;
        m.mesh.scale.setScalar(1.5);
        if (!this._reducedMotion) {
          const cyc = ((now % 1500) / 1500);
          m.ring.scale.setScalar(1 + cyc * 1.5);
          m.ring.material.opacity = 0.6 * (1 - cyc);
        } else {
          m.ring.scale.setScalar(1.2);
          m.ring.material.opacity = 0.45;
        }
      } else if (isHover) {
        m.mesh.material.color.setHex(this._style.accent);
        m.mesh.material.opacity = 0.6;
        m.mesh.scale.setScalar(1.2);
        m.ring.material.opacity = 0;
      } else {
        m.mesh.material.color.setHex(this._style.idle);
        m.mesh.material.opacity = this._style.idleOpacity;
        m.mesh.scale.setScalar(1);
        m.ring.material.opacity = 0;
      }
    });

    this._updateTooltip();
    renderer.render(scene, camera);
  }

  _applyGroupRotation() {
    const { group } = this._three;
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._yaw);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._pitch);
    group.quaternion.copy(qY).multiply(qX);
  }

  /** Espeja el yaw del globo en la rotación visual de la brújula. */
  _updateCompass() {
    const c = this._refs.compass;
    if (!c) return;
    const yawDeg = -this._yaw * 180 / Math.PI;
    c.style.setProperty('--compass-yaw', yawDeg.toFixed(2) + 'deg');
  }

  _updateTooltip() {
    const { tooltip, canvasWrap } = this._refs;
    if (!this._hoveredGlobeId) {
      if (tooltip.classList.contains('visible')) tooltip.classList.remove('visible');
      return;
    }
    const marker = this._three.markers.get(this._hoveredGlobeId);
    if (!marker) return;
    const worldPos  = marker.localPos.clone().applyQuaternion(this._three.group.quaternion);
    const projected = worldPos.project(this._three.camera);
    const rect = canvasWrap.getBoundingClientRect();
    tooltip.textContent = this._labelFor(this._hoveredGlobeId);
    let x = (projected.x * 0.5 + 0.5) * rect.width;
    const y = (-projected.y * 0.5 + 0.5) * rect.height;
    /* Anti-corte: mantiene el tooltip dentro del contenedor (laterales y borde superior). */
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight, pad = 4;
    if (tw && rect.width > tw + pad * 2) x = Math.min(Math.max(x, tw / 2 + pad), rect.width - tw / 2 - pad);
    const below = th && (y - th * 1.3 < pad);
    tooltip.style.transform = below ? 'translate(-50%, 40%)' : '';
    tooltip.style.left = `${x}px`;
    tooltip.style.top  = `${y}px`;
    if (!tooltip.classList.contains('visible')) tooltip.classList.add('visible');
  }

  /* ===== Resize con auto-fit ===== */

  /* Modo fit (atributo `fit`): si la lista no entra en el alto disponible, la achica
   * (zoom, mínimo 0.4) para que nunca aparezca scrollbar. Sin overflow no hace nada. */
  _fitList() {
    if (!this.hasAttribute('fit') || !this._refs) return;
    const { left, right, section } = this._refs;
    if (!this._stackMql) this._stackMql = window.matchMedia('(max-width: 959.98px)');
    left.style.zoom = '';
    const lh = left.getBoundingClientRect().height;
    if (!lh) return;
    const ov = this._stackMql.matches
      ? section.scrollHeight - section.clientHeight
      : lh - right.getBoundingClientRect().height;
    if (ov > 1) left.style.zoom = String(clamp((lh - ov) / lh, 0.4, 1).toFixed(3));
  }

  _onResize() {
    this._fitList();
    if (!this._three) return;
    const { renderer, camera } = this._three;
    const rect = this._refs.canvasWrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    this._baseZ = getBaseCameraZ(w, h);
    if (!this._isZooming) camera.position.z = this._baseZ;
    camera.updateProjectionMatrix();
  }

  _onReducedMotionChange(ev) {
    this._reducedMotion = !!ev.matches;
  }

  /* ===== Canvas: drag + raycaster ===== */

  _bindCanvasEvents() {
    const c = this._refs.canvas;
    c.addEventListener('pointerdown',  this._onPointerDown);
    c.addEventListener('pointermove',  this._onPointerMove);
    c.addEventListener('pointerup',    this._onPointerUp);
    c.addEventListener('pointercancel',this._onPointerUp);
    c.addEventListener('pointerenter', this._onPointerEnter);
    c.addEventListener('pointerleave', this._onPointerLeave);
    c.addEventListener('click',        this._onCanvasClick);
  }
  _unbindCanvasEvents() {
    const c = this._refs.canvas;
    c.removeEventListener('pointerdown',  this._onPointerDown);
    c.removeEventListener('pointermove',  this._onPointerMove);
    c.removeEventListener('pointerup',    this._onPointerUp);
    c.removeEventListener('pointercancel',this._onPointerUp);
    c.removeEventListener('pointerenter', this._onPointerEnter);
    c.removeEventListener('pointerleave', this._onPointerLeave);
    c.removeEventListener('click',        this._onCanvasClick);
  }

  _onPointerDown(ev) {
    this._inertia    = null;
    this._clickAnim  = null;
    this._cameraAnim = null;
    this._isZooming  = false;
    this._three.camera.position.z = this._baseZ;

    this._drag = {
      startX: ev.clientX, startY: ev.clientY,
      startYaw: this._yaw, startPitch: this._pitch,
      samples: [{ t: performance.now(), yaw: this._yaw, pitch: this._pitch }],
      moved: false,
      pointerId: ev.pointerId,
    };
    this._refs.canvas.classList.add('dragging');
    try { this._refs.canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    ev.preventDefault();
  }

  _onPointerMove(ev) {
    this._raycastHover(ev);
    if (!this._drag) return;
    const dx = ev.clientX - this._drag.startX;
    const dy = ev.clientY - this._drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._drag.moved = true;

    this._yaw   = this._drag.startYaw + dx * this._dragSensitivity;
    this._pitch = clamp(this._drag.startPitch + dy * this._dragSensitivity,
                        -this._pitchLimit, this._pitchLimit);

    const now = performance.now();
    this._drag.samples.push({ t: now, yaw: this._yaw, pitch: this._pitch });
    while (this._drag.samples.length > 1 && now - this._drag.samples[0].t > 100) {
      this._drag.samples.shift();
    }
  }

  _onPointerUp(ev) {
    if (!this._drag) return;
    let inertia = null;
    if (this._drag.samples.length >= 2 && !this._reducedMotion) {
      const first = this._drag.samples[0];
      const last  = this._drag.samples[this._drag.samples.length - 1];
      const dtMs  = Math.max(1, last.t - first.t);
      const vYaw   = (last.yaw   - first.yaw)   / dtMs * (1000 / 60);
      const vPitch = (last.pitch - first.pitch) / dtMs * (1000 / 60);
      if (Math.hypot(vYaw, vPitch) > 0.0015) inertia = { vYaw, vPitch };
    }
    this._inertia = inertia;
    this._idleResumeAt = performance.now() + 2000;
    this._lastDragMoved = this._drag.moved;

    this._drag = null;
    this._refs.canvas.classList.remove('dragging');
    try { this._refs.canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
  }

  _onPointerEnter() { this._globeHover = true; }
  _onPointerLeave() {
    this._globeHover = false;
    if (this._hoveredGlobeId) {
      this._hoveredGlobeId = null;
      this._refs.canvas.classList.remove('over-marker');
    }
  }

  _onCanvasClick(ev) {
    if (this._lastDragMoved) { this._lastDragMoved = false; return; }
    const id = this._raycastIdAt(ev);
    if (id) this._activate(id);
  }

  _raycastHover(ev) {
    const id = this._raycastIdAt(ev);
    if (id !== this._hoveredGlobeId) {
      this._hoveredGlobeId = id;
      this._refs.canvas.classList.toggle('over-marker', !!id);
    }
  }

  _raycastIdAt(ev) {
    if (!this._three) return null;
    const { raycaster, camera, markerHits, markerIdByUuid, group } = this._three;
    const rect = this._refs.canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x, y }, camera);
    group.updateMatrixWorld();
    const hits = raycaster.intersectObjects(markerHits, false);
    if (!hits.length) return null;
    return markerIdByUuid.get(hits[0].object.uuid) || null;
  }

  /* ===== Lista: click + hover ===== */

  _onItemClick(ev)  { const id = ev.currentTarget.dataset.id; if (id) this._activate(id); }
  _onItemEnter(ev)  { const id = ev.currentTarget.dataset.id; if (id) this._hoveredListId = id; }
  _onItemLeave()    { this._hoveredListId = null; }

  /** Brújula: vuelve a orientación neutra (norte arriba, sin pitch). */
  _onCompassClick() {
    if (!this._three) return;

    /* Yaw target: el múltiplo de 2π más cercano al yaw actual — así
       evita girar "la vuelta larga" cuando ya estamos casi alineados. */
    const targetYaw = Math.round(this._yaw / (2 * Math.PI)) * (2 * Math.PI);

    this._drag     = null;
    this._inertia  = null;

    const duration = this._reducedMotion ? 300 : 900;
    this._clickAnim = {
      fromYaw:   this._yaw,
      fromPitch: this._pitch,
      toYaw:     targetYaw,
      toPitch:   0,
      startedAt: performance.now(),
      duration,
    };
    this._idleResumeAt = performance.now() + duration + 1500;
  }

  /** Activa una ubicación: aria-pressed + slerp + zoom 10%. */
  _activate(id) {
    if (!this._three) return;
    const marker = this._three.markers.get(id);
    if (!marker) return;

    this.shadowRoot.querySelectorAll('.cat-item button').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false');
    });
    this._activeId = id;
    this._revealItem(id);

    const tgt = yawPitchForFront(marker.localPos);
    const targetYaw   = this._yaw + shortestAngle(this._yaw, tgt.yaw);
    const targetPitch = clamp(tgt.pitch, -this._pitchLimit, this._pitchLimit);

    this._drag = null;
    this._inertia = null;

    const duration = this._reducedMotion ? 400 : 1200;
    this._clickAnim = {
      fromYaw:   this._yaw,
      fromPitch: this._pitch,
      toYaw:     targetYaw,
      toPitch:   targetPitch,
      startedAt: performance.now(),
      duration,
    };
    if (!this._reducedMotion) {
      this._cameraAnim = { startedAt: performance.now(), duration };
      this._isZooming = true;
    }
    this._idleResumeAt = performance.now() + duration + 2000;
  }
}

/* ========================================================================== */
/*  Registro                                                                  */
/* ========================================================================== */

if (!customElements.get('cks-globe-styles')) {
  customElements.define('cks-globe-styles', CKSGlobeStyles);
}

window.CKSGlobeStylesVersion = '1.4.0';
