import { supabaseReady } from './supabase-init.js';
import Toast from './toast.js';


class QuizyHeader extends HTMLElement {
    async connectedCallback() {
        const isLogin = this.hasAttribute('login-page');
        const pathname = window.location.pathname;
        const isDashboard = /\/dashboard(\.html)?\/?$/.test(pathname);
        const isProfile = /\/profile(\.html)?\/?$/.test(pathname);

        const hasSession = localStorage.getItem('quizy-auth-token') !== null;
        const cachedSub = localStorage.getItem('quizy-subscription');

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
                <a href="#" class="pwa-install-btn" style="display: none;">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">download</span>
                    App Installeren
                </a>
                <a href="#" id="logoutBtn">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">logout</span>
                    Uitloggen
                </a>
            `;
        } else {
            initialMenuHTML = `
                <a href="#" class="pwa-install-btn" style="display: none;">
                    <span class="material-symbols-rounded" style="margin-right: 8px;">download</span>
                    App Installeren
                </a>
                <a class="btn-gradient" href="login.html">Inloggen op Quizy</a>
            `;
        }

        let logoHTML = 'Quizy';
        let logoStyle = '';
        if (hasSession && cachedSub && cachedSub !== 'none') {
            logoHTML = `Quizy <span style="font-size: 0.55em; vertical-align: middle; color: var(--primary); font-weight: 800; margin-left: 6px; border: 1.5px solid var(--primary); padding: 1px 6px; border-radius: 6px; letter-spacing: 0.5px; display: inline-block; line-height: 1; text-transform: uppercase;">${cachedSub}</span>`;
            logoStyle = 'style="display: inline-flex; align-items: center;"';
        }

        this.innerHTML = `
            <a href="index.html" class="logo" ${logoStyle}>${logoHTML}</a>
            <nav class="header-items" id="header-menu">
                ${initialMenuHTML}
            </nav>
            <a href="#" class="pwa-install-btn mobile-install-btn" style="display: none; align-items: center; justify-content: center; color: var(--text-light); text-decoration: none; padding: 8px; margin-left: auto; margin-right: 8px;">
                <span class="material-symbols-rounded">download</span>
            </a>
            ${hasSession ? `
            <a href="#" id="mobileLogoutBtn" class="mobile-logout-btn">
                <span class="material-symbols-rounded">logout</span>
            </a>
            ` : ''}
        `;

        const setupLogout = () => {
            const logoutBtns = this.querySelectorAll('#logoutBtn, #mobileLogoutBtn');
            logoutBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const supabase = await supabaseReady;
                    if (supabase) {
                        await supabase.auth.signOut();
                        localStorage.removeItem('quizy-subscription');
                        window.location.href = 'index.html';
                    }
                });
            });
        };

        setupLogout();

        
        const supabase = await supabaseReady;
        let user = null;
        if (supabase) {
            const { data } = await supabase.auth.getUser();
            user = data?.user;
        }


        const menu = this.querySelector('#header-menu');
        if (!menu) return;

        if (!isLogin) {
            if (user) {
                const currentHTML = menu.innerHTML;
                
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
                        <a href="#" class="pwa-install-btn" style="display: none;">
                            <span class="material-symbols-rounded" style="margin-right: 8px;">download</span>
                            App Installeren
                        </a>
                        <a href="#" id="logoutBtn">
                            <span class="material-symbols-rounded" style="margin-right: 8px;">logout</span>
                            Uitloggen
                        </a>
                    `;
                    if (!this.querySelector('#mobileLogoutBtn')) {
                        const mobileBtn = document.createElement('a');
                        mobileBtn.href = '#';
                        mobileBtn.id = 'mobileLogoutBtn';
                        mobileBtn.className = 'mobile-logout-btn';
                        mobileBtn.innerHTML = '<span class="material-symbols-rounded">logout</span>';
                        this.appendChild(mobileBtn);
                    }
                    setupLogout();
                }

                // Check subscription status
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('subscription')
                        .eq('id', user.id)
                        .single();
                    if (profile && profile.subscription) {
                        localStorage.setItem('quizy-subscription', profile.subscription);
                        const logo = this.querySelector('.logo');
                        if (logo) {
                            if (profile.subscription !== 'none') {
                                logo.innerHTML = `Quizy <span style="font-size: 0.55em; vertical-align: middle; color: var(--primary); font-weight: 800; margin-left: 6px; border: 1.5px solid var(--primary); padding: 1px 6px; border-radius: 6px; letter-spacing: 0.5px; display: inline-block; line-height: 1; text-transform: uppercase;">${profile.subscription}</span>`;
                                logo.style.display = 'inline-flex';
                                logo.style.alignItems = 'center';
                            } else {
                                logo.innerHTML = 'Quizy';
                                logo.style.display = '';
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching profile subscription:', err);
                }
            } else {
                localStorage.removeItem('quizy-subscription');
                menu.innerHTML = `
                    <a href="#" class="pwa-install-btn" style="display: none;">
                        <span class="material-symbols-rounded" style="margin-right: 8px;">download</span>
                        App Installeren
                    </a>
                    <a class="btn-gradient" href="login.html">Inloggen op Quizy</a>
                `;
            }
        } else if (user) {
            // Even on login page or if isLogin is true, if they are logged in, check subscription for logo
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription')
                    .eq('id', user.id)
                    .single();
                if (profile && profile.subscription) {
                    localStorage.setItem('quizy-subscription', profile.subscription);
                    const logo = this.querySelector('.logo');
                    if (logo) {
                        if (profile.subscription !== 'none') {
                            logo.innerHTML = `Quizy <span style="font-size: 0.55em; vertical-align: middle; color: var(--primary); font-weight: 800; margin-left: 6px; border: 1.5px solid var(--primary); padding: 1px 6px; border-radius: 6px; letter-spacing: 0.5px; display: inline-block; line-height: 1; text-transform: uppercase;">${profile.subscription}</span>`;
                            logo.style.display = 'inline-flex';
                            logo.style.alignItems = 'center';
                        } else {
                            logo.innerHTML = 'Quizy';
                            logo.style.display = '';
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching profile subscription:', err);
            }
        } else {
            localStorage.removeItem('quizy-subscription');
        }

        if (window.deferredPrompt) {
            this.querySelectorAll('.pwa-install-btn').forEach(btn => {
                btn.style.display = 'inline-flex';
            });
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
                const event = new CustomEvent('confirm', {
                    detail: { oldName: this._oldName, newName },
                    cancelable: true
                });
                this.dispatchEvent(event);
                if (!event.defaultPrevented) {
                    this.close();
                }
            } else {
                Toast.show('Vul een geldige naam in', 'error');
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

class QuizyConfirmModal extends HTMLElement {
    connectedCallback() {
        this.className = 'modal-overlay';
        this.innerHTML = `
            <div class="modal-card glass-panel" style="max-width: 420px; width: 90%;">
                <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px;">
                    <h3 id="confirm-modal-title" style="font-size: 1.2em; font-weight: 600; color: var(--text-light); margin: 0; text-align: left;">Sessie herstarten?</h3>
                </div>
                <div class="modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 8px; text-align: left;">
                    <p id="confirm-modal-message" style="color: var(--text-muted); font-size: 0.95em; line-height: 1.5; margin: 0;">Weet je zeker dat je de instellingen voor ster-woorden wilt wijzigen?</p>
                    <p id="confirm-modal-sub" style="color: #ef4444; font-size: 0.9em; font-weight: 500; margin: 0;">Dit start een nieuwe sessie en je huidige voortgang gaat verloren.</p>
                </div>
                <div class="modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 16px 24px 20px 24px; display: flex; justify-content: flex-end; gap: 12px; background: rgba(0,0,0,0.2); margin-top: 0;">
                    <button id="btn-confirm-cancel" class="btn-control" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; font-size: 0.9em; cursor: pointer; border-radius: 8px; color: var(--text-light);">Annuleren</button>
                    <button id="btn-confirm-ok" class="btn-control" style="background: var(--primary); border: none; color: #fff; padding: 8px 16px; font-size: 0.9em; cursor: pointer; border-radius: 8px;">Ja, begin opnieuw</button>
                </div>
            </div>
        `;

        this.addEventListener('click', (e) => {
            if (e.target === this || e.target.id === 'btn-confirm-cancel') {
                this.close();
            }
        });

        this.querySelector('#btn-confirm-ok').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('confirm'));
            this.close();
        });
    }

    open({ title, message, sub } = {}) {
        if (title) this.querySelector('#confirm-modal-title').textContent = title;
        if (message) this.querySelector('#confirm-modal-message').textContent = message;
        if (sub) {
            const subEl = this.querySelector('#confirm-modal-sub');
            subEl.textContent = sub;
            subEl.style.display = 'block';
        }
        this.classList.add('active');
    }

    close() {
        this.classList.remove('active');
    }
}
customElements.define('quizy-confirm-modal', QuizyConfirmModal);

class QuizySettingsPanel extends HTMLElement {
    constructor() {
        super();
        this.currentSettings = {};
        this.hasStarred = false;
        this.isTalenMode = false;
        this.lang1 = '';
        this.lang2 = '';
    }

    connectedCallback() {
        this.render();
    }

    static get observedAttributes() {
        return ['mode'];
    }

    attributeChangedCallback() {
        this.render();
    }

    open(settings, hasStarred, isTalenMode, lang1, lang2) {
        this.currentSettings = settings || {};
        this.hasStarred = !!hasStarred;
        this.isTalenMode = !!isTalenMode;
        this.lang1 = lang1 || '';
        this.lang2 = lang2 || '';
        this.render();
        this.classList.add('active');
        
        const starOnlyCheckbox = this.querySelector('#setting-star-only');
        const starWarning = this.querySelector('.warning-text');
        if (starOnlyCheckbox && starWarning) {
            starWarning.style.display = 'none';
            starOnlyCheckbox.addEventListener('change', () => {
                starWarning.style.display = (starOnlyCheckbox.checked !== this.currentSettings.starOnly) ? 'block' : 'none';
            });
        }
    }

    close() {
        this.classList.remove('active');
    }

    render() {
        const mode = this.getAttribute('mode') || 'flashcards';
        const s = this.currentSettings;
        const starOnly = s.starOnly || false;
        const randomize = ('randomize' in s) ? !!s.randomize : true;
        const swapSides = s.swapSides || false;
        const autoSpeak = s.autoSpeak || false;

        const getSpellingSettingsHTML = (settingsObj) => {
            const ignoreParentheses = settingsObj.ignoreParentheses !== false;
            const skipPunctuation = settingsObj.skipPunctuation !== false;
            const allowSlashParts = settingsObj.allowSlashParts !== false;
            const allowTypos = settingsObj.allowTypos !== false;

            return `
                <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0;">
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-ignore-parentheses" class="setting-label">Tussen haakjes goedkeuren</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-ignore-parentheses" ${ignoreParentheses ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Dingen tussen haakjes zijn optioneel. Bijv. "de (mooie) auto" keurt ook "de auto" goed.</span>
                </div>
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-skip-punctuation" class="setting-label">Leestekens & accenten skippen</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-skip-punctuation" ${skipPunctuation ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Negeer leestekens, en vervang speciale letters zoals é of ì door e en i.</span>
                </div>
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-allow-slash-parts" class="setting-label">Eén kant van / goedkeuren</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-allow-slash-parts" ${allowSlashParts ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Als het antwoord "hoi/hallo" is, is "hoi" óf "hallo" goed.</span>
                </div>
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-allow-typos" class="setting-label">Typefouten tolereren</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-allow-typos" ${allowTypos ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Kleine spelling- of typefouten rekenen we ook goed.</span>
                </div>
            `;
        };

        let extraSettingsHTML = '';
        if (mode === 'spelling' || mode === 'dictation') {
            extraSettingsHTML = getSpellingSettingsHTML(s);
        } else if (mode === 'learn') {
            const toggleFc = s.flashcards !== false;
            const toggleMc = s.multipleChoice !== false;
            const toggleSp = s.spelling !== false;

            extraSettingsHTML = `
                <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0;">
                <div class="setting-item">
                    <div class="setting-row">
                        <label class="setting-label">Flashcards</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-toggle-fc" ${toggleFc ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Leer de woorden met behulp van flashcards.</span>
                </div>
                <div class="setting-item">
                    <div class="setting-row">
                        <label class="setting-label">Meerkeuze</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-toggle-mc" ${toggleMc ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Oefen de herkenning van woorden met meerkeuzevragen.</span>
                </div>
                <div class="setting-item">
                    <div class="setting-row">
                        <label class="setting-label">Spelling</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-toggle-sp" ${toggleSp ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Typ de antwoorden om de spelling te oefenen.</span>
                </div>
                ${getSpellingSettingsHTML(s)}
            `;
        }


        let swapSidesLabel = 'Term en definitie omdraaien';
        let swapSidesDesc = 'Toon de definitie als vraag en de term als antwoord.';
        if (this.isTalenMode) {
            swapSidesLabel = 'Talen omdraaien';
            if (mode === 'flashcards') {
                swapSidesDesc = `Toon ${escapeHtml(this.lang2 || 'de vertaling')} op de voorkant en ${escapeHtml(this.lang1 || 'het woord')} op de achterkant.`;
            } else if (mode === 'multiple-choice') {
                swapSidesDesc = `Toon ${escapeHtml(this.lang2 || 'de vertaling')} als vraag en ${escapeHtml(this.lang1 || 'het woord')} als antwoord.`;
            } else if (mode === 'spelling') {
                swapSidesDesc = `Vraag ${escapeHtml(this.lang2 || 'de vertaling')} en typ ${escapeHtml(this.lang1 || 'het woord')}.`;
            } else if (mode === 'dictation') {
                swapSidesDesc = `Beluister en typ ${escapeHtml(this.lang2 || 'de vertaling')} (in plaats van ${escapeHtml(this.lang1 || 'het woord')}).`;
            } else if (mode === 'learn') {
                swapSidesDesc = 'Draai de term en definitie om tijdens het leren.';
            }
        } else {
            if (mode === 'flashcards') {
                swapSidesDesc = 'Toon de definitie op de voorkant en de term op de achterkant.';
            } else if (mode === 'dictation') {
                swapSidesDesc = 'Beluister en typ de definitie (in plaats van de term).';
            } else if (mode === 'learn') {
                swapSidesDesc = 'Draai de term en definitie om tijdens het leren.';
            }
        }

        let randomizeDesc = 'Schud de kaarten in een willekeurige volgorde vanaf het volgende woord.';
        if (mode !== 'flashcards') {
            randomizeDesc = 'Schud de vragen in een willekeurige volgorde vanaf de volgende vraag.';
        }

        let autoSpeakDesc = 'Spreek woorden automatisch uit wanneer ze in beeld komen of bij het omdraaien.';
        if (mode !== 'flashcards') {
            autoSpeakDesc = 'Spreek de vraag automatisch uit wanneer deze in beeld komt.';
        }

        this.innerHTML = `
            <div class="settings-panel-container">
                <h3 class="settings-title">
                    <span class="material-symbols-rounded">settings</span> Instellingen
                </h3>
                
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-star-only" class="setting-label" style="${!this.hasStarred ? 'opacity: 0.5; cursor: not-allowed;' : ''}">Alleen sterwoorden</label>
                        <label class="fc-switch" style="${!this.hasStarred ? 'opacity: 0.5; cursor: not-allowed; pointer-events: none;' : ''}">
                            <input type="checkbox" id="setting-star-only" ${starOnly ? 'checked' : ''} ${!this.hasStarred ? 'disabled' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Oefen alleen de woorden die je met een ster hebt gemarkeerd.</span>
                    <span class="warning-text" style="display: none; color: #ef4444; font-size: 0.85em; margin-top: 6px; font-weight: 500;">Let op: Dit start een nieuwe sessie. Je voortgang gaat verloren!</span>
                </div>

                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-randomize" class="setting-label">Willekeurige volgorde</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-randomize" ${randomize ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">${randomizeDesc}</span>
                </div>

                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-swap-sides" class="setting-label">${swapSidesLabel}</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-swap-sides" ${swapSides ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">${swapSidesDesc}</span>
                </div>

                ${mode !== 'dictation' ? `
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-auto-speak" class="setting-label">Automatisch uitspreken</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-auto-speak" ${autoSpeak ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">${autoSpeakDesc}</span>
                </div>
                ` : ''}

                ${mode !== 'learn' ? `
                <div class="setting-item">
                    <div class="setting-row">
                        <label for="setting-time-pressure" class="setting-label">Tijdsdruk (7s timer)</label>
                        <label class="fc-switch">
                            <input type="checkbox" id="setting-time-pressure" ${s.timePressure ? 'checked' : ''}>
                            <span class="fc-slider"></span>
                        </label>
                    </div>
                    <span class="setting-description">Je krijgt 7 seconden per vraag. Daarna wordt het antwoord automatisch fout gerekend of de kaart omgedraaid.</span>
                </div>
                ` : ''}

                ${extraSettingsHTML}

                <div class="settings-actions">
                    <button class="btn-control" id="btn-settings-save" style="background: var(--primary); color: #fff;">Opslaan</button>
                    <button class="btn-control" id="btn-settings-cancel">Annuleren</button>
                </div>
            </div>
        `;

        const saveBtn = this.querySelector('#btn-settings-save');
        const cancelBtn = this.querySelector('#btn-settings-cancel');

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const detail = {
                    starOnly: this.querySelector('#setting-star-only')?.checked || false,
                    randomize: this.querySelector('#setting-randomize')?.checked || false,
                    swapSides: this.querySelector('#setting-swap-sides')?.checked || false,
                    autoSpeak: this.querySelector('#setting-auto-speak')?.checked || false,
                };

                if (mode !== 'learn') {
                    detail.timePressure = this.querySelector('#setting-time-pressure')?.checked || false;
                }

                if (mode === 'spelling' || mode === 'dictation' || mode === 'learn') {
                    detail.ignoreParentheses = this.querySelector('#setting-ignore-parentheses')?.checked || false;
                    detail.skipPunctuation = this.querySelector('#setting-skip-punctuation')?.checked || false;
                    detail.allowSlashParts = this.querySelector('#setting-allow-slash-parts')?.checked || false;
                    detail.allowTypos = this.querySelector('#setting-allow-typos')?.checked || false;
                }
                if (mode === 'learn') {
                    detail.flashcards = this.querySelector('#setting-toggle-fc')?.checked || false;
                    detail.multipleChoice = this.querySelector('#setting-toggle-mc')?.checked || false;
                    detail.spelling = this.querySelector('#setting-toggle-sp')?.checked || false;
                }

                this.dispatchEvent(new CustomEvent('save', { detail }));
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
                this.dispatchEvent(new CustomEvent('cancel'));
            });
        }
    }
}
customElements.define('quizy-settings-panel', QuizySettingsPanel);

class QuizyKeybindsModal extends HTMLElement {
    connectedCallback() {
        this.className = 'modal-overlay';
        this.render();
        this.setupListeners();
    }

    static get observedAttributes() {
        return ['mode'];
    }

    attributeChangedCallback() {
        this.render();
        this.setupListeners();
    }

    open(mode) {
        if (mode) this.setAttribute('mode', mode);
        this.classList.add('active');
    }

    close() {
        this.classList.remove('active');
    }

    setupListeners() {
        const closeBtn = this.querySelector('#btn-keybinds-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }
        this.addEventListener('click', (e) => {
            if (e.target === this) {
                this.close();
            }
        });
    }

    render() {
        const mode = this.getAttribute('mode') || 'all';
        
        let title = 'Toetsenbord Sneltoetsen';
        let content = '';

        const flashcardKeybinds = `
            <div class="keybind-section">
                <h4 style="margin-top: 0; color: var(--primary); display: flex; align-items: center; gap: 8px; font-size: 1.05em;">
                    <span class="material-symbols-rounded">style</span> Flashcards
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Kaart omdraaien</span>
                        <div style="display: flex; gap: 4px;">
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Spatiebalk</kbd>
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">↑</kbd>
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">↓</kbd>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Goed</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">→</kbd>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Fout</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">←</kbd>
                    </div>
                </div>
            </div>
        `;

        const mcKeybinds = `
            <div class="keybind-section">
                <h4 style="margin-top: 0; color: var(--orange); display: flex; align-items: center; gap: 8px; font-size: 1.05em;">
                    <span class="material-symbols-rounded">list</span> Meerkeuze
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Optie selecteren (A, B, C, D)</span>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">A-D</kbd>
                            <span style="color: var(--text-muted); font-size: 0.8em;">of</span>
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">1-4</kbd>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Navigeren door opties</span>
                        <div style="display: flex; gap: 4px;">
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">↑</kbd>
                            <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">↓</kbd>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Keuze bevestigen</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Volgende vraag</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                </div>
            </div>
        `;

        const spellingKeybinds = `
            <div class="keybind-section">
                <h4 style="margin-top: 0; color: var(--teal); display: flex; align-items: center; gap: 8px; font-size: 1.05em;">
                    <span class="material-symbols-rounded">edit_square</span> Spelling
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Antwoord typen</span>
                        <span style="color: var(--text-light); font-size: 0.85em; font-style: italic;">Gewoon typen</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Antwoord bevestigen</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Volgende vraag</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                </div>
            </div>
        `;

        const dictationKeybinds = `
            <div class="keybind-section">
                <h4 style="margin-top: 0; color: var(--green); display: flex; align-items: center; gap: 8px; font-size: 1.05em;">
                    <span class="material-symbols-rounded">headphones</span> Dictaat
                </h4>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Woord opnieuw afspelen</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Ctrl</kbd>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Antwoord typen</span>
                        <span style="color: var(--text-light); font-size: 0.85em; font-style: italic;">Gewoon typen</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Antwoord bevestigen</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">Volgende vraag</span>
                        <kbd style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 0.8em; box-shadow: 0 2px 0 rgba(0,0,0,0.3); color: var(--text-light); font-weight: bold;">Enter</kbd>
                    </div>
                </div>
            </div>
        `;

        if (mode === 'flashcards') {
            title = 'Toetsenbord Sneltoetsen: Flashcards';
            content = flashcardKeybinds;
        } else if (mode === 'multiple-choice') {
            title = 'Toetsenbord Sneltoetsen: Meerkeuze';
            content = mcKeybinds;
        } else if (mode === 'spelling') {
            title = 'Toetsenbord Sneltoetsen: Spelling';
            content = spellingKeybinds;
        } else if (mode === 'dictation') {
            title = 'Toetsenbord Sneltoetsen: Dictaat';
            content = dictationKeybinds;
        } else {
            title = 'Toetsenbord Sneltoetsen: Leermodus';
            content = `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    ${flashcardKeybinds}
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 0;">
                    ${mcKeybinds}
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 0;">
                    ${spellingKeybinds}
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 0;">
                    ${dictationKeybinds}
                </div>
            `;
        }

        this.innerHTML = `
            <div class="modal-card glass-panel" style="max-width: 440px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; text-align: left; padding: 0; background: rgba(22, 22, 30, 0.98); border: 1px solid rgba(255, 255, 255, 0.12);">
                <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="material-symbols-rounded" style="color: var(--primary); font-size: 24px;">keyboard</span>
                        <h3 style="font-size: 1.15em; font-weight: 600; color: var(--text-light); margin: 0;">${title}</h3>
                    </div>
                    <button id="btn-keybinds-close" class="btn-close-flashcards" title="Sluiten" style="transform: none; position: static; width: 32px; height: 32px;">
                        <span class="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
                    ${content}
                </div>
            </div>
        `;
    }
}
customElements.define('quizy-keybinds-modal', QuizyKeybindsModal);