// Unit tests for the stock-decision logic that the RabbitMQ consumer calls on
// every incoming order. This is the exact code path behind the per-variant stock
// bug that was fixed earlier - a plain product and a product with variants must
// both be covered, plus insufficient stock in each shape.

const { connect, disconnect, clearCollections } = require('./mongoSetup');
const { applyOrderToProduct, Product } = require('../index');

beforeAll(async () => { await connect(); });
afterAll(async () => { await disconnect(); });
afterEach(async () => { await clearCollections(); });

describe('applyOrderToProduct - plain products (no variants)', () => {
    it('approves the order and decrements stock when there is enough', async () => {
        const product = await Product.create({ name: 'Mouse', price: 20, stock: 5, category: 'Gaming' });

        const status = await applyOrderToProduct(product, { productId: product._id, quantity: 2 });

        expect(status).toBe('COMPLETED');
        const fromDb = await Product.findById(product._id);
        expect(fromDb.stock).toBe(3);
    });

    it('rejects the order and leaves stock untouched when there is not enough', async () => {
        const product = await Product.create({ name: 'Mouse', price: 20, stock: 1, category: 'Gaming' });

        const status = await applyOrderToProduct(product, { productId: product._id, quantity: 5 });

        expect(status).toBe('FAILED');
        const fromDb = await Product.findById(product._id);
        expect(fromDb.stock).toBe(1);
    });

    it('rejects when the product does not exist', async () => {
        const status = await applyOrderToProduct(null, { productId: 'doesnotexist', quantity: 1 });
        expect(status).toBe('FAILED');
    });
});

describe('applyOrderToProduct - products with variants', () => {
    it('decrements only the ordered variant, leaving the others alone', async () => {
        const product = await Product.create({
            name: 'Phone',
            price: 500,
            category: 'Smartphones',
            variants: [
                { label: '128GB - Black', price: 500, stock: 3 },
                { label: '256GB - Black', price: 600, stock: 1 }
            ]
        });
        const [variant128, variant256] = product.variants;

        const status = await applyOrderToProduct(product, {
            productId: product._id,
            variantId: variant256._id,
            quantity: 1
        });

        expect(status).toBe('COMPLETED');
        const fromDb = await Product.findById(product._id);
        expect(fromDb.variants.id(variant256._id).stock).toBe(0);
        expect(fromDb.variants.id(variant128._id).stock).toBe(3); // untouched
    });

    it('rejects when the ordered variant does not have enough stock', async () => {
        const product = await Product.create({
            name: 'Phone',
            price: 500,
            category: 'Smartphones',
            variants: [{ label: '128GB - Black', price: 500, stock: 1 }]
        });
        const variant = product.variants[0];

        const status = await applyOrderToProduct(product, {
            productId: product._id,
            variantId: variant._id,
            quantity: 2
        });

        expect(status).toBe('FAILED');
        const fromDb = await Product.findById(product._id);
        expect(fromDb.variants.id(variant._id).stock).toBe(1);
    });

    it('rejects when the variant id does not exist on the product', async () => {
        const product = await Product.create({
            name: 'Phone',
            price: 500,
            category: 'Smartphones',
            variants: [{ label: '128GB - Black', price: 500, stock: 3 }]
        });

        const status = await applyOrderToProduct(product, {
            productId: product._id,
            variantId: new (require('mongoose').Types.ObjectId)(),
            quantity: 1
        });

        expect(status).toBe('FAILED');
    });
});
