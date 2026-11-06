const assert = require('node:assert/strict');
const { test } = require('node:test');
const { bestForeground, evaluateContrast, parseHex, parsePalette } = require('../contrast.js');

function near(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-12, `Expected ${expected}, got ${actual}`);
}

test('normalizes opaque hex with optional hash, case, and outer whitespace', () => {
    assert.deepEqual(parseHex('  AbC \n'), { hex: '#AABBCC', r: 170, g: 187, b: 204, a: 1 });
    assert.deepEqual(parseHex('#0102aB', { allowAlpha: false }), {
        hex: '#0102AB', r: 1, g: 2, b: 171, a: 1,
    });
});

test('expands alpha shorthand and keeps explicit alpha digits', () => {
    assert.deepEqual(parseHex('#aBcD'), {
        hex: '#AABBCCDD', r: 170, g: 187, b: 204, a: 221 / 255,
    });
    assert.deepEqual(parseHex('0102aB80'), {
        hex: '#0102AB80', r: 1, g: 2, b: 171, a: 128 / 255,
    });
    assert.equal(parseHex('#112233FF').hex, '#112233FF');
    assert.equal(parseHex('#abcf', { allowAlpha: false }), null);
    assert.equal(parseHex('#112233FF', { allowAlpha: false }), null);
});

test('rejects malformed or non-string colors', () => {
    for (const value of ['', '  ', '#', '#12', '#12345', '#1234567', '#123456789', '##fff',
        '#12x', '#a b c', '0xfff', 'red', 'rgb(1, 2, 3)', 123, null, undefined]) {
        assert.equal(parseHex(value), null, String(value));
    }
});

test('computes WCAG sRGB ratios for black, white, and a weighted primary color', () => {
    const white = parseHex('#FFF');
    const black = parseHex('#000');
    assert.deepEqual(evaluateContrast(black, white), {
        ratio: 21, normalAA: true, largeAA: true, normalAAA: true, largeAAA: true,
    });
    assert.equal(evaluateContrast(white, black).ratio, 21);
    assert.deepEqual(evaluateContrast(white, white), {
        ratio: 1, normalAA: false, largeAA: false, normalAAA: false, largeAAA: false,
    });
    const red = evaluateContrast(parseHex('#F00'), white);
    near(red.ratio, 1.05 / (0.2126 + 0.05));
    assert.equal(red.largeAA, true);
    assert.equal(red.normalAA, false);
});

test('uses unrounded ratios at the AA and AAA text thresholds', () => {
    const white = parseHex('#FFF');
    const justBelowAA = evaluateContrast(parseHex('#6C7B67'), white);
    near(justBelowAA.ratio, 4.499999580906361);
    assert.equal(justBelowAA.ratio.toFixed(2), '4.50');
    assert.equal(justBelowAA.normalAA, false);
    assert.equal(justBelowAA.largeAAA, false);
    assert.equal(justBelowAA.largeAA, true);

    const justAboveAA = evaluateContrast(parseHex('#767676'), white);
    assert.equal(justAboveAA.normalAA, true);
    assert.equal(justAboveAA.largeAAA, true);
    assert.equal(justAboveAA.normalAAA, false);

    const justBelowLargeAA = evaluateContrast(parseHex('#959595'), white);
    assert.equal(justBelowLargeAA.ratio.toFixed(2), '3.00');
    assert.equal(justBelowLargeAA.largeAA, false);
    assert.equal(evaluateContrast(parseHex('#949494'), white).largeAA, true);
    assert.equal(evaluateContrast(parseHex('#595959'), white).normalAAA, true);
    assert.equal(evaluateContrast(parseHex('#5A5A5A'), white).normalAAA, false);
});

test('composites alpha in sRGB before evaluating luminance without rounding channels', () => {
    const white = parseHex('#FFF');
    const halfBlack = evaluateContrast(parseHex('#00000080'), white);
    near(halfBlack.ratio, evaluateContrast(parseHex('#7F7F7F'), white).ratio);
    near(halfBlack.ratio, 4.0041069566148515);

    const background = parseHex('#F0E0D0');
    near(evaluateContrast(parseHex('#12345680'), background).ratio, 2.730082495137081);
    assert.equal(evaluateContrast(parseHex('#F000'), background).ratio, 1);
    assert.equal(evaluateContrast(parseHex('#000000FF'), white).ratio, 21);
    assert.throws(() => evaluateContrast(white, parseHex('#0008')), /opaque background/i);
});

test('picks the higher-contrast black or white foreground', () => {
    assert.equal(bestForeground(parseHex('#000')), '#FFFFFF');
    assert.equal(bestForeground(parseHex('#FFF')), '#000000');
    assert.equal(bestForeground(parseHex('#757575')), '#FFFFFF');
    assert.equal(bestForeground(parseHex('#767676')), '#000000');
    assert.throws(() => bestForeground(parseHex('#0000')), /opaque background/i);
});

test('parses opaque palette tokens in order and deduplicates normalized colors', () => {
    assert.deepEqual(parsePalette('abc, #123456; ABC \n #FFFFFF \t #ffF nope #abcf #123456FF nope'), {
        colors: ['#AABBCC', '#123456', '#FFFFFF'],
        invalid: ['nope', '#abcf', '#123456FF', 'nope'],
        overflow: false,
    });
    assert.deepEqual(parsePalette(' , ; \n '), { colors: [], invalid: [], overflow: false });
});

test('limits palettes to the first twelve unique opaque colors', () => {
    const unique = Array.from({ length: 13 }, (_, index) =>
        '#' + index.toString(16).toUpperCase().padStart(6, '0')
    );
    const firstTwelve = unique.slice(0, 12);
    assert.deepEqual(parsePalette([...firstTwelve, '#000', '00000b'].join(' ')), {
        colors: firstTwelve, invalid: [], overflow: false,
    });
    assert.deepEqual(parsePalette([...unique, 'nope', '#000'].join(';')), {
        colors: firstTwelve, invalid: ['nope'], overflow: true,
    });
});
