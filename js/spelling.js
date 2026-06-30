import { BaseQuiz } from './base-quiz.js';
import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml, checkSpellingAnswer as checkSpellingHelper } from './main.js';

class SpellingQuiz extends BaseQuiz {
    constructor() {
        super('spelling', 'sp-overlay', 'sp-overlay');
        this.answered = false;
        this.clickOutsideHandler = null;
    }

    open(options = {}) {
        const success = this.initSession(options, {
            starOnly: false,
            randomize: true,
            swapSides: false,
            autoSpeak: false,
            timePressure: false,
            ignoreParentheses: true,
            skipPunctuation: true,
            allowSlashParts: true,
            allowTypos: true
        });
        if (!success) return;

        this.renderLayout();
        this.setupElements();
        this.addEventListeners();
        this.updateQuestion();
    }

    renderLayout() {
        const totalUniqueCards = this.originalCards.length;
        const mainContent = `
            <div class="sp-container" style="position: relative;">
                <div class="sp-header">
                    <span class="sp-title">${escapeHtml(state.currentSet.title || 'Spelling')}</span>
                    <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                        <button class="btn-close-flashcards" id="sp-info-btn" title="Toetsenbord sneltoetsen" style="transform: none;">
                            <span class="material-symbols-rounded">info</span>
                        </button>
                        <button class="btn-close-flashcards" id="sp-settings-btn" title="Instellingen" style="transform: none;">
                            <span class="material-symbols-rounded">settings</span>
                        </button>
                        <button class="btn-close-flashcards" id="sp-close">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                        <quizy-settings-panel id="sp-settings-panel" mode="spelling"></quizy-settings-panel>
                    </div>
                </div>

                <div class="quizy-timer-bar-container" style="display: ${this.settings.timePressure ? 'block' : 'none'}; width: 100%; height: 6px; background: rgba(255,255,255,0.05); overflow: hidden; margin-top: -10px; margin-bottom: 16px; border-radius: 3px;">
                    <div class="quizy-timer-bar-fill" style="width: 100%; height: 100%; background: var(--orange); transition: width 0.1s linear;"></div>
                </div>

                <div class="sp-question-card" id="sp-question">
                    <button class="btn-sp-speak" title="Uitspreken">
                        <span class="material-symbols-rounded">volume_up</span>
                    </button>
                    <button class="btn-sp-star" ${this.isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                        <span class="material-symbols-rounded">star</span>
                    </button>
                    <div class="sp-question-label" id="sp-question-label">Schrijf de vertaling</div>
                    <div class="sp-question-text" id="sp-question-text">Laden...</div>
                </div>

                <div style="width: 100%;">
                    <form id="sp-form" class="sp-input-form" autocomplete="off" onsubmit="return false;">
                        <div class="sp-input-wrapper">
                            <input type="text" id="sp-user-input" class="sp-input" placeholder="Typ je antwoord hier..." autofocus>
                        </div>
                        
                        <div id="sp-feedback-container"></div>

                        <div class="sp-action-area">
                            <button type="button" class="btn-sp-action secondary" id="sp-btn-override" style="display: none;"></button>
                            <button type="button" class="btn-sp-action secondary" id="sp-btn-skip">
                                Overslaan
                            </button>
                            <button type="submit" class="btn-sp-action primary" id="sp-btn-submit">
                                Controleren
                            </button>
                        </div>
                    </form>
                </div>

                <div class="progress-container">
                    <span class="progress-text" id="sp-progress-text">Geleerd: 0 van ${totalUniqueCards} kaarten</span>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" id="sp-progress-fill"></div>
                    </div>
                </div>
            </div>

            <quizy-confirm-modal id="sp-confirm-modal"></quizy-confirm-modal>
            <quizy-keybinds-modal id="sp-keybinds-modal" mode="spelling"></quizy-keybinds-modal>
        `;
        this.overlay.innerHTML = mainContent;
    }

    setupElements() {
        this.questionTextEl = this.overlay.querySelector('#sp-question-text');
        this.questionLabelEl = this.overlay.querySelector('#sp-question-label');
        this.userInputEl = this.overlay.querySelector('#sp-user-input');
        this.feedbackContainer = this.overlay.querySelector('#sp-feedback-container');
        this.submitBtn = this.overlay.querySelector('#sp-btn-submit');
        this.skipBtn = this.overlay.querySelector('#sp-btn-skip');
        this.spForm = this.overlay.querySelector('#sp-form');
        this.closeBtn = this.overlay.querySelector('#sp-close');
        this.progressTextEl = this.overlay.querySelector('#sp-progress-text');
        this.progressFillEl = this.overlay.querySelector('#sp-progress-fill');
        this.starBtn = this.overlay.querySelector('.btn-sp-star');
        this.speakBtn = this.overlay.querySelector('.btn-sp-speak');
        this.settingsBtn = this.overlay.querySelector('#sp-settings-btn');
        this.settingsPanel = this.overlay.querySelector('#sp-settings-panel');
        this.confirmModal = this.overlay.querySelector('#sp-confirm-modal');
        this.infoBtn = this.overlay.querySelector('#sp-info-btn');
        this.keybindsModal = this.overlay.querySelector('#sp-keybinds-modal');
        this.overrideBtn = this.overlay.querySelector('#sp-btn-override');
    }

    addEventListeners() {
        if (this.infoBtn && this.keybindsModal) {
            this.infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.keybindsModal.open('spelling');
            });
        }

        if (this.overrideBtn) {
            this.overrideBtn.addEventListener('click', () => {
                this.handleOverride();
            });
        }

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

            const applySettings = async () => {
                this.settingsPanel.close();
                await this.saveSettings(newSettings);
                this.closeOverlay();
                this.open(newSettings);
            };

            if (newSettings.starOnly !== this.settings.starOnly) {
                this.confirmModal.open();
                const onConfirm = () => {
                    this.confirmModal.removeEventListener('confirm', onConfirm);
                    applySettings();
                };
                this.confirmModal.addEventListener('confirm', onConfirm);
            } else {
                await this.saveSettings(newSettings);

                if (newSettings.randomize !== this.settings.randomize) {
                    this.settings.randomize = newSettings.randomize;
                    if (this.settings.randomize) {
                        const remaining = this.activeQueue.slice(this.currentIndex + 1);
                        this.shuffleArray(remaining);
                        this.activeQueue.splice(this.currentIndex + 1, this.activeQueue.length - (this.currentIndex + 1), ...remaining);
                        Toast.show('Vragen worden nu in willekeurige volgorde getoond.', 'success');
                    } else {
                        const remaining = this.activeQueue.slice(this.currentIndex + 1);
                        remaining.sort((a, b) => {
                            return this.originalCards.indexOf(a) - this.originalCards.indexOf(b);
                        });
                        this.activeQueue.splice(this.currentIndex + 1, this.activeQueue.length - (this.currentIndex + 1), ...remaining);
                        Toast.show('Willekeurige volgorde uitgeschakeld. Vragen gaan verder in de originele volgorde.', 'info');
                    }
                }
                
                this.settings.swapSides = newSettings.swapSides;
                this.settings.autoSpeak = newSettings.autoSpeak;
                this.settings.ignoreParentheses = newSettings.ignoreParentheses;
                this.settings.skipPunctuation = newSettings.skipPunctuation;
                this.settings.allowSlashParts = newSettings.allowSlashParts;
                this.settings.allowTypos = newSettings.allowTypos;
                
                if (newSettings.timePressure !== this.settings.timePressure) {
                    this.settings.timePressure = newSettings.timePressure;
                    const timerContainer = this.overlay.querySelector('.quizy-timer-bar-container');
                    if (timerContainer) {
                        timerContainer.style.display = this.settings.timePressure ? 'block' : 'none';
                    }
                    if (this.settings.timePressure) {
                        this.triggerTimer();
                    } else {
                        this.stopTimer();
                    }
                    Toast.show(this.settings.timePressure ? 'Tijdsdruk ingeschakeld.' : 'Tijdsdruk uitgeschakeld.', 'success');
                }
                
                this.updateQuestion();
                this.settingsPanel.close();
            }
        });

        this.clickOutsideHandler = (e) => {
            if (!this.settingsPanel.contains(e.target) && e.target !== this.settingsBtn && !this.settingsBtn.contains(e.target)) {
                this.settingsPanel.close();
            }
        };
        document.addEventListener('click', this.clickOutsideHandler);

        this.starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!this.isOwner) return;
            const card = this.activeQueue[this.currentIndex];
            if (!card) return;

            card.starred = !card.starred;
            const isStarred = !!card.starred;
            const icon = this.starBtn.querySelector('.material-symbols-rounded');
            if (isStarred) {
                this.starBtn.classList.add('starred');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                this.starBtn.classList.remove('starred');
                icon.style.fontVariationSettings = "'FILL' 0";
            }

            try {
                const hasStarredNow = state.currentSet && state.currentSet.cards && state.currentSet.cards.some(c => c.starred);
                const starOnlyCheckbox = this.settingsPanel ? this.settingsPanel.querySelector('#setting-star-only') : null;
                if (!hasStarredNow) {
                    if (state.currentSet.settings) {
                        state.currentSet.settings.starOnly = false;
                    }
                    if (starOnlyCheckbox) {
                        starOnlyCheckbox.checked = false;
                        starOnlyCheckbox.disabled = true;
                        const label = this.overlay.querySelector('label[for="sp-star-only"]');
                        const switchEl = this.overlay.querySelector('.fc-switch');
                        if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                        if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                    }
                } else {
                    if (starOnlyCheckbox) {
                        starOnlyCheckbox.disabled = false;
                        const label = this.overlay.querySelector('label[for="sp-star-only"]');
                        const switchEl = this.overlay.querySelector('.fc-switch');
                        if (label) label.style.cssText = '';
                        if (switchEl) switchEl.style.cssText = '';
                    }
                }
                await state.saveAndSyncCurrentSet();
                if (state.refreshTermsList) {
                    state.refreshTermsList();
                }
            } catch (err) {
                card.starred = !card.starred;
                const revertedStarred = !!card.starred;
                if (revertedStarred) {
                    this.starBtn.classList.add('starred');
                    icon.style.fontVariationSettings = "'FILL' 1";
                } else {
                    this.starBtn.classList.remove('starred');
                    icon.style.fontVariationSettings = "'FILL' 0";
                }
                Toast.show('Fout bij bijwerken van ster: ' + err.message, 'error');
            }
        });

        if (this.speakBtn) {
            this.speakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.speakCurrentQuestion();
            });
        }

        this.spForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        this.skipBtn.addEventListener('click', () => {
            this.handleSkip();
        });

        this.closeBtn.addEventListener('click', () => this.closeOverlay());

        this.keydownHandler = (e) => {
            if (this.settingsPanel.classList.contains('active') || (this.keybindsModal && this.keybindsModal.classList.contains('active'))) {
                return;
            }
            if (this.answered && (e.code === 'Enter' || e.code === 'Space')) {
                e.preventDefault();
                this.submitBtn.click();
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }

    checkSpellingAnswer(userInput, correctAnswer) {
        return checkSpellingHelper(userInput, correctAnswer, {
            skipPunctuation: this.settings.skipPunctuation,
            allowSlashParts: this.settings.allowSlashParts,
            ignoreParentheses: this.settings.ignoreParentheses,
            allowTypos: this.settings.allowTypos !== false
        });
    }

    triggerTimer() {
        this.startTimer(() => {
            this.handleSkip();
        });
    }

    updateQuestion() {
        this.answered = false;
        this.feedbackContainer.classList.remove('active');
        const container = this.feedbackContainer;
        setTimeout(() => {
            if (!container.classList.contains('active')) {
                container.innerHTML = '';
            }
        }, 350);
        this.userInputEl.value = '';
        this.userInputEl.disabled = false;
        this.userInputEl.focus();
        this.triggerTimer();
        
        this.submitBtn.textContent = 'Controleren';
        this.skipBtn.style.display = 'inline-flex';
        if (this.overrideBtn) {
            this.overrideBtn.style.display = 'none';
        }
        
        const card = this.activeQueue[this.currentIndex];
        if (!card) return;

        if (this.settings.swapSides) {
            this.questionTextEl.textContent = card.definition;
            if (state.currentSet.mode === 'talen') {
                this.questionLabelEl.textContent = state.currentSet.lang2 || 'Definitie';
            } else {
                this.questionLabelEl.textContent = 'Definitie';
            }
        } else {
            this.questionTextEl.textContent = card.term;
            if (state.currentSet.mode === 'talen') {
                this.questionLabelEl.textContent = state.currentSet.lang1 || 'Term';
            } else {
                this.questionLabelEl.textContent = 'Term';
            }
        }

        const isStarred = !!card.starred;
        const icon = this.starBtn.querySelector('.material-symbols-rounded');
        if (isStarred) {
            this.starBtn.classList.add('starred');
            icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            this.starBtn.classList.remove('starred');
            icon.style.fontVariationSettings = "'FILL' 0";
        }

        const totalUniqueCards = this.originalCards.length;
        const progressPercentage = (this.learnedCardKeys.size / totalUniqueCards) * 100;
        this.progressTextEl.textContent = `Geleerd: ${this.learnedCardKeys.size} van ${totalUniqueCards} kaarten${this.isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        this.progressFillEl.style.width = `${progressPercentage}%`;

        if (this.settings.autoSpeak) {
            this.speakCurrentQuestion();
        }
    }

    speakCurrentQuestion() {
        const card = this.activeQueue[this.currentIndex];
        if (!card) return;
        const text = this.settings.swapSides ? card.definition : card.term;
        const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
        speakText(text, lang);
    }

    checkFinished() {
        if (this.learnedCardKeys.size === this.originalCards.length) {
            this.overlay.innerHTML = `
                <div class="sp-container" style="text-align: center;">
                    <span class="material-symbols-rounded" style="font-size: 5em; color: var(--primary); margin-bottom: 20px;">emoji_events</span>
                    <h2 class="sp-title" style="font-size: 2em; margin-bottom: 10px;">Goed gedaan!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 30px;">Je hebt alle spelling-opdrachten in deze set voltooid!</p>
                    <div style="display: flex; gap: 16px; justify-content: center;">
                        <button class="btn-control" id="sp-restart">Opnieuw oefenen</button>
                        <button class="btn-control" id="sp-finish-close" style="background: rgba(255,255,255,0.1);">Sluiten</button>
                    </div>
                </div>
            `;
            
            this.overlay.querySelector('#sp-restart').addEventListener('click', () => {
                this.cleanupListeners();
                this.open({ 
                    starOnly: this.settings.starOnly, 
                    randomize: this.settings.randomize, 
                    swapSides: this.settings.swapSides, 
                    autoSpeak: this.settings.autoSpeak,
                    ignoreParentheses: this.settings.ignoreParentheses,
                    skipPunctuation: this.settings.skipPunctuation,
                    allowSlashParts: this.settings.allowSlashParts
                });
            });
            this.overlay.querySelector('#sp-finish-close').addEventListener('click', () => {
                this.closeOverlay();
            });
            return true;
        }
        return false;
    }

    handleFormSubmit() {
        if (this.answered) {
            this.stopTimer();
            if (this.checkFinished()) {
                return;
            }
            this.currentIndex++;
            if (this.currentIndex >= this.activeQueue.length) {
                this.isReviewPhase = true;
                const reviewCards = [];
                this.originalCards.forEach(c => {
                    const key = this.getCardKey(c);
                    const failures = this.failureCounts.get(key) || 0;
                    if (failures > 0) {
                        const repetitions = Math.min(3, failures * 2);
                        for (let r = 0; r < repetitions; r++) {
                            reviewCards.push(c);
                        }
                    }
                });
                
                if (reviewCards.length > 0) {
                    this.activeQueue = this.generateNoAdjacentQueue(reviewCards);
                    this.currentIndex = 0;
                }
            }
            this.updateQuestion();
            return;
        }

        this.stopTimer();
        const inputVal = this.userInputEl.value.trim();
        const card = this.activeQueue[this.currentIndex];
        const correctAnswer = this.settings.swapSides ? card.term : card.definition;
        const result = this.checkSpellingAnswer(inputVal, correctAnswer);
        const isCorrect = result.isCorrect;
        this.currentResult = { isCorrect, hasTypo: result.hasTypo, correctAlternative: result.correctAlternative };

        this.answered = true;
        this.userInputEl.disabled = true;
        this.skipBtn.style.display = 'none';
        if (this.overrideBtn) {
            this.overrideBtn.style.display = 'inline-flex';
            this.overrideBtn.textContent = isCorrect ? 'Toch foutrekenen' : 'Toch goedrekenen';
        }
        this.submitBtn.textContent = 'Volgende';

        const cardKey = this.getCardKey(card);

        if (isCorrect) {
            if (this.isReviewPhase) {
                let appearsLater = false;
                for (let i = this.currentIndex + 1; i < this.activeQueue.length; i++) {
                    if (this.getCardKey(this.activeQueue[i]) === cardKey) {
                        appearsLater = true;
                        break;
                    }
                }
                if (!appearsLater) {
                    this.learnedCardKeys.add(cardKey);
                }
            } else {
                if (!this.failureCounts.has(cardKey) || this.failureCounts.get(cardKey) === 0) {
                    this.learnedCardKeys.add(cardKey);
                }
            }

            if (result.hasTypo) {
                const correctAlternativeToShow = result.correctAlternative || correctAnswer;
                this.feedbackContainer.innerHTML = `
                    <div class="sp-feedback-card typo-warning">
                        <span class="material-symbols-rounded feedback-icon">warning</span>
                        <div class="feedback-text-container">
                            <span class="feedback-title">Bijna goed!</span>
                            <span class="feedback-desc">Gerekend als goed, maar let op je spelling: <strong>${escapeHtml(correctAlternativeToShow)}</strong></span>
                        </div>
                    </div>
                `;
            } else {
                this.feedbackContainer.innerHTML = `
                    <div class="sp-feedback-card correct">
                        <span class="material-symbols-rounded feedback-icon">check_circle</span>
                        <div class="feedback-text-container">
                            <span class="feedback-title">Correct!</span>
                            <span class="feedback-desc">Goed gespeld.</span>
                        </div>
                    </div>
                `;
            }
            
            if (this.settings.autoSpeak) {
                const speakAnswerText = this.settings.swapSides ? card.term : card.definition;
                const speakAnswerLang = this.settings.swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
                speakText(speakAnswerText, speakAnswerLang);
            }
        } else {
            this.failureCounts.set(cardKey, (this.failureCounts.get(cardKey) || 0) + 1);

            const offset = Math.floor(Math.random() * 3) + 3;
            const insertIndex = this.currentIndex + 1 + offset;
            if (insertIndex >= this.activeQueue.length) {
                this.activeQueue.push(card);
            } else {
                this.activeQueue.splice(insertIndex, 0, card);
            }

            this.feedbackContainer.innerHTML = `
                <div class="sp-feedback-card incorrect">
                    <span class="material-symbols-rounded feedback-icon">cancel</span>
                    <div class="feedback-text-container">
                        <span class="feedback-title">Onjuist...</span>
                        <span class="feedback-desc">Jouw antwoord: <strong style="color: #ef4444;">${escapeHtml(inputVal || '(leeg)')}</strong></span>
                        <span class="feedback-desc">Correcte spelling: <strong style="color: #43a047;">${escapeHtml(correctAnswer)}</strong></span>
                    </div>
                </div>
            `;
            
            if (this.settings.autoSpeak) {
                const speakAnswerText = this.settings.swapSides ? card.term : card.definition;
                const speakAnswerLang = this.settings.swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
                speakText(speakAnswerText, speakAnswerLang);
            }
        }

        this.feedbackContainer.classList.add('active');
        this.submitBtn.focus();
    }

    handleSkip() {
        if (this.answered) return;
        this.stopTimer();
        const card = this.activeQueue[this.currentIndex];
        const cardKey = this.getCardKey(card);
        this.failureCounts.set(cardKey, (this.failureCounts.get(cardKey) || 0) + 1);

        const offset = Math.floor(Math.random() * 3) + 3;
        const insertIndex = this.currentIndex + 1 + offset;
        if (insertIndex >= this.activeQueue.length) {
            this.activeQueue.push(card);
        } else {
            this.activeQueue.splice(insertIndex, 0, card);
        }

        this.answered = true;
        this.userInputEl.disabled = true;
        this.skipBtn.style.display = 'none';
        this.submitBtn.textContent = 'Volgende';

        const correctAnswer = this.settings.swapSides ? card.term : card.definition;
        this.feedbackContainer.innerHTML = `
            <div class="sp-feedback-card incorrect" style="border-left-color: var(--orange); background: rgba(255, 152, 0, 0.1);">
                <span class="material-symbols-rounded feedback-icon" style="color: var(--orange);">info</span>
                <div class="feedback-text-container">
                    <span class="feedback-title" style="color: var(--orange);">Overslagen</span>
                    <span class="feedback-desc">Het juiste antwoord was: <strong style="color: #43a047;">${escapeHtml(correctAnswer)}</strong></span>
                </div>
            </div>
        `;
        this.feedbackContainer.classList.add('active');
        this.submitBtn.focus();
    }

    handleOverride() {
        const card = this.activeQueue[this.currentIndex];
        const cardKey = this.getCardKey(card);
        const inputVal = this.userInputEl.value.trim();
        const correctAnswer = this.settings.swapSides ? card.term : card.definition;

        if (this.currentResult.isCorrect) {
            // Change to incorrect
            this.currentResult.isCorrect = false;
            
            // Remove from learned
            this.learnedCardKeys.delete(cardKey);
            
            // Increment failure count
            this.failureCounts.set(cardKey, (this.failureCounts.get(cardKey) || 0) + 1);

            // Re-insert into queue
            const offset = Math.floor(Math.random() * 3) + 3;
            const insertIndex = this.currentIndex + 1 + offset;
            if (insertIndex >= this.activeQueue.length) {
                this.activeQueue.push(card);
            } else {
                this.activeQueue.splice(insertIndex, 0, card);
            }

            // Update UI
            this.feedbackContainer.innerHTML = `
                <div class="sp-feedback-card incorrect">
                    <span class="material-symbols-rounded feedback-icon">cancel</span>
                    <div class="feedback-text-container">
                        <span class="feedback-title">Onjuist... (Handmatig afgekeurd)</span>
                        <span class="feedback-desc">Jouw antwoord: <strong style="color: #ef4444;">${escapeHtml(inputVal || '(leeg)')}</strong></span>
                        <span class="feedback-desc">Correcte spelling: <strong style="color: #43a047;">${escapeHtml(correctAnswer)}</strong></span>
                    </div>
                </div>
            `;
            this.overrideBtn.textContent = 'Toch goedrekenen';
        } else {
            // Change to correct
            this.currentResult.isCorrect = true;

            // Remove re-inserted card from queue
            const idx = this.activeQueue.indexOf(card, this.currentIndex + 1);
            if (idx !== -1) {
                this.activeQueue.splice(idx, 1);
            }

            // Decrement failure count
            const currentFailures = this.failureCounts.get(cardKey) || 0;
            if (currentFailures > 0) {
                this.failureCounts.set(cardKey, currentFailures - 1);
            }

            // Add to learned if appropriate
            if (this.isReviewPhase) {
                let appearsLater = false;
                for (let i = this.currentIndex + 1; i < this.activeQueue.length; i++) {
                    if (this.getCardKey(this.activeQueue[i]) === cardKey) {
                        appearsLater = true;
                        break;
                    }
                }
                if (!appearsLater) {
                    this.learnedCardKeys.add(cardKey);
                }
            } else {
                if (!this.failureCounts.has(cardKey) || this.failureCounts.get(cardKey) === 0) {
                    this.learnedCardKeys.add(cardKey);
                }
            }

            // Update UI
            this.feedbackContainer.innerHTML = `
                <div class="sp-feedback-card correct">
                    <span class="material-symbols-rounded feedback-icon">check_circle</span>
                    <div class="feedback-text-container">
                        <span class="feedback-title">Correct! (Handmatig goedgekeurd)</span>
                        <span class="feedback-desc">Goed gespeld.</span>
                    </div>
                </div>
            `;
            this.overrideBtn.textContent = 'Toch foutrekenen';
        }
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

const spellingInstance = new SpellingQuiz();

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnSpelling = e.target.closest('#btn-spelling');
        if (btnSpelling) {
            e.preventDefault();
            spellingInstance.open();
        }
    });
});
