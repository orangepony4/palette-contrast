(function () {
    'use strict';

    const paletteLimit = 12;
    const sharePrefix = '#pc1=';
    const shareHashLimit = sharePrefix.length + 8 + (paletteLimit + 1) * 7;

    function parseHex(value, { allowAlpha = true } = {}) {
        if (typeof value !== 'string') return null;
        const match = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
        if (!match) return null;

        let digits = match[1].toUpperCase();
        if (digits.length < 5) digits = digits.replace(/./g, digit => digit + digit);
        const hasAlpha = digits.length === 8;
        if (hasAlpha && !allowAlpha) return null;

        return {
            hex: '#' + digits,
            r: Number.parseInt(digits.slice(0, 2), 16),
            g: Number.parseInt(digits.slice(2, 4), 16),
            b: Number.parseInt(digits.slice(4, 6), 16),
            a: hasAlpha ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
        };
    }

    function linearChannel(value) {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    }

    function luminance({ r, g, b }) {
        return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
    }

    function opaqueLuminance(background) {
        if (background?.a !== 1) throw new TypeError('Expected an opaque background color.');
        return luminance(background);
    }

    function evaluateContrast(foreground, background) {
        const back = opaqueLuminance(background);
        const { r, g, b, a } = foreground;
        const remaining = 1 - a;
        // Composite the sRGB channels before converting them to linear light.
        const front = luminance({
            r: r * a + background.r * remaining,
            g: g * a + background.g * remaining,
            b: b * a + background.b * remaining,
        });
        const ratio = (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
        return {
            ratio,
            normalAA: ratio >= 4.5,
            largeAA: ratio >= 3,
            normalAAA: ratio >= 7,
            largeAAA: ratio >= 4.5,
        };
    }

    function bestForeground(background) {
        const adjusted = opaqueLuminance(background) + 0.05;
        const blackRatio = adjusted / 0.05;
        const whiteRatio = 1.05 / adjusted;
        return blackRatio >= whiteRatio ? '#000000' : '#FFFFFF';
    }

    function blendForeground({ r, g, b, a }, target, step) {
        const mix = channel => Math.round((channel * (255 - step) + target * step) / 255);
        return { r: mix(r), g: mix(g), b: mix(b), a };
    }

    function adjustForeground(foreground, background, minimum) {
        if (![3, 4.5, 7].includes(minimum)) {
            throw new RangeError('Minimum contrast must be 3, 4.5, or 7.');
        }
        const original = evaluateContrast(foreground, background);
        if (original.ratio >= minimum) return { hex: foreground.hex, ratio: original.ratio };

        // Test both paths at the same quantized distance before moving farther.
        for (let step = 1; step <= 255; step++) {
            const black = blendForeground(foreground, 0, step);
            const white = blendForeground(foreground, 255, step);
            const blackRatio = evaluateContrast(black, background).ratio;
            const whiteRatio = evaluateContrast(white, background).ratio;
            if (blackRatio < minimum && whiteRatio < minimum) continue;

            const { r, g, b } = blackRatio >= whiteRatio ? black : white;
            const rgb = [r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
            return { hex: '#' + rgb + foreground.hex.slice(7), ratio: Math.max(blackRatio, whiteRatio) };
        }
        return null;
    }

    function parsePalette(text) {
        const colors = new Set();
        const invalid = [];
        let overflow = false;
        const tokens = typeof text === 'string' ? text.match(/[^\s,;]+/g) ?? [] : [];
        for (const token of tokens) {
            const color = parseHex(token, { allowAlpha: false });
            if (!color) {
                invalid.push(token);
            } else if (!colors.has(color.hex)) {
                if (colors.size === paletteLimit) {
                    overflow = true;
                } else {
                    colors.add(color.hex);
                }
            }
        }
        return { colors: [...colors], invalid, overflow };
    }

    function normalizeShareState(state) {
        if (!Array.isArray(state?.palette) || state.palette.length < 2 || state.palette.length > paletteLimit) {
            return null;
        }
        const foreground = parseHex(state.foreground);
        const background = parseHex(state.background, { allowAlpha: false });
        if (!foreground || !background) return null;

        const palette = new Set();
        for (const token of state.palette) {
            const color = parseHex(token, { allowAlpha: false });
            if (!color || palette.has(color.hex)) return null;
            palette.add(color.hex);
        }
        return { foreground: foreground.hex, background: background.hex, palette: [...palette] };
    }

    function encodeShareState(state) {
        const colors = normalizeShareState(state);
        if (!colors) return null;
        return sharePrefix + [colors.foreground, colors.background, ...colors.palette]
            .map(hex => hex.slice(1))
            .join(',');
    }

    function decodeShareState(hash) {
        if (typeof hash !== 'string' || hash.length > shareHashLimit || !hash.startsWith(sharePrefix)) {
            return null;
        }
        const colors = hash.slice(sharePrefix.length);
        // Compare the entire match because $ also matches before a final newline.
        if (/^[0-9a-f]{6}(?:[0-9a-f]{2})?(?:,[0-9a-f]{6})+$/i.exec(colors)?.[0] !== colors) {
            return null;
        }
        const [foreground, background, ...palette] = colors.split(',');
        return normalizeShareState({ foreground, background, palette });
    }

    const api = {
        parseHex, evaluateContrast, bestForeground, adjustForeground, parsePalette, encodeShareState, decodeShareState,
    };
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        globalThis.PaletteContrast = api;
    }
})();
