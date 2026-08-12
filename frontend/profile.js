document.addEventListener('DOMContentLoaded', () => {
    const loggedInEmail = localStorage.getItem('email');
    if (!loggedInEmail || loggedInEmail === 'null') {
        window.location.replace('login.html');
        return;
    }

    // Profile data is keyed per email so switching accounts on the same browser
    // doesn't show one user's saved address/phone to another.
    const profileKey = `profile_${loggedInEmail}`;
    let userProfile = JSON.parse(localStorage.getItem(profileKey));

    if (!userProfile) {
        userProfile = { name: "", email: loggedInEmail, address: "", city: "", zip: "", phone: "" };
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
    }

    document.getElementById('displayName').innerText = userProfile.name || "Χρήστης";
    document.getElementById('displayEmail').innerText = userProfile.email || loggedInEmail;

    if (document.getElementById('profileName')) document.getElementById('profileName').value = userProfile.name || "";
    if (document.getElementById('profileEmail')) document.getElementById('profileEmail').value = userProfile.email || loggedInEmail;
    if (document.getElementById('profileAddress')) document.getElementById('profileAddress').value = userProfile.address || "";
    if (document.getElementById('profileCity')) document.getElementById('profileCity').value = userProfile.city || "";
    if (document.getElementById('profileZip')) document.getElementById('profileZip').value = userProfile.zip || "";
    if (document.getElementById('profilePhone')) document.getElementById('profilePhone').value = userProfile.phone || "";

    const savedCart = JSON.parse(localStorage.getItem('cart')) || [];
    let totalItems = 0;
    savedCart.forEach(item => totalItems += item.quantity);
    document.querySelectorAll('.cart-count-badge').forEach(el => el.innerText = totalItems);

    const savedWishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    document.querySelectorAll('.wishlist-count-badge').forEach(el => el.innerText = savedWishlist.length);

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const updatedProfile = {
                name: document.getElementById('profileName').value,
                email: document.getElementById('profileEmail').value,
                address: document.getElementById('profileAddress').value,
                city: document.getElementById('profileCity').value,
                zip: document.getElementById('profileZip').value,
                phone: document.getElementById('profilePhone').value
            };

            localStorage.setItem(profileKey, JSON.stringify(updatedProfile));
            // Also keep the generic 'userProfile' key in sync - checkout reads from
            // that one to prefill the shipping form, regardless of which user it is.
            localStorage.setItem('userProfile', JSON.stringify(updatedProfile));

            document.getElementById('displayName').innerText = updatedProfile.name || "Χρήστης";

            Swal.fire({
                icon: 'success',
                title: 'Αποθηκεύτηκαν!',
                text: 'Τα στοιχεία του προφίλ σας ενημερώθηκαν επιτυχώς.',
                confirmButtonColor: '#0d6efd'
            });
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            Swal.fire({
                title: 'Αποσύνδεση',
                text: "Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε;",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Ναι, Αποσύνδεση',
                cancelButtonText: 'Ακύρωση'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Only clear the session, not the saved profile - it's still
                    // there next time this email logs back in.
                    localStorage.removeItem('token');
                    localStorage.removeItem('email');
                    localStorage.removeItem('role');
                    localStorage.removeItem('userProfile');
                    localStorage.removeItem('cart');
                    window.location.href = 'index.html';
                }
            });
        });
    }
});
