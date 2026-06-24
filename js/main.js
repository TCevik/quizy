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
            if (ans.includes('/')) {
                const parts = ans.split('/').map(p => p.trim());
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

    return uniqueAcceptable.includes(normalizedInput);
};