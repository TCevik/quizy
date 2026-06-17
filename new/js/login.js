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

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (isLoginMode) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    if (error.message.includes('Email not confirmed') || error.message.toLowerCase().includes('confirm')) {
                        await resendConfirmationEmail(email, null);
                    } else {
                        Toast.show(`Inloggen mislukt: ${error.message}`, 'error');
                    }
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
                    Toast.show('Weergavenaam mag maximaal 20 tekens zijn.', 'error');
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
                        data: {
                            name: name,
                            full_name: name
                        }
                    }
                });

                if (error) {
                    Toast.show(`Registratie mislukt: ${error.message}`, 'error');
                } else {
                    // Check if user is auto-confirmed or if email confirmation is enabled
                    if (data?.user && data.user.identities && data.user.identities.length === 0) {
                        Toast.show('Dit e-mailadres is al geregistreerd.', 'error');
                    } else if (data?.session) {
                        window.location.href = 'dashboard.html';
                    } else {
                        // Email confirmation might be needed
                        Toast.show('Registratie succesvol! Controleer je e-mail voor een verificatielink.', 'success');
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
            const resetEmail = document.getElementById('reset-email').value;

            Toast.show('Versturen...', 'info');

            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/reset-password.html',
            });

            if (error) {
                Toast.show(`Fout: ${error.message}`, 'error');
            } else {
                Toast.show('Er is een herstellink naar je e-mailadres gestuurd!', 'success');
                resetForm.reset();
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

    async function resendConfirmationEmail(email, customMessageEl = null) {
        Toast.show('Verificatiemail versturen...', 'info');

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: window.location.origin + '/dashboard.html'
            }
        });

        if (error) {
            Toast.show(`Fout: ${error.message}`, 'error');
        } else {
            Toast.show('Je e-mailadres is nog niet bevestigd. Er is direct een nieuwe verificatiemail naar je verstuurd!', 'success');
            if (resendForm) resendForm.reset();
            if (resendModal) resendModal.style.display = 'none';
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