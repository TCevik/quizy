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
    const btnDeleteCancel = document.getElementById('btn-delete-cancel');
    const btnDeleteConfirm = document.getElementById('btn-delete-confirm');
    let setIdToDelete = null;

    if (btnDeleteCancel && deleteModal) {
        btnDeleteCancel.addEventListener('click', () => {
            deleteModal.classList.remove('active');
            setIdToDelete = null;
        });
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                deleteModal.classList.remove('active');
                setIdToDelete = null;
            }
        });
    }

    if (btnDeleteConfirm && deleteModal) {
        btnDeleteConfirm.addEventListener('click', async () => {
            if (setIdToDelete !== null) {
                const { error: deleteError } = await supabase.from('Sets').delete().eq('id', setIdToDelete);
                if (deleteError) {
                    console.error('Error deleting set:', deleteError);
                    if (window.Toast) window.Toast.show('Fout bij verwijderen: ' + deleteError.message, 'error');
                } else {
                    if (window.Toast) window.Toast.show('Set succesvol verwijderd!', 'success');
                    loadSets();
                }
                deleteModal.classList.remove('active');
                setIdToDelete = null;
            }
        });
    }

    // Function to load and display sets
    async function loadSets() {
        if (!dashboardContent) return;

        dashboardContent.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Sets laden...</div>';

        const { data: sets, error: fetchError } = await supabase
            .from('Sets')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (fetchError) {
            console.error('Error fetching sets:', fetchError);
            dashboardContent.innerHTML = `<div class="no-sets-box"><h3>Fout bij laden</h3><p>${fetchError.message}</p></div>`;
            return;
        }

        if (!sets || sets.length === 0) {
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

        let html = '<div class="sets-grid">';
        sets.forEach(set => {
            const lastUpdated = set.updated_at ? new Date(set.updated_at).toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Onbekend';
            
            const cardCount = set.cards ? set.cards.length : 0;

            html += `
                <div class="set-card glass-panel" data-id="${set.id}">
                    <div>
                        <div class="set-card-header">
                            <h3 class="set-title">${set.title || 'Naamloze set'}</h3>
                            <span class="set-badge">${set.type || 'woorden'}</span>
                        </div>
                        <p class="set-desc">${set.description || 'Geen beschrijving'}</p>
                    </div>
                    <div class="set-card-footer">
                        <div class="set-meta">
                            <span><span class="material-symbols-rounded" style="font-size:16px;">calendar_today</span> Gewijzigd: ${lastUpdated}</span>
                            <span><span class="material-symbols-rounded" style="font-size:16px;">style</span> ${cardCount} kaarten</span>
                        </div>
                        <div class="set-actions">
                            <button class="btn-icon-action edit-btn" title="Bewerken" data-id="${set.id}">
                                <span class="material-symbols-rounded">edit</span>
                            </button>
                            <button class="btn-icon-action delete-btn" title="Verwijderen" data-id="${set.id}">
                                <span class="material-symbols-rounded">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        dashboardContent.innerHTML = html;

        // Attach event listeners to card actions
        dashboardContent.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setId = parseInt(btn.getAttribute('data-id'));
                const setToEdit = sets.find(s => s.id === setId);
                if (setToEdit && setModalComp) {
                    // map DB names back to setModalComp fields:
                    // table: id, created_at, user_id, updated_at, title, description, folder, is_visible, type, lang_col1, lang_col2, cards
                    // form needs: id, title, description, folder, isVisible, mode, lang1, lang2, rows
                    const mappedData = {
                        id: setToEdit.id,
                        title: setToEdit.title,
                        description: setToEdit.description,
                        folder: setToEdit.folder,
                        isVisible: setToEdit.is_visible,
                        mode: setToEdit.type,
                        lang1: setToEdit.lang_col1,
                        lang2: setToEdit.lang_col2,
                        rows: setToEdit.cards
                    };
                    setModalComp.open('edit', mappedData);
                }
            });
        });

        dashboardContent.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setIdToDelete = parseInt(btn.getAttribute('data-id'));
                if (deleteModal) {
                    deleteModal.classList.add('active');
                }
            });
        });
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
                is_visible: setData.isVisible,
                type: setData.mode,
                lang_col1: setData.lang1,
                lang_col2: setData.lang2,
                cards: setData.rows,
                updated_at: new Date().toISOString()
            };

            if (saveMode === 'create') {
                dbPayload.created_at = new Date().toISOString();
                const { error: insertError } = await supabase.from('Sets').insert([dbPayload]);
                if (insertError) {
                    console.error('Error creating set in Supabase:', insertError);
                    if (window.Toast) window.Toast.show('Fout bij aanmaken: ' + insertError.message, 'error');
                } else {
                    console.log('Set created in Supabase');
                    loadSets();
                }
            } else if (saveMode === 'edit') {
                const { error: updateError } = await supabase.from('Sets').update(dbPayload).eq('id', setData.id);
                if (updateError) {
                    console.error('Error updating set in Supabase:', updateError);
                    if (window.Toast) window.Toast.show('Fout bij bewerken: ' + updateError.message, 'error');
                } else {
                    console.log('Set updated in Supabase');
                    loadSets();
                }
            }
        });
    }

    // Initial load
    loadSets();
});
