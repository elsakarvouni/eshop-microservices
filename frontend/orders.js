const API_BASE_URL = 'http://localhost:8080/api';
const ordersTableBody = document.getElementById('ordersTableBody');
const logoutBtn = document.getElementById('logoutBtn');

const token = localStorage.getItem('token');
const userEmail = localStorage.getItem('email');

if (!token || !userEmail || token === 'null' || token === 'undefined' || token === '') {
    alert('Παρακαλώ συνδεθείτε για να δείτε τις παραγγελίες σας.');
    window.location.replace('login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const navNotifications = document.getElementById('navNotifications');
    const navGuest = document.getElementById('navGuest');
    const navUser = document.getElementById('navUser');

    if (navNotifications) navNotifications.classList.remove('d-none');
    if (navGuest) navGuest.classList.add('d-none');
    if (navUser) navUser.classList.remove('d-none');

    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    document.querySelectorAll('.wishlist-count-badge').forEach(el => el.innerText = wishlist.length);

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    let totalItems = 0;
    cart.forEach(item => totalItems += item.quantity);
    document.querySelectorAll('.cart-count-badge').forEach(el => el.innerText = totalItems);
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('email');
        localStorage.removeItem('role');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('cart');
        window.location.href = 'index.html';
    });
}

async function fetchOrders() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/user/${userEmail}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token'); 
            localStorage.removeItem('email');
            alert('Η συνεδρία σας έληξε, παρακαλώ συνδεθείτε ξανά.'); 
            window.location.replace('login.html'); 
            return; 
        }

        if (!response.ok) throw new Error('Αποτυχία φόρτωσης παραγγελιών');

        const responseData = await response.json();
        let ordersArray = [];

        if (Array.isArray(responseData)) {
            ordersArray = responseData; 
        } else if (responseData.orders && Array.isArray(responseData.orders)) {
            ordersArray = responseData.orders; 
        } else if (responseData.data && Array.isArray(responseData.data)) {
            ordersArray = responseData.data; 
        }

        ordersArray.reverse(); 
        renderOrders(ordersArray);
        checkOrderNotifications(ordersArray);
        
    } catch (error) {
        console.error('Σφάλμα:', error);
        ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Πρόβλημα φόρτωσης παραγγελιών.</td></tr>`;
    }
}

function renderOrders(orders) {
    ordersTableBody.innerHTML = '';

    if (orders.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Δεν έχετε πραγματοποιήσει καμία παραγγελία ακόμα.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const fullOrderId = order._id || order.id || '';
        const orderId = fullOrderId.toString().substring(0, 8); 
        const status = (order.status || 'PENDING').toUpperCase();
        
        const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
        const date = dateObj.toLocaleDateString('el-GR') + ' ' + dateObj.toLocaleTimeString('el-GR', {hour: '2-digit', minute:'2-digit'});

        let productNames = [];
        let totalQuantity = 0;

        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                productNames.push(item.name || 'Άγνωστο Προϊόν');
                totalQuantity += item.quantity || 1;
            });
        }
        
        const productNamesString = productNames.length > 0 ? productNames.join(', ') : 'Μη διαθέσιμο';

        let statusBadge = '';
        switch(status) {
            case 'COMPLETED':
            case 'DELIVERED':
                statusBadge = `<span class="badge bg-success">${status}</span>`;
                break;
            case 'SHIPPED':
                statusBadge = `<span class="badge bg-info text-dark">${status}</span>`;
                break;
            case 'CANCELLED':
            case 'FAILED':
                statusBadge = `<span class="badge bg-danger">${status}</span>`;
                break;
            case 'PENDING':
            default:
                statusBadge = `<span class="badge bg-warning text-dark">${status}</span>`;
                break;
        }

        let actionButton = '-';
        if (status === 'PENDING') {
            actionButton = `<button class="btn btn-sm btn-outline-danger" onclick="cancelOrder('${fullOrderId}')">Ακύρωση</button>`;
        }

        const row = `
            <tr>
                <td class="text-muted fw-bold">#${orderId}...</td>
                <td class="fw-bold text-primary">${productNamesString}</td>
                <td class="text-center">${totalQuantity}</td>
                <td>${statusBadge}</td>
                <td class="small">${date}</td>
                <td class="text-center">${actionButton}</td>
            </tr>
        `;
        ordersTableBody.innerHTML += row;
    });
}

window.cancelOrder = async function(orderId) {
    if (!confirm('Είστε σίγουροι ότι θέλετε να ακυρώσετε αυτή την παραγγελία;')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status: 'CANCELLED' })
        });

        if (response.ok) {
            alert('Η παραγγελία σας ακυρώθηκε επιτυχώς.');
            fetchOrders(); 
        } else {
            alert('Αποτυχία ακύρωσης.');
        }
    } catch (error) {
        console.error('Σφάλμα:', error);
    }
};

window.markNotificationAsRead = function(orderId, status) {
    let readNotifs = JSON.parse(localStorage.getItem('readNotifications')) || [];
    const key = `${orderId}_${status}`;
    if (!readNotifs.includes(key)) {
        readNotifs.push(key);
        localStorage.setItem('readNotifications', JSON.stringify(readNotifs));
    }
};

async function checkOrderNotifications(orders) {
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationsList');
    if (!badge || !list) return;

    const reviewedProducts = JSON.parse(localStorage.getItem('reviewedProducts')) || [];
    const readNotifs = JSON.parse(localStorage.getItem('readNotifications')) || [];
    let notifications = [];

    orders.forEach(order => {
        const status = (order.status || '').trim().toUpperCase();
        const orderId = (order._id || order.id || '---').toString().substring(0, 8);
        const statusKey = `${orderId}_${status}`;

        if (status === 'PENDING' && !readNotifs.includes(statusKey)) {
            notifications.push({ type: 'info', orderId, status, title: 'Η παραγγελία καταχωρήθηκε!', desc: `Η παραγγελία #${orderId} είναι σε αναμονή.`, icon: 'bi-hourglass-split text-primary' });
        } else if (status === 'SHIPPED' && !readNotifs.includes(statusKey)) {
            notifications.push({ type: 'info', orderId, status, title: 'Η παραγγελία εστάλη!', desc: `Η παραγγελία #${orderId} βρίσκεται καθ' οδόν!`, icon: 'bi-truck text-success' });
        } else if (status === 'CANCELLED' && !readNotifs.includes(statusKey)) {
            notifications.push({ type: 'info', orderId, status, title: 'Ακύρωση Παραγγελίας', desc: `Η παραγγελία #${orderId} έχει ακυρωθεί.`, icon: 'bi-x-circle text-danger' });
        }

        if (status === 'COMPLETED' || status === 'DELIVERED') {
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    // Order line items can come from a couple of different shapes depending
                    // on which page created them, so we just check every field name we've seen.
                    const productId = item.productId || item.id || item._id || item.product || item.productID;
                    const productName = item.name || item.productName || 'Προϊόν';

                    if (productId) {
                        const stringId = productId.toString();
                        if (!reviewedProducts.includes(stringId)) {
                            if (!notifications.some(n => n.type === 'review' && n.productId === stringId)) {
                                notifications.push({ type: 'review', productId: stringId, productName, title: 'Εκκρεμεί Αξιολόγηση', desc: productName, icon: 'bi-star-fill text-warning' });
                            }
                        }
                    }
                });
            }
        }
    });

    if (notifications.length > 0) {
        badge.innerText = notifications.length;
        badge.style.display = 'inline-block';

        let htmlContent = `<li><h6 class="dropdown-header text-dark fw-bold">Ειδοποιήσεις (${notifications.length})</h6></li><li><hr class="dropdown-divider"></li>`;

        notifications.reverse().forEach(notif => {
            if (notif.type === 'review') {
                const safeName = notif.productName.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                htmlContent += `
                    <li class="px-2 mb-2">
                        <a class="dropdown-item py-2 px-3 bg-light rounded text-wrap shadow-sm border" href="#" onclick="openReviewModal('${notif.productId}', '${safeName}')">
                            <div class="d-flex align-items-center">
                                <i class="bi ${notif.icon} fs-4 me-2 flex-shrink-0"></i>
                                <div>
                                    <small class="text-dark d-block fw-bold">${notif.title}</small>
                                    <span class="text-muted small">${notif.desc}</span>
                                </div>
                            </div>
                        </a>
                    </li>
                `;
            } else {
                htmlContent += `
                    <li class="px-2 mb-2">
                        <a href="orders.html" onclick="markNotificationAsRead('${notif.orderId}', '${notif.status}')" class="dropdown-item py-2 px-3 bg-light rounded text-wrap shadow-sm border">
                            <div class="d-flex align-items-center">
                                <i class="bi ${notif.icon} fs-4 me-2 flex-shrink-0"></i>
                                <div>
                                    <small class="text-dark d-block fw-bold">${notif.title}</small>
                                    <span class="text-muted small">${notif.desc}</span>
                                </div>
                            </div>
                        </a>
                    </li>
                `;
            }
        });
        list.innerHTML = htmlContent;
    } else {
        badge.style.display = 'none';
        list.innerHTML = `
            <li><h6 class="dropdown-header">Ειδοποιήσεις Παραγγελιών</h6></li>
            <li><hr class="dropdown-divider"></li>
            <li><span class="dropdown-item text-muted small text-center py-2">Δεν υπάρχουν νέες ειδοποιήσεις.</span></li>
        `;
    }
}
let activeReviewProductId = null;

window.openReviewModal = function(productId, productName) {
    activeReviewProductId = productId;
    document.getElementById('reviewModalLabel').innerText = `Αξιολόγηση Προϊόντος`;
    document.getElementById('reviewProductName').innerText = productName;
    document.getElementById('reviewCommentText').value = '';
    setRatingStars(5);

    const modalElement = document.getElementById('reviewModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const starContainer = document.getElementById('starContainer');
    if (starContainer) {
        const stars = starContainer.querySelectorAll('i');
        stars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-value'));
                setRatingStars(rating);
            });
        });
    }

    const submitBtn = document.getElementById('submitReviewBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const rating = parseInt(document.getElementById('selectedRatingValue').value);
            const comment = document.getElementById('reviewCommentText').value;
            submitReview(activeReviewProductId, rating, comment);
        });
    }
});

function setRatingStars(rating) {
    document.getElementById('selectedRatingValue').value = rating;
    const stars = document.querySelectorAll('#starContainer i');
    
    stars.forEach(star => {
        const val = parseInt(star.getAttribute('data-value'));
        if (val <= rating) {
            star.classList.remove('bi-star');
            star.classList.add('bi-star-fill');
        } else {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
        }
    });
}

// Reviews live entirely in localStorage - there's no reviews service on the backend,
// so these are only visible on the device/browser that wrote them.
window.submitReview = async function(productId, rating, comment) {
    if (!productId) return;


    const userProfile = JSON.parse(localStorage.getItem('userProfile')) || {};
    const userName = userProfile.name || (userEmail ? userEmail.split('@')[0] : 'Χρήστης');

    const reviewData = {
        productId,
        userEmail,
        userName,
        rating,
        comment,
        createdAt: new Date().toISOString()
    };

    try {
        let allReviews = JSON.parse(localStorage.getItem('productReviews')) || [];
        allReviews.push(reviewData);
        localStorage.setItem('productReviews', JSON.stringify(allReviews));

        let reviewedProducts = JSON.parse(localStorage.getItem('reviewedProducts')) || [];
        if (!reviewedProducts.includes(productId)) {
            reviewedProducts.push(productId);
            localStorage.setItem('reviewedProducts', JSON.stringify(reviewedProducts));
        }

        alert('Η αξιολόγησή σας καταχωρήθηκε επιτυχώς! Ευχαριστούμε.');
        
        const modalElement = document.getElementById('reviewModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
        
        location.reload();

    } catch (e) {
        console.error('Review error:', e);
        alert('Σφάλμα κατά την αποθήκευση.');
    }
};

fetchOrders();