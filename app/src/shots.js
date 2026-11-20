// Fixed scenes for screenshots: ?shot=editor shows the page with sample
// photos loaded; ?shot=cover shows the cover alone, full bleed.
// Query knobs: photo=pier,boulevard (comma list of samples), caption,
// subtitle, ribbon, layout, grade, aspect, heat, and pan=zoom,ox,oy per
// panel slot, slots separated by ';' (e.g. pan=1,0,0.14;1,0,0;1,0,0;1,0,0.8
// lifts the hero photo so a hat clears the ribbon and drops a portrait
// photo in a short panel until its face is whole). window.__shotReady is
// set once the fonts are in and the scene has painted.
export async function runShot(shot, query, apply) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const scene = {
    aspect: query.get('aspect') || (shot === 'cover' ? 'landscape' : 'landscape'),
    layout: query.get('layout') || 'hero3',
    grade: query.get('grade') || 'sunset',
    caption: query.get('caption') || 'Sunset Heist',
    subtitle: query.get('subtitle') || 'Neon Nights',
    ribbon: query.get('ribbon') || 'Wanted',
    heat: Number(query.get('heat') ?? 4),
    photos: (query.get('photo') || 'pier').split(',').map((s) => s.trim()).filter(Boolean),
    panels: (query.get('pan') || '').split(';').map((s) => {
      if (!s.trim()) return null;
      const [zoom, ox, oy] = s.split(',').map(Number);
      if ([zoom, ox, oy].some((v) => !Number.isFinite(v))) return null;
      return { zoom, ox, oy };
    }),
  };
  await apply(scene);
  try { await document.fonts.ready; } catch { /* fonts are local; a miss still renders */ }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
