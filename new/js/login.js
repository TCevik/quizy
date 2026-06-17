document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');
    
    const supabase = await window.supabaseReady;

    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
            return;
        }
    }

    if (loginForm && supabase) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (errorMessage) {
                errorMessage.style.display = 'none';
            }

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                if (errorMessage) {
                    errorMessage.textContent = `Inloggen mislukt: ${error.message}`;
                    errorMessage.style.display = 'block';
                }
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    }

    // Forgot password modal functionality
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
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
});