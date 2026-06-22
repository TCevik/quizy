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
    const isOwner = window.currentUser && window.currentSet && window.currentSet.user_id === window.currentUser.id;
    const savedSettings = (window.currentSet && window.currentSet.settings) || {};
    const hasStarred = window.currentSet && window.currentSet.cards && window.currentSet.cards.some(c => c.starred);
    
    // Normal settings
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
    
    // Spelling-specific settings
    let ignoreParentheses = ('ignoreParentheses' in options) ? !!options.ignoreParentheses : ('ignoreParentheses' in savedSettings ? !!savedSettings.ignoreParentheses : true);
    let skipPunctuation = ('skipPunctuation' in options) ? !!options.skipPunctuation : ('skipPunctuation' in savedSettings ? !!savedSettings.skipPunctuation : true);
    let allowSlashParts = ('allowSlashParts' in options) ? !!options.allowSlashParts : ('allowSlashParts' in savedSettings ? !!savedSettings.allowSlashParts : true);

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
        <div class="sp-container" style="position: relative;">
            <div class="sp-header">
                <span class="sp-title">${escapeHtml(window.currentSet.title || 'Spelling')}</span>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                    <button class="btn-close-flashcards" id="sp-settings-btn" title="Instellingen" style="transform: none;">
                        <span class="material-symbols-rounded">settings</span>
                    </button>
                    <button class="btn-close-flashcards" id="sp-close">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                    <!-- Settings Panel -->
                    <div id="sp-settings-panel" class="sp-settings-panel">
                        <h3 class="sp-settings-title">
                            <span class="material-symbols-rounded">settings</span> Instellingen
                        </h3>
                        
                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-star-only" class="sp-setting-label" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Alleen sterwoorden</label>
                                <label class="fc-switch" style="${!hasStarred ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
                                    <input type="checkbox" id="sp-star-only" ${starOnly ? 'checked' : ''} ${!hasStarred ? 'disabled' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Oefen alleen de woorden die je met een ster hebt gemarkeerd.</span>
                            <span class="sp-warning-text" id="sp-star-warning">Let op: Dit start een nieuwe sessie. Je voortgang gaat verloren!</span>
                        </div>

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-randomize" class="sp-setting-label">Willekeurige volgorde</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-randomize" ${randomize ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Schud de vragen in een willekeurige volgorde vanaf de volgende vraag.</span>
                        </div>

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-swap-sides" class="sp-setting-label">${window.currentSet.mode === 'talen' ? 'Talen omdraaien' : 'Term en definitie omdraaien'}</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-swap-sides" ${swapSides ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">${window.currentSet.mode === 'talen' ? `Vraag ${escapeHtml(window.currentSet.lang2 || 'de vertaling')} en typ ${escapeHtml(window.currentSet.lang1 || 'het woord')}.` : 'Vraag de definitie en typ de term.'}</span>
                        </div>

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-auto-speak" class="sp-setting-label">Automatisch uitspreken</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-auto-speak" ${autoSpeak ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Spreek de vraag automatisch uit wanneer deze in beeld komt.</span>
                        </div>

                        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0;">

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-ignore-parentheses" class="sp-setting-label">Tussen haakjes goedkeuren</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-ignore-parentheses" ${ignoreParentheses ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Dingen tussen haakjes zijn optioneel. Bijv. "de (mooie) auto" keurt ook "de auto" goed.</span>
                        </div>

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-skip-punctuation" class="sp-setting-label">Leestekens & accenten skippen</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-skip-punctuation" ${skipPunctuation ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Negeer leestekens, en vervang speciale letters zoals é of ì door e en i.</span>
                        </div>

                        <div class="sp-setting-item">
                            <div class="sp-setting-row">
                                <label for="sp-allow-slash-parts" class="sp-setting-label">Eén kant van / goedkeuren</label>
                                <label class="fc-switch">
                                    <input type="checkbox" id="sp-allow-slash-parts" ${allowSlashParts ? 'checked' : ''}>
                                    <span class="fc-slider"></span>
                                </label>
                            </div>
                            <span class="sp-setting-description">Als het antwoord "hoi/hallo" is, is "hoi" óf "hallo" goed.</span>
                        </div>

                        <div class="sp-settings-actions">
                            <button class="btn-control" id="sp-settings-save" style="background: var(--primary); color: #fff;">Opslaan</button>
                            <button class="btn-control" id="sp-settings-cancel">Annuleren</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Confirmation Modal -->
            <div id="sp-confirm-modal" class="sp-confirm-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(11, 15, 25, 0.85); z-index: 1000; align-items: center; justify-content: center;">
                <div class="glass-panel" style="max-width: 420px; width: 90%; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(22, 22, 30, 0.95); box-shadow: 0 20px 40px rgba(0,0,0,0.6); overflow: hidden; display: flex; flex-direction: column;">
                    <div style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                        <h3 style="font-size: 1.2em; font-weight: 600; color: var(--text-light); margin: 0; text-align: left;">Sessie herstarten?</h3>
                    </div>
                    <div style="padding: 24px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
                        <p style="color: var(--text-muted); font-size: 0.95em; line-height: 1.5; margin: 0;">Weet je zeker dat je de instellingen voor ster-woorden wilt wijzigen?</p>
                        <p style="color: #ef4444; font-size: 0.9em; font-weight: 500; margin: 0;">Dit start een nieuwe sessie en je huidige voortgang gaat verloren.</p>
                    </div>
                    <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2);">
                        <button id="sp-confirm-cancel" class="btn-control" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; font-size: 0.9em;">Annuleren</button>
                        <button id="sp-confirm-ok" class="btn-control" style="background: var(--primary); border: none; color: #fff; padding: 8px 16px; font-size: 0.9em;">Ja, begin opnieuw</button>
                    </div>
                </div>
            </div>
            
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
    const settingsSave = document.getElementById('sp-settings-save');
    const settingsCancel = document.getElementById('sp-settings-cancel');
    const starOnlyCheckbox = document.getElementById('sp-star-only');
    const randomizeCheckbox = document.getElementById('sp-randomize');
    const swapSidesCheckbox = document.getElementById('sp-swap-sides');
    const autoSpeakCheckbox = document.getElementById('sp-auto-speak');
    const ignoreParenthesesCheckbox = document.getElementById('sp-ignore-parentheses');
    const skipPunctuationCheckbox = document.getElementById('sp-skip-punctuation');
    const allowSlashPartsCheckbox = document.getElementById('sp-allow-slash-parts');
    const starWarning = document.getElementById('sp-star-warning');

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
        ignoreParenthesesCheckbox.checked = ignoreParentheses;
        skipPunctuationCheckbox.checked = skipPunctuation;
        allowSlashPartsCheckbox.checked = allowSlashParts;
        starWarning.style.display = 'none';
    });

    settingsSave.addEventListener('click', (e) => {
        e.stopPropagation();
        const newStarOnly = starOnlyCheckbox.checked;
        const newRandomize = randomizeCheckbox.checked;
        const newSwapSides = swapSidesCheckbox ? swapSidesCheckbox.checked : false;
        const newAutoSpeak = autoSpeakCheckbox ? autoSpeakCheckbox.checked : false;
        const newIgnoreParentheses = ignoreParenthesesCheckbox.checked;
        const newSkipPunctuation = skipPunctuationCheckbox.checked;
        const newAllowSlashParts = allowSlashPartsCheckbox.checked;

        if (newStarOnly !== starOnly) {
            const confirmModal = document.getElementById('sp-confirm-modal');
            const confirmOk = document.getElementById('sp-confirm-ok');
            const confirmCancel = document.getElementById('sp-confirm-cancel');
            
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
                        autoSpeak: newAutoSpeak,
                        ignoreParentheses: newIgnoreParentheses,
                        skipPunctuation: newSkipPunctuation,
                        allowSlashParts: newAllowSlashParts
                    };
                    if (isOwner && window.saveAndSyncCurrentSet) {
                        window.saveAndSyncCurrentSet().catch(err => console.error("Error saving settings:", err));
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
                    autoSpeak: newAutoSpeak,
                    ignoreParentheses: newIgnoreParentheses,
                    skipPunctuation: newSkipPunctuation,
                    allowSlashParts: newAllowSlashParts
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
            
            swapSides = newSwapSides;
            autoSpeak = newAutoSpeak;
            ignoreParentheses = newIgnoreParentheses;
            skipPunctuation = newSkipPunctuation;
            allowSlashParts = newAllowSlashParts;
            
            updateQuestion();
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
            ignoreParenthesesCheckbox.checked = ignoreParentheses;
            skipPunctuationCheckbox.checked = skipPunctuation;
            allowSlashPartsCheckbox.checked = allowSlashParts;
            starWarning.style.display = 'none';
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
        // Helper to normalize string for comparison
        function normalizeString(str) {
            if (!str) return '';
            let s = str.toLowerCase();
            
            // Remove diacritics and punctuation if skipPunctuation is active
            if (skipPunctuation) {
                s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                // Keep only alphanumeric characters and spaces
                s = s.replace(/[^a-z0-9\s]/g, "");
            }
            
            // Replace multiple whitespace/newlines with single space, and trim
            s = s.replace(/\s+/g, ' ').trim();
            return s;
        }

        const normalizedInput = normalizeString(userInput);

        // Generate list of acceptable answers from correctAnswer
        let answers = [correctAnswer];

        if (allowSlashParts) {
            let newAnswers = [];
            answers.forEach(ans => {
                const parts = ans.split('/').map(p => p.trim());
                
                const getSubsets = (array) => {
                    return array.reduce(
                        (subsets, value) => subsets.concat(subsets.map(set => [...set, value])),
                        [[]]
                    );
                };
                
                const subsets = getSubsets(parts).filter(set => set.length > 0);
                subsets.forEach(set => {
                    newAnswers.push(set.join('/'));
                    newAnswers.push(set.join(' / '));
                });
            });
            answers = [...answers, ...newAnswers];
        }

        if (ignoreParentheses) {
            let newAnswers = [];
            answers.forEach(ans => {
                // Option A: Keep everything but remove the parentheses characters: e.g. "de (mooie) auto" -> "de mooie auto"
                const withParenText = ans.replace(/[()]/g, '');
                newAnswers.push(withParenText);

                // Option B: Remove the parentheses and their contents: e.g. "de (mooie) auto" -> "de auto"
                const withoutParenText = ans.replace(/\([^)]*\)/g, '');
                newAnswers.push(withoutParenText);
            });
            answers = [...answers, ...newAnswers];
        }

        // Normalize all generated acceptable answers and check for a match
        const normalizedAcceptable = answers.map(ans => normalizeString(ans));
        const uniqueAcceptable = [...new Set(normalizedAcceptable)].filter(Boolean);

        return uniqueAcceptable.includes(normalizedInput);
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
        const lang = swapSides ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
        if (window.speakText) {
            window.speakText(text, lang);
        }
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
            const hasStarredNow = window.currentSet && window.currentSet.cards && window.currentSet.cards.some(c => c.starred);
            if (!hasStarredNow) {
                if (window.currentSet.settings) {
                    window.currentSet.settings.starOnly = false;
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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
