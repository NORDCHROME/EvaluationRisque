require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();
app.set('trust proxy', 1);

// ── Middlewares ─────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' }
});

// ── Routes ─────────────────────────────────
app.use('/api/auth',  authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/data',  require('./routes/data'));

// ✅ AJOUT ICI
app.use('/api/tasks', require('./routes/tasks'));

// ── Health check ───────────────────────────
app.get('/api/health', (req, res) => {
  const states = ['disconnected','connected','connecting','disconnecting'];
  res.json({
    status: 'ok',
    db: states[mongoose.connection.readyState] || 'unknown',
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// ── Static ─────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── 404 API ────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.originalUrl}` });
});

// ── SPA fallback ───────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 ERREUR:', err);
  res.status(500).json({ error: err.message });
});

// ── Server ─────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});

// ── MongoDB ───────────────────────────────
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI manquant');
}
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant');
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ MongoDB erreur:', err.message));
