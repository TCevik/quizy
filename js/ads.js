import { supabaseReady } from './supabase-init.js';

async function checkPremiumStatus() {
    // Check session cache first
    const cachedPremium = sessionStorage.getItem('quizy_is_premium');
    if (cachedPremium !== null) {
        return cachedPremium === 'true';
    }

    const hasSession = localStorage.getItem('quizy-auth-token') !== null;
    if (!hasSession) return false;

    try {
        const supabase = await supabaseReady;
        if (!supabase) return false;

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return false;

        const { data, error } = await supabase
            .from('profiles')
            .select('premium')
            .eq('id', user.id)
            .single();

        if (error || !data) {
            return false;
        }

        const isPremium = !!data.premium;
        sessionStorage.setItem('quizy_is_premium', String(isPremium));
        return isPremium;
    } catch (err) {
        console.error('Error checking premium status:', err);
        return false;
    }
}

function injectAds() {
    // 1. Dynamically load Google AdSense script
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8924607946192862';
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    // 2. Inject sidebar ad containers
    const leftAd = document.createElement('div');
    leftAd.className = 'quizy-ad-sidebar-left';
    leftAd.innerHTML = `
        <div class="quizy-ad-label">ADVERTENTIE</div>
        <div class="quizy-ad-content">
            <span class="material-symbols-rounded quizy-ad-icon">workspace_premium</span>
            <div class="quizy-ad-title">Quizy Premium</div>
            <p class="quizy-ad-desc">Upgrade naar Premium voor advertentievrij leren en onbeperkte sets!</p>
            <a href="profile.html" class="btn-gradient quizy-ad-btn">Upgrade</a>
        </div>
        <ins class="adsbygoogle"
             style="display:block;width:100%;height:100%"
             data-ad-client="ca-pub-8924607946192862"
             data-ad-slot="sidebar-left"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
    `;

    const rightAd = document.createElement('div');
    rightAd.className = 'quizy-ad-sidebar-right';
    rightAd.innerHTML = `
        <div class="quizy-ad-label">ADVERTENTIE</div>
        <div class="quizy-ad-content">
            <span class="material-symbols-rounded quizy-ad-icon">workspace_premium</span>
            <div class="quizy-ad-title">Quizy Premium</div>
            <p class="quizy-ad-desc">Upgrade naar Premium voor advertentievrij leren en onbeperkte sets!</p>
            <a href="profile.html" class="btn-gradient quizy-ad-btn">Upgrade</a>
        </div>
        <ins class="adsbygoogle"
             style="display:block;width:100%;height:100%"
             data-ad-client="ca-pub-8924607946192862"
             data-ad-slot="sidebar-right"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
    `;

    document.body.appendChild(leftAd);
    document.body.appendChild(rightAd);

    // Initialize AdSense push for these blocks
    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
        // Silently fail if AdBlocker blocks it
    }
}

async function initAds() {
    const isPremium = await checkPremiumStatus();
    if (!isPremium) {
        injectAds();
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
} else {
    initAds();
}
