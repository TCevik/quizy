import { getSetWithCards, syncSetToRemote, deleteLocalSet, getLocalSet, saveLocalSet } from './storage.js';
import { supabaseReady } from './supabase-init.js';
import Toast from './toast.js';
import { state } from './state.js';
import { speakText, escapeHtml } from './main.js';

const init = async () => {
    const supabase = await supabaseReady;

    if (!supabase) {
        console.error('Supabase failed to initialize.');
        return;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'login.html';
        return;
    }
    state.currentUser = user;

    // Get set ID from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const setId = urlParams.get('id');

    if (!setId) {
        Toast.show('Geen set ID opgegeven.', 'error');
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
            state.currentSet = set;
            renderSetDetails();
        }

        // Fetch creator name: use cached value first, fetch live only if missing
        const creatorNameEl = document.getElementById('creator-name');
        if (set && set.creator_name && creatorNameEl) {
            creatorNameEl.textContent = set.creator_name;
        }

        if (navigator.onLine) {
            supabase
                .from('Sets')
                .select('user_id, profiles(full_name)')
                .eq('id', setId)
                .single()
                .then(({ data, error }) => {
                    if (!error && data && data.profiles?.full_name) {
                        if (creatorNameEl) {
                            creatorNameEl.textContent = data.profiles.full_name;
                        }
                        // Cache for next visit
                        if (currentSet && currentSet.creator_name !== data.profiles.full_name) {
                            currentSet.creator_name = data.profiles.full_name;
                            saveLocalSet(currentSet);
                        }
                    }
                })
                .catch(err => console.error(err));
        }

        set = await getSetWithCards(supabase, setId, user.id);

        if (!set) {
            Toast.show('Set kon niet worden geladen.', 'error');
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
            state.currentSet = set;
            renderSetDetails();
        }
    }

    function renderSetDetails() {
        if (!currentSet) return;

        const isOwner = currentSet.user_id === user.id;
        const btnEditSet = document.getElementById('btn-edit-set');
        const btnDeleteSet = document.getElementById('btn-delete-set');
        const btnToggleVisibility = document.getElementById('btn-toggle-visibility');

        if (btnEditSet) btnEditSet.style.display = isOwner ? '' : 'none';
        if (btnDeleteSet) btnDeleteSet.style.display = isOwner ? '' : 'none';
        if (btnToggleVisibility) btnToggleVisibility.style.display = isOwner ? '' : 'none';

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

        // Visibility Badge and Icon Toggle setup
        const visibility = currentSet.visibility || 'private';
        const visibilityBadge = document.getElementById('set-visibility-badge');
        const visibilityIcon = document.getElementById('visibility-icon');
        
        if (visibility === 'public') {
            if (visibilityBadge) {
                visibilityBadge.textContent = 'Openbaar';
                visibilityBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                visibilityBadge.style.color = '#10b981';
            }
            if (visibilityIcon) visibilityIcon.textContent = 'public';
            if (btnToggleVisibility) btnToggleVisibility.title = 'Maak privé';
        } else {
            if (visibilityBadge) {
                visibilityBadge.textContent = 'Privé';
                visibilityBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                visibilityBadge.style.color = '#ef4444';
            }
            if (visibilityIcon) visibilityIcon.textContent = 'lock';
            if (btnToggleVisibility) btnToggleVisibility.title = 'Maak openbaar';
        }

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

        const isOwner = currentSet && currentSet.user_id === user.id;
        let html = '';
        cards.forEach((card, index) => {
            const originalIndex = currentSet && currentSet.cards ? currentSet.cards.indexOf(card) : index;
            const displayIndex = originalIndex !== -1 ? originalIndex + 1 : index + 1;

            const isStarred = !!card.starred;
            const starFill = isStarred ? "font-variation-settings: 'FILL' 1;" : "font-variation-settings: 'FILL' 0;";
            const starColor = isStarred ? "color: #ffca28;" : "color: var(--text-muted);";
            
            const starBtnHtml = `
                <button class="btn-star-card" data-index="${index}" ${isOwner ? '' : 'disabled style="cursor: default; pointer-events: none;"'}>
                    <span class="material-symbols-rounded" style="${starFill} ${starColor} font-size: 22px;">star</span>
                </button>
            `;

            html += `
                <div class="term-card glass-panel">
                    <div class="term-number">${displayIndex}</div>
                    <div class="term-side" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                        <span>${escapeHtml(card.term)}</span>
                        <button class="btn-speak btn-speak-term" data-index="${index}" title="Uitspreken">
                            <span class="material-symbols-rounded" style="font-size: 18px;">volume_up</span>
                        </button>
                    </div>
                    <div class="def-side" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                        <span>${escapeHtml(card.definition)}</span>
                        <button class="btn-speak btn-speak-def" data-index="${index}" title="Uitspreken">
                            <span class="material-symbols-rounded" style="font-size: 18px;">volume_up</span>
                        </button>
                    </div>
                    ${starBtnHtml}
                </div>
            `;
        });

        termsListEl.innerHTML = html;

        // Add event delegation for speaking terms, definitions & starring cards
        if (termsListEl && !termsListEl.dataset.listenerAttached) {
            termsListEl.dataset.listenerAttached = 'true';
            termsListEl.addEventListener('click', async (e) => {
                const btnSpeakTerm = e.target.closest('.btn-speak-term');
                const btnSpeakDef = e.target.closest('.btn-speak-def');
                const btnStarCard = e.target.closest('.btn-star-card');

                if (btnSpeakTerm) {
                    e.stopPropagation();
                    const idx = parseInt(btnSpeakTerm.getAttribute('data-index'), 10);
                    const card = currentSet.cards[idx];
                    speakText(card.term, currentSet.lang_col1);
                } else if (btnSpeakDef) {
                    e.stopPropagation();
                    const idx = parseInt(btnSpeakDef.getAttribute('data-index'), 10);
                    const card = currentSet.cards[idx];
                    speakText(card.definition, currentSet.lang_col2 || currentSet.lang_col1);
                } else if (btnStarCard) {
                    e.stopPropagation();
                    const idx = parseInt(btnStarCard.getAttribute('data-index'), 10);
                    const card = currentSet.cards[idx];
                    
                    card.starred = !card.starred;
                    let settingsChanged = false;
                    const hasStarred = currentSet.cards.some(c => c.starred);
                    if (!hasStarred && currentSet.settings && currentSet.settings.starOnly) {
                        currentSet.settings.starOnly = false;
                        settingsChanged = true;
                    }
                    
                    try {
                        await saveLocalSet(currentSet);
                        
                        if (navigator.onLine) {
                            await state.saveAndSyncCurrentSet({ immediate: true });
                        }

                        const icon = btnStarCard.querySelector('.material-symbols-rounded');
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
                        if (settingsChanged && currentSet.settings) {
                            currentSet.settings.starOnly = true;
                        }
                        await saveLocalSet(currentSet);
                        Toast.show('Fout bij bijwerken van ster: ' + updateError.message, 'error');
                    }
                }
            });
        }
    }

    let _remoteSyncTimer = null;
    let _originalUpdatedAt = null;

    state.saveAndSyncCurrentSet = async ({ immediate = false } = {}) => {
        if (!currentSet || currentSet.user_id !== user.id) return;

        if (_remoteSyncTimer === null) {
            _originalUpdatedAt = currentSet.updated_at;
        }

        // Always save locally immediately
        currentSet.updated_at = new Date().toISOString();
        await saveLocalSet(currentSet);

        const doRemoteSync = async () => {
            try {
                const dbPayload = {
                    title: currentSet.title,
                    description: currentSet.description,
                    folder: currentSet.folder,
                    type: currentSet.type,
                    lang_col1: currentSet.lang_col1,
                    lang_col2: currentSet.lang_col2,
                    cards: currentSet.cards,
                    visibility: currentSet.visibility || 'private',
                    settings: currentSet.settings || null,
                    updated_at: currentSet.updated_at
                };
                await syncSetToRemote(supabase, dbPayload, currentSet.id);
                _remoteSyncTimer = null;
                _originalUpdatedAt = null;
            } catch (e) {
                if (_originalUpdatedAt !== null) {
                    currentSet.updated_at = _originalUpdatedAt;
                    await saveLocalSet(currentSet);
                }
                _remoteSyncTimer = null;
                _originalUpdatedAt = null;
                throw e;
            }
        };

        if (immediate) {
            clearTimeout(_remoteSyncTimer);
            await doRemoteSync();
        } else {
            clearTimeout(_remoteSyncTimer);
            _remoteSyncTimer = setTimeout(() => {
                doRemoteSync().catch(e => console.error('Remote sync error:', e));
            }, 800);
        }
    };

    state.refreshTermsList = () => {
        if (currentSet && currentSet.cards) {
            renderTermsList(currentSet.cards);
        }
    };

    // Helper to escape HTML to prevent XSS
    // Setup Edit and Delete Interaction
    const btnEditSet = document.getElementById('btn-edit-set');
    const btnDeleteSet = document.getElementById('btn-delete-set');
    const btnShareSet = document.getElementById('btn-share-set');
    const setModalComp = document.getElementById('set-modal-comp');
    const deleteModal = document.getElementById('delete-confirm-modal');

    if (btnShareSet) {
        btnShareSet.addEventListener('click', async () => {
            const url = window.location.href;
            try {
                await navigator.clipboard.writeText(url);
                Toast.show('Link gekopieerd naar klembord!', 'success');
            } catch (err) {
                Toast.show('Fout bij kopiëren van link.', 'error');
            }
        });
    }

    if (btnEditSet && setModalComp) {
        btnEditSet.addEventListener('click', () => {
            if (!currentSet) return;
            if (currentSet.user_id !== user.id) {
                Toast.show('Je bent niet de eigenaar van deze set.', 'error');
                return;
            }
            const mappedData = {
                id: currentSet.id,
                title: currentSet.title,
                description: currentSet.description,
                folder: currentSet.folder,
                mode: currentSet.type,
                lang1: currentSet.lang_col1,
                lang2: currentSet.lang_col2,
                visibility: currentSet.visibility || 'private',
                rows: currentSet.cards
            };
            setModalComp.open('edit', mappedData);
        });
    }

    if (setModalComp) {
        setModalComp.addEventListener('save', async (e) => {
            if (currentSet && currentSet.user_id !== user.id) {
                Toast.show('Je bent niet de eigenaar van deze set.', 'error');
                return;
            }
            const { data: setData } = e.detail;
            const dbPayload = {
                title: setData.title,
                description: setData.description,
                folder: setData.folder,
                type: setData.mode,
                lang_col1: setData.lang1,
                lang_col2: setData.lang2,
                visibility: setData.visibility || 'private',
                cards: setData.rows,
                settings: (currentSet && currentSet.settings) || null,
                updated_at: new Date().toISOString()
            };

            try {
                await syncSetToRemote(supabase, dbPayload, currentSet.id);
                loadSetDetails();
            } catch (updateError) {
                Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
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
            } catch (e) {
                console.error('Error loading folder options:', e);
            }
        } else if (currentSet && currentSet.folder) {
            setModalComp.updateFolderOptions([currentSet.folder]);
        }
    }

    if (btnDeleteSet && deleteModal) {
        btnDeleteSet.addEventListener('click', () => {
            if (currentSet && currentSet.user_id !== user.id) {
                Toast.show('Je bent niet de eigenaar van deze set.', 'error');
                return;
            }
            deleteModal.open(setId);
        });
    }

    const btnToggleVisibility = document.getElementById('btn-toggle-visibility');
    const visibilityWarningModal = document.getElementById('visibility-warning-modal');

    async function applyVisibilityChange() {
        const newVisibility = currentSet.visibility === 'public' ? 'private' : 'public';
        currentSet.visibility = newVisibility;
        Toast.show('Zichtbaarheid bijwerken...', 'info');
        try {
            await state.saveAndSyncCurrentSet({ immediate: true });
            renderSetDetails();
            Toast.show(`Set is nu ${newVisibility === 'public' ? 'openbaar' : 'privé'}!`, 'success');
        } catch (err) {
            currentSet.visibility = newVisibility === 'public' ? 'private' : 'public';
            Toast.show('Fout bij bijwerken: ' + err.message, 'error');
        }
    }

    if (btnToggleVisibility) {
        btnToggleVisibility.addEventListener('click', async () => {
            if (!currentSet) return;
            if (currentSet.user_id !== user.id) {
                Toast.show('Je bent niet de eigenaar van deze set.', 'error');
                return;
            }

            if (currentSet.visibility === 'public') {
                if (visibilityWarningModal) {
                    visibilityWarningModal.open({
                        title: 'Set privé maken?',
                        message: 'Als je deze set privé maakt, verdwijnt hij uit de "Gedeeld met mij" map van alle gebruikers die hem hebben opgeslagen. Ze moeten de set opnieuw toevoegen als je hem later weer openbaar maakt.',
                        sub: '⚠ Andere gebruikers verliezen direct toegang tot deze set.',
                        confirmText: 'Privé maken'
                    });
                } else {
                    await applyVisibilityChange();
                }
            } else {
                await applyVisibilityChange();
            }
        });
    }

    if (visibilityWarningModal) {
        visibilityWarningModal.addEventListener('confirm', async () => {
            await applyVisibilityChange();
        });
    }

    if (deleteModal) {
        deleteModal.addEventListener('confirm', async () => {
            if (currentSet && currentSet.user_id !== user.id) {
                Toast.show('Je bent niet de eigenaar van deze set.', 'error');
                return;
            }
            const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setId);
            if (deleteError) {
                Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
            } else {
                await deleteLocalSet(setId);
                Toast.show('Set succesvol verwijderd!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        });
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
            } else {
                learnBubbleMenu.classList.remove('open');
            }
        });

        document.addEventListener('click', () => {
            learnBubbleMenu.classList.remove('open');
        });
    }

    // Initial load
    loadSetDetails();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
