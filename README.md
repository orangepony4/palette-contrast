# Palette Contrast

[![Tests](https://github.com/orangepony4/palette-contrast/actions/workflows/test.yml/badge.svg)](https://github.com/orangepony4/palette-contrast/actions/workflows/test.yml)

Check text and background colors, then compare an entire palette before using it in an interface. Palette Contrast runs in the browser with no runtime dependencies.

## Use the tool

[Open Palette Contrast](https://orangepony4.github.io/palette-contrast/) or open `index.html` from a downloaded or cloned copy. Enter text and background colors in hex or use the native color pickers. The preview and contrast checks update as you type.

- The text color accepts `#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`. A translucent text color is composited over the selected opaque background.
- Paste two to twelve different opaque colors, separated by spaces, newlines, commas, or semicolons, to build a palette matrix. Rows are text colors and columns are backgrounds.
- Select a cell to apply the pair. In the matrix, use the arrow keys to move, Home and End to reach row edges, and Enter or Space to apply.
- Try black or white text, swap opaque colors, or copy the selected pair as CSS.
- Use **Copy share link** to share the current pair and built matrix. The colors are stored in the URL fragment and the app makes no network request when you copy the link.

## How the checks work

The app uses the WCAG 2.2 sRGB relative-luminance formula and compares the full-precision ratio with the threshold. It rounds down only for display.

| Text size | AA | AAA |
| --- | --- | --- |
| Normal | 4.5:1 | 7:1 |
| Large | 3:1 | 4.5:1 |

Large text is at least 18 points at regular weight or 14 points in bold. These checks cover solid sRGB color pairs. Actual legibility also depends on the font, size, and rendering. [WCAG 2.2 text contrast](https://www.w3.org/TR/WCAG22/#contrast-minimum)

## Development

Run `npm test` with Node.js 20 or newer. The test suite covers hex parsing, luminance, alpha compositing, unrounded threshold decisions, palette parsing, and share links.

Released under the [MIT License](LICENSE).
