document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    
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

            if (errorMessage) {
                errorMessage.style.display = 'none';
                errorMessage.style.background = '';
                errorMessage.style.borderColor = '';
                errorMessage.style.color = '';
            }

            if (isLoginMode) {
                formTitle.textContent = 'Welkom terug';
                formSubtitle.textContent = 'Log in om verder te gaan met leren';
                nameGroup.style.display = 'none';
                confirmPasswordGroup.style.display = 'none';
                nameInput.removeAttribute('required');
                confirmPasswordInput.removeAttribute('required');
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
                nameInput.setAttribute('required', 'required');
                confirmPasswordInput.setAttribute('required', 'required');
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
            
            if (errorMessage) {
                errorMessage.style.display = 'none';
                errorMessage.style.background = '';
                errorMessage.style.borderColor = '';
                errorMessage.style.color = '';
            }

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (isLoginMode) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    if (errorMessage) {
                        if (error.message.includes('Email not confirmed') || error.message.toLowerCase().includes('confirm')) {
                            await resendConfirmationEmail(email, errorMessage);
                        } else {
                            errorMessage.textContent = `Inloggen mislukt: ${error.message}`;
                            errorMessage.style.display = 'block';
                        }
                    }
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                const name = nameInput.value.trim();
                const confirmPassword = confirmPasswordInput.value;

                if (!name) {
                    if (errorMessage) {
                        errorMessage.textContent = 'Weergavenaam is verplicht.';
                        errorMessage.style.display = 'block';
                    }
                    return;
                }

                if (name.length > 20) {
                    if (errorMessage) {
                        errorMessage.textContent = 'Weergavenaam mag maximaal 20 tekens zijn.';
                        errorMessage.style.display = 'block';
                    }
                    return;
                }

                if (password !== confirmPassword) {
                    if (errorMessage) {
                        errorMessage.textContent = 'Wachtwoorden komen niet overeen.';
                        errorMessage.style.display = 'block';
                    }
                    return;
                }

                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            name: name,
                            full_name: name
                        }
                    }
                });

                if (error) {
                    if (errorMessage) {
                        errorMessage.textContent = `Registratie mislukt: ${error.message}`;
                        errorMessage.style.display = 'block';
                    }
                } else {
                    // Check if user is auto-confirmed or if email confirmation is enabled
                    if (data?.user && data.user.identities && data.user.identities.length === 0) {
                        if (errorMessage) {
                            errorMessage.textContent = 'Dit e-mailadres is al geregistreerd.';
                            errorMessage.className = 'error-message';
                            errorMessage.style.display = 'block';
                        }
                    } else if (data?.session) {
                        window.location.href = 'dashboard.html';
                    } else {
                        // Email confirmation might be needed
                        if (errorMessage) {
                            errorMessage.textContent = 'Registratie succesvol! Controleer je e-mail voor een verificatielink.';
                            errorMessage.className = 'message success'; // show success instead of red error box, wait, wait, errorMessage has .error-message styling, so we should keep it looking good
                            // Let's styling it nicely. Actually we can use errorMessage class but change styling or display style
                            errorMessage.style.background = 'rgba(67, 160, 71, 0.15)';
                            errorMessage.style.borderColor = 'rgba(67, 160, 71, 0.3)';
                            errorMessage.style.color = '#43a047';
                            errorMessage.style.display = 'block';
                        }
                    }
                }
            }
        });
    }

    // Forgot password modal functionality
    const resetModal = document.getElementById('resetModal');
    const closeResetModal = document.getElementById('closeResetModal');
    const resetForm = document.getElementById('resetForm');
    const resetMessage = document.getElementById('reset-message');

    if (forgotPasswordBtn && resetModal) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetModal.style.display = 'flex';
            if (resetMessage) {
                resetMessage.style.display = 'none';
            }
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
            const resetEmail = document.getElementById('reset-email').value;

            if (resetMessage) {
                resetMessage.textContent = 'Versturen...';
                resetMessage.className = 'message';
                resetMessage.style.display = 'block';
            }

            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/reset-password.html',
            });

            if (resetMessage) {
                if (error) {
                    resetMessage.textContent = `Fout: ${error.message}`;
                    resetMessage.className = 'message error';
                } else {
                    resetMessage.textContent = 'Er is een herstellink naar je e-mailadres gestuurd!';
                    resetMessage.className = 'message success';
                    resetForm.reset();
                }
            }
        });
    }

    // Resend confirmation email modal functionality
    const resendModal = document.getElementById('resendModal');
    const closeResendModal = document.getElementById('closeResendModal');
    const resendForm = document.getElementById('resendForm');
    const resendMessage = document.getElementById('resend-message');

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

    async function resendConfirmationEmail(email, customMessageEl = null) {
        const msgEl = customMessageEl || resendMessage;
        if (msgEl) {
            msgEl.textContent = 'Verificatiemail versturen...';
            if (!customMessageEl) {
                msgEl.className = 'message';
            }
            msgEl.style.display = 'block';
        }

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: window.location.origin + '/dashboard.html'
            }
        });

        if (msgEl) {
            if (error) {
                msgEl.textContent = `Fout: ${error.message}`;
                if (!customMessageEl) {
                    msgEl.className = 'message error';
                }
            } else {
                msgEl.textContent = 'Je e-mailadres is nog niet bevestigd. Er is direct een nieuwe verificatiemail naar je verstuurd!';
                if (!customMessageEl) {
                    msgEl.className = 'message success';
                    if (resendForm) resendForm.reset();
                } else {
                    msgEl.style.background = 'rgba(67, 160, 71, 0.15)';
                    msgEl.style.borderColor = 'rgba(67, 160, 71, 0.3)';
                    msgEl.style.color = '#43a047';
                }
            }
        }
    }

    if (resendForm && supabase) {
        resendForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resend-email').value;
            await resendConfirmationEmail(email);
        });
    }
});