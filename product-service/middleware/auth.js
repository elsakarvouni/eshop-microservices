const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_for_my_project';

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Απαιτείται σύνδεση.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Μη έγκυρο ή ληγμένο token.' });
    }
}

function requireAdmin(req, res, next) {
    authenticate(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Απαιτούνται δικαιώματα διαχειριστή.' });
        }
        next();
    });
}

module.exports = { authenticate, requireAdmin };
