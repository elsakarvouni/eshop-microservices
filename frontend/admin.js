const API_BASE_URL = 'http://localhost:8080/api';
const token = localStorage.getItem('token');
const adminProductsTable = document.getElementById('adminProductsTable');
const productForm = document.getElementById('productForm');
const adminAlert = document.getElementById('adminAlert');
const adminSearchInput = document.getElementById('adminSearchInput');

const formTitle = document.getElementById('formTitle');
const formHeader = document.getElementById('formHeader');
const formSubmitBtn = document.getElementById('formSubmitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editProductId = document.getElementById('editProductId');

let allAdminProducts = [];

const variantRowsContainer = document.getElementById('variantRowsContainer');
const addVariantRowBtn = document.getElementById('addVariantRowBtn');

function addVariantRow(label = '', price = '', stock = '') {
    const row = document.createElement('div');
    row.className = 'row g-1 mb-1 variant-row align-items-center';
    row.innerHTML = `
        <div class="col-5">
            <input type="text" class="form-control form-control-sm variant-label" placeholder="π.χ. 128GB - Μαύρο" value="${label}">
        </div>
        <div class="col-3">
            <input type="number" class="form-control form-control-sm variant-price" placeholder="Τιμή €" step="0.01" min="0" value="${price}">
        </div>
        <div class="col-3">
            <input type="number" class="form-control form-control-sm variant-stock" placeholder="Στοκ" min="0" value="${stock}">
        </div>
        <div class="col-1">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.variant-row').remove()">✕</button>
        </div>
    `;
    variantRowsContainer.appendChild(row);
}

function clearVariantRows() {
    variantRowsContainer.innerHTML = '';
}

function getVariantsFromForm() {
    const variants = [];
    variantRowsContainer.querySelectorAll('.variant-row').forEach(row => {
        const label = row.querySelector('.variant-label').value.trim();
        const price = parseFloat(row.querySelector('.variant-price').value);
        const stock = parseInt(row.querySelector('.variant-stock').value);
        if (label && !isNaN(price)) {
            variants.push({ label, price, stock: isNaN(stock) ? 0 : stock });
        }
    });
    return variants;
}

if (addVariantRowBtn) {
    addVariantRowBtn.addEventListener('click', () => addVariantRow());
}

// This only hides the admin page from the UI - the real enforcement is server-side,
// every product/order endpoint the API calls below checks the admin role itself too.
if (!token) {
    alert('Απαγορεύεται η πρόσβαση. Παρακαλώ συνδεθείτε.');
    window.location.replace('login.html');
} else if (localStorage.getItem('role') !== 'admin') {
    alert('Απαγορεύεται η πρόσβαση. Αυτή η σελίδα είναι μόνο για διαχειριστές.');
    window.location.replace('index.html');
}

function showMessage(message, type) {
    let iconType = type;
    if (type === 'danger') iconType = 'error';

    Swal.fire({
        title: iconType === 'success' ? 'Επιτυχία!' : 'Προσοχή!',
        text: message,
        icon: iconType,
        confirmButtonText: 'ΟΚ',
        confirmButtonColor: iconType === 'success' ? '#198754' : '#dc3545',
        timer: 3000, 
        timerProgressBar: true
    });
}

async function loadAdminProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) throw new Error('Αποτυχία φόρτωσης');
        
        const data = await response.json();
        allAdminProducts = Array.isArray(data) ? data : (data.products || data.data || []);
        
        renderAdminTable(allAdminProducts);
    } catch (error) {
        adminProductsTable.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Πρόβλημα σύνδεσης με το backend.</td></tr>';
    }
}

function renderAdminTable(productsArray) {
    adminProductsTable.innerHTML = '';

    if (productsArray.length === 0) {
        adminProductsTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Δεν βρέθηκαν προϊόντα.</td></tr>';
        return;
    }

    productsArray.forEach(p => {
        const productId = p.id || p._id;
        const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
        const priceDisplay = hasVariants
            ? `€${Math.min(...p.variants.map(v => v.price))} - €${Math.max(...p.variants.map(v => v.price))}`
            : `€${p.price}`;
        const stockDisplay = hasVariants
            ? `${p.variants.reduce((sum, v) => sum + (v.stock || 0), 0)} τεμ. <span class="badge bg-info text-dark">${p.variants.length} επιλογές</span>`
            : `${p.stock} τεμ.`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${priceDisplay}</td>
            <td>${stockDisplay}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-2" onclick="startEdit('${productId}')">Επεξεργασία</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${productId}')">Διαγραφή</button>
            </td>
        `;
        adminProductsTable.appendChild(tr);
    });
}

adminSearchInput.addEventListener('input', (event) => {
    const searchTerm = event.target.value.toLowerCase().trim();
    const filtered = allAdminProducts.filter(p => (p.name || '').toLowerCase().includes(searchTerm));
    renderAdminTable(filtered);
});

productForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const categoryInput = document.getElementById('productCategory');
    const imageInput = document.getElementById('productImage');

    const productData = {
        name: document.getElementById('formName').value,
        description: document.getElementById('formDesc').value,
        price: parseFloat(document.getElementById('formPrice').value),
        stock: parseInt(document.getElementById('formStock').value),
        category: categoryInput ? categoryInput.value : 'Διάφορα',
        imageUrl: imageInput ? imageInput.value : '',
        variants: getVariantsFromForm()
    };

    const idToEdit = editProductId.value;
    const isEditMode = idToEdit !== '';

    const url = isEditMode ? `${API_BASE_URL}/products/${idToEdit}` : `${API_BASE_URL}/products`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productData)
        });

        if (response.ok) {
            showMessage(isEditMode ? 'Το προϊόν ενημερώθηκε!' : 'Το προϊόν προστέθηκε!', 'success');
            cancelEditMode(); 
            loadAdminProducts();
        } else {
            showMessage(`Σφάλμα: Αποτυχία ${isEditMode ? 'ενημέρωσης' : 'προσθήκης'}.`, 'danger');
        }
    } catch (error) {
        showMessage('Αποτυχία σύνδεσης με τον server.', 'danger');
    }
});

window.startEdit = function(productId) {
    const product = allAdminProducts.find(p => (p.id || p._id) === productId);
    if (!product) return;

    document.getElementById('formName').value = product.name || '';
    document.getElementById('formDesc').value = product.description || '';
    document.getElementById('formPrice').value = product.price || 0;
    document.getElementById('formStock').value = product.stock || 0;
    
    const categoryInput = document.getElementById('productCategory');
    if (categoryInput) {
        categoryInput.value = product.category || '';
    }

    const imageInput = document.getElementById('productImage');
    if (imageInput) {
        imageInput.value = product.imageUrl || '';
    }

    clearVariantRows();
    if (Array.isArray(product.variants)) {
        product.variants.forEach(v => addVariantRow(v.label, v.price, v.stock));
    }

    editProductId.value = productId;

    formTitle.innerText = `Επεξεργασία: ${product.name}`;
    formHeader.classList.replace('bg-primary', 'bg-warning');
    formHeader.classList.replace('text-white', 'text-dark');
    formSubmitBtn.innerText = '💾 Αποθήκευση Αλλαγών';
    formSubmitBtn.classList.replace('btn-success', 'btn-warning');
    cancelEditBtn.classList.remove('d-none');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelEditMode = function() {
    productForm.reset();
    editProductId.value = '';
    clearVariantRows();

    formTitle.innerText = 'Προσθήκη Νέου Προϊόντος';
    formHeader.classList.replace('bg-warning', 'bg-primary');
    formHeader.classList.replace('text-dark', 'text-white');
    formSubmitBtn.innerText = '+ Προσθήκη';
    formSubmitBtn.classList.replace('btn-warning', 'btn-success');
    cancelEditBtn.classList.add('d-none');
};
cancelEditBtn.addEventListener('click', cancelEditMode);

window.deleteProduct = async function(productId) {
    const result = await Swal.fire({
        title: 'Είστε σίγουροι;',
        text: "Αυτή η ενέργεια δεν μπορεί να αναιρεθεί!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ναι, διαγραφή!',
        cancelButtonText: 'Ακύρωση'
    });

    if (!result.isConfirmed) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showMessage('Το προϊόν διαγράφηκε.', 'success');
            loadAdminProducts();
        } else {
            showMessage('Αποτυχία διαγραφής.', 'danger');
        }
    } catch (error) {
        showMessage('Αποτυχία σύνδεσης με τον server.', 'danger');
    }
};
loadAdminProducts();

function loadPromoCodes() {
    let promos = JSON.parse(localStorage.getItem('promoCodes')) || [];
    const tbody = document.getElementById('promoCodesTable');
    tbody.innerHTML = '';
    
    if (promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Δεν υπάρχουν ενεργοί εκπτωτικοί κωδικοί.</td></tr>';
        return;
    }
    
    promos.forEach((promo, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-3"><span class="badge bg-success fs-6"><i class="bi bi-tag-fill me-1"></i>${promo.code}</span></td>
            <td class="fw-bold text-danger fs-5">-${promo.discount}%</td>
            <td class="text-end pe-3">
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="deletePromoCode(${index})"><i class="bi bi-trash"></i> Διαγραφή</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.savePromoCode = function() {
    const codeInput = document.getElementById('promoCodeInput');
    const percentInput = document.getElementById('promoPercentInput');
    
    const code = codeInput.value.trim().toUpperCase(); // codes are always matched in uppercase
    const discount = parseInt(percentInput.value);

    if (!code || isNaN(discount) || discount < 1 || discount > 100) {
        showMessage('Παρακαλώ εισάγετε έγκυρο κωδικό και ποσοστό (1-100).', 'danger');
        return;
    }

    let promos = JSON.parse(localStorage.getItem('promoCodes')) || [];

    if (promos.some(p => p.code === code)) {
        showMessage('Αυτός ο κωδικός υπάρχει ήδη!', 'warning');
        return;
    }

    promos.push({ code: code, discount: discount });
    localStorage.setItem('promoCodes', JSON.stringify(promos));

    codeInput.value = '';
    percentInput.value = '';

    const modalEl = document.getElementById('promoModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    showMessage('Ο εκπτωτικός κωδικός προστέθηκε επιτυχώς!', 'success');
    loadPromoCodes();
};

window.deletePromoCode = function(index) {
    let promos = JSON.parse(localStorage.getItem('promoCodes')) || [];
    promos.splice(index, 1);
    localStorage.setItem('promoCodes', JSON.stringify(promos));
    showMessage('Ο κωδικός διαγράφηκε.', 'success');
    loadPromoCodes();
};

loadPromoCodes();

const adminOrdersTable = document.getElementById('adminOrdersTable');

window.loadAdminOrders = async function() {
    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        if (!response.ok) throw new Error('Σφάλμα κατά την ανάκτηση παραγγελιών');
        
        const data = await response.json();
        const orders = Array.isArray(data) ? data : (data.orders || []);
        
        renderOrdersTable(orders);
    } catch (error) {
        console.error(error);
        adminOrdersTable.innerHTML = '<tr><td colspan="6" class="text-center text-danger fw-bold">Πρόβλημα σύνδεσης με το Order Service.</td></tr>';
    }
};

function renderOrdersTable(orders) {
    updateDashboardAnalytics(orders);
    adminOrdersTable.innerHTML = '';

    if (orders.length === 0) {
        adminOrdersTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Δεν υπάρχουν ακόμα παραγγελίες στο σύστημα.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const tr = document.createElement('tr');
        const orderId = order._id || order.id || 'N/A';
        
        let itemsHtml = '<ul class="list-unstyled mb-0 small text-end">';
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const itemName = item.name || `Προϊόν ID: ${item.productId}`;
                itemsHtml += `<li><strong>${itemName}</strong> <span class="badge bg-secondary rounded-pill">x${item.quantity}</span></li>`;
            });
        } else {
            itemsHtml += '<li><span class="text-muted">Άγνωστα είδη</span></li>';
        }
        itemsHtml += '</ul>';

        const status = (order.status || 'PENDING').toUpperCase();
        
        const statusDropdown = `
            <select class="form-select form-select-sm fw-bold shadow-none cursor-pointer" onchange="updateOrderStatus('${orderId}', this.value)" style="width: 130px;">
                <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
                <option value="SHIPPED" ${status === 'SHIPPED' ? 'selected' : ''}>SHIPPED</option>
                <option value="DELIVERED" ${status === 'DELIVERED' ? 'selected' : ''}>DELIVERED</option>
                <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
            </select>
            <!-- single-quoted onclick on purpose: the order JSON below is double-quoted,
                 swapping these would break on any product name containing a " character -->
            <button class="btn btn-sm btn-info ms-2" onclick='openDetailsModal(${JSON.stringify(order).replace(/'/g, "\\'")})'>
                👁️
            </button>
        `;

        const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
        const formattedDate = dateObj.toLocaleDateString('el-GR') + ' ' + dateObj.toLocaleTimeString('el-GR', {hour: '2-digit', minute:'2-digit'});

        tr.innerHTML = `
            <td class="text-muted small">#${orderId.toString().substring(0, 8)}...</td>
            <td class="fw-bold">${order.userEmail || order.userId || 'Επισκέπτης'}</td>
            <td class="fw-bold text-success">€${order.totalPrice ? order.totalPrice.toFixed(2) : '0.00'}</td>
            <td>${statusDropdown}</td>
            <td class="small">${formattedDate}</td>
            <td>${itemsHtml}</td>
        `;
        adminOrdersTable.appendChild(tr);
    });
}

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showMessage(`Η κατάσταση της παραγγελίας #${orderId.substring(0, 8)} άλλαξε επιτυχώς σε ${newStatus}`, 'success');
        } else {
            showMessage('Αποτυχία ενημέρωσης κατάστασης.', 'danger');
        }
    } catch (error) {
        console.error('Σφάλμα κατά την ενημέρωση:', error);
        showMessage('Αδυναμία επικοινωνίας με το Order Service.', 'danger');
    }
};

window.openDetailsModal = function(order) {
    document.getElementById('modalEmail').innerText = order.userEmail || '-';
    document.getElementById('modalPhone').innerText = order.phone || 'Μη διαθέσιμο';
    document.getElementById('modalAddress').innerText = order.address || 'Μη διαθέσιμη';
    document.getElementById('modalTotal').innerText = `€${order.totalPrice}`;

    const itemsList = document.getElementById('modalItemsList');
    itemsList.innerHTML = ''; 
    
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                ${item.name} 
                <span class="badge bg-primary rounded-pill">${item.quantity} τμχ</span>
            `;
            itemsList.appendChild(li);
        });
    } else {
        itemsList.innerHTML = '<li class="list-group-item">Κανένα προϊόν</li>';
    }

    const modalElement = document.getElementById('orderDetailsModal');
    const modalInstance = new bootstrap.Modal(modalElement);
    modalInstance.show();
};

function updateDashboardAnalytics(orders) {
    let revenue = 0;
    let pendingCount = 0;
    const totalCount = orders.length;

    orders.forEach(order => {
        const status = (order.status || '').toUpperCase();
        
        if (status === 'COMPLETED') {
            revenue += (order.totalPrice || 0);
        }
        
        if (status === 'PENDING') {
            pendingCount++;
        }
    });

    document.getElementById('totalRevenue').innerText = `€${revenue.toFixed(2)}`;
    document.getElementById('totalOrders').innerText = totalCount;
    document.getElementById('pendingOrders').innerText = pendingCount;
}

document.addEventListener('DOMContentLoaded', () => {
    const adminLogoutBtn = document.getElementById('adminLogoutBtn') || document.getElementById('logoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('email');
            localStorage.removeItem('role');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('cart');
            window.location.href = 'index.html';
        });
    }
});

loadAdminOrders();