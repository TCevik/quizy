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
        const { data: set, error: fetchError } = await supabase
            .from('Sets')
            .select('*')
            .eq('id', setId)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !set) {
            console.error('Error fetching set details:', fetchError);
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

        currentSet = set;
        window.currentSet = set;
        renderSetDetails();
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
            html += `
                <div class="term-card glass-panel">
                    <div class="term-number">${index + 1}</div>
                    <div class="term-side">${escapeHtml(card.term)}</div>
                    <div class="def-side">${escapeHtml(card.definition)}</div>
                </div>
            `;
        });

        termsListEl.innerHTML = html;
    }

    // Helper to escape HTML to prevent XSS
    // Setup Edit and Delete Interaction
    const btnEditSet = document.getElementById('btn-edit-set');
    const btnDeleteSet = document.getElementById('btn-delete-set');
    const setModalComp = document.getElementById('set-modal-comp');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const btnDeleteCancel = document.getElementById('btn-delete-cancel');
    const btnDeleteConfirm = document.getElementById('btn-delete-confirm');

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
                updated_at: new Date().toISOString()
            };

            const { error: updateError } = await supabase.from('Sets').update(dbPayload).eq('id', currentSet.id);
            if (updateError) {
                console.error('Error updating set:', updateError);
                if (window.Toast) window.Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
            } else {
                loadSetDetails();
            }
        });

        // Initialize folder options for edit modal if there are folders
        const { data: setsData } = await supabase
            .from('Sets')
            .select('folder')
            .eq('user_id', user.id);
        if (setsData) {
            const folders = [...new Set(setsData.map(s => s.folder).filter(f => f && f.trim() !== ''))];
            setModalComp.updateFolderOptions(folders);
        }
    }

    if (btnDeleteSet && deleteModal) {
        btnDeleteSet.addEventListener('click', () => {
            deleteModal.classList.add('active');
        });
    }

    if (btnDeleteCancel && deleteModal) {
        btnDeleteCancel.addEventListener('click', () => {
            deleteModal.classList.remove('active');
        });
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                deleteModal.classList.remove('active');
            }
        });
    }

    if (btnDeleteConfirm && deleteModal) {
        btnDeleteConfirm.addEventListener('click', async () => {
            const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setId);
            if (deleteError) {
                console.error('Error deleting set:', deleteError);
                if (window.Toast) window.Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
            } else {
                if (window.Toast) window.Toast.show('Set succesvol verwijderd!', 'success');
                deleteModal.classList.remove('active');
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
