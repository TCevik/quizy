document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnLearnMode = e.target.closest('#btn-learn-mode');
        if (btnLearnMode) {
            e.preventDefault();
            openLearnMode();
        }
    });
});

function openLearnMode() {
    const isOwner = window.currentUser && window.currentSet && window.currentSet.user_id === window.currentUser.id;
    if (!window.currentSet || !window.currentSet.cards || window.currentSet.cards.length === 0) {
        if (window.Toast) window.Toast.show('Deze set heeft geen kaarten om te leren.', 'error');
        return;
    }

    const mainWrapper = document.querySelector('main.set-wrapper');
    let overlay = document.getElementById('learn-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'learn-overlay';
        overlay.className = 'learn-overlay';
        if (mainWrapper) {
            mainWrapper.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
    }

    if (mainWrapper) {
        Array.from(mainWrapper.children).forEach(child => {
            if (child !== overlay) {
                if (!child.hasAttribute('data-prev-display')) {
                    child.setAttribute('data-prev-display', child.style.display || '');
                }
                child.style.display = 'none';
            }
        });
    }
    window.scrollTo(0, 0);

    const originalCards = window.currentSet.cards;
    const hasStarred = originalCards.some(c => c.starred);

    const savedSettings = (window.currentSet && window.currentSet.settings) || {};
    let settings = {
        flashcards: ('learn_flashcards' in savedSettings) ? !!savedSettings.learn_flashcards : true,
        multipleChoice: ('learn_multipleChoice' in savedSettings) ? !!savedSettings.learn_multipleChoice : true,
        spelling: ('learn_spelling' in savedSettings) ? !!savedSettings.learn_spelling : true,
        starOnly: ('starOnly' in savedSettings) ? !!savedSettings.starOnly : false,
        randomize: ('randomize' in savedSettings) ? !!savedSettings.randomize : false,
        swapSides: ('swapSides' in savedSettings) ? !!savedSettings.swapSides : false,
        autoSpeak: ('autoSpeak' in savedSettings) ? !!savedSettings.autoSpeak : false,
        ignoreParentheses: ('ignoreParentheses' in savedSettings) ? !!savedSettings.ignoreParentheses : true,
        skipPunctuation: ('skipPunctuation' in savedSettings) ? !!savedSettings.skipPunctuation : true,
        allowSlashParts: ('allowSlashParts' in savedSettings) ? !!savedSettings.allowSlashParts : true
    };

    if (!hasStarred) {
        settings.starOnly = false;
        if (window.currentSet && window.currentSet.settings && window.currentSet.settings.starOnly) {
            window.currentSet.settings.starOnly = false;
        }
    }

    let activeQueue = [...originalCards];
    let cardLevels = new Map();
    let activeBatch = [];
    const batchSize = 5;
    let lastCardKey = null;
    const failedInCurrentBatch = new Set();
    let nextQueueIndex = 0;

    overlay.innerHTML = `
        <div class="learn-container" style="position: relative;">
            <div class="learn-header">
                <span class="learn-title">${escapeHtml(window.currentSet.title || 'Leermodus')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="learn-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="learn-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>

                    <div id="learn-settings-panel" class="learn-settings-panel">
                        <h3 class="learn-settings-title">
                            <span class="material-symbols-rounded">settings</span> Instellingen
                        </h3>
                        
                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label" style="${!hasStarred ? 'opacity: 0.5;' : ''}">Alleen sterwoorden</label>
                                <label class="fc-switch" style="${!hasStarred ? 'pointer-events: none; opacity: 0.5;' : ''}">
                                    <input type="checkbox" id="learn-star-only" ${settings.starOnly ? 'checked' : ''} ${!hasStarred ? 'disabled' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Oefen alleen de woorden die je met een ster hebt gemarkeerd.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Willekeurige volgorde</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-randomize" ${settings.randomize ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Schud de vragen in een willekeurige volgorde vanaf de volgende vraag.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Vraag/Antwoord omdraaien</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-swap-sides" ${settings.swapSides ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Draai de term en definitie om tijdens het leren.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Automatisch uitspreken</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-auto-speak" ${settings.autoSpeak ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Spreek de vraag automatisch uit wanneer deze in beeld komt.</span>
                        </div>

                        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0;">

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Flashcards</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-toggle-fc" ${settings.flashcards ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Leer de woorden met behulp van flashcards.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Meerkeuze</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-toggle-mc" ${settings.multipleChoice ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Oefen de herkenning van woorden met meerkeuzevragen.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Spelling</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-toggle-sp" ${settings.spelling ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Schrijf de vertaling of definitie volledig zelf.</span>
                        </div>

                        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0;">

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Tussen haakjes goedkeuren (Spelling)</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-ignore-parentheses" ${settings.ignoreParentheses ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Dingen tussen haakjes zijn optioneel. Bijv. "de (mooie) auto" keurt ook "de auto" goed.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Leestekens & accenten skippen (Spelling)</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-skip-punctuation" ${settings.skipPunctuation ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Negeer leestekens, en vervang speciale letters zoals é of ì door e en i.</span>
                        </div>

                        <div class="learn-setting-item">
                            <div class="learn-setting-row">
                                <label class="learn-setting-label">Eén kant van / goedkeuren (Spelling)</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="learn-allow-slash-parts" ${settings.allowSlashParts ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Als het antwoord "hoi/hallo" is, is "hoi" óf "hallo" goed.</span>
                        </div>

                        <div class="learn-settings-actions">
                            <button class="btn-control" id="learn-settings-save" style="background: var(--primary); color: #fff;">Opslaan</button>
                            <button class="btn-control" id="learn-settings-cancel">Annuleren</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="progress-container">
                <span class="progress-text" id="learn-progress-text">Voortgang: 0%</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="learn-progress-fill"></div>
                </div>
            </div>

            <div class="learn-card-area" id="learn-card-area"></div>

            <div class="learn-batch-dots" id="learn-batch-dots"></div>
        </div>
    `;

    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const cardArea = document.getElementById('learn-card-area');
    const batchDotsContainer = document.getElementById('learn-batch-dots');
    const progressText = document.getElementById('learn-progress-text');
    const progressFill = document.getElementById('learn-progress-fill');
    const closeBtn = document.getElementById('learn-close');
    const settingsBtn = document.getElementById('learn-settings-btn');
    const settingsPanel = document.getElementById('learn-settings-panel');
    const settingsSave = document.getElementById('learn-settings-save');
    const settingsCancel = document.getElementById('learn-settings-cancel');

    closeBtn.addEventListener('click', closeLearn);

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
    });

    settingsCancel.addEventListener('click', () => {
        settingsPanel.classList.remove('active');
        document.getElementById('learn-toggle-fc').checked = settings.flashcards;
        document.getElementById('learn-toggle-mc').checked = settings.multipleChoice;
        document.getElementById('learn-toggle-sp').checked = settings.spelling;
        document.getElementById('learn-star-only').checked = settings.starOnly;
        document.getElementById('learn-randomize').checked = settings.randomize;
        document.getElementById('learn-swap-sides').checked = settings.swapSides;
        document.getElementById('learn-auto-speak').checked = settings.autoSpeak;
    });

    settingsSave.addEventListener('click', () => {
        const fc = document.getElementById('learn-toggle-fc').checked;
        const mc = document.getElementById('learn-toggle-mc').checked;
        const sp = document.getElementById('learn-toggle-sp').checked;
        const star = document.getElementById('learn-star-only').checked;

        if (!fc && !mc && !sp) {
            if (window.Toast) window.Toast.show('Minimaal één leermethode moet actief zijn.', 'error');
            return;
        }

        const methodsChanged = (fc !== settings.flashcards) || 
                               (mc !== settings.multipleChoice) || 
                               (sp !== settings.spelling) || 
                               (star !== settings.starOnly);

        const applySettings = (restart) => {
            settings.flashcards = fc;
            settings.multipleChoice = mc;
            settings.spelling = sp;
            settings.starOnly = star;
            settings.randomize = document.getElementById('learn-randomize').checked;
            settings.swapSides = document.getElementById('learn-swap-sides').checked;
            settings.autoSpeak = document.getElementById('learn-auto-speak').checked;
            settings.ignoreParentheses = document.getElementById('learn-ignore-parentheses').checked;
            settings.skipPunctuation = document.getElementById('learn-skip-punctuation').checked;
            settings.allowSlashParts = document.getElementById('learn-allow-slash-parts').checked;

            if (window.currentSet) {
                window.currentSet.settings = {
                    ...(window.currentSet.settings || {}),
                    learn_flashcards: settings.flashcards,
                    learn_multipleChoice: settings.multipleChoice,
                    learn_spelling: settings.spelling,
                    starOnly: settings.starOnly,
                    randomize: settings.randomize,
                    swapSides: settings.swapSides,
                    autoSpeak: settings.autoSpeak,
                    ignoreParentheses: settings.ignoreParentheses,
                    skipPunctuation: settings.skipPunctuation,
                    allowSlashParts: settings.allowSlashParts
                };
                if (isOwner && window.saveAndSyncCurrentSet) {
                    window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }

            settingsPanel.classList.remove('active');
            
            if (restart) {
                initializeSession();
            } else {
                showNextQuestion();
            }
        };

        if (methodsChanged) {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.style.zIndex = '9999';
            
            modal.innerHTML = `
                <div class="modal-card glass-panel" style="max-width: 420px;">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                        <h3 style="font-size: 1.3em; font-weight: 600; color: var(--text-light);">Sessie herstarten?</h3>
                    </div>
                    <div class="modal-body" style="padding: 24px; gap: 8px;">
                        <p style="color: var(--text-muted); font-size: 1em; line-height: 1.5; margin: 0;">Als je de leermethodes of de 'Alleen ster'-modus aanpast, wordt je huidige sessie opnieuw gestart.</p>
                        <p style="color: var(--text-light); font-size: 0.9em; font-weight: 500; margin: 0; margin-top: 10px;">Weet je zeker dat je wilt doorgaan?</p>
                    </div>
                    <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; margin-top: 0;">
                        <button id="learn-restart-cancel" class="btn-text">Annuleren</button>
                        <button id="learn-restart-confirm" class="btn-gradient" style="padding: 10px 20px;">Doorgaan</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#learn-restart-cancel').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.querySelector('#learn-restart-confirm').addEventListener('click', () => {
                modal.remove();
                applySettings(true);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        } else {
            applySettings(false);
        }
    });

    const clickOutsideHandler = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove('active');
            document.getElementById('learn-toggle-fc').checked = settings.flashcards;
            document.getElementById('learn-toggle-mc').checked = settings.multipleChoice;
            document.getElementById('learn-toggle-sp').checked = settings.spelling;
            document.getElementById('learn-star-only').checked = settings.starOnly;
            document.getElementById('learn-randomize').checked = settings.randomize;
            document.getElementById('learn-swap-sides').checked = settings.swapSides;
            document.getElementById('learn-auto-speak').checked = settings.autoSpeak;
            document.getElementById('learn-ignore-parentheses').checked = settings.ignoreParentheses;
            document.getElementById('learn-skip-punctuation').checked = settings.skipPunctuation;
            document.getElementById('learn-allow-slash-parts').checked = settings.allowSlashParts;
        }
    };
    document.addEventListener('click', clickOutsideHandler);


    function getCardKey(card) {
        return `idx_${window.currentSet.cards.indexOf(card)}`;
    }

    function getStartingLevel() {
        if (settings.flashcards) return 0;
        if (settings.multipleChoice) return 1;
        return 2;
    }

    function getMaxLevel() {
        if (settings.spelling) return 3;
        if (settings.multipleChoice) return 2;
        return 1;
    }

    function normalizeCardLevel(lvl) {
        let current = lvl;
        const start = getStartingLevel();
        const max = getMaxLevel();

        if (current < start) {
            current = start;
        }
        if (current === 0 && !settings.flashcards) {
            current = 1;
        }
        if (current === 1 && !settings.multipleChoice) {
            current = 2;
        }
        if (current === 2 && !settings.spelling) {
            current = 3;
        }
        if (current > max) {
            current = max;
        }
        return current;
    }

    function advanceCardLevel(card, newRawLevel) {
        const key = getCardKey(card);
        cardLevels.set(key, newRawLevel);
        const normalized = normalizeCardLevel(newRawLevel);
        if (normalized >= getMaxLevel()) {
            const idx = activeBatch.findIndex(c => getCardKey(c) === key);
            if (idx !== -1) {
                activeBatch.splice(idx, 1);
            }
        }
    }

    function initializeSession() {
        activeQueue = settings.starOnly ? originalCards.filter(c => c.starred) : [...originalCards];
        
        if (settings.randomize) {
            for (let i = activeQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [activeQueue[i], activeQueue[j]] = [activeQueue[j], activeQueue[i]];
            }
        }

        cardLevels.clear();
        activeQueue.forEach(card => {
            cardLevels.set(getCardKey(card), getStartingLevel());
        });

        activeBatch = [];
        lastCardKey = null;
        failedInCurrentBatch.clear();
        nextQueueIndex = 0;

        fillActiveBatch();
        showNextQuestion();
    }

    function fillActiveBatch() {
        if (activeBatch.length === 0) {
            failedInCurrentBatch.forEach(key => {
                cardLevels.set(key, getStartingLevel());
            });
            failedInCurrentBatch.clear();

            while (activeBatch.length < batchSize) {
                let found = false;
                for (let i = 0; i < activeQueue.length; i++) {
                    const idx = (nextQueueIndex + i) % activeQueue.length;
                    const c = activeQueue[idx];
                    const key = getCardKey(c);
                    if (normalizeCardLevel(cardLevels.get(key)) < getMaxLevel() && !activeBatch.some(bc => getCardKey(bc) === key)) {
                        activeBatch.push(c);
                        nextQueueIndex = (idx + 1) % activeQueue.length;
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }
        }
    }

    function updateProgress() {
        if (activeQueue.length === 0) {
            progressText.textContent = 'Voortgang: 0%';
            progressFill.style.width = '0%';
            return;
        }

        let totalLevels = 0;
        cardLevels.forEach((lvl, key) => {
            const normalized = normalizeCardLevel(lvl);
            totalLevels += (normalized - getStartingLevel());
        });

        const maxDiff = getMaxLevel() - getStartingLevel();
        const maxLevels = activeQueue.length * maxDiff;
        const percentage = maxLevels > 0 ? Math.round((totalLevels / maxLevels) * 100) : 100;
        progressText.textContent = `Voortgang: ${percentage}%`;
        progressFill.style.width = `${percentage}%`;

        batchDotsContainer.innerHTML = '';
        activeBatch.forEach(card => {
            const lvl = normalizeCardLevel(cardLevels.get(getCardKey(card)));
            const dot = document.createElement('div');
            dot.className = `learn-batch-dot level-${lvl}`;
            batchDotsContainer.appendChild(dot);
        });
    }

    function showNextQuestion() {
        fillActiveBatch();
        updateProgress();

        if (activeBatch.length === 0) {
            showCelebration();
            return;
        }

        let selectedCard = null;
        if (activeBatch.length === 1) {
            selectedCard = activeBatch[0];
        } else {
            const candidates = activeBatch.filter(c => getCardKey(c) !== lastCardKey);
            if (candidates.length > 0) {
                selectedCard = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                selectedCard = activeBatch[Math.floor(Math.random() * activeBatch.length)];
            }
        }

        const key = getCardKey(selectedCard);
        const level = normalizeCardLevel(cardLevels.get(key));

        if (level === 0) {
            renderFlashcard(selectedCard);
        } else if (level === 1) {
            renderMultipleChoice(selectedCard);
        } else if (level === 2) {
            renderSpelling(selectedCard);
        }
    }

    function renderFlashcard(card) {
        const questionText = settings.swapSides ? card.definition : card.term;
        const answerText = settings.swapSides ? card.term : card.definition;
        const questionLabel = window.currentSet.mode === 'talen' 
            ? (settings.swapSides ? (window.currentSet.lang_col2 || 'Definitie') : (window.currentSet.lang_col1 || 'Term'))
            : (settings.swapSides ? 'Definitie' : 'Term');
        const answerLabel = window.currentSet.mode === 'talen'
            ? (settings.swapSides ? (window.currentSet.lang_col1 || 'Term') : (window.currentSet.lang_col2 || 'Definitie'))
            : (settings.swapSides ? 'Term' : 'Definitie');

        cardArea.innerHTML = `
            <div class="learn-flashcard-wrapper" id="learn-card-wrapper">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-flashcard-inner">
                    <div class="learn-flashcard-face learn-flashcard-front">
                        <div class="learn-card-label">${escapeHtml(questionLabel)}</div>
                        <div class="learn-card-text">${escapeHtml(questionText)}</div>
                        <div style="margin-top: 20px; font-size: 0.85em; color: var(--text-muted);">Klik om om te draaien</div>
                    </div>
                    <div class="learn-flashcard-face learn-flashcard-back">
                        <div class="learn-card-label">${escapeHtml(answerLabel)}</div>
                        <div class="learn-card-text">${escapeHtml(answerText)}</div>
                    </div>
                </div>
            </div>
            <div class="learn-controls">
                <button class="btn-control" id="learn-btn-no" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">
                    Nee, nog niet
                </button>
                <button class="btn-control" id="learn-btn-yes" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: #10b981;">
                    Ja, wist ik
                </button>
            </div>
        `;

        const wrapper = document.getElementById('learn-card-wrapper');
        wrapper.addEventListener('click', () => {
            wrapper.classList.toggle('flipped');
        });

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = wrapper.classList.contains('flipped') ? answerText : questionText;
            const lang = wrapper.classList.contains('flipped') ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) {
                window.speakText(text, lang);
            }
        });

        document.getElementById('learn-btn-no').addEventListener('click', () => {
            failedInCurrentBatch.add(getCardKey(card));
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });

        document.getElementById('learn-btn-yes').addEventListener('click', () => {
            advanceCardLevel(card, 1);
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });

        if (settings.autoSpeak && window.speakText) {
            window.speakText(questionText, window.currentSet.lang_col1);
        }
    }

    function renderMultipleChoice(card) {
        const questionText = settings.swapSides ? card.definition : card.term;
        const correctText = settings.swapSides ? card.term : card.definition;
        const questionLabel = window.currentSet.mode === 'talen'
            ? (settings.swapSides ? (window.currentSet.lang_col2 || 'Definitie') : (window.currentSet.lang_col1 || 'Term'))
            : (settings.swapSides ? 'Definitie' : 'Term');

        const otherCards = originalCards.filter(c => getCardKey(c) !== getCardKey(card));
        const potentialDistractors = [...new Set(otherCards.map(c => settings.swapSides ? c.term : c.definition))].filter(t => t !== correctText);
        
        for (let i = potentialDistractors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialDistractors[i], potentialDistractors[j]] = [potentialDistractors[j], potentialDistractors[i]];
        }
        const distractors = potentialDistractors.slice(0, 3);
        const options = [correctText, ...distractors];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        cardArea.innerHTML = `
            <div class="learn-mc-question-card">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-card-label">${escapeHtml(questionLabel)}</div>
                <div class="learn-card-text">${escapeHtml(questionText)}</div>
            </div>
            <div class="learn-mc-options-grid" id="learn-mc-options"></div>
            <div class="learn-controls" style="display: none;" id="learn-mc-action">
                <button class="btn-control" id="learn-mc-next" style="background: var(--primary); color: #fff;">
                    Volgende
                    <span class="material-symbols-rounded">arrow_forward</span>
                </button>
            </div>
        `;

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', () => {
            if (window.speakText) {
                window.speakText(questionText, window.currentSet.lang_col1);
            }
        });

        const optionsGrid = document.getElementById('learn-mc-options');
        let answered = false;

        options.forEach((optText, index) => {
            const letter = String.fromCharCode(65 + index);
            const btn = document.createElement('button');
            btn.className = 'learn-mc-option-btn';
            btn.innerHTML = `
                <span class="learn-mc-option-badge">${letter}</span>
                <span>${escapeHtml(optText)}</span>
            `;
            btn.addEventListener('click', () => {
                if (answered) return;
                answered = true;

                Array.from(optionsGrid.children).forEach(b => {
                    b.disabled = true;
                    const textSpan = b.querySelector('span:not(.learn-mc-option-badge)');
                    if (textSpan.textContent === correctText) {
                        b.classList.add('correct');
                    }
                });

                if (optText === correctText) {
                    advanceCardLevel(card, 2);
                } else {
                    btn.classList.add('incorrect');
                    cardLevels.set(getCardKey(card), 0);
                    failedInCurrentBatch.add(getCardKey(card));
                }

                document.getElementById('learn-mc-action').style.display = 'flex';
            });
            optionsGrid.appendChild(btn);
        });

        document.getElementById('learn-mc-next').addEventListener('click', () => {
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });

        if (settings.autoSpeak && window.speakText) {
            window.speakText(questionText, window.currentSet.lang_col1);
        }
    }

    function renderSpelling(card) {
        const questionText = settings.swapSides ? card.definition : card.term;
        const correctAnswer = settings.swapSides ? card.term : card.definition;
        const questionLabel = window.currentSet.mode === 'talen'
            ? (settings.swapSides ? (window.currentSet.lang_col2 || 'Definitie') : (window.currentSet.lang_col1 || 'Term'))
            : (settings.swapSides ? 'Definitie' : 'Term');

        cardArea.innerHTML = `
            <div class="learn-mc-question-card">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-card-label">${escapeHtml(questionLabel)}</div>
                <div class="learn-card-text">${escapeHtml(questionText)}</div>
            </div>
            <form id="learn-sp-form" class="learn-sp-form" autocomplete="off" onsubmit="return false;">
                <div class="learn-sp-input-wrapper">
                    <input type="text" id="learn-sp-input" class="learn-sp-input" placeholder="Typ je antwoord hier..." autofocus>
                </div>
                <div id="learn-sp-feedback" style="display: none;"></div>
                <div class="learn-controls">
                    <button type="button" class="btn-control" id="learn-sp-skip" style="background: transparent; border-color: rgba(255,255,255,0.1);">
                        Overslaan
                    </button>
                    <button type="submit" class="btn-control" id="learn-sp-submit" style="background: var(--primary); color: #fff;">
                        Controleren
                    </button>
                </div>
            </form>
        `;

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', () => {
            if (window.speakText) {
                window.speakText(questionText, window.currentSet.lang_col1);
            }
        });

        const form = document.getElementById('learn-sp-form');
        const input = document.getElementById('learn-sp-input');
        const feedback = document.getElementById('learn-sp-feedback');
        const submitBtn = document.getElementById('learn-sp-submit');
        const skipBtn = document.getElementById('learn-sp-skip');
        let answered = false;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (answered) {
                lastCardKey = getCardKey(card);
                showNextQuestion();
                return;
            }

            const inputVal = input.value.trim();
            const correct = checkSpellingAnswer(inputVal, correctAnswer);
            answered = true;
            input.disabled = true;
            skipBtn.style.display = 'none';
            submitBtn.textContent = 'Volgende';

            if (correct) {
                advanceCardLevel(card, 3);
                feedback.innerHTML = `
                    <div class="learn-sp-feedback-card correct">
                        <div class="learn-sp-feedback-status correct">
                            <span class="material-symbols-rounded">check_circle</span>
                            Helemaal goed!
                        </div>
                        <div class="learn-sp-feedback-detail">${escapeHtml(correctAnswer)}</div>
                    </div>
                `;
            } else {
                cardLevels.set(getCardKey(card), normalizeCardLevel(1));
                failedInCurrentBatch.add(getCardKey(card));
                feedback.innerHTML = `
                    <div class="learn-sp-feedback-card incorrect">
                        <div class="learn-sp-feedback-status incorrect">
                            <span class="material-symbols-rounded">cancel</span>
                            Helaas, onjuist.
                        </div>
                        <div class="learn-sp-feedback-detail">Jouw antwoord: <span class="learn-sp-feedback-original">${escapeHtml(inputVal || '(leeg)')}</span></div>
                        <div class="learn-sp-feedback-detail" style="font-weight: 600;">Correct antwoord: ${escapeHtml(correctAnswer)}</div>
                    </div>
                `;
            }
            feedback.style.display = 'block';
        });

        skipBtn.addEventListener('click', () => {
            if (answered) return;
            input.value = '';
            submitBtn.click();
        });

        if (settings.autoSpeak && window.speakText) {
            window.speakText(questionText, window.currentSet.lang_col1);
        }
    }

    function checkSpellingAnswer(userInput, correctAnswer) {
        return window.checkSpellingAnswer(userInput, correctAnswer, {
            skipPunctuation: settings.skipPunctuation,
            allowSlashParts: settings.allowSlashParts,
            ignoreParentheses: settings.ignoreParentheses
        });
    }

    function showCelebration() {
        cardArea.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <span class="material-symbols-rounded" style="font-size: 5em; color: var(--primary); margin-bottom: 20px; animation: bounce 1s infinite alternate;">emoji_events</span>
                <h2 class="learn-title" style="font-size: 2em; margin-bottom: 10px;">Gefeliciteerd!</h2>
                <p style="color: var(--text-muted); margin-bottom: 30px;">Je hebt alle kaarten in deze set volledig geleerd!</p>
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <button class="btn-control" id="learn-restart">Opnieuw starten</button>
                    <button class="btn-control" id="learn-finish-close" style="background: rgba(255,255,255,0.1);">Sluiten</button>
                </div>
            </div>
        `;

        document.getElementById('learn-restart').addEventListener('click', () => {
            initializeSession();
        });

        document.getElementById('learn-finish-close').addEventListener('click', closeLearn);
    }

    function closeLearn() {
        document.removeEventListener('click', clickOutsideHandler);
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        if (mainWrapper) {
            Array.from(mainWrapper.children).forEach(child => {
                if (child !== overlay) {
                    child.style.display = child.getAttribute('data-prev-display') || '';
                    child.removeAttribute('data-prev-display');
                }
            });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    initializeSession();
}
