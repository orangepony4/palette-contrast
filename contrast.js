(function () {
    'use strict';

    const paletteLimit = 12;

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

    const api = { parseHex, evaluateContrast, bestForeground, parsePalette };
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        globalThis.PaletteContrast = api;
    }
})();
