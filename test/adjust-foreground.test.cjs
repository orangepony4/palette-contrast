const assert = require('node:assert/strict');
const { test } = require('node:test');
const { adjustForeground, evaluateContrast, parseHex } = require('../contrast.js');

function oracle(foreground, background, minimum) {
    const candidates = [];
    for (const target of [0, 255]) {
        for (let step = 0; step <= 255; step++) {
            const rgb = [foreground.r, foreground.g, foreground.b].map(channel =>
                Math.floor((255 * channel + step * (target - channel) + 127) / 255)
                    .toString(16).padStart(2, '0')).join('');
            const candidate = parseHex('#' + rgb + foreground.hex.slice(7));
            const { ratio } = evaluateContrast(candidate, background);
            if (ratio >= minimum) {
                candidates.push({ target, step, hex: candidate.hex, ratio });
                break;
            }
        }
    }
    candidates.sort((a, b) => a.step - b.step || b.ratio - a.ratio || a.target - b.target);
    if (!candidates.length) return null;
    const [{ hex, ratio }] = candidates;
    return { hex, ratio };
}

test('keeps passing colors and preserves alpha on the nearest passing adjustment', () => {
    const white = parseHex('#FFF');
    const passing = Object.freeze(parseHex('#222F'));
    assert.deepEqual(adjustForeground(passing, white, 7), {
        hex: '#222222FF', ratio: evaluateContrast(passing, white).ratio,
    });
    assert.equal(adjustForeground(parseHex('#777'), white, 4.5).hex, '#767676');
    assert.equal(adjustForeground(parseHex('#777F'), white, 4.5).hex, '#767676FF');
    assert.equal(adjustForeground(parseHex('#333333CC'), parseHex('#222'), 4.5).hex, '#A2A2A2CC');

    const borderline = parseHex('#6E7978');
    assert.equal(evaluateContrast(borderline, white).ratio.toFixed(2), '4.50');
    const adjustment = adjustForeground(borderline, white, 4.5);
    assert.notEqual(adjustment.hex, borderline.hex);
    assert.ok(adjustment.ratio >= 4.5);
});

test('uses the higher ratio when both paths first pass at the same step', () => {
    const foreground = parseHex('#D74018DB');
    const background = parseHex('#DB011E');
    const black = evaluateContrast(parseHex('#310F05DB'), background).ratio;
    const white = evaluateContrast(parseHex('#F6D4CADB'), background).ratio;
    assert.ok(white > black && black >= 3);
    assert.deepEqual(adjustForeground(foreground, background, 3), { hex: '#F6D4CADB', ratio: white });
    assert.deepEqual(adjustForeground(foreground, background, 3), oracle(foreground, background, 3));
});

test('matches independent enumeration and returns null when no path passes', () => {
    for (const foreground of ['#abcdef', '#D74018DB', '#1234', '#00000000', '#55B91280', '#818181FF']) {
        for (const background of ['#fff', '#777', '#DB011E', '#38178A']) {
            for (const minimum of [3, 4.5, 7]) {
                const front = parseHex(foreground);
                const back = parseHex(background);
                assert.deepEqual(adjustForeground(front, back, minimum), oracle(front, back, minimum));
            }
        }
    }
    assert.equal(adjustForeground(parseHex('#888'), parseHex('#777'), 7), null);
    assert.equal(adjustForeground(parseHex('#0000'), parseHex('#FFF'), 3), null);
    assert.throws(() => adjustForeground(parseHex('#000'), parseHex('#FFF'), 2), RangeError);
    assert.throws(() => adjustForeground(parseHex('#000'), parseHex('#FFF8'), 3), /opaque/);
});
