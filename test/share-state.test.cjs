const assert = require('node:assert/strict');
const { test } = require('node:test');
const { decodeShareState, encodeShareState } = require('../contrast.js');

const state = { foreground: '#1234', background: '#f5f', palette: ['abc', '#123456'] };
const hash = '#pc1=11223344,FF55FF,AABBCC,123456';
const normalized = { foreground: '#11223344', background: '#FF55FF', palette: ['#AABBCC', '#123456'] };

test('encodes canonical colors and round-trips local and web URL fragments', () => {
    assert.equal(encodeShareState(state), hash);
    for (const base of ['file:///work/palette-contrast/index.html', 'https://example.test/palette-contrast/?demo=1']) {
        const link = new URL(base);
        link.hash = hash;
        assert.equal(link.hash, hash);
        assert.deepEqual(decodeShareState(link.hash), normalized);
    }
    assert.deepEqual(decodeShareState(hash.toLowerCase()), normalized);
    assert.equal(encodeShareState(decodeShareState(hash.toLowerCase())), hash);
});

test('allows exactly twelve palette colors and rejects invalid state when encoding', () => {
    const palette = Array.from({ length: 12 }, (_, index) => '#' + index.toString(16).padStart(6, '0').toUpperCase());
    const fullState = { foreground: '#12345600', background: '#FFFFFF', palette };
    const fullHash = encodeShareState(fullState);
    assert.equal(fullHash.length, 104);
    assert.deepEqual(decodeShareState(fullHash), fullState);
    for (const candidate of [
        null, {}, { ...state, foreground: 'red' }, { ...state, background: '#ffff' },
        { ...state, palette: ['abc'] }, { ...state, palette: ['abc', '#AABBCC'] },
        { ...state, palette: ['abc', '#000f'] }, { ...state, palette: [...palette, '#FFFFFF'] },
    ]) {
        assert.equal(encodeShareState(candidate), null);
    }
});

test('ignores malformed, unsupported, duplicate, and oversized fragments', () => {
    for (const invalid of [
        null, '', '#', hash.slice(1), hash.replace('pc1', 'pc2'), hash.replace('pc1', 'PC1'),
        hash.replace('11223344', '1234'), hash.replace('FF55FF', 'FF55FFFF'),
        hash.replace('AABBCC', 'AABBCCFF'), hash.replace('123456', 'aabbcc'), hash.slice(0, -7),
        hash + ',', hash + '\n', ' ' + hash, hash.replace(',', '%2C'), '#pc1=' + 'F'.repeat(10000),
    ]) {
        assert.equal(decodeShareState(invalid), null);
    }
});
