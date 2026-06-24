import { supabaseReady } from './supabase-init.js';
import Toast from './toast.js';

const initProfile = async () => {
    const supabase = await supabaseReady;

    if (!supabase) {
        console.error('Supabase failed to initialize.');
        return;
    }

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        // Not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    // Display user's name
    const userNameEl = document.getElementById('user-name');
    let name = user.user_metadata?.full_name || user.user_metadata?.name;
    if (!name) {
        if (user.email && (user.email.toLowerCase().includes('tamer') || user.email.toLowerCase().includes('cevik'))) {
            name = 'Tamer Çevik';
        } else if (user.email) {
            const prefix = user.email.split('@')[0];
            name = prefix.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        } else {
            name = 'Gebruiker';
        }
    }
    
    if (userNameEl) {
        userNameEl.textContent = 'Welkom, ' + name;
    }



    // Pre-fill display name input
    const displayNameInput = document.getElementById('display-name');
    if (displayNameInput && name) {
        displayNameInput.value = name;
    }

    // Display user's email
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }

    // Change name form submission
    const changeNameForm = document.getElementById('changeNameForm');

    function showProfileMessage(text, isSuccess) {
        Toast.show(text, isSuccess ? 'success' : 'error');
    }

    if (changeNameForm) {
        changeNameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = displayNameInput.value.trim();

            if (!newName) {
                showProfileMessage('Voer een geldige weergavenaam in.', false);
                return;
            }

            if (newName.length > 20) {
                const over = newName.length - 20;
                showProfileMessage(`Weergavenaam is te lang (${over} ${over === 1 ? 'teken' : 'tekens'} over de limiet van 20).`, false);
                return;
            }

            showProfileMessage('Weergavenaam bijwerken...', true);

            const { error: updateError } = await supabase.auth.updateUser({
                data: { 
                    full_name: newName, 
                    name: newName
                }
            });

            if (updateError) {
                showProfileMessage(`Fout bij het bijwerken van naam: ${updateError.message}`, false);
            } else {
                showProfileMessage('Weergavenaam succesvol bijgewerkt!', true);
                if (userNameEl) {
                    userNameEl.textContent = 'Welkom, ' + newName;
                }
            }
        });
    }



    // Password reset link functionality
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const profileResetModal = document.getElementById('profileResetModal');
    const closeProfileResetModal = document.getElementById('closeProfileResetModal');
    const profileResetForm = document.getElementById('profileResetForm');
    const resetEmailDisplay = document.getElementById('resetEmailDisplay');

    function showMessage(text, isSuccess) {
        Toast.show(text, isSuccess ? 'success' : 'error');
    }

    function resetProfileTurnstile() {
        if (window.turnstile && profileResetForm) {
            profileResetForm.querySelectorAll('.cf-turnstile').forEach(div => {
                try { window.turnstile.reset(div); } catch (e) { console.error('Error resetting Turnstile in profile:', e); }
            });
        }
    }

    if (resetPasswordBtn && profileResetModal) {
        resetPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetEmailDisplay) resetEmailDisplay.textContent = user.email;
            profileResetModal.style.display = 'flex';
        });
    }

    if (closeProfileResetModal && profileResetModal) {
        closeProfileResetModal.addEventListener('click', () => {
            profileResetModal.style.display = 'none';
            resetProfileTurnstile();
        });
        window.addEventListener('click', (e) => {
            if (e.target === profileResetModal) {
                profileResetModal.style.display = 'none';
                resetProfileTurnstile();
            }
        });
    }

    if (profileResetForm && supabase) {
        profileResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const captchaToken = profileResetForm.querySelector('[name="cf-turnstile-response"]')?.value || undefined;

            showMessage('Bezig met verzenden van herstellink...', true);

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: window.location.origin + '/reset-password.html',
                captchaToken: captchaToken
            });

            if (resetError) {
                showMessage(`Fout bij verzenden: ${resetError.message}`, false);
                resetProfileTurnstile();
            } else {
                showMessage('Er is een herstellink naar je e-mailadres gestuurd!', true);
                profileResetModal.style.display = 'none';
                resetProfileTurnstile();
            }
        });
    }

    // Change password form submission
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const oldPassword = document.getElementById('old-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (!oldPassword) {
                showMessage('Het oude wachtwoord is verplicht.', false);
                return;
            }

            if (!newPassword) {
                showMessage('Nieuw wachtwoord is verplicht.', false);
                return;
            }

            if (newPassword.length < 6) {
                showMessage('Het nieuwe wachtwoord moet minimaal 6 tekens lang zijn.', false);
                return;
            }

            if (!confirmPassword) {
                showMessage('Bevestig het nieuwe wachtwoord.', false);
                return;
            }

            if (newPassword !== confirmPassword) {
                showMessage('De nieuwe wachtwoorden komen niet overeen.', false);
                return;
            }

            showMessage('Wachtwoord bijwerken...', true);

            let updatePayload = { password: newPassword };

            if (oldPassword) {
                updatePayload.current_password = oldPassword;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser(updatePayload);

            if (updateError) {
                const errMsg = updateError.message.toLowerCase();
                if (errMsg.includes('invalid') || errMsg.includes('incorrect') || errMsg.includes('wrong') || errMsg.includes('current_password') || errMsg.includes('current password')) {
                    showMessage('Het oude wachtwoord is onjuist.', false);
                } else if (errMsg.includes('at least 6 characters') || errMsg.includes('6 tekens')) {
                    showMessage('Het nieuwe wachtwoord moet minimaal 6 tekens lang zijn.', false);
                } else {
                    showMessage(`Fout bij het bijwerken: ${updateError.message}`, false);
                }
            } else {
                showMessage('Wachtwoord succesvol bijgewerkt!', true);
                changePasswordForm.reset();
            }
        });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfile);
} else {
    initProfile();
}
