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

window.checkSpellingAnswer = function(userInput, correctAnswer, options = {}) {
    const {
        skipPunctuation = true,
        allowSlashParts = true,
        ignoreParentheses = true
    } = options;
    
    function normalizeString(str) {
        if (!str) return '';
        let s = str.toLowerCase();
        
        if (skipPunctuation) {
            s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            s = s.replace(/[^a-z0-9\s]/g, "");
        }
        
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    const normalizedInput = normalizeString(userInput);
    let answers = [correctAnswer];

    if (allowSlashParts) {
        let newAnswers = [];
        answers.forEach(ans => {
            const parts = ans.split('/').map(p => p.trim());
            const getSubsets = (array) => {
                return array.reduce(
                    (subsets, value) => subsets.concat(subsets.map(set => [...set, value])),
                    [[]]
                );
            };
            const subsets = getSubsets(parts).filter(set => set.length > 0);
            subsets.forEach(set => {
                newAnswers.push(set.join('/'));
                newAnswers.push(set.join(' / '));
            });
        });
        answers = [...answers, ...newAnswers];
    }

    if (ignoreParentheses) {
        let newAnswers = [];
        answers.forEach(ans => {
            const withParenText = ans.replace(/[()]/g, '');
            newAnswers.push(withParenText);

            const withoutParenText = ans.replace(/\([^)]*\)/g, '');
            newAnswers.push(withoutParenText);
        });
        answers = [...answers, ...newAnswers];
    }

    const normalizedAcceptable = answers.map(ans => normalizeString(ans));
    const uniqueAcceptable = [...new Set(normalizedAcceptable)].filter(Boolean);

    return uniqueAcceptable.includes(normalizedInput);
};