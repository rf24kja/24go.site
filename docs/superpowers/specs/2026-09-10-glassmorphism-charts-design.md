# Glassmorphism 3D Charts Design

## Goal
Replace flat Recharts with animated glassmorphism 3D chart components. Modern SaaS look with translucent fills, depth, shadows, and smooth animations.

## Approach
Extend Recharts with custom SVG shape components. No new dependencies.

## Visual Style
- Translucent gradient fills (opacity 0.3-0.6)
- 3D depth via offset shadow paths
- CSS perspective tilt on containers
- SVG drop-shadow glow filters
- Animated entry (grow/draw-in)
- Hover: lift + glow + glass tooltip

## Files
- `src/components/GlassChart.tsx` — reusable glass chart wrappers
- `src/app/(dashboard)/analytics/page.tsx` — 5 charts updated
- `src/app/(dashboard)/campaigns/page.tsx` — 1 chart updated
- `src/app/globals.css` — glassmorphism CSS variables + animations

## Charts (6 total)
1. Activity Over Time (AreaChart) — gradient area + glow
2. Conversion Funnel (BarChart) — 3D bars with depth
3. Intent Distribution (PieChart) — 3D pie with extrusion
4. Leads by Source (BarChart) — 3D grouped bars
5. Geo Breakdown (BarChart) — 3D horizontal bars
6. Posts Last 7 Days (BarChart) — 3D bars with depth
