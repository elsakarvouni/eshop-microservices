require('dotenv').config({ quiet: true });
const crypto = require('crypto');
global.crypto = crypto; // mongoose expects a global "crypto" object on this Node version, otherwise it throws on startup
const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const { requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = 3002;

app.use(express.json());

const MONGO_USER = process.env.MONGO_USER || 'admin';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'adminpassword';
const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo-product-db:27017/product_db?authSource=admin`;

// A single purchasable option for a product (e.g. "128GB - Black"), with its own price and stock
const variantSchema = new mongoose.Schema({
    label: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    stock: { type: Number, default: 10 },
    category: { type: String, default: 'Διάφορα' },
    createdAt: { type: Date, default: Date.now },
    imageUrl: { type: String, default: '' },
    variants: { type: [variantSchema], default: [] } // only set for products that have options, empty otherwise
});

const Product = mongoose.model('Product', productSchema);

// Decides whether an incoming order can be fulfilled and, if so, decrements the
// right stock counter and persists it. Pulled out of the RabbitMQ consumer below
// so the stock/variant logic can be unit-tested without touching amqplib at all.
async function applyOrderToProduct(product, order) {
    if (!product) return 'FAILED';

    if (order.variantId) {
        // Product has options - the stock we care about lives on the variant, not the product itself
        const variant = product.variants.id(order.variantId);
        if (!variant || order.quantity > variant.stock) return 'FAILED';

        variant.stock -= order.quantity;
        await product.save();
        return 'COMPLETED';
    }

    if (order.quantity > product.stock) return 'FAILED';

    product.stock -= order.quantity;
    await product.save();
    return 'COMPLETED';
}

// Listens for orders coming from order-service over RabbitMQ and adjusts stock accordingly.
async function connectToRabbitMQ() {
    try {
        const connection = await amqp.connect('amqp://rabbitmq-broker:5672');
        const channel = await connection.createChannel();

        await channel.assertQueue('order_queue');
        console.log('Το Product Service "ακούει" για νέα μηνύματα στην ουρά "order_queue"...');

        channel.consume('order_queue', async (msg) => {
            if (msg !== null) {
                const order = JSON.parse(msg.content.toString());
                let responseStatus = 'FAILED';

                try {
                    const product = await Product.findById(order.productId);
                    responseStatus = await applyOrderToProduct(product, order);
                } catch (dbError) {
                    console.error('[x] Σφάλμα επικοινωνίας με τη MongoDB κατά τον έλεγχο αποθέματος:', dbError);
                }

                console.log(`[Order ${order.orderId}] product ${order.productId}${order.variantId ? ` (variant ${order.variantId})` : ''} x${order.quantity} -> ${responseStatus}`);

                const responseMsg = { orderId: order.orderId, status: responseStatus };
                channel.sendToQueue('ORDER_RESPONSES', Buffer.from(JSON.stringify(responseMsg)));
                channel.ack(msg);
            }
        });
    } catch (err) {
        console.error('Σφάλμα σύνδεσης Product Service με RabbitMQ:', err);
    }
}

app.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, description, price, stock, category, imageUrl, variants } = req.body;
        const newProduct = new Product({ name, description, price, stock, category, imageUrl, variants });
        const savedProduct = await newProduct.save();
        res.status(201).json({ message: 'Το προϊόν προστέθηκε επιτυχώς!', product: savedProduct });
    } catch (err) {
        res.status(500).json({ message: 'Σφάλμα κατά την αποθήκευση' });
    }
});

app.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (err) {
        res.status(500).json({ message: 'Σφάλμα κατά την ανάκτηση' });
    }
});

app.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Το προϊόν δεν βρέθηκε στη βάση.' });
        }

        res.status(200).json({ message: 'Το προϊόν διαγράφηκε επιτυχώς!' });
    } catch (err) {
        console.error('Σφάλμα κατά τη διαγραφή:', err);
        res.status(500).json({ message: 'Σφάλμα διακομιστή κατά τη διαγραφή.' });
    }
});

app.put('/:id', requireAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, description, price, stock, category, imageUrl, variants } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { name, description, price, stock, category, imageUrl, variants },
            { returnDocument: 'after', runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Το προϊόν δεν βρέθηκε.' });
        }

        res.status(200).json({ message: 'Το προϊόν ενημερώθηκε!', product: updatedProduct });
    } catch (err) {
        console.error('Σφάλμα κατά την ενημέρωση:', err);
        res.status(500).json({ message: 'Σφάλμα διακομιστή κατά την ενημέρωση.' });
    }
});

// DB/RabbitMQ connections and app.listen() only happen when this file runs directly
// (node index.js / the Docker container) - not when a test requires it for `app`.
if (require.main === module) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('Επιτυχής σύνδεση με τη MongoDB!'))
        .catch((err) => console.error('Σφάλμα κατά τη σύνδεση με τη MongoDB:', err));

    connectToRabbitMQ();

    app.listen(PORT, () => {
        console.log(`Product Service is listening on http://localhost:${PORT}`);
    });
}

module.exports = { app, applyOrderToProduct, Product };
