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
    const languageToggle = byId('languageToggle');
    const criteria = [
        ['normalAA', byId('statusNormalAA')],
        ['largeAA', byId('statusLargeAA')],
        ['normalAAA', byId('statusNormalAAA')],
        ['largeAAA', byId('statusLargeAAA')],
    ];
    const messages = {
        switchLanguage: ['Switch to Russian', 'Переключить на английский'],
        pass: ['Pass', 'Норма'],
        fail: ['Fail', 'Ниже нормы'],
        bestText: ['Best black or white text is {0} at {1}.', 'Лучший из чёрного и белого — {0} с контрастом {1}.'],
        noBackground: ['Enter an opaque background to compare black and white text.', 'Введите непрозрачный фон, чтобы сравнить чёрный и белый текст.'],
        invalidPair: ['Enter valid hex colors for text and background.', 'Введите корректные HEX-цвета текста и фона.'],
        invalidForeground: ['Enter 3, 4, 6, or 8 hex digits for the text.', 'Введите 3, 4, 6 или 8 шестнадцатеричных цифр для цвета текста.'],
        invalidBackground: ['Enter 3 or 6 hex digits for the background.', 'Введите 3 или 6 шестнадцатеричных цифр для цвета фона.'],
        choosePair: ['Choose a matrix cell or enter a valid pair.', 'Выберите ячейку таблицы или введите корректную пару цветов.'],
        selectedPair: ['Selected text {0} on {1} · {2}', 'Текст {0} на фоне {1} · {2}'],
        matrixPass: ['AA pass', 'Уровень AA'],
        matrixFail: ['Below AA', 'Ниже AA'],
        matrixCell: ['{0} {1}, {2} text on {3}', '{0}, {1}, текст {2} на фоне {3}'],
        matrixCaption: ['Text colors as rows and backgrounds as columns', 'Цвета текста по строкам и цвета фона по столбцам'],
        matrixCorner: ['Text / background', 'Текст / фон'],
        invalidPalette: ['Use opaque hex colors. Check {0}.', 'Введите непрозрачные HEX-цвета. Проверьте {0}.'],
        paletteOverflow: ['Use at most 12 different colors.', 'Используйте не больше 12 разных цветов.'],
        paletteShort: ['Enter at least two different opaque hex colors.', 'Введите хотя бы два разных непрозрачных HEX-цвета.'],
        pairSwapped: ['Text and background swapped.', 'Цвета текста и фона поменялись местами.'],
        appliedText: ['Applied {0} as the text color.', 'Установлен цвет текста {0}.'],
        impossibleAdjustment: ['This background and text opacity cannot reach {0}:1.', 'При таком фоне и прозрачности текста нельзя получить контраст {0}:1.'],
        sufficientContrast: ['This text color already meets {0}:1.', 'Контраст этого цвета текста уже составляет не менее {0}:1.'],
        adjustedText: ['Adjusted text to {0} at {1}.', 'Новый цвет текста {0}, контраст {1}.'],
        cssCopied: ['CSS copied.', 'CSS скопирован.'],
        cssSelected: ['CSS selected. Press Ctrl+C or Command+C to copy it.', 'CSS выделен. Нажмите Ctrl+C или Command+C, чтобы его скопировать.'],
        cssManual: ['Clipboard unavailable. Copy the CSS declarations manually.', 'Буфер обмена недоступен. Скопируйте правила CSS вручную.'],
        shareCopied: ['Share link copied.', 'Ссылка скопирована.'],
        shareSelected: ['Link selected. Press Ctrl+C or Command+C to copy it.', 'Ссылка выделена. Нажмите Ctrl+C или Command+C, чтобы её скопировать.'],
        shareManual: ['Clipboard unavailable. Copy the URL from the Share link field.', 'Буфер обмена недоступен. Скопируйте ссылку из поля вручную.'],
    };
    const staticTranslations = [];
    for (const [marker, attribute] of [['data-ru', null], ['data-ru-label', 'aria-label'], ['data-ru-title', 'title']]) {
        for (const element of document.querySelectorAll(`[${marker}]`)) {
            const english = attribute ? element.getAttribute(attribute) : element.textContent;
            staticTranslations.push({ element, attribute, english, russian: element.getAttribute(marker) });
        }
    }
    const visibleMessages = new Map();
    const languageKey = 'paletteContrastLanguage';
    let language = 'en';
    try {
        if (localStorage.getItem(languageKey) === 'ru') language = 'ru';
    } catch {
        // Storage can be unavailable for the offline copy.
    }

    let foreground;
    let background;
    let matrixColors = [];
    let matrixButtons = [];
    let matrixTabStop = null;
    let cssAttempt;
    let shareAttempt;
    let workspaceDraft;

    function translate(key, ...args) {
        const message = messages[key][language === 'ru' ? 1 : 0];
        return args.length ? message.replace(/\{(\d+)\}/g, (_, index) => args[Number(index)]) : message;
    }

    function setMessage(element, key, ...args) {
        if (key) {
            visibleMessages.set(element, [key, ...args]);
            element.textContent = translate(key, ...args);
        } else {
            visibleMessages.delete(element);
            element.textContent = '';
        }
    }

    function applyLanguage() {
        document.documentElement.lang = language;
        for (const { element, attribute, english, russian } of staticTranslations) {
            const text = language === 'ru' ? russian : english;
            if (attribute) element.setAttribute(attribute, text);
            else element.textContent = text;
        }
        const switchLabel = translate('switchLanguage');
        languageToggle.textContent = language === 'ru' ? 'EN' : 'RU';
        languageToggle.setAttribute('aria-label', switchLabel);
        languageToggle.title = switchLabel;
        for (const [element, message] of visibleMessages) element.textContent = translate(...message);
        if (matrixTable.caption) {
            matrixTable.caption.textContent = translate('matrixCaption');
            matrixTable.tHead.rows[0].cells[0].textContent = translate('matrixCorner');
        }
        for (const row of matrixButtons) {
            for (const button of row) translateMatrixCell(button);
        }
    }

    function ratioLabel(ratio) {
        // Round down for display so a value below a threshold never looks like a pass.
        return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
    }

    function setStatus(element, pass) {
        setMessage(element, pass ? 'pass' : 'fail');
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

    function setActionAvailability(button, unavailableInput) {
        if (unavailableInput && document.activeElement === button) unavailableInput.focus();
        button.disabled = Boolean(unavailableInput);
    }

    function refreshPair() {
        cssAttempt = null;
        setMessage(actionStatus);
        setMessage(cssStatus);
        setMessage(adjustStatus);
        foreground = parseHex(foregroundHex.value);
        background = parseHex(backgroundHex.value, { allowAlpha: false });
        foregroundHex.setAttribute('aria-invalid', String(!foreground));
        backgroundHex.setAttribute('aria-invalid', String(!background));
        if (foreground) foregroundPicker.value = foreground.hex.slice(0, 7);
        if (background) backgroundPicker.value = background.hex;
        const invalidInput = !foreground ? foregroundHex : !background ? backgroundHex : null;
        setActionAvailability(bestText, background ? null : backgroundHex);
        setActionAvailability(swapPair, invalidInput ?? (foreground.a === 1 ? null : foregroundHex));
        setActionAvailability(copyCss, invalidInput);
        setActionAvailability(adjustText, invalidInput);
        refreshShare();
        refreshMatrixSelection();

        if (background) {
            const best = bestForeground(background);
            const bestRatio = evaluateContrast(parseHex(best), background).ratio;
            setMessage(bestTextHint, 'bestText', best, ratioLabel(bestRatio));
        } else {
            setMessage(bestTextHint, 'noBackground');
        }

        if (!foreground || !background) {
            setMessage(pairError, !foreground && !background ? 'invalidPair'
                : !foreground ? 'invalidForeground' : 'invalidBackground');
            ratioValue.textContent = '—';
            for (const [, status] of criteria) {
                visibleMessages.delete(status);
                status.textContent = '—';
                delete status.dataset.pass;
            }
            cssOutput.value = '';
            setMessage(selectedPair, 'choosePair');
            preview.dataset.invalid = 'true';
            return;
        }

        setMessage(pairError);
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
        setMessage(selectedPair, 'selectedPair', foreground.hex, background.hex, label);
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
        if (matrixTabStop) matrixTabStop.tabIndex = 0;
    }

    function translateMatrixCell(button) {
        const [ratio, indicator] = button.children;
        const indicatorText = translate(button.dataset.pass === 'true' ? 'matrixPass' : 'matrixFail');
        indicator.textContent = indicatorText;
        button.setAttribute('aria-label', translate('matrixCell', ratio.textContent, indicatorText,
            button.dataset.foreground, button.dataset.background));
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
        const ratio = document.createElement('strong');
        ratio.textContent = label;
        const indicator = document.createElement('small');
        button.append(ratio, ' ', indicator);
        translateMatrixCell(button);
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
                const samples = invalid.slice(0, 3).map(value => JSON.stringify(value)).join(', ');
                setMessage(paletteError, 'invalidPalette', samples);
            } else if (overflow) {
                setMessage(paletteError, 'paletteOverflow');
            } else {
                setMessage(paletteError, 'paletteShort');
            }
            return;
        }

        paletteInput.setAttribute('aria-invalid', 'false');
        setMessage(paletteError);
        renderMatrix(colors);
    }

    function renderMatrix(colors, draftTabStop) {
        matrixColors = colors;
        refreshShare();
        const activeElement = document.activeElement;
        const focusedCell = matrixTable.contains(activeElement) && activeElement.matches('.matrix-cell')
            ? activeElement : null;
        const parsed = colors.map(hex => parseHex(hex, { allowAlpha: false }));
        const caption = document.createElement('caption');
        caption.className = 'sr-only';
        caption.textContent = translate('matrixCaption');
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        const corner = document.createElement('th');
        corner.scope = 'col';
        corner.textContent = translate('matrixCorner');
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

        const cellFor = pair => pair && matrixButtons[colors.indexOf(pair.foreground)]?.[colors.indexOf(pair.background)];
        const replacement = cellFor(focusedCell?.dataset);
        const tabStop = replacement || cellFor(draftTabStop) || matrixTable.querySelector('[aria-pressed="true"]') || matrixButtons[0]?.[0];
        setMatrixTabStop(tabStop);
        if (focusedCell) (replacement || matrixRegion).focus();
    }

    function clearShareFallback(nextFocus = copyShare) {
        if (document.activeElement === shareOutput) nextFocus.focus();
        shareFallback.hidden = true;
        shareOutput.value = '';
    }

    function refreshShare() {
        shareAttempt = null;
        const unavailableInput = !foreground ? foregroundHex : !background ? backgroundHex
            : matrixColors.length < 2 ? paletteInput : null;
        setActionAvailability(copyShare, unavailableInput);
        clearShareFallback(unavailableInput ?? copyShare);
        setMessage(shareStatus);
    }

    function restoreShare() {
        const shared = decodeShareState(location.hash);
        if (!shared) {
            if (!location.hash && workspaceDraft) {
                const draft = workspaceDraft;
                workspaceDraft = undefined;
                paletteInput.value = draft.palette;
                foregroundPicker.value = draft.foregroundPicker;
                backgroundPicker.value = draft.backgroundPicker;
                applyPair(draft.foreground, draft.background);
                renderMatrix(draft.colors, draft.tabStop);
                paletteInput.setAttribute('aria-invalid', String(Boolean(draft.paletteError)));
                setMessage(paletteError, ...(draft.paletteError ?? []));
            }
            return;
        }
        // Shared fragments can change repeatedly while the editable workspace waits at the plain URL.
        workspaceDraft ??= {
            foreground: foregroundHex.value,
            background: backgroundHex.value,
            foregroundPicker: foregroundPicker.value,
            backgroundPicker: backgroundPicker.value,
            // Unapplied text may be different from the palette shown in the matrix.
            palette: paletteInput.value,
            colors: matrixColors,
            paletteError: visibleMessages.get(paletteError),
            tabStop: matrixTabStop && {
                foreground: matrixTabStop.dataset.foreground,
                background: matrixTabStop.dataset.background,
            },
        };
        paletteInput.value = shared.palette.join(' ');
        applyPair(shared.foreground, shared.background);
        buildMatrix();
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
        setMessage(actionStatus, 'pairSwapped');
    });
    bestText.addEventListener('click', () => {
        if (!background) return;
        const best = bestForeground(background);
        applyPair(best, background.hex);
        setMessage(actionStatus, 'appliedText', best);
    });
    adjustMinimum.addEventListener('change', () => {
        setMessage(adjustStatus);
    });
    adjustText.addEventListener('click', () => {
        if (!foreground || !background) return;
        const minimum = Number(adjustMinimum.value);
        const candidate = adjustForeground(foreground, background, minimum);
        if (!candidate) {
            setMessage(adjustStatus, 'impossibleAdjustment', minimum);
        } else if (candidate.hex === foreground.hex) {
            setMessage(adjustStatus, 'sufficientContrast', minimum);
        } else {
            applyPair(candidate.hex, background.hex);
            setMessage(adjustStatus, 'adjustedText', candidate.hex, ratioLabel(candidate.ratio));
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
        setMessage(cssStatus);
        try {
            await navigator.clipboard.writeText(css);
            if (cssAttempt !== attempt) return;
            setMessage(cssStatus, 'cssCopied');
        } catch {
            if (cssAttempt !== attempt) return;
            setMessage(cssStatus, selectClipboardFallback(copyCss, cssOutput) ? 'cssSelected' : 'cssManual');
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
            clearShareFallback();
            setMessage(shareStatus, 'shareCopied');
        } catch {
            if (shareAttempt !== attempt) return;
            shareFallback.hidden = false;
            shareOutput.value = url;
            setMessage(shareStatus, selectClipboardFallback(copyShare, shareOutput) ? 'shareSelected' : 'shareManual');
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

    languageToggle.addEventListener('click', () => {
        language = language === 'en' ? 'ru' : 'en';
        applyLanguage();
        try {
            localStorage.setItem(languageKey, language);
        } catch {
            // The switch still works when the browser does not save preferences.
        }
    });
    applyLanguage();
    languageToggle.hidden = false;
    refreshPair();
    buildMatrix();
    restoreShare();
    window.addEventListener('hashchange', restoreShare);
})();
