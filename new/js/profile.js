document.addEventListener('DOMContentLoaded', async () => {
    const supabase = await window.supabaseReady;

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
        userNameEl.textContent = name;
    }

    // Display user's email
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }

    // Password reset link functionality
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const passwordMessage = document.getElementById('password-message');

    function showMessage(text, isSuccess) {
        if (passwordMessage) {
            passwordMessage.textContent = text;
            passwordMessage.className = `message ${isSuccess ? 'success' : 'error'}`;
            passwordMessage.style.display = 'block';
        }
    }

    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            showMessage('Bezig met verzenden van herstellink...', true);

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: window.location.origin + '/reset-password.html',
            });

            if (resetError) {
                showMessage(`Fout bij verzenden: ${resetError.message}`, false);
            } else {
                showMessage('Er is direct een herstellink naar je e-mailadres gestuurd!', true);
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

            if (newPassword.length < 6) {
                showMessage('Het nieuwe wachtwoord moet minimaal 6 tekens lang zijn.', false);
                return;
            }

            if (newPassword !== confirmPassword) {
                showMessage('De nieuwe wachtwoorden komen niet overeen.', false);
                return;
            }

            showMessage('Wachtwoord bijwerken...', true);

            let updatePayload = { password: newPassword };

            if (oldPassword) {
                // Verify the old password by attempting to sign in with it first
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: oldPassword
                });

                if (signInError) {
                    showMessage('Het oude wachtwoord is onjuist.', false);
                    return;
                }

                updatePayload.current_password = oldPassword;
                updatePayload.currentPassword = oldPassword;
            }

            // Update the password
            const { error: updateError } = await supabase.auth.updateUser(updatePayload);

            if (updateError) {
                if (updateError.message.includes('Current password required')) {
                    showMessage('Het oude wachtwoord is verplicht om je wachtwoord te wijzigen.', false);
                } else if (updateError.message.includes('invalid') || updateError.message.includes('Incorrect')) {
                    showMessage('Het oude wachtwoord is onjuist.', false);
                } else if (updateError.message.toLowerCase().includes('at least 6 characters') || updateError.message.includes('6 tekens')) {
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
});
