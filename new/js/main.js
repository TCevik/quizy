document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.createElement('div');
    overlay.classList.add('page-wave-overlay');
    overlay.innerHTML = `
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path fill="var(--bg-dark)" d="M0,60 C320,120 420,0 840,40 C1140,70 1300,10 1440,40 L1440,120 L0,120 Z"></path>
        </svg>
    `;
    document.body.appendChild(overlay);
});

document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="login.html"]');
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