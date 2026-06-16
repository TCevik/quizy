import { auth, signInWithEmailAndPassword, signInWithPopup, googleProvider, onAuthStateChanged } from "../firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = "dashboard.html";
        }
    });

    const loginForm = document.getElementById("loginForm");
    const googleBtn = document.querySelector(".google-btn");
    const errorEl = document.getElementById("error-message");

    function showError(error) {
        console.error("Fout details:", error);
        
        let message = "Er is een onbekende fout opgetreden. Probeer het opnieuw.";
        
        if (error && error.code) {
            switch (error.code) {
                case "auth/invalid-credential":
                case "auth/user-not-found":
                case "auth/wrong-password":
                    message = "Onjuist e-mailadres of wachtwoord.";
                    break;
                case "auth/invalid-email":
                    message = "Voer een geldig e-mailadres in.";
                    break;
                case "auth/too-many-requests":
                    message = "Te veel mislukte inlogpogingen. Probeer het later opnieuw.";
                    break;
                case "auth/user-disabled":
                    message = "Dit account is uitgeschakeld.";
                    break;
                case "auth/popup-closed-by-user":
                    message = "Inloggen met Google is geannuleerd.";
                    break;
            }
        }

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = "block";
        }
    }

    function clearError() {
        if (errorEl) {
            errorEl.style.display = "none";
            errorEl.textContent = "";
        }
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearError();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("Ingelogd:", userCredential.user);
                window.location.href = "dashboard.html";
            } catch (error) {
                showError(error);
            }
        });
    }

    if (googleBtn) {
        googleBtn.addEventListener("click", async () => {
            clearError();
            try {
                const result = await signInWithPopup(auth, googleProvider);
                console.log("Google Ingelogd:", result.user);
                window.location.href = "dashboard.html";
            } catch (error) {
                showError(error);
            }
        });
    }
});
