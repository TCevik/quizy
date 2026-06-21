/* Multiple Choice JS */
document.addEventListener('DOMContentLoaded', () => {
    // Intercept clicks on btn-multiple-choice
    document.addEventListener('click', (e) => {
        const btnMultipleChoice = e.target.closest('#btn-multiple-choice');
        if (btnMultipleChoice) {
            e.preventDefault();
            openMultipleChoiceQuiz();
        }
    });
});

function openMultipleChoiceQuiz(options = {}) {
    const isOwner = window.currentUser && window.currentSet && window.currentSet.user_id === window.currentUser.id;
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
    let overlay = document.getElementById('mc-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mc-overlay';
        overlay.className = 'mc-overlay';
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
        return `idx_${window.currentSet.cards.indexOf(card)}`;
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
        <div class="mc-container" style="position: relative;">
            <div class="mc-header">
                <span class="mc-title">${escapeHtml(window.currentSet.title || 'Multiple Choice')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="mc-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="mc-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <!-- Settings Panel -->
                    <div id="mc-settings-panel" class="mc-settings-panel">
                        <h3 class="mc-settings-title">
                            <span class="material-symbols-rounded">settings</span> Instellingen
                        </h3>
                        <div class="mc-setting-item">
                            <div class="mc-setting-row">
                                <label for="mc-star-only" class="mc-setting-label" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Alleen sterwoorden</label>
                                <label class="fc-switch" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
                                    <input type="checkbox" id="mc-star-only" ${starOnly ? 'checked' : ''} ${!hasStarred ? 'disabled' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Oefen alleen de woorden die je met een ster hebt gemarkeerd.</span>
                            <span class="fc-warning-text" id="mc-star-warning">Let op: Dit start een nieuwe sessie. Je voortgang gaat verloren!</span>
                        </div>
                        <div class="mc-setting-item">
                            <div class="mc-setting-row">
                                <label for="mc-randomize" class="mc-setting-label">Willekeurige volgorde</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="mc-randomize" ${randomize ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Schud de vragen in een willekeurige volgorde vanaf de volgende vraag.</span>
                        </div>
                        <div class="mc-setting-item">
                            <div class="mc-setting-row">
                                <label for="mc-swap-sides" class="mc-setting-label">${window.currentSet.mode === 'talen' ? 'Talen omdraaien' : 'Term en definitie omdraaien'}</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="mc-swap-sides" ${swapSides ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">${window.currentSet.mode === 'talen' ? `Toon ${escapeHtml(window.currentSet.lang2 || 'de vertaling')} als vraag en ${escapeHtml(window.currentSet.lang1 || 'het woord')} als antwoord.` : 'Toon de definitie als vraag en de term als antwoord.'}</span>
                        </div>
                        <div class="mc-setting-item">
                            <div class="mc-setting-row">
                                <label for="mc-auto-speak" class="fc-setting-label">Automatisch uitspreken</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="mc-auto-speak" ${autoSpeak ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="fc-setting-description">Spreek de vraag automatisch uit wanneer deze in beeld komt.</span>
                        </div>
                        <div class="mc-settings-actions">
                            <button class="btn-control" id="mc-settings-save" style="background: var(--primary); color: #fff;">Opslaan</button>
                            <button class="btn-control" id="mc-settings-cancel">Annuleren</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Confirmation Modal -->
            <div id="mc-confirm-modal" class="mc-confirm-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(11, 15, 25, 0.85); z-index: 1000; align-items: center; justify-content: center;">
                <div class="glass-panel" style="max-width: 420px; width: 90%; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(22, 22, 30, 0.95); box-shadow: 0 20px 40px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;">
                    <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                        <h3 style="font-size: 1.2em; font-weight: 600; color: var(--text-light); margin: 0; text-align: left;">Sessie herstarten?</h3>
                    </div>
                    <div style="padding: 24px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
                        <p style="color: var(--text-muted); font-size: 0.95em; line-height: 1.5; margin: 0;">Weet je zeker dat je de instellingen voor ster-woorden wilt wijzigen?</p>
                        <p style="color: #ef4444; font-size: 0.9em; font-weight: 500; margin: 0;">Dit start een nieuwe sessie en je huidige voortgang gaat verloren.</p>
                    </div>
                    <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2);">
                        <button id="mc-confirm-cancel" class="btn-control" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; font-size: 0.9em;">Annuleren</button>
                        <button id="mc-confirm-ok" class="btn-control" style="background: var(--primary); border: none; color: #fff; padding: 8px 16px; font-size: 0.9em;">Ja, begin opnieuw</button>
                    </div>
                </div>
            </div>
            
            <div class="mc-question-card" id="mc-question">
                <button class="btn-mc-speak" title="Uitspreken">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <button class="btn-mc-star" ${isOwner ? '' : 'disabled style="pointer-events: none; cursor: default;"'}>
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
    `;

    // Show overlay
    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const questionTextEl = document.getElementById('mc-question-text');
    const questionLabelEl = document.getElementById('mc-question-label');
    const optionsGridEl = document.getElementById('mc-options');
    const nextBtn = document.getElementById('mc-next');
    const closeBtn = document.getElementById('mc-close');
    const progressTextEl = document.getElementById('mc-progress-text');
    const progressFillEl = document.getElementById('mc-progress-fill');
    const starBtn = overlay.querySelector('.btn-mc-star');

    // Settings elements
    const settingsBtn = document.getElementById('mc-settings-btn');
    const settingsPanel = document.getElementById('mc-settings-panel');
    const settingsSave = document.getElementById('mc-settings-save');
    const settingsCancel = document.getElementById('mc-settings-cancel');
    const starOnlyCheckbox = document.getElementById('mc-star-only');
    const randomizeCheckbox = document.getElementById('mc-randomize');
    const swapSidesCheckbox = document.getElementById('mc-swap-sides');
    const autoSpeakCheckbox = document.getElementById('mc-auto-speak');
    const starWarning = document.getElementById('mc-star-warning');

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
            const confirmModal = document.getElementById('mc-confirm-modal');
            const confirmOk = document.getElementById('mc-confirm-ok');
            const confirmCancel = document.getElementById('mc-confirm-cancel');
            
            confirmModal.style.display = 'flex';
            
            const onConfirm = () => {
                confirmModal.style.display = 'none';
                settingsPanel.classList.remove('active');
                if (window.currentSet) {
                    window.currentSet.settings = {
                        ...(window.currentSet.settings || {}),
                        starOnly: newStarOnly,
                        randomize: newRandomize,
                        swapSides: newSwapSides,
                        autoSpeak: newAutoSpeak
                    };
                    if (isOwner && window.saveAndSyncCurrentSet) {
                        window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                    }
                }
                document.removeEventListener('click', clickOutsideHandler);
                openMultipleChoiceQuiz({ starOnly: newStarOnly, randomize: newRandomize, swapSides: newSwapSides, autoSpeak: newAutoSpeak });
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
                    ...(window.currentSet.settings || {}),
                    starOnly: newStarOnly,
                    randomize: newRandomize,
                    swapSides: newSwapSides,
                    autoSpeak: newAutoSpeak
                };
                if (isOwner && window.saveAndSyncCurrentSet) {
                    window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
                }
            }
            if (newRandomize !== randomize) {
                randomize = newRandomize;
                if (randomize) {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    shuffleArray(remaining);
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    if (window.Toast) window.Toast.show('Vragen worden nu in willekeurige volgorde getoond.', 'success');
                } else {
                    const remaining = activeQueue.slice(currentIndex + 1);
                    remaining.sort((a, b) => {
                        return originalCards.indexOf(a) - originalCards.indexOf(b);
                    });
                    activeQueue.splice(currentIndex + 1, activeQueue.length - (currentIndex + 1), ...remaining);
                    if (window.Toast) window.Toast.show('Willekeurige volgorde uitgeschakeld. Vragen gaan verder in de originele volgorde.', 'info');
                }
            }
            if (newSwapSides !== swapSides) {
                swapSides = newSwapSides;
                updateQuestion();
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

    function closeMC() {
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

    function generateOptions(correctCard) {
        const correctText = swapSides ? correctCard.term : correctCard.definition;
        
        // Find other unique answers
        const otherCards = window.currentSet.cards.filter(c => getCardKey(c) !== getCardKey(correctCard));
        
        // Extract texts
        const potentialDistractors = [...new Set(otherCards.map(c => swapSides ? c.term : c.definition))].filter(t => t !== correctText);
        
        // Shuffle and pick up to 3 distractors
        shuffleArray(potentialDistractors);
        const distractors = potentialDistractors.slice(0, 3);
        
        const allOptions = [correctText, ...distractors];
        shuffleArray(allOptions);
        
        return {
            options: allOptions,
            correctAnswer: correctText
        };
    }

    let currentOptionsData = null;

    function updateQuestion() {
        answered = false;
        nextBtn.style.display = 'none';
        
        const card = activeQueue[currentIndex];
        if (!card) return;

        if (swapSides) {
            questionTextEl.textContent = card.definition;
            if (window.currentSet.mode === 'talen') {
                questionLabelEl.textContent = window.currentSet.lang2 || 'Definitie';
            } else {
                questionLabelEl.textContent = 'Definitie';
            }
        } else {
            questionTextEl.textContent = card.term;
            if (window.currentSet.mode === 'talen') {
                questionLabelEl.textContent = window.currentSet.lang1 || 'Term';
            } else {
                questionLabelEl.textContent = 'Term';
            }
        }

        // Generate Multiple Choice Options
        currentOptionsData = generateOptions(card);
        
        optionsGridEl.innerHTML = '';
        currentOptionsData.options.forEach((optText, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            const btn = document.createElement('button');
            btn.className = 'mc-option-btn';
            btn.innerHTML = `
                <span class="mc-option-badge">${letter}</span>
                <span>${escapeHtml(optText)}</span>
            `;
            btn.addEventListener('click', () => selectOption(btn, optText));
            optionsGridEl.appendChild(btn);
        });

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
            const text = swapSides ? card.definition : card.term;
            const lang = swapSides ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) {
                window.speakText(text, lang);
            }
        }
    }

    function selectOption(selectedBtn, selectedText) {
        if (answered) return;
        answered = true;

        const correctText = currentOptionsData.correctAnswer;
        const correct = (selectedText === correctText);

        // Highlight correct and incorrect answers
        Array.from(optionsGridEl.children).forEach(btn => {
            btn.disabled = true;
            const textSpan = btn.querySelector('span:not(.mc-option-badge)');
            if (textSpan.textContent === correctText) {
                btn.classList.add('correct');
            }
        });

        if (!correct) {
            selectedBtn.classList.add('incorrect');
            submitAnswer(false);
        } else {
            submitAnswer(true);
        }

        nextBtn.style.display = 'inline-flex';
    }

    function checkFinished() {
        if (learnedCardKeys.size === totalUniqueCards) {
            overlay.innerHTML = `
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
            
            document.getElementById('mc-restart').addEventListener('click', () => {
                document.removeEventListener('click', clickOutsideHandler);
                openMultipleChoiceQuiz({ starOnly, randomize, swapSides });
            });
            document.getElementById('mc-finish-close').addEventListener('click', () => {
                closeMC();
            });
            return true;
        }
        return false;
    }

    // Stores if the current question's result was correct or incorrect
    let currentQuestionCorrect = true;

    function submitAnswer(correct) {
        const currentCard = activeQueue[currentIndex];
        const cardKey = getCardKey(currentCard);

        if (correct) {
            currentQuestionCorrect = true;
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
        } else {
            currentQuestionCorrect = false;
            failureCounts.set(cardKey, (failureCounts.get(cardKey) || 0) + 1);

            const offset = Math.floor(Math.random() * 3) + 3;
            const insertIndex = currentIndex + 1 + offset;
            
            if (insertIndex >= activeQueue.length) {
                activeQueue.push(currentCard);
            } else {
                activeQueue.splice(insertIndex, 0, currentCard);
            }
        }
    }

    function handleNext() {
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
            const hasStarredNow = window.currentSet && window.currentSet.cards && window.currentSet.cards.some(c => c.starred);
            if (!hasStarredNow) {
                if (window.currentSet.settings) {
                    window.currentSet.settings.starOnly = false;
                }
                if (starOnlyCheckbox) {
                    starOnlyCheckbox.checked = false;
                    starOnlyCheckbox.disabled = true;
                    const label = overlay.querySelector('label[for="mc-star-only"]');
                    const switchEl = overlay.querySelector('.fc-switch');
                    if (label) label.style.cssText = 'opacity: 0.5; cursor: not-allowed;';
                    if (switchEl) switchEl.style.cssText = 'opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                }
            } else {
                if (starOnlyCheckbox) {
                    starOnlyCheckbox.disabled = false;
                    const label = overlay.querySelector('label[for="mc-star-only"]');
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
            if (revertedStarred) {
                starBtn.classList.add('starred');
                icon.style.fontVariationSettings = "'FILL' 1";
            } else {
                starBtn.classList.remove('starred');
                icon.style.fontVariationSettings = "'FILL' 0";
            }
            if (window.Toast) window.Toast.show('Fout bij bijwerken van ster: ' + err.message, 'error');
        }
    });

    const speakBtn = overlay.querySelector('.btn-mc-speak');
    if (speakBtn) {
        speakBtn.addEventListener('click', (e) => {
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

    nextBtn.addEventListener('click', handleNext);
    closeBtn.addEventListener('click', closeMC);

    // Initial setup
    updateQuestion();
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
