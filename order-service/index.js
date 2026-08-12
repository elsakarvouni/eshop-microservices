require('dotenv').config({ quiet: true });
const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = 3003;

app.use(express.json());

const MONGO_USER = process.env.MONGO_USER || 'admin';
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || 'adminpassword';
const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo-order-db:27017/order_db?authSource=admin`;

const orderSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    items: { type: Array, required: true },
    totalPrice: { type: Number, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

let channel;
async function connectToRabbitMQ() {
    try {
        const connection = await amqp.connect('amqp://rabbitmq_message_broker:5672');
        channel = await connection.createChannel();

        await channel.assertQueue('order_queue');
        await channel.assertQueue('ORDER_RESPONSES');

        console.log('Το Order Service συνδέθηκε στο RabbitMQ!');

        // product-service replies here after it tries to reserve stock for an order.
        // A successful reply is a no-op on purpose: the order just stays PENDING and
        // waits for an admin to move it forward. Only a failure needs to flip the status.
        channel.consume('ORDER_RESPONSES', async (msg) => {
            if (msg !== null) {
                const response = JSON.parse(msg.content.toString());

                if (response.status === 'COMPLETED' || response.status === 'SUCCESS') {
                    console.log(`Το απόθεμα επιβεβαιώθηκε για την παραγγελία ${response.orderId}. Παραμένει PENDING.`);
                } else {
                    await Order.findByIdAndUpdate(response.orderId, { status: 'FAILED' });
                    console.log(`Πρόβλημα αποθέματος για την παραγγελία ${response.orderId}. Η κατάσταση άλλαξε σε FAILED.`);
                }

                channel.ack(msg);
            }
        });
    } catch (err) {
        console.error('Σφάλμα RabbitMQ (Order Service):', err);
    }
}

app.post('/', authenticate, async (req, res) => {
    try {
        const { items, totalPrice, address, phone } = req.body;
        const userEmail = req.user.email; // from the token, not the request body - the client shouldn't get to say who they are

        const newOrder = new Order({ userEmail, items, totalPrice, address, phone, status: 'PENDING' });
        const savedOrder = await newOrder.save();

        // One message per line item, so product-service can check/decrement stock item by item
        items.forEach(item => {
            const rabbitMsg = {
                orderId: savedOrder._id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity
            };
            if (channel) {
                channel.sendToQueue('order_queue', Buffer.from(JSON.stringify(rabbitMsg)));
            }
        });

        res.status(201).json({ message: 'Η παραγγελία καταχωρήθηκε!', orderId: savedOrder._id });
    } catch (err) {
        console.error('Σφάλμα κατά τη δημιουργία παραγγελίας:', err);
        res.status(500).json({ message: 'Αποτυχία δημιουργίας παραγγελίας' });
    }
});

// Full order list for the admin dashboard - not something a regular customer should see
app.get('/', requireAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (err) {
        res.status(500).json({ message: 'Σφάλμα διακομιστή' });
    }
});

app.get('/user/:email', authenticate, async (req, res) => {
    try {
        const userEmail = req.params.email;

        // Only the account owner or an admin can look up these orders
        if (req.user.role !== 'admin' && req.user.email !== userEmail) {
            return res.status(403).json({ message: 'Δεν επιτρέπεται η πρόσβαση σε παραγγελίες άλλου χρήστη.' });
        }

        const userOrders = await Order.find({ userEmail: userEmail }).sort({ createdAt: -1 });
        res.status(200).json(userOrders);
    } catch (err) {
        console.error('Σφάλμα ανάκτησης παραγγελιών πελάτη:', err);
        res.status(500).json({ message: 'Σφάλμα διακομιστή' });
    }
});

// Admins can set any status; customers can only cancel their own order, and only while it's PENDING
app.put('/:id/status', authenticate, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        const existingOrder = await Order.findById(orderId);
        if (!existingOrder) {
            return res.status(404).json({ message: 'Η παραγγελία δεν βρέθηκε' });
        }

        if (req.user.role !== 'admin') {
            const isOwner = existingOrder.userEmail === req.user.email;
            const isCancelOfPending = status === 'CANCELLED' && existingOrder.status === 'PENDING';
            if (!isOwner || !isCancelOfPending) {
                return res.status(403).json({ message: 'Μπορείτε να ακυρώσετε μόνο τη δική σας παραγγελία, όσο είναι σε αναμονή.' });
            }
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: status },
            { returnDocument: 'after' }
        );

        res.status(200).json({ message: 'Η κατάσταση ενημερώθηκε!', order: updatedOrder });
    } catch (err) {
        console.error('Σφάλμα ενημέρωσης κατάστασης:', err);
        res.status(500).json({ message: 'Αποτυχία ενημέρωσης κατάστασης' });
    }
});

// DB/RabbitMQ connections and app.listen() only happen when this file runs directly
// (node index.js / the Docker container) - not when a test requires it for `app`.
if (require.main === module) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('Επιτυχής σύνδεση με τη MongoDB (Order Service)!'))
        .catch((err) => console.error('Σφάλμα σύνδεσης MongoDB:', err));

    connectToRabbitMQ();

    app.listen(PORT, () => console.log(`Order Service is listening on port ${PORT}`));
}

module.exports = { app, Order };
