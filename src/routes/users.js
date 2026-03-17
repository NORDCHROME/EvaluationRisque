// routes/users.js
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');
const { User } = require('../models');

// GET /api/users — liste (admin seulement)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — créer (admin seulement)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { login, name, password, role, site, managerId } = req.body;
    if (!login || !name || !password)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    const exists = await User.findOne({ login });
    if (exists) return res.status(409).json({ error: 'Identifiant déjà utilisé' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      login, name, password: hash, role: role||'user',
      site: site||'', managerId: managerId||null
    });
    res.status(201).json({ ...user.toObject(), password: undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/:id — modifier (admin seulement)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, role, site, managerId, password } = req.body;
    const update = { name, role, site, managerId: managerId||null };
    if (password) update.password = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id (admin, pas l'admin principal)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.login === 'admin') return res.status(403).json({ error: 'Impossible de supprimer l\'admin principal' });
    await user.deleteOne();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/me — profil courant
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password').populate('managerId','name login site');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
