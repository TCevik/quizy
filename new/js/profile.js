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
        userNameEl.textContent = 'Welkom, ' + name;
    }

    // Display user's avatar if exists
    const userAvatarImg = document.getElementById('user-avatar');
    const userAvatarPlaceholder = document.getElementById('user-avatar-placeholder');
    const avatarUrlInput = document.getElementById('avatar-url');
    const avatarFileInput = document.getElementById('avatar-file');

    function updateAvatarDisplay(url) {
        if (url && url.trim()) {
            userAvatarImg.src = url.trim();
            userAvatarImg.style.display = 'block';
            userAvatarPlaceholder.style.display = 'none';
        } else {
            userAvatarImg.src = '';
            userAvatarImg.style.display = 'none';
            userAvatarPlaceholder.style.display = 'block';
        }
    }

    const currentAvatarUrl = user.user_metadata?.avatar_url || '';
    updateAvatarDisplay(currentAvatarUrl);

    if (avatarUrlInput && currentAvatarUrl && !currentAvatarUrl.startsWith('data:')) {
        avatarUrlInput.value = currentAvatarUrl;
    }

    async function compressImageToLimit(file, limit = 524288) {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = URL.createObjectURL(file);
        });

        let width = image.width;
        let height = image.height;
        let quality = 0.95;
        let dataUrl = '';
        let size = Infinity;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        while (size > limit && (width > 50 && height > 50)) {
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);
            
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            const head = 'data:image/jpeg;base64,';
            const base64Data = dataUrl.substring(head.length);
            size = Math.round((base64Data.length * 3) / 4);

            if (size <= limit) {
                break;
            }

            if (quality > 0.4) {
                quality -= 0.05;
            } else {
                width = Math.round(width * 0.9);
                height = Math.round(height * 0.9);
                quality = 0.85;
            }
        }
        
        URL.revokeObjectURL(image.src);
        return dataUrl;
    }

    // Update filename display and auto-save on file selection
    const fileUploadText = document.getElementById('file-upload-text');
    if (avatarFileInput && fileUploadText) {
        avatarFileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                fileUploadText.textContent = file.name;
                fileUploadText.style.color = 'var(--text-light)';

                showAvatarMessage('Afbeelding verwerken en opslaan...', true);

                try {
                    let base64Url = '';
                    if (file.size > 524288) {
                        showAvatarMessage('Afbeelding verkleinen naar < 500KB...', true);
                        base64Url = await compressImageToLimit(file, 524288);
                    } else {
                        base64Url = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = (err) => reject(err);
                            reader.readAsDataURL(file);
                        });
                    }

                    const { error: updateError } = await supabase.auth.updateUser({
                        data: { 
                            avatar_url: base64Url
                        }
                    });

                    if (updateError) {
                        showAvatarMessage(`Fout bij het opslaan van afbeelding: ${updateError.message}`, false);
                    } else {
                        showAvatarMessage('Profielfoto succesvol geüpload en opgeslagen!', true);
                        updateAvatarDisplay(base64Url);
                        if (avatarUrlInput) {
                            avatarUrlInput.value = '';
                        }
                    }
                } catch (err) {
                    showAvatarMessage('Fout bij het verwerken van het bestand.', false);
                }
            } else {
                fileUploadText.textContent = 'Kies een afbeelding...';
                fileUploadText.style.color = 'var(--text-muted)';
            }
        });
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
    const profileMessage = document.getElementById('profile-message');

    function showProfileMessage(text, isSuccess) {
        if (profileMessage) {
            profileMessage.textContent = text;
            profileMessage.className = `message ${isSuccess ? 'success' : 'error'}`;
            profileMessage.style.display = 'block';
        }
    }

    if (changeNameForm) {
        changeNameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = displayNameInput.value.trim();

            if (!newName) {
                showProfileMessage('Voer een geldige weergavenaam in.', false);
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

    // Change avatar form submission
    const changeAvatarForm = document.getElementById('changeAvatarForm');
    const avatarMessage = document.getElementById('avatar-message');

    function showAvatarMessage(text, isSuccess) {
        if (avatarMessage) {
            avatarMessage.textContent = text;
            avatarMessage.className = `message ${isSuccess ? 'success' : 'error'}`;
            avatarMessage.style.display = 'block';
        }
    }

    if (changeAvatarForm) {
        changeAvatarForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newAvatarUrl = avatarUrlInput ? avatarUrlInput.value.trim() : '';

            if (!newAvatarUrl) {
                showAvatarMessage('Voer een URL in.', false);
                return;
            }

            showAvatarMessage('Profielfoto bijwerken...', true);

            const { error: updateError } = await supabase.auth.updateUser({
                data: { 
                    avatar_url: newAvatarUrl
                }
            });

            if (updateError) {
                showAvatarMessage(`Fout bij het bijwerken van foto: ${updateError.message}`, false);
            } else {
                showAvatarMessage('Profielfoto succesvol bijgewerkt!', true);
                updateAvatarDisplay(newAvatarUrl);
                if (avatarFileInput) {
                    avatarFileInput.value = ''; // Reset file input
                }
                if (fileUploadText) {
                    fileUploadText.textContent = 'Kies een afbeelding...';
                    fileUploadText.style.color = 'var(--text-muted)';
                }
            }
        });
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
