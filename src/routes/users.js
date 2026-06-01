// routes/users.js — v3 multi-managers
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');
const { User } = require('../models');

// GET /api/users/me — profil courant (tous)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('managerId',  'name login site _id')
      .populate('managerIds', 'name login site _id');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/me/signature — sauvegarder sa propre signature
router.put('/me/signature', auth, async (req, res) => {
  try {
    const { savedSignature, autoUseSignature } = req.body;
    const update = {};
    if (savedSignature !== undefined) update.savedSignature = savedSignature;
    if (autoUseSignature !== undefined) update.autoUseSignature = autoUseSignature;
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .select('-password');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/me/signature — supprimer sa signature
router.delete('/me/signature', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id,
      { savedSignature: '', autoUseSignature: false }, { new: true }).select('-password');
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/manager-info — responsable principal de l'utilisateur connecté
router.get('/manager-info', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('managerId managerIds');
    if (!me?.managerId) return res.json(null);
    const manager = await User.findById(me.managerId).select('name login site _id');
    res.json(manager);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/all-managers — TOUS les responsables de l'utilisateur connecté (multi-managers)
router.get('/all-managers', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('managerId managerIds');
    if (!me) return res.json([]);
    const allIds = new Set();
    if (me.managerId) allIds.add(String(me.managerId));
    (me.managerIds || []).forEach(id => allIds.add(String(id)));
    if (!allIds.size) return res.json([]);
    const managers = await User.find({ _id: { $in: [...allIds] } }).select('name login site _id');
    res.json(managers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/subordinates — subordonnés de l'utilisateur connecté (tous)
router.get('/subordinates', auth, async (req, res) => {
  try {
    const subs = await User.find({
      $or: [{ managerId: req.user._id }, { managerIds: req.user._id }]
    }).select('name login site _id');
    res.json(subs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users — liste complète (admin seulement)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('managerId',  'name login _id')
      .populate('managerIds', 'name login _id')
      .sort('name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users — créer (admin seulement)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { login, name, password, role, site, email, managerId, managerIds } = req.body;
    if (!login || !name || !password)
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    if (await User.findOne({ login }))
      return res.status(409).json({ error: 'Identifiant déjà utilisé' });
    const hash = await bcrypt.hash(password, 10);
    const allMgrIds = _mergeManagerIds(managerId, managerIds);
    const user = await User.create({
      login, name, password: hash, role: role||'user', site: site||'', email: email||'',
      managerId:  allMgrIds[0] || null,
      managerIds: allMgrIds,
    });
    const obj = user.toObject(); delete obj.password;
    res.status(201).json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/:id — modifier (admin seulement)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, role, site, email, managerId, managerIds, password } = req.body;
    const allMgrIds = _mergeManagerIds(managerId, managerIds);
    const update = {
      name, role, site: site||'', email: email||'',
      managerId:  allMgrIds[0] || null,
      managerIds: allMgrIds,
    };
    if (password) update.password = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('-password')
      .populate('managerId',  'name login _id')
      .populate('managerIds', 'name login _id');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:id (admin seulement)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.login === 'admin') return res.status(403).json({ error: 'Impossible de supprimer l\'admin principal' });
    await user.deleteOne();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Helper : fusionner managerId + managerIds sans doublons ──────────────
function _mergeManagerIds(managerId, managerIds) {
  const mongoose = require('mongoose');
  const seen = new Set(); const result = [];
  const add = (id) => {
    const s = String(id||'').trim();
    if (s && mongoose.Types.ObjectId.isValid(s) && !seen.has(s)) {
      seen.add(s);
      result.push(new mongoose.Types.ObjectId(s));
    }
  };
  if (managerId) add(managerId);
  if (Array.isArray(managerIds)) managerIds.forEach(add);
  return result;
}

module.exports = router;
