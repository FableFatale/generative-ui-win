import { SVG_STYLES } from "./svg-styles";

// ── Module section definitions ──

const MODULE_SECTIONS: Record<string, string> = {
  art: `
## Generative Art Module

Create visually striking generative art using SVG. Guidelines:

- Use the full SVG canvas (default 800×600, configurable)
- Layer shapes with varying opacity for depth
- Apply the color palette classes: c-purple, c-teal, c-coral, c-gold, c-blue, c-green
- Use transforms (rotate, scale, translate) for organic patterns
- Add subtle animations with CSS @keyframes when appropriate
- Prefer procedural/algorithmic patterns over static compositions
- Use gradients (linearGradient, radialGradient) for rich fills
- Keep stroke-width proportional to canvas size
- Group related elements with <g> for clean structure
- Consider symmetry, repetition, and golden ratio for aesthetic compositions

### Pattern Techniques
- Tessellations: repeat a tile across the canvas
- L-systems: recursive branching structures
- Noise fields: Perlin-like displacement on grid points
- Particle systems: many small elements with randomized properties
- Spirographs: overlapping circles with parametric equations
`,

  mockup: `
## UI Mockup Module

Create high-fidelity dark-themed UI mockups using SVG. Guidelines:

- Background: #1a1a1a (use .bg-dark class)
- Card surfaces: #242424 (use .bg-card class)
- Border color: #333 (use .stroke-border class)
- Text: #e0e0e0 primary, #888 secondary
- Use rounded rectangles (rx=8) for cards and buttons
- Standard spacing: 16px padding, 12px gaps
- Font hierarchy: 24px titles (.tl), 18px headings (.th), 14px body (.t), 12px caption (.ts)
- Interactive elements: show hover states with .bg-hover fill
- Use the accent color (#7c6fe0 / .c-purple) for primary actions
- Include realistic placeholder content, not "Lorem ipsum"

### Common Components
- Cards: rounded rect with .bg-card, 1px .stroke-border, 16px internal padding
- Buttons: rounded rect (rx=6), 36px height, centered text
- Input fields: rounded rect, .bg-surface fill, .stroke-border
- Navigation: horizontal bar at top, 56px height
- Lists: vertical stack with 1px separator lines
- Avatars: circles with colored fills or image placeholders
`,

  interactive: `
## Interactive Widget Module

Create interactive HTML widgets with JavaScript event handling. Guidelines:

- Use vanilla JavaScript (no frameworks required, but CDN libs are OK)
- All state should be self-contained within the widget
- Use \`window.widget.send(data)\` to communicate results back
- Respond to click, input, change, keydown events as needed
- Apply the dark theme: bg #1a1a1a, text #e0e0e0, accent #7c6fe0
- Use CSS transitions for smooth state changes
- Debounce rapid user inputs (100-200ms)
- Include clear visual feedback for all interactions
- Make widgets keyboard-accessible where practical
- Prefer CSS Grid/Flexbox for layout

### Communication Pattern
\`\`\`javascript
// Send data back to the host application
window.widget.send({ type: "result", value: selectedOption });

// The host receives this via the WindowHandle 'message' event
\`\`\`

### CDN Libraries (recommended)
- Chart.js: https://cdn.jsdelivr.net/npm/chart.js
- D3.js: https://cdn.jsdelivr.net/npm/d3@7
- Three.js: https://cdn.jsdelivr.net/npm/three@0.160
- Anime.js: https://cdn.jsdelivr.net/npm/animejs@3
`,

  chart: `
## Chart & Data Visualization Module

Create data visualizations using SVG or Chart.js. Guidelines:

### SVG Charts
- Use the SVG color classes for data series: c-purple, c-teal, c-coral, c-gold, c-blue, c-green
- Include axis labels (.ts class), title (.th class), and legend
- Add gridlines with low opacity (.o-20) for readability
- Bar charts: 2px gap between bars, rounded top corners (rx=2)
- Line charts: stroke-width 2-3, optional fill below with .o-20 opacity
- Pie/donut charts: use stroke for segment borders
- Responsive: use viewBox, not fixed width/height

### Chart.js (via CDN)
- Load from: https://cdn.jsdelivr.net/npm/chart.js
- Use dark theme defaults:
  \`\`\`javascript
  Chart.defaults.color = '#e0e0e0';
  Chart.defaults.borderColor = '#333';
  \`\`\`
- Canvas element with explicit width/height
- Call chart.destroy() before creating a new chart on same canvas
- Use the color palette: ['#7c6fe0','#4ecdc4','#ff6b6b','#ffd93d','#4a90d9','#6bcb77']

### Data Guidelines
- Always label axes and include units
- Use appropriate chart type for the data (bar for comparison, line for trends, pie for composition)
- Limit pie/donut to 6-8 segments maximum
- Include tooltips or hover states for Chart.js charts
- Show data values directly on SVG charts when space permits
`,

  diagram: `
## Diagram & Flowchart Module

Create diagrams, flowcharts, and architectural drawings using SVG. Guidelines:

- Use rounded rectangles for process nodes (.bg-card, .stroke-border, rx=8)
- Diamond shapes for decision points
- Arrows with marker-end for flow direction
- Color-code node types using the palette classes
- Maintain consistent node sizes within a diagram
- Use orthogonal (right-angle) connectors for clean routing
- Label all connections and nodes clearly
- Standard node sizes: 160×60 for process, 80×80 for decision
- Minimum 40px spacing between nodes
- Flow direction: top-to-bottom or left-to-right

### Arrow Markers
\`\`\`svg
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
    markerWidth="6" markerHeight="6" orient="auto">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/>
  </marker>
</defs>
<line x1="0" y1="0" x2="100" y2="0" stroke="#888" marker-end="url(#arrow)"/>
\`\`\`

### Layout Algorithms
- Tree layout: recursive positioning with equal horizontal spacing
- Flowchart: swimlane-based vertical layout
- Network/graph: force-directed or manual placement
- Sequence diagram: vertical timeline with horizontal messages
`,
};

// ── Base guidelines (always included) ──

const BASE_GUIDELINES = `
# Generative UI Design Guidelines

## Overview
You are generating visual UI content that will be rendered in a widget window.
The output should be either **SVG markup** or **HTML** (with optional JavaScript).

## General Principles
1. **Dark Theme First**: Always design for dark backgrounds (#1a1a1a)
2. **Semantic Markup**: Use meaningful class names from the provided style system
3. **Progressive Enhancement**: Start with static content, add interactivity as needed
4. **Performance**: Minimize DOM nodes, prefer CSS over JS for visual effects
5. **Accessibility**: Use proper contrast ratios (minimum 4.5:1 for text)

## Color System
| Name   | Hex     | Class    | Usage              |
|--------|---------|----------|--------------------|
| Purple | #7c6fe0 | c-purple | Primary / Accent   |
| Teal   | #4ecdc4 | c-teal   | Secondary / Success |
| Coral  | #ff6b6b | c-coral  | Warning / Error    |
| Gold   | #ffd93d | c-gold   | Highlight / Star   |
| Blue   | #4a90d9 | c-blue   | Info / Link        |
| Green  | #6bcb77 | c-green  | Positive / Growth  |
| Orange | #ff9f43 | c-orange | Alert / Pending    |
| Pink   | #ee5a9f | c-pink   | Accent / Creative  |

## Typography
- Title: 24px, weight 700 (.tl class in SVG)
- Heading: 18px, weight 600 (.th class in SVG)
- Body: 14px, weight 400 (.t class in SVG)
- Caption: 12px, weight 400 (.ts class in SVG)
- Font stack: 'SF Pro Display', 'Segoe UI', system-ui, sans-serif

## SVG Best Practices
- Always include a viewBox attribute
- Use the provided SVG_STYLES (injected automatically into \`<style>\`)
- Group related elements with \`<g>\` tags
- Use \`<defs>\` for reusable elements (gradients, markers, patterns)
- Prefer transforms over absolute positioning

## HTML Best Practices
- Use inline \`<style>\` tags (external stylesheets won't load reliably)
- Load CDN libraries via \`<script src="...">\` tags
- Use \`window.widget.send(data)\` for bidirectional communication
- Wrap initialization in DOMContentLoaded or place scripts at end of body

## Streaming / Incremental Updates
Content may be delivered incrementally (streaming). Design so that partial
content is still visually coherent:
- Place structural elements (titles, containers) first
- Fill in data progressively
- Avoid layouts that "jump" when new content arrives
- morphdom will efficiently diff and patch the DOM

## SVG Styles Reference
The following CSS classes are available in all SVG widgets:
${SVG_STYLES}
`;

// ── Public API ──

export type GuidelineModule = "art" | "mockup" | "interactive" | "chart" | "diagram";

/**
 * Get the design guidelines text, optionally including specific modules.
 * If no modules are specified, only the base guidelines are returned.
 */
export function getGuidelines(modules?: GuidelineModule[]): string {
  let text = BASE_GUIDELINES;

  if (modules && modules.length > 0) {
    for (const mod of modules) {
      const section = MODULE_SECTIONS[mod];
      if (section) {
        text += "\n" + section;
      }
    }
  }

  return text;
}

/**
 * Get all available module names.
 */
export function getAvailableModules(): GuidelineModule[] {
  return Object.keys(MODULE_SECTIONS) as GuidelineModule[];
}
