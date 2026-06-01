// routes/data.js — Routes pour toutes les données de l'app
const router = require('express').Router();
const { sendNewValidationNotification, sendValidationResultNotification, sendAutoValidationNotification, testConnection } = require('../mailer');
const { evaluateReport } = require('../scoring');
const mongoose = require('mongoose');
const { auth, adminOnly } = require('../middleware/auth');
const {
  Company, ExternalCompany, Worker,
  PPlan, Report, Settings,
  CustomRisk, CustomKeyword, CustomType, HiddenRisk,
  Validation, Evaluation, User,
  KeywordRule, EPIItem, Risk, InterventionType
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
        id:        String(r.id || ''),
        name:      String(r.name || ''),
        sev:       String(r.sev  || 'medium'),
        type:      String(r.type || ''),
        isManual:  r.isManual || false,
        solutions: Array.isArray(r.solutions) ? r.solutions.map(String) : [],
        epc:       Array.isArray(r.epc)       ? r.epc.map(String)       : [],
        epi:       Array.isArray(r.epi)       ? r.epi.map(String)       : [],
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

    // ── Scoring & décision auto-validation ──────────────────
    try {
      const scoring = await evaluateReport(cleanSnapshot);
      v.scoringDetails = scoring.scores;

      if (scoring.autoValidated) {
        // ── Auto-validation ──────────────────────────────────
        v.status       = 'auto_validated';
        v.autoValidated = true;
        v.treatedAt    = new Date();
        v.managerName  = 'Système EvalRisque';
        await v.save();
        console.log('[Scoring] ✅ Auto-validé — score max:', scoring.maxScore, '< seuil:', scoring.cfg.threshold);

        // Email intervenant
        try {
          const submitterFull = await User.findById(req.user._id).select('email name');
          if (submitterFull?.email) {
            await sendAutoValidationNotification(submitterFull.email, {
              submitterName:     submitterFull.name,
              interventionTitle: cleanSnapshot.interventionTitle || '',
              maxScore:          scoring.maxScore,
              threshold:         scoring.cfg.threshold,
              scores:            scoring.scores,
            });
          }
        } catch (mailErr) { console.error('[Mailer] Auto-notif:', mailErr.message); }

      } else {
        // ── Validation manuelle requise ───────────────────────
        await v.save();
        console.log('[Scoring] ⚠️ Validation requise — score max:', scoring.maxScore, '>= seuil:', scoring.cfg.threshold);

        try {
          const managerFull = await User.findById(managerId).select('email name');
          if (managerFull?.email) {
            await sendNewValidationNotification(managerFull.email, {
              managerName:       managerFull.name,
              submitterName:     req.user.name,
              interventionTitle: cleanSnapshot.interventionTitle || '',
              location:          cleanSnapshot.location || '',
              date:              cleanSnapshot.date || new Date().toISOString(),
              riskCount:         (cleanSnapshot.risks || []).length,
              maxScore:          scoring.maxScore,
              threshold:         scoring.cfg.threshold,
              scores:            scoring.scores,
              validationId:      String(v._id),
            });
          }
        } catch (mailErr) { console.error('[Mailer] Erreur non bloquante:', mailErr.message); }
      }
    } catch (scoringErr) {
      console.error('[Scoring] Erreur non bloquante:', scoringErr.message);
      await v.save();
    }

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

    // ── Notification email à l'intervenant ──────────────────
    if (v.status === 'approved' || v.status === 'rejected') {
      try {
        const submitter = await User.findById(v.submittedBy).select('email name');
        if (submitter?.email) {
          await sendValidationResultNotification(submitter.email, {
            submitterName:     submitter.name,
            interventionTitle: (v.evalSnapshot || {}).interventionTitle || '',
            status:            v.status,
            comment:           v.comment || '',
            managerName:       req.user.name,
          });
        }
      } catch (mailErr) {
        console.error('[Mailer] Erreur résultat non bloquante:', mailErr.message);
      }
    }

    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /validations/:id
router.delete('/validations/:id', auth, adminOnly, async (req, res) => {
  try { await Validation.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// TYPES D'INTERVENTION (DB)
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
      name, icon: icon||'🔩',
      order: order !== undefined ? order : (maxOrder ? maxOrder.order + 1 : 0),
      source: source||'custom', hidden: false
    });
    res.status(201).json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/intervention-types/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, icon, order, hidden } = req.body;
    const update = {};
    if (name   !== undefined) update.name   = name;
    if (icon   !== undefined) update.icon   = icon;
    if (order  !== undefined) update.order  = order;
    if (hidden !== undefined) update.hidden = hidden;
    const t = await InterventionType.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!t) return res.status(404).json({ error: 'Type introuvable' });
    res.json(t);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/intervention-types-order', auth, adminOnly, async (req, res) => {
  try {
    const { order } = req.body;
    await Promise.all(order.map(item => InterventionType.findByIdAndUpdate(item.id, { order: item.order })));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/intervention-types/:id', auth, adminOnly, async (req, res) => {
  try {
    const t = await InterventionType.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Type introuvable' });
    if (t.source === 'builtin') { t.hidden = true; await t.save(); }
    else { await t.deleteOne(); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// RISQUES (DB)
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
      { riskId: id, interventionType, name, sev: sev||'medium', causes: causes||[], consequences: consequences||[], solutions: solutions||[], source: source||'custom', order: order !== undefined ? order : (maxOrder ? maxOrder.order + 1 : 0), hidden: false },
      { upsert: true, new: true }
    );
    res.status(201).json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/risks/:riskId', auth, adminOnly, async (req, res) => {
  try {
    const { name, sev, causes, consequences, solutions, interventionType, hidden, order } = req.body;
    const update = {};
    if (name             !== undefined) update.name             = name;
    if (sev              !== undefined) update.sev              = sev;
    if (causes           !== undefined) update.causes           = causes;
    if (consequences     !== undefined) update.consequences     = consequences;
    if (solutions        !== undefined) update.solutions        = solutions;
    if (interventionType !== undefined) update.interventionType = interventionType;
    if (hidden           !== undefined) update.hidden           = hidden;
    if (order            !== undefined) update.order            = order;
    const r = await Risk.findOneAndUpdate({ riskId: req.params.riskId }, update, { new: true });
    if (!r) return res.status(404).json({ error: 'Risque introuvable' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/risks/:riskId', auth, adminOnly, async (req, res) => {
  try {
    const r = await Risk.findOne({ riskId: req.params.riskId });
    if (!r) return res.status(404).json({ error: 'Risque introuvable' });
    if (r.source === 'builtin') { r.hidden = true; await r.save(); }
    else { await r.deleteOne(); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/risks/bulk-import', auth, adminOnly, async (req, res) => {
  try {
    const { risks } = req.body;
    if (!Array.isArray(risks)) return res.status(400).json({ error: 'risks doit être un tableau' });
    let created = 0, updated = 0;
    for (const r of risks) {
      const exists = await Risk.findOne({ riskId: r.riskId });
      if (exists) {
        if (exists.source === 'builtin') { updated++; continue; }
        await Risk.findOneAndUpdate({ riskId: r.riskId }, r);
        updated++;
      } else {
        await Risk.create({ ...r, source: r.source||'builtin' });
        created++;
      }
    }
    res.json({ ok: true, created, updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// KEYWORD RULES (mots-clés IA en DB)
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
    const update = {};
    if (type    !== undefined) update.interventionType = type;
    if (w       !== undefined) update.words   = w;
    if (r       !== undefined) update.riskIds = r;
    if (s       !== undefined) update.score   = s;
    if (hidden  !== undefined) update.hidden  = hidden;
    const rule = await KeywordRule.findOneAndUpdate({ kwId: req.params.kwId }, update, { new: true });
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    res.json({ id: rule.kwId, type: rule.interventionType, w: rule.words, r: rule.riskIds, s: rule.score });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/keyword-rules/:kwId', auth, adminOnly, async (req, res) => {
  try {
    const rule = await KeywordRule.findOne({ kwId: req.params.kwId });
    if (!rule) return res.status(404).json({ error: 'Règle introuvable' });
    if (rule.source === 'builtin') { rule.hidden = true; await rule.save(); }
    else { await rule.deleteOne(); }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/keyword-rules/bulk-import', auth, adminOnly, async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules doit être un tableau' });
    let created = 0;
    for (const r of rules) {
      const exists = await KeywordRule.findOne({ kwId: r.id });
      if (!exists) {
        await KeywordRule.create({ kwId: r.id, interventionType: r.type, words: r.w||[], riskIds: r.r||[], score: r.s||4, source: 'builtin' });
        created++;
      }
    }
    res.json({ ok: true, created });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// EPI/EPC CATALOGUE (en DB)
// ─────────────────────────────────────────────────────────────
router.get('/epi-items', auth, async (req, res) => {
  try {
    const filter = { hidden: false };
    if (req.query.type)     filter.interventionType = req.query.type;
    if (req.query.category) filter.category         = req.query.category;
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
// GET /validations/mine — validations soumises PAR l'utilisateur connecté
// ─────────────────────────────────────────────────────────────
router.get('/validations/mine', auth, async (req, res) => {
  try {
    const vals = await Validation.find({ submittedBy: req.user._id })
      .sort('-createdAt').lean();
    res.json(vals.map(v => ({ ...v, id: String(v._id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// ÉVALUATIONS (sauvegarde en DB)
// ─────────────────────────────────────────────────────────────
router.get('/evaluations', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { submittedBy: req.user._id };
    const evals = await Evaluation.find(filter).sort('-createdAt').limit(100);
    res.json(evals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/evaluations', auth, async (req, res) => {
  try {
    const ev = await Evaluation.create({
      ...req.body,
      submittedBy:    req.user._id,
      submitterName:  req.user.name,
      submitterSite:  req.user.site || '—',
    });
    res.status(201).json(ev);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/evaluations/:id', auth, async (req, res) => {
  try {
    const ev = await Evaluation.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    if (String(ev.submittedBy) !== String(req.user._id) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Non autorisé' });
    Object.assign(ev, req.body);
    await ev.save();
    res.json(ev);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/evaluations/:id', auth, async (req, res) => {
  try {
    const ev = await Evaluation.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    if (String(ev.submittedBy) !== String(req.user._id) && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Non autorisé' });
    await ev.deleteOne();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// BRANDING / UI CONFIG  (logo + couleurs — stockés dans Company)
// ─────────────────────────────────────────────────────────────
router.get('/uiconfig', auth, async (req, res) => {
  try {
    const co = await Company.findOne() || {};
    res.json({
      companyName: co.name || '',
      colors: co.brandColors || {},
      logoUrl:    co.logoUrl    || '',
      logoBase64: co.logoData   || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// PP CONFIG (configuration du plan de prévention)
// ─────────────────────────────────────────────────────────────
router.get('/pp-config', auth, async (req, res) => {
  try {
    const s = await Settings.findOne({ key: 'ppconfig' });
    res.json(s ? s.value : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/pp-config', auth, adminOnly, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'ppconfig' }, { key: 'ppconfig', value: req.body }, { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/pp-config', auth, adminOnly, async (req, res) => {
  try {
    await Settings.findOneAndDelete({ key: 'ppconfig' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// TEST EMAIL (admin seulement)
// ─────────────────────────────────────────────────────────────
router.post('/email-test', auth, adminOnly, async (req, res) => {
  const result = await testConnection();
  res.json(result);
});

module.exports = router;
