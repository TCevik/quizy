import { state } from './state.js';
import Toast from './toast.js';
import { speakText } from './main.js';

export class BaseQuiz {
    constructor(mode, overlayId, overlayClass) {
        this.mode = mode;
        this.overlayId = overlayId;
        this.overlayClass = overlayClass;
        this.overlay = null;
        this.mainWrapper = document.querySelector('main.set-wrapper');
        this.timerInterval = null;
        this.timerDuration = 7000;
        
        // Session state
        this.isOwner = false;
        this.hasStarred = false;
        this.settings = {};
        this.originalCards = [];
        this.activeQueue = [];
        this.currentIndex = 0;
        this.learnedCardKeys = new Set();
        this.failureCounts = new Map();
        this.isReviewPhase = false;
    }

    // Common setup
    initSession(options = {}, defaultSettings = {}) {
        if (!state.currentSet || !state.currentSet.cards || state.currentSet.cards.length === 0) {
            Toast.show('Deze set heeft geen kaarten om te oefenen.', 'error');
            return false;
        }

        this.isOwner = state.currentUser && state.currentSet && state.currentSet.user_id === state.currentUser.id;
        const savedSettings = (state.currentSet && state.currentSet.settings) || {};
        this.hasStarred = state.currentSet.cards.some(c => c.starred);

        // Resolve settings
        this.settings = { ...defaultSettings };
        for (const key of Object.keys(defaultSettings)) {
            if (key in options) {
                this.settings[key] = !!options[key];
            } else if (key in savedSettings) {
                this.settings[key] = !!savedSettings[key];
            }
        }

        if (!this.hasStarred) {
            this.settings.starOnly = false;
            if (state.currentSet && state.currentSet.settings && state.currentSet.settings.starOnly) {
                state.currentSet.settings.starOnly = false;
            }
        }

        // Card filtering
        this.originalCards = state.currentSet.cards;
        if (this.settings.starOnly) {
            this.originalCards = this.originalCards.filter(c => c.starred);
        }

        if (this.originalCards.length === 0) {
            Toast.show('Je hebt geen woorden met een ster om te oefenen.', 'error');
            return false;
        }

        // Initialize queues
        this.activeQueue = [...this.originalCards];
        if (this.settings.randomize) {
            this.shuffleArray(this.activeQueue);
        }

        this.currentIndex = 0;
        this.isReviewPhase = false;
        this.learnedCardKeys.clear();
        this.failureCounts.clear();

        // Create overlay and hide other children
        this.setupOverlay();
        return true;
    }

    setupOverlay() {
        this.overlay = document.getElementById(this.overlayId);
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = this.overlayId;
            this.overlay.className = this.overlayClass;
            document.body.appendChild(this.overlay);
        }

        if (this.mainWrapper) {
            Array.from(this.mainWrapper.children).forEach(child => {
                if (child !== this.overlay) {
                    if (!child.hasAttribute('data-prev-display')) {
                        child.setAttribute('data-prev-display', child.style.display || '');
                    }
                    child.style.display = 'none';
                }
            });
        }
        window.scrollTo(0, 0);
        this.overlay.style.display = 'flex';
        this.overlay.classList.add('active');
    }

    wrapWithAds(contentHtml) {
        return contentHtml;
    }

    triggerAds() {
    }

    closeOverlay() {
        this.cleanupListeners();
        if (this.overlay) {
            this.overlay.classList.remove('active');
            this.overlay.style.display = 'none';
        }
        if (this.mainWrapper) {
            Array.from(this.mainWrapper.children).forEach(child => {
                if (child !== this.overlay) {
                    child.style.display = child.getAttribute('data-prev-display') || '';
                    child.removeAttribute('data-prev-display');
                }
            });
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    getCardKey(card) {
        return `idx_${state.currentSet.cards.indexOf(card)}`;
    }

    generateNoAdjacentQueue(items) {
        const counts = new Map();
        items.forEach(item => {
            const key = this.getCardKey(item);
            if (!counts.has(key)) {
                counts.set(key, { card: item, count: 0 });
            }
            counts.get(key).count++;
        });

        const result = [];
        let prevKey = null;

        while (counts.size > 0) {
            let bestKey = null;
            let maxCount = -1;

            for (const [key, val] of counts.entries()) {
                if (key !== prevKey && val.count > maxCount) {
                    maxCount = val.count;
                    bestKey = key;
                }
            }

            if (bestKey === null) {
                for (const [key, val] of counts.entries()) {
                    if (val.count > maxCount) {
                        maxCount = val.count;
                        bestKey = key;
                    }
                }
            }

            if (bestKey === null) break;

            const val = counts.get(bestKey);
            result.push(val.card);
            val.count--;

            if (val.count === 0) {
                counts.delete(bestKey);
            }

            prevKey = bestKey;
        }

        return result;
    }

    // Timer management
    startTimer(onTimeout) {
        if (!this.settings.timePressure) return;
        this.stopTimer();

        const timerContainer = this.overlay?.querySelector('.quizy-timer-bar-container');
        const timerFill = this.overlay?.querySelector('.quizy-timer-bar-fill');
        if (timerContainer) timerContainer.style.display = 'block';
        if (timerFill) {
            timerFill.style.width = '100%';
            timerFill.style.background = 'linear-gradient(90deg, #ff0000ff, #56ff22ff)';
        }

        const startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let timeLeft = this.timerDuration - elapsed;
            if (timeLeft <= 0) {
                timeLeft = 0;
                this.stopTimer();
                if (timerFill) timerFill.style.width = '0%';
                if (typeof onTimeout === 'function') onTimeout();
            } else {
                const percentage = (timeLeft / this.timerDuration) * 100;
                if (timerFill) timerFill.style.width = `${percentage}%`;
            }
        }, 50);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Save and sync settings helper
    async saveSettings(newSettings) {
        if (!state.currentSet) return;
        
        // Merge settings keys
        state.currentSet.settings = {
            ...(state.currentSet.settings || {})
        };
        
        for (const key of Object.keys(newSettings)) {
            state.currentSet.settings[key] = newSettings[key];
        }

        if (this.isOwner && state.saveAndSyncCurrentSet) {
            try {
                await state.saveAndSyncCurrentSet();
            } catch (err) {
                console.error("Error saving settings:", err);
            }
        }
    }

    // Subclass hooks
    cleanupListeners() {
        this.stopTimer();
    }
}
