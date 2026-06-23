import { syncSets, syncSetToRemote, deleteLocalSet, getLocalSet, getLocalSets, saveLocalSet } from './storage.js';

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseReady;

    if (!supabase) {
        console.error('Supabase failed to initialize.');
        return;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    // Display user's email
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }

    // Set modal component interaction
    const setModalComp = document.getElementById('set-modal-comp');
    const createSetBtn = document.getElementById('btn-create-set');
    const dashboardContent = document.querySelector('.dashboard-content');

    // Delete Confirmation Modal Elements
    const deleteModal = document.getElementById('delete-confirm-modal');

    if (deleteModal) {
        deleteModal.addEventListener('confirm', async (e) => {
            const setIdToDelete = e.detail.id;
            if (setIdToDelete !== null) {
                const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setIdToDelete);
                if (deleteError) {
                    if (window.Toast) window.Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
                } else {
                    await deleteLocalSet(setIdToDelete);
                    if (window.Toast) window.Toast.show('Set succesvol verwijderd!', 'success');
                    loadSets();
                }
            }
        });
    }

    // Rename Folder Modal Elements
    const renameModal = document.getElementById('rename-folder-modal');

    if (renameModal) {
        renameModal.addEventListener('confirm', async (e) => {
            const { oldName, newName } = e.detail;
            if (oldName && newName && oldName.trim() !== '' && newName.trim() !== '') {
                try {
                    if (window.Toast) window.Toast.show('Mapnaam bijwerken...', 'info');

                    // 1. Bulk update on remote database (Supabase)
                    const { error: updateError } = await supabase
                        .from('Sets')
                        .update({ folder: newName, updated_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                        .eq('folder', oldName);

                    if (updateError) {
                        if (window.Toast) window.Toast.show('Fout bij remote bijwerken: ' + updateError.message, 'error');
                        return;
                    }

                    // 2. Update locally in IndexedDB
                    const localSets = await getLocalSets();
                    for (const s of localSets) {
                        if (s.user_id === user.id && s.folder && s.folder.trim() === oldName) {
                            s.folder = newName;
                            s.updated_at = new Date().toISOString();
                            await saveLocalSet(s);
                        }
                    }

                    // 3. Update current folder filter if it was active
                    if (currentFolderFilter === oldName) {
                        currentFolderFilter = newName;
                    }

                    if (window.Toast) window.Toast.show('Mapnaam succesvol aangepast!', 'success');
                    loadSets();
                } catch (err) {
                    if (window.Toast) window.Toast.show('Fout bij hernoemen map: ' + err.message, 'error');
                }
            }
        });
    }

    let allSets = [];
    let sharedSets = [];
    let publicSearchResults = [];
    let currentFolderFilter = 'all';
    let searchQuery = '';
    let currentPage = 1;
    const pageSize = 20;
    const folderFilterContainer = document.getElementById('folder-filter-container');
    const searchInput = document.getElementById('search-input');

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            currentPage = 1;
            
            clearTimeout(searchTimeout);
            if (searchQuery.length >= 2) {
                searchTimeout = setTimeout(async () => {
                    try {
                        const { data: remotePublicSets, error } = await supabase
                            .from('Sets')
                            .select('id, title, description, folder, type, card_count, visibility, updated_at, created_at, user_id')
                            .eq('visibility', 'public')
                            .ilike('title', `%${searchQuery}%`)
                            .limit(50);
                        
                        if (!error && remotePublicSets) {
                            publicSearchResults = remotePublicSets;
                            renderSets();
                        }
                    } catch (err) {
                        console.error('Fout bij zoeken naar openbare sets:', err);
                    }
                }, 300);
            } else {
                publicSearchResults = [];
                renderSets();
            }
        });
    }

    // Function to render folder filter chips
    function renderFolderFilter(sets) {
        if (!folderFilterContainer) return;

        const folders = [];
        let setsWithoutFolderCount = 0;
        
        sets.forEach(set => {
            if (set.folder && set.folder.trim() !== '') {
                const trimmed = set.folder.trim();
                if (!folders.includes(trimmed)) {
                    folders.push(trimmed);
                }
            } else {
                setsWithoutFolderCount++;
            }
        });

        folders.sort((a, b) => a.localeCompare(b));
        if (setModalComp) {
            setModalComp.updateFolderOptions(folders);
        }

        if (sets.length === 0 && sharedSets.length === 0) {
            folderFilterContainer.innerHTML = '';
            return;
        }

        // Check if the current filter is still valid, otherwise reset to 'all'
        if (currentFolderFilter === 'shared' && sharedSets.length === 0) {
            currentFolderFilter = 'all';
        } else if (currentFolderFilter !== 'all' && currentFolderFilter !== 'none' && currentFolderFilter !== 'shared' && !folders.includes(currentFolderFilter)) {
            currentFolderFilter = 'all';
        } else if (currentFolderFilter === 'none' && setsWithoutFolderCount === 0) {
            currentFolderFilter = 'all';
        }

        let html = `
            <div class="folder-chips-title">
                <span class="material-symbols-rounded">folder_shared</span>
                Mappen
            </div>
            <div class="folder-chips">
        `;

        if (sharedSets.length > 0) {
            html += `
                <button class="folder-chip folder-chip--shared ${currentFolderFilter === 'shared' ? 'active' : ''}" data-folder="shared">
                    <div>
                        <span class="material-symbols-rounded">group</span>
                        <span>Gedeeld met mij</span>
                    </div>
                    <span class="chip-count">${sharedSets.length}</span>
                </button>
                <div class="folder-chip-divider"></div>
            `;
        }

        html += `
                <button class="folder-chip ${currentFolderFilter === 'all' ? 'active' : ''}" data-folder="all">
                    <div>
                        <span class="material-symbols-rounded">folder_open</span>
                        <span>Alle sets</span>
                    </div>
                    <span class="chip-count">${sets.length}</span>
                </button>
        `;

        folders.forEach(folder => {
            const count = sets.filter(s => s.folder && s.folder.trim() === folder).length;
            html += `
                <button class="folder-chip ${currentFolderFilter === folder ? 'active' : ''}" data-folder="${escapeHtml(folder)}">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                            <span class="material-symbols-rounded">folder</span>
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">${escapeHtml(folder)}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="rename-folder-btn" title="Map hernoemen" data-folder="${escapeHtml(folder)}" style="display: none; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); transition: color 0.2s;">
                                <span class="material-symbols-rounded" style="font-size: 16px;">edit</span>
                            </span>
                            <span class="chip-count">${count}</span>
                        </div>
                    </div>
                </button>
            `;
        });

        if (setsWithoutFolderCount > 0) {
            html += `
                <button class="folder-chip ${currentFolderFilter === 'none' ? 'active' : ''}" data-folder="none">
                    <div>
                        <span class="material-symbols-rounded">folder_off</span>
                        <span>Geen map</span>
                    </div>
                    <span class="chip-count">${setsWithoutFolderCount}</span>
                </button>
            `;
        }

        html += '</div>';
        folderFilterContainer.innerHTML = html;

        // Attach event listeners
        folderFilterContainer.querySelectorAll('.folder-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                if (e.target.closest('.rename-folder-btn')) {
                    return;
                }
                currentFolderFilter = chip.getAttribute('data-folder');
                folderFilterContainer.querySelectorAll('.folder-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentPage = 1;
                renderSets();
            });
        });

        folderFilterContainer.querySelectorAll('.rename-folder-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const folderName = btn.getAttribute('data-folder');
                if (renameModal) {
                    renameModal.open(folderName);
                }
            });
        });
    }

    // Function to render sets based on folder filter
    function renderSets() {
        if (!dashboardContent) return;

        let filteredSets;
        if (searchQuery) {
            const combined = [...allSets, ...sharedSets, ...publicSearchResults];
            const uniqueSets = [];
            const seenIds = new Set();
            for (const set of combined) {
                if (!seenIds.has(set.id)) {
                    seenIds.add(set.id);
                    uniqueSets.push(set);
                }
            }
            filteredSets = uniqueSets.filter(s => s.title && s.title.toLowerCase().includes(searchQuery));
        } else {
            if (currentFolderFilter === 'shared') {
                filteredSets = sharedSets;
            } else if (currentFolderFilter === 'none') {
                filteredSets = allSets.filter(s => !s.folder || s.folder.trim() === '');
            } else if (currentFolderFilter !== 'all') {
                filteredSets = allSets.filter(s => s.folder && s.folder.trim() === currentFolderFilter);
            } else {
                filteredSets = allSets;
            }
        }

        if (filteredSets.length === 0) {
            dashboardContent.innerHTML = `
                <div class="no-sets-box" style="padding: 40px 24px;">
                    <span class="material-symbols-rounded no-sets-icon">${searchQuery ? 'search_off' : 'folder_open'}</span>
                    <h3>${searchQuery ? 'Geen resultaten' : 'Geen sets in deze map'}</h3>
                    <p>${searchQuery ? 'Geen studiesets gevonden die voldoen aan de zoekterm.' : 'Er zijn nog geen studiesets aan deze map toegevoegd.'}</p>
                </div>
            `;
            return;
        }

        // Clamp currentPage
        const totalPages = Math.ceil(filteredSets.length / pageSize);
        if (currentPage > totalPages) {
            currentPage = Math.max(1, totalPages);
        }

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageSets = filteredSets.slice(startIndex, endIndex);

        let html = '<div class="sets-grid">';
        pageSets.forEach(set => {
            const lastUpdated = set.updated_at ? new Date(set.updated_at).toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Onbekend';
            
            let cardCountLabel = 'Onbekend aantal kaarten';
            if (set.card_count !== undefined && set.card_count !== null) {
                cardCountLabel = `${set.card_count} kaarten`;
            } else if (set.cards && Array.isArray(set.cards)) {
                cardCountLabel = `${set.cards.length} kaarten`;
            }
            const folderLabel = set.folder && set.folder.trim() !== '' 
                ? `<span class="set-folder-tag"><span class="material-symbols-rounded" style="font-size:14px;">folder</span> ${escapeHtml(set.folder)}</span>` 
                : '';

            const isOwnSet = set.user_id === user.id;
            const authorLabel = !isOwnSet 
                ? `<span class="set-author-tag"><span class="material-symbols-rounded" style="font-size:14px;">person</span> Van andere gebruiker</span>` 
                : '';

            const isLocal = set.user_id === user.id || sharedSets.some(s => s.id === set.id);

            html += `
                <div class="set-card glass-panel" data-id="${set.id}">
                    <div>
                        <div class="set-card-header">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <h3 class="set-title">${escapeHtml(set.title) || 'Naamloze set'}</h3>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${folderLabel}
                                    ${authorLabel}
                                </div>
                            </div>
                            <span class="set-badge">${escapeHtml(set.type) || 'woorden'}</span>
                        </div>
                        <p class="set-desc">${escapeHtml(set.description) || 'Geen beschrijving'}</p>
                    </div>
                    <div class="set-card-footer">
                        <div class="set-meta">
                            <span><span class="material-symbols-rounded" style="font-size:16px;">calendar_today</span> Gewijzigd: ${lastUpdated}</span>
                            <span><span class="material-symbols-rounded" style="font-size:16px;">style</span> ${cardCountLabel}</span>
                        </div>
                        <div class="set-actions">
                            ${set.user_id === user.id ? `
                            <button class="btn-icon-action edit-btn" title="Bewerken" data-id="${set.id}">
                                <span class="material-symbols-rounded">edit</span>
                            </button>` : ''}
                            ${isLocal ? `
                            <button class="btn-icon-action delete-btn" title="Verwijderen" data-id="${set.id}">
                                <span class="material-symbols-rounded">delete</span>
                            </button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        // Add pagination HTML if totalPages > 1
        if (totalPages > 1) {
            html += `
                <div class="pagination-container">
                    <button class="pagination-btn" id="btn-page-prev10" ${currentPage <= 10 ? 'disabled' : ''}>
                        <span class="material-symbols-rounded">keyboard_double_arrow_left</span> -10
                    </button>
                    <button class="pagination-btn" id="btn-page-prev" ${currentPage === 1 ? 'disabled' : ''}>
                        <span class="material-symbols-rounded">chevron_left</span> Vorige
                    </button>
                    <span class="pagination-info">Pagina ${currentPage} van ${totalPages}</span>
                    <button class="pagination-btn" id="btn-page-next" ${currentPage === totalPages ? 'disabled' : ''}>
                        Volgende <span class="material-symbols-rounded">chevron_right</span>
                    </button>
                    <button class="pagination-btn" id="btn-page-next10" ${currentPage + 10 > totalPages ? 'disabled' : ''}>
                        +10 <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                    </button>
                </div>
            `;
        }

        dashboardContent.innerHTML = html;

        // Attach event listeners to pagination buttons
        if (totalPages > 1) {
            const btnPrev10 = document.getElementById('btn-page-prev10');
            const btnPrev = document.getElementById('btn-page-prev');
            const btnNext = document.getElementById('btn-page-next');
            const btnNext10 = document.getElementById('btn-page-next10');

            if (btnPrev10) {
                btnPrev10.addEventListener('click', () => {
                    currentPage = Math.max(1, currentPage - 10);
                    renderSets();
                });
            }
            if (btnPrev) {
                btnPrev.addEventListener('click', () => {
                    currentPage = Math.max(1, currentPage - 1);
                    renderSets();
                });
            }
            if (btnNext) {
                btnNext.addEventListener('click', () => {
                    currentPage = Math.min(totalPages, currentPage + 1);
                    renderSets();
                });
            }
            if (btnNext10) {
                btnNext10.addEventListener('click', () => {
                    currentPage = Math.min(totalPages, currentPage + 10);
                    renderSets();
                });
            }
        }

        // Attach event listeners to card actions
        dashboardContent.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const setId = parseInt(btn.getAttribute('data-id'));
                const setToEdit = allSets.find(s => s.id === setId);
                if (setToEdit && setModalComp) {
                    if (window.Toast) window.Toast.show('Set laden...', 'info');
                    
                    let fullSet = await getLocalSet(setId);
                    if (!fullSet || !fullSet.cards) {
                        const { data: remoteSet, error: detailError } = await supabase
                            .from('Sets')
                            .select('lang_col1, lang_col2, settings, cards')
                            .eq('id', setId)
                            .single();

                        if (detailError) {
                            if (window.Toast) window.Toast.show('Fout bij laden van set: ' + detailError.message, 'error');
                            return;
                        }
                        fullSet = { ...setToEdit, ...remoteSet };
                    }

                    const mappedData = {
                        id: setToEdit.id,
                        title: setToEdit.title,
                        description: setToEdit.description,
                        folder: setToEdit.folder,
                        mode: setToEdit.type,
                        lang1: fullSet.lang_col1,
                        lang2: fullSet.lang_col2,
                        visibility: fullSet.visibility || 'private',
                        rows: fullSet.cards
                    };
                    setModalComp.open('edit', mappedData);
                }
            });
        });

        dashboardContent.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setId = parseInt(btn.getAttribute('data-id'));
                if (deleteModal) {
                    deleteModal.open(setId);
                }
            });
        });

        dashboardContent.querySelectorAll('.set-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-icon-action')) {
                    return;
                }
                const setId = card.getAttribute('data-id');
                window.location.href = `set.html?id=${setId}`;
            });
        });
    }

    // Function to load and display sets
    async function loadSets() {
        if (!dashboardContent) return;

        const localSets = await getLocalSets();
        const ownLocalSets = localSets.filter(s => s.user_id === user.id);
        sharedSets = localSets.filter(s => s.user_id !== user.id).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        if (ownLocalSets.length > 0 || sharedSets.length > 0) {
            allSets = ownLocalSets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            renderFolderFilter(allSets);
            renderSets();
        } else {
            dashboardContent.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Sets laden...</div>';
        }

        const sets = await syncSets(supabase, user.id);

        allSets = (sets || []).filter(s => s.user_id === user.id);
        // Refresh shared sets from IndexedDB (syncSets may have cleaned up stale ones)
        const allLocal = await getLocalSets();
        sharedSets = allLocal.filter(s => s.user_id !== user.id).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        if (allSets.length === 0 && sharedSets.length === 0) {
            if (folderFilterContainer) folderFilterContainer.innerHTML = '';
            dashboardContent.innerHTML = `
                <div class="no-sets-box">
                    <span class="material-symbols-rounded no-sets-icon">menu_book</span>
                    <h3>Nog geen sets</h3>
                    <p>Maak je eerste set aan om te beginnen met leren!</p>
                    <button id="btn-create-first-set" class="btn-gradient" style="border-radius:12px; font-size:1.05em; padding:12px 24px; gap:8px; display:inline-flex; align-items:center;">
                        <span class="material-symbols-rounded">add</span>
                        Nieuwe set maken
                    </button>
                </div>
            `;
            const createFirstBtn = document.getElementById('btn-create-first-set');
            if (createFirstBtn && setModalComp) {
                createFirstBtn.addEventListener('click', () => setModalComp.open('create'));
            }
            return;
        }

        renderFolderFilter(allSets);
        renderSets();
    }

    if (createSetBtn && setModalComp) {
        createSetBtn.addEventListener('click', () => {
            setModalComp.open('create');
        });
    }

    if (setModalComp) {
        setModalComp.addEventListener('save', async (e) => {
            const { mode: saveMode, data: setData } = e.detail;
            const dbPayload = {
                user_id: user.id,
                title: setData.title,
                description: setData.description,
                folder: setData.folder,
                type: setData.mode,
                lang_col1: setData.lang1,
                lang_col2: setData.lang2,
                visibility: setData.visibility || 'private',
                cards: setData.rows,
                updated_at: new Date().toISOString()
            };

            if (saveMode === 'create') {
                dbPayload.created_at = new Date().toISOString();
                try {
                    await syncSetToRemote(supabase, dbPayload);
                    loadSets();
                } catch (insertError) {
                    if (window.Toast) window.Toast.show('Fout bij aanmaken: ' + insertError.message, 'error');
                }
            } else if (saveMode === 'edit') {
                try {
                    await syncSetToRemote(supabase, dbPayload, setData.id);
                    loadSets();
                } catch (updateError) {
                    if (window.Toast) window.Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
                }
            }
        });
    }

    // Initial load
    loadSets();
});

