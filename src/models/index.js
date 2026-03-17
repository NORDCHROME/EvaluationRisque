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
  managerId:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
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
  instructions: { type: String, default: '' }
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
  submittedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submitterName:  { type: String },
  submitterSite:  { type: String, default: '—' },
  level:          { type: String, enum: ['low','medium','high'] },
  status:         { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  evalSnapshot:   { type: Schema.Types.Mixed },
  sigIntervenant: { type: String, default: null }, // base64 DataURL
  sigManager:     { type: String, default: null },
  managerName:    { type: String, default: '' },
  comment:        { type: String, default: '' },
  treatedAt:      { type: Date, default: null }
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

module.exports = {
  User:            mongoose.model('User', UserSchema),
  Company:         mongoose.model('Company', CompanySchema),
  ExternalCompany: mongoose.model('ExternalCompany', ExternalCompanySchema),
  Worker:          mongoose.model('Worker', WorkerSchema),
  PPlan:           mongoose.model('PPlan', PPlanSchema),
  Report:          mongoose.model('Report', ReportSchema),
  Validation:      mongoose.model('Validation', ValidationSchema),
  CustomRisk:      mongoose.model('CustomRisk', CustomRiskSchema),
  CustomKeyword:   mongoose.model('CustomKeyword', CustomKeywordSchema),
  CustomType:      mongoose.model('CustomType', CustomTypeSchema),
  HiddenRisk:      mongoose.model('HiddenRisk', HiddenRiskSchema),
  Settings:        mongoose.model('Settings', SettingsSchema),
};
