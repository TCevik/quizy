document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btnLearnMode = e.target.closest('#btn-learn-mode');
        if (btnLearnMode) {
            e.preventDefault();
            openLearnMode();
        }
    });
});

function openLearnMode() {
    if (!window.currentSet || !window.currentSet.cards || window.currentSet.cards.length === 0) {
        if (window.Toast) window.Toast.show('Deze set heeft geen kaarten om te leren.', 'error');
        return;
    }

    const mainWrapper = document.querySelector('main.set-wrapper');
    let overlay = document.getElementById('learn-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'learn-overlay';
        overlay.className = 'learn-overlay';
        if (mainWrapper) {
            mainWrapper.appendChild(overlay);
        } else {
            document.body.appendChild(overlay);
        }
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

    const originalCards = window.currentSet.cards;
    const totalCards = originalCards.length;
    const cardLevels = new Map();
    originalCards.forEach(card => {
        cardLevels.set(getCardKey(card), 0);
    });

    let activeBatch = [];
    const batchSize = 5;
    let lastCardKey = null;
    const failedInCurrentBatch = new Set();

    overlay.innerHTML = `
        <div class="learn-container">
            <div class="learn-header">
                <span class="learn-title">${escapeHtml(window.currentSet.title || 'Leermodus')}</span>
                <button class="btn-close-flashcards" id="learn-close">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>

            <div class="progress-container">
                <span class="progress-text" id="learn-progress-text">Voortgang: 0%</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="learn-progress-fill"></div>
                </div>
            </div>

            <div class="learn-card-area" id="learn-card-area"></div>

            <div class="learn-batch-dots" id="learn-batch-dots"></div>
        </div>
    `;

    overlay.style.display = 'flex';
    overlay.classList.add('active');

    const cardArea = document.getElementById('learn-card-area');
    const batchDotsContainer = document.getElementById('learn-batch-dots');
    const progressText = document.getElementById('learn-progress-text');
    const progressFill = document.getElementById('learn-progress-fill');
    const closeBtn = document.getElementById('learn-close');

    closeBtn.addEventListener('click', closeLearn);

    fillActiveBatch();
    showNextQuestion();

    function getCardKey(card) {
        return card.id || `${card.term}_${card.definition}`;
    }

    function fillActiveBatch() {
        if (activeBatch.length === 0) {
            failedInCurrentBatch.forEach(key => {
                cardLevels.set(key, 0);
            });
            failedInCurrentBatch.clear();

            while (activeBatch.length < batchSize) {
                const nextCard = originalCards.find(c => {
                    const key = getCardKey(c);
                    return cardLevels.get(key) < 3 && !activeBatch.some(bc => getCardKey(bc) === key);
                });
                if (nextCard) {
                    activeBatch.push(nextCard);
                } else {
                    break;
                }
            }
        }
    }

    function updateProgress() {
        let totalLevels = 0;
        cardLevels.forEach(lvl => {
            totalLevels += lvl;
        });
        const maxLevels = totalCards * 3;
        const percentage = Math.round((totalLevels / maxLevels) * 100);
        progressText.textContent = `Voortgang: ${percentage}%`;
        progressFill.style.width = `${percentage}%`;

        batchDotsContainer.innerHTML = '';
        activeBatch.forEach(card => {
            const lvl = cardLevels.get(getCardKey(card));
            const dot = document.createElement('div');
            dot.className = `learn-batch-dot level-${lvl}`;
            batchDotsContainer.appendChild(dot);
        });
    }

    function showNextQuestion() {
        fillActiveBatch();
        updateProgress();

        if (activeBatch.length === 0) {
            showCelebration();
            return;
        }

        let selectedCard = null;
        if (activeBatch.length === 1) {
            selectedCard = activeBatch[0];
        } else {
            const candidates = activeBatch.filter(c => getCardKey(c) !== lastCardKey);
            if (candidates.length > 0) {
                selectedCard = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                selectedCard = activeBatch[Math.floor(Math.random() * activeBatch.length)];
            }
        }

        const key = getCardKey(selectedCard);
        const level = cardLevels.get(key);

        if (level === 0) {
            renderFlashcard(selectedCard);
        } else if (level === 1) {
            renderMultipleChoice(selectedCard);
        } else if (level === 2) {
            renderSpelling(selectedCard);
        }
    }

    function renderFlashcard(card) {
        cardArea.innerHTML = `
            <div class="learn-flashcard-wrapper" id="learn-card-wrapper">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-flashcard-inner">
                    <div class="learn-flashcard-face learn-flashcard-front">
                        <div class="learn-card-label">${escapeHtml(window.currentSet.lang_col1 || 'Term')}</div>
                        <div class="learn-card-text">${escapeHtml(card.term)}</div>
                        <div style="margin-top: 20px; font-size: 0.85em; color: var(--text-muted);">Klik om om te draaien</div>
                    </div>
                    <div class="learn-flashcard-face learn-flashcard-back">
                        <div class="learn-card-label">${escapeHtml(window.currentSet.lang_col2 || 'Definitie')}</div>
                        <div class="learn-card-text">${escapeHtml(card.definition)}</div>
                    </div>
                </div>
            </div>
            <div class="learn-controls">
                <button class="btn-control" id="learn-btn-no" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444;">
                    Nee, nog niet
                </button>
                <button class="btn-control" id="learn-btn-yes" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.2); color: #10b981;">
                    Ja, wist ik
                </button>
            </div>
        `;

        const wrapper = document.getElementById('learn-card-wrapper');
        wrapper.addEventListener('click', () => {
            wrapper.classList.toggle('flipped');
        });

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const text = wrapper.classList.contains('flipped') ? card.definition : card.term;
            const lang = wrapper.classList.contains('flipped') ? (window.currentSet.lang_col2 || window.currentSet.lang_col1) : window.currentSet.lang_col1;
            if (window.speakText) {
                window.speakText(text, lang);
            }
        });

        document.getElementById('learn-btn-no').addEventListener('click', () => {
            failedInCurrentBatch.add(getCardKey(card));
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });

        document.getElementById('learn-btn-yes').addEventListener('click', () => {
            cardLevels.set(getCardKey(card), 1);
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });
    }

    function renderMultipleChoice(card) {
        const correctText = card.definition;
        const otherCards = originalCards.filter(c => getCardKey(c) !== getCardKey(card));
        const potentialDistractors = [...new Set(otherCards.map(c => c.definition))].filter(t => t !== correctText);
        
        for (let i = potentialDistractors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialDistractors[i], potentialDistractors[j]] = [potentialDistractors[j], potentialDistractors[i]];
        }
        const distractors = potentialDistractors.slice(0, 3);
        const options = [correctText, ...distractors];
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        cardArea.innerHTML = `
            <div class="learn-mc-question-card">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-card-label">${escapeHtml(window.currentSet.lang_col1 || 'Term')}</div>
                <div class="learn-card-text">${escapeHtml(card.term)}</div>
            </div>
            <div class="learn-mc-options-grid" id="learn-mc-options"></div>
            <div class="learn-controls" style="display: none;" id="learn-mc-action">
                <button class="btn-control" id="learn-mc-next" style="background: var(--primary); color: #fff;">
                    Volgende
                    <span class="material-symbols-rounded">arrow_forward</span>
                </button>
            </div>
        `;

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', () => {
            if (window.speakText) {
                window.speakText(card.term, window.currentSet.lang_col1);
            }
        });

        const optionsGrid = document.getElementById('learn-mc-options');
        let answered = false;

        options.forEach((optText, index) => {
            const letter = String.fromCharCode(65 + index);
            const btn = document.createElement('button');
            btn.className = 'learn-mc-option-btn';
            btn.innerHTML = `
                <span class="learn-mc-option-badge">${letter}</span>
                <span>${escapeHtml(optText)}</span>
            `;
            btn.addEventListener('click', () => {
                if (answered) return;
                answered = true;

                Array.from(optionsGrid.children).forEach(b => {
                    b.disabled = true;
                    const textSpan = b.querySelector('span:not(.learn-mc-option-badge)');
                    if (textSpan.textContent === correctText) {
                        b.classList.add('correct');
                    }
                });

                if (optText === correctText) {
                    cardLevels.set(getCardKey(card), 2);
                } else {
                    btn.classList.add('incorrect');
                    cardLevels.set(getCardKey(card), 0);
                    failedInCurrentBatch.add(getCardKey(card));
                }

                document.getElementById('learn-mc-action').style.display = 'flex';
            });
            optionsGrid.appendChild(btn);
        });

        document.getElementById('learn-mc-next').addEventListener('click', () => {
            lastCardKey = getCardKey(card);
            showNextQuestion();
        });
    }

    function renderSpelling(card) {
        cardArea.innerHTML = `
            <div class="learn-mc-question-card">
                <button class="learn-speak-btn" id="learn-speak">
                    <span class="material-symbols-rounded">volume_up</span>
                </button>
                <div class="learn-card-label">${escapeHtml(window.currentSet.lang_col1 || 'Term')}</div>
                <div class="learn-card-text">${escapeHtml(card.term)}</div>
            </div>
            <form id="learn-sp-form" class="learn-sp-form" autocomplete="off" onsubmit="return false;">
                <div class="learn-sp-input-wrapper">
                    <input type="text" id="learn-sp-input" class="learn-sp-input" placeholder="Typ je antwoord hier..." autofocus>
                </div>
                <div id="learn-sp-feedback" style="display: none;"></div>
                <div class="learn-controls">
                    <button type="button" class="btn-control" id="learn-sp-skip" style="background: transparent; border-color: rgba(255,255,255,0.1);">
                        Overslaan
                    </button>
                    <button type="submit" class="btn-control" id="learn-sp-submit" style="background: var(--primary); color: #fff;">
                        Controleren
                    </button>
                </div>
            </form>
        `;

        const speakBtn = document.getElementById('learn-speak');
        speakBtn.addEventListener('click', () => {
            if (window.speakText) {
                window.speakText(card.term, window.currentSet.lang_col1);
            }
        });

        const form = document.getElementById('learn-sp-form');
        const input = document.getElementById('learn-sp-input');
        const feedback = document.getElementById('learn-sp-feedback');
        const submitBtn = document.getElementById('learn-sp-submit');
        const skipBtn = document.getElementById('learn-sp-skip');
        let answered = false;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (answered) {
                lastCardKey = getCardKey(card);
                showNextQuestion();
                return;
            }

            const inputVal = input.value.trim();
            const correct = checkSpellingAnswer(inputVal, card.definition);
            answered = true;
            input.disabled = true;
            skipBtn.style.display = 'none';
            submitBtn.textContent = 'Volgende';

            if (correct) {
                cardLevels.set(getCardKey(card), 3);
                const idx = activeBatch.findIndex(c => getCardKey(c) === getCardKey(card));
                if (idx !== -1) {
                    activeBatch.splice(idx, 1);
                }
                feedback.innerHTML = `
                    <div class="learn-sp-feedback-card correct">
                        <div class="learn-sp-feedback-status correct">
                            <span class="material-symbols-rounded">check_circle</span>
                            Helemaal goed!
                        </div>
                        <div class="learn-sp-feedback-detail">${escapeHtml(card.definition)}</div>
                    </div>
                `;
            } else {
                cardLevels.set(getCardKey(card), 1);
                failedInCurrentBatch.add(getCardKey(card));
                feedback.innerHTML = `
                    <div class="learn-sp-feedback-card incorrect">
                        <div class="learn-sp-feedback-status incorrect">
                            <span class="material-symbols-rounded">cancel</span>
                            Helaas, onjuist.
                        </div>
                        <div class="learn-sp-feedback-detail">Jouw antwoord: <span class="learn-sp-feedback-original">${escapeHtml(inputVal || '(leeg)')}</span></div>
                        <div class="learn-sp-feedback-detail" style="font-weight: 600;">Correct antwoord: ${escapeHtml(card.definition)}</div>
                    </div>
                `;
            }
            feedback.style.display = 'block';
        });

        skipBtn.addEventListener('click', () => {
            if (answered) return;
            input.value = '';
            submitBtn.click();
        });
    }

    function checkSpellingAnswer(userInput, correctAnswer) {
        function normalizeString(str) {
            if (!str) return '';
            let s = str.toLowerCase();
            s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            s = s.replace(/[^a-z0-9\s]/g, "");
            s = s.replace(/\s+/g, ' ').trim();
            return s;
        }

        const normalizedInput = normalizeString(userInput);
        let answers = [correctAnswer];

        let newAnswers = [];
        answers.forEach(ans => {
            const parts = ans.split('/');
            parts.forEach(p => {
                newAnswers.push(p.trim());
            });
        });
        answers = newAnswers;

        let withParenAnswers = [];
        answers.forEach(ans => {
            const withParenText = ans.replace(/[()]/g, '');
            withParenAnswers.push(withParenText);
            const withoutParenText = ans.replace(/\([^)]*\)/g, '');
            withParenAnswers.push(withoutParenText);
        });
        answers = [...answers, ...withParenAnswers];

        const normalizedAcceptable = answers.map(ans => normalizeString(ans));
        const uniqueAcceptable = [...new Set(normalizedAcceptable)].filter(Boolean);

        return uniqueAcceptable.includes(normalizedInput);
    }

    function showCelebration() {
        cardArea.innerHTML = `
            <div style="text-align: center; padding: 40px 0;">
                <span class="material-symbols-rounded" style="font-size: 5em; color: var(--primary); margin-bottom: 20px; animation: bounce 1s infinite alternate;">emoji_events</span>
                <h2 class="learn-title" style="font-size: 2em; margin-bottom: 10px;">Gefeliciteerd!</h2>
                <p style="color: var(--text-muted); margin-bottom: 30px;">Je hebt alle kaarten in deze set volledig geleerd!</p>
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <button class="btn-control" id="learn-restart">Opnieuw starten</button>
                    <button class="btn-control" id="learn-finish-close" style="background: rgba(255,255,255,0.1);">Sluiten</button>
                </div>
            </div>
        `;

        document.getElementById('learn-restart').addEventListener('click', () => {
            originalCards.forEach(card => {
                cardLevels.set(getCardKey(card), 0);
            });
            activeBatch = [];
            lastCardKey = null;
            fillActiveBatch();
            showNextQuestion();
        });

        document.getElementById('learn-finish-close').addEventListener('click', closeLearn);
    }

    function closeLearn() {
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

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
