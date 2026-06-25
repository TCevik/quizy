import { BaseQuiz } from './base-quiz.js';
import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml } from './main.js';

class MultipleChoiceQuiz extends BaseQuiz {
    constructor() {
        super('multiple-choice', 'mc-overlay', 'mc-overlay');
        this.answered = false;
        this.currentOptionsData = null;
        this.clickOutsideHandler = null;
        this.keydownHandler = null;
    }

    open(options = {}) {
        const success = this.initSession(options, {
            starOnly: false,
            randomize: true,
            swapSides: false,
            autoSpeak: false,
            timePressure: false
        });
        if (!success) return;

        this.renderLayout();
        this.setupElements();
        this.addEventListeners();
        this.updateQuestion();
    }

    renderLayout() {
        const totalUniqueCards = this.originalCards.length;
        this.overlay.innerHTML = `
            <div class="learning-layout-wrapper">
                <quizy-ad type="display" class="learning-side-ad"></quizy-ad>

                <div class="mc-container" style="position: relative;">
                    <div class="mc-header">
                        <span class="mc-title">${escapeHtml(state.currentSet.title || 'Multiple Choice')}</span>
                        <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                            <button class="btn-close-flashcards" id="mc-info-btn" title="Toetsenbord sneltoetsen" style="transform: none;">
                                <span class="material-symbols-rounded">info</span>
                            </button>
                            <button class="btn-close-flashcards" id="mc-settings-btn" title="Instellingen" style="transform: none;">
                                <span class="material-symbols-rounded">settings</span>
                            </button>
                            <button class="btn-close-flashcards" id="mc-close">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                            <quizy-settings-panel id="mc-settings-panel" mode="multiple-choice"></quizy-settings-panel>
                        </div>
                    </div>

                    <div class="quizy-timer-bar-container" style="display: ${this.settings.timePressure ? 'block' : 'none'}; width: 100%; height: 6px; background: rgba(255,255,255,0.05); overflow: hidden; margin-top: -10px; margin-bottom: 16px; border-radius: 3px;">
                        <div class="quizy-timer-bar-fill" style="width: 100%; height: 100%; background: var(--orange); transition: width 0.1s linear;"></div>
                    </div>

                    <div class="mc-question-card" id="mc-question">
                        <button class="btn-mc-speak" title="Uitspreken">
                            <span class="material-symbols-rounded">volume_up</span>
                        </button>
                        <button class="btn-mc-star" ${this.isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                            <span class="material-symbols-rounded">star</span>
                        </button>
                        <div class="mc-question-label" id="mc-question-label">Vraag</div>
                        <div class="mc-question-text" id="mc-question-text">Laden...</div>
                    </div>

                    <div class="mc-options-grid" id="mc-options">
                        <!-- 4 Choices buttons will go here -->
                    </div>

                    <div class="mc-action-area">
                        <button class="btn-mc-next" id="mc-next" style="display: none;">
                            Volgende
                            <span class="material-symbols-rounded">arrow_forward</span>
                        </button>
                    </div>

                    <div class="progress-container">
                        <span class="progress-text" id="mc-progress-text">Geleerd: 0 van ${totalUniqueCards} kaarten</span>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" id="mc-progress-fill"></div>
                        </div>
                    </div>
                </div>

                <quizy-ad type="display" class="learning-side-ad"></quizy-ad>
            </div>

            <quizy-confirm-modal id="mc-confirm-modal"></quizy-confirm-modal>
            <quizy-keybinds-modal id="mc-keybinds-modal" mode="multiple-choice"></quizy-keybinds-modal>
        `;
    }

    setupElements() {
        this.questionTextEl = this.overlay.querySelector('#mc-question-text');
        this.questionLabelEl = this.overlay.querySelector('#mc-question-label');
        this.optionsGridEl = this.overlay.querySelector('#mc-options');
        this.nextBtn = this.overlay.querySelector('#mc-next');
        this.closeBtn = this.overlay.querySelector('#mc-close');
        this.progressTextEl = this.overlay.querySelector('#mc-progress-text');
        this.progressFillEl = this.overlay.querySelector('#mc-progress-fill');
        this.starBtn = this.overlay.querySelector('.btn-mc-star');
        this.speakBtn = this.overlay.querySelector('.btn-mc-speak');
        this.settingsBtn = this.overlay.querySelector('#mc-settings-btn');
        this.settingsPanel = this.overlay.querySelector('#mc-settings-panel');
        this.confirmModal = this.overlay.querySelector('#mc-confirm-modal');
        this.infoBtn = this.overlay.querySelector('#mc-info-btn');
        this.keybindsModal = this.overlay.querySelector('#mc-keybinds-modal');
    }

    addEventListeners() {
        if (this.infoBtn && this.keybindsModal) {
            this.infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.keybindsModal.open('multiple-choice');
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
                if (newSettings.swapSides !== this.settings.swapSides) {
                    this.settings.swapSides = newSettings.swapSides;
                    this.updateQuestion();
                    Toast.show(state.currentSet.mode === 'talen' ? 'Talen zijn omgedraaid.' : 'Term en definitie zijn omgedraaid.', 'success');
                }
                if (newSettings.autoSpeak !== this.settings.autoSpeak) {
                    this.settings.autoSpeak = newSettings.autoSpeak;
                    Toast.show(this.settings.autoSpeak ? 'Automatisch uitspreken ingeschakeld.' : 'Automatisch uitspreken uitgeschakeld.', 'success');
                }
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
                this.settingsPanel.close();
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
            
            // Support choosing options via keyboard A, B, C, D (or 1, 2, 3, 4) and Enter/Space for Next
            if (!this.answered) {
                const totalOptions = this.optionsGridEl.children.length;
                if (e.code === 'ArrowDown') {
                    e.preventDefault();
                    if (this.keyboardSelectedIndex !== -1) {
                        this.optionsGridEl.children[this.keyboardSelectedIndex].classList.remove('keyboard-selected');
                    }
                    this.keyboardSelectedIndex = (this.keyboardSelectedIndex + 1) % totalOptions;
                    this.optionsGridEl.children[this.keyboardSelectedIndex].classList.add('keyboard-selected');
                } else if (e.code === 'ArrowUp') {
                    e.preventDefault();
                    if (this.keyboardSelectedIndex !== -1) {
                        this.optionsGridEl.children[this.keyboardSelectedIndex].classList.remove('keyboard-selected');
                    }
                    this.keyboardSelectedIndex = (this.keyboardSelectedIndex - 1 + totalOptions) % totalOptions;
                    this.optionsGridEl.children[this.keyboardSelectedIndex].classList.add('keyboard-selected');
                } else if (e.code === 'Enter') {
                    e.preventDefault();
                    if (this.keyboardSelectedIndex !== -1) {
                        this.optionsGridEl.children[this.keyboardSelectedIndex].click();
                    }
                } else {
                    const optionIndex = ['KeyA', 'KeyB', 'KeyC', 'KeyD'].indexOf(e.code);
                    if (optionIndex !== -1 && optionIndex < totalOptions) {
                        e.preventDefault();
                        const btn = this.optionsGridEl.children[optionIndex];
                        btn.click();
                    } else {
                        const numberIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
                        if (numberIndex !== -1 && numberIndex < totalOptions) {
                            e.preventDefault();
                            const btn = this.optionsGridEl.children[numberIndex];
                            btn.click();
                        }
                    }
                }
            } else {
                if (e.code === 'Enter' || e.code === 'Space') {
                    e.preventDefault();
                    this.nextBtn.click();
                }
            }
        };
        document.addEventListener('keydown', this.keydownHandler);

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
                        const label = this.overlay.querySelector('label[for="mc-star-only"]');
                        const switchEl = this.overlay.querySelector('.fc-switch');
                        if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                        if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                    }
                } else {
                    if (starOnlyCheckbox) {
                        starOnlyCheckbox.disabled = false;
                        const label = this.overlay.querySelector('label[for="mc-star-only"]');
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
                const card = this.activeQueue[this.currentIndex];
                if (!card) return;
                const text = this.settings.swapSides ? card.definition : card.term;
                const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
                speakText(text, lang);
            });
        }

        this.nextBtn.addEventListener('click', () => this.handleNext());
        this.closeBtn.addEventListener('click', () => this.closeOverlay());
    }

    triggerTimer() {
        this.startTimer(() => {
            this.selectOption(null, null);
        });
    }

    generateOptions(correctCard) {
        const correctText = this.settings.swapSides ? correctCard.term : correctCard.definition;
        const otherCards = state.currentSet.cards.filter(c => this.getCardKey(c) !== this.getCardKey(correctCard));
        const potentialDistractors = [...new Set(otherCards.map(c => this.settings.swapSides ? c.term : c.definition))].filter(t => t !== correctText);
        
        this.shuffleArray(potentialDistractors);
        const distractors = potentialDistractors.slice(0, 3);
        const allOptions = [correctText, ...distractors];
        this.shuffleArray(allOptions);
        
        return {
            options: allOptions,
            correctAnswer: correctText
        };
    }

    updateQuestion() {
        this.answered = false;
        this.nextBtn.style.display = 'none';
        this.keyboardSelectedIndex = -1;
        
        const card = this.activeQueue[this.currentIndex];
        this.triggerTimer();
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

        this.currentOptionsData = this.generateOptions(card);
        
        this.optionsGridEl.innerHTML = '';
        this.currentOptionsData.options.forEach((optText, index) => {
            const letter = String.fromCharCode(65 + index); 
            const btn = document.createElement('button');
            btn.className = 'mc-option-btn';
            btn.innerHTML = `
                <span class="mc-option-badge">${letter}</span>
                <span>${escapeHtml(optText)}</span>
            `;
            btn.addEventListener('click', () => this.selectOption(btn, optText));
            this.optionsGridEl.appendChild(btn);
        });

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
            const text = this.settings.swapSides ? card.definition : card.term;
            const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        }
    }

    selectOption(selectedBtn, selectedText) {
        if (this.answered) return;
        this.answered = true;
        this.stopTimer();

        const correctText = this.currentOptionsData.correctAnswer;
        const correct = (selectedText === correctText);

        Array.from(this.optionsGridEl.children).forEach(btn => {
            btn.disabled = true;
            const textSpan = btn.querySelector('span:not(.mc-option-badge)');
            if (textSpan.textContent === correctText) {
                btn.classList.add('correct');
            }
        });

        if (!correct) {
            if (selectedBtn) {
                selectedBtn.classList.add('incorrect');
            }
            this.submitAnswer(false);
        } else {
            this.submitAnswer(true);
        }

        this.nextBtn.style.display = 'inline-flex';
    }

    checkFinished() {
        if (this.learnedCardKeys.size === this.originalCards.length) {
            this.overlay.innerHTML = `
                <div class="mc-container" style="text-align: center;">
                    <span class="material-symbols-rounded" style="font-size: 5em; color: var(--primary); margin-bottom: 20px;">emoji_events</span>
                    <h2 class="mc-title" style="font-size: 2em; margin-bottom: 10px;">Goed gedaan!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 30px;">Je hebt alle vragen in deze set goed beantwoord!</p>
                    <div style="display: flex; gap: 16px; justify-content: center;">
                        <button class="btn-control" id="mc-restart">Opnieuw oefenen</button>
                        <button class="btn-control" id="mc-finish-close" style="background: rgba(255,255,255,0.1);">Sluiten</button>
                    </div>
                </div>
            `;
            
            this.overlay.querySelector('#mc-restart').addEventListener('click', () => {
                this.cleanupListeners();
                this.open({ starOnly: this.settings.starOnly, randomize: this.settings.randomize, swapSides: this.settings.swapSides });
            });
            this.overlay.querySelector('#mc-finish-close').addEventListener('click', () => {
                this.closeOverlay();
            });
            return true;
        }
        return false;
    }

    submitAnswer(correct) {
        const currentCard = this.activeQueue[this.currentIndex];
        const cardKey = this.getCardKey(currentCard);

        if (correct) {
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
        } else {
            this.failureCounts.set(cardKey, (this.failureCounts.get(cardKey) || 0) + 1);

            const offset = Math.floor(Math.random() * 3) + 3;
            const insertIndex = this.currentIndex + 1 + offset;
            
            if (insertIndex >= this.activeQueue.length) {
                this.activeQueue.push(currentCard);
            } else {
                this.activeQueue.splice(insertIndex, 0, currentCard);
            }
        }
    }

    handleNext() {
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

const mcInstance = new MultipleChoiceQuiz();

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnMultipleChoice = e.target.closest('#btn-multiple-choice');
        if (btnMultipleChoice) {
            e.preventDefault();
            mcInstance.open();
        }
    });
});
