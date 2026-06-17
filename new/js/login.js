document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (email && password.length >= 6) {
                window.location.href = 'dashboard.html';
            } else {
                if (errorMessage) {
                    errorMessage.textContent = 'Vul een geldig e-mailadres in en een wachtwoord van minimaal 6 tekens.';
                    errorMessage.style.display = 'block';
                }
            }
        });
    }
});
