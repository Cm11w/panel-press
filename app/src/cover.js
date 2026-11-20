// Panel Press — the cover renderer.
// Draws a multi-panel, poster-style cover onto any canvas: photos are
// placed into a layout's panels, graded with a gradient map, then finished
// with a bold Anton caption, a neon Pacifico subtitle, a heat meter, a
// ribbon badge, grain and a vignette. Everything here is original art:
// no game-studio logo, artwork or font is used anywhere.

// ---- Grades: gradient maps from shadow to highlight (hex stops). ----
export const GRADES = {
  sunset: {
    name: 'Sunset',
    stops: [[0, '#160a2e'], [0.28, '#7a1e5c'], [0.55, '#e8442e'], [0.78, '#ff9e3d'], [1, '#ffe9a8']],
  },
  neon: {
    name: 'Neon Pink / Teal',
    stops: [[0, '#05021a'], [0.3, '#3b0a6e'], [0.55, '#ff2e88'], [0.8, '#19e3d6'], [1, '#e8fff9']],
  },
  dusk: {
    name: 'Dusk',
    stops: [[0, '#0b0f24'], [0.32, '#3a2a63'], [0.6, '#b5536e'], [0.82, '#e88a5a'], [1, '#ffd9a0']],
  },
  gold: {
    name: 'Gold Hour',
    stops: [[0, '#1c1005'], [0.3, '#6b3410'], [0.58, '#c97a1e'], [0.8, '#f5b942'], [1, '#fff3c4']],
  },
  noir: {
    name: 'Noir',
    stops: [[0, '#000000'], [0.25, '#1c1c22'], [0.55, '#6d6d78'], [0.8, '#c9c9d4'], [1, '#ffffff']],
  },
};

// ---- Layouts: name, panel count, and a short blurb for the picker. ----
export const LAYOUTS = {
  grid4: { name: 'Four Panel', panels: 4, blurb: 'Classic 2 x 2 poster grid' },
  hero3: { name: 'Hero + Three', panels: 4, blurb: 'One big hero, three stacked' },
  full: { name: 'Full Bleed', panels: 1, blurb: 'One photo, edge to edge' },
  grid9: { name: 'Nine Panel', panels: 9, blurb: 'Busy 3 x 3 contact sheet' },
  tilted: { name: 'Tilted Snapshots', panels: 4, blurb: 'Overlapping tilted prints' },
  story: { name: 'Story Stack', panels: 3, blurb: 'Vertical strip of three' },
};

export const ASPECTS = {
  landscape: { w: 1920, h: 1080, label: '1920 x 1080' },
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
};

const BORDER = 10; // white panel border, in cover pixels at 1080 wide
const GAP = 14;

/** Panel rectangles for a layout, in canvas pixels. Each is {x, y, w, h, rot}. */
export function layoutRects(layout, W, H) {
  const s = W / 1080; // scale borders and gaps with the cover width
  const b = BORDER * s;
  const g = GAP * s;
  const inset = b + g;
  const iw = W - inset * 2;
  const ih = H - inset * 2;
  switch (layout) {
    case 'grid4': {
      const cw = (iw - g) / 2;
      const ch = (ih - g) / 2;
      return [
        { x: inset, y: inset, w: cw, h: ch, rot: 0 },
        { x: inset + cw + g, y: inset, w: cw, h: ch, rot: 0 },
        { x: inset, y: inset + ch + g, w: cw, h: ch, rot: 0 },
        { x: inset + cw + g, y: inset + ch + g, w: cw, h: ch, rot: 0 },
      ];
    }
    case 'hero3': {
      const heroW = iw * 0.62;
      const sideW = iw - heroW - g;
      const sh = (ih - g * 2) / 3;
      return [
        { x: inset, y: inset, w: heroW, h: ih, rot: 0 },
        { x: inset + heroW + g, y: inset, w: sideW, h: sh, rot: 0 },
        { x: inset + heroW + g, y: inset + sh + g, w: sideW, h: sh, rot: 0 },
        { x: inset + heroW + g, y: inset + (sh + g) * 2, w: sideW, h: sh, rot: 0 },
      ];
    }
    case 'full':
      return [{ x: inset, y: inset, w: iw, h: ih, rot: 0 }];
    case 'grid9': {
      const cw = (iw - g * 2) / 3;
      const ch = (ih - g * 2) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({ x: inset + c * (cw + g), y: inset + r * (ch + g), w: cw, h: ch, rot: 0 });
        }
      }
      return out;
    }
    case 'tilted': {
      const cw = iw * 0.52;
      const ch = ih * 0.52;
      return [
        { x: inset, y: inset, w: cw, h: ch, rot: -0.05 },
        { x: inset + iw - cw, y: inset + ih * 0.04, w: cw, h: ch, rot: 0.04 },
        { x: inset + iw * 0.03, y: inset + ih - ch, w: cw, h: ch, rot: 0.03 },
        { x: inset + iw - cw - iw * 0.02, y: inset + ih - ch - ih * 0.03, w: cw, h: ch, rot: -0.035 },
      ];
    }
    case 'story': {
      // The title block (neon subtitle from ~0.74H, big caption below it)
      // used to fall across the bottom strip, crossing out the face in it.
      // Zooming out cannot fix that: a face filling the strip is ~270px
      // tall while only ~70px of the strip sits above the subtitle. So the
      // three strips end at 0.72H and the title gets its own dark band
      // below them — it can never sit on a photo in this layout.
      const titleTop = H * 0.72;
      const sh = (titleTop - inset - g * 2) / 3;
      return [
        { x: inset, y: inset, w: iw, h: sh, rot: 0 },
        { x: inset, y: inset + sh + g, w: iw, h: sh, rot: 0 },
        { x: inset, y: inset + (sh + g) * 2, w: iw, h: sh, rot: 0 },
      ];
    }
    default:
      return layoutRects('grid4', W, H);
  }
}

/**
 * The default crop for a photo in a panel rect. Photos are usually shot
 * with the face in the upper third, so when a panel is much wider than the
 * photo the centred cover-fit would cut the head off: bias the visible
 * window up until its top edge sits near the top of the photo (2%). When
 * the centred window already keeps the top twentieth in frame, stay
 * centred. The returned oy is clamped so the photo still covers the panel.
 * This is the same pan mechanism the screenshot scenes use explicitly.
 */
export function defaultFit(img, rect) {
  const fit = { zoom: 1, ox: 0, oy: 0 };
  if (!img || !rect || !img.naturalWidth || !img.naturalHeight) return fit;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  let dh = img.naturalHeight * base;
  if (dh <= rect.h) return fit;
  const centredTop = (1 - rect.h / dh) / 2; // fraction of the photo above the centred window
  if (centredTop <= 0.05) return fit;
  // A face spans roughly the top 2%-35% of a portrait shot. When the panel
  // is so wide that the cover-fit window is shorter than that (a story
  // strip in landscape, say), zoom out until the window holds the whole
  // face; however far it is panned, the head can never fit otherwise.
  // Only for portrait/square photos: a landscape photo has no face to
  // protect and keeps its full-width crop.
  if (img.naturalWidth <= img.naturalHeight && rect.h / dh < 0.38) {
    fit.zoom = Math.max(0.2, rect.h / (dh * 0.38));
    dh *= fit.zoom;
  }
  const maxOy = (dh - rect.h) / (2 * rect.h);
  const oy = (dh * (0.5 - 0.02) - rect.h / 2) / rect.h;
  fit.oy = Math.max(0, Math.min(maxOy, oy));
  return fit;
}

/** Builds a 256-entry RGB lookup table from a grade's colour stops. */
export function buildGradeLut(stops) {
  const lut = new Uint8Array(256 * 3);
  const rgb = stops.map(([t, hex]) => [t, parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = rgb[0];
    let b = rgb[rgb.length - 1];
    for (let k = 0; k < rgb.length - 1; k++) {
      if (t >= rgb[k][0] && t <= rgb[k + 1][0]) { a = rgb[k]; b = rgb[k + 1]; break; }
    }
    const span = b[0] - a[0] || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    lut[i * 3] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 3 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
  }
  return lut;
}

/** Applies a gradient-map grade to ImageData in place, mixed with the original. */
export function gradeImageData(imageData, lut, mix = 0.8) {
  const d = imageData.data;
  const keep = 1 - mix;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const j = lum * 3;
    d[i] = d[i] * keep + lut[j] * mix;
    d[i + 1] = d[i + 1] * keep + lut[j + 1] * mix;
    d[i + 2] = d[i + 2] * keep + lut[j + 2] * mix;
  }
  return imageData;
}

// One shared offscreen canvas, reused for every graded panel.
const gradeCanvas = document.createElement('canvas');
const gradeCtx = gradeCanvas.getContext('2d');

/**
 * Draws one photo into a panel rect with cover-fit, zoom and pan, then the
 * gradient-map grade. `fit` is {zoom, ox, oy}: zoom 1 = cover fit, ox/oy are
 * pan offsets in fractions of the panel size. `lut` may be null (no grade).
 */
export function drawPanel(ctx, img, rect, fit, lut) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot || 0);
  ctx.translate(-w / 2, -h / 2);
  // White print border, then the photo clipped inside it.
  ctx.fillStyle = '#f8f4ec';
  ctx.fillRect(-BORDER * (w / 1080 + 0.6), -BORDER * (w / 1080 + 0.6), w + 2 * BORDER, h + 2 * BORDER);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  if (img) {
    const zoom = Math.max(0.2, fit?.zoom ?? 1);
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = (w - dw) / 2 + (fit?.ox ?? 0) * w;
    const dy = (h - dh) / 2 + (fit?.oy ?? 0) * h;
    if (lut) {
      gradeCanvas.width = Math.max(2, Math.round(w));
      gradeCanvas.height = Math.max(2, Math.round(h));
      gradeCtx.drawImage(img, dx, dy, dw, dh);
      const data = gradeCtx.getImageData(0, 0, gradeCanvas.width, gradeCanvas.height);
      gradeImageData(data, lut, 0.8);
      gradeCtx.putImageData(data, 0, 0);
      ctx.drawImage(gradeCanvas, 0, 0, w, h);
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else {
    // Empty panel: a dark placeholder with a dashed frame.
    ctx.fillStyle = '#241a33';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.max(14, w * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Drop a photo here', w / 2, h / 2);
  }
  ctx.restore();
  ctx.restore();
}

/** Draws a five-pointed star centred at (cx, cy) with radius r. */
export function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Fits a font size so `text` fits `maxWidth`, starting from `start`. */
export function fitFont(ctx, text, font, start, maxWidth) {
  let size = start;
  ctx.font = font(size);
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/**
 * Draws the whole cover. `state` holds photos (HTMLImageElement|null array),
 * panels (one {photo, zoom, ox, oy} per layout slot), layout, grade, caption,
 * subtitle, ribbon, heat (0-5), grain (0-1), vignette (0-1) and titleBlock.
 */
export function drawCoverArt(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const s = W / 1080;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutRects(state.layout, W, H);
  const lut = state.grade && GRADES[state.grade] ? buildGradeLut(GRADES[state.grade].stops) : null;
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = state.photos[panel.photo]?.img ?? null;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18 * s;
    ctx.shadowOffsetY = 6 * s;
    drawPanel(ctx, img, rect, panel, lut);
    ctx.restore();
  });

  // Ribbon badge, top-left, tilted. Kept small and high so it clears the
  // faces in the top row of panels.
  const ribbon = (state.ribbon || '').trim();
  if (ribbon) {
    const rw = Math.min(W * 0.26, 260 * s);
    const rh = 40 * s;
    ctx.save();
    ctx.translate(rw / 2 + 18 * s, 40 * s);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#ff2e63';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10 * s;
    ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 ${Math.round(22 * s)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ribbon.toUpperCase(), 0, 2 * s);
    ctx.restore();
  }

  // Heat meter: five stars, top-right.
  if (state.heat > 0) {
    const r = 17 * s;
    const gap = r * 2.3;
    const total = gap * 4 + r * 2;
    let cx = W - 40 * s - total + r;
    const cy = 46 * s;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      starPath(ctx, cx, cy, r);
      ctx.fillStyle = i < state.heat ? '#ffc93d' : 'rgba(255,255,255,0.25)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2 * s;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      cx += gap;
    }
  }

  // Title block: dark band + neon script subtitle + big Anton caption.
  const caption = (state.caption || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  if (caption) {
    const bandH = H * 0.24;
    if (state.titleBlock) {
      const band = ctx.createLinearGradient(0, H - bandH, 0, H);
      band.addColorStop(0, 'rgba(10,4,20,0)');
      band.addColorStop(1, 'rgba(10,4,20,0.82)');
      ctx.fillStyle = band;
      ctx.fillRect(0, H - bandH, W, bandH);
    }
    const baseline = H - H * 0.055;
    if (subtitle && state.titleBlock) {
      const subSize = fitFont(ctx, subtitle, (n) => `${n}px Pacifico, cursive`, H * 0.05, W * 0.7);
      ctx.font = `${subSize}px Pacifico, cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ff7ad9';
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = 18 * s;
      // Sit well above the caption: Pacifico's descenders used to graze it.
      ctx.fillText(subtitle, W / 2, baseline - H * 0.16);
      ctx.shadowBlur = 0;
    }
    const capSize = fitFont(ctx, caption, (n) => `${n}px Anton, sans-serif`, H * 0.115, W * 0.92);
    ctx.font = `${capSize}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,5,30,0.9)';
    ctx.lineWidth = capSize * 0.14;
    ctx.strokeText(caption, W / 2, baseline);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, W / 2, baseline);
  }

  // Vignette: darkened corners.
  if (state.vignette > 0) {
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${0.5 * state.vignette})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // Film grain: tiled noise at low alpha.
  if (state.grain > 0) {
    const noise = grainTile();
    const pattern = ctx.createPattern(noise, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.16 * state.grain;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

let noiseTile = null;
/** A small random-noise tile, generated once and reused for grain. */
export function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = 128;
  noiseTile.height = 128;
  const nctx = noiseTile.getContext('2d');
  const data = nctx.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  nctx.putImageData(data, 0, 0);
  return noiseTile;
}
