document.addEventListener('DOMContentLoaded', async () => {

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