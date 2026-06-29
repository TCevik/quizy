import { supabaseReady } from './supabase-init.js';

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const initMain = async () => {
    const hasSession = localStorage.getItem('quizy-auth-token') !== null;
    const startBtns = document.querySelectorAll('a[href="login.html"]');

    if (hasSession) {
        startBtns.forEach(btn => {
            btn.href = 'dashboard.html';
        });
    }

    const supabase = await supabaseReady;
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
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMain);
} else {
    initMain();
}


export function speakText(text, langName) {
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
}

export function checkSpellingAnswer(userInput, correctAnswer, options = {}) {
    const {
        skipPunctuation = true,
        allowSlashParts = true,
        ignoreParentheses = true,
        allowTypos = true
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
    const inputWithoutSpaces = normalizedInput.replace(/\s/g, '');
    let answers = [correctAnswer];

    if (allowSlashParts) {
        let newAnswers = [];
        answers.forEach(ans => {
            if (/[\/,;]/.test(ans)) {
                const parts = ans.split(/[\/,;]/).map(p => p.trim());
                newAnswers.push(...parts);
            }
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

    if (uniqueAcceptable.includes(normalizedInput)) {
        return { isCorrect: true, hasTypo: false, correctAlternative: null };
    }

    if (!allowTypos) {
        return { isCorrect: false, hasTypo: false, correctAlternative: null };
    }

    function getDamerauLevenshteinDistance(a, b) {
        const matrix = Array.from({ length: a.length + 1 }, () => []);
        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,       // Deletion
                    matrix[i][j - 1] + 1,       // Insertion
                    matrix[i - 1][j - 1] + cost // Substitution
                );
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    matrix[i][j] = Math.min(
                        matrix[i][j],
                        matrix[i - 2][j - 2] + 1 // Transposition
                    );
                }
            }
        }
        return matrix[a.length][b.length];
    }

    for (const ans of uniqueAcceptable) {
        const ansWithoutSpaces = ans.replace(/\s/g, '');
        const len = ansWithoutSpaces.length;
        let allowedTyposCount = 0;
        if (len >= 5 && len <= 9) {
            allowedTyposCount = 1;
        } else if (len >= 10) {
            allowedTyposCount = 2;
        }
        const dist = getDamerauLevenshteinDistance(inputWithoutSpaces, ansWithoutSpaces);
        if (dist <= allowedTyposCount) {
            return { isCorrect: true, hasTypo: true, correctAlternative: ans };
        }
    }

    return { isCorrect: false, hasTypo: false, correctAlternative: null };
};