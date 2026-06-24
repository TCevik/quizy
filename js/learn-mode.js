import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml, checkSpellingAnswer } from './main.js';

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
    const isOwner = state.currentUser && state.currentSet && state.currentSet.user_id === state.currentUser.id;
    if (!state.currentSet || !state.currentSet.cards || state.currentSet.cards.length === 0) {
        Toast.show('Deze set heeft geen kaarten om te leren.', 'error');
        return;
    }

    const mainWrapper = document.querySelector('main.set-wrapper');
    let overlay = document.getElementById('learn-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'learn-overlay';
        overlay.className = 'learn-overlay';
        document.body.appendChild(overlay);
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

    const originalCards = state.currentSet.cards;
    const hasStarred = originalCards.some(c => c.starred);

    const savedSettings = (state.currentSet && state.currentSet.settings) || {};
    let settings = {
        flashcards: ('learn_flashcards' in savedSettings) ? !!savedSettings.learn_flashcards : true,
        multipleChoice: ('learn_multipleChoice' in savedSettings) ? !!savedSettings.learn_multipleChoice : true,
        spelling: ('learn_spelling' in savedSettings) ? !!savedSettings.learn_spelling : true,
        starOnly: ('starOnly' in savedSettings) ? !!savedSettings.starOnly : false,
        randomize: ('randomize' in savedSettings) ? !!savedSettings.randomize : true,
        swapSides: ('swapSides' in savedSettings) ? !!savedSettings.swapSides : false,
        autoSpeak: ('autoSpeak' in savedSettings) ? !!savedSettings.autoSpeak : false,
        ignoreParentheses: ('ignoreParentheses' in savedSettings) ? !!savedSettings.ignoreParentheses : true,
        skipPunctuation: ('skipPunctuation' in savedSettings) ? !!savedSettings.skipPunctuation : true,
        allowSlashParts: ('allowSlashParts' in savedSettings) ? !!savedSettings.allowSlashParts : true
    };

    if (!hasStarred) {
        settings.starOnly = false;
        if (state.currentSet && state.currentSet.settings && state.currentSet.settings.starOnly) {
            state.currentSet.settings.starOnly = false;
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
                <span class="learn-title">${escapeHtml(state.currentSet.title || 'Leermodus')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="learn-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="learn-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>

            <!-- Settings Panel Component -->
                    <quizy-settings-panel id="learn-settings-panel" mode="learn"></quizy-settings-panel>
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

        <!-- Custom Confirmation Modal Component placed outside learn-container to prevent transform/perspective containment -->
        <quizy-confirm-modal id="learn-confirm-modal"></quizy-confirm-modal>
    `;

    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const cardArea = document.getElementById('learn-card-area');
    const batchDotsContainer = document.getElementById('learn-batch-dots');
    const progressText = document.getElementById('learn-progress-text');
    const progressFill = document.getElementById('learn-progress-fill');
    const closeBtn = document.getElementById('learn-close');
    // Settings elements
    const settingsBtn = document.getElementById('learn-settings-btn');
    const settingsPanel = document.getElementById('learn-settings-panel');
    const confirmModal = document.getElementById('learn-confirm-modal');

    closeBtn.addEventListener('click', closeLearn);

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (settingsPanel.classList.contains('active')) {
            settingsPanel.close();
        } else {
            const hasStarred = (state.currentSet.cards || []).some(c => c.starred);
            settingsPanel.open(
                settings,
                hasStarred,
                state.currentSet.mode === 'talen',
                state.currentSet.lang1,
                state.currentSet.lang2
            );
        }
    });

    settingsPanel.addEventListener('save', (e) => {
        const { 
            flashcards: fc, 
            multipleChoice: mc, 
            spelling: sp, 
            starOnly: star,
            randomize,
            swapSides,
            autoSpeak,
            ignoreParentheses,
            skipPunctuation,
            allowSlashParts
        } = e.detail;

        if (!fc && !mc && !sp) {
            Toast.show('Minimaal één leermethode moet actief zijn.', 'error');
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
            settings.randomize = randomize;
            settings.swapSides = swapSides;
            settings.autoSpeak = autoSpeak;
            settings.ignoreParentheses = ignoreParentheses;
            settings.skipPunctuation = skipPunctuation;
            settings.allowSlashParts = allowSlashParts;

            if (state.currentSet) {
                state.currentSet.settings = {
                    ...(state.currentSet.settings || {}),
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
                if (isOwner && state.saveAndSyncCurrentSet) {
                    state.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }

            settingsPanel.close();
            
            if (restart) {
                initializeSession();
            } else {
                showNextQuestion();
            }
        };

        if (methodsChanged) {
            confirmModal.open({
                title: 'Sessie herstarten?',
                message: "Als je de leermethodes of de 'Alleen ster'-modus aanpast, wordt je huidige sessie opnieuw gestart.",
                sub: 'Weet je zeker dat je wilt doorgaan?'
            });

            const onConfirm = () => {
                confirmModal.removeEventListener('confirm', onConfirm);
                applySettings(true);
            };
            confirmModal.addEventListener('confirm', onConfirm);
        } else {
            applySettings(false);
        }
    });

    const clickOutsideHandler = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPanel.close();
        }
    };
    document.addEventListener('click', clickOutsideHandler);


    function getCardKey(card) {
        return `idx_${state.currentSet.cards.indexOf(card)}`;
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
        const questionLabel = state.currentSet.mode === 'talen' 
            ? (settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
            : (settings.swapSides ? 'Definitie' : 'Term');
        const answerLabel = state.currentSet.mode === 'talen'
            ? (settings.swapSides ? (state.currentSet.lang_col1 || 'Term') : (state.currentSet.lang_col2 || 'Definitie'))
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
            const lang = wrapper.classList.contains('flipped') ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
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

        if (settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
    }

    function renderMultipleChoice(card) {
        const questionText = settings.swapSides ? card.definition : card.term;
        const correctText = settings.swapSides ? card.term : card.definition;
        const questionLabel = state.currentSet.mode === 'talen'
            ? (settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
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
            speakText(questionText, state.currentSet.lang_col1);
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

        if (settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
    }

    function renderSpelling(card) {
        const questionText = settings.swapSides ? card.definition : card.term;
        const correctAnswer = settings.swapSides ? card.term : card.definition;
        const questionLabel = state.currentSet.mode === 'talen'
            ? (settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
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
            speakText(questionText, state.currentSet.lang_col1);
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
            const correct = checkSpellingAnswer(inputVal, correctAnswer, {
                skipPunctuation: settings.skipPunctuation,
                allowSlashParts: settings.allowSlashParts,
                ignoreParentheses: settings.ignoreParentheses
            });
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

        if (settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
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
        const mWrapper = document.querySelector('main.set-wrapper');
        if (mWrapper) {
            Array.from(mWrapper.children).forEach(child => {
                if (child !== overlay) {
                    child.style.display = child.getAttribute('data-prev-display') || '';
                    child.removeAttribute('data-prev-display');
                }
            });
        }
    }


    initializeSession();
}
