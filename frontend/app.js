const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const API_BASE_URL = 'http://localhost:8080/api';

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('email', email);
            localStorage.setItem('role', data.role);

            window.location.replace(data.role === 'admin' ? 'admin.html' : 'index.html');
        } else {
            alert('Λάθος στοιχεία σύνδεσης!');
        }
    } catch (error) {
        console.error('Σφάλμα δικτύου:', error);
        loginMessage.innerHTML = '<span class="text-danger">Πρόβλημα σύνδεσης με τον server.</span>';
    }
});

// Toggles the little eye icon next to password fields between hidden/visible text
document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        input.type = input.type === 'password' ? 'text' : 'password';
    });
});
