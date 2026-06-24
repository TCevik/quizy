import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml } from './main.js';


document.addEventListener('DOMContentLoaded', () => {
    
    document.addEventListener('click', (e) => {
        const btnFlashcard = e.target.closest('#btn-flashcards');
        if (btnFlashcard) {
            e.preventDefault();
            openFlashcardsQuiz();
        }
    });
});

function openFlashcardsQuiz(options = {}) {
    const isOwner = state.currentUser && state.currentSet && state.currentSet.user_id === state.currentUser.id;
    const savedSettings = (state.currentSet && state.currentSet.settings) || {};
    const hasStarred = state.currentSet && state.currentSet.cards && state.currentSet.cards.some(c => c.starred);
    let starOnly = ('starOnly' in options) ? !!options.starOnly : !!savedSettings.starOnly;
    if (!hasStarred) {
        starOnly = false;
        if (state.currentSet && state.currentSet.settings && state.currentSet.settings.starOnly) {
            state.currentSet.settings.starOnly = false;
        }
    }
    let randomize = ('randomize' in options) ? !!options.randomize : ('randomize' in savedSettings ? !!savedSettings.randomize : true);
    let swapSides = ('swapSides' in options) ? !!options.swapSides : !!savedSettings.swapSides;
    let autoSpeak = ('autoSpeak' in options) ? !!options.autoSpeak : !!savedSettings.autoSpeak;
    let timePressure = ('timePressure' in options) ? !!options.timePressure : !!savedSettings.timePressure;

    let timerInterval = null;

    function startTimer() {
        if (!timePressure) return;
        clearInterval(timerInterval);
        const timerContainer = overlay?.querySelector('.quizy-timer-bar-container');
        const timerFill = overlay?.querySelector('.quizy-timer-bar-fill');
        if (timerContainer) timerContainer.style.display = 'block';
        if (timerFill) {
            timerFill.style.width = '100%';
            timerFill.style.background = 'linear-gradient(90deg, #ff9800, #ff5722)';
        }
        const startTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            let timeLeft = 7000 - elapsed;
            if (timeLeft <= 0) {
                timeLeft = 0;
                clearInterval(timerInterval);
                if (timerFill) timerFill.style.width = '0%';
                handleTimeout();
            } else {
                const percentage = (timeLeft / 7000) * 100;
                if (timerFill) timerFill.style.width = `${percentage}%`;
            }
        }, 50);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function handleTimeout() {
        if (cardEl && !cardEl.classList.contains('flipped')) {
            cardEl.classList.add('flipped');
            triggerFlipSpeech();
            stopTimer();
        }
    }

    if (!state.currentSet || !state.currentSet.cards || state.currentSet.cards.length === 0) {
        Toast.show('Deze set heeft geen kaarten om te oefenen.', 'error');
        return;
    }

    let originalCards = state.currentSet.cards;
    if (starOnly) {
        originalCards = originalCards.filter(c => c.starred);
    }

    if (originalCards.length === 0) {
        Toast.show('Je hebt geen woorden met een ster om te oefenen.', 'error');
        return;
    }

    const mainWrapper = document.querySelector('main.set-wrapper');
    let overlay = document.getElementById('flashcards-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'flashcards-overlay';
        overlay.className = 'flashcards-overlay';
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

    const totalUniqueCards = originalCards.length;
    
    
    let failureCounts = new Map();
    
    let learnedCardKeys = new Set();
    
    
    let activeQueue = [...originalCards];

    
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    if (randomize) {
        shuffleArray(activeQueue);
    }

    let currentIndex = 0;
    let isReviewPhase = false;
    let isAnimating = false;

    
    function getCardKey(card) {
        return `idx_${state.currentSet.cards.indexOf(card)}`;
    }

    
    function generateNoAdjacentQueue(items) {
        const counts = new Map();
        items.forEach(item => {
            const key = getCardKey(item);
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

    
    overlay.innerHTML = `
        <div class="flashcards-container" style="position: relative;">
            <div class="flashcards-header">
                <span class="flashcards-title">${escapeHtml(state.currentSet.title || 'Flashcards')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="fc-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="fc-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <!-- Settings Panel Component -->
                    <quizy-settings-panel id="fc-settings-panel" mode="flashcards"></quizy-settings-panel>
                </div>
            </div>

            <!-- Timer Bar -->
            <div class="quizy-timer-bar-container" style="display: ${timePressure ? 'block' : 'none'}; width: 100%; height: 6px; background: rgba(255,255,255,0.05); overflow: hidden; margin-top: -10px; margin-bottom: 16px; border-radius: 3px;">
                <div class="quizy-timer-bar-fill" style="width: 100%; height: 100%; background: var(--orange); transition: width 0.1s linear;"></div>
            </div>

            <div class="flashcard-wrapper" id="fc-card">
                <div class="flashcard-inner">
                    <div class="flashcard-face flashcard-front">
                        <button class="btn-flashcard-speak" title="Uitspreken">
                            <span class="material-symbols-rounded">volume_up</span>
                        </button>
                        <button class="btn-flashcard-star" ${isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                            <span class="material-symbols-rounded">star</span>
                        </button>
                        <div class="flashcard-label">Term</div>
                        <div class="flashcard-text" id="fc-front-text">Laden...</div>
                    </div>
                    <div class="flashcard-face flashcard-back">
                        <button class="btn-flashcard-speak" title="Uitspreken">
                            <span class="material-symbols-rounded">volume_up</span>
                        </button>
                        <button class="btn-flashcard-star" ${isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
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

        <!-- Custom Confirmation Modal Component -->
        <quizy-confirm-modal id="fc-confirm-modal"></quizy-confirm-modal>
    `;

    
    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const cardEl = document.getElementById('fc-card');
    const frontTextEl = document.getElementById('fc-front-text');
    const backTextEl = document.getElementById('fc-back-text');
    const wrongBtn = document.getElementById('fc-wrong');
    const correctBtn = document.getElementById('fc-correct');
    const flipBtn = document.getElementById('fc-flip');
    const closeBtn = document.getElementById('fc-close');
    const progressTextEl = document.getElementById('fc-progress-text');
    const progressFillEl = document.getElementById('fc-progress-fill');

    
    const settingsBtn = document.getElementById('fc-settings-btn');
    const settingsPanel = document.getElementById('fc-settings-panel');
    const confirmModal = document.getElementById('fc-confirm-modal');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (settingsPanel.classList.contains('active')) {
            settingsPanel.close();
        } else {
            const hasStarred = (state.currentSet.cards || []).some(c => c.starred);
            settingsPanel.open(
                { starOnly, randomize, swapSides, autoSpeak, timePressure },
                hasStarred,
                state.currentSet.mode === 'talen',
                state.currentSet.lang1,
                state.currentSet.lang2
            );
        }
    });

    settingsPanel.addEventListener('save', (e) => {
        const { starOnly: newStarOnly, randomize: newRandomize, swapSides: newSwapSides, autoSpeak: newAutoSpeak, timePressure: newTimePressure } = e.detail;

        const applySettings = () => {
            settingsPanel.close();
            if (state.currentSet) {
                state.currentSet.settings = {
                    ...(state.currentSet.settings || {}),
                    starOnly: newStarOnly,
                    randomize: newRandomize,
                    swapSides: newSwapSides,
                    autoSpeak: newAutoSpeak,
                    timePressure: newTimePressure
                };
                if (isOwner && state.saveAndSyncCurrentSet) {
                    state.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }
            cleanupListeners();
            openFlashcardsQuiz({ starOnly: newStarOnly, randomize: newRandomize, swapSides: newSwapSides, autoSpeak: newAutoSpeak, timePressure: newTimePressure });
        };

        if (newStarOnly !== starOnly) {
            confirmModal.open();
            
            const onConfirm = () => {
                confirmModal.removeEventListener('confirm', onConfirm);
                applySettings();
            };
            confirmModal.addEventListener('confirm', onConfirm);
        } else {
            if (state.currentSet) {
                state.currentSet.settings = {
                    ...(state.currentSet.settings || {}),
                    starOnly: newStarOnly,
                    randomize: newRandomize,
                    swapSides: newSwapSides,
                    autoSpeak: newAutoSpeak,
                    timePressure: newTimePressure
                };
                if (isOwner && state.saveAndSyncCurrentSet) {
                    state.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }
            if (newRandomize !== randomize) {
                randomize = newRandomize;
                if (randomize) {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    shuffleArray(remaining);
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    Toast.show('Kaarten worden nu in willekeurige volgorde getoond.', 'success');
                } else {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    remaining.sort((a, b) => {
                        return originalCards.indexOf(a) - originalCards.indexOf(b);
                    });
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    Toast.show('Willekeurige volgorde uitgeschakeld. Kaarten gaan verder in de originele volgorde.', 'info');
                }
            }
            if (newSwapSides !== swapSides) {
                swapSides = newSwapSides;
                updateCard();
                Toast.show(state.currentSet.mode === 'talen' ? 'Talen zijn omgedraaid.' : 'Term en definitie zijn omgedraaid.', 'success');
            }
            if (newAutoSpeak !== autoSpeak) {
                autoSpeak = newAutoSpeak;
                Toast.show(autoSpeak ? 'Automatisch uitspreken ingeschakeld.' : 'Automatisch uitspreken uitgeschakeld.', 'success');
            }
            if (newTimePressure !== timePressure) {
                timePressure = newTimePressure;
                const timerContainer = overlay.querySelector('.quizy-timer-bar-container');
                if (timerContainer) {
                    timerContainer.style.display = timePressure ? 'block' : 'none';
                }
                if (timePressure) {
                    startTimer();
                } else {
                    stopTimer();
                }
                Toast.show(timePressure ? 'Tijdsdruk ingeschakeld.' : 'Tijdsdruk uitgeschakeld.', 'success');
            }
            settingsPanel.close();
        }
    });

    const clickOutsideHandler = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPanel.close();
        }
    };
    document.addEventListener('click', clickOutsideHandler);

    const keydownHandler = (e) => {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) {
            return;
        }
        if (settingsPanel.classList.contains('active')) {
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
            if (isAnimating) return;
            cardEl.classList.toggle('flipped');
            triggerFlipSpeech();
            if (cardEl.classList.contains('flipped')) {
                stopTimer();
            }
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            submitAnswer(false);
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            submitAnswer(true);
        }
    };
    document.addEventListener('keydown', keydownHandler);

    function cleanupListeners() {
        stopTimer();
        document.removeEventListener('click', clickOutsideHandler);
        document.removeEventListener('keydown', keydownHandler);
    }

    function closeFlashcards() {
        cleanupListeners();
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

    function updateCard() {
        cardEl.classList.add('no-transition');
        cardEl.classList.remove('flipped');
        
        
        cardEl.offsetHeight;
        
        const card = activeQueue[currentIndex];
        const frontLabel = cardEl.querySelector('.flashcard-front .flashcard-label');
        const backLabel = cardEl.querySelector('.flashcard-back .flashcard-label');

        if (swapSides) {
            frontTextEl.textContent = card.definition;
            backTextEl.textContent = card.term;
            if (state.currentSet.mode === 'talen') {
                frontLabel.textContent = state.currentSet.lang2 || 'Definitie';
                backLabel.textContent = state.currentSet.lang1 || 'Term';
            } else {
                frontLabel.textContent = 'Definitie';
                backLabel.textContent = 'Term';
            }
        } else {
            frontTextEl.textContent = card.term;
            backTextEl.textContent = card.definition;
            if (state.currentSet.mode === 'talen') {
                frontLabel.textContent = state.currentSet.lang1 || 'Term';
                backLabel.textContent = state.currentSet.lang2 || 'Definitie';
            } else {
                frontLabel.textContent = 'Term';
                backLabel.textContent = 'Definitie';
            }
        }
        
        
        const isStarred = !!card.starred;
        overlay.querySelectorAll('.btn-flashcard-star').forEach(btn => {
            const icon = btn.querySelector('.material-symbols-rounded');
            if (isStarred) {
                btn.classList.add('starred');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                btn.classList.remove('starred');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
        });

        
        const progressPercentage = (learnedCardKeys.size / totalUniqueCards) * 100;
        progressTextEl.textContent = `Geleerd: ${learnedCardKeys.size} van ${totalUniqueCards} kaarten${isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        progressFillEl.style.width = `${progressPercentage}%`;
        
        setTimeout(() => {
            cardEl.classList.remove('no-transition');
            startTimer();
        }, 50);

        if (autoSpeak) {
            const text = swapSides ? card.definition : card.term;
            const lang = swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        }
    }

    function checkFinished() {
        if (learnedCardKeys.size === totalUniqueCards) {
            overlay.innerHTML = `
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
            
            document.getElementById('fc-restart').addEventListener('click', () => {
                cleanupListeners();
                openFlashcardsQuiz({ starOnly, randomize, swapSides });
            });
            document.getElementById('fc-finish-close').addEventListener('click', () => {
                closeFlashcards();
            });
            return true;
        }
        return false;
    }

    function submitAnswer(correct) {
        if (isAnimating) return;
        const currentCard = activeQueue[currentIndex];
        const cardKey = getCardKey(currentCard);

        if (correct) {
            isAnimating = true;
            
            if (isReviewPhase) {
                
                
                let appearsLater = false;
                for (let i = currentIndex + 1; i < activeQueue.length; i++) {
                    if (getCardKey(activeQueue[i]) === cardKey) {
                        appearsLater = true;
                        break;
                    }
                }
                if (!appearsLater) {
                    learnedCardKeys.add(cardKey);
                }
            } else {
                
                if (!failureCounts.has(cardKey) || failureCounts.get(cardKey) === 0) {
                    learnedCardKeys.add(cardKey);
                }
            }

            cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                if (checkFinished()) {
                    isAnimating = false;
                    return;
                }

                currentIndex++;
                
                
                if (currentIndex >= activeQueue.length) {
                    isReviewPhase = true;
                    
                    
                    const reviewCards = [];
                    originalCards.forEach(c => {
                        const key = getCardKey(c);
                        const failures = failureCounts.get(key) || 0;
                        if (failures > 0) {
                            const repetitions = Math.min(3, failures * 2);
                            for (let r = 0; r < repetitions; r++) {
                                reviewCards.push(c);
                            }
                        }
                    });
                    
                    if (reviewCards.length > 0) {
                        activeQueue = generateNoAdjacentQueue(reviewCards);
                        currentIndex = 0;
                    }
                }

                updateCard();
                cardEl.classList.remove('card-slide-out-left');
                cardEl.classList.add('card-slide-in-right');
                setTimeout(() => {
                    cardEl.classList.remove('card-slide-in-right');
                    isAnimating = false;
                }, 250);
            }, 200);
        } else {
            isAnimating = true;
            
            failureCounts.set(cardKey, (failureCounts.get(cardKey) || 0) + 1);

            
            const offset = Math.floor(Math.random() * 3) + 3; 
            const insertIndex = currentIndex + 1 + offset;
            
            if (insertIndex >= activeQueue.length) {
                activeQueue.push(currentCard);
            } else {
                activeQueue.splice(insertIndex, 0, currentCard);
            }

            cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                currentIndex++;
                
                
                if (currentIndex >= activeQueue.length) {
                    isReviewPhase = true;
                    const reviewCards = [];
                    originalCards.forEach(c => {
                        const key = getCardKey(c);
                        const failures = failureCounts.get(key) || 0;
                        if (failures > 0) {
                            const repetitions = Math.min(3, failures * 2);
                            for (let r = 0; r < repetitions; r++) {
                                reviewCards.push(c);
                            }
                        }
                    });
                    
                    if (reviewCards.length > 0) {
                        activeQueue = generateNoAdjacentQueue(reviewCards);
                        currentIndex = 0;
                    }
                }

                updateCard();
                cardEl.classList.remove('card-slide-out-left');
                cardEl.classList.add('card-slide-in-right');
                setTimeout(() => {
                    cardEl.classList.remove('card-slide-in-right');
                    isAnimating = false;
                }, 250);
            }, 200);
        }
    }

    function triggerFlipSpeech() {
        if (!autoSpeak) return;
        const isFlipped = cardEl.classList.contains('flipped');
        const currentCard = activeQueue[currentIndex];
        if (!currentCard) return;
        if (isFlipped) {
            const text = swapSides ? currentCard.term : currentCard.definition;
            const lang = swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
            speakText(text, lang);
        } else {
            const text = swapSides ? currentCard.definition : currentCard.term;
            const lang = swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        }
    }

    
    cardEl.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
        triggerFlipSpeech();
        if (cardEl.classList.contains('flipped')) {
            stopTimer();
        }
    });

    const frontSpeakBtn = cardEl.querySelector('.flashcard-front .btn-flashcard-speak');
    const backSpeakBtn = cardEl.querySelector('.flashcard-back .btn-flashcard-speak');

    if (frontSpeakBtn) {
        frontSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentCard = activeQueue[currentIndex];
            if (!currentCard) return;
            const text = swapSides ? currentCard.definition : currentCard.term;
            const lang = swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
            speakText(text, lang);
        });
    }

    if (backSpeakBtn) {
        backSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentCard = activeQueue[currentIndex];
            if (!currentCard) return;
            const text = swapSides ? currentCard.term : currentCard.definition;
            const lang = swapSides ? state.currentSet.lang_col1 : (state.currentSet.lang_col2 || state.currentSet.lang_col1);
            speakText(text, lang);
        });
    }

    const starBtns = overlay.querySelectorAll('.btn-flashcard-star');
    starBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!isOwner) return;
            const currentCard = activeQueue[currentIndex];
            if (!currentCard) return;

            currentCard.starred = !currentCard.starred;

            const isStarred = !!currentCard.starred;
            overlay.querySelectorAll('.btn-flashcard-star').forEach(b => {
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
                const starOnlyCheckbox = settingsPanel ? settingsPanel.querySelector('#setting-star-only') : null;
                if (!hasStarredNow) {
                    if (state.currentSet.settings) {
                        state.currentSet.settings.starOnly = false;
                    }
                    if (starOnlyCheckbox) {
                        starOnlyCheckbox.checked = false;
                        starOnlyCheckbox.disabled = true;
                        const label = overlay.querySelector('label[for="fc-star-only"]');
                        const switchEl = overlay.querySelector('.fc-switch');
                        if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                        if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                    }
                } else {
                    if (starOnlyCheckbox) {
                        starOnlyCheckbox.disabled = false;
                        const label = overlay.querySelector('label[for="fc-star-only"]');
                        const switchEl = overlay.querySelector('.fc-switch');
                        if (label) label.style.cssText = '';
                        if (switchEl) switchEl.style.cssText = '';
                    }
                }
                await state.saveAndSyncCurrentSet();
                if (state.refreshTermsList) {
                    state.refreshTermsList();
                }
            } catch (err) {
                currentCard.starred = !currentCard.starred;
                const revertedStarred = !!currentCard.starred;
                overlay.querySelectorAll('.btn-flashcard-star').forEach(b => {
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

    flipBtn.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
        triggerFlipSpeech();
        if (cardEl.classList.contains('flipped')) {
            stopTimer();
        }
    });

    wrongBtn.addEventListener('click', () => {
        stopTimer();
        submitAnswer(false);
    });

    correctBtn.addEventListener('click', () => {
        stopTimer();
        submitAnswer(true);
    });

    closeBtn.addEventListener('click', () => {
        closeFlashcards();
    });

    
    updateCard();
}


