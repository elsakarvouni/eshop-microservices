// Shared across every page that shows a wishlist heart or badge (catalog, product
// page, and the wishlist page itself), so it has to stay defensive about which
// DOM elements actually exist on the current page.

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

function updateWishlistBadge() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    document.querySelectorAll('.wishlist-count-badge').forEach(el => el.innerText = wishlist.length);
}

window.toggleWishlist = function(productId, productName, price, imageUrl, description, hasVariants) {
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    const existingIndex = wishlist.findIndex(item => item.id === productId);
    const heartIcon = document.getElementById(`heart-icon-${productId}`);

    if (existingIndex > -1) {
        wishlist.splice(existingIndex, 1);

        if (heartIcon) {
            heartIcon.classList.remove('fas', 'text-danger');
            heartIcon.classList.add('far', 'text-muted');
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Αφαιρέθηκε από τα αγαπημένα', showConfirmButton: false, timer: 1500 });
        }
    } else {
        wishlist.push({
            id: productId,
            name: productName,
            price: price,
            image: imageUrl,
            description: description,
            hasVariants: !!hasVariants
        });

        if (heartIcon) {
            heartIcon.classList.remove('far', 'text-muted');
            heartIcon.classList.add('fas', 'text-danger');
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Προστέθηκε στα αγαπημένα!', showConfirmButton: false, timer: 1500 });
        }
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistBadge();
};

document.addEventListener('DOMContentLoaded', () => {
    updateWishlistBadge();
});
