// server.js — Point d'entrée principal
require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 10mb pour les signatures base64

// Rate limiting sur l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' }
});

// ── Routes API ───────────────────────────────────────────────
app.use('/api/auth',  authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/data',  require('./routes/data'));

// ── Santé / ping ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// ── Servir le frontend (fichier HTML statique) ───────────────
// Placez le fichier EvalRisque-NORDCHROME.html dans /public/index.html
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Connexion MongoDB + démarrage ────────────────────────────
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/evalrisque';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connecté :', MONGODB_URI.replace(/\/\/.*@/, '//***@'));
    await seedDefaultData();
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur MongoDB :', err.message);
    process.exit(1);
  });

// ── Données par défaut au premier démarrage ──────────────────
async function seedDefaultData() {
  const { User, Company } = require('./models');
  const bcrypt = require('bcryptjs');

  // Créer la société par défaut
  const coCount = await Company.countDocuments();
  if (coCount === 0) {
    await Company.create({ name: 'NORDCHROME' });
    console.log('📋 Société par défaut créée : NORDCHROME');
  }

  // Créer l'admin par défaut
  const adminExists = await User.findOne({ login: 'admin' });
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({
      login: 'admin',
      name: 'Administrateur',
      password: hash,
      role: 'admin'
    });
    console.log('👤 Admin par défaut créé — login: admin / pass: admin123');
    console.log('⚠️  CHANGEZ le mot de passe admin immédiatement après la première connexion !');
  }
}

module.exports = app;
