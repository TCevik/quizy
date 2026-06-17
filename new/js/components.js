class QuizyHeader extends HTMLElement {
    connectedCallback() {
        const isLogin = this.hasAttribute('login-page');
        this.innerHTML = `
            <a href="index.html" class="logo">Quizy</a>
            <nav class="header-items">
                ${isLogin 
                    ? `<a class="btn-gradient" href="index.html">Terug</a>` 
                    : `<a class="btn-gradient" href="login.html">Inloggen op Quizy</a>`
                }
            </nav>
        `;
    }
}

class QuizyFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div class="footer-container">
                <div class="footer-left">
                    <span class="footer-brand">Quizy</span>
                    <span class="footer-credit">Gemaakt door Tamer Çevik</span>
                </div>
                <div class="footer-right">
                    <a href="https://docs.google.com/forms/d/e/1FAIpQLSenU2OuAafpBvayn0mgszuJmPA7dDdeHLP5ou0xpljfj0yRcg/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer">Report Bug</a>
                    <a href="https://tctam.nl/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                    <a href="https://tctam.nl/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                </div>
            </div>
        `;
    }
}

customElements.define('quizy-header', QuizyHeader);
customElements.define('quizy-footer', QuizyFooter);
