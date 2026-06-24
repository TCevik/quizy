import { syncSets, syncSetToRemote, deleteLocalSet, getLocalSet, getLocalSets, saveLocalSet } from './storage.js';
import { supabaseReady } from './supabase-init.js';
import Toast from './toast.js';
import { escapeHtml } from './main.js';


const init = async () => {
    const supabase = await supabaseReady;

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

    let maxSets = 0;

    async function fetchMaxSets() {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('max_sets')
                .eq('id', user.id)
                .single();
            if (!error && data) {
                maxSets = data.max_sets;
            }
        } catch (err) {
            console.error('Fout bij ophalen max_sets:', err);
        }
    }

    function updateSetsUsageDisplay() {
        const usageValEl = document.getElementById('sets-usage-value');
        if (usageValEl) {
            usageValEl.textContent = `${allSets.length} / ${maxSets || '∞'}`;
        }
    }

    function checkMaxSetsLimit() {
        if (maxSets > 0 && allSets.length >= maxSets) {
            Toast.show(`Je hebt de limiet van ${maxSets} sets bereikt.`, 'error');
            return false;
        }
        return true;
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
            if (setIdToDelete === 'bulk') {
                try {
                    Toast.show('Geselecteerde sets verwijderen...', 'info');
                    for (const id of selectedSetIds) {
                        await deleteLocalSet(id);
                    }
                    Toast.show('Geselecteerde sets succesvol verwijderd!', 'success');
                    isSelectionMode = false;
                    selectedSetIds.clear();
                    loadSets();
                } catch (err) {
                    Toast.show('Fout bij verwijderen van sets: ' + err.message, 'error');
                }
            } else if (setIdToDelete !== null) {
                const setToDelete = await getLocalSet(setIdToDelete);
                const isOwner = setToDelete ? setToDelete.user_id === user.id : true;

                if (isOwner) {
                    const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setIdToDelete);
                    if (deleteError) {
                        Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
                        return;
                    }
                }

                await deleteLocalSet(setIdToDelete);
                Toast.show('Set succesvol verwijderd!', 'success');
                loadSets();
            }
        });
    }

    // Rename Folder Modal Elements
    const renameModal = document.getElementById('rename-folder-modal');

    if (renameModal) {
        renameModal.addEventListener('confirm', async (e) => {
            const { oldName, newName } = e.detail;
            if (oldName && newName && oldName.trim() !== '' && newName.trim() !== '') {
                if (newName.length > 30) {
                    e.preventDefault();
                    const over = newName.length - 30;
                    Toast.show(`Mapnaam is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 30).`, 'error');
                    return;
                }
                try {
                    Toast.show('Mapnaam bijwerken...', 'info');

                    // 1. Bulk update on remote database (Supabase)
                    const { error: updateError } = await supabase
                        .from('Sets')
                        .update({ folder: newName, updated_at: new Date().toISOString() })
                        .eq('user_id', user.id)
                        .eq('folder', oldName);

                    if (updateError) {
                        Toast.show('Fout bij remote bijwerken: ' + updateError.message, 'error');
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

                    Toast.show('Mapnaam succesvol aangepast!', 'success');
                    loadSets();
                } catch (err) {
                    Toast.show('Fout bij hernoemen map: ' + err.message, 'error');
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

    let isSelectionMode = false;
    const selectedSetIds = new Set();
    const btnSelectShared = document.getElementById('btn-select-shared');
    const btnDeleteSelected = document.getElementById('btn-delete-selected');

    if (btnSelectShared) {
        btnSelectShared.addEventListener('click', () => {
            isSelectionMode = !isSelectionMode;
            selectedSetIds.clear();
            updateDeleteBtnState();
            renderSets();
        });
    }

    if (btnDeleteSelected) {
        btnDeleteSelected.addEventListener('click', () => {
            if (selectedSetIds.size > 0 && deleteModal) {
                deleteModal.open('bulk');
            }
        });
    }

    function updateDeleteBtnState() {
        if (!btnDeleteSelected) return;
        btnDeleteSelected.disabled = selectedSetIds.size === 0;
        if (selectedSetIds.size > 0) {
            btnDeleteSelected.style.opacity = '1';
            btnDeleteSelected.style.pointerEvents = 'auto';
        } else {
            btnDeleteSelected.style.opacity = '0.5';
            btnDeleteSelected.style.pointerEvents = 'none';
        }
    }

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
                            .select('id, title, description, folder, type, card_count, visibility, updated_at, created_at, user_id, lang_col1, lang_col2')
                            .eq('visibility', 'public')
                            .ilike('title', `%${searchQuery}%`)
                            .order('updated_at', { ascending: false })
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
                        <span>Publieke sets</span>
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
                isSelectionMode = false;
                selectedSetIds.clear();
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

        if (currentFolderFilter === 'shared' && filteredSets.length > 0) {
            if (btnSelectShared) {
                btnSelectShared.style.display = 'flex';
                btnSelectShared.title = isSelectionMode ? 'Selecteren annuleren' : 'Sets selecteren';
                btnSelectShared.innerHTML = isSelectionMode ? '<span class="material-symbols-rounded">close</span>' : '<span class="material-symbols-rounded">select_all</span>';
                if (isSelectionMode) {
                    btnSelectShared.style.background = 'rgba(255, 255, 255, 0.15)';
                } else {
                    btnSelectShared.style.background = '';
                }
            }
            if (btnDeleteSelected) {
                btnDeleteSelected.style.display = isSelectionMode ? 'flex' : 'none';
                updateDeleteBtnState();
            }
        } else {
            if (btnSelectShared) btnSelectShared.style.display = 'none';
            if (btnDeleteSelected) btnDeleteSelected.style.display = 'none';
            isSelectionMode = false;
            selectedSetIds.clear();
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
            const isSelected = selectedSetIds.has(set.id);
            const selectCheckboxHTML = isSelectionMode
                ? `<div class="set-checkbox-wrapper">
                       <span class="material-symbols-rounded select-checkbox-icon" style="color: ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}; font-size: 24px;">
                           ${isSelected ? 'check_box' : 'check_box_outline_blank'}
                       </span>
                   </div>`
                : `<span class="set-badge">${escapeHtml(set.type) || 'woorden'}</span>`;

            html += `
                <div class="set-card glass-panel ${isSelectionMode ? 'in-selection-mode' : ''} ${isSelected ? 'selected' : ''}" data-id="${set.id}">
                    <div>
                        <div class="set-card-header">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <h3 class="set-title">${escapeHtml(set.title) || 'Naamloze set'}</h3>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    ${folderLabel}
                                    ${authorLabel}
                                </div>
                            </div>
                            ${selectCheckboxHTML}
                        </div>
                        <p class="set-desc">${escapeHtml(set.description) || 'Geen beschrijving'}</p>
                    </div>
                    <div class="set-card-footer">
                        <div class="set-meta">
                            <span><span class="material-symbols-rounded" style="font-size:16px;">calendar_today</span> Gewijzigd: ${lastUpdated}</span>
                            <span><span class="material-symbols-rounded" style="font-size:16px;">style</span> ${cardCountLabel}</span>
                        </div>
                        <div class="set-actions">
                            ${!isSelectionMode && set.user_id === user.id ? `
                            <button class="btn-icon-action edit-btn" title="Bewerken" data-id="${set.id}">
                                <span class="material-symbols-rounded">edit</span>
                            </button>` : ''}
                            ${!isSelectionMode && isLocal ? `
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

        // Attach event delegation to dashboardContent
        if (dashboardContent && !dashboardContent.dataset.listenerAttached) {
            dashboardContent.dataset.listenerAttached = 'true';
            dashboardContent.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.edit-btn');
                const deleteBtn = e.target.closest('.delete-btn');
                const setCard = e.target.closest('.set-card');

                if (editBtn) {
                    e.stopPropagation();
                    const setId = parseInt(editBtn.getAttribute('data-id'));
                    const setToEdit = allSets.find(s => s.id === setId);
                    if (setToEdit && setModalComp) {
                        Toast.show('Set laden...', 'info');

                        let fullSet = await getLocalSet(setId);
                        if (!fullSet || !fullSet.cards) {
                            const { data: remoteSet, error: detailError } = await supabase
                                .from('Sets')
                                .select('lang_col1, lang_col2, settings, cards')
                                .eq('id', setId)
                                .single();

                            if (detailError) {
                                Toast.show('Fout bij laden van set: ' + detailError.message, 'error');
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
                } else if (deleteBtn) {
                    e.stopPropagation();
                    const setId = parseInt(deleteBtn.getAttribute('data-id'));
                    if (deleteModal) {
                        deleteModal.open(setId);
                    }
                } else if (setCard) {
                    if (e.target.closest('.btn-icon-action')) {
                        return;
                    }
                    const setId = parseInt(setCard.getAttribute('data-id'));
                    if (isSelectionMode) {
                        e.stopPropagation();
                        if (selectedSetIds.has(setId)) {
                            selectedSetIds.delete(setId);
                        } else {
                            selectedSetIds.add(setId);
                        }
                        updateDeleteBtnState();
                        renderSets();
                    } else {
                        window.location.href = `set.html?id=${setId}`;
                    }
                }
            });
        }
    }

    // Function to load and display sets
    async function loadSets({ force = false } = {}) {
        if (!dashboardContent) return;

        const localSets = await getLocalSets();
        const ownLocalSets = localSets.filter(s => s.user_id === user.id);
        sharedSets = localSets.filter(s => s.user_id !== user.id).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        if (ownLocalSets.length > 0 || sharedSets.length > 0) {
            allSets = ownLocalSets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            renderFolderFilter(allSets);
            renderSets();
            updateSetsUsageDisplay();
        } else {
            dashboardContent.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Sets laden...</div>';
        }

        const now = Date.now();
        const lastSync = parseInt(localStorage.getItem('quizy_last_sync_timestamp') || '0', 10);
        const shouldSync = force || (now - lastSync > 5 * 60 * 1000) || (ownLocalSets.length === 0 && sharedSets.length === 0);

        let sets = localSets;
        if (shouldSync) {
            sets = await syncSets(supabase, user.id);
            localStorage.setItem('quizy_last_sync_timestamp', now.toString());
        }

        allSets = (sets || []).filter(s => s.user_id === user.id).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        // syncSets returns all local sets (incl. shared), no need to re-read IDB
        sharedSets = (sets || []).filter(s => s.user_id !== user.id).sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

        if (allSets.length === 0 && sharedSets.length === 0) {
            updateSetsUsageDisplay();
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
                createFirstBtn.addEventListener('click', () => {
                    if (checkMaxSetsLimit()) {
                        setModalComp.open('create');
                    }
                });
            }
            return;
        }

        renderFolderFilter(allSets);
        renderSets();
        updateSetsUsageDisplay();
    }

    if (createSetBtn && setModalComp) {
        createSetBtn.addEventListener('click', () => {
            if (checkMaxSetsLimit()) {
                setModalComp.open('create');
            }
        });
    }

    const syncSetsBtn = document.getElementById('btn-sync-sets');
    if (syncSetsBtn) {
        syncSetsBtn.addEventListener('click', async () => {
            if (syncSetsBtn.classList.contains('spinning') || syncSetsBtn.disabled) return;
            syncSetsBtn.classList.add('spinning');
            syncSetsBtn.disabled = true;
            const startTime = Date.now();
            try {
                await loadSets({ force: true });
                const elapsed = Date.now() - startTime;
                const minDuration = 1500;
                if (elapsed < minDuration) {
                    await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
                }
                Toast.show('Synchronisatie voltooid!', 'success');
            } catch (err) {
                console.error(err);
                Toast.show('Synchronisatie mislukt: ' + err.message, 'error');
            } finally {
                syncSetsBtn.classList.remove('spinning');
                syncSetsBtn.disabled = false;
            }
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
                    Toast.show('Fout bij aanmaken: ' + insertError.message, 'error');
                }
            } else if (saveMode === 'edit') {
                try {
                    await syncSetToRemote(supabase, dbPayload, setData.id);
                    loadSets();
                } catch (updateError) {
                    Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
                }
            }
        });
    }

    // Initial load
    fetchMaxSets().then(() => {
        loadSets();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

