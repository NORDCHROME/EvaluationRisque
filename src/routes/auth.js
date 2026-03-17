// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { User } = require('../models');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password)
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

    const user = await User.findOne({ login });
    if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });

    // Mettre à jour lastLogin
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id:        user._id,
        login:     user.login,
        name:      user.name,
        role:      user.role,
        site:      user.site,
        managerId: user.managerId
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    const newToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token: newToken });
  } catch (e) {
    res.status(401).json({ error: 'Impossible de renouveler le token' });
  }
});

module.exports = router;
