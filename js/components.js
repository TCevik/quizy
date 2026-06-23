class QuizyHeader extends HTMLElement {
    async connectedCallback() {
        const isLogin = this.hasAttribute('login-page');
        const pathname = window.location.pathname;
        const isDashboard = pathname.includes('dashboard.html');
        const isProfile = pathname.includes('profile.html');

        // Check localStorage to guess login state and avoid navigation flashes
        const hasSession = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));

        // Render initial UI immediately (synchronously)
        let initialMenuHTML = '';
        if (isLogin) {
            initialMenuHTML = `<a class="btn-gradient" href="index.html">Terug</a>`;
        } else if (hasSession) {
            initialMenuHTML = `
                <a href="dashboard.html" class="${isDashboard ? 'active' : ''}">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">dashboard</span>
                    Dashboard
                </a>
                <a href="profile.html" class="${isProfile ? 'active' : ''}">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">account_circle</span>
                    Profiel
                </a>
                <a href="#" id="logoutBtn">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">logout</span>
                    Uitloggen
                </a>
            `;
        } else {
            initialMenuHTML = `<a class="btn-gradient" href="login.html">Inloggen op Quizy</a>`;
        }

        this.innerHTML = `
            <a href="index.html" class="logo">Quizy</a>
            <nav class="header-items" id="header-menu">
                ${initialMenuHTML}
            </nav>
        `;

        const setupLogout = () => {
            const logoutBtn = this.querySelector('#logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const supabase = await window.supabaseReady;
                    if (supabase) {
                        await supabase.auth.signOut();
                        window.location.href = 'index.html';
                    }
                });
            }
        };

        setupLogout();

        // Verify/fetch actual user state asynchronously
        const supabase = await window.supabaseReady;
        let user = null;
        if (supabase) {
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        }

        const menu = this.querySelector('#header-menu');
        if (!menu) return;

        // If the actual state differs from our guess, update it
        if (!isLogin) {
            if (user) {
                const currentHTML = menu.innerHTML;
                // Only replace if not already rendered to prevent flash
                if (!currentHTML.includes('logoutBtn')) {
                    menu.innerHTML = `
                        <a href="dashboard.html" class="${isDashboard ? 'active' : ''}">
                            <span class="material-symbols-rounded" style="margin-right: 8px;">dashboard</span>
                            Dashboard
                        </a>
                        <a href="profile.html" class="${isProfile ? 'active' : ''}">
                            <span class="material-symbols-rounded" style="margin-right: 8px;">account_circle</span>
                            Profiel
                        </a>
                        <a href="#" id="logoutBtn">
                            <span class="material-symbols-rounded" style="margin-right: 8px;">logout</span>
                            Uitloggen
                        </a>
                    `;
                    setupLogout();
                }
            } else {
                menu.innerHTML = `<a class="btn-gradient" href="login.html">Inloggen op Quizy</a>`;
            }
        }
    }
}

class QuizyFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div class="footer-container">
                <div class="footer-left">
                    <span class="footer-brand">Quizy</span>
                    <span class="footer-credit">Gemaakt door Tamer Çevik</span>
                </div>
                <div class="footer-right">
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSenU2OuAafpBvayn0mgszuJmPA7dDdeHLP5ou0xpljfj0yRcg/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer">Report Bug</a>
                    <a href="https://tctam.nl/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                    <a href="https://tctam.nl/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                </div>
            </div>
        `;
    }
}

customElements.define('quizy-header', QuizyHeader);
customElements.define('quizy-footer', QuizyFooter);

class QuizyDeleteModal extends HTMLElement {
    connectedCallback() {
        this.className = 'modal-overlay';
        this.innerHTML = `
            <div class="modal-card glass-panel" style="max-width: 420px;">
                <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                    <h3 style="font-size: 1.3em; font-weight: 600; color: var(--text-light);">Set verwijderen</h3>
                </div>
                <div class="modal-body" style="padding: 24px; gap: 8px;">
                    <p style="color: var(--text-muted); font-size: 1em; line-height: 1.5; margin: 0;">Weet je zeker dat je deze set wilt verwijderen?</p>
                    <p style="color: #ef4444; font-size: 0.9em; font-weight: 500; margin: 0;">Dit kan niet ongedaan worden gemaakt.</p>
                </div>
                <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; margin-top: 0;">
                    <button id="btn-delete-cancel" class="btn-text">Annuleren</button>
                    <button id="btn-delete-confirm" class="btn-gradient" style="background: #ef4444; padding: 10px 20px;">Verwijderen</button>
                </div>
            </div>
        `;

        this.addEventListener('click', (e) => {
            if (e.target === this || e.target.id === 'btn-delete-cancel') {
                this.close();
            }
        });

        this.querySelector('#btn-delete-confirm').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('confirm', { detail: { id: this._targetId } }));
            this.close();
        });
    }

    open(targetId = null) {
        this._targetId = targetId;
        this.classList.add('active');
    }

    close() {
        this._targetId = null;
        this.classList.remove('active');
    }
}
customElements.define('quizy-delete-modal', QuizyDeleteModal);

class QuizyWarningModal extends HTMLElement {
    connectedCallback() {
        this.className = 'modal-overlay';
        this.innerHTML = `
            <div class="modal-card glass-panel" style="max-width: 460px;">
                <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px; display: flex; align-items: center; gap: 12px;">
                    <span class="material-symbols-rounded" style="color: #f59e0b; font-size: 26px;">warning</span>
                    <h3 id="warning-modal-title" style="font-size: 1.2em; font-weight: 600; color: var(--text-light);"></h3>
                </div>
                <div class="modal-body" style="padding: 24px; gap: 8px; display: flex; flex-direction: column; gap: 12px;">
                    <p id="warning-modal-message" style="color: var(--text-muted); font-size: 0.97em; line-height: 1.6; margin: 0;"></p>
                    <p id="warning-modal-sub" style="color: #f59e0b; font-size: 0.88em; font-weight: 500; margin: 0; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 10px 14px;"></p>
                </div>
                <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; margin-top: 0;">
                    <button id="btn-warning-cancel" class="btn-text">Annuleren</button>
                    <button id="btn-warning-confirm" class="btn-gradient" style="background: #f59e0b; padding: 10px 20px;"></button>
                </div>
            </div>
        `;

        this.addEventListener('click', (e) => {
            if (e.target === this || e.target.id === 'btn-warning-cancel') {
                this.close();
            }
        });

        this.querySelector('#btn-warning-confirm').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('confirm'));
            this.close();
        });
    }

    open({ title, message, sub, confirmText = 'Doorgaan' } = {}) {
        if (title) this.querySelector('#warning-modal-title').textContent = title;
        if (message) this.querySelector('#warning-modal-message').textContent = message;
        if (sub) this.querySelector('#warning-modal-sub').textContent = sub;
        this.querySelector('#btn-warning-confirm').textContent = confirmText;
        this.classList.add('active');
    }

    close() {
        this.classList.remove('active');
    }
}
customElements.define('quizy-warning-modal', QuizyWarningModal);

class QuizyRenameModal extends HTMLElement {
    connectedCallback() {
        this.className = 'modal-overlay';
        this.innerHTML = `
            <div class="modal-card glass-panel" style="max-width: 420px;">
                <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                    <h3 style="font-size: 1.3em; font-weight: 600; color: var(--text-light);">Mapnaam aanpassen</h3>
                </div>
                <div class="modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 12px;">
                    <p style="color: var(--text-muted); font-size: 0.95em; line-height: 1.5; margin: 0;">Voer een nieuwe naam in voor deze map. Alle sets in deze map veranderen mee.</p>
                    <input type="text" id="rename-folder-input" placeholder="Nieuwe mapnaam..." style="width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-light); outline: none; font-size: 0.95em;">
                </div>
                <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; margin-top: 0;">
                    <button id="btn-rename-cancel" class="btn-text">Annuleren</button>
                    <button id="btn-rename-confirm" class="btn-gradient" style="padding: 10px 20px;">Opslaan</button>
                </div>
            </div>
        `;

        const input = this.querySelector('#rename-folder-input');

        this.addEventListener('click', (e) => {
            if (e.target === this || e.target.id === 'btn-rename-cancel') {
                this.close();
            }
        });

        const handleConfirm = () => {
            const newName = input.value.trim();
            if (newName) {
                this.dispatchEvent(new CustomEvent('confirm', { detail: { oldName: this._oldName, newName } }));
                this.close();
            } else {
                if (window.Toast) window.Toast.show('Vul een geldige naam in', 'error');
            }
        };

        this.querySelector('#btn-rename-confirm').addEventListener('click', handleConfirm);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            }
        });
    }

    open(oldName) {
        this._oldName = oldName;
        const input = this.querySelector('#rename-folder-input');
        if (input) {
            input.value = oldName || '';
            setTimeout(() => input.focus(), 50);
        }
        this.classList.add('active');
    }

    close() {
        this._oldName = null;
        this.classList.remove('active');
    }
}
customElements.define('quizy-rename-modal', QuizyRenameModal);