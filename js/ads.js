const checkSubscription = () => {
    const cachedSub = localStorage.getItem('quizy-subscription');
    const hasSession = localStorage.getItem('quizy-auth-token') !== null;
    return hasSession && cachedSub && cachedSub !== 'none';
};

const removeAds = () => {
    const containers = document.querySelectorAll('.quizy-ad-container');
    containers.forEach(container => {
        container.style.display = 'none';
    });
};

const initializeAds = () => {
    if (checkSubscription()) {
        removeAds();
        return;
    }

    const containers = document.querySelectorAll('.quizy-ad-container');
    if (containers.length === 0) return;

    if (!document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8924607946192862';
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    }

    containers.forEach(container => {
        if (container.querySelector('ins.adsbygoogle')) return;

        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', 'ca-pub-8924607946192862');

        const adType = container.getAttribute('data-ad-type');
        if (adType === 'display') {
            ins.setAttribute('data-ad-slot', '5862330293');
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
        } else if (adType === 'feed') {
            ins.setAttribute('data-ad-slot', '8058343678');
            ins.setAttribute('data-ad-format', 'fluid');
            ins.setAttribute('data-ad-layout-key', '-fb+5w+4e-db+86');
        } else if (adType === 'article') {
            ins.setAttribute('data-ad-slot', '5571781132');
            ins.setAttribute('data-ad-format', 'fluid');
            ins.setAttribute('data-ad-layout', 'in-article');
            ins.style.textAlign = 'center';
        } else if (adType === 'multiplex') {
            ins.setAttribute('data-ad-slot', '8087529182');
            ins.setAttribute('data-ad-format', 'autorelaxed');
        } else {
            ins.setAttribute('data-ad-slot', '5862330293');
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
        }

        container.appendChild(ins);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error(e);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initializeAds();
    
    const observer = new MutationObserver(() => {
        if (checkSubscription()) {
            removeAds();
        } else {
            initializeAds();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.addEventListener('storage', () => {
        if (checkSubscription()) {
            removeAds();
        } else {
            initializeAds();
        }
    });
});

window.refreshQuizyAds = initializeAds;
