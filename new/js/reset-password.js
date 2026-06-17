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

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                Toast.show('Wachtwoorden komen niet overeen.', 'error');
                return;
            }

            Toast.show('Wachtwoord bijwerken...', 'info');

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                Toast.show(`Fout bij bijwerken: ${error.message}`, 'error');
            } else {
                Toast.show('Wachtwoord succesvol bijgewerkt! Je wordt doorgestuurd...', 'success');
                
                // Optional: Sign out the recovery session so they log in normally
                await supabase.auth.signOut();
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            }
        });
    }
});
