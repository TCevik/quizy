document.addEventListener('DOMContentLoaded', async () => {
    const overlay = document.createElement('div');
    overlay.classList.add('page-wave-overlay');
    overlay.innerHTML = `
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path fill="var(--bg-dark)" d="M0,60 C320,120 420,0 840,40 C1140,70 1300,10 1440,40 L1440,120 L0,120 Z"></path>
        </svg>
    `;
    document.body.appendChild(overlay);

    const hasSession = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    const startBtns = document.querySelectorAll('a[href="login.html"]');

    if (hasSession) {
        startBtns.forEach(btn => {
            btn.href = 'dashboard.html';
        });
    }

    const supabase = await window.supabaseReady;
    if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
            startBtns.forEach(btn => {
                btn.href = 'dashboard.html';
            });
        } else {
            startBtns.forEach(btn => {
                btn.href = 'login.html';
            });
        }
    }
});

document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="login.html"], a[href="dashboard.html"], a[href="profile.html"]');
    if (link) {
        e.preventDefault();
        const targetUrl = link.href;
        const overlay = document.querySelector('.page-wave-overlay');
        if (overlay) {
            overlay.classList.add('wave-down');
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 750);
        } else {
            window.location.href = targetUrl;
        }
    }
});

window.speakText = function(text, langName) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = {
        'Nederlands': 'nl-NL',
        'Engels': 'en-US',
        'Frans': 'fr-FR',
        'Duits': 'de-DE',
        'Spaans': 'es-ES'
    };
    const langCode = langMap[langName] || langName || '';
    if (langCode) {
        utterance.lang = langCode;
    }
    window.speechSynthesis.speak(utterance);
};