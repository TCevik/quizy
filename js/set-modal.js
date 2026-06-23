class QuizySetModal extends HTMLElement {
    constructor() {
        super();
        this.languages = [
            { code: 'nl', name: 'Nederlands' },
            { code: 'en', name: 'Engels' },
            { code: 'fr', name: 'Frans' },
            { code: 'de', name: 'Duits' },
            { code: 'es', name: 'Spaans' }
        ];
        this.currentMode = 'create'; // 'create' or 'edit'
        this.currentSetId = null;
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.innerHTML = `
            <div id="create-set-modal" class="modal-overlay">
                <div class="modal-card glass-panel modal-card-wide">
                    <div class="modal-header">
                        <h3 id="modal-title-text">Nieuwe set maken</h3>
                        <button id="modal-close" class="modal-close-btn">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <form id="create-set-form" class="modal-form" autocomplete="off">
                        <div class="modal-body split-layout">
                            <!-- Sidebar: Settings -->
                            <div class="split-sidebar">
                                <h4 class="section-title">Instellingen</h4>
                                
                                <div class="form-group">
                                    <label for="set-title">Titel</label>
                                    <input type="text" id="set-title" placeholder="Bijv. Franse onregelmatige werkwoorden" autocomplete="off">
                                </div>
                                <div class="form-group">
                                    <label for="set-desc">Beschrijving <span class="label-optional">(optioneel)</span></label>
                                    <textarea id="set-desc" placeholder="Bijv. Hoofdstuk 3 - Woordenschat en grammatica" autocomplete="off"></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="set-folder">Map</label>
                                    <select id="set-folder">
                                        <option value="">Geen map</option>
                                        <option value="__new__">+ Nieuwe map maken...</option>
                                    </select>
                                    <input type="text" id="new-folder-input" class="hidden-input" placeholder="Naam van nieuwe map" autocomplete="off">
                                </div>

                                <div class="form-group">
                                    <label for="set-visibility">Zichtbaarheid</label>
                                    <select id="set-visibility">
                                        <option value="public">Openbaar (iedereen met de link)</option>
                                        <option value="private">Privé (alleen voor jou)</option>
                                    </select>
                                </div>

                                <div class="form-group" style="margin-top: 8px;">
                                    <label>Type set</label>
                                    <div class="segmented-control">
                                        <button type="button" class="segment-btn active" data-mode="woorden">Woorden (1 taal)</button>
                                        <button type="button" class="segment-btn" data-mode="talen">Talen (vertalingen)</button>
                                    </div>
                                </div>

                                <div id="language-selection-container" class="form-group" style="margin-bottom: 24px;">
                                    <!-- Dynamic languages selects go here -->
                                </div>
                            </div>

                            <!-- Main: Cards -->
                            <div class="split-main">
                                <div class="main-header-row">
                                    <h4 class="section-title main-title">Lijst met kaarten</h4>
                                    <button type="button" id="btn-import-terms" class="btn-secondary btn-small">
                                        <span class="material-symbols-rounded">download</span>
                                        Importeren
                                    </button>
                                </div>

                                <!-- Import Container -->
                                <div id="import-container" class="form-group hidden-input" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                                    <label for="import-text" style="display: flex; justify-content: space-between; align-items: center;">
                                        <span>Lijst importeren (formaat: term [tab] definitie per regel)</span>
                                        <button type="button" id="btn-close-import" class="modal-close-btn" style="padding: 2px;">
                                            <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
                                        </button>
                                    </label>
                                    <textarea id="import-text" placeholder="Bijv.:&#10;apple&#9;appel&#10;peer&#9;peer" style="min-height: 120px; font-family: monospace; font-size: 0.9em;" autocomplete="off"></textarea>
                                    <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                                        <button type="button" id="btn-do-import" class="btn-gradient" style="padding: 8px 16px; font-size: 0.9em;">Voeg toe aan lijst</button>
                                    </div>
                                </div>

                                <!-- Terms/Definitions Input Table -->
                                <div class="terms-section">
                                    <div class="terms-header-row">
                                        <span id="col1-header" class="col-header">Term</span>
                                        <span id="col2-header" class="col-header">Definitie</span>
                                        <span class="col-header-action"></span>
                                    </div>
                                    <div id="terms-rows-container" class="terms-rows-container">
                                        <!-- Dynamic rows go here -->
                                    </div>
                                    <button type="button" id="btn-add-row" class="btn-secondary" style="margin-top: 16px; align-self: center;">
                                        <span class="material-symbols-rounded">add</span>
                                        Rij toevoegen
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Buttons -->
                        <div class="modal-footer">
                            <button type="button" id="modal-cancel" class="btn-text">Annuleren</button>
                            <button type="submit" id="btn-submit-set" class="btn-gradient">Set opslaan</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Cache elements
        this.modal = this.querySelector('#create-set-modal');
        this.modalTitleText = this.querySelector('#modal-title-text');
        this.modalClose = this.querySelector('#modal-close');
        this.modalCancel = this.querySelector('#modal-cancel');
        this.folderSelect = this.querySelector('#set-folder');
        this.newFolderInput = this.querySelector('#new-folder-input');
        this.segmentBtns = this.querySelectorAll('.segment-btn');
        this.langContainer = this.querySelector('#language-selection-container');
        this.termsContainer = this.querySelector('#terms-rows-container');
        this.modalBody = this.querySelector('.modal-body');
        this.splitMain = this.querySelector('.split-main');
        this.splitSidebar = this.querySelector('.split-sidebar');
        this.addRowBtn = this.querySelector('#btn-add-row');
        this.form = this.querySelector('#create-set-form');
        this.col1Header = this.querySelector('#col1-header');
        this.col2Header = this.querySelector('#col2-header');
        this.submitBtn = this.querySelector('#btn-submit-set');
        this.visibilitySelect = this.querySelector('#set-visibility');
    }

    setupEventListeners() {
        // Close modal handlers
        const closeModal = () => this.close();
        if (this.modalClose) this.modalClose.addEventListener('click', closeModal);
        if (this.modalCancel) this.modalCancel.addEventListener('click', closeModal);
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) closeModal();
        });

        // Folder logic
        if (this.folderSelect) {
            this.folderSelect.addEventListener('change', () => {
                if (this.folderSelect.value === '__new__') {
                    this.newFolderInput.classList.add('active');
                    this.newFolderInput.focus();
                } else {
                    this.newFolderInput.classList.remove('active');
                    this.newFolderInput.value = '';
                }
            });
        }

        // Mode switches
        this.segmentBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.segmentBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderLanguageSelection(btn.getAttribute('data-mode'));
            });
        });

        // Add row
        if (this.addRowBtn) {
            this.addRowBtn.addEventListener('click', () => this.addTermRow());
        }

        // Form submit
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        // Import handlers
        this.addEventListener('click', (e) => {
            const importBtn = e.target.closest('#btn-import-terms');
            if (importBtn) {
                e.preventDefault();
                const importContainer = this.querySelector('#import-container');
                if (importContainer) {
                    importContainer.classList.toggle('active');
                    if (importContainer.classList.contains('active')) {
                        this.querySelector('#import-text').focus();
                    }
                }
            }

            const closeImportBtn = e.target.closest('#btn-close-import');
            if (closeImportBtn) {
                e.preventDefault();
                const importContainer = this.querySelector('#import-container');
                if (importContainer) {
                    importContainer.classList.remove('active');
                }
            }

            const doImportBtn = e.target.closest('#btn-do-import');
            if (doImportBtn) {
                e.preventDefault();
                this.handleImport();
            }
        });

        const importTextarea = this.querySelector('#import-text');
        if (importTextarea) {
            importTextarea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = importTextarea.selectionStart;
                    const end = importTextarea.selectionEnd;
                    importTextarea.value = importTextarea.value.substring(0, start) + '\t' + importTextarea.value.substring(end);
                    importTextarea.selectionStart = importTextarea.selectionEnd = start + 1;
                }
            });
        }
    }

    open(mode = 'create', setData = null) {
        this.currentMode = mode;
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.resetForm();

        if (mode === 'edit' && setData) {
            this.modalTitleText.textContent = 'Set bewerken';
            this.submitBtn.textContent = 'Wijzigingen opslaan';
            this.currentSetId = setData.id;
            this.fillFormData(setData);
        } else {
            this.modalTitleText.textContent = 'Nieuwe set maken';
            this.submitBtn.textContent = 'Set aanmaken';
            this.currentSetId = null;
        }
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    resetForm() {
        this.form.reset();
        this.newFolderInput.classList.remove('active');

        this.segmentBtns.forEach(b => b.classList.remove('active'));
        if (this.segmentBtns[0]) this.segmentBtns[0].classList.add('active');

        if (this.visibilitySelect) this.visibilitySelect.value = 'public';

        this.renderLanguageSelection('woorden');

        this.termsContainer.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            this.addTermRow('', '', false);
        }
        if (this.splitMain) this.splitMain.scrollTop = 0;
        if (this.splitSidebar) this.splitSidebar.scrollTop = 0;
    }

    fillFormData(data) {
        if (this.querySelector('#set-title')) this.querySelector('#set-title').value = data.title || '';
        if (this.querySelector('#set-desc')) this.querySelector('#set-desc').value = data.description || '';
        if (this.visibilitySelect && data.visibility) this.visibilitySelect.value = data.visibility;

        if (data.folder) {
            const hasOption = Array.from(this.folderSelect.options).some(opt => opt.value === data.folder);
            if (hasOption) {
                this.folderSelect.value = data.folder;
            } else {
                this.folderSelect.value = '__new__';
                this.newFolderInput.classList.add('active');
                this.newFolderInput.value = data.folder;
            }
        }


        const mode = data.mode || 'woorden';
        this.segmentBtns.forEach(b => {
            if (b.getAttribute('data-mode') === mode) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        this.renderLanguageSelection(mode);

        const lang1Select = this.querySelector('#set-language-1');
        const lang2Select = this.querySelector('#set-language-2');
        if (lang1Select && data.lang1) lang1Select.value = data.lang1;
        if (lang2Select && data.lang2) lang2Select.value = data.lang2;

        this.termsContainer.innerHTML = '';
        if (data.rows && data.rows.length > 0) {
            data.rows.slice(0, 200).forEach(r => this.addTermRow(r.term, r.definition, false, false));
        } else {
            for (let i = 0; i < 5; i++) {
                this.addTermRow('', '', false, false);
            }
        }
        this.updatePlaceholdersAndHeaders();
        if (this.splitMain) this.splitMain.scrollTop = 0;
        if (this.splitSidebar) this.splitSidebar.scrollTop = 0;
    }

    addTermRow(term = '', definition = '', shouldScroll = true, showToastOnLimit = true) {
        const allRows = this.termsContainer.querySelectorAll('.term-row:not(.removing)');
        if (allRows.length >= 200) {
            if (showToastOnLimit && window.Toast) {
                window.Toast.show('Een set mag maximaal 200 kaarten bevatten.', 'error');
            }
            return;
        }

        const row = document.createElement('div');
        row.className = 'term-row';
        row.innerHTML = `
            <input type="text" class="term-input" value="${term}" autocomplete="off">
            <input type="text" class="def-input" value="${definition}" autocomplete="off">
            <button type="button" class="btn-delete-row" title="Verwijder rij">
                <span class="material-symbols-rounded">delete</span>
            </button>
        `;

        const deleteBtn = row.querySelector('.btn-delete-row');
        deleteBtn.addEventListener('click', () => {
            const allRows = this.termsContainer.querySelectorAll('.term-row:not(.removing)');
            if (allRows.length > 4) {
                row.classList.add('removing');
                row.addEventListener('animationend', () => {
                    row.remove();
                    this.updateDeleteButtonsState();
                }, { once: true });
                this.updateDeleteButtonsState();
            }
        });
 
        this.termsContainer.appendChild(row);
        this.updateDeleteButtonsState();
        this.updatePlaceholdersAndHeaders();
 
        // Keep the add button at the exact same screen position so spam-clicking doesn't move it
        if (shouldScroll && this.splitMain && this.addRowBtn) {
            if (this.scrollAnimFrame) {
                cancelAnimationFrame(this.scrollAnimFrame);
            }
 
            // Record the target Y position we want the button to stay at
            const targetY = this.addRowBtn.getBoundingClientRect().top;
            const start = Date.now();
 
            const animateScroll = () => {
                const currentY = this.addRowBtn.getBoundingClientRect().top;
                const deltaY = currentY - targetY;
 
                // If button moved down (deltaY > 0), scroll down by exactly that amount
                if (Math.abs(deltaY) > 0) {
                    this.splitMain.scrollTop += deltaY;
                }
 
                if (Date.now() - start < 350) {
                    this.scrollAnimFrame = requestAnimationFrame(animateScroll);
                } else {
                    this.scrollAnimFrame = null;
                }
            };
            this.scrollAnimFrame = requestAnimationFrame(animateScroll);
        }
    }
 
    updateDeleteButtonsState() {
        const allRows = this.termsContainer.querySelectorAll('.term-row:not(.removing)');
        allRows.forEach(row => {
            const deleteBtn = row.querySelector('.btn-delete-row');
            if (allRows.length <= 4) {
                deleteBtn.style.opacity = '0.4';
                deleteBtn.style.pointerEvents = 'none';
            } else {
                deleteBtn.style.opacity = '1';
                deleteBtn.style.pointerEvents = 'all';
            }
        });
    }

    renderLanguageSelection(mode) {
        if (mode === 'woorden') {
            this.langContainer.innerHTML = `
                <div class="form-group">
                    <label for="set-language-1">Taal</label>
                    <select id="set-language-1">
                        ${this.languages.map(l => `<option value="${l.name}">${l.name}</option>`).join('')}
                    </select>
                </div>
            `;
        } else {
            this.langContainer.innerHTML = `
                <div class="form-row-2col" style="gap: 12px;">
                    <div class="form-group">
                        <label for="set-language-1">Taal kolom 1</label>
                        <select id="set-language-1">
                            ${this.languages.map((l, idx) => `<option value="${l.name}" ${idx === 1 ? 'selected' : ''}>${l.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="set-language-2">Taal kolom 2</label>
                        <select id="set-language-2">
                            ${this.languages.map((l, idx) => `<option value="${l.name}" ${idx === 0 ? 'selected' : ''}>${l.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        }

        const langSelect1 = this.querySelector('#set-language-1');
        const langSelect2 = this.querySelector('#set-language-2');

        if (langSelect1) langSelect1.addEventListener('change', () => this.updatePlaceholdersAndHeaders());
        if (langSelect2) langSelect2.addEventListener('change', () => this.updatePlaceholdersAndHeaders());

        this.updatePlaceholdersAndHeaders();
    }

    updatePlaceholdersAndHeaders() {
        const activeSegment = this.querySelector('.segment-btn.active');
        const mode = activeSegment ? activeSegment.getAttribute('data-mode') : 'woorden';

        const lang1Select = this.querySelector('#set-language-1');
        const lang2Select = this.querySelector('#set-language-2');

        const lang1 = lang1Select ? lang1Select.value : 'Term';
        const lang2 = lang2Select ? lang2Select.value : 'Definitie';

        const rows = this.termsContainer.querySelectorAll('.term-row');

        if (mode === 'woorden') {
            this.col1Header.textContent = 'Term';
            this.col2Header.textContent = 'Definitie';

            rows.forEach(row => {
                row.querySelector('.term-input').placeholder = 'Term';
                row.querySelector('.def-input').placeholder = 'Definitie';
            });
        } else {
            this.col1Header.textContent = lang1;
            this.col2Header.textContent = lang2;

            rows.forEach(row => {
                row.querySelector('.term-input').placeholder = `Woord in het ${lang1}`;
                row.querySelector('.def-input').placeholder = `Vertaling in het ${lang2}`;
            });
        }
    }

    handleSubmit() {
        const titleInput = this.querySelector('#set-title');
        const title = titleInput.value.trim();

        if (!title) {
            if (window.Toast) window.Toast.show('Titel is verplicht.', 'error');
            return;
        }

        if (title.length < 4) {
            if (window.Toast) window.Toast.show('Titel moet minimaal 4 tekens lang zijn.', 'error');
            return;
        }

        if (title.length > 100) {
            const over = title.length - 100;
            if (window.Toast) window.Toast.show(`Titel is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 100).`, 'error');
            return;
        }

        const description = this.querySelector('#set-desc').value.trim();
        if (description.length > 300) {
            const over = description.length - 300;
            if (window.Toast) window.Toast.show(`Beschrijving is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 300).`, 'error');
            return;
        }

        let folder = this.folderSelect.value;
        if (folder === '__new__') {
            folder = this.newFolderInput.value.trim();
            if (!folder) {
                if (window.Toast) window.Toast.show('Vul een naam in voor de nieuwe map.', 'error');
                return;
            }
            if (folder.length > 30) {
                const over = folder.length - 30;
                if (window.Toast) window.Toast.show(`Mapnaam is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 30).`, 'error');
                return;
            }
        }

        const activeSegment = this.querySelector('.segment-btn.active');
        const mode = activeSegment ? activeSegment.getAttribute('data-mode') : 'woorden';

        const lang1Select = this.querySelector('#set-language-1');
        const lang2Select = this.querySelector('#set-language-2');
        const lang1 = lang1Select ? lang1Select.value.trim() : '';
        const lang2 = lang2Select ? lang2Select.value.trim() : '';

        if (!lang1) {
            if (window.Toast) window.Toast.show('Kies een geldige taal.', 'error');
            return;
        }

        const rows = [];
        let hasIncompleteRow = false;
        let maxTermOver = 0;
        let maxDefOver = 0;
        this.termsContainer.querySelectorAll('.term-row').forEach(row => {
            const term = row.querySelector('.term-input').value.trim();
            const definition = row.querySelector('.def-input').value.trim();
            if (term.length > 300) {
                maxTermOver = Math.max(maxTermOver, term.length - 300);
            }
            if (definition.length > 300) {
                maxDefOver = Math.max(maxDefOver, definition.length - 300);
            }
            if (term && definition) {
                rows.push({ term, definition });
            } else if (term || definition) {
                hasIncompleteRow = true;
            }
        });

        if (maxTermOver > 0 || maxDefOver > 0) {
            const maxOver = Math.max(maxTermOver, maxDefOver);
            if (window.Toast) window.Toast.show(`Een term of definitie is te lang (${maxOver} ${maxOver === 1 ? 'teken' : 'tekens'} over de limiet van 300).`, 'error');
            return;
        }

        if (hasIncompleteRow) {
            if (window.Toast) window.Toast.show('Vul voor elke kaart zowel de term als de definitie in.', 'error');
            return;
        }

        const uniqueTerms = new Set(rows.map(r => r.term.trim().toLowerCase()));
        if (uniqueTerms.size < 4) {
            if (window.Toast) window.Toast.show('Een set moet minimaal 4 verschillende termen bevatten.', 'error');
            return;
        }

        const uniqueDefs = new Set(rows.map(r => r.definition.trim().toLowerCase()));
        if (uniqueDefs.size < 4) {
            if (window.Toast) window.Toast.show('Een set moet minimaal 4 verschillende definities bevatten.', 'error');
            return;
        }

        if (rows.length > 200) {
            if (window.Toast) window.Toast.show('Een set mag maximaal 200 kaarten bevatten.', 'error');
            return;
        }

        const payload = {
            id: this.currentSetId,
            title,
            description: description || null,
            folder: folder || null,
            mode,
            lang1,
            lang2: lang2 || null,
            visibility: this.visibilitySelect ? this.visibilitySelect.value : 'private',
            rows
        };

        this.dispatchEvent(new CustomEvent('save', {
            detail: {
                mode: this.currentMode,
                data: payload
            }
        }));

        if (window.Toast) {
            window.Toast.show(
                this.currentMode === 'edit'
                    ? 'Wijzigingen succesvol opgeslagen!'
                    : 'Set succesvol aangemaakt!',
                'success'
            );
        }

        this.close();
    }
    
    updateFolderOptions(folders) {
        if (!this.folderSelect) return;
        const currentVal = this.folderSelect.value;
        let html = '<option value="">Geen map</option>';
        folders.forEach(folder => {
            if (folder && folder.trim() !== '') {
                html += `<option value="${folder}">${folder}</option>`;
            }
        });
        html += '<option value="__new__">+ Nieuwe map maken...</option>';
        this.folderSelect.innerHTML = html;
        if (currentVal) {
            this.folderSelect.value = currentVal;
        }
    }

    splitImportCard(str) {
        str = str.trim();
        if (str.includes('\t')) {
            const parts = str.split('\t');
            return {
                term: parts[0].trim().substring(0, 300),
                definition: parts.slice(1).join('\t').substring(0, 300)
            };
        }
        return {
            term: str.substring(0, 300),
            definition: ''
        };
    }

    handleImport() {
        const importTextarea = this.querySelector('#import-text');
        if (!importTextarea) return;

        const text = importTextarea.value;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const parsedRows = [];

        lines.forEach(line => {
            const { term, definition } = this.splitImportCard(line);
            if (term || definition) {
                parsedRows.push({ term, definition });
            }
        });

        if (parsedRows.length === 0) {
            if (window.Toast) {
                window.Toast.show('Geen geldige woorden gevonden om te importeren.', 'error');
            }
            return;
        }

        // Check if existing rows are all empty
        const existingRows = this.termsContainer.querySelectorAll('.term-row');
        let allEmpty = true;
        existingRows.forEach(row => {
            const t = row.querySelector('.term-input').value.trim();
            const d = row.querySelector('.def-input').value.trim();
            if (t || d) {
                allEmpty = false;
            }
        });

        if (allEmpty) {
            this.termsContainer.innerHTML = '';
        }

        const currentCount = allEmpty ? 0 : existingRows.length;
        if (currentCount + parsedRows.length > 200) {
            const allowedCount = 200 - currentCount;
            if (allowedCount <= 0) {
                if (window.Toast) {
                    window.Toast.show('De set heeft al het maximum van 200 kaarten bereikt.', 'error');
                }
                return;
            }
            parsedRows.splice(allowedCount);
            if (window.Toast) {
                window.Toast.show(`Slechts ${allowedCount} woorden konden worden geïmporteerd (maximaal 200 kaarten).`, 'warning');
            }
        }

        parsedRows.forEach(row => {
            this.addTermRow(row.term, row.definition, false, false);
        });

        this.updateDeleteButtonsState();
        this.updatePlaceholdersAndHeaders();

        // Clear textarea and hide container
        importTextarea.value = '';
        const importContainer = this.querySelector('#import-container');
        if (importContainer) {
            importContainer.classList.remove('active');
        }

        if (window.Toast) {
            window.Toast.show(`${parsedRows.length} woorden succesvol geïmporteerd!`, 'success');
        }
    }
}

customElements.define('quizy-set-modal', QuizySetModal);
