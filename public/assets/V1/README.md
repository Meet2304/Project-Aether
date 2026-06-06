# Aether — Carve logo & icon assets

The **Carve** mark for Project Aether (skateboard trick classifier). Black on white, scalable, PWA-ready.

## Files

| File                                   | Use                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `aether-mark.svg`                      | The mark alone, transparent background (`stroke: #0a0a0a`). Use in headers, splash, anywhere you need just the symbol. |
| `aether-icon.svg`                      | Full app icon — white square + mark. Source of truth for the PNGs.                                                     |
| `favicon.svg`                          | Rounded-tile favicon (modern browsers).                                                                                |
| `maskable-icon.svg`                    | Maskable source with extra safe-zone padding.                                                                          |
| `favicon.ico`                          | Legacy favicon (16 + 32 px).                                                                                           |
| `favicon-16/32/48.png`                 | PNG favicon fallbacks.                                                                                                 |
| `apple-touch-icon.png`                 | 180×180, iOS home screen (iOS applies its own corner mask).                                                            |
| `icon-192.png`, `icon-512.png`         | PWA icons, `purpose: any`.                                                                                             |
| `maskable-192.png`, `maskable-512.png` | PWA icons, `purpose: maskable`.                                                                                        |
| `site.webmanifest`                     | Web app manifest referencing the icons above.                                                                          |

## Drop-in `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#0a0a0a" />
```

## Mark spec

- Geometry: `viewBox="0 0 100 100"`, deck rotated `-24°` about center, `stroke-width: 6`, round caps/joins.
- Foreground `#0a0a0a`, background `#ffffff`. Strictly black & white.
- To recolor, change the `stroke` on the `<g>` in `aether-mark.svg`. For a dark/inverted lockup use `stroke: #ffffff` on a `#0a0a0a` ground.
- Safe area: keep ~16% clear space around the mark (the `aether-icon.svg` padding).

Regenerate the PNGs from the SVG sources at any time — they are the master.
