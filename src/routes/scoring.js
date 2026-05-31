// routes/scoring.js — API scoring config + EPI obligatoires
const router   = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');
const { ScoringConfig, MandatoryEPI } = require('../models');
const { DEFAULTS, slugify } = require('../scoring');

// ── GET /scoring/config — config complète ─────────────────────────────────────
router.get('/config', auth, async (req, res) => {
  try {
    const docs = await ScoringConfig.find({});
    const cfg  = { ...DEFAULTS };
    docs.forEach(d => { cfg[d.key] = d.value; });

    // EPI/EPC scores
    const epiDocs = await ScoringConfig.find({ key: /^(epi|epc)_/ });
    const epiScores = {};
    epiDocs.forEach(d => { epiScores[d.key] = d.value; });

    res.json({ cfg, epiScores });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /scoring/config — mettre à jour un paramètre ─────────────────────────
router.put('/config', auth, adminOnly, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key requis' });
    await ScoringConfig.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true });
    res.json({ ok: true, key, value });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /scoring/config/bulk — mettre à jour plusieurs paramètres ─────────────
router.put('/config/bulk', auth, adminOnly, async (req, res) => {
  try {
    const { updates } = req.body; // [{ key, value }, ...]
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates[] requis' });
    await Promise.all(updates.map(({ key, value }) =>
      ScoringConfig.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true })
    ));
    res.json({ ok: true, count: updates.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /scoring/epi-scores — scores de chaque EPI/EPC connu ─────────────────
router.get('/epi-scores', auth, async (req, res) => {
  try {
    const docs = await ScoringConfig.find({ key: /^(epi|epc)_/ });
    const map  = {};
    docs.forEach(d => { map[d.key] = d.value; });
    res.json(map);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /scoring/mandatory — EPI obligatoires ────────────────────────────────
router.get('/mandatory', auth, async (req, res) => {
  try {
    const list = await MandatoryEPI.find({}).sort({ order: 1 });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /scoring/mandatory — ajouter un EPI obligatoire ─────────────────────
router.post('/mandatory', auth, adminOnly, async (req, res) => {
  try {
    const { name, type, interventionType, scoreDeduction, order } = req.body;
    if (!name) return res.status(400).json({ error: 'name requis' });
    const doc = await MandatoryEPI.create({
      name, type: type || 'global',
      interventionType: interventionType || '',
      scoreDeduction: scoreDeduction ?? 10,
      order: order ?? 0,
    });
    res.status(201).json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /scoring/mandatory/:id — modifier ────────────────────────────────────
router.put('/mandatory/:id', auth, adminOnly, async (req, res) => {
  try {
    const doc = await MandatoryEPI.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ error: 'Non trouvé' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /scoring/mandatory/:id ────────────────────────────────────────────
router.delete('/mandatory/:id', auth, adminOnly, async (req, res) => {
  try {
    await MandatoryEPI.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /scoring/simulate — calculer le score d'un snapshot (preview) ────────
router.post('/simulate', auth, async (req, res) => {
  try {
    const { evaluateReport } = require('../scoring');
    const result = await evaluateReport(req.body.evalSnapshot || {});
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
