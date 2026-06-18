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

    const cards = window.currentSet.cards;
    let currentIndex = 0;

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
                <button class="btn-control btn-control-circle" id="fc-prev" title="Vorige">
                    <span class="material-symbols-rounded">arrow_back</span>
                </button>
                <button class="btn-control" id="fc-flip">
                    <span class="material-symbols-rounded">flip</span>
                    Omdraaien
                </button>
                <button class="btn-control btn-control-circle" id="fc-next" title="Volgende">
                    <span class="material-symbols-rounded">arrow_forward</span>
                </button>
            </div>

            <div class="progress-container">
                <span class="progress-text" id="fc-progress-text">Kaart 1 van 1</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" id="fc-progress-fill"></div>
                </div>
            </div>

            <div class="shortcuts-hint">
                Tip: Gebruik [Spatie] om om te draaien en [Pijltjes] om te navigeren.
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
    const prevBtn = document.getElementById('fc-prev');
    const nextBtn = document.getElementById('fc-next');
    const flipBtn = document.getElementById('fc-flip');
    const closeBtn = document.getElementById('fc-close');
    const progressTextEl = document.getElementById('fc-progress-text');
    const progressFillEl = document.getElementById('fc-progress-fill');

    let isAnimating = false;

    function updateCard() {
        cardEl.classList.remove('flipped');
        
        const card = cards[currentIndex];
        frontTextEl.textContent = card.term;
        backTextEl.textContent = card.definition;
        
        progressTextEl.textContent = `Kaart ${currentIndex + 1} van ${cards.length}`;
        progressFillEl.style.width = `${((currentIndex + 1) / cards.length) * 100}%`;
        
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === cards.length - 1;
    }

    function navigate(direction) {
        if (isAnimating) return;
        if (direction === 'next' && currentIndex < cards.length - 1) {
            isAnimating = true;
            cardEl.classList.add('card-slide-out-left');
            setTimeout(() => {
                currentIndex++;
                updateCard();
                cardEl.classList.remove('card-slide-out-left');
                cardEl.classList.add('card-slide-in-right');
                setTimeout(() => {
                    cardEl.classList.remove('card-slide-in-right');
                    isAnimating = false;
                }, 250);
            }, 200);
        } else if (direction === 'prev' && currentIndex > 0) {
            isAnimating = true;
            cardEl.classList.add('card-slide-out-right');
            setTimeout(() => {
                currentIndex--;
                updateCard();
                cardEl.classList.remove('card-slide-out-right');
                cardEl.classList.add('card-slide-in-left');
                setTimeout(() => {
                    cardEl.classList.remove('card-slide-in-left');
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

    prevBtn.addEventListener('click', () => {
        navigate('prev');
    });

    nextBtn.addEventListener('click', () => {
        navigate('next');
    });

    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        document.removeEventListener('keydown', handleKeyDown);
    });

    function handleKeyDown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!isAnimating) cardEl.classList.toggle('flipped');
        } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
            navigate('next');
        } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
            navigate('prev');
        } else if (e.code === 'Escape') {
            closeBtn.click();
        }
    }

    document.addEventListener('keydown', handleKeyDown);

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
