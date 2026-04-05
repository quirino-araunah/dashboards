# Legacy TV Dashboards — ARCHIVED 2026-04-04

These static HTML files are **archived** and no longer in active use.

## Files

| File | Size | Description |
|------|------|-------------|
| Painel_AGRO_TV.html | 91KB | Static pre-rendered AGRO dashboard |
| Painel_AGUA_TV.html | 192KB | Static pre-rendered AGUA dashboard |
| Painel_Executivo_TV.html | 314KB | Static pre-rendered Executivo dashboard |
| Painel_TV_Vendas.html | 260KB | Static pre-rendered Vendas dashboard |

## Why archived

These were the original static TV dashboards with hardcoded/pre-rendered data.
They have been **superseded** by the dynamic versions in the parent directory:

- `agro.html` — dynamic, uses cockpit-blocks.js + Supabase live data
- `agua.html` — dynamic, uses cockpit-blocks.js + Supabase live data
- `executivo.html` — dynamic, uses cockpit-blocks.js + Supabase live data
- `vendas.html` — dynamic, uses cockpit-blocks.js + Supabase live data

The dynamic versions fetch real-time data from Supabase and share a unified design system.

## Note

These files are kept for reference only. Do not serve them in production.
