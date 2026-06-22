document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    
    const supabase = await window.supabaseReady;

    if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            window.location.href = 'dashboard.html';
            return;
        }
    }

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

            if (isLoginMode) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                    options: {
                        captchaToken: captchaToken
                    }
                });

                if (error) {
                    if (error.message.includes('Email not confirmed') || error.message.toLowerCase().includes('confirm')) {
                        await resendConfirmationEmail(email, null);
                    } else {
                        Toast.show(`Inloggen mislukt: ${error.message}`, 'error');
                    }
                    resetAllTurnstiles();
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                const name = nameInput.value.trim();
                const confirmPassword = confirmPasswordInput.value;

                if (!name) {
                    Toast.show('Weergavenaam is verplicht.', 'error');
                    return;
                }

                if (name.length > 20) {
                    const over = name.length - 20;
                    Toast.show(`Weergavenaam is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 20).`, 'error');
                    return;
                }

                if (password.length < 6) {
                    Toast.show('Wachtwoord moet minimaal 6 tekens lang zijn.', 'error');
                    return;
                }

                if (!confirmPassword) {
                    Toast.show('Bevestig het wachtwoord.', 'error');
                    return;
                }

                if (password !== confirmPassword) {
                    Toast.show('Wachtwoorden komen niet overeen.', 'error');
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

                if (error) {
                    Toast.show(`Registratie mislukt: ${error.message}`, 'error');
                    resetAllTurnstiles();
                } else {
                    // Check if user is auto-confirmed or if email confirmation is enabled
                    if (data?.user && data.user.identities && data.user.identities.length === 0) {
                        Toast.show('Dit e-mailadres is al geregistreerd.', 'error');
                        resetAllTurnstiles();
                    } else if (data?.session) {
                        window.location.href = 'dashboard.html';
                    } else {
                        // Email confirmation might be needed
                        Toast.show('Registratie succesvol! Controleer je e-mail voor een verificatielink.', 'success');
                        resetAllTurnstiles();
                    }
                }
            }
        });
    }

    // Forgot password modal functionality
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

        // Close on clicking outside modal content
        window.addEventListener('click', (e) => {
            if (e.target === resetModal) {
                resetModal.style.display = 'none';
            }
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

            Toast.show('Versturen...', 'info');

            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/reset-password.html',
                captchaToken: captchaToken
            });

            if (error) {
                Toast.show(`Fout: ${error.message}`, 'error');
                resetAllTurnstiles();
            } else {
                Toast.show('Er is een herstellink naar je e-mailadres gestuurd!', 'success');
                resetForm.reset();
                resetAllTurnstiles();
                if (resetModal) resetModal.style.display = 'none';
            }
        });
    }

    // Resend confirmation email modal functionality
    const resendModal = document.getElementById('resendModal');
    const closeResendModal = document.getElementById('closeResendModal');
    const resendForm = document.getElementById('resendForm');

    if (closeResendModal && resendModal) {
        closeResendModal.addEventListener('click', () => {
            resendModal.style.display = 'none';
        });

        // Close on clicking outside modal content
        window.addEventListener('click', (e) => {
            if (e.target === resendModal) {
                resendModal.style.display = 'none';
            }
        });
    }

    function resetAllTurnstiles() {
        if (window.turnstile) {
            document.querySelectorAll('.cf-turnstile').forEach(div => {
                try {
                    window.turnstile.reset(div);
                } catch (e) {}
            });
        }
    }

    async function resendConfirmationEmail(email, customMessageEl = null) {
        Toast.show('Verificatiemail versturen...', 'info');

        const captchaToken = (resendForm ? resendForm.querySelector('[name="cf-turnstile-response"]')?.value : null) || 
                             (loginForm ? loginForm.querySelector('[name="cf-turnstile-response"]')?.value : null) || undefined;

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/dashboard.html',
                captchaToken: captchaToken
            }
        });

        if (error) {
            Toast.show(`Fout: ${error.message}`, 'error');
            resetAllTurnstiles();
        } else {
            Toast.show('Je e-mailadres is nog niet bevestigd. Er is direct een nieuwe verificatiemail naar je verstuurd!', 'success');
            if (resendForm) resendForm.reset();
            resetAllTurnstiles();
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
            await resendConfirmationEmail(email);
        });
    }
});