const API_BASE_URL = 'http://localhost:8080/api';
const registerForm = document.getElementById('registerForm');
const registerAlert = document.getElementById('registerAlert');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        registerAlert.innerHTML = `<div class="alert alert-danger">Οι κωδικοί δεν ταιριάζουν. Παρακαλώ προσπαθήστε ξανά!</div>`;
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (response.ok) {
            registerAlert.innerHTML = `<div class="alert alert-success">Η εγγραφή πέτυχε! Μεταφορά στην είσοδο...</div>`;
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            const errorData = await response.json();
            registerAlert.innerHTML = `<div class="alert alert-danger">${errorData.message || 'Αποτυχία εγγραφής'}</div>`;
        }
    } catch (error) {
        console.error('Σφάλμα:', error);
        registerAlert.innerHTML = `<div class="alert alert-danger">Πρόβλημα σύνδεσης με τον server.</div>`;
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
