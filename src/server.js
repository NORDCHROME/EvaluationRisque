// server.js — Point d'entrée principal
require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

// Railway est derrière un reverse proxy — nécessaire pour express-rate-limit
app.set('trust proxy', 1);

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting sur l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' }
});

// ── Routes API ───────────────────────────────────────────────
app.use('/api/auth',  authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/data',  require('./routes/data'));

// ── Santé / ping (doit répondre même si MongoDB pas encore connecté) ──
app.get('/api/health', (req, res) => {
  const states = ['disconnected','connected','connecting','disconnecting'];
  res.json({
    status: 'ok',
    db: states[mongoose.connection.readyState] || 'unknown',
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// ── Servir le frontend ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Démarrer le serveur HTTP en premier (Railway exige une réponse rapide) ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 EvalRisque démarré sur le port ${PORT}`);
});

// ── Connexion MongoDB Atlas (après le listen) ────────────────
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI manquant — ajoutez-le dans Railway → Variables');
  // Ne pas quitter : le serveur reste up pour afficher l'erreur dans /api/health
} else if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant — ajoutez-le dans Railway → Variables');
} else {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  })
    .then(async () => {
      console.log(`✅ MongoDB connecté — base : ${mongoose.connection.db.databaseName}`);
      await seedDefaultData();
    })
    .catch(err => {
      console.error('❌ Erreur MongoDB :', err.message);
      console.error('   → Vérifiez MONGODB_URI et les autorisations IP Atlas (0.0.0.0/0)');
    });

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB déconnecté'));
  mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconnecté'));
}

// ── Données par défaut au premier démarrage ──────────────────
async function seedDefaultData() {
  const { User, Company } = require('./models');
  const bcrypt = require('bcryptjs');

  if (await Company.countDocuments() === 0) {
    await Company.create({ name: 'NORDCHROME' });
    console.log('📋 Société NORDCHROME créée');
  }

  if (!await User.findOne({ login: 'admin' })) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ login: 'admin', name: 'Administrateur', password: hash, role: 'admin' });
    console.log('👤 Admin créé  →  login: admin  /  mdp: admin123');
    console.log('⚠️  Changez ce mot de passe dès la première connexion !');
  }
}

module.exports = app;


