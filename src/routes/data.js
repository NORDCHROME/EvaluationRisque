// routes/data.js — v2 (risques/mots-clés/types en DB + config UI + PP config)
const router   = require('express').Router();
const mongoose = require('mongoose');
const { auth, adminOnly } = require('../middleware/auth');
const {
  Company, ExternalCompany, Worker,
  PPlan, Report, Settings,
  Risk, KeywordRule, InterventionType, EPIItem,
  UIConfig, PPConfig,
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
    const fields = ['name','siret','addr','tel','email','resp','instructions','logoData','logoUrl','brandColors'];
    fields.forEach(f => { if (req.body[f] !== undefined) co[f] = req.body[f]; });
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
// TYPES D'INTERVENTION (nouveau — stockés en DB)
// ─────────────────────────────────────────────────────────────
router.get('/intervention-types', auth, async (req, res) => {
  try {
    const types = await InterventionType.find({ hidden: false }).sort('order name');
    res.json(types);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/intervention-types/all', auth, adminOnly, async (req, res) => {
  try {
    const types = await InterventionType.find().sort('order name');
    res.json(types);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/intervention-types', auth, adminOnly, async (req, res) => {
  try {
    const { name, icon, order, source } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const existing = await InterventionType.findOne({ name });
    if (existing) return res.status(409).json({ error: 'Type déjà existant' });
    const maxOrder = await InterventionType.findOne().sort('-order');
    const t = await InterventionType.create({
      name, icon: icon||'🔩', order: order !== undefined ? order : (maxOrder ? maxOrder.order+1 : 0),
      source: source||'custom', hidden: false
    });
    res.status(201).json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/intervention-types/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, icon, order, hidden } = req.body;
    const t = await InterventionType.findByIdAndUpdate(
      req.params.id,
      { ...(name !== undefined && { name }), ...(icon !== undefined && { icon }), ...(order !== undefined && { order }), ...(hidden !== undefined && { hidden }) },
      { new: true }
    );
    if (!t) return res.status(404).json({ error: 'Type introuvable' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Réordonner en masse
router.put('/intervention-types-order', auth, adminOnly, async (req, res) => {
  try {
    const { order } = req.body; // [{ id, order }]
    await Promise.all(order.map(item => InterventionType.findByIdAndUpdate(item.id, { order: item.order })));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/intervention-types/:id', auth, adminOnly, async (req, res) => {
  try {
    const t = await InterventionType.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Type introuvable' });
    if (t.source === 'builtin') {
      // Soft-delete pour les types intégrés
      t.hidden = true; await t.save();
    } else {
      await t.deleteOne();
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES (nouveau — stockés en DB)
// ─────────────────────────────────────────────────────────────
router.get('/risks', auth, async (req, res) => {
  try {
    const filter = { hidden: false };
    if (req.query.type) filter.interventionType = req.query.type;
    if (req.query.sev)  filter.sev = req.query.sev;
    const risks = await Risk.find(filter).sort('interventionType order name');
    res.json(risks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/risks/all', auth, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.interventionType = req.query.type;
    const risks = await Risk.find(filter).sort('interventionType order name');
    res.json(risks);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/risks/:riskId', auth, async (req, res) => {
  try {
    const r = await Risk.findOne({ riskId: req.params.riskId });
    if (!r) return res.status(404).json({ error: 'Risque introuvable' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/risks', auth, adminOnly, async (req, res) => {
  try {
    const { riskId, interventionType, name, sev, causes, consequences, solutions, source, order } = req.body;
    if (!name || !interventionType) return res.status(400).json({ error: 'Nom et type requis' });
    const id = riskId || ('cx' + Date.now());
    const maxOrder = await Risk.findOne({ interventionType }).sort('-order');
    const r = await Risk.findOneAndUpdate(
      { riskId: id },
      { riskId: id, interventionType, name, sev: sev||'medium', causes: causes||[], consequences: consequences||[], solutions: solutions||[], source: source||'custom', order: order !== undefined ? order : (maxOrder ? maxOrder.order+1 : 0), hidden: false },
      { upsert: true, new: true }
    );
    res.status(201).json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/risks/:riskId', auth, adminOnly, async (req, res) => {
  try {
    const { name, sev, causes, consequences, solutions, interventionType, hidden, order } = req.body;
    const r = await Risk.findOneAndUpdate(
      { riskId: req.params.riskId },
      { ...(name !== undefined && { name }), ...(sev !== undefined && { sev }), ...(causes !== undefined && { causes }), ...(consequences !== undefined && { consequences }), ...(solutions !== undefined && { solutions }), ...(interventionType !== undefined && { interventionType }), ...(hidden !== undefined && { hidden }), ...(order !== undefined && { order }) },
      { new: true }
    );
    if (!r) return res.status(404).json({ error: 'Risque introuvable' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/risks/:riskId', auth, adminOnly, async (req, res) => {
  try {
    const r = await Risk.findOne({ riskId: req.params.riskId });
    if (!r) return res.status(404).json({ error: 'Risque introuvable' });
    if (r.source === 'builtin') {
      r.hidden = true; await r.save();
    } else {
      await r.deleteOne();
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import en masse (seed depuis le frontend)
router.post('/risks/bulk-import', auth, adminOnly, async (req, res) => {
  try {
    const { risks } = req.body; // [{ riskId, interventionType, name, sev, causes, consequences, solutions }]
    if (!Array.isArray(risks)) return res.status(400).json({ error: 'risks doit être un tableau' });
    let created = 0, updated = 0;
    for (const r of risks) {
      const exists = await Risk.findOne({ riskId: r.riskId });
      if (exists) {
        // Ne pas écraser les modifications admin
        if (exists.source === 'builtin') { updated++; continue; }
        await Risk.findOneAndUpdate({ riskId: r.riskId }, r);
        updated++;
      } else {
        await Risk.create({ ...r, source: r.source || 'builtin' });
        created++;
      }
    }
    res.json({ ok: true, created, updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// MOTS-CLÉS IA (nouveau — stockés en DB)
// ─────────────────────────────────────────────────────────────
router.get('/keyword-rules', auth, async (req, res) => {
  try {
    const filter = { hidden: false };
    if (req.query.type) filter.interventionType = req.query.type;
    const rules = await KeywordRule.find(filter).sort('interventionType score');
    res.json(rules.map(r => ({ id: r.kwId, _mongoId: r._id, type: r.interventionType, w: r.words, r: r.riskIds, s: r.score, source: r.source })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/keyword-rules/all', auth, adminOnly, async (req, res) => {
  try {
    const rules = await KeywordRule.find().sort('interventionType score');
    res.json(rules.map(r => ({ id: r.kwId, _mongoId: r._id, type: r.interventionType, w: r.words, r: r.riskIds, s: r.score, source: r.source, hidden: r.hidden })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/keyword-rules', auth, adminOnly, async (req, res) => {
  try {
    const { id, type, w, r, s, source } = req.body;
    const kwId = id || ('kw' + Date.now());
    const rule = await KeywordRule.findOneAndUpdate(
      { kwId },
      { kwId, interventionType: type, words: w||[], riskIds: r||[], score: s||4, source: source||'custom', hidden: false },
      { upsert: true, new: true }
    );
    res.status(201).json({ id: rule.kwId, type: rule.interventionType, w: rule.words, r: rule.riskIds, s: rule.score });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/keyword-rules/:kwId', auth, adminOnly, async (req, res) => {
  try {
    const { type, w, r, s, hidden } = req.body;
    const rule = await KeywordRule.findOneAndUpdate(
      { kwId: req.params.kwId },
      { ...(type !== undefined && { interventionType: type }), ...(w !== undefined && { words: w }), ...(r !== undefined && { riskIds: r }), ...(s !== undefined && { score: s }), ...(hidden !== undefined && { hidden }) },
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json({ id: rule.kwId, type: rule.interventionType, w: rule.words, r: rule.riskIds, s: rule.score });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/keyword-rules/:kwId', auth, adminOnly, async (req, res) => {
  try {
    const rule = await KeywordRule.findOne({ kwId: req.params.kwId });
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    if (rule.source === 'builtin') {
      rule.hidden = true; await rule.save();
    } else {
      await rule.deleteOne();
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import en masse des mots-clés
router.post('/keyword-rules/bulk-import', auth, adminOnly, async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules doit être un tableau' });
    let created = 0;
    for (const r of rules) {
      const exists = await KeywordRule.findOne({ kwId: r.id });
      if (!exists) {
        await KeywordRule.create({ kwId: r.id, interventionType: r.type, words: r.w, riskIds: r.r, score: r.s, source: 'builtin' });
        created++;
      }
    }
    res.json({ ok: true, created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// EPI/EPC Catalogue (nouveau — stocké en DB)
// ─────────────────────────────────────────────────────────────
router.get('/epi-items', auth, async (req, res) => {
  try {
    const filter = { hidden: false };
    if (req.query.type)     filter.interventionType = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    const items = await EPIItem.find(filter).sort('interventionType category order label');
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/epi-items', auth, adminOnly, async (req, res) => {
  try {
    const { interventionType, category, label, source, order } = req.body;
    if (!interventionType || !category || !label) return res.status(400).json({ error: 'Type, catégorie et libellé requis' });
    const item = await EPIItem.create({ interventionType, category, label, source: source||'custom', order: order||0 });
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/epi-items/:id', auth, adminOnly, async (req, res) => {
  try {
    const item = await EPIItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Item introuvable' });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/epi-items/:id', auth, adminOnly, async (req, res) => {
  try {
    const item = await EPIItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item introuvable' });
    if (item.source === 'builtin') { item.hidden = true; await item.save(); }
    else { await item.deleteOne(); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import EPI en masse
router.post('/epi-items/bulk-import', auth, adminOnly, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items doit être un tableau' });
    let created = 0;
    for (const it of items) {
      const exists = await EPIItem.findOne({ interventionType: it.interventionType, category: it.category, label: it.label });
      if (!exists) { await EPIItem.create({ ...it, source: 'builtin' }); created++; }
    }
    res.json({ ok: true, created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// CONFIG UI (nouveau — boutons, labels, fonctionnalités)
// ─────────────────────────────────────────────────────────────
router.get('/ui-config/:section', auth, async (req, res) => {
  try {
    const cfg = await UIConfig.findOne({ section: req.params.section });
    res.json(cfg ? cfg.config : null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ui-config', auth, async (req, res) => {
  try {
    const cfgs = await UIConfig.find();
    const result = {};
    cfgs.forEach(c => { result[c.section] = c.config; });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/ui-config/:section', auth, adminOnly, async (req, res) => {
  try {
    const { config } = req.body;
    const cfg = await UIConfig.findOneAndUpdate(
      { section: req.params.section },
      { section: req.params.section, config },
      { upsert: true, new: true }
    );
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset une section UI
router.delete('/ui-config/:section', auth, adminOnly, async (req, res) => {
  try {
    await UIConfig.findOneAndDelete({ section: req.params.section });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// CONFIG PLAN DE PRÉVENTION (nouveau)
// ─────────────────────────────────────────────────────────────
router.get('/pp-config', auth, async (req, res) => {
  try {
    let cfg = await PPConfig.findOne();
    if (!cfg) cfg = await PPConfig.create(getDefaultPPConfig());
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pp-config', auth, adminOnly, async (req, res) => {
  try {
    let cfg = await PPConfig.findOne();
    if (!cfg) cfg = new PPConfig();
    const fields = ['sections','customFields','permits','checklist','riskLevels','pdfOptions','defaultEmergency'];
    fields.forEach(f => { if (req.body[f] !== undefined) cfg[f] = req.body[f]; });
    await cfg.save();
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset PP config
router.delete('/pp-config', auth, adminOnly, async (req, res) => {
  try {
    await PPConfig.deleteMany();
    const cfg = await PPConfig.create(getDefaultPPConfig());
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function getDefaultPPConfig() {
  return {
    sections: [
      { id: 'parties',    label: '🏢 Identification des parties',      enabled: true, order: 1 },
      { id: 'permits',    label: '📝 Permis et autorisations',          enabled: true, order: 2 },
      { id: 'analyses',   label: '🔍 Analyses préalables',              enabled: true, order: 3 },
      { id: 'steps',      label: '🔢 Étapes de l\'intervention',        enabled: true, order: 4 },
      { id: 'workers',    label: '👷 Intervenants EE',                  enabled: true, order: 5 },
      { id: 'measures',   label: '⚙️ Mesures de coactivité',            enabled: true, order: 6 },
      { id: 'instructions',label:'📌 Instructions permanentes',          enabled: true, order: 7 },
      { id: 'emergency',  label: '🚨 Numéros d\'urgence',               enabled: true, order: 8 },
      { id: 'signatures', label: '✍️ Signatures',                       enabled: true, order: 9 },
    ],
    customFields: [],
    permits: [
      { id: 'feu',         label: 'Permis de feu',          icon: '🔥', enabled: true, order: 1 },
      { id: 'ec',          label: 'Pénétration EC',         icon: '🕳️', enabled: true, order: 2 },
      { id: 'elec',        label: 'Consignation électrique',icon: '⚡', enabled: true, order: 3 },
      { id: 'hauteur',     label: 'Travaux en hauteur',     icon: '🏗️', enabled: true, order: 4 },
      { id: 'levage',      label: 'Levage exceptionnel',    icon: '🏋️', enabled: true, order: 5 },
      { id: 'fouilles',    label: 'Fouilles / Tranchées',   icon: '⛏️', enabled: true, order: 6 },
      { id: 'atex',        label: 'Zone ATEX',              icon: '💥', enabled: true, order: 7 },
      { id: 'amiante',     label: 'Amiante SS4',            icon: '⚠️', enabled: true, order: 8 },
    ],
    checklist: [
      { id: 'visite',      label: 'Visite conjointe EU/EE réalisée',   enabled: true, order: 1 },
      { id: 'plan',        label: 'Plan de masse communiqué',           enabled: true, order: 2 },
      { id: 'reseaux',     label: 'Repérage réseaux (DICT)',            enabled: true, order: 3 },
      { id: 'amiante',     label: 'Repérage amiante (DTA)',             enabled: true, order: 4 },
      { id: 'ppsps',       label: 'PPSPS / PGCSPS fourni',             enabled: true, order: 5 },
      { id: 'secours',     label: 'Plan de secours transmis',           enabled: true, order: 6 },
      { id: 'formation',   label: 'Habilitations vérifiées',            enabled: true, order: 7 },
      { id: 'sst',         label: 'SST désigné sur chantier',           enabled: true, order: 8 },
      { id: 'signalement', label: 'Procédure signalement définie',      enabled: true, order: 9 },
    ],
    riskLevels: [
      { value: 'low',    label: '🟢 Faible',   color: '#2d6a4f', order: 1 },
      { value: 'medium', label: '🟠 Modéré',   color: '#d97706', order: 2 },
      { value: 'high',   label: '🔴 Critique', color: '#c0392b', order: 3 },
    ],
    pdfOptions: {
      showLogo: true, showSignatures: true, showEmergency: true,
      footerText: 'EvalRisque — NORDCHROME', pageFormat: 'a4', watermark: ''
    },
    defaultEmergency: { samu: '15', pompiers: '18', police: '17', siteLabel: 'Contact site' }
  };
}

// ─────────────────────────────────────────────────────────────
// PARAMÈTRES (inchangés)
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
// VALIDATIONS (inchangées)
// ─────────────────────────────────────────────────────────────
router.get('/validations', auth, async (req, res) => {
  try { res.json(await Validation.find({ managerId: req.user._id }).sort('-createdAt')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/validations', auth, async (req, res) => {
  try {
    const { managerId, level, evalSnapshot, sigIntervenant } = req.body;
    if (!managerId || !mongoose.Types.ObjectId.isValid(String(managerId))) {
      return res.status(400).json({ error: 'managerId invalide' });
    }
    const manager = await User.findById(managerId).select('name site');
    if (!manager) return res.status(404).json({ error: 'Responsable introuvable.' });

    const cleanSnapshot = JSON.parse(JSON.stringify(evalSnapshot || {}));
    if (cleanSnapshot.risks) {
      cleanSnapshot.risks = cleanSnapshot.risks.map(r => ({
        id: String(r.id||''), name: String(r.name||''), sev: String(r.sev||'medium'),
        type: String(r.type||''), isManual: r.isManual||false,
        solutions: r.solutions||[], epc: r.epc||[], epi: r.epi||[]
      }));
    }
    if (cleanSnapshot.derogations && typeof cleanSnapshot.derogations === 'object') {
      Object.keys(cleanSnapshot.derogations).forEach(k => {
        const d = cleanSnapshot.derogations[k];
        if (!d || !d.active) { delete cleanSnapshot.derogations[k]; return; }
        cleanSnapshot.derogations[k] = { active: true, justification: String(d.justification||''), signataire: String(d.signataire||'') };
      });
    }
    const v = await Validation.create({
      managerId: new mongoose.Types.ObjectId(managerId), submittedBy: req.user._id,
      submitterName: req.user.name||'', submitterSite: req.user.site||'—',
      level: level||'medium', status: 'pending', evalSnapshot: cleanSnapshot,
      sigIntervenant: sigIntervenant||null, sigManager: null, managerName: manager.name||'', comment: ''
    });
    res.status(201).json(v);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

router.put('/validations/:id', auth, async (req, res) => {
  try {
    const v = await Validation.findById(req.params.id);
    if (!v) return res.status(404).json({ error: 'Validation introuvable' });
    if (String(v.managerId) !== String(req.user._id)) return res.status(403).json({ error: 'Non autorisé' });
    if (req.body.status)              v.status     = req.body.status;
    if (req.body.comment !== undefined) v.comment  = req.body.comment;
    if (req.body.sigManager)          v.sigManager = req.body.sigManager;
    v.treatedAt = new Date(); v.managerName = req.user.name;
    await v.save();
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/validations/:id', auth, adminOnly, async (req, res) => {
  try { await Validation.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
