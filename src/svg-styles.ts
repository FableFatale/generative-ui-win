/**
 * SVG-specific CSS styles for generative UI widgets.
 * Dark theme with CSS custom properties for colors.
 */
export const SVG_STYLES = `
/* ── Base Reset ── */
svg {
  font-family: 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --bg: #1a1a1a;
  --fg: #e0e0e0;
  --fg-dim: #888;
  --accent: #7c6fe0;
  --border: #333;
}

/* ── Text Classes ── */
.t {
  fill: var(--fg);
  font-size: 14px;
  font-weight: 400;
}
.ts {
  fill: var(--fg-dim);
  font-size: 12px;
  font-weight: 400;
}
.th {
  fill: var(--fg);
  font-size: 18px;
  font-weight: 600;
}
.tl {
  fill: var(--fg);
  font-size: 24px;
  font-weight: 700;
}
.tc {
  text-anchor: middle;
}
.tr {
  text-anchor: end;
}

/* ── Color Palette ── */
.c-purple { fill: #7c6fe0; stroke: #7c6fe0; }
.c-teal   { fill: #4ecdc4; stroke: #4ecdc4; }
.c-coral  { fill: #ff6b6b; stroke: #ff6b6b; }
.c-gold   { fill: #ffd93d; stroke: #ffd93d; }
.c-blue   { fill: #4a90d9; stroke: #4a90d9; }
.c-green  { fill: #6bcb77; stroke: #6bcb77; }
.c-orange { fill: #ff9f43; stroke: #ff9f43; }
.c-pink   { fill: #ee5a9f; stroke: #ee5a9f; }
.c-cyan   { fill: #00d2d3; stroke: #00d2d3; }
.c-red    { fill: #ee5253; stroke: #ee5253; }

/* ── Fills (no stroke) ── */
.f-purple { fill: #7c6fe0; }
.f-teal   { fill: #4ecdc4; }
.f-coral  { fill: #ff6b6b; }
.f-gold   { fill: #ffd93d; }
.f-blue   { fill: #4a90d9; }
.f-green  { fill: #6bcb77; }
.f-orange { fill: #ff9f43; }
.f-pink   { fill: #ee5a9f; }

/* ── Strokes (no fill) ── */
.s-purple { stroke: #7c6fe0; fill: none; }
.s-teal   { stroke: #4ecdc4; fill: none; }
.s-coral  { stroke: #ff6b6b; fill: none; }
.s-gold   { stroke: #ffd93d; fill: none; }
.s-blue   { stroke: #4a90d9; fill: none; }
.s-green  { stroke: #6bcb77; fill: none; }

/* ── Background Fills ── */
.bg-dark    { fill: #1a1a1a; }
.bg-card    { fill: #242424; }
.bg-surface { fill: #2a2a2a; }
.bg-hover   { fill: #333333; }

/* ── Stroke Utilities ── */
.stroke-border { stroke: #333; fill: none; }
.stroke-thin   { stroke-width: 1; }
.stroke-medium { stroke-width: 2; }
.stroke-thick  { stroke-width: 3; }

/* ── Opacity ── */
.o-80 { opacity: 0.8; }
.o-60 { opacity: 0.6; }
.o-40 { opacity: 0.4; }
.o-20 { opacity: 0.2; }

/* ── Rounded Rectangles ── */
.rounded { rx: 8; ry: 8; }
.rounded-sm { rx: 4; ry: 4; }
.rounded-lg { rx: 12; ry: 12; }
.rounded-full { rx: 50%; ry: 50%; }

/* ── Animations ── */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade { animation: fadeIn 0.3s ease-out; }
.animate-slide { animation: slideUp 0.4s ease-out; }
`;
