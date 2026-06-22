class Toast {
    static init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    static show(message, type = 'info') {
        this.init();
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Trigger reflow to start animation
        toast.offsetHeight;
        toast.classList.add('show');
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => this.close(toast);
        
        setTimeout(() => {
            this.close(toast);
        }, 5000);
    }

    static close(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }
}

// Attach to window so it can be used globally
window.Toast = Toast;
