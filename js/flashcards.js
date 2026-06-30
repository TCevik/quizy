import { BaseQuiz } from './base-quiz.js';
import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml } from './main.js';

class FlashcardsQuiz extends BaseQuiz {
    constructor() {
        super('flashcards', 'flashcards-overlay', 'flashcards-overlay');
        this.isAnimating = false;
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
        this.updateCard();
    }

    renderLayout() {
        const totalUniqueCards = this.originalCards.length;
        const mainContent = `
            <div class="flashcards-container" style="position: relative;">
                <div class="flashcards-header">
                    <span class="flashcards-title">${escapeHtml(state.currentSet.title || 'Flashcards')}</span>
                    <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                        <button class="btn-close-flashcards" id="fc-info-btn" title="Toetsenbord sneltoetsen" style="transform: none;">
                            <span class="material-symbols-rounded">info</span>
                        </button>
                        <button class="btn-close-flashcards" id="fc-settings-btn" title="Instellingen" style="transform: none;">
                            <span class="material-symbols-rounded">settings</span>
                        </button>
                        <button class="btn-close-flashcards" id="fc-close">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                        <quizy-settings-panel id="fc-settings-panel" mode="flashcards"></quizy-settings-panel>
                    </div>
                </div>

                <div class="quizy-timer-bar-container" style="display: ${this.settings.timePressure ? 'block' : 'none'}; width: 100%; height: 6px; background: rgba(255,255,255,0.05); overflow: hidden; margin-top: -10px; margin-bottom: 16px; border-radius: 3px;">
                    <div class="quizy-timer-bar-fill" style="width: 100%; height: 100%; background: var(--orange); transition: width 0.1s linear;"></div>
                </div>

                <div class="flashcard-wrapper" id="fc-card">
                    <div class="flashcard-inner">
                        <div class="flashcard-face flashcard-front">
                            <button class="btn-flashcard-speak" title="Uitspreken">
                                <span class="material-symbols-rounded">volume_up</span>
                            </button>
                            <button class="btn-flashcard-star" ${this.isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                                <span class="material-symbols-rounded">star</span>
                            </button>
                            <div class="flashcard-label">Term</div>
                            <div class="flashcard-text" id="fc-front-text">Laden...</div>
                        </div>
                        <div class="flashcard-face flashcard-back">
                            <button class="btn-flashcard-speak" title="Uitspreken">
                                <span class="material-symbols-rounded">volume_up</span>
                            </button>
                            <button class="btn-flashcard-star" ${this.isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                                <span class="material-symbols-rounded">star</span>
                            </button>
                            <div class="flashcard-label">Definitie</div>
                            <div class="flashcard-text" id="fc-back-text">Laden...</div>
                        </div>
                    </div>
                </div>

                <div class="flashcards-controls">
                    <button class="btn-control btn-control-circle btn-wrong" id="fc-wrong" title="Niet geweten" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 56px; height: 56px;">
                        <span class="material-symbols-rounded" style="font-size: 28px;">close</span>
                    </button>
                    <button class="btn-control" id="fc-flip">
                        <span class="material-symbols-rounded">flip</span>
                        Omdraaien
                    </button>
                    <button class="btn-control btn-control-circle btn-correct" id="fc-correct" title="Geweten" style="background: rgba(67, 160, 71, 0.15); border: 1px solid rgba(67, 160, 71, 0.3); color: #43a047; width: 56px; height: 56px;">
                        <span class="material-symbols-rounded" style="font-size: 28px;">check</span>
                    </button>
                </div>

                <div class="progress-container">
                    <span class="progress-text" id="fc-progress-text">Geleerd: 0 van ${totalUniqueCards} kaarten</span>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" id="fc-progress-fill"></div>
                    </div>
                </div>
            </div>

            <quizy-confirm-modal id="fc-confirm-modal"></quizy-confirm-modal>
            <quizy-keybinds-modal id="fc-keybinds-modal" mode="flashcards"></quizy-keybinds-modal>
        `;
        this.overlay.innerHTML = mainContent;
    }

    setupElements() {
        this.cardEl = this.overlay.querySelector('#fc-card');
        this.frontTextEl = this.overlay.querySelector('#fc-front-text');
        this.backTextEl = this.overlay.querySelector('#fc-back-text');
        this.wrongBtn = this.overlay.querySelector('#fc-wrong');
        this.correctBtn = this.overlay.querySelector('#fc-correct');
        this.flipBtn = this.overlay.querySelector('#fc-flip');
        this.closeBtn = this.overlay.querySelector('#fc-close');
        this.progressTextEl = this.overlay.querySelector('#fc-progress-text');
        this.progressFillEl = this.overlay.querySelector('#fc-progress-fill');
        this.settingsBtn = this.overlay.querySelector('#fc-settings-btn');
        this.settingsPanel = this.overlay.querySelector('#fc-settings-panel');
        this.confirmModal = this.overlay.querySelector('#fc-confirm-modal');
        this.infoBtn = this.overlay.querySelector('#fc-info-btn');
        this.keybindsModal = this.overlay.querySelector('#fc-keybinds-modal');
    }

    addEventListeners() {
        if (this.infoBtn && this.keybindsModal) {
            this.infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.keybindsModal.open('flashcards');
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
                        Toast.show('Kaarten worden nu in willekeurige volgorde getoond.', 'success');
                    } else {
                        const remaining = this.activeQueue.slice(this.currentIndex + 1);
                        remaining.sort((a, b) => {
                            return this.originalCards.indexOf(a) - this.originalCards.indexOf(b);
                        });
                        this.activeQueue.splice(this.currentIndex + 1, this.activeQueue.length - (this.currentIndex + 1), ...remaining);
                        Toast.show('Willekeurige volgorde uitgeschakeld. Kaarten gaan verder in de originele volgorde.', 'info');
                    }
                }
                if (newSettings.swapSides !== this.settings.swapSides) {
                    this.settings.swapSides = newSettings.swapSides;
                    this.updateCard();
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
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                e.preventDefault();
                this.flipCard();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.submitAnswer(false);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.submitAnswer(true);
            }
        };
        document.addEventListener('keydown', this.keydownHandler);

        this.cardEl.addEventListener('click', () => {
            this.flipCard();
        });

        const frontSpeakBtn = this.cardEl.querySelector('.flashcard-front .btn-flashcard-speak');
        const backSpeakBtn = this.cardEl.querySelector('.flashcard-back .btn-flashcard-speak');

        if (frontSpeakBtn) {
            frontSpeakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = this.activeQueue[this.currentIndex];
                if (!card) return;
                const text = this.settings.swapSides ? card.definition : card.term;
                const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
                speakText(text, lang);
            });
        }

        if (backSpeakBtn) {
            backSpeakBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = this.activeQueue[this.currentIndex];
                if (!card) return;
                const text = this.settings.swapSides ? card.term : card.definition;
                const lang = this.settings.swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
                speakText(text, lang);
            });
        }

        const starBtns = this.overlay.querySelectorAll('.btn-flashcard-star');
        starBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!this.isOwner) return;
                const card = this.activeQueue[this.currentIndex];
                if (!card) return;

                card.starred = !card.starred;
                const isStarred = !!card.starred;
                this.overlay.querySelectorAll('.btn-flashcard-star').forEach(b => {
                    const icon = b.querySelector('.material-symbols-rounded');
                    if (isStarred) {
                        b.classList.add('starred');
                        icon.style.fontVariationSettings = "'FILL' 1";
                    } else {
                        b.classList.remove('starred');
                        icon.style.fontVariationSettings = "'FILL' 0";
                    }
                });

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
                            const label = this.overlay.querySelector('label[for="fc-star-only"]');
                            const switchEl = this.overlay.querySelector('.fc-switch');
                            if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                            if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                        }
                    } else {
                        if (starOnlyCheckbox) {
                            starOnlyCheckbox.disabled = false;
                            const label = this.overlay.querySelector('label[for="fc-star-only"]');
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
                    this.overlay.querySelectorAll('.btn-flashcard-star').forEach(b => {
                        const icon = b.querySelector('.material-symbols-rounded');
                        if (revertedStarred) {
                            b.classList.add('starred');
                            icon.style.fontVariationSettings = "'FILL' 1";
                        } else {
                            b.classList.remove('starred');
                            icon.style.fontVariationSettings = "'FILL' 0";
                        }
                    });
                    Toast.show('Fout bij bijwerken van ster: ' + err.message, 'error');
                }
            });
        });

        this.flipBtn.addEventListener('click', () => {
            this.flipCard();
        });

        this.wrongBtn.addEventListener('click', () => {
            this.submitAnswer(false);
        });

        this.correctBtn.addEventListener('click', () => {
            this.submitAnswer(true);
        });

        this.closeBtn.addEventListener('click', () => {
            this.closeOverlay();
        });
    }

    flipCard() {
        if (this.isAnimating) return;
        this.cardEl.classList.toggle('flipped');
        this.triggerFlipSpeech();
        if (this.cardEl.classList.contains('flipped')) {
            this.stopTimer();
        }
    }

    triggerTimer() {
        this.startTimer(() => {
            if (this.cardEl && !this.cardEl.classList.contains('flipped')) {
                this.cardEl.classList.add('flipped');
                this.triggerFlipSpeech();
                this.stopTimer();
            }
        });
    }

    updateCard() {
        this.cardEl.classList.add('no-transition');
        this.cardEl.classList.remove('flipped');
        
        // Trigger reflow
        this.cardEl.offsetHeight;
        
        const card = this.activeQueue[this.currentIndex];
        const frontLabel = this.cardEl.querySelector('.flashcard-front .flashcard-label');
        const backLabel = this.cardEl.querySelector('.flashcard-back .flashcard-label');

        if (this.settings.swapSides) {
            this.frontTextEl.textContent = card.definition;
            this.backTextEl.textContent = card.term;
            if (state.currentSet.mode === 'talen') {
                frontLabel.textContent = state.currentSet.lang2 || 'Definitie';
                backLabel.textContent = state.currentSet.lang1 || 'Term';
            } else {
                frontLabel.textContent = 'Definitie';
                backLabel.textContent = 'Term';
            }
        } else {
            this.frontTextEl.textContent = card.term;
            this.backTextEl.textContent = card.definition;
            if (state.currentSet.mode === 'talen') {
                frontLabel.textContent = state.currentSet.lang1 || 'Term';
                backLabel.textContent = state.currentSet.lang2 || 'Definitie';
            } else {
                frontLabel.textContent = 'Term';
                backLabel.textContent = 'Definitie';
            }
        }
        
        const isStarred = !!card.starred;
        this.overlay.querySelectorAll('.btn-flashcard-star').forEach(btn => {
            const icon = btn.querySelector('.material-symbols-rounded');
            if (isStarred) {
                btn.classList.add('starred');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                btn.classList.remove('starred');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
        });

        const totalUniqueCards = this.originalCards.length;
        const progressPercentage = (this.learnedCardKeys.size / totalUniqueCards) * 100;
        this.progressTextEl.textContent = `Geleerd: ${this.learnedCardKeys.size} van ${totalUniqueCards} kaarten${this.isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        this.progressFillEl.style.width = `${progressPercentage}%`;
        
        setTimeout(() => {
            this.cardEl.classList.remove('no-transition');
            this.triggerTimer();
        }, 50);

        if (this.settings.autoSpeak) {
            const text = this.settings.swapSides ? card.definition : card.term;
            const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        }
    }

    checkFinished() {
        if (this.learnedCardKeys.size === this.originalCards.length) {
            this.overlay.innerHTML = `
                <div class="flashcards-container" style="text-align: center;">
                    <span class="material-symbols-rounded" style="font-size: 5em; color: var(--primary); margin-bottom: 20px;">emoji_events</span>
                    <h2 class="flashcards-title" style="font-size: 2em; margin-bottom: 10px;">Goed gedaan!</h2>
                    <p style="color: var(--text-muted); margin-bottom: 30px;">Je hebt alle kaarten in deze set geleerd!</p>
                    <div style="display: flex; gap: 16px; justify-content: center;">
                        <button class="btn-control" id="fc-restart">Opnieuw oefenen</button>
                        <button class="btn-control" id="fc-finish-close" style="background: rgba(255,255,255,0.1);">Sluiten</button>
                    </div>
                </div>
            `;
            
            this.overlay.querySelector('#fc-restart').addEventListener('click', () => {
                this.cleanupListeners();
                this.open({ starOnly: this.settings.starOnly, randomize: this.settings.randomize, swapSides: this.settings.swapSides });
            });
            this.overlay.querySelector('#fc-finish-close').addEventListener('click', () => {
                this.closeOverlay();
            });
            return true;
        }
        return false;
    }

    submitAnswer(correct) {
        if (this.isAnimating) return;
        this.stopTimer();

        const currentCard = this.activeQueue[this.currentIndex];
        const cardKey = this.getCardKey(currentCard);

        if (correct) {
            this.isAnimating = true;
            
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

            this.cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                if (this.checkFinished()) {
                    this.isAnimating = false;
                    return;
                }

                this.currentIndex++;
                this.handleQueueEnd();
                this.updateCard();
                this.cardEl.classList.remove('card-slide-out-left');
                this.cardEl.classList.add('card-slide-in-right');
                setTimeout(() => {
                    this.cardEl.classList.remove('card-slide-in-right');
                    this.isAnimating = false;
                }, 250);
            }, 200);
        } else {
            this.isAnimating = true;
            this.failureCounts.set(cardKey, (this.failureCounts.get(cardKey) || 0) + 1);

            const offset = Math.floor(Math.random() * 3) + 3; 
            const insertIndex = this.currentIndex + 1 + offset;
            
            if (insertIndex >= this.activeQueue.length) {
                this.activeQueue.push(currentCard);
            } else {
                this.activeQueue.splice(insertIndex, 0, currentCard);
            }

            this.cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                this.currentIndex++;
                this.handleQueueEnd();
                this.updateCard();
                this.cardEl.classList.remove('card-slide-out-left');
                this.cardEl.classList.add('card-slide-in-right');
                setTimeout(() => {
                    this.cardEl.classList.remove('card-slide-in-right');
                    this.isAnimating = false;
                }, 250);
            }, 200);
        }
    }

    handleQueueEnd() {
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
    }

    triggerFlipSpeech() {
        if (!this.settings.autoSpeak) return;
        const isFlipped = this.cardEl.classList.contains('flipped');
        const currentCard = this.activeQueue[this.currentIndex];
        if (!currentCard) return;
        if (isFlipped) {
            const text = this.settings.swapSides ? currentCard.term : currentCard.definition;
            const lang = this.settings.swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
            speakText(text, lang);
        } else {
            const text = this.settings.swapSides ? currentCard.definition : currentCard.term;
            const lang = this.settings.swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
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

const flashcardsInstance = new FlashcardsQuiz();

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnFlashcard = e.target.closest('#btn-flashcards');
        if (btnFlashcard) {
            e.preventDefault();
            flashcardsInstance.open();
        }
    });
});
