// routes/data.js — Routes pour toutes les données de l'app
const router = require('express').Router();
const mongoose = require('mongoose');
const { auth, adminOnly } = require('../middleware/auth');
const {
  Company, ExternalCompany, Worker,
  PPlan, Report, Settings,
  CustomRisk, CustomKeyword, CustomType, HiddenRisk,
  Validation, User
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
    const { name, siret, addr, tel, email, resp, instructions } = req.body;
    if (name) co.name = name;
    if (siret !== undefined) co.siret = siret;
    if (addr !== undefined) co.addr = addr;
    if (tel !== undefined) co.tel = tel;
    if (email !== undefined) co.email = email;
    if (resp !== undefined) co.resp = resp;
    if (instructions !== undefined) co.instructions = instructions;
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
    const { name, rep, tel, email, addr } = req.body;
    res.status(201).json(await ExternalCompany.create({ name, rep, tel, email, addr }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/companies/:id', auth, async (req, res) => {
  try { await ExternalCompany.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
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
    const { name, co, qual, role, tel } = req.body;
    res.status(201).json(await Worker.create({ name, co, qual, role, tel }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/workers/:id', auth, async (req, res) => {
  try { await Worker.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
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
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    let pp = await PPlan.findOne({ name });
    if (pp) {
      pp.isTemplate = isTemplate; pp.data = data;
      pp.evalState = evalState; pp.createdBy = req.user.name;
      await pp.save();
    } else {
      pp = await PPlan.create({ name, isTemplate, data, evalState, createdBy: req.user.name });
    }
    res.json(pp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/pplist/:id', auth, async (req, res) => {
  try { await PPlan.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RAPPORTS
// ─────────────────────────────────────────────────────────────
router.get('/reports', auth, adminOnly, async (req, res) => {
  try { res.json(await Report.find().sort('-createdAt').limit(200)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/reports', auth, async (req, res) => {
  try {
    const { type, label, summary } = req.body;
    res.status(201).json(await Report.create({ type: type||'eval', label: label||'', summary: summary||{}, createdBy: req.user.name }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/reports/:id', auth, adminOnly, async (req, res) => {
  try { await Report.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES CUSTOM
// ─────────────────────────────────────────────────────────────
router.get('/custom-risks', auth, async (req, res) => {
  try {
    const risks = await CustomRisk.find();
    const byType = {};
    risks.forEach(r => {
      if (!byType[r.interventionType]) byType[r.interventionType] = [];
      byType[r.interventionType].push({ id: r.riskId, name: r.name, sev: r.sev, causes: r.causes, consequences: r.consequences, solutions: r.solutions });
    });
    res.json(byType);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/custom-risks', auth, adminOnly, async (req, res) => {
  try {
    const { interventionType, id, name, sev, causes, consequences, solutions } = req.body;
    res.json(await CustomRisk.findOneAndUpdate({ riskId: id }, { interventionType, riskId: id, name, sev, causes, consequences, solutions }, { upsert: true, new: true }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/custom-risks/:riskId', auth, adminOnly, async (req, res) => {
  try { await CustomRisk.findOneAndDelete({ riskId: req.params.riskId }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
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
    res.json(await CustomKeyword.findOneAndUpdate({ kwId: id }, { kwId: id, type, words: w, risks: r, score: s }, { upsert: true, new: true }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/custom-keywords/:kwId', auth, adminOnly, async (req, res) => {
  try { await CustomKeyword.findOneAndDelete({ kwId: req.params.kwId }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// TYPES D'INTERVENTION CUSTOM
// ─────────────────────────────────────────────────────────────
router.get('/custom-types', auth, async (req, res) => {
  try { res.json((await CustomType.find()).map(t => t.name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/custom-types', auth, adminOnly, async (req, res) => {
  try { await CustomType.findOneAndUpdate({ name: req.body.name }, { name: req.body.name }, { upsert: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/custom-types/:name', auth, adminOnly, async (req, res) => {
  try { await CustomType.findOneAndDelete({ name: req.params.name }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES MASQUÉS
// ─────────────────────────────────────────────────────────────
router.get('/hidden-risks', auth, async (req, res) => {
  try {
    const hidden = await HiddenRisk.find();
    const byType = {};
    hidden.forEach(h => { if (!byType[h.interventionType]) byType[h.interventionType] = []; byType[h.interventionType].push(h.riskId); });
    res.json(byType);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/hidden-risks', auth, adminOnly, async (req, res) => {
  try { const { interventionType, riskId } = req.body; await HiddenRisk.findOneAndUpdate({ interventionType, riskId }, { interventionType, riskId }, { upsert: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/hidden-risks', auth, adminOnly, async (req, res) => {
  try { const { interventionType, riskId } = req.body; await HiddenRisk.findOneAndDelete({ interventionType, riskId }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// PARAMÈTRES
// ─────────────────────────────────────────────────────────────
router.get('/settings/:key', auth, async (req, res) => {
  try { const s = await Settings.findOne({ key: req.params.key }); res.json(s ? s.value : null); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/settings/:key', auth, adminOnly, async (req, res) => {
  try { await Settings.findOneAndUpdate({ key: req.params.key }, { key: req.params.key, value: req.body.value }, { upsert: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// VALIDATIONS
// ─────────────────────────────────────────────────────────────

// GET — validations pour le manager connecté
router.get('/validations', auth, async (req, res) => {
  try { res.json(await Validation.find({ managerId: req.user._id }).sort('-createdAt')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST — soumettre un rapport pour validation
router.post('/validations', auth, async (req, res) => {
  try {
    const { managerId, level, evalSnapshot, sigIntervenant } = req.body;

    // Logs pour debug
    console.log('[POST /validations] managerId reçu:', managerId);
    console.log('[POST /validations] req.user._id:', req.user._id);

    // Valider managerId
    if (!managerId || !mongoose.Types.ObjectId.isValid(String(managerId))) {
      return res.status(400).json({
        error: 'managerId invalide : "' + managerId + '". Assignez un responsable à cet utilisateur dans le panel Admin → Utilisateurs.'
      });
    }

    // Vérifier que le manager existe
    const manager = await User.findById(managerId).select('name site');
    if (!manager) {
      return res.status(404).json({ error: 'Responsable introuvable.' });
    }

    // Nettoyer evalSnapshot — supprimer tout champ _id ou id qui pourrait casser Mongoose
    const cleanSnapshot = JSON.parse(JSON.stringify(evalSnapshot || {}));
    if (cleanSnapshot.risks) {
      cleanSnapshot.risks = cleanSnapshot.risks.map(r => ({
        id:       String(r.id || ''),   // conservé pour lier aux dérogations
        name:     String(r.name || ''),
        sev:      String(r.sev  || 'medium'),
        type:     String(r.type || ''),
        isManual: r.isManual || false
      }));
    }
    // Conserver les dérogations telles quelles (objet clé=riskId)
    if (cleanSnapshot.derogations && typeof cleanSnapshot.derogations === 'object') {
      // Sanity check : garder seulement les dérogations actives avec justification string
      Object.keys(cleanSnapshot.derogations).forEach(k => {
        const d = cleanSnapshot.derogations[k];
        if (!d || !d.active) { delete cleanSnapshot.derogations[k]; return; }
        cleanSnapshot.derogations[k] = {
          active:        true,
          justification: String(d.justification || ''),
          signataire:    String(d.signataire || '')
        };
      });
    }

    const v = await Validation.create({
      managerId:      new mongoose.Types.ObjectId(managerId),
      submittedBy:    req.user._id,
      submitterName:  req.user.name  || '',
      submitterSite:  req.user.site  || '—',
      level:          level          || 'medium',
      status:         'pending',
      evalSnapshot:   cleanSnapshot,
      sigIntervenant: sigIntervenant || null,
      sigManager:     null,
      managerName:    manager.name   || '',
      comment:        ''
    });

    console.log('[POST /validations] Créé:', v._id);
    res.status(201).json(v);
  } catch (e) {
    console.error('[POST /validations] ERREUR:', e.message);
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
    if (req.body.status)              v.status     = req.body.status;
    if (req.body.comment !== undefined) v.comment  = req.body.comment;
    if (req.body.sigManager)          v.sigManager = req.body.sigManager;
    v.treatedAt  = new Date();
    v.managerName = req.user.name;
    await v.save();
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /validations/:id
router.delete('/validations/:id', auth, adminOnly, async (req, res) => {
  try { await Validation.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
