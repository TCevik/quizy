/* Flashcards JS */
document.addEventListener('DOMContentLoaded', () => {
    // Intercept clicks on btn-flashcards
    document.addEventListener('click', (e) => {
        const btnFlashcard = e.target.closest('#btn-flashcards');
        if (btnFlashcard) {
            e.preventDefault();
            openFlashcardsQuiz();
        }
    });
});

function openFlashcardsQuiz(options = {}) {
    const savedSettings = (window.currentSet && window.currentSet.settings) || {};
    const hasStarred = window.currentSet && window.currentSet.cards && window.currentSet.cards.some(c => c.starred);
    let starOnly = ('starOnly' in options) ? !!options.starOnly : !!savedSettings.starOnly;
    if (!hasStarred) {
        starOnly = false;
        if (window.currentSet && window.currentSet.settings && window.currentSet.settings.starOnly) {
            window.currentSet.settings.starOnly = false;
        }
    }
    let randomize = ('randomize' in options) ? !!options.randomize : !!savedSettings.randomize;
    let swapSides = ('swapSides' in options) ? !!options.swapSides : !!savedSettings.swapSides;
    let autoSpeak = ('autoSpeak' in options) ? !!options.autoSpeak : !!savedSettings.autoSpeak;

    if (!window.currentSet || !window.currentSet.cards || window.currentSet.cards.length === 0) {
        if (window.Toast) window.Toast.show('Deze set heeft geen kaarten om te oefenen.', 'error');
        return;
    }

    let originalCards = window.currentSet.cards;
    if (starOnly) {
        originalCards = originalCards.filter(c => c.starred);
    }

    if (originalCards.length === 0) {
        if (window.Toast) window.Toast.show('Je hebt geen woorden met een ster om te oefenen.', 'error');
        return;
    }

    const mainWrapper = document.querySelector('main.set-wrapper');
    let overlay = document.getElementById('flashcards-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'flashcards-overlay';
        overlay.className = 'flashcards-overlay';
        if (mainWrapper) {
            mainWrapper.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
    }

    // Hide only the siblings of overlay inside mainWrapper to keep header/footer
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
    
    // Map to track the number of times each card is answered incorrectly
    let failureCounts = new Map();
    // Unique card keys that are fully learned/completed
    let learnedCardKeys = new Set();
    
    // The current active queue of cards to display
    let activeQueue = [...originalCards];

    // Helper to shuffle array in place
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

    // Helper to get unique key for a card
    function getCardKey(card) {
        return card.id || `${card.term}_${card.definition}`;
    }

    // Arranges repeated review cards so no identical cards are adjacent unless impossible
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

            // Fallback if we must pick the same key (no other option left)
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

    // Render the overlay content
    overlay.innerHTML = `
        <div class="flashcards-container" style="position: relative;">
            <div class="flashcards-header">
                <span class="flashcards-title">${escapeHtml(window.currentSet.title || 'Flashcards')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="fc-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="fc-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <!-- Settings Panel -->
                    <div id="fc-settings-panel" class="fc-settings-panel">
                        <h3 class="fc-settings-title">
                            <span class="material-symbols-rounded">settings</span> Instellingen
                        </h3>
                        <div class="fc-setting-item">
                            <div class="fc-setting-row">
                                <label for="fc-star-only" class="fc-setting-label" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Alleen sterwoorden</label>
                                <label class="fc-switch" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
                                    <input type="checkbox" id="fc-star-only" ${starOnly ? 'checked' : ''} ${!hasStarred ? 'disabled' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Oefen alleen de woorden die je met een ster hebt gemarkeerd.</span>
                            <span class="fc-warning-text" id="fc-star-warning">Let op: Dit start een nieuwe sessie. Je voortgang gaat verloren!</span>
                        </div>
                        <div class="fc-setting-item">
                            <div class="fc-setting-row">
                                <label for="fc-randomize" class="fc-setting-label">Willekeurige volgorde</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="fc-randomize" ${randomize ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Schud de kaarten in een willekeurige volgorde vanaf het volgende woord.</span>
                        </div>
                        <div class="fc-setting-item">
                            <div class="fc-setting-row">
                                <label for="fc-swap-sides" class="fc-setting-label">${window.currentSet.mode === 'talen' ? 'Talen omdraaien' : 'Term en definitie omdraaien'}</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="fc-swap-sides" ${swapSides ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">${window.currentSet.mode === 'talen' ? `Toon ${escapeHtml(window.currentSet.lang2 || 'de vertaling')} op de voorkant en ${escapeHtml(window.currentSet.lang1 || 'het woord')} op de achterkant.` : 'Toon de definitie op de voorkant en de term op de achterkant.'}</span>
                        </div>
                        <div class="fc-setting-item">
                            <div class="fc-setting-row">
                                <label for="fc-auto-speak" class="fc-setting-label">Automatisch uitspreken</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="fc-auto-speak" ${autoSpeak ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Spreek woorden automatisch uit wanneer ze in beeld komen of bij het omdraaien.</span>
                        </div>
                        <div class="fc-settings-actions">
                            <button class="btn-control" id="fc-settings-save" style="background: var(--primary); color: #fff;">Opslaan</button>
                            <button class="btn-control" id="fc-settings-cancel">Annuleren</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Custom Confirmation Modal -->
            <div id="fc-confirm-modal" class="fc-confirm-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(11, 15, 25, 0.85); z-index: 1000; align-items: center; justify-content: center;">
                <div class="glass-panel" style="max-width: 420px; width: 90%; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(22, 22, 30, 0.95); box-shadow: 0 20px 40px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;">
                    <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                        <h3 style="font-size: 1.2em; font-weight: 600; color: var(--text-light); margin: 0; text-align: left;">Sessie herstarten?</h3>
                    </div>
                    <div style="padding: 24px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
                        <p style="color: var(--text-muted); font-size: 0.95em; line-height: 1.5; margin: 0;">Weet je zeker dat je de instellingen voor ster-woorden wilt wijzigen?</p>
                        <p style="color: #ef4444; font-size: 0.9em; font-weight: 500; margin: 0;">Dit start een nieuwe sessie en je huidige voortgang gaat verloren.</p>
                    </div>
                    <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2);">
                        <button id="fc-confirm-cancel" class="btn-control" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; font-size: 0.9em;">Annuleren</button>
                        <button id="fc-confirm-ok" class="btn-control" style="background: var(--primary); border: none; color: #fff; padding: 8px 16px; font-size: 0.9em;">Ja, begin opnieuw</button>
                    </div>
                </div>
            </div>
            
            <div class="flashcard-wrapper" id="fc-card">
                <div class="flashcard-inner">
                    <div class="flashcard-face flashcard-front">
                        <button class="btn-flashcard-speak" title="Uitspreken">
                            <span class="material-symbols-rounded">volume_up</span>
                        </button>
                        <button class="btn-flashcard-star">
                            <span class="material-symbols-rounded">star</span>
                        </button>
                        <div class="flashcard-label">Term</div>
                        <div class="flashcard-text" id="fc-front-text">Laden...</div>
                    </div>
                    <div class="flashcard-face flashcard-back">
                        <button class="btn-flashcard-speak" title="Uitspreken">
                            <span class="material-symbols-rounded">volume_up</span>
                        </button>
                        <button class="btn-flashcard-star">
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
    `;

    // Show overlay
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

    // Settings elements
    const settingsBtn = document.getElementById('fc-settings-btn');
    const settingsPanel = document.getElementById('fc-settings-panel');
    const settingsSave = document.getElementById('fc-settings-save');
    const settingsCancel = document.getElementById('fc-settings-cancel');
    const starOnlyCheckbox = document.getElementById('fc-star-only');
    const randomizeCheckbox = document.getElementById('fc-randomize');
    const swapSidesCheckbox = document.getElementById('fc-swap-sides');
    const autoSpeakCheckbox = document.getElementById('fc-auto-speak');
    const starWarning = document.getElementById('fc-star-warning');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
        starWarning.style.display = (starOnlyCheckbox.checked !== starOnly) ? 'block' : 'none';
    });

    starOnlyCheckbox.addEventListener('change', () => {
        starWarning.style.display = (starOnlyCheckbox.checked !== starOnly) ? 'block' : 'none';
    });

    settingsCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.remove('active');
        starOnlyCheckbox.checked = starOnly;
        randomizeCheckbox.checked = randomize;
        if (swapSidesCheckbox) swapSidesCheckbox.checked = swapSides;
        if (autoSpeakCheckbox) autoSpeakCheckbox.checked = autoSpeak;
        starWarning.style.display = 'none';
    });

    settingsSave.addEventListener('click', (e) => {
        e.stopPropagation();
        const newStarOnly = starOnlyCheckbox.checked;
        const newRandomize = randomizeCheckbox.checked;
        const newSwapSides = swapSidesCheckbox ? swapSidesCheckbox.checked : false;
        const newAutoSpeak = autoSpeakCheckbox ? autoSpeakCheckbox.checked : false;

        if (newStarOnly !== starOnly) {
            const confirmModal = document.getElementById('fc-confirm-modal');
            const confirmOk = document.getElementById('fc-confirm-ok');
            const confirmCancel = document.getElementById('fc-confirm-cancel');
            
            confirmModal.style.display = 'flex';
            
            const onConfirm = () => {
                confirmModal.style.display = 'none';
                settingsPanel.classList.remove('active');
                if (window.currentSet) {
                    window.currentSet.settings = {
                        starOnly: newStarOnly,
                        randomize: newRandomize,
                        swapSides: newSwapSides,
                        autoSpeak: newAutoSpeak
                    };
                    if (window.saveAndSyncCurrentSet) {
                        window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                    }
                }
                openFlashcardsQuiz({ starOnly: newStarOnly, randomize: newRandomize, swapSides: newSwapSides, autoSpeak: newAutoSpeak });
                cleanup();
            };
            const onCancel = () => {
                confirmModal.style.display = 'none';
                cleanup();
            };
            const cleanup = () => {
                confirmOk.removeEventListener('click', onConfirm);
                confirmCancel.removeEventListener('click', onCancel);
            };
            
            confirmOk.addEventListener('click', onConfirm);
            confirmCancel.addEventListener('click', onCancel);
        } else {
            if (window.currentSet) {
                window.currentSet.settings = {
                    starOnly: newStarOnly,
                    randomize: newRandomize,
                    swapSides: newSwapSides,
                    autoSpeak: newAutoSpeak
                };
                if (window.saveAndSyncCurrentSet) {
                    window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }
            if (newRandomize !== randomize) {
                randomize = newRandomize;
                if (randomize) {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    shuffleArray(remaining);
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    if (window.Toast) window.Toast.show('Kaarten worden nu in willekeurige volgorde getoond.', 'success');
                } else {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    remaining.sort((a, b) => {
                        return originalCards.indexOf(a) - originalCards.indexOf(b);
                    });
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    if (window.Toast) window.Toast.show('Willekeurige volgorde uitgeschakeld. Kaarten gaan verder in de originele volgorde.', 'info');
                }
            }
            if (newSwapSides !== swapSides) {
                swapSides = newSwapSides;
                updateCard();
                if (window.Toast) window.Toast.show(window.currentSet.mode === 'talen' ? 'Talen zijn omgedraaid.' : 'Term en definitie zijn omgedraaid.', 'success');
            }
            if (newAutoSpeak !== autoSpeak) {
                autoSpeak = newAutoSpeak;
                if (window.Toast) window.Toast.show(autoSpeak ? 'Automatisch uitspreken ingeschakeld.' : 'Automatisch uitspreken uitgeschakeld.', 'success');
            }
            settingsPanel.classList.remove('active');
        }
    });

    const clickOutsideHandler = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove('active');
            starOnlyCheckbox.checked = starOnly;
            randomizeCheckbox.checked = randomize;
            if (swapSidesCheckbox) swapSidesCheckbox.checked = swapSides;
            if (autoSpeakCheckbox) autoSpeakCheckbox.checked = autoSpeak;
            starWarning.style.display = 'none';
        }
    };
    document.addEventListener('click', clickOutsideHandler);

    function closeFlashcards() {
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

    function updateCard() {
        cardEl.classList.add('no-transition');
        cardEl.classList.remove('flipped');
        
        // Force reflow
        cardEl.offsetHeight;
        
        const card = activeQueue[currentIndex];
        const frontLabel = cardEl.querySelector('.flashcard-front .flashcard-label');
        const backLabel = cardEl.querySelector('.flashcard-back .flashcard-label');

        if (swapSides) {
            frontTextEl.textContent = card.definition;
            backTextEl.textContent = card.term;
            if (window.currentSet.mode === 'talen') {
                frontLabel.textContent = window.currentSet.lang2 || 'Definitie';
                backLabel.textContent = window.currentSet.lang1 || 'Term';
            } else {
                frontLabel.textContent = 'Definitie';
                backLabel.textContent = 'Term';
            }
        } else {
            frontTextEl.textContent = card.term;
            backTextEl.textContent = card.definition;
            if (window.currentSet.mode === 'talen') {
                frontLabel.textContent = window.currentSet.lang1 || 'Term';
                backLabel.textContent = window.currentSet.lang2 || 'Definitie';
            } else {
                frontLabel.textContent = 'Term';
                backLabel.textContent = 'Definitie';
            }
        }
        
        // Update star buttons
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

        // Update progress bar
        const progressPercentage = (learnedCardKeys.size / totalUniqueCards) * 100;
        progressTextEl.textContent = `Geleerd: ${learnedCardKeys.size} van ${totalUniqueCards} kaarten${isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        progressFillEl.style.width = `${progressPercentage}%`;
        
        setTimeout(() => {
            cardEl.classList.remove('no-transition');
        }, 50);

        if (autoSpeak) {
            const text = swapSides ? card.definition : card.term;
            const lang = swapSides ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) {
                window.speakText(text, lang);
            }
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
                // In review phase, check if this card appears again in the remaining queue.
                // If not, it is the last time, so it's officially learned.
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
                // In main phase, if it was never failed, it is fully learned now
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
                
                // Transition to review phase when original queue is empty
                if (currentIndex >= activeQueue.length) {
                    isReviewPhase = true;
                    // Build review queue based on failure counts:
                    // Every failure adds 2 repetitions, capped at a maximum of 3.
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
            // Record failure
            failureCounts.set(cardKey, (failureCounts.get(cardKey) || 0) + 1);

            // Insert card 3 to 5 slots later in activeQueue
            const offset = Math.floor(Math.random() * 3) + 3; // random 3, 4, or 5
            const insertIndex = currentIndex + 1 + offset;
            
            if (insertIndex >= activeQueue.length) {
                activeQueue.push(currentCard);
            } else {
                activeQueue.splice(insertIndex, 0, currentCard);
            }

            cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                currentIndex++;
                
                // Transition to review phase when original queue is empty
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
            const lang = swapSides ? window.currentSet.lang_col1 : (window.currentSet.lang_col2 || window.currentSet.lang_col1);
            if (window.speakText) window.speakText(text, lang);
        } else {
            const text = swapSides ? currentCard.definition : currentCard.term;
            const lang = swapSides ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) window.speakText(text, lang);
        }
    }

    // Event listeners
    cardEl.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
        triggerFlipSpeech();
    });

    const frontSpeakBtn = cardEl.querySelector('.flashcard-front .btn-flashcard-speak');
    const backSpeakBtn = cardEl.querySelector('.flashcard-back .btn-flashcard-speak');

    if (frontSpeakBtn) {
        frontSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentCard = activeQueue[currentIndex];
            if (!currentCard) return;
            const text = swapSides ? currentCard.definition : currentCard.term;
            const lang = swapSides ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) {
                window.speakText(text, lang);
            }
        });
    }

    if (backSpeakBtn) {
        backSpeakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentCard = activeQueue[currentIndex];
            if (!currentCard) return;
            const text = swapSides ? currentCard.term : currentCard.definition;
            const lang = swapSides ? window.currentSet.lang_col1 : (window.currentSet.lang_col2 || window.currentSet.lang_col1);
            if (window.speakText) {
                window.speakText(text, lang);
            }
        });
    }

    const starBtns = overlay.querySelectorAll('.btn-flashcard-star');
    starBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
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
                const hasStarredNow = window.currentSet && window.currentSet.cards && window.currentSet.cards.some(c => c.starred);
                if (!hasStarredNow) {
                    if (window.currentSet.settings) {
                        window.currentSet.settings.starOnly = false;
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
                await window.saveAndSyncCurrentSet();
                if (window.refreshTermsList) {
                    window.refreshTermsList();
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
                if (window.Toast) window.Toast.show('Fout bij bijwerken van ster: ' + err.message, 'error');
            }
        });
    });

    flipBtn.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
        triggerFlipSpeech();
    });

    wrongBtn.addEventListener('click', () => {
        submitAnswer(false);
    });

    correctBtn.addEventListener('click', () => {
        submitAnswer(true);
    });

    closeBtn.addEventListener('click', () => {
        closeFlashcards();
    });

    // Initial card setup
    updateCard();
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
