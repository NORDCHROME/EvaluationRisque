// scoring.js — Moteur de calcul du score résiduel de risque
// Chargé par data.js pour décider auto-validation vs validation manuelle

const { ScoringConfig, MandatoryEPI } = require('./models');

// ── Valeurs par défaut (si base vide) ────────────────────────────────────────
const DEFAULTS = {
  score_high:       100,
  score_medium:     50,
  score_low:        20,
  score_prevention: 10,   // forfait par mesure de prévention textuelle
  threshold:        40,   // seuil déclenchement validation obligatoire
};

// ── Charger la config depuis MongoDB ─────────────────────────────────────────
async function loadConfig() {
  const docs = await ScoringConfig.find({});
  const cfg = { ...DEFAULTS };
  docs.forEach(d => { cfg[d.key] = d.value; });
  return cfg;
}

// ── Charger les EPI obligatoires ─────────────────────────────────────────────
async function loadMandatoryEPI() {
  return await MandatoryEPI.find({}).sort({ order: 1 });
}

// ── Calculer le score résiduel d'un risque ────────────────────────────────────
function computeRiskScore(risk, cfg, epiScores) {
  // Score brut selon sévérité
  const brut = risk.sev === 'high'   ? cfg.score_high
             : risk.sev === 'medium' ? cfg.score_medium
             :                         cfg.score_low;

  let deductions = 0;

  // EPC collectifs
  (risk.epc || []).forEach(item => {
    const key = 'epc_' + slugify(item);
    deductions += epiScores[key] || epiScores['epc_default'] || 0;
  });

  // EPI individuels
  (risk.epi || []).forEach(item => {
    const key = 'epi_' + slugify(item);
    deductions += epiScores[key] || epiScores['epi_default'] || 0;
  });

  // Mesures de prévention (forfait par mesure)
  const prevCount = (risk.solutions || []).length;
  deductions += prevCount * (cfg.score_prevention || 10);

  const residuel = Math.max(0, brut - deductions);

  return {
    riskId:    risk.id || risk.name,
    riskName:  risk.name,
    sev:       risk.sev,
    brut,
    deductions,
    residuel,
    overThreshold: residuel >= cfg.threshold,
    detail: {
      epc:        risk.epc || [],
      epi:        risk.epi || [],
      solutions:  risk.solutions || [],
      threshold:  cfg.threshold,
    }
  };
}

// ── Évaluer un rapport complet ────────────────────────────────────────────────
async function evaluateReport(evalSnapshot) {
  const cfg       = await loadConfig();
  const mandatoryDocs = await loadMandatoryEPI();

  // Construire le dictionnaire des scores EPI/EPC
  // Format en base: { key: 'epi_harnais-antichute-en-361', value: 40 }
  const epiScores = {};
  const epiCfgDocs = await ScoringConfig.find({ key: /^(epi|epc)_/ });
  epiCfgDocs.forEach(d => { epiScores[d.key] = d.value; });

  const risks = evalSnapshot.risks || [];
  if (!risks.length) {
    return { requiresValidation: false, scores: [], cfg, autoValidated: true };
  }

  const scores = risks.map(r => computeRiskScore(r, cfg, epiScores));
  const requiresValidation = scores.some(s => s.overThreshold);

  // Vérifier EPI obligatoires décochés sans justification
  const derogations = evalSnapshot.derogations || {};
  const mandatoryViolations = [];

  for (const mEPI of mandatoryDocs) {
    const isGlobal = mEPI.type === 'global';
    const matchesType = (r) =>
      isGlobal || (r.type || '').toLowerCase().includes(mEPI.interventionType.toLowerCase());

    risks.forEach(r => {
      if (!matchesType(r)) return;
      const allEPI = [...(r.epi || [])];
      const hasEPI = allEPI.some(e => e.toLowerCase().includes(mEPI.name.toLowerCase()));
      if (!hasEPI) {
        // Vérifier si dérogation justifiée
        const derogKey = `mandatory_${slugify(mEPI.name)}_${r.id || r.name}`;
        const hasJustif = derogations[derogKey]?.active && derogations[derogKey]?.justification;
        if (!hasJustif) {
          mandatoryViolations.push({ epi: mEPI.name, risk: r.name, type: mEPI.type });
        }
      }
    });
  }

  return {
    requiresValidation: requiresValidation || false,
    mandatoryViolations,
    scores,
    cfg,
    autoValidated: !requiresValidation && mandatoryViolations.length === 0,
    maxScore: scores.reduce((m, s) => Math.max(m, s.residuel), 0),
  };
}

function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

module.exports = { evaluateReport, loadConfig, loadMandatoryEPI, slugify, DEFAULTS };
