// ============================================================
// models/index.js — Tous les modèles Mongoose (v2 — config UI + risques DB)
// ============================================================
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Utilisateurs ────────────────────────────────────────────
const UserSchema = new Schema({
  login:      { type: String, required: true, unique: true, trim: true },
  name:       { type: String, required: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['admin','user','viewer'], default: 'user' },
  site:       { type: String, default: '' },
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
  // Logo (base64 ou URL)
  logoData:     { type: String, default: '' },
  logoUrl:      { type: String, default: '' },
  // Couleurs de marque
  brandColors: {
    accent:  { type: String, default: '#c84b31' },
    accent2: { type: String, default: '#1a4d6e' },
    ink:     { type: String, default: '#0f1923' },
  }
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
  data:       { type: Schema.Types.Mixed },
  evalState:  { type: Schema.Types.Mixed }
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
  status:         { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  evalSnapshot:   { type: Schema.Types.Mixed, default: {} },
  sigIntervenant: { type: String, default: null },
  sigManager:     { type: String, default: null },
  managerName:    { type: String, default: '' },
  comment:        { type: String, default: '' },
  treatedAt:      { type: Date, default: null }
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
  // Lien vers la validation si soumis pour approbation
  validationId:      { type: Schema.Types.ObjectId, ref: 'Validation', default: null },
  status:            { type: String, enum: ['draft','submitted','approved','rejected'], default: 'draft' },
}, { timestamps: true });

// ════════════════════════════════════════════════════════════
// NOUVEAU — Bibliothèque de risques (stockée en DB)
// ════════════════════════════════════════════════════════════
const RiskSchema = new Schema({
  // Identifiant métier (ex: "h1", "mi6", "cx1234567890")
  riskId:           { type: String, required: true, unique: true },
  interventionType: { type: String, required: true },
  name:             { type: String, required: true },
  sev:              { type: String, enum: ['high','medium','low'], default: 'medium' },
  causes:           [String],
  consequences:     [String],
  solutions:        [String],
  // Source : 'builtin' = intégré natif importé, 'custom' = créé par admin
  source:           { type: String, enum: ['builtin','custom'], default: 'custom' },
  // Ordre d'affichage au sein du type
  order:            { type: Number, default: 0 },
  // Risque masqué (soft-delete)
  hidden:           { type: Boolean, default: false },
}, { timestamps: true });

// ── Mots-clés IA (stockés en DB) ────────────────────────────
const KeywordRuleSchema = new Schema({
  kwId:             { type: String, required: true, unique: true },
  interventionType: { type: String, required: true },
  words:            [String],
  riskIds:          [String],
  score:            { type: Number, default: 4 },
  // Source : 'builtin' ou 'custom'
  source:           { type: String, enum: ['builtin','custom'], default: 'custom' },
  hidden:           { type: Boolean, default: false },
}, { timestamps: true });

// ── Types d'intervention (stockés en DB) ─────────────────────
const InterventionTypeSchema = new Schema({
  name:    { type: String, required: true, unique: true },
  icon:    { type: String, default: '🔩' },
  // Ordre d'affichage
  order:   { type: Number, default: 0 },
  // Source : 'builtin' = natif, 'custom' = créé par admin
  source:  { type: String, enum: ['builtin','custom'], default: 'custom' },
  hidden:  { type: Boolean, default: false },
}, { timestamps: true });

// ── EPI/EPC catalogue (stocké en DB) ─────────────────────────
const EPIItemSchema = new Schema({
  interventionType: { type: String, required: true },
  category:         { type: String, enum: ['collectif','individuel'], required: true },
  label:            { type: String, required: true },
  source:           { type: String, enum: ['builtin','custom'], default: 'custom' },
  order:            { type: Number, default: 0 },
  hidden:           { type: Boolean, default: false },
}, { timestamps: true });

// ════════════════════════════════════════════════════════════
// NOUVEAU — Configuration UI (boutons, labels, fonctionnalités)
// ════════════════════════════════════════════════════════════

// Configuration globale de l'interface
const UIConfigSchema = new Schema({
  // Clé unique de configuration (ex: 'buttons', 'labels', 'features', 'branding')
  section: { type: String, required: true, unique: true },
  config:  { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// ── Configuration Plan de Prévention ─────────────────────────
const PPConfigSchema = new Schema({
  // Configuration des sections du PP
  sections: [{
    id:      String,
    label:   String,
    enabled: { type: Boolean, default: true },
    order:   Number,
  }],
  // Champs personnalisés
  customFields: [{
    id:          String,
    label:       String,
    type:        { type: String, enum: ['text','date','select','checkbox','textarea'] },
    required:    { type: Boolean, default: false },
    options:     [String], // pour les selects
    section:     String,   // dans quelle section
    order:       Number,
  }],
  // Permis disponibles (configurables)
  permits: [{
    id:      String,
    label:   String,
    icon:    String,
    enabled: { type: Boolean, default: true },
    order:   Number,
  }],
  // Checklist analyses préalables
  checklist: [{
    id:      String,
    label:   String,
    enabled: { type: Boolean, default: true },
    order:   Number,
  }],
  // Niveaux de risque configurables
  riskLevels: [{
    value:  String,
    label:  String,
    color:  String,
    order:  Number,
  }],
  // Options PDF
  pdfOptions: {
    showLogo:         { type: Boolean, default: true },
    showSignatures:   { type: Boolean, default: true },
    showEmergency:    { type: Boolean, default: true },
    footerText:       { type: String, default: '' },
    pageFormat:       { type: String, default: 'a4' },
    watermark:        { type: String, default: '' },
  },
  // Numéros urgence par défaut
  defaultEmergency: {
    samu:     { type: String, default: '15' },
    pompiers: { type: String, default: '18' },
    police:   { type: String, default: '17' },
    siteLabel:{ type: String, default: 'Contact site' },
  }
}, { timestamps: true });

// ── Paramètres globaux (features, signature, etc.) ───────────
const SettingsSchema = new Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = {
  User:              mongoose.model('User', UserSchema),
  Company:           mongoose.model('Company', CompanySchema),
  ExternalCompany:   mongoose.model('ExternalCompany', ExternalCompanySchema),
  Worker:            mongoose.model('Worker', WorkerSchema),
  PPlan:             mongoose.model('PPlan', PPlanSchema),
  Report:            mongoose.model('Report', ReportSchema),
  Validation:        mongoose.model('Validation', ValidationSchema),
  Evaluation:        mongoose.model('Evaluation', EvaluationSchema),
  Risk:              mongoose.model('Risk', RiskSchema),
  KeywordRule:       mongoose.model('KeywordRule', KeywordRuleSchema),
  InterventionType:  mongoose.model('InterventionType', InterventionTypeSchema),
  EPIItem:           mongoose.model('EPIItem', EPIItemSchema),
  UIConfig:          mongoose.model('UIConfig', UIConfigSchema),
  PPConfig:          mongoose.model('PPConfig', PPConfigSchema),
  Settings:          mongoose.model('Settings', SettingsSchema),
};
