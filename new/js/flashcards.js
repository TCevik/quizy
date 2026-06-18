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

function openFlashcardsQuiz() {
    if (!window.currentSet || !window.currentSet.cards || window.currentSet.cards.length === 0) {
        if (window.Toast) window.Toast.show('Deze set heeft geen kaarten om te oefenen.', 'error');
        return;
    }

    let overlay = document.getElementById('flashcards-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'flashcards-overlay';
        overlay.className = 'flashcards-overlay';
        document.body.appendChild(overlay);
    }

    const originalCards = window.currentSet.cards;
    const totalUniqueCards = originalCards.length;
    
    // Map to track the number of times each card is answered incorrectly
    let failureCounts = new Map();
    // Unique card keys that are fully learned/completed
    let learnedCardKeys = new Set();
    
    // The current active queue of cards to display
    let activeQueue = [...originalCards];
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
        <div class="flashcards-container">
            <div class="flashcards-header">
                <span class="flashcards-title">${escapeHtml(window.currentSet.title || 'Flashcards')}</span>
                <button class="btn-close-flashcards" id="fc-close">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            
            <div class="flashcard-wrapper" id="fc-card">
                <div class="flashcard-inner">
                    <div class="flashcard-face flashcard-front">
                        <div class="flashcard-label">Term</div>
                        <div class="flashcard-text" id="fc-front-text">Laden...</div>
                    </div>
                    <div class="flashcard-face flashcard-back">
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
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    const cardEl = document.getElementById('fc-card');
    const frontTextEl = document.getElementById('fc-front-text');
    const backTextEl = document.getElementById('fc-back-text');
    const wrongBtn = document.getElementById('fc-wrong');
    const correctBtn = document.getElementById('fc-correct');
    const flipBtn = document.getElementById('fc-flip');
    const closeBtn = document.getElementById('fc-close');
    const progressTextEl = document.getElementById('fc-progress-text');
    const progressFillEl = document.getElementById('fc-progress-fill');

    function updateCard() {
        cardEl.classList.remove('flipped');
        
        const card = activeQueue[currentIndex];
        frontTextEl.textContent = card.term;
        backTextEl.textContent = card.definition;
        
        // Update progress bar
        const progressPercentage = (learnedCardKeys.size / totalUniqueCards) * 100;
        progressTextEl.textContent = `Geleerd: ${learnedCardKeys.size} van ${totalUniqueCards} kaarten${isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        progressFillEl.style.width = `${progressPercentage}%`;
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
                openFlashcardsQuiz();
            });
            document.getElementById('fc-finish-close').addEventListener('click', () => {
                overlay.classList.remove('active');
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

    // Event listeners
    cardEl.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
    });

    flipBtn.addEventListener('click', () => {
        if (isAnimating) return;
        cardEl.classList.toggle('flipped');
    });

    wrongBtn.addEventListener('click', () => {
        submitAnswer(false);
    });

    correctBtn.addEventListener('click', () => {
        submitAnswer(true);
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
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
