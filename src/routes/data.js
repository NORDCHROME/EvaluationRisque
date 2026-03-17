// routes/data.js — Routes pour toutes les données de l'app
const router = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');
const {
  Company, ExternalCompany, Worker,
  PPlan, Report, Settings,
  CustomRisk, CustomKeyword, CustomType, HiddenRisk
} = require('../models');

// ─────────────────────────────────────────────────────────────
// SOCIÉTÉ
// ─────────────────────────────────────────────────────────────
router.get('/company', auth, async (req, res) => {
  try {
    let co = await Company.findOne();
    if (!co) co = await Company.create({ name: 'NORDCHROME' });
    res.json(co);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/company', auth, adminOnly, async (req, res) => {
  try {
    let co = await Company.findOne();
    if (!co) co = new Company();
    Object.assign(co, req.body);
    await co.save();
    res.json(co);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// CARNET — Entreprises extérieures
// ─────────────────────────────────────────────────────────────
router.get('/companies', auth, async (req, res) => {
  try { res.json(await ExternalCompany.find().sort('name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/companies', auth, async (req, res) => {
  try {
    const co = await ExternalCompany.create(req.body);
    res.status(201).json(co);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/companies/:id', auth, async (req, res) => {
  try {
    await ExternalCompany.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// CARNET — Intervenants
// ─────────────────────────────────────────────────────────────
router.get('/workers', auth, async (req, res) => {
  try { res.json(await Worker.find().sort('name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workers', auth, async (req, res) => {
  try {
    const w = await Worker.create(req.body);
    res.status(201).json(w);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/workers/:id', auth, async (req, res) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// PLANS DE PRÉVENTION
// ─────────────────────────────────────────────────────────────
router.get('/pplist', auth, async (req, res) => {
  try { res.json(await PPlan.find().sort('-createdAt')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pplist', auth, async (req, res) => {
  try {
    const { name, isTemplate, data, evalState } = req.body;
    // Upsert par nom
    let pp = await PPlan.findOne({ name });
    if (pp) {
      pp.isTemplate = isTemplate;
      pp.data = data;
      pp.evalState = evalState;
      pp.createdBy = req.user.name;
      await pp.save();
    } else {
      pp = await PPlan.create({ name, isTemplate, data, evalState, createdBy: req.user.name });
    }
    res.json(pp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/pplist/:id', auth, async (req, res) => {
  try {
    await PPlan.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RAPPORTS (historique)
// ─────────────────────────────────────────────────────────────
router.get('/reports', auth, adminOnly, async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (search) filter.label = { $regex: search, $options: 'i' };
    res.json(await Report.find(filter).sort('-createdAt').limit(200));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/reports', auth, async (req, res) => {
  try {
    const r = await Report.create({ ...req.body, createdBy: req.user.name });
    res.status(201).json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/reports/:id', auth, adminOnly, async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES CUSTOM
// ─────────────────────────────────────────────────────────────
router.get('/custom-risks', auth, async (req, res) => {
  try {
    const risks = await CustomRisk.find();
    // Regrouper par type pour retourner le même format que le frontend
    const byType = {};
    risks.forEach(r => {
      if (!byType[r.interventionType]) byType[r.interventionType] = [];
      byType[r.interventionType].push({
        id: r.riskId, name: r.name, sev: r.sev,
        causes: r.causes, consequences: r.consequences, solutions: r.solutions
      });
    });
    res.json(byType);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/custom-risks', auth, adminOnly, async (req, res) => {
  try {
    const { interventionType, id, name, sev, causes, consequences, solutions } = req.body;
    const r = await CustomRisk.findOneAndUpdate(
      { riskId: id },
      { interventionType, riskId: id, name, sev, causes, consequences, solutions },
      { upsert: true, new: true }
    );
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/custom-risks/:riskId', auth, adminOnly, async (req, res) => {
  try {
    await CustomRisk.findOneAndDelete({ riskId: req.params.riskId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// MOTS-CLÉS CUSTOM
// ─────────────────────────────────────────────────────────────
router.get('/custom-keywords', auth, async (req, res) => {
  try {
    const kws = await CustomKeyword.find();
    res.json(kws.map(k => ({ id: k.kwId, type: k.type, w: k.words, r: k.risks, s: k.score })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/custom-keywords', auth, adminOnly, async (req, res) => {
  try {
    const { id, type, w, r, s } = req.body;
    const kw = await CustomKeyword.findOneAndUpdate(
      { kwId: id },
      { kwId: id, type, words: w, risks: r, score: s },
      { upsert: true, new: true }
    );
    res.json(kw);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/custom-keywords/:kwId', auth, adminOnly, async (req, res) => {
  try {
    await CustomKeyword.findOneAndDelete({ kwId: req.params.kwId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// TYPES D'INTERVENTION CUSTOM
// ─────────────────────────────────────────────────────────────
router.get('/custom-types', auth, async (req, res) => {
  try {
    const types = await CustomType.find();
    res.json(types.map(t => t.name));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/custom-types', auth, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    await CustomType.findOneAndUpdate({ name }, { name }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/custom-types/:name', auth, adminOnly, async (req, res) => {
  try {
    await CustomType.findOneAndDelete({ name: req.params.name });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES MASQUÉS
// ─────────────────────────────────────────────────────────────
router.get('/hidden-risks', auth, async (req, res) => {
  try {
    const hidden = await HiddenRisk.find();
    const byType = {};
    hidden.forEach(h => {
      if (!byType[h.interventionType]) byType[h.interventionType] = [];
      byType[h.interventionType].push(h.riskId);
    });
    res.json(byType);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/hidden-risks', auth, adminOnly, async (req, res) => {
  try {
    const { interventionType, riskId } = req.body;
    await HiddenRisk.findOneAndUpdate({ interventionType, riskId }, { interventionType, riskId }, { upsert: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/hidden-risks', auth, adminOnly, async (req, res) => {
  try {
    const { interventionType, riskId } = req.body;
    await HiddenRisk.findOneAndDelete({ interventionType, riskId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// PARAMÈTRES (features, signature settings, hidden types)
// ─────────────────────────────────────────────────────────────
router.get('/settings/:key', auth, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: req.params.key });
    res.json(s ? s.value : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings/:key', auth, adminOnly, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: req.params.key },
      { key: req.params.key, value: req.body.value },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// VALIDATIONS
// ─────────────────────────────────────────────────────────────
const { Validation } = require('../models');

// GET — validations pour le manager connecté
router.get('/validations', auth, async (req, res) => {
  try {
    const validations = await Validation.find({ managerId: req.user._id }).sort('-createdAt');
    res.json(validations);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /validations/pending-count — nombre en attente
router.get('/validations/pending-count', auth, async (req, res) => {
  try {
    const count = await Validation.countDocuments({ managerId: req.user._id, status: 'pending' });
    res.json({ count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — soumettre un rapport pour validation
router.post('/validations', auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { managerId } = req.body;

    // Valider que managerId est un ObjectId MongoDB valide
    if (!managerId || !mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({
        error: 'managerId invalide : "' + managerId + '". Vérifiez que le responsable est correctement configuré dans le panel admin.'
      });
    }

    // Vérifier que le responsable existe
    const { User } = require('../models');
    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ error: 'Responsable introuvable en base de données.' });
    }

    const v = await Validation.create({
      ...req.body,
      managerId,
      submittedBy:   req.user._id,
      submitterName: req.body.submitterName || req.user.name,
      submitterSite: req.body.submitterSite || req.user.site || '—'
    });
    res.status(201).json(v);
  } catch (e) {
    console.error('Erreur création validation:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /validations/:id — valider ou refuser
router.put('/validations/:id', auth, async (req, res) => {
  try {
    const v = await Validation.findById(req.params.id);
    if (!v) return res.status(404).json({ error: 'Validation introuvable' });
    if (String(v.managerId) !== String(req.user._id))
      return res.status(403).json({ error: 'Non autorisé' });
    Object.assign(v, req.body);
    v.treatedAt = new Date();
    v.managerName = req.user.name;
    await v.save();
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /validations/:id (admin)
router.delete('/validations/:id', auth, adminOnly, async (req, res) => {
  try {
    await Validation.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
