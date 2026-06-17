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
});