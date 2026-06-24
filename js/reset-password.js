import { supabaseReady, getFriendlyErrorMessage } from './supabase-init.js';
import Toast from './toast.js';

const initReset = async () => {
    // Check if the URL hash contains password recovery markers immediately
    const hash = window.location.hash;
    const queryParams = new URLSearchParams(window.location.search);
    const isRecovery = hash.includes('type=recovery') || hash.includes('recovery_token') || queryParams.get('type') === 'recovery';

    // If we are not in a recovery flow, redirect to login
    if (!isRecovery) {
        window.location.href = 'login.html';
        return;
    }

    const supabase = await supabaseReady;
    if (!supabase) return;

    const resetPasswordForm = document.getElementById('resetPasswordForm');

    function toggleButtonLoading(button, isLoading, normalText, normalIcon, loadingText) {
        if (!button) return;
        const textSpan = button.querySelector('span:not(.material-symbols-rounded)') || button.querySelector('span');
        const iconSpan = button.querySelector('.material-symbols-rounded');
        
        button.disabled = isLoading;
        if (isLoading) {
            button.classList.add('loading');
            if (textSpan) textSpan.textContent = loadingText;
            if (iconSpan) iconSpan.textContent = 'progress_activity';
        } else {
            button.classList.remove('loading');
            if (textSpan) textSpan.textContent = normalText;
            if (iconSpan) iconSpan.textContent = normalIcon;
        }
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password.length < 6) {
                Toast.show('Wachtwoord moet minimaal 6 tekens lang zijn.', 'error');
                return;
            }
            if (password !== confirmPassword) {
                Toast.show('Wachtwoorden komen niet overeen.', 'error');
                return;
            }

            const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');
            toggleButtonLoading(submitBtn, true, 'Wachtwoord opslaan', 'check_circle', 'Wachtwoord bijwerken...');

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                toggleButtonLoading(submitBtn, false, 'Wachtwoord opslaan', 'check_circle', 'Wachtwoord bijwerken...');
                Toast.show(`Fout bij bijwerken: ${getFriendlyErrorMessage(error)}`, 'error');
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
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReset);
} else {
    initReset();
}

