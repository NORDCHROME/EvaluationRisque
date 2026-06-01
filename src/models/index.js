// ============================================================
// models/index.js — Tous les modèles Mongoose
// ============================================================
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Utilisateurs ────────────────────────────────────────────
const UserSchema = new Schema({
  login:      { type: String, required: true, unique: true, trim: true },
  name:       { type: String, required: true },
  password:   { type: String, required: true }, // bcrypt hash
  role:       { type: String, enum: ['admin','user','viewer'], default: 'user' },
  site:       { type: String, default: '' },
  email:      { type: String, default: '' },   // pour notifications mail
  savedSignature:    { type: String, default: '' },   // base64 PNG de la signature sauvegardée
  autoUseSignature:  { type: Boolean, default: false }, // appliquer auto sur les rapports
  managerId:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // Support multi-managers : liste de tous les responsables de cet utilisateur
  managerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lastLogin:  { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now }
});

// ── Société ──────────────────────────────────────────────────
const CompanySchema = new Schema({
  name:         { type: String, default: 'NORDCHROME' },
  siret:        { type: String, default: '' },
  addr:         { type: String, default: '' },
  tel:          { type: String, default: '' },
  email:        { type: String, default: '' },
  resp:         { type: String, default: '' },
  instructions: { type: String, default: '' },
  // Branding / UI Config
  brandColors:  { type: Schema.Types.Mixed, default: {} },
  logoUrl:      { type: String, default: '' },
  logoData:     { type: String, default: '' },  // base64
}, { timestamps: true });

// ── Carnet Entreprises extérieures ───────────────────────────
const ExternalCompanySchema = new Schema({
  name:  { type: String, required: true },
  rep:   { type: String, default: '' },
  tel:   { type: String, default: '' },
  email: { type: String, default: '' },
  addr:  { type: String, default: '' }
}, { timestamps: true });

// ── Carnet Intervenants ──────────────────────────────────────
const WorkerSchema = new Schema({
  name:  { type: String, required: true },
  co:    { type: String, default: '' },
  qual:  { type: String, default: '' },
  role:  { type: String, default: '' },
  tel:   { type: String, default: '' }
}, { timestamps: true });

// ── Plans de Prévention ──────────────────────────────────────
const PPlanSchema = new Schema({
  name:       { type: String, required: true },
  isTemplate: { type: Boolean, default: false },
  createdBy:  { type: String },
  data:       { type: Schema.Types.Mixed }, // Snapshot complet du PP
  evalState:  { type: Schema.Types.Mixed }  // Snapshot de l'évaluation
}, { timestamps: true });

// ── Rapports (historique PDF) ────────────────────────────────
const ReportSchema = new Schema({
  type:        { type: String, enum: ['eval','pp'], required: true },
  label:       { type: String },
  createdBy:   { type: String },
  summary:     { type: Schema.Types.Mixed }
}, { timestamps: true });

// ── Validations en attente ───────────────────────────────────
const ValidationSchema = new Schema({
  managerId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  // Support multi-managers
  managerIds:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
  submittedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submitterName:  { type: String },
  submitterSite:  { type: String, default: '—' },
  level:          { type: String, enum: ['low','medium','high'] },
  status:         { type: String, enum: ['pending','approved','rejected','auto_validated'], default: 'pending' },
  evalSnapshot:   { type: Schema.Types.Mixed, default: {} },
  sigIntervenant: { type: String, default: null },
  sigManager:     { type: String, default: null },
  managerName:    { type: String, default: '' },
  comment:        { type: String, default: '' },
  treatedAt:      { type: Date, default: null },
  scoringDetails: { type: Schema.Types.Mixed, default: null },  // détail des scores par risque
  autoValidated:  { type: Boolean, default: false }
}, { timestamps: true });

// ── Évaluations sauvegardées en DB ───────────────────────────
const EvaluationSchema = new Schema({
  submittedBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submitterName:     { type: String, default: '' },
  submitterSite:     { type: String, default: '' },
  interventionTitle: { type: String, default: '' },
  operator:          { type: String, default: '' },
  location:          { type: String, default: '' },
  date:              { type: String, default: '' },
  mission:           { type: String, default: '' },
  missionSteps:      [String],
  interventions:     [String],
  selectedRisks:     [String],
  derogations:       { type: Schema.Types.Mixed, default: {} },
  epiSnapshot:       { type: Schema.Types.Mixed, default: {} },
  selectedRisksCount:{ type: Number, default: 0 },
  risksDetail:       { type: Schema.Types.Mixed, default: [] },
  validationId:      { type: Schema.Types.ObjectId, ref: 'Validation', default: null },
  status:            { type: String, enum: ['draft','submitted','approved','rejected'], default: 'draft' },
}, { timestamps: true });

// ── Risques custom ───────────────────────────────────────────
const CustomRiskSchema = new Schema({
  interventionType: { type: String, required: true },
  riskId:           { type: String, required: true, unique: true },
  name:             { type: String, required: true },
  sev:              { type: String, enum: ['high','medium','low'], default: 'medium' },
  causes:           [String],
  consequences:     [String],
  solutions:        [String]
}, { timestamps: true });

// ── Mots-clés custom ─────────────────────────────────────────
const CustomKeywordSchema = new Schema({
  kwId:  { type: String, required: true, unique: true },
  type:  { type: String, required: true },
  words: [String],
  risks: [String],
  score: { type: Number, default: 4 }
}, { timestamps: true });

// ── Types d'intervention custom ──────────────────────────────
const CustomTypeSchema = new Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

// ── Risques masqués ──────────────────────────────────────────
const HiddenRiskSchema = new Schema({
  interventionType: { type: String, required: true },
  riskId:           { type: String, required: true }
}, { timestamps: true });

// ── Paramètres globaux (features, signature, etc.) ───────────
const SettingsSchema = new Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }
}, { timestamps: true });

// ── Configuration scoring & EPI obligatoires ─────────────────
const ScoringConfigSchema = new Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }
}, { timestamps: true });

const MandatoryEPISchema = new Schema({
  name:          { type: String, required: true },
  type:          { type: String, enum: ['global','type_specific'], default: 'global' },
  interventionType: { type: String, default: '' },  // si type_specific
  scoreDeduction:{ type: Number, default: 10 },
  order:         { type: Number, default: 0 }
}, { timestamps: true });

module.exports = {
  User:            mongoose.model('User', UserSchema),
  ScoringConfig:   mongoose.model('ScoringConfig', ScoringConfigSchema),
  MandatoryEPI:    mongoose.model('MandatoryEPI', MandatoryEPISchema),
  Company:         mongoose.model('Company', CompanySchema),
  ExternalCompany: mongoose.model('ExternalCompany', ExternalCompanySchema),
  Worker:          mongoose.model('Worker', WorkerSchema),
  PPlan:           mongoose.model('PPlan', PPlanSchema),
  Report:          mongoose.model('Report', ReportSchema),
  Validation:      mongoose.model('Validation', ValidationSchema),
  Evaluation:      mongoose.model('Evaluation', EvaluationSchema),
  CustomRisk:      mongoose.model('CustomRisk', CustomRiskSchema),
  CustomKeyword:   mongoose.model('CustomKeyword', CustomKeywordSchema),
  CustomType:      mongoose.model('CustomType', CustomTypeSchema),
  HiddenRisk:      mongoose.model('HiddenRisk', HiddenRiskSchema),
  Settings:        mongoose.model('Settings', SettingsSchema),
};
