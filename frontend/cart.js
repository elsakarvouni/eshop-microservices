const API_BASE_URL = 'http://localhost:8080/api';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
const currentUserEmail = localStorage.getItem('email') || 'Επισκέπτης (Χωρίς Σύνδεση)';
let currentPromo = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    const navWishlist = document.getElementById('navWishlist');
    const navNotifications = document.getElementById('navNotifications');
    const navGuest = document.getElementById('navGuest');
    const navUser = document.getElementById('navUser');
    const logoutBtn = document.getElementById('logoutBtn');
    const profileIcon = document.querySelector('a[href="profile.html"]');

    if (token && token !== 'null' && token !== 'undefined' && token !== '') {
        if (navWishlist) navWishlist.classList.remove('d-none');
        if (navNotifications) navNotifications.classList.remove('d-none'); 
        if (navGuest) navGuest.classList.add('d-none');
        if (navUser) navUser.classList.remove('d-none');
        if (logoutBtn && !navUser) logoutBtn.classList.remove('d-none');
        if (profileIcon && !navUser) profileIcon.classList.remove('d-none');
        
        if (logoutBtn) {
            logoutBtn.onclick = function() {
                localStorage.removeItem('token');
                localStorage.removeItem('email');
                localStorage.removeItem('role');
                localStorage.removeItem('userProfile');
                localStorage.removeItem('cart');
                window.location.href = 'index.html';
            };
        }
    } else {
        if (navNotifications) navNotifications.classList.add('d-none');
        if (navGuest) navGuest.classList.remove('d-none');
        if (navUser) navUser.classList.add('d-none');
        if (logoutBtn) logoutBtn.classList.add('d-none');
        if (profileIcon && !navUser) profileIcon.classList.add('d-none');
    }

    // Prefills the shipping form from whatever address/phone the user already saved
    // on their profile, so they don't have to retype it on every order.
    const loggedInEmail = localStorage.getItem('email');
    let userProfile = null;

    if (loggedInEmail) {
        userProfile = JSON.parse(localStorage.getItem(`profile_${loggedInEmail}`));
    }
    if (!userProfile) {
        userProfile = JSON.parse(localStorage.getItem('userProfile'));
    }

    if (userProfile) {
        const addressInput = document.getElementById('addressInput');
        const phoneInput = document.getElementById('phoneInput');
        
        if (addressInput) {
            let fullAddress = userProfile.address || "";
            if(userProfile.city) fullAddress += (fullAddress ? ", " : "") + userProfile.city;
            if(userProfile.zip) fullAddress += (fullAddress ? ", " : "") + userProfile.zip;
            if (fullAddress.trim() !== "") {
                addressInput.value = fullAddress;
            }
        }
        if (phoneInput && userProfile.phone) {
            phoneInput.value = userProfile.phone;
        }
    }
    
    renderCart();
    updateWishlistBadgeInCart();

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken || currentToken === 'null' || currentToken === 'undefined' || currentToken === '') {
                showAlert('Πρέπει να συνδεθείτε για να ολοκληρώσετε την αγορά. Θα μεταφερθείτε στη σελίδα σύνδεσης...', 'warning');
                setTimeout(() => { window.location.href = 'login.html'; }, 3000);
                return;
            }

            const addressInput = document.getElementById('addressInput');
            const phoneInput = document.getElementById('phoneInput');
            const address = addressInput ? addressInput.value.trim() : '';
            const phone = phoneInput ? phoneInput.value.trim() : '';

            if (!address || !phone) {
                showAlert('Παρακαλώ συμπληρώστε τη Διεύθυνση Αποστολής και το Τηλέφωνό σας.', 'warning');
                return; 
            }

            const isCardSelected = document.getElementById('payCard') && document.getElementById('payCard').checked;
            if (isCardSelected) {
                const cardName = document.getElementById('cardName') ? document.getElementById('cardName').value.trim() : '';
                const cardNumber = document.getElementById('cardNumber') ? document.getElementById('cardNumber').value.trim() : '';
                const cardExpiry = document.getElementById('cardExpiry') ? document.getElementById('cardExpiry').value.trim() : '';
                const cardCvv = document.getElementById('cardCvv') ? document.getElementById('cardCvv').value.trim() : '';

                if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
                    showAlert('Παρακαλώ συμπληρώστε όλα τα στοιχεία της κάρτας σας για να προχωρήσετε.', 'danger');
                    return;
                }
            }

            checkoutBtn.disabled = true;
            checkoutBtn.innerText = 'Γίνεται επεξεργασία...';

            try {
                let itemsTotalPrice = 0; 
                const itemsForBackend = cart.map(item => {
                    itemsTotalPrice += (item.price * item.quantity);
                    return {
                        productId: item.productId || item.id || item._id,
                        variantId: item.variantId || null,
                        variantLabel: item.variantLabel || null,
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price
                    };
                });

                let finalShippingCost = (itemsTotalPrice >= 100) ? 0 : 2.50;

                let finalDiscount = 0;
                if (currentPromo) {
                    finalDiscount = itemsTotalPrice * (currentPromo.discount / 100);
                }

                let finalOrderPrice = itemsTotalPrice - finalDiscount + finalShippingCost;
                if (finalOrderPrice < 0) finalOrderPrice = 0; // a discount code shouldn't be able to push the total negative

                const orderData = {
                    userEmail: currentUserEmail, 
                    items: itemsForBackend,
                    totalPrice: finalOrderPrice,
                    address: address, 
                    phone: phone      
                };

                const response = await fetch(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                });

                if (response.ok) {
                    localStorage.removeItem('cart');
                    cart = [];
                    currentPromo = null;
                    renderCart();
                    
                    if (addressInput) addressInput.value = '';
                    if (phoneInput) phoneInput.value = '';
                    
                    if (document.getElementById('cardName')) document.getElementById('cardName').value = '';
                    if (document.getElementById('cardNumber')) document.getElementById('cardNumber').value = '';
                    if (document.getElementById('cardExpiry')) document.getElementById('cardExpiry').value = '';
                    if (document.getElementById('cardCvv')) document.getElementById('cardCvv').value = '';

                    showAlert('Η παραγγελία σας ολοκληρώθηκε με επιτυχία! Μπορείτε να τη δείτε στις "Παραγγελίες μου".', 'success');
                    checkoutBtn.innerText = 'Ολοκληρώθηκε!';
                    
                } else if (response.status === 401) {
                    localStorage.removeItem('token');
                    alert('Η συνεδρία σας έληξε, παρακαλώ συνδεθείτε ξανά.');
                    window.location.replace('login.html');
                } else {
                    throw new Error('Η παραγγελία απορρίφθηκε από το backend.');
                }

            } catch (error) {
                console.error('Σφάλμα Checkout:', error);
                showAlert('Υπήρξε πρόβλημα με την παραγγελία. Παρακαλώ δοκιμάστε ξανά.', 'danger');
                checkoutBtn.disabled = false;
                checkoutBtn.innerText = 'Ολοκλήρωση Αγοράς';
            }
        });
    }
}); 

function renderCart() {
    const cartTableBody = document.getElementById('cartTableBody');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const freeShippingMessage = document.getElementById('freeShippingMessage');
    
    if(!cartTableBody) return;
    
    cartTableBody.innerHTML = '';
    let itemsTotal = 0; 
    let totalItems = 0;

    if (cart.length === 0) {
        cartTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Το καλάθι σας είναι άδειο.</td></tr>';
        document.getElementById('cartSubtotal').innerText = '€0.00';
        document.getElementById('shippingCost').innerText = '€0.00';
        document.getElementById('cartTotal').innerText = '€0.00';
        
        if(freeShippingMessage) freeShippingMessage.innerHTML = '';
        document.querySelectorAll('.cart-count-badge').forEach(el => el.innerText = '0');
        if(checkoutBtn) checkoutBtn.disabled = true;

        if(document.getElementById('discountRow')) document.getElementById('discountRow').classList.add('d-none');
        if(document.getElementById('removePromoRow')) document.getElementById('removePromoRow').classList.add('d-none');
        return;
    }

    if(checkoutBtn) checkoutBtn.disabled = false;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        itemsTotal += itemTotal;
        totalItems += item.quantity;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>€${item.price.toFixed(2)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <button class="btn btn-sm btn-secondary" onclick="updateQuantity(${index}, -1)">-</button>
                    <span class="mx-2 fw-bold">${item.quantity}</span>
                    <button class="btn btn-sm btn-secondary" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            </td>
            <td><strong>€${itemTotal.toFixed(2)}</strong></td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${index})">Διαγραφή</button>
            </td>
        `;
        cartTableBody.appendChild(tr);
    });

    let shippingCost = 0;
    const freeShippingThreshold = 100;

    if (itemsTotal >= freeShippingThreshold) {
        shippingCost = 0;
        document.getElementById('shippingCost').innerHTML = '<span class="text-success">Δωρεάν</span>';
        if(freeShippingMessage) freeShippingMessage.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Έχετε δωρεάν μεταφορικά!</span>';
    } else {
        shippingCost = 2.50;
        document.getElementById('shippingCost').innerText = `€${shippingCost.toFixed(2)}`;
        let difference = freeShippingThreshold - itemsTotal;
        if(freeShippingMessage) freeShippingMessage.innerHTML = `Προσθέστε άλλα <strong>€${difference.toFixed(2)}</strong> για δωρεάν μεταφορικά!`;
    }

    let discountValue = 0;
    const discountRow = document.getElementById('discountRow');
    const removePromoRow = document.getElementById('removePromoRow');
    const discountLabel = document.getElementById('discountLabel');
    const discountAmount = document.getElementById('discountAmount');

    if (currentPromo) {
        discountValue = itemsTotal * (currentPromo.discount / 100);
        if(discountRow && removePromoRow) {
            discountRow.classList.remove('d-none');
            removePromoRow.classList.remove('d-none');
            discountLabel.innerText = `(${currentPromo.code} -${currentPromo.discount}%)`;
            discountAmount.innerText = `-€${discountValue.toFixed(2)}`;
        }
    } else {
        if(discountRow && removePromoRow) {
            discountRow.classList.add('d-none');
            removePromoRow.classList.add('d-none');
        }
    }

    let grandTotal = itemsTotal - discountValue + shippingCost;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('cartSubtotal').innerText = `€${itemsTotal.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `€${grandTotal.toFixed(2)}`;
    document.querySelectorAll('.cart-count-badge').forEach(el => el.innerText = totalItems);
}

// Promo codes are stored in localStorage rather than the backend, so a code the
// admin creates only works in that same browser - fine for a demo, not for production.
window.applyPromoCode = function() {
    const input = document.getElementById('promoInput');
    if(!input) return;
    
    const code = input.value.trim().toUpperCase();
    if(!code) {
        showAlert('Παρακαλώ εισάγετε έναν κωδικό έκπτωσης.', 'warning');
        return;
    }
    
    if (currentPromo) {
        showAlert('Έχετε ήδη εφαρμόσει ένα κουπόνι. Αφαιρέστε το πρώτα για να βάλετε νέο.', 'warning');
        return;
    }

    const storedPromos = JSON.parse(localStorage.getItem('promoCodes')) || [];
    const foundPromo = storedPromos.find(p => p.code === code);
    
    if(foundPromo) {
        currentPromo = foundPromo;
        input.value = '';
        renderCart();
        showAlert(`Το κουπόνι ${code} εφαρμόστηκε με επιτυχία!`, 'success');
    } else {
        showAlert('Ο κωδικός δεν είναι έγκυρος.', 'danger');
    }
};

window.removePromoCode = function() {
    currentPromo = null;
    renderCart();
    showAlert('Το κουπόνι αφαιρέθηκε.', 'info');
};

window.removeFromCart = function(index) {
    cart.splice(index, 1); 
    localStorage.setItem('cart', JSON.stringify(cart)); 
    renderCart(); 
};

window.updateQuantity = function(index, change) {
    if (cart[index].quantity === 1 && change === -1) return;
    cart[index].quantity += change; 
    localStorage.setItem('cart', JSON.stringify(cart)); 
    renderCart(); 
};

function updateWishlistBadgeInCart() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

    const token = localStorage.getItem('token');
    if (token && currentUserEmail !== 'Επισκέπτης (Χωρίς Σύνδεση)') {
        fetchAllPagesOrders(currentUserEmail, token);
    }

    document.querySelectorAll('.wishlist-count-badge').forEach(el => el.innerText = wishlist.length);
}

function showAlert(message, type) {
    const alertMessage = document.getElementById('alertMessage');
    if(alertMessage) {
        alertMessage.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
    }
}

async function fetchAllPagesOrders(email, token) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/user/${email}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) return;
        const responseData = await response.json();
        let ordersArray = Array.isArray(responseData) ? responseData : (responseData.orders || responseData.data || []);
        checkGlobalNotifications(ordersArray);
    } catch (e) {
        console.error('Error fetching orders:', e);
    }
}

window.markNotificationAsRead = function(orderId, status) {
    let readNotifs = JSON.parse(localStorage.getItem('readNotifications')) || [];
    const key = `${orderId}_${status}`;
    if (!readNotifs.includes(key)) {
        readNotifs.push(key);
        localStorage.setItem('readNotifications', JSON.stringify(readNotifs));
    }
};

function checkGlobalNotifications(orders) {
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
        }
        else if (status === 'SHIPPED' && !readNotifs.includes(statusKey)) {
            notifications.push({ type: 'info', orderId, status, title: 'Η παραγγελία εστάλη!', desc: `Η παραγγελία #${orderId} βρίσκεται καθ' οδόν!`, icon: 'bi-truck text-success' });
        }
        else if (status === 'CANCELLED' && !readNotifs.includes(statusKey)) {
            notifications.push({ type: 'info', orderId, status, title: 'Ακύρωση Παραγγελίας', desc: `Η παραγγελία #${orderId} έχει ακυρωθεί.`, icon: 'bi-x-circle text-danger' });
        }
        
        if (status === 'COMPLETED' || status === 'DELIVERED') {
            if (order.items && order.items.length > 0) {
                order.items.forEach(item => {
                    const productId = item.productId || item.id || item._id || item.product;
                    const productName = item.name || item.productName || 'Προϊόν';
                    
                    if (productId) {
                        const stringId = productId.toString();
                        if (!reviewedProducts.includes(stringId)) {
                            if (!notifications.some(n => n.type === 'review' && n.productId === stringId)) {
                                notifications.push({ type: 'review', productId: stringId, productName: productName, title: 'Εκκρεμεί Αξιολόγηση', desc: productName, icon: 'bi-star-fill text-warning' });
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
                                <div><small class="text-dark d-block fw-bold">${notif.title}</small><span class="text-muted small">${notif.desc}</span></div>
                            </div>
                        </a>
                    </li>`;
            } else {
                htmlContent += `
                    <li class="px-2 mb-2">
                        <a href="orders.html" onclick="markNotificationAsRead('${notif.orderId}', '${notif.status}')" class="dropdown-item py-2 px-3 bg-light rounded text-wrap shadow-sm border">
                            <div class="d-flex align-items-center">
                                <i class="bi ${notif.icon} fs-4 me-2 flex-shrink-0"></i>
                                <div><small class="text-dark d-block fw-bold">${notif.title}</small><span class="text-muted small">${notif.desc}</span></div>
                            </div>
                        </a>
                    </li>`;
            }
        });
        list.innerHTML = htmlContent;
    } else {
        badge.style.display = 'none';
        list.innerHTML = `<li><h6 class="dropdown-header">Ειδοποιήσεις Παραγγελιών</h6></li><li><hr class="dropdown-divider"></li><li><span class="dropdown-item text-muted small text-center py-2">Δεν υπάρχουν νέες ειδοποιήσεις.</span></li>`;
    }
}

window.togglePaymentForm = function() {
    const isCardSelected = document.getElementById('payCard') && document.getElementById('payCard').checked;
    const cardForm = document.getElementById('cardDetailsForm');
    if (cardForm) {
        if (isCardSelected) cardForm.classList.remove('d-none');
        else cardForm.classList.add('d-none');
    }
};