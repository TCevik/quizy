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

    // Display user's email
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl) {
        userEmailEl.textContent = user.email;
    }
});
