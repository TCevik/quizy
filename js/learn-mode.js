import { BaseQuiz } from './base-quiz.js';
import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml, checkSpellingAnswer } from './main.js';

class LearnModeQuiz extends BaseQuiz {
    constructor() {
        super('learn', 'learn-overlay', 'learn-overlay');
        this.cardLevels = new Map();
        this.activeBatch = [];
        this.batchSize = 5;
        this.lastCardKey = null;
        this.failedInCurrentBatch = new Set();
        this.nextQueueIndex = 0;
        this.clickOutsideHandler = null;
    }

    open(options = {}) {
        const savedSettings = (state.currentSet && state.currentSet.settings) || {};
        const mappedOptions = {
            flashcards: 'flashcards' in options ? !!options.flashcards : ('learn_flashcards' in savedSettings ? !!savedSettings.learn_flashcards : true),
            multipleChoice: 'multipleChoice' in options ? !!options.multipleChoice : ('learn_multipleChoice' in savedSettings ? !!savedSettings.learn_multipleChoice : true),
            spelling: 'spelling' in options ? !!options.spelling : ('learn_spelling' in savedSettings ? !!savedSettings.learn_spelling : true),
            starOnly: 'starOnly' in options ? !!options.starOnly : ('starOnly' in savedSettings ? !!savedSettings.starOnly : false),
            randomize: 'randomize' in options ? !!options.randomize : ('randomize' in savedSettings ? !!savedSettings.randomize : true),
            swapSides: 'swapSides' in options ? !!options.swapSides : ('swapSides' in savedSettings ? !!savedSettings.swapSides : false),
            autoSpeak: 'autoSpeak' in options ? !!options.autoSpeak : ('autoSpeak' in savedSettings ? !!savedSettings.autoSpeak : false),
            ignoreParentheses: 'ignoreParentheses' in options ? !!options.ignoreParentheses : ('ignoreParentheses' in savedSettings ? !!savedSettings.ignoreParentheses : true),
            skipPunctuation: 'skipPunctuation' in options ? !!options.skipPunctuation : ('skipPunctuation' in savedSettings ? !!savedSettings.skipPunctuation : true),
            allowSlashParts: 'allowSlashParts' in options ? !!options.allowSlashParts : ('allowSlashParts' in savedSettings ? !!savedSettings.allowSlashParts : true)
        };

        const success = this.initSession(mappedOptions, mappedOptions);
        if (!success) return;

        this.renderLayout();
        this.setupElements();
        this.addEventListeners();
        this.initializeSession();
    }

    renderLayout() {
        const mainContent = `
            <div class="learn-container" style="position: relative;">
                <div class="learn-header">
                    <span class="learn-title">${escapeHtml(state.currentSet.title || 'Leermodus')}</span>
                    <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                        <button class="btn-close-flashcards" id="learn-info-btn" title="Toetsenbord sneltoetsen" style="transform: none;">
                            <span class="material-symbols-rounded">info</span>
                        </button>
                        <button class="btn-close-flashcards" id="learn-settings-btn" title="Instellingen" style="transform: none;">
                            <span class="material-symbols-rounded">settings</span>
                        </button>
                        <button class="btn-close-flashcards" id="learn-close">
                            <span class="material-symbols-rounded">close</span>
                        </button>
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

            <quizy-confirm-modal id="learn-confirm-modal"></quizy-confirm-modal>
            <quizy-keybinds-modal id="learn-keybinds-modal" mode="learn"></quizy-keybinds-modal>
        `;
        this.overlay.innerHTML = this.wrapWithAds(mainContent);
        this.triggerAds();
    }

    setupElements() {
        this.cardArea = this.overlay.querySelector('#learn-card-area');
        this.batchDotsContainer = this.overlay.querySelector('#learn-batch-dots');
        this.progressText = this.overlay.querySelector('#learn-progress-text');
        this.progressFill = this.overlay.querySelector('#learn-progress-fill');
        this.closeBtn = this.overlay.querySelector('#learn-close');
        this.settingsBtn = this.overlay.querySelector('#learn-settings-btn');
        this.settingsPanel = this.overlay.querySelector('#learn-settings-panel');
        this.confirmModal = this.overlay.querySelector('#learn-confirm-modal');
        this.infoBtn = this.overlay.querySelector('#learn-info-btn');
        this.keybindsModal = this.overlay.querySelector('#learn-keybinds-modal');
    }

    addEventListeners() {
        if (this.infoBtn && this.keybindsModal) {
            this.infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.keybindsModal.open('learn');
            });
        }

        this.closeBtn.addEventListener('click', () => this.closeOverlay());

        this.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.settingsPanel.classList.contains('active')) {
                this.settingsPanel.close();
            } else {
                const hasStarred = (state.currentSet.cards || []).some(c => c.starred);
                this.settingsPanel.open(
                    this.settings,
                    hasStarred,
                    state.currentSet.mode === 'talen',
                    state.currentSet.lang1,
                    state.currentSet.lang2
                );
            }
        });

        this.settingsPanel.addEventListener('save', async (e) => {
            const newSettings = e.detail;

            if (!newSettings.flashcards && !newSettings.multipleChoice && !newSettings.spelling) {
                Toast.show('Minimaal één leermethode moet actief zijn.', 'error');
                return;
            }

            const methodsChanged = (newSettings.flashcards !== this.settings.flashcards) || 
                                   (newSettings.multipleChoice !== this.settings.multipleChoice) || 
                                   (newSettings.spelling !== this.settings.spelling) || 
                                   (newSettings.starOnly !== this.settings.starOnly);

            const applyNewSettings = async (restart) => {
                // Save settings in DB with mapped names
                const saveMapped = {
                    learn_flashcards: newSettings.flashcards,
                    learn_multipleChoice: newSettings.multipleChoice,
                    learn_spelling: newSettings.spelling,
                    starOnly: newSettings.starOnly,
                    randomize: newSettings.randomize,
                    swapSides: newSettings.swapSides,
                    autoSpeak: newSettings.autoSpeak,
                    ignoreParentheses: newSettings.ignoreParentheses,
                    skipPunctuation: newSettings.skipPunctuation,
                    allowSlashParts: newSettings.allowSlashParts
                };
                
                await this.saveSettings(saveMapped);
                
                // Update local memory settings
                Object.assign(this.settings, newSettings);

                this.settingsPanel.close();
                
                if (restart) {
                    this.closeOverlay();
                    this.open(newSettings);
                } else {
                    this.showNextQuestion();
                }
            };

            if (methodsChanged) {
                this.confirmModal.open({
                    title: 'Sessie herstarten?',
                    message: "Als je de leermethodes of de 'Alleen ster'-modus aanpast, wordt je huidige sessie opnieuw gestart.",
                    sub: 'Weet je zeker dat je wilt doorgaan?'
                });

                const onConfirm = () => {
                    this.confirmModal.removeEventListener('confirm', onConfirm);
                    applyNewSettings(true);
                };
                this.confirmModal.addEventListener('confirm', onConfirm);
            } else {
                applyNewSettings(false);
            }
        });

        this.clickOutsideHandler = (e) => {
            if (!this.settingsPanel.contains(e.target) && e.target !== this.settingsBtn && !this.settingsBtn.contains(e.target)) {
                this.settingsPanel.close();
            }
        };
        document.addEventListener('click', this.clickOutsideHandler);

        this.keydownHandler = (e) => {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
                return;
            }
            if (this.settingsPanel.classList.contains('active') || (this.keybindsModal && this.keybindsModal.classList.contains('active'))) {
                return;
            }

            if (this.currentSubMode === 'flashcards') {
                if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                    e.preventDefault();
                    const wrapper = this.cardArea.querySelector('#learn-card-wrapper');
                    if (wrapper) wrapper.click();
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    const wrongBtn = this.cardArea.querySelector('#learn-btn-no');
                    if (wrongBtn) wrongBtn.click();
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    const correctBtn = this.cardArea.querySelector('#learn-btn-yes');
                    if (correctBtn) correctBtn.click();
                }
            } else if (this.currentSubMode === 'multiple-choice') {
                const optionsGrid = this.cardArea.querySelector('#learn-mc-options');
                const nextBtn = this.cardArea.querySelector('#learn-mc-next');
                const answered = nextBtn && nextBtn.style.display !== 'none';
                
                if (!answered && optionsGrid) {
                    const totalOptions = optionsGrid.children.length;
                    if (e.code === 'ArrowDown') {
                        e.preventDefault();
                        if (this.keyboardSelectedIndex !== -1 && this.keyboardSelectedIndex < totalOptions) {
                            optionsGrid.children[this.keyboardSelectedIndex].classList.remove('keyboard-selected');
                        }
                        this.keyboardSelectedIndex = (this.keyboardSelectedIndex + 1) % totalOptions;
                        optionsGrid.children[this.keyboardSelectedIndex].classList.add('keyboard-selected');
                    } else if (e.code === 'ArrowUp') {
                        e.preventDefault();
                        if (this.keyboardSelectedIndex !== -1 && this.keyboardSelectedIndex < totalOptions) {
                            optionsGrid.children[this.keyboardSelectedIndex].classList.remove('keyboard-selected');
                        }
                        this.keyboardSelectedIndex = (this.keyboardSelectedIndex - 1 + totalOptions) % totalOptions;
                        optionsGrid.children[this.keyboardSelectedIndex].classList.add('keyboard-selected');
                    } else if (e.code === 'Enter') {
                        e.preventDefault();
                        if (this.keyboardSelectedIndex !== -1 && this.keyboardSelectedIndex < totalOptions) {
                            optionsGrid.children[this.keyboardSelectedIndex].click();
                        }
                    } else {
                        const optionIndex = ['KeyA', 'KeyB', 'KeyC', 'KeyD'].indexOf(e.code);
                        if (optionIndex !== -1 && optionIndex < totalOptions) {
                            e.preventDefault();
                            optionsGrid.children[optionIndex].click();
                        } else {
                            const numberIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
                            if (numberIndex !== -1 && numberIndex < totalOptions) {
                                e.preventDefault();
                                optionsGrid.children[numberIndex].click();
                            }
                        }
                    }
                } else if (answered && nextBtn) {
                    if (e.code === 'Enter' || e.code === 'Space') {
                        e.preventDefault();
                        nextBtn.click();
                    }
                }
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }

    getStartingLevel() {
        if (this.settings.flashcards) return 0;
        if (this.settings.multipleChoice) return 1;
        return 2;
    }

    getMaxLevel() {
        if (this.settings.spelling) return 3;
        if (this.settings.multipleChoice) return 2;
        return 1;
    }

    normalizeCardLevel(lvl) {
        let current = lvl;
        const start = this.getStartingLevel();
        const max = this.getMaxLevel();

        if (current < start) {
            current = start;
        }
        if (current === 0 && !this.settings.flashcards) {
            current = 1;
        }
        if (current === 1 && !this.settings.multipleChoice) {
            current = 2;
        }
        if (current === 2 && !this.settings.spelling) {
            current = 3;
        }
        if (current > max) {
            current = max;
        }
        return current;
    }

    advanceCardLevel(card, newRawLevel) {
        const key = this.getCardKey(card);
        this.cardLevels.set(key, newRawLevel);
        const normalized = this.normalizeCardLevel(newRawLevel);
        if (normalized >= this.getMaxLevel()) {
            const idx = this.activeBatch.findIndex(c => this.getCardKey(c) === key);
            if (idx !== -1) {
                this.activeBatch.splice(idx, 1);
            }
        }
    }

    initializeSession() {
        this.cardLevels.clear();
        this.activeQueue.forEach(card => {
            this.cardLevels.set(this.getCardKey(card), this.getStartingLevel());
        });

        this.activeBatch = [];
        this.lastCardKey = null;
        this.failedInCurrentBatch.clear();
        this.nextQueueIndex = 0;

        this.fillActiveBatch();
        this.showNextQuestion();
    }

    fillActiveBatch() {
        if (this.activeBatch.length === 0) {
            this.failedInCurrentBatch.forEach(key => {
                this.cardLevels.set(key, this.getStartingLevel());
            });
            this.failedInCurrentBatch.clear();

            while (this.activeBatch.length < this.batchSize) {
                let found = false;
                for (let i = 0; i < this.activeQueue.length; i++) {
                    const idx = (this.nextQueueIndex + i) % this.activeQueue.length;
                    const c = this.activeQueue[idx];
                    const key = this.getCardKey(c);
                    if (this.normalizeCardLevel(this.cardLevels.get(key)) < this.getMaxLevel() && !this.activeBatch.some(bc => this.getCardKey(bc) === key)) {
                        this.activeBatch.push(c);
                        this.nextQueueIndex = (idx + 1) % this.activeQueue.length;
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }
        }
    }

    updateProgress() {
        if (this.activeQueue.length === 0) {
            this.progressText.textContent = 'Voortgang: 0%';
            this.progressFill.style.width = '0%';
            return;
        }

        let totalLevels = 0;
        this.cardLevels.forEach((lvl, key) => {
            const normalized = this.normalizeCardLevel(lvl);
            totalLevels += (normalized - this.getStartingLevel());
        });

        const maxDiff = this.getMaxLevel() - this.getStartingLevel();
        const maxLevels = this.activeQueue.length * maxDiff;
        const percentage = maxLevels > 0 ? Math.round((totalLevels / maxLevels) * 100) : 100;
        this.progressText.textContent = `Voortgang: ${percentage}%`;
        this.progressFill.style.width = `${percentage}%`;

        this.batchDotsContainer.innerHTML = '';
        this.activeBatch.forEach(card => {
            const lvl = this.normalizeCardLevel(this.cardLevels.get(this.getCardKey(card)));
            const dot = document.createElement('div');
            dot.className = `learn-batch-dot level-${lvl}`;
            this.batchDotsContainer.appendChild(dot);
        });
    }

    showNextQuestion() {
        this.fillActiveBatch();
        this.updateProgress();

        if (this.activeBatch.length === 0) {
            this.showCelebration();
            return;
        }

        let selectedCard = null;
        if (this.activeBatch.length === 1) {
            selectedCard = this.activeBatch[0];
        } else {
            const candidates = this.activeBatch.filter(c => this.getCardKey(c) !== this.lastCardKey);
            if (candidates.length > 0) {
                selectedCard = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                selectedCard = this.activeBatch[Math.floor(Math.random() * this.activeBatch.length)];
            }
        }

        const key = this.getCardKey(selectedCard);
        const level = this.normalizeCardLevel(this.cardLevels.get(key));

        if (level === 0) {
            this.renderFlashcard(selectedCard);
        } else if (level === 1) {
            this.renderMultipleChoice(selectedCard);
        } else if (level === 2) {
            this.renderSpelling(selectedCard);
        }
    }

    renderFlashcard(card) {
        this.currentSubMode = 'flashcards';
        const questionText = this.settings.swapSides ? card.definition : card.term;
        const answerText = this.settings.swapSides ? card.term : card.definition;
        const questionLabel = state.currentSet.mode === 'talen' 
            ? (this.settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
            : (this.settings.swapSides ? 'Definitie' : 'Term');
        const answerLabel = state.currentSet.mode === 'talen'
            ? (this.settings.swapSides ? (state.currentSet.lang_col1 || 'Term') : (state.currentSet.lang_col2 || 'Definitie'))
            : (this.settings.swapSides ? 'Term' : 'Definitie');

        this.cardArea.innerHTML = `
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

        const wrapper = this.cardArea.querySelector('#learn-card-wrapper');
        wrapper.addEventListener('click', () => {
            wrapper.classList.toggle('flipped');
        });

        const speakBtn = this.cardArea.querySelector('#learn-speak');
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = wrapper.classList.contains('flipped') ? answerText : questionText;
            const lang = wrapper.classList.contains('flipped') ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        });

        this.cardArea.querySelector('#learn-btn-no').addEventListener('click', () => {
            this.failedInCurrentBatch.add(this.getCardKey(card));
            this.lastCardKey = this.getCardKey(card);
            this.showNextQuestion();
        });

        this.cardArea.querySelector('#learn-btn-yes').addEventListener('click', () => {
            this.advanceCardLevel(card, 1);
            this.lastCardKey = this.getCardKey(card);
            this.showNextQuestion();
        });

        if (this.settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
    }

    renderMultipleChoice(card) {
        this.currentSubMode = 'multiple-choice';
        this.keyboardSelectedIndex = -1;
        const questionText = this.settings.swapSides ? card.definition : card.term;
        const correctText = this.settings.swapSides ? card.term : card.definition;
        const questionLabel = state.currentSet.mode === 'talen'
            ? (this.settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
            : (this.settings.swapSides ? 'Definitie' : 'Term');

        const otherCards = this.originalCards.filter(c => this.getCardKey(c) !== this.getCardKey(card));
        const potentialDistractors = [...new Set(otherCards.map(c => this.settings.swapSides ? c.term : c.definition))].filter(t => t !== correctText);
        
        this.shuffleArray(potentialDistractors);
        const distractors = potentialDistractors.slice(0, 3);
        const options = [correctText, ...distractors];
        this.shuffleArray(options);

        this.cardArea.innerHTML = `
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

        const speakBtn = this.cardArea.querySelector('#learn-speak');
        speakBtn.addEventListener('click', () => {
            speakText(questionText, state.currentSet.lang_col1);
        });

        const optionsGrid = this.cardArea.querySelector('#learn-mc-options');
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
                    this.advanceCardLevel(card, 2);
                } else {
                    btn.classList.add('incorrect');
                    this.cardLevels.set(this.getCardKey(card), 0);
                    this.failedInCurrentBatch.add(this.getCardKey(card));
                }

                this.cardArea.querySelector('#learn-mc-action').style.display = 'flex';
            });
            optionsGrid.appendChild(btn);
        });

        this.cardArea.querySelector('#learn-mc-next').addEventListener('click', () => {
            this.lastCardKey = this.getCardKey(card);
            this.showNextQuestion();
        });

        if (this.settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
    }

    renderSpelling(card) {
        this.currentSubMode = 'spelling';
        const questionText = this.settings.swapSides ? card.definition : card.term;
        const correctAnswer = this.settings.swapSides ? card.term : card.definition;
        const questionLabel = state.currentSet.mode === 'talen'
            ? (this.settings.swapSides ? (state.currentSet.lang_col2 || 'Definitie') : (state.currentSet.lang_col1 || 'Term'))
            : (this.settings.swapSides ? 'Definitie' : 'Term');

        this.cardArea.innerHTML = `
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

        const speakBtn = this.cardArea.querySelector('#learn-speak');
        speakBtn.addEventListener('click', () => {
            speakText(questionText, state.currentSet.lang_col1);
        });

        const form = this.cardArea.querySelector('#learn-sp-form');
        const input = this.cardArea.querySelector('#learn-sp-input');
        const feedback = this.cardArea.querySelector('#learn-sp-feedback');
        const submitBtn = this.cardArea.querySelector('#learn-sp-submit');
        const skipBtn = this.cardArea.querySelector('#learn-sp-skip');
        let answered = false;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (answered) {
                this.lastCardKey = this.getCardKey(card);
                this.showNextQuestion();
                return;
            }

            const inputVal = input.value.trim();
            const correct = checkSpellingAnswer(inputVal, correctAnswer, {
                skipPunctuation: this.settings.skipPunctuation,
                allowSlashParts: this.settings.allowSlashParts,
                ignoreParentheses: this.settings.ignoreParentheses
            });
            answered = true;
            input.disabled = true;
            skipBtn.style.display = 'none';
            submitBtn.textContent = 'Volgende';

            if (correct) {
                this.advanceCardLevel(card, 3);
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
                this.cardLevels.set(this.getCardKey(card), this.normalizeCardLevel(1));
                this.failedInCurrentBatch.add(this.getCardKey(card));
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

        if (this.settings.autoSpeak) {
            speakText(questionText, state.currentSet.lang_col1);
        }
    }

    showCelebration() {
        this.cardArea.innerHTML = `
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

        this.cardArea.querySelector('#learn-restart').addEventListener('click', () => {
            this.initializeSession();
        });

        this.cardArea.querySelector('#learn-finish-close').addEventListener('click', () => {
            this.closeOverlay();
        });
    }

    cleanupListeners() {
        super.cleanupListeners();
        if (this.clickOutsideHandler) {
            document.removeEventListener('click', this.clickOutsideHandler);
        }
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
    }
}

const learnModeInstance = new LearnModeQuiz();

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnLearnMode = e.target.closest('#btn-learn-mode');
        if (btnLearnMode) {
            e.preventDefault();
            learnModeInstance.open();
        }
    });
});
