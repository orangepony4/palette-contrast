(() => {
    'use strict';

    const {
        parseHex, evaluateContrast, bestForeground, parsePalette,
        encodeShareState, decodeShareState, adjustForeground,
    } = globalThis.PaletteContrast;
    const byId = id => document.getElementById(id);
    const foregroundHex = byId('foregroundHex');
    const backgroundHex = byId('backgroundHex');
    const foregroundPicker = byId('foregroundPicker');
    const backgroundPicker = byId('backgroundPicker');
    const pairError = byId('pairError');
    const preview = byId('preview');
    const ratioValue = byId('ratioValue');
    const bestText = byId('bestText');
    const bestTextHint = byId('bestTextHint');
    const swapPair = byId('swapPair');
    const copyCss = byId('copyCss');
    const cssOutput = byId('cssOutput');
    const cssStatus = byId('cssStatus');
    const actionStatus = byId('actionStatus');
    const adjustMinimum = byId('adjustMinimum');
    const adjustText = byId('adjustText');
    const adjustStatus = byId('adjustStatus');
    const paletteInput = byId('paletteInput');
    const paletteError = byId('paletteError');
    const matrixRegion = byId('matrixRegion');
    const matrixTable = byId('matrixTable');
    const selectedPair = byId('selectedPair');
    const copyShare = byId('copyShare');
    const shareFallback = byId('shareFallback');
    const shareOutput = byId('shareOutput');
    const shareStatus = byId('shareStatus');
    const criteria = [
        ['normalAA', byId('statusNormalAA')],
        ['largeAA', byId('statusLargeAA')],
        ['normalAAA', byId('statusNormalAAA')],
        ['largeAAA', byId('statusLargeAAA')],
    ];

    let foreground;
    let background;
    let matrixColors = [];
    let matrixButtons = [];
    let matrixTabStop = null;
    let cssAttempt;
    let shareAttempt;

    function ratioLabel(ratio) {
        // Round down for display so a value below a threshold never looks like a pass.
        return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
    }

    function setStatus(element, pass) {
        element.textContent = pass ? 'Pass' : 'Fail';
        element.dataset.pass = String(pass);
    }

    function refreshMatrixSelection() {
        const selectedForeground = foreground?.a === 1 ? foreground.hex.slice(0, 7) : null;
        for (const row of matrixButtons) {
            for (const button of row) {
                const selected = button.dataset.foreground === selectedForeground &&
                    button.dataset.background === background?.hex;
                button.setAttribute('aria-pressed', String(selected));
            }
        }
    }

    function refreshPair() {
        cssAttempt = null;
        actionStatus.textContent = '';
        cssStatus.textContent = '';
        adjustStatus.textContent = '';
        foreground = parseHex(foregroundHex.value);
        background = parseHex(backgroundHex.value, { allowAlpha: false });
        foregroundHex.setAttribute('aria-invalid', String(!foreground));
        backgroundHex.setAttribute('aria-invalid', String(!background));
        if (foreground) foregroundPicker.value = foreground.hex.slice(0, 7);
        if (background) backgroundPicker.value = background.hex;
        bestText.disabled = !background;
        swapPair.disabled = !background || !foreground || foreground.a !== 1;
        copyCss.disabled = !background || !foreground;
        adjustText.disabled = !background || !foreground;
        refreshShare();
        refreshMatrixSelection();

        if (background) {
            const best = bestForeground(background);
            const bestRatio = evaluateContrast(parseHex(best), background).ratio;
            bestTextHint.textContent = `Best black or white text is ${best} at ${ratioLabel(bestRatio)}.`;
        } else {
            bestTextHint.textContent = 'Enter an opaque background to compare black and white text.';
        }

        if (!foreground || !background) {
            pairError.textContent = !foreground && !background
                ? 'Enter valid hex colors for text and background.'
                : !foreground
                    ? 'Enter 3, 4, 6, or 8 hex digits for the text.'
                    : 'Enter 3 or 6 hex digits for the background.';
            ratioValue.textContent = '—';
            for (const [, status] of criteria) {
                status.textContent = '—';
                delete status.dataset.pass;
            }
            cssOutput.value = '';
            selectedPair.textContent = 'Choose a matrix cell or enter a valid pair.';
            preview.dataset.invalid = 'true';
            return;
        }

        pairError.textContent = '';
        delete preview.dataset.invalid;
        const result = evaluateContrast(foreground, background);
        const label = ratioLabel(result.ratio);
        ratioValue.textContent = label;
        for (const [key, status] of criteria) {
            setStatus(status, result[key]);
        }
        preview.style.setProperty('--preview-fg', foreground.hex);
        preview.style.setProperty('--preview-bg', background.hex);
        cssOutput.value = `color: ${foreground.hex};\nbackground-color: ${background.hex};`;
        selectedPair.textContent = `Selected text ${foreground.hex} on ${background.hex} · ${label}`;
    }

    function applyPair(text, surface) {
        foregroundHex.value = text;
        backgroundHex.value = surface;
        refreshPair();
    }

    function colorHeading(hex, scope) {
        const heading = document.createElement('th');
        heading.scope = scope;
        const label = document.createElement('span');
        label.className = 'matrix-color';
        const swatch = document.createElement('span');
        swatch.className = 'matrix-swatch';
        swatch.style.setProperty('--swatch', hex);
        swatch.setAttribute('aria-hidden', 'true');
        label.append(swatch, hex);
        heading.append(label);
        return heading;
    }

    function setMatrixTabStop(button) {
        if (matrixTabStop) matrixTabStop.tabIndex = -1;
        matrixTabStop = button;
        matrixTabStop.tabIndex = 0;
    }

    function createMatrixCell(text, surface, row, column) {
        const result = evaluateContrast(text, surface);
        const label = ratioLabel(result.ratio);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'matrix-cell';
        button.tabIndex = -1;
        button.dataset.row = String(row);
        button.dataset.column = String(column);
        button.dataset.foreground = text.hex;
        button.dataset.background = surface.hex;
        button.dataset.pass = String(result.normalAA);
        const indicatorText = result.normalAA ? 'AA pass' : 'Below AA';
        button.setAttribute('aria-label', `${label} ${indicatorText}, ${text.hex} text on ${surface.hex}`);
        const ratio = document.createElement('strong');
        ratio.textContent = label;
        const indicator = document.createElement('small');
        indicator.textContent = indicatorText;
        button.append(ratio, ' ', indicator);
        const cell = document.createElement('td');
        cell.append(button);
        matrixButtons[row].push(button);
        return cell;
    }

    function buildMatrix() {
        const { colors, invalid, overflow } = parsePalette(paletteInput.value);
        if (invalid.length || overflow || colors.length < 2) {
            paletteInput.setAttribute('aria-invalid', 'true');
            if (invalid.length) {
                paletteError.textContent = `Use opaque hex colors. Check ${invalid.slice(0, 3).map(value => JSON.stringify(value)).join(', ')}.`;
            } else if (overflow) {
                paletteError.textContent = 'Use at most 12 different colors.';
            } else {
                paletteError.textContent = 'Enter at least two different opaque hex colors.';
            }
            return;
        }

        paletteInput.setAttribute('aria-invalid', 'false');
        paletteError.textContent = '';
        matrixColors = colors;
        refreshShare();
        const activeElement = document.activeElement;
        const focusedCell = matrixTable.contains(activeElement) && activeElement.matches('.matrix-cell')
            ? activeElement : null;
        const parsed = colors.map(hex => parseHex(hex, { allowAlpha: false }));
        const caption = document.createElement('caption');
        caption.className = 'sr-only';
        caption.textContent = 'Text colors as rows and backgrounds as columns';
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        const corner = document.createElement('th');
        corner.scope = 'col';
        corner.textContent = 'Text / background';
        header.append(corner, ...colors.map(hex => colorHeading(hex, 'col')));
        head.append(header);

        const body = document.createElement('tbody');
        matrixButtons = colors.map(() => []);
        parsed.forEach((text, row) => {
            const line = document.createElement('tr');
            line.append(colorHeading(text.hex, 'row'));
            parsed.forEach((surface, column) => {
                line.append(createMatrixCell(text, surface, row, column));
            });
            body.append(line);
        });
        matrixTable.replaceChildren(caption, head, body);
        matrixTabStop = null;
        refreshMatrixSelection();

        let replacement;
        if (focusedCell) {
            const row = colors.indexOf(focusedCell.dataset.foreground);
            const column = colors.indexOf(focusedCell.dataset.background);
            replacement = matrixButtons[row]?.[column];
        }
        setMatrixTabStop(replacement || matrixTable.querySelector('[aria-pressed="true"]') || matrixButtons[0][0]);
        if (focusedCell) (replacement || matrixRegion).focus();
    }

    function refreshShare() {
        shareAttempt = null;
        copyShare.disabled = !foreground || !background || matrixColors.length < 2;
        shareFallback.hidden = true;
        shareOutput.value = '';
        shareStatus.textContent = '';
    }

    function restoreShare() {
        const shared = decodeShareState(location.hash);
        if (!shared) return false;
        paletteInput.value = shared.palette.join(' ');
        applyPair(shared.foreground, shared.background);
        buildMatrix();
        return true;
    }

    foregroundHex.addEventListener('input', refreshPair);
    backgroundHex.addEventListener('input', refreshPair);
    foregroundHex.addEventListener('blur', () => {
        if (foreground) foregroundHex.value = foreground.hex;
    });
    backgroundHex.addEventListener('blur', () => {
        if (background) backgroundHex.value = background.hex;
    });
    foregroundPicker.addEventListener('input', () => {
        const alpha = foreground?.hex.slice(7) ?? '';
        foregroundHex.value = foregroundPicker.value.toUpperCase() + alpha;
        refreshPair();
    });
    backgroundPicker.addEventListener('input', () => {
        backgroundHex.value = backgroundPicker.value.toUpperCase();
        refreshPair();
    });
    swapPair.addEventListener('click', () => {
        if (!foreground || foreground.a !== 1 || !background) return;
        applyPair(background.hex, foreground.hex.slice(0, 7));
        actionStatus.textContent = 'Text and background swapped.';
    });
    bestText.addEventListener('click', () => {
        if (!background) return;
        const best = bestForeground(background);
        applyPair(best, background.hex);
        actionStatus.textContent = `Applied ${best} as the text color.`;
    });
    adjustMinimum.addEventListener('change', () => {
        adjustStatus.textContent = '';
    });
    adjustText.addEventListener('click', () => {
        if (!foreground || !background) return;
        const minimum = Number(adjustMinimum.value);
        const candidate = adjustForeground(foreground, background, minimum);
        if (!candidate) {
            adjustStatus.textContent = `This background and text opacity cannot reach ${minimum}:1.`;
        } else if (candidate.hex === foreground.hex) {
            adjustStatus.textContent = `This text color already meets ${minimum}:1.`;
        } else {
            applyPair(candidate.hex, background.hex);
            adjustStatus.textContent = `Adjusted text to ${candidate.hex} at ${ratioLabel(candidate.ratio)}.`;
        }
    });

    function selectClipboardFallback(trigger, field) {
        if (document.activeElement !== trigger) return false;
        field.focus();
        field.select();
        return true;
    }

    copyCss.addEventListener('click', async () => {
        const css = cssOutput.value;
        if (!css) return;
        const attempt = Symbol();
        cssAttempt = attempt;
        cssStatus.textContent = '';
        try {
            await navigator.clipboard.writeText(css);
            if (cssAttempt !== attempt) return;
            cssStatus.textContent = 'CSS copied.';
        } catch {
            if (cssAttempt !== attempt) return;
            cssStatus.textContent = selectClipboardFallback(copyCss, cssOutput)
                ? 'CSS selected. Press Ctrl+C or Command+C to copy it.'
                : 'Clipboard unavailable. Copy the CSS declarations manually.';
        }
    });
    copyShare.addEventListener('click', async () => {
        const hash = encodeShareState({ foreground: foreground?.hex, background: background?.hex, palette: matrixColors });
        if (!hash) return;
        const base = /^https?:$/.test(location.protocol)
            ? location.origin + location.pathname
            : 'https://orangepony4.github.io/palette-contrast/';
        const url = base + hash;
        const attempt = Symbol();
        shareAttempt = attempt;
        try {
            await navigator.clipboard.writeText(url);
            if (shareAttempt !== attempt) return;
            shareFallback.hidden = true;
            shareOutput.value = '';
            shareStatus.textContent = 'Share link copied.';
        } catch {
            if (shareAttempt !== attempt) return;
            shareFallback.hidden = false;
            shareOutput.value = url;
            shareStatus.textContent = selectClipboardFallback(copyShare, shareOutput)
                ? 'Link selected. Press Ctrl+C or Command+C to copy it.'
                : 'Clipboard unavailable. Copy the URL from the Share link field.';
        }
    });
    byId('buildPalette').addEventListener('click', buildMatrix);
    matrixTable.addEventListener('click', event => {
        const button = event.target.closest('.matrix-cell');
        if (!button) return;
        setMatrixTabStop(button);
        applyPair(button.dataset.foreground, button.dataset.background);
    });
    matrixTable.addEventListener('keydown', event => {
        const button = event.target.closest('.matrix-cell');
        if (!button) return;
        if (event.altKey || event.metaKey || event.shiftKey ||
            (event.ctrlKey && event.key !== 'Home' && event.key !== 'End')) return;
        let row = Number(button.dataset.row);
        let column = Number(button.dataset.column);
        const last = matrixButtons.length - 1;
        switch (event.key) {
            case 'ArrowUp': row = Math.max(0, row - 1); break;
            case 'ArrowDown': row = Math.min(last, row + 1); break;
            case 'ArrowLeft': column = Math.max(0, column - 1); break;
            case 'ArrowRight': column = Math.min(last, column + 1); break;
            case 'Home':
                column = 0;
                if (event.ctrlKey) row = 0;
                break;
            case 'End':
                column = last;
                if (event.ctrlKey) row = last;
                break;
            default: return;
        }
        event.preventDefault();
        const next = matrixButtons[row][column];
        setMatrixTabStop(next);
        next.focus();
    });

    window.addEventListener('hashchange', restoreShare);
    if (!restoreShare()) {
        refreshPair();
        buildMatrix();
    }
})();
