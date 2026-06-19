import { getSetWithCards, syncSetToRemote, deleteLocalSet, getLocalSet } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseReady;

    if (!supabase) {
        console.error('Supabase failed to initialize.');
        return;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Get set ID from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');

    if (!setId) {
        if (window.Toast) window.Toast.show('Geen set ID opgegeven.', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        return;
    }

    let currentSet = null;

    async function loadSetDetails() {
        let set = await getLocalSet(setId);
        if (set && set.cards) {
            currentSet = set;
            window.currentSet = set;
            renderSetDetails();
        }

        set = await getSetWithCards(supabase, setId, user.id);

        if (!set && !currentSet) {
            if (window.Toast) window.Toast.show('Set kon niet worden geladen.', 'error');
            document.querySelector('.set-wrapper').innerHTML = `
                <div class="back-nav">
                    <a href="dashboard.html" class="btn-back">
                        <span class="material-symbols-rounded">arrow_back</span>
                        Terug naar dashboard
                    </a>
                </div>
                <div style="text-align:center; padding: 80px 24px; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 4em; opacity: 0.5; margin-bottom:16px;">error</span>
                    <h3>Set niet gevonden</h3>
                    <p>De opgevraagde set bestaat niet of je hebt hier geen toegang toe.</p>
                </div>
            `;
            return;
        }

        if (set) {
            currentSet = set;
            window.currentSet = set;
            renderSetDetails();
        }
    }

    function renderSetDetails() {
        if (!currentSet) return;

        // Title & Description
        document.getElementById('set-title').textContent = currentSet.title || 'Naamloze set';
        document.getElementById('set-description').textContent = currentSet.description || 'Geen beschrijving opgegeven.';

        // Badges
        document.getElementById('set-type-badge').textContent = currentSet.type || 'woorden';
        
        const count = currentSet.cards ? currentSet.cards.length : 0;
        document.getElementById('set-count-badge').textContent = `${count} kaarten`;

        const folderBadge = document.getElementById('set-folder-badge');
        if (currentSet.folder && currentSet.folder.trim() !== '') {
            folderBadge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px; vertical-align:middle; margin-right:4px;">folder</span>${currentSet.folder}`;
            folderBadge.style.display = 'inline-flex';
            folderBadge.style.alignItems = 'center';
        } else {
            folderBadge.style.display = 'none';
        }

        // Date Info
        const createdDate = currentSet.created_at ? new Date(currentSet.created_at).toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Onbekend';
        document.getElementById('set-created').textContent = createdDate;
        
        const lastUpdated = currentSet.updated_at ? new Date(currentSet.updated_at).toLocaleDateString('nl-NL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Onbekend';
        document.getElementById('set-updated').textContent = lastUpdated;

        renderTermsList(currentSet.cards || []);
    }

    function renderTermsList(cards) {
        const termsListEl = document.getElementById('terms-list');
        const termsCountEl = document.getElementById('terms-count');
        
        termsCountEl.textContent = cards.length;

        if (cards.length === 0) {
            termsListEl.innerHTML = `
                <div class="glass-panel" style="text-align:center; padding: 40px; color: var(--text-muted); border-radius:16px;">
                    Geen kaarten aanwezig in deze set.
                </div>
            `;
            return;
        }

        let html = '';
        cards.forEach((card, index) => {
            const isStarred = !!card.starred;
            const starFill = isStarred ? "font-variation-settings: 'FILL' 1;" : "font-variation-settings: 'FILL' 0;";
            const starColor = isStarred ? "color: #ffca28;" : "color: var(--text-muted);";
            html += `
                <div class="term-card glass-panel">
                    <div class="term-number">${index + 1}</div>
                    <div class="term-side">${escapeHtml(card.term)}</div>
                    <div class="def-side">${escapeHtml(card.definition)}</div>
                    <button class="btn-star-card" data-index="${index}">
                        <span class="material-symbols-rounded" style="${starFill} ${starColor} font-size: 22px;">star</span>
                    </button>
                </div>
            `;
        });

        termsListEl.innerHTML = html;

        // Add event listener for starring cards
        termsListEl.querySelectorAll('.btn-star-card').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'), 10);
                const card = cards[idx];
                
                card.starred = !card.starred;
                
                try {
                    const hasStarred = cards.some(c => c.starred);
                    if (!hasStarred && currentSet.settings && currentSet.settings.starOnly) {
                        currentSet.settings.starOnly = false;
                    }
                    await window.saveAndSyncCurrentSet();
                    const icon = btn.querySelector('.material-symbols-rounded');
                    if (card.starred) {
                        icon.style.fontVariationSettings = "'FILL' 1";
                        icon.style.color = "#ffca28";
                    } else {
                        icon.style.fontVariationSettings = "'FILL' 0";
                        icon.style.color = "var(--text-muted)";
                    }
                } catch (updateError) {
                    // Revert local change if error
                    card.starred = !card.starred;
                    if (window.Toast) window.Toast.show('Fout bij bijwerken van ster: ' + updateError.message, 'error');
                }
            });
        });
    }

    window.saveAndSyncCurrentSet = async () => {
        if (!currentSet) return;
        const dbPayload = {
            title: currentSet.title,
            description: currentSet.description,
            folder: currentSet.folder,
            type: currentSet.type,
            lang_col1: currentSet.lang_col1,
            lang_col2: currentSet.lang_col2,
            cards: currentSet.cards,
            card_count: currentSet.cards ? currentSet.cards.length : 0,
            settings: currentSet.settings || null,
            updated_at: new Date().toISOString()
        };
        await syncSetToRemote(supabase, dbPayload, currentSet.id);
    };

    window.refreshTermsList = () => {
        if (currentSet && currentSet.cards) {
            renderTermsList(currentSet.cards);
        }
    };

    // Helper to escape HTML to prevent XSS
    // Setup Edit and Delete Interaction
    const btnEditSet = document.getElementById('btn-edit-set');
    const btnDeleteSet = document.getElementById('btn-delete-set');
    const setModalComp = document.getElementById('set-modal-comp');
    const deleteModal = document.getElementById('delete-confirm-modal');

    if (btnEditSet && setModalComp) {
        btnEditSet.addEventListener('click', () => {
            if (!currentSet) return;
            const mappedData = {
                id: currentSet.id,
                title: currentSet.title,
                description: currentSet.description,
                folder: currentSet.folder,
                mode: currentSet.type,
                lang1: currentSet.lang_col1,
                lang2: currentSet.lang_col2,
                rows: currentSet.cards
            };
            setModalComp.open('edit', mappedData);
        });
    }

    if (setModalComp) {
        setModalComp.addEventListener('save', async (e) => {
            const { data: setData } = e.detail;
            const dbPayload = {
                title: setData.title,
                description: setData.description,
                folder: setData.folder,
                type: setData.mode,
                lang_col1: setData.lang1,
                lang_col2: setData.lang2,
                cards: setData.rows,
                card_count: setData.rows ? setData.rows.length : 0,
                settings: (currentSet && currentSet.settings) || null,
                updated_at: new Date().toISOString()
            };

            try {
                await syncSetToRemote(supabase, dbPayload, currentSet.id);
                loadSetDetails();
            } catch (updateError) {
                if (window.Toast) window.Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
            }
        });

        // Initialize folder options for edit modal if there are folders
        const localSets = await getLocalSet(setId); // Fallback: just use current set's folder if offline
        if (navigator.onLine) {
            try {
                const { data: setsData } = await supabase
                    .from('Sets')
                    .select('folder')
                    .eq('user_id', user.id);
                if (setsData) {
                    const folders = [...new Set(setsData.map(s => s.folder).filter(f => f && f.trim() !== ''))];
                    setModalComp.updateFolderOptions(folders);
                }
            } catch (e) {}
        } else if (currentSet && currentSet.folder) {
            setModalComp.updateFolderOptions([currentSet.folder]);
        }
    }

    if (btnDeleteSet && deleteModal) {
        btnDeleteSet.addEventListener('click', () => {
            deleteModal.open(setId);
        });
    }

    if (deleteModal) {
        deleteModal.addEventListener('confirm', async () => {
            const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setId);
            if (deleteError) {
                if (window.Toast) window.Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
            } else {
                await deleteLocalSet(setId);
                if (window.Toast) window.Toast.show('Set succesvol verwijderd!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        });
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

    // Setup Search Event Listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (!currentSet || !currentSet.cards) return;
            const query = e.target.value.toLowerCase().trim();
            const filteredCards = currentSet.cards.filter(card => {
                const termMatch = card.term && card.term.toLowerCase().includes(query);
                const defMatch = card.definition && card.definition.toLowerCase().includes(query);
                return termMatch || defMatch;
            });
            renderTermsList(filteredCards);
        });
    }

    // Learn button bubble effect
    const btnLearn = document.getElementById('btn-learn');
    const learnBubbleMenu = document.getElementById('learn-bubble-menu');
    const flashcardsButtons = document.querySelectorAll('#btn-flashcards');
    
    if (btnLearn && learnBubbleMenu) {
        btnLearn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = learnBubbleMenu.classList.contains('open');
            if (!isOpen) {
                learnBubbleMenu.classList.add('open');
                learnBubbleMenu.style.maxHeight = learnBubbleMenu.scrollHeight + 'px';
                learnBubbleMenu.style.opacity = '1';
                learnBubbleMenu.style.transform = 'scale(1)';
                learnBubbleMenu.style.pointerEvents = 'auto';
                btnLearn.style.background = 'rgba(255, 255, 255, 0.1)';
            } else {
                learnBubbleMenu.classList.remove('open');
                learnBubbleMenu.style.maxHeight = '0px';
                learnBubbleMenu.style.opacity = '0';
                learnBubbleMenu.style.transform = 'scale(0.8)';
                learnBubbleMenu.style.pointerEvents = 'none';
                btnLearn.style.background = 'rgba(255, 255, 255, 0.05)';
            }
        });

        document.addEventListener('click', () => {
            learnBubbleMenu.classList.remove('open');
            learnBubbleMenu.style.maxHeight = '0px';
            learnBubbleMenu.style.opacity = '0';
            learnBubbleMenu.style.transform = 'scale(0.8)';
            learnBubbleMenu.style.pointerEvents = 'none';
            btnLearn.style.background = 'rgba(255, 255, 255, 0.05)';
        });
    }

    // Initial load
    loadSetDetails();
});
