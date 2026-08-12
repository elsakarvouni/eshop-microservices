if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = 'http://localhost:8080/api';
}

const productsGrid = document.getElementById('productsGrid');
const alertMessage = document.getElementById('alertMessage');
const searchInput = document.getElementById('searchInput');
const navNotifications = document.getElementById('navNotifications');
const navWishlist = document.getElementById('navWishlist');
const navGuest = document.getElementById('navGuest');
const navUser = document.getElementById('navUser');
const logoutBtn = document.getElementById('logoutBtn');

let allProducts = [];
let currentCategory = 'all';

const token = localStorage.getItem('token');

if (token && token !== 'null' && token !== 'undefined' && token !== '') {
    if (navWishlist) navWishlist.classList.remove('d-none');
    if (navNotifications) navNotifications.classList.remove('d-none');
    if (navGuest) navGuest.classList.add('d-none');
    if (navUser) navUser.classList.remove('d-none');

    if (logoutBtn) {
        logoutBtn.onclick = function() {
            localStorage.removeItem('token');
            localStorage.removeItem('email');
            localStorage.removeItem('role');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('cart');
            window.location.reload();
        };
    }
} else {
    if (navNotifications) navNotifications.classList.add('d-none');
    if (navGuest) navGuest.classList.remove('d-none');
    if (navUser) navUser.classList.add('d-none');
}

async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'GET',
            cache: 'no-store', 
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Αποτυχία φόρτωσης');
        const responseData = await response.json();
        
        let productsArray = [];
        if (Array.isArray(responseData)) {
            productsArray = responseData;
        } else if (responseData.products && Array.isArray(responseData.products)) {
            productsArray = responseData.products;
        } else if (responseData.data && Array.isArray(responseData.data)) {
            productsArray = responseData.data;
        }

        allProducts = productsArray;
        renderProducts(allProducts);
        renderCategories(allProducts);
    } catch (error) {
        console.error(error);
        if (productsGrid) {
            productsGrid.innerHTML = '<div class="col-12 text-center text-danger">Πρόβλημα φόρτωσης προϊόντων.</div>';
        }
    }
}

if (searchInput) {
    searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();

        // Lets people type a Greek or English word for a category (e.g. "κινητο")
        // and match products in "Smartphones" even though nothing on the product
        // itself literally contains that word.
        const categoryAliases = {
            'λαπτοπ': 'laptops',
            'λάπτοπ': 'laptops',
            'laptop': 'laptops',
            'καμερα': 'drones & cameras',
            'κάμερα': 'drones & cameras',
            'camera': 'drones & cameras',
            'drone': 'drones & cameras',
            'κινητο': 'smartphones',
            'κινητό': 'smartphones',
            'τηλεφωνο': 'smartphones',
            'smartphone': 'smartphones'
        };

        let matchedCategory = searchTerm;
        
        if (searchTerm.length > 0) {
            for (const alias in categoryAliases) {
                if (alias.startsWith(searchTerm)) {
                    matchedCategory = categoryAliases[alias];
                    break;
                }
            }
        }

        const filteredProducts = allProducts.filter(product => {
            const productName = (product.name || '').toLowerCase();
            const productCategory = (product.category || '').toLowerCase();

            return productName.includes(searchTerm) || 
                   productCategory.includes(matchedCategory) ||
                   productCategory.includes(searchTerm);
        });

        renderProducts(filteredProducts);
    });
}

function getProductRatingBadge(productId) {
    const allReviews = JSON.parse(localStorage.getItem('productReviews')) || [];
    const productReviews = allReviews.filter(r => r.productId && r.productId.toString() === productId.toString());

    if (productReviews.length === 0) {
        return `
            <span class="badge bg-white text-dark shadow-sm border px-2 py-1 small position-absolute top-0 start-0 m-3 rounded-pill fw-normal pointer-events-none" style="z-index: 5;">
                0 σχόλια
            </span>
        `;
    }

    const totalRating = productReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    const average = (totalRating / productReviews.length).toFixed(1);

    return `
        <span class="badge bg-white text-dark shadow-sm border px-2 py-1 small position-absolute top-0 start-0 m-3 rounded-pill d-flex align-items-center gap-1 shadow-sm pointer-events-none" style="z-index: 5;">
            <i class="bi bi-star-fill text-warning"></i>
            <span class="fw-bold">${average}</span>
            <span class="text-muted small">(${productReviews.length})</span>
        </span>
    `;
}

function renderProducts(products) {
    if (!productsGrid) return;
    productsGrid.innerHTML = ''; 

    if (products.length === 0) {
        productsGrid.innerHTML = '<div class="col-12 text-center">Δεν βρέθηκαν προϊόντα.</div>';
        return;
    }

    const currentWishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

    products.forEach(product => {
        const productId = product._id || product.id;
        const displayName = product.name || 'Προϊόν';
        const description = product.description || '';
        const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
        const isOutOfStock = hasVariants
            ? product.variants.every(v => v.stock <= 0)
            : product.stock <= 0;
        const price = hasVariants
            ? Math.min(...product.variants.map(v => Number(v.price) || 0))
            : (Number(product.price) || 0);

        const imageToDisplay = product.imageUrl
            ? product.imageUrl
            : 'https://dummyimage.com/300x200/cccccc/ffffff&text=No+Image';

        const stockWarning = (!hasVariants && product.stock === 1)
            ? '<div class="text-danger small fw-bold mb-2 text-center">🔥 Μόνο 1 τελευταίο ακόμα!</div>'
            : '';

        const isFavorite = currentWishlist.some(item => item.id === productId);
        const heartClass = isFavorite ? 'fas text-danger' : 'far text-muted';
        
        const ratingBadgeHtml = getProductRatingBadge(productId);

        const encodedName = encodeURIComponent(displayName);
        const encodedDesc = encodeURIComponent(description);
        const encodedImg = encodeURIComponent(imageToDisplay);

        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';
        
        col.innerHTML = `
            <!-- position-relative on the card is what makes the .stretched-link below work -->
            <div class="card shadow-sm h-100 position-relative transition-hover" style="cursor: pointer;">

                ${ratingBadgeHtml}

                <!-- z-index: 20 keeps this clickable above the stretched-link that covers the whole card -->
                <button class="btn btn-light rounded-circle position-absolute m-2 shadow-sm wishlist-btn"
                        style="top: 0; right: 0; z-index: 20;"
                        data-id="${productId}"
                        data-name="${encodedName}"
                        data-price="${price}"
                        data-img="${encodedImg}"
                        data-desc="${encodedDesc}"
                        data-variants="${hasVariants}"
                        onclick="handleWishlistClick(this)">
                    <i class="${heartClass} fa-heart fs-5" id="heart-icon-${productId}"></i>
                </button>

                <img src="${imageToDisplay}" class="card-img-top p-3" alt="${displayName}" style="height: 200px; object-fit: contain;">

                <div class="card-body d-flex flex-column">
                    <!-- .stretched-link makes the whole card clickable, not just this title -->
                    <h5 class="card-title fw-bold">
                        <a href="product.html?id=${productId}" class="text-dark text-decoration-none stretched-link">
                            ${displayName}
                        </a>
                    </h5>

                    <p class="card-text text-muted small">${description}</p>

                    ${product.category ? `<p class="card-text"><strong>Κατηγορία:</strong> ${product.category}</p>` : ''}

                    <h4 class="mt-auto text-primary mb-3 text-center">${hasVariants ? 'από ' : ''}€${price.toFixed(2)}</h4>

                    ${stockWarning}

                    <!-- same z-index trick as the wishlist button above -->
                    ${hasVariants ? `
                    <a href="product.html?id=${productId}" class="btn ${isOutOfStock ? 'btn-secondary disabled' : 'btn-success'} w-100 position-relative" style="z-index: 20;">
                        ${isOutOfStock ? 'Εξαντλήθηκε' : '<i class="bi bi-cart-plus"></i> Επιλογές & Αγορά'}
                    </a>
                    ` : `
                    <button class="btn ${isOutOfStock ? 'btn-secondary' : 'btn-success'} w-100 position-relative"
                            style="z-index: 20;"
                            data-id="${productId}"
                            data-name="${encodedName}"
                            data-price="${price}"
                            onclick="handleAddToCartClick(this)"
                            ${isOutOfStock ? 'disabled' : ''}>
                        ${isOutOfStock ? 'Εξαντλήθηκε' : '<i class="bi bi-cart-plus"></i> Προσθήκη στο Καλάθι'}
                    </button>
                    `}
                </div>
            </div>
        `;
        
        productsGrid.appendChild(col);
    });
}

// Reading the product info back out of data-* attributes (instead of building the
// onclick string with the raw name/description) avoids breaking the HTML whenever
// a product name contains a quote character, e.g. a 15.6" laptop screen size.
window.handleWishlistClick = function(buttonElement) {
    const productId = buttonElement.getAttribute('data-id');
    const productName = decodeURIComponent(buttonElement.getAttribute('data-name'));
    const price = Number(buttonElement.getAttribute('data-price'));
    const imageUrl = decodeURIComponent(buttonElement.getAttribute('data-img'));
    const description = decodeURIComponent(buttonElement.getAttribute('data-desc'));
    const hasVariants = buttonElement.getAttribute('data-variants') === 'true';

    if (typeof toggleWishlist === 'function') {
        toggleWishlist(productId, productName, price, imageUrl, description, hasVariants);
    }
};

window.handleAddToCartClick = function(buttonElement) {
    const productId = buttonElement.getAttribute('data-id');
    const productName = decodeURIComponent(buttonElement.getAttribute('data-name'));
    const price = Number(buttonElement.getAttribute('data-price'));

    addToCart(productId, productName, price);
};

window.addToCart = function(productId, productName, price) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingProduct = cart.find(item => item.productId === productId);

    if (existingProduct) {
        existingProduct.quantity += 1;
    } else {
        cart.push({
            productId: productId,
            name: productName,
            price: price,
            quantity: 1
        });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    showAlert(`Το προϊόν <strong>${productName}</strong> προστέθηκε στο καλάθι!`, 'success');
    updateCartCounter();
};

function updateCartCounter() {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let totalItems = 0;
    cart.forEach(item => totalItems += item.quantity);

    document.querySelectorAll('.cart-count-badge').forEach(el => el.innerText = totalItems);
}

function showAlert(message, type) {
    if(alertMessage) {
        alertMessage.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
    }
}

function renderCategories(products) {
    const categoryList = document.getElementById('categoryList');
    if(!categoryList) return;

    const uniqueCategories = [...new Set(products.map(p => p.category).filter(c => c))];
    
    categoryList.innerHTML = `
        <a href="#" class="list-group-item list-group-item-action fw-bold" onclick="filterByCategory('all')">
            Όλα τα Προϊόντα
        </a>
    `;
    
    uniqueCategories.forEach(category => {
        categoryList.innerHTML += `
            <a href="#" class="list-group-item list-group-item-action" onclick="filterByCategory('${category}')">
                ${category}
            </a>
        `;
    });
}

window.filterByCategory = function(category) {
    currentCategory = category; 
    applyFilterAndSort();       
    
    const offcanvasEl = document.getElementById('categoryMenu');
    if (offcanvasEl) {
        const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvasInstance) offcanvasInstance.hide();
    }
};

window.sortProducts = function() {
    applyFilterAndSort();
};

function applyFilterAndSort() {
    let result = [];
    
    if (currentCategory === 'all') {
        result = [...allProducts];
    } else {
        result = allProducts.filter(p => p.category === currentCategory);
    }
    
    const sortSelect = document.getElementById('sortSelect');
    if(sortSelect) {
        const sortValue = sortSelect.value;
        if (sortValue === 'price-asc') {
            result.sort((a, b) => a.price - b.price);
        } else if (sortValue === 'price-desc') {
            result.sort((a, b) => b.price - a.price);
        }
    }
    
    renderProducts(result);
}

updateCartCounter();
fetchProducts();