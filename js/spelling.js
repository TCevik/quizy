import { state } from './state.js';
import Toast from './toast.js';
import { speakText, escapeHtml, checkSpellingAnswer as checkSpellingHelper } from './main.js';

/* Spelling JS */
document.addEventListener('DOMContentLoaded', () => {
    // Intercept clicks on btn-spelling
    document.addEventListener('click', (e) => {
        const btnSpelling = e.target.closest('#btn-spelling');
        if (btnSpelling) {
            e.preventDefault();
            openSpellingQuiz();
        }
    });
});

function openSpellingQuiz(options = {}) {
    const isOwner = state.currentUser && state.currentSet && state.currentSet.user_id === state.currentUser.id;
    const savedSettings = (state.currentSet && state.currentSet.settings) || {};
    const hasStarred = state.currentSet && state.currentSet.cards && state.currentSet.cards.some(c => c.starred);
    
    // Normal settings
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
    
    // Spelling-specific settings
    let ignoreParentheses = ('ignoreParentheses' in options) ? !!options.ignoreParentheses : ('ignoreParentheses' in savedSettings ? !!savedSettings.ignoreParentheses : true);
    let skipPunctuation = ('skipPunctuation' in options) ? !!options.skipPunctuation : ('skipPunctuation' in savedSettings ? !!savedSettings.skipPunctuation : true);
    let allowSlashParts = ('allowSlashParts' in options) ? !!options.allowSlashParts : ('allowSlashParts' in savedSettings ? !!savedSettings.allowSlashParts : true);

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
    let overlay = document.getElementById('sp-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sp-overlay';
        overlay.className = 'sp-overlay';
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
    let answered = false;

    // Helper to get unique key for a card
    function getCardKey(card) {
        return `idx_${state.currentSet.cards.indexOf(card)}`;
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

            // Fallback if we must pick the same key
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
        <div class="sp-container" style="position: relative;">
            <div class="sp-header">
                <span class="sp-title">${escapeHtml(state.currentSet.title || 'Spelling')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="sp-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="sp-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <!-- Settings Panel Component -->
                    <quizy-settings-panel id="sp-settings-panel" mode="spelling"></quizy-settings-panel>
                </div>
            </div>

            <!-- Custom Confirmation Modal Component -->
            <quizy-confirm-modal id="sp-confirm-modal"></quizy-confirm-modal>

            
            <div class="sp-question-card" id="sp-question">
                <button class="btn-sp-speak" title="Uitspreken">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <button class="btn-sp-star" ${isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
                    <span class="material-symbols-rounded">star</span>
                </button>
                <div class="sp-question-label" id="sp-question-label">Schrijf de vertaling</div>
                <div class="sp-question-text" id="sp-question-text">Laden...</div>
            </div>

            <!-- Input / Feedback Form -->
            <div style="width: 100%;">
                <form id="sp-form" class="sp-input-form" autocomplete="off" onsubmit="return false;">
                    <div class="sp-input-wrapper">
                        <input type="text" id="sp-user-input" class="sp-input" placeholder="Typ je antwoord hier..." autofocus>
                    </div>
                    
                    <div id="sp-feedback-container" style="display: none;">
                        <!-- Feedback Card will be shown here -->
                    </div>

                    <div class="sp-action-area">
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
    `;

    // Show overlay
    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const questionTextEl = document.getElementById('sp-question-text');
    const questionLabelEl = document.getElementById('sp-question-label');
    const userInputEl = document.getElementById('sp-user-input');
    const feedbackContainer = document.getElementById('sp-feedback-container');
    const submitBtn = document.getElementById('sp-btn-submit');
    const skipBtn = document.getElementById('sp-btn-skip');
    const spForm = document.getElementById('sp-form');
    const closeBtn = document.getElementById('sp-close');
    const progressTextEl = document.getElementById('sp-progress-text');
    const progressFillEl = document.getElementById('sp-progress-fill');
    const starBtn = overlay.querySelector('.btn-sp-star');
    const speakBtn = overlay.querySelector('.btn-sp-speak');

    // Settings elements
    const settingsBtn = document.getElementById('sp-settings-btn');
    const settingsPanel = document.getElementById('sp-settings-panel');
    const confirmModal = document.getElementById('sp-confirm-modal');

    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (settingsPanel.classList.contains('active')) {
            settingsPanel.close();
        } else {
            const hasStarred = (state.currentSet.cards || []).some(c => c.starred);
            settingsPanel.open(
                { starOnly, randomize, swapSides, autoSpeak, ignoreParentheses, skipPunctuation, allowSlashParts },
                hasStarred,
                state.currentSet.mode === 'talen',
                state.currentSet.lang1,
                state.currentSet.lang2
            );
        }
    });

    settingsPanel.addEventListener('save', (e) => {
        const { 
            starOnly: newStarOnly, 
            randomize: newRandomize, 
            swapSides: newSwapSides, 
            autoSpeak: newAutoSpeak,
            ignoreParentheses: newIgnoreParentheses,
            skipPunctuation: newSkipPunctuation,
            allowSlashParts: newAllowSlashParts
        } = e.detail;

        const applySettings = () => {
            settingsPanel.close();
            if (state.currentSet) {
                state.currentSet.settings = {
                    ...(state.currentSet.settings || {}),
                    starOnly: newStarOnly,
                    randomize: newRandomize,
                    swapSides: newSwapSides,
                    autoSpeak: newAutoSpeak,
                    ignoreParentheses: newIgnoreParentheses,
                    skipPunctuation: newSkipPunctuation,
                    allowSlashParts: newAllowSlashParts
                };
                if (isOwner && state.saveAndSyncCurrentSet) {
                    state.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }
            document.removeEventListener('click', clickOutsideHandler);
            openSpellingQuiz({ 
                starOnly: newStarOnly, 
                randomize: newRandomize, 
                swapSides: newSwapSides, 
                autoSpeak: newAutoSpeak,
                ignoreParentheses: newIgnoreParentheses,
                skipPunctuation: newSkipPunctuation,
                allowSlashParts: newAllowSlashParts
            });
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
                    ignoreParentheses: newIgnoreParentheses,
                    skipPunctuation: newSkipPunctuation,
                    allowSlashParts: newAllowSlashParts
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
                    Toast.show('Vragen worden nu in willekeurige volgorde getoond.', 'success');
                } else {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    remaining.sort((a, b) => {
                        return originalCards.indexOf(a) - originalCards.indexOf(b);
                    });
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    Toast.show('Willekeurige volgorde uitgeschakeld. Vragen gaan verder in de originele volgorde.', 'info');
                }
            }
            
            swapSides = newSwapSides;
            autoSpeak = newAutoSpeak;
            ignoreParentheses = newIgnoreParentheses;
            skipPunctuation = newSkipPunctuation;
            allowSlashParts = newAllowSlashParts;
            
            updateQuestion();
            settingsPanel.close();
        }
    });

    const clickOutsideHandler = (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
            settingsPanel.close();
        }
    };
    document.addEventListener('click', clickOutsideHandler);

    function closeSpelling() {
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

    function checkSpellingAnswer(userInput, correctAnswer) {
        return checkSpellingHelper(userInput, correctAnswer, {
            skipPunctuation: skipPunctuation,
            allowSlashParts: allowSlashParts,
            ignoreParentheses: ignoreParentheses
        });
    }

    function updateQuestion() {
        answered = false;
        feedbackContainer.style.display = 'none';
        feedbackContainer.innerHTML = '';
        userInputEl.value = '';
        userInputEl.disabled = false;
        userInputEl.focus();
        
        submitBtn.textContent = 'Controleren';
        skipBtn.style.display = 'inline-flex';
        
        const card = activeQueue[currentIndex];
        if (!card) return;

        if (swapSides) {
            questionTextEl.textContent = card.definition;
            if (state.currentSet.mode === 'talen') {
                questionLabelEl.textContent = state.currentSet.lang2 || 'Definitie';
            } else {
                questionLabelEl.textContent = 'Definitie';
            }
        } else {
            questionTextEl.textContent = card.term;
            if (state.currentSet.mode === 'talen') {
                questionLabelEl.textContent = state.currentSet.lang1 || 'Term';
            } else {
                questionLabelEl.textContent = 'Term';
            }
        }

        // Update star button
        const isStarred = !!card.starred;
        const icon = starBtn.querySelector('.material-symbols-rounded');
        if (isStarred) {
            starBtn.classList.add('starred');
            icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            starBtn.classList.remove('starred');
            icon.style.fontVariationSettings = "'FILL' 0";
        }

        // Update progress bar
        const progressPercentage = (learnedCardKeys.size / totalUniqueCards) * 100;
        progressTextEl.textContent = `Geleerd: ${learnedCardKeys.size} van ${totalUniqueCards} kaarten${isReviewPhase ? ' (Herhalingsfase)' : ''}`;
        progressFillEl.style.width = `${progressPercentage}%`;

        if (autoSpeak) {
            speakCurrentQuestion();
        }
    }

    function speakCurrentQuestion() {
        const card = activeQueue[currentIndex];
        if (!card) return;
        const text = swapSides ? card.definition : card.term;
        const lang = swapSides ? (state.currentSet.lang_col2 || state.currentSet.lang_col1) : state.currentSet.lang_col1;
        speakText(text, lang);
    }

    function checkFinished() {
        if (learnedCardKeys.size === totalUniqueCards) {
            overlay.innerHTML = `
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
            
            document.getElementById('sp-restart').addEventListener('click', () => {
                document.removeEventListener('click', clickOutsideHandler);
                openSpellingQuiz({ 
                    starOnly, 
                    randomize, 
                    swapSides, 
                    autoSpeak,
                    ignoreParentheses,
                    skipPunctuation,
                    allowSlashParts
                });
            });
            document.getElementById('sp-finish-close').addEventListener('click', () => {
                closeSpelling();
            });
            return true;
        }
        return false;
    }

    function handleFormSubmit() {
        if (answered) {
            // Already answered, so this click means "Next"
            if (checkFinished()) {
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
            updateQuestion();
            return;
        }

        const inputVal = userInputEl.value.trim();
        const card = activeQueue[currentIndex];
        const correctAnswer = swapSides ? card.term : card.definition;
        const isCorrect = checkSpellingAnswer(inputVal, correctAnswer);

        answered = true;
        userInputEl.disabled = true;
        skipBtn.style.display = 'none';
        submitBtn.textContent = 'Volgende';

        const cardKey = getCardKey(card);

        if (isCorrect) {
            // Correct logic
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

            feedbackContainer.innerHTML = `
                <div class="sp-feedback-card correct">
                    <div class="sp-feedback-status correct">
                        <span class="material-symbols-rounded">check_circle</span>
                        Helemaal goed!
                    </div>
                    <div class="sp-feedback-detail">${escapeHtml(correctAnswer)}</div>
                </div>
            `;
        } else {
            // Incorrect logic
            failureCounts.set(cardKey, (failureCounts.get(cardKey) || 0) + 1);

            const offset = Math.floor(Math.random() * 3) + 3;
            const insertIndex = currentIndex + 1 + offset;
            
            if (insertIndex >= activeQueue.length) {
                activeQueue.push(card);
            } else {
                activeQueue.splice(insertIndex, 0, card);
            }

            feedbackContainer.innerHTML = `
                <div class="sp-feedback-card incorrect">
                    <div class="sp-feedback-status incorrect">
                        <span class="material-symbols-rounded">cancel</span>
                        Helaas, onjuist.
                    </div>
                    <div class="sp-feedback-detail">Jouw antwoord: <span class="sp-feedback-original">${escapeHtml(inputVal || '(leeg)')}</span></div>
                    <div class="sp-feedback-detail" style="font-weight: 600;">Correct antwoord: ${escapeHtml(correctAnswer)}</div>
                </div>
            `;
        }
        feedbackContainer.style.display = 'block';
    }

    function handleSkip() {
        if (answered) return;
        
        userInputEl.value = '';
        handleFormSubmit();
    }

    // Star interaction
    starBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!isOwner) return;
        const currentCard = activeQueue[currentIndex];
        if (!currentCard) return;

        currentCard.starred = !currentCard.starred;

        const isStarred = !!currentCard.starred;
        const icon = starBtn.querySelector('.material-symbols-rounded');
        if (isStarred) {
            starBtn.classList.add('starred');
            icon.style.fontVariationSettings = "'FILL' 1";
        } else {
            starBtn.classList.remove('starred');
            icon.style.fontVariationSettings = "'FILL' 0";
        }

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
                    const label = overlay.querySelector('label[for="sp-star-only"]');
                    const switchEl = overlay.querySelector('.fc-switch');
                    if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                    if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                }
            } else {
                if (starOnlyCheckbox) {
                    starOnlyCheckbox.disabled = false;
                    const label = overlay.querySelector('label[for="sp-star-only"]');
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
            if (revertedStarred) {
                starBtn.classList.add('starred');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                starBtn.classList.remove('starred');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
            Toast.show('Fout bij bijwerken van ster: ' + err.message, 'error');
        }
    });

    speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakCurrentQuestion();
    });

    spForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit();
    });

    skipBtn.addEventListener('click', handleSkip);
    closeBtn.addEventListener('click', closeSpelling);

    // Initial setup
    updateQuestion();
}


