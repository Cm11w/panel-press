// Panel Press editor: wires the sidebar, the live preview canvas and export.
// State is one plain object; every change pushes a snapshot so Undo/Redo
// can step back through the whole session. Photos are read on the user's
// own machine and never uploaded anywhere.
import { ASPECTS, GRADES, LAYOUTS, defaultFit, drawCoverArt, layoutRects } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const SAMPLES = ['pier', 'boulevard', 'sunset-street', 'neon-beach'];

export const state = {
  aspect: 'landscape',
  layout: 'hero3',
  grade: 'sunset',
  caption: 'Sunset Heist',
  subtitle: 'Neon Nights',
  ribbon: 'Wanted',
  heat: 4,
  grain: 0.5,
  vignette: 0.6,
  titleBlock: true,
  photos: [], // { name, src, img }
  panels: [], // one { photo, zoom, ox, oy } per layout slot
  selected: 0,
};

let undoStack = [];
let redoStack = [];

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** A fresh panel pointing at photo `i`, cycling through the photos. */
export function freshPanel(i) {
  return { photo: state.photos.length ? i % state.photos.length : 0, zoom: 1, ox: 0, oy: 0, auto: true };
}

/** (Re)computes the default crop for every panel still on automatic fit. */
export function applyDefaultFits() {
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  state.panels.forEach((p, i) => {
    if (!p.auto || !rects[i]) return;
    const img = state.photos[p.photo]?.img;
    if (!img) return;
    Object.assign(p, defaultFit(img, rects[i]));
  });
}

/** Resizes the panels array to the current layout, keeping old settings. */
export function syncPanels() {
  const count = LAYOUTS[state.layout].panels;
  const next = [];
  for (let i = 0; i < count; i++) next.push(state.panels[i] ?? freshPanel(i));
  state.panels = next;
  state.selected = Math.min(state.selected, count - 1);
}

/**
 * Points each panel at a different photo in turn (panel i -> photo i % n).
 * Call this whenever the photo list changes — on boot preload, when a
 * sample or an upload adds a photo — so the cover never shows one photo
 * in every panel. It deliberately does NOT run on layout changes or
 * redraws, where the user's own per-panel choices must survive.
 */
export function distributePhotos() {
  if (!state.photos.length) return;
  state.panels.forEach((p, i) => {
    const photo = i % state.photos.length;
    if (p.photo !== photo) {
      p.photo = photo;
      p.auto = true; // a new photo gets the default crop, never the old one's
    }
  });
  applyDefaultFits();
}

/** Plain snapshot of the editable state (images by src, not by pixels). */
export function snapshot() {
  return JSON.stringify({
    aspect: state.aspect, layout: state.layout, grade: state.grade,
    caption: state.caption, subtitle: state.subtitle, ribbon: state.ribbon,
    heat: state.heat, grain: state.grain, vignette: state.vignette,
    titleBlock: state.titleBlock, panels: state.panels,
    photoSrcs: state.photos.map((p) => p.src),
    photoNames: state.photos.map((p) => p.name), selected: state.selected,
  });
}

/** Restores a snapshot, reloading any photo whose image is not in memory. */
export async function restore(json) {
  const s = JSON.parse(json);
  Object.assign(state, {
    aspect: s.aspect, layout: s.layout, grade: s.grade, caption: s.caption,
    subtitle: s.subtitle, ribbon: s.ribbon, heat: s.heat, grain: s.grain,
    vignette: s.vignette, titleBlock: s.titleBlock, panels: s.panels, selected: s.selected,
  });
  const imgs = await Promise.all(s.photoSrcs.map(async (src, i) => {
    const old = state.photos.find((p) => p.src === src);
    if (old) return old;
    return { name: s.photoNames[i] || `Photo ${i + 1}`, src, img: await loadImage(src) };
  }));
  state.photos = imgs;
  syncPanels();
  syncControls();
  redraw();
}

/** Records the current state for Undo, clearing the Redo stack. */
export function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

export async function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  await restore(undoStack.pop());
  syncUndoButtons();
}

export async function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  await restore(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

/** Sizes the preview canvas to the chosen aspect and draws the cover. */
export function redraw() {
  const dims = ASPECTS[state.aspect];
  const scale = Math.min(1, 1280 / Math.max(dims.w, dims.h));
  const w = Math.round(dims.w * scale);
  const h = Math.round(dims.h * scale);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  syncPanels();
  // Automatic panels always show their default crop for the current
  // layout/aspect; a panel the user has dragged, zoomed or slid keeps
  // the user's own crop (auto=false) through every layout change.
  applyDefaultFits();
  drawCoverArt(canvas, state);
  document.getElementById('previewLabel').textContent =
    `${state.aspect === 'landscape' ? 'Landscape' : state.aspect === 'square' ? 'Square' : 'Portrait'} preview · ${dims.w} x ${dims.h}`;
}

/** Rebuilds the photo strip, the panel photo menu and the pickers. */
export function syncControls() {
  document.getElementById('caption').value = state.caption;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('ribbon').value = state.ribbon;
  document.getElementById('titleBlock').checked = state.titleBlock;
  document.getElementById('grain').value = Math.round(state.grain * 100);
  document.getElementById('vignette').value = Math.round(state.vignette * 100);
  document.getElementById('grainVal').textContent = `${Math.round(state.grain * 100)}%`;
  document.getElementById('vigVal').textContent = `${Math.round(state.vignette * 100)}%`;
  document.querySelectorAll('.aspect-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.aspect === state.aspect));
  document.querySelectorAll('#layoutPicker button').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradePicker button').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#heatPicker button').forEach((b, i) =>
    b.classList.toggle('on', i < state.heat));

  const strip = document.getElementById('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((p, i) => {
    const thumb = document.createElement('img');
    thumb.src = p.src;
    thumb.alt = p.name;
    thumb.title = `${p.name} — click to put in the selected panel`;
    thumb.classList.toggle('used', state.panels.some((panel) => panel.photo === i));
    thumb.addEventListener('click', () => {
      pushHistory();
      state.panels[state.selected].photo = i;
      state.panels[state.selected].auto = true; // new photo gets the default crop
      syncControls();
      redraw();
    });
    strip.appendChild(thumb);
  });

  const menu = document.getElementById('panelPhoto');
  menu.innerHTML = '';
  state.photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1} — ${p.name}`;
    menu.appendChild(opt);
  });
  const empty = document.createElement('option');
  empty.value = '-1';
  empty.textContent = 'Empty panel';
  menu.appendChild(empty);
  const panel = state.panels[state.selected];
  menu.value = panel && panel.photo >= 0 && panel.photo < state.photos.length ? String(panel.photo) : '-1';
  if (panel) {
    document.getElementById('panelZoom').value = Math.round(panel.zoom * 100);
    document.getElementById('zoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
    document.getElementById('panelOx').value = Math.round(panel.ox * 100);
    document.getElementById('panelOy').value = Math.round(panel.oy * 100);
  }
}

/** Builds the layout, grade and heat pickers from the cover module's tables. */
export function buildPickers() {
  const layoutBox = document.getElementById('layoutPicker');
  for (const [key, info] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.layout = key;
    b.innerHTML = `${info.name}<small>${info.blurb} · ${info.panels} panel${info.panels > 1 ? 's' : ''}</small>`;
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      pushHistory();
      state.layout = key;
      syncPanels();
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  }
  const gradeBox = document.getElementById('gradePicker');
  for (const [key, info] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.grade = key;
    const stops = info.stops.map(([, c]) => c).join(', ');
    b.innerHTML = `<span class="grade-swatch" style="background:linear-gradient(90deg, ${stops})"></span>${info.name}`;
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      pushHistory();
      state.grade = key;
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  }
  const heatBox = document.getElementById('heatPicker');
  for (let i = 0; i < 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '★';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `${i + 1} star${i ? 's' : ''}`);
    b.addEventListener('click', () => {
      pushHistory();
      state.heat = i + 1;
      syncControls();
      redraw();
    });
    heatBox.appendChild(b);
  }
}

/** Adds photos from File objects or sample names, then redraws. */
export async function addPhotos(files) {
  for (const file of files) {
    if (state.photos.length >= 4) { status.textContent = 'Four photos at most — remove one first.'; return; }
    const src = file.dataUrl ?? URL.createObjectURL(file);
    const img = await loadImage(src);
    state.photos.push({ name: file.name ?? 'Uploaded photo', src, img });
  }
  syncPanels();
  distributePhotos();
  syncControls();
  redraw();
}

/** Exports the cover at a full post size and downloads the PNG. */
export function exportCover(aspect) {
  const dims = ASPECTS[aspect];
  const off = document.createElement('canvas');
  off.width = dims.w;
  off.height = dims.h;
  const saved = state.aspect;
  state.aspect = aspect;
  drawCoverArt(off, state);
  state.aspect = saved;
  off.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `panel-press-${dims.w}x${dims.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved panel-press-${dims.w}x${dims.h}.png`;
  }, 'image/png');
}

/** Which panel rect (if any) contains canvas point (px, py). */
export function panelAt(px, py) {
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

function canvasPoint(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - box.left) / box.width) * canvas.width,
    y: ((e.clientY - box.top) / box.height) * canvas.height,
  };
}

// ---- Pointer editing on the preview: drag pans, wheel zooms, double-click cycles the photo. ----
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const i = panelAt(x, y);
  if (i < 0) return;
  state.selected = i;
  syncControls();
  const p = state.panels[i];
  drag = { i, x, y, ox: p.ox, oy: p.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  pushHistory();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = canvasPoint(e);
  const p = state.panels[drag.i];
  const dx = (x - drag.x) / canvas.width;
  const dy = (y - drag.y) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) { drag.moved = true; p.auto = false; }
  p.ox = Math.max(-0.6, Math.min(0.6, drag.ox + dx));
  p.oy = Math.max(-1, Math.min(1, drag.oy + dy)); // defaults reach ~0.87, so the drag range must too
  document.getElementById('panelOx').value = Math.round(p.ox * 100);
  document.getElementById('panelOy').value = Math.round(p.oy * 100);
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag && !drag.moved) undoStack.pop(); // a plain click is not an edit
  drag = null;
  syncUndoButtons();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { x, y } = canvasPoint(e);
  const i = panelAt(x, y);
  if (i < 0) return;
  pushHistory();
  const p = state.panels[i];
  p.zoom = Math.max(0.2, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); // defaults reach ~0.35
  p.auto = false;
  state.selected = i;
  syncControls();
  redraw();
}, { passive: false });
canvas.addEventListener('dblclick', (e) => {
  const { x, y } = canvasPoint(e);
  const i = panelAt(x, y);
  if (i < 0 || !state.photos.length) return;
  pushHistory();
  const p = state.panels[i];
  p.photo = ((p.photo ?? 0) + 1) % state.photos.length;
  p.auto = true; // a new photo in this panel gets the default crop
  state.selected = i;
  syncControls();
  redraw();
});

// ---- Sidebar wiring. ----
document.getElementById('photoFiles').addEventListener('change', async (e) => {
  await addPhotos([...e.target.files]);
  e.target.value = '';
});
document.querySelectorAll('[data-sample]').forEach((b) =>
  b.addEventListener('click', async () => {
    // A sample that is already loaded adds nothing: clicking it again
    // used to append a duplicate photo (photos=[pier, boulevard, pier]).
    const src = `samples/${b.dataset.sample}.jpg`;
    if (state.photos.some((p) => p.src === src)) {
      status.textContent = `${b.dataset.sample} is already loaded.`;
      return;
    }
    pushHistory();
    const img = await loadImage(src);
    if (state.photos.length >= 4) state.photos.shift();
    state.photos.push({ name: b.dataset.sample, src, img });
    syncPanels();
    distributePhotos();
    syncControls();
    redraw();
  }));
document.getElementById('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('ribbon').addEventListener('input', (e) => { state.ribbon = e.target.value; redraw(); });
document.getElementById('titleBlock').addEventListener('change', (e) => { pushHistory(); state.titleBlock = e.target.checked; redraw(); });
document.getElementById('grain').addEventListener('input', (e) => {
  state.grain = e.target.value / 100;
  document.getElementById('grainVal').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('vignette').addEventListener('input', (e) => {
  state.vignette = e.target.value / 100;
  document.getElementById('vigVal').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('panelPhoto').addEventListener('change', (e) => {
  pushHistory();
  state.panels[state.selected].photo = Number(e.target.value);
  state.panels[state.selected].auto = true; // the new photo gets the default crop
  syncControls();
  redraw();
});
document.getElementById('panelZoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = e.target.value / 100;
  state.panels[state.selected].auto = false;
  document.getElementById('zoomVal').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('panelZoom').addEventListener('change', pushHistory);
document.getElementById('panelOx').addEventListener('input', (e) => {
  state.panels[state.selected].ox = e.target.value / 100;
  state.panels[state.selected].auto = false;
  redraw();
});
document.getElementById('panelOx').addEventListener('change', pushHistory);
document.getElementById('panelOy').addEventListener('input', (e) => {
  state.panels[state.selected].oy = e.target.value / 100;
  state.panels[state.selected].auto = false;
  redraw();
});
document.getElementById('panelOy').addEventListener('change', pushHistory);
document.getElementById('panelReset').addEventListener('click', () => {
  pushHistory();
  // "Centre" means back to the automatic default crop for this photo
  // and panel — a plain oy=0 would cut the head off again in short panels.
  state.panels[state.selected].auto = true;
  applyDefaultFits();
  syncControls();
  redraw();
});
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.querySelectorAll('.aspect-btn').forEach((b) =>
  b.addEventListener('click', () => {
    if (state.aspect === b.dataset.aspect) return;
    pushHistory();
    state.aspect = b.dataset.aspect;
    syncControls();
    redraw();
  }));
document.getElementById('exportSquare').addEventListener('click', () => exportCover('square'));
document.getElementById('exportPortrait').addEventListener('click', () => exportCover('portrait'));
document.getElementById('exportLandscape').addEventListener('click', () => exportCover('landscape'));

// ---- Boot: a `?shot=` query sets up a fixed scene for a screenshot instead. ----
buildPickers();
syncPanels();
syncControls();
syncUndoButtons();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (scene) => {
    state.aspect = scene.aspect;
    state.layout = scene.layout;
    state.grade = scene.grade;
    state.caption = scene.caption;
    state.subtitle = scene.subtitle;
    state.ribbon = scene.ribbon;
    state.heat = scene.heat;
    state.photos = [];
    for (const name of scene.photos) {
      const img = await loadImage(`samples/${name}.jpg`);
      state.photos.push({ name, src: `samples/${name}.jpg`, img });
    }
    syncPanels();
    state.panels.forEach((p, i) => { p.photo = i % state.photos.length; });
    // Default crops first (automatic fit per photo and panel), then the
    // scene's explicit per-panel overrides win and lock those panels.
    applyDefaultFits();
    // Per-panel crop overrides from the shot scene (zoom, ox, oy per slot).
    if (scene.panels) {
      scene.panels.forEach((fit, i) => {
        if (state.panels[i] && fit) {
          Object.assign(state.panels[i], fit);
          state.panels[i].auto = false;
        }
      });
    }
    syncControls();
    redraw();
  });
} else {
  // First visit: preload two samples so the cover is never empty.
  (async () => {
    for (const name of ['pier', 'boulevard']) {
      try {
        const img = await loadImage(`samples/${name}.jpg`);
        state.photos.push({ name, src: `samples/${name}.jpg`, img });
      } catch { /* sample missing: the cover still renders its placeholders */ }
    }
    syncPanels();
    distributePhotos();
    syncControls();
    redraw();
  })();
  redraw();
}
