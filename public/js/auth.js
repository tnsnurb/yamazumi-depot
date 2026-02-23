// Auth JS
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    fetch('/api/me')
        .then(r => r.json())
        .then(data => {
            if (data.authenticated) {
                window.location.href = '/map.html';
            }
        });

    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('loginError');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.style.display = 'none';

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                window.location.href = '/map.html';
            } else {
                errorEl.textContent = data.error || 'Ошибка авторизации';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Ошибка подключения к серверу';
            errorEl.style.display = 'block';
        }
    });
});
