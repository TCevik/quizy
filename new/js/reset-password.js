document.addEventListener('DOMContentLoaded', async () => {
    // Check if the URL hash contains password recovery markers immediately
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(window.location.search);
    const isRecovery = hash.includes('type=recovery') || hash.includes('recovery_token') || queryParams.get('type') === 'recovery';

    // If we are not in a recovery flow, redirect to login
    if (!isRecovery) {
        window.location.href = 'login.html';
        return;
    }

    const supabase = await window.supabaseReady;
    if (!supabase) return;

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const messageEl = document.getElementById('message');

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (messageEl) {
                messageEl.style.display = 'none';
            }

            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                if (messageEl) {
                    messageEl.textContent = 'Wachtwoorden komen niet overeen.';
                    messageEl.className = 'message error';
                    messageEl.style.display = 'block';
                }
                return;
            }

            if (messageEl) {
                messageEl.textContent = 'Wachtwoord bijwerken...';
                messageEl.className = 'message';
                messageEl.style.display = 'block';
            }

            const { error } = await supabase.auth.updateUser({ password });

            if (messageEl) {
                if (error) {
                    messageEl.textContent = `Fout bij bijwerken: ${error.message}`;
                    messageEl.className = 'message error';
                } else {
                    messageEl.textContent = 'Wachtwoord succesvol bijgewerkt! Je wordt doorgestuurd...';
                    messageEl.className = 'message success';
                    
                    // Optional: Sign out the recovery session so they log in normally
                    await supabase.auth.signOut();
                    window.location.href = 'login.html';
                }
            }
        });
    }
});
