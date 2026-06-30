import { supabaseReady, getFriendlyErrorMessage } from './supabase-init.js';
import Toast from './toast.js';
import { toggleButtonLoading, resetTurnstiles, getRedirectUrl } from './main.js';

const initLogin = async () => {
    const loginForm = document.getElementById('loginForm');
    
    const supabase = await supabaseReady;

    let isLoginMode = true;
    const toggleAuthBtn = document.getElementById('toggleAuthBtn');
    const nameGroup = document.getElementById('nameGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    const togglePromptText = document.getElementById('togglePromptText');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

    const nameInput = document.getElementById('name');
    const confirmPasswordInput = document.getElementById('confirm-password');

    if (toggleAuthBtn) {
        toggleAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            if (isLoginMode) {
                formTitle.textContent = 'Welkom terug';
                formSubtitle.textContent = 'Log in om verder te gaan met leren';
                nameGroup.style.display = 'none';
                confirmPasswordGroup.style.display = 'none';
                submitText.textContent = 'Inloggen';
                submitIcon.textContent = 'arrow_forward';
                togglePromptText.textContent = 'Nog geen account?';
                toggleAuthBtn.textContent = 'Registreer hier';
                forgotPasswordBtn.style.display = 'inline-block';
            } else {
                formTitle.textContent = 'Account aanmaken';
                formSubtitle.textContent = 'Meld je aan om te beginnen met leren';
                nameGroup.style.display = 'block';
                confirmPasswordGroup.style.display = 'block';
                submitText.textContent = 'Registreren';
                submitIcon.textContent = 'person_add';
                togglePromptText.textContent = 'Heb je al een account?';
                toggleAuthBtn.textContent = 'Log hier in';
                forgotPasswordBtn.style.display = 'none';
            }
        });
    }

    if (loginForm && supabase) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email) {
                Toast.show('E-mailadres is verplicht.', 'error');
                return;
            }

            if (!password) {
                Toast.show('Wachtwoord is verplicht.', 'error');
                return;
            }

            const captchaToken = loginForm.querySelector('[name="cf-turnstile-response"]')?.value || undefined;

            const submitBtn = document.getElementById('submitBtn');
            const submitTextStr = isLoginMode ? 'Inloggen' : 'Registreren';
            const submitIconStr = isLoginMode ? 'arrow_forward' : 'person_add';
            const loadingTextStr = isLoginMode ? 'Inloggen...' : 'Registreren...';
            
            toggleButtonLoading(submitBtn, true, submitTextStr, submitIconStr, loadingTextStr);

            if (isLoginMode) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                    options: {
                        captchaToken: captchaToken
                    }
                });

                if (error) {
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    if (error.message.includes('Email not confirmed') || error.message.toLowerCase().includes('confirm')) {
                        await resendConfirmationEmail(email, null);
                    } else {
                        Toast.show(`Inloggen mislukt: ${getFriendlyErrorMessage(error)}`, 'error');
                    }
                    resetTurnstiles();
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                const name = nameInput.value.trim();
                const confirmPassword = confirmPasswordInput.value;

                if (!name) {
                    Toast.show('Weergavenaam is verplicht.', 'error');
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    return;
                }

                if (name.length > 20) {
                    const over = name.length - 20;
                    Toast.show(`Weergavenaam is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 20).`, 'error');
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    return;
                }

                if (password.length < 6) {
                    Toast.show('Wachtwoord moet minimaal 6 tekens lang zijn.', 'error');
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    return;
                }

                if (!confirmPassword) {
                    Toast.show('Bevestig het wachtwoord.', 'error');
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    return;
                }

                if (password !== confirmPassword) {
                    Toast.show('Wachtwoorden komen niet overeen.', 'error');
                    toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        captchaToken: captchaToken,
                        data: {
                            name: name,
                            full_name: name
                        }
                    }
                });

                toggleButtonLoading(submitBtn, false, submitTextStr, submitIconStr, loadingTextStr);

                if (error) {
                    Toast.show(`Registratie mislukt: ${getFriendlyErrorMessage(error)}`, 'error');
                    resetTurnstiles();
                } else {
                    
                    if (data?.user && data.user.identities && data.user.identities.length === 0) {
                        Toast.show('Dit e-mailadres is al geregistreerd.', 'error');
                        resetTurnstiles();
                    } else if (data?.session) {
                        window.location.href = 'dashboard.html';
                    } else {
                        
                        Toast.show('Registratie succesvol! Controleer je e-mail voor een verificatielink.', 'success');
                        resetTurnstiles();
                    }
                }
            }
        });
    }

    
    const resetModal = document.getElementById('resetModal');
    const closeResetModal = document.getElementById('closeResetModal');
    const resetForm = document.getElementById('resetForm');

    if (forgotPasswordBtn && resetModal) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetModal.style.display = 'flex';
        });
    }

    if (closeResetModal && resetModal) {
        closeResetModal.addEventListener('click', () => {
            resetModal.style.display = 'none';
        });
    }

    if (resetForm && supabase) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const resetEmail = document.getElementById('reset-email').value.trim();
            if (!resetEmail) {
                Toast.show('E-mailadres is verplicht.', 'error');
                return;
            }
            const captchaToken = resetForm.querySelector('[name="cf-turnstile-response"]')?.value || undefined;

            const submitBtn = resetForm.querySelector('button[type="submit"]');
            toggleButtonLoading(submitBtn, true, 'Link versturen', 'send', 'Versturen...');

            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: getRedirectUrl('reset-password.html'),
                captchaToken: captchaToken
            });

            toggleButtonLoading(submitBtn, false, 'Link versturen', 'send', 'Versturen...');

            if (error) {
                Toast.show(`Fout: ${getFriendlyErrorMessage(error)}`, 'error');
                resetTurnstiles();
            } else {
                Toast.show('Er is een herstellink naar je e-mailadres gestuurd!', 'success');
                resetForm.reset();
                resetTurnstiles();
                if (resetModal) resetModal.style.display = 'none';
            }
        });
    }

    
    const resendModal = document.getElementById('resendModal');
    const closeResendModal = document.getElementById('closeResendModal');
    const resendForm = document.getElementById('resendForm');

    if (closeResendModal && resendModal) {
        closeResendModal.addEventListener('click', () => {
            resendModal.style.display = 'none';
        });
    }

    async function resendConfirmationEmail(email, customMessageEl = null) {
        Toast.show('Verificatiemail versturen...', 'info');

        const captchaToken = (resendForm ? resendForm.querySelector('[name="cf-turnstile-response"]')?.value : null) || 
                             (loginForm ? loginForm.querySelector('[name="cf-turnstile-response"]')?.value : null) || undefined;

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: getRedirectUrl('dashboard.html'),
                captchaToken: captchaToken
            }
        });

        if (error) {
            Toast.show(`Fout: ${getFriendlyErrorMessage(error)}`, 'error');
            resetTurnstiles();
        } else {
            Toast.show('Je e-mailadres is nog niet bevestigd. Er is direct een nieuwe verificatiemail naar je verstuurd!', 'success');
            if (resendForm) resendForm.reset();
            resetTurnstiles();
            if (resendModal) resendModal.style.display = 'none';
        }
    }

    if (resendForm && supabase) {
        resendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resend-email').value.trim();
            if (!email) {
                Toast.show('E-mailadres is verplicht.', 'error');
                return;
            }
            const submitBtn = resendForm.querySelector('button[type="submit"]');
            toggleButtonLoading(submitBtn, true, 'Mail versturen', 'send', 'Versturen...');
            await resendConfirmationEmail(email);
            toggleButtonLoading(submitBtn, false, 'Mail versturen', 'send', 'Versturen...');
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogin);
} else {
    initLogin();
}