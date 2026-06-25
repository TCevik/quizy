import { supabaseReady } from './supabase-init.js';

// Apply premium styles immediately if the flag is stored
export function applyPremiumStyles() {
    if (localStorage.getItem('quizy-is-premium') === 'true') {
        const styleId = 'quizy-premium-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .quizy-ad-box, .quiz-ad-side {
                    display: none !important;
                }
                .quiz-ad-wrapper {
                    display: block !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    gap: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        const removeAds = () => {
            document.querySelectorAll('.quizy-ad-box').forEach(el => el.remove());
            document.querySelectorAll('.quiz-ad-side').forEach(el => el.remove());
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', removeAds);
        } else {
            removeAds();
        }
    }
}

// Check premium status from DB and update UI/storage accordingly
export async function checkPremiumStatus() {
    const supabase = await supabaseReady;
    if (!supabase) return false;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase
                .from('profiles')
                .select('premium')
                .eq('id', user.id)
                .single();

            if (!error && data) {
                const isPremium = !!data.premium;
                if (isPremium) {
                    localStorage.setItem('quizy-is-premium', 'true');
                    applyPremiumStyles();
                    return true;
                }
            }
        }
    } catch (e) {
        console.error('Error checking premium status:', e);
    }
    
    localStorage.removeItem('quizy-is-premium');
    return false;
}

// Initialize styles right away
applyPremiumStyles();
