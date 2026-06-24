import Toast from './toast.js';

const SUPABASE_URL = 'https://aolruspeudebdwcszele.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-YYXXYECMpEknYu1Om2f4w_eD1KA5nc';

export let supabaseClient = null;

export const supabaseReady = new Promise((resolve, reject) => {
    if (!document.querySelector('script[src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        
        script.onload = () => {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storageKey: 'quizy-auth-token'
                }
            });
            resolve(supabaseClient);
        };
        
        script.onerror = () => {
            Toast.show('Fout bij het laden van de databaseverbinding. Controleer je internetverbinding of adblocker.', 'error');
            reject(new Error('Supabase script kon niet geladen worden.'));
        };
        
        document.head.appendChild(script);
    } else {
        resolve(supabaseClient);
    }
});

export function getFriendlyErrorMessage(error) {
    if (!error) return 'Er is een onbekende fout opgetreden.';
    const message = error.message || String(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('invalid login credentials')) {
        return 'E-mailadres of wachtwoord is onjuist.';
    }
    if (lowerMessage.includes('email not confirmed') || lowerMessage.includes('confirm your email')) {
        return 'Je e-mailadres is nog niet bevestigd. Controleer je inbox.';
    }
    if (lowerMessage.includes('password should be at least 6 characters')) {
        return 'Wachtwoord moet minimaal 6 tekens lang zijn.';
    }
    if (lowerMessage.includes('user already exists') || lowerMessage.includes('already registered')) {
        return 'Dit e-mailadres is al geregistreerd.';
    }
    if (lowerMessage.includes('invalid email structure') || lowerMessage.includes('unable to validate email')) {
        return 'Vul een geldig e-mailadres in.';
    }
    if (lowerMessage.includes('rate limit')) {
        return 'Te veel verzoeken achter elkaar. Probeer het later opnieuw.';
    }
    if (lowerMessage.includes('signup requires a valid password') || lowerMessage.includes('weak password')) {
        return 'Het gekozen wachtwoord is te zwak of voldoet niet aan de eisen.';
    }

    return message;
}