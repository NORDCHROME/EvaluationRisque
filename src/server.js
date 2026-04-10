// server.js — Point d'entrée principal v2 (avec seed complet en DB)
require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();
app.set('trust proxy', 1);

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' }
});

app.use('/api/auth',  authLimiter, require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/data',  require('./routes/data'));

app.get('/api/health', (req, res) => {
  const states = ['disconnected','connected','connecting','disconnecting'];
  res.json({ status: 'ok', db: states[mongoose.connection.readyState]||'unknown', uptime: Math.floor(process.uptime())+'s' });
});

app.use(express.static(path.join(__dirname, '../public')));

// ── 404 JSON pour toutes les routes /api/* non trouvées ──────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.originalUrl}` });
});

// ── Fallback SPA ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 EvalRisque démarré sur le port ${PORT}`); });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI manquant');
} else if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant');
} else {
  mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000, socketTimeoutMS: 45000 })
    .then(async () => {
      console.log(`✅ MongoDB connecté — ${mongoose.connection.db.databaseName}`);
      await seedDefaultData();
      await seedRisksAndKeywords();
    })
    .catch(err => { console.error('❌ Erreur MongoDB :', err.message); });
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB déconnecté'));
  mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconnecté'));
}

// ── Données de base ──────────────────────────────────────────
async function seedDefaultData() {
  const { User, Company } = require('./models');
  const bcrypt = require('bcryptjs');
  if (await Company.countDocuments() === 0) {
    await Company.create({ name: 'NORDCHROME' });
    console.log('📋 Société NORDCHROME créée');
  }
  if (!await User.findOne({ login: 'admin' })) {
    const hash = await bcrypt.hash('admin123', 10);
    await User.create({ login: 'admin', name: 'Administrateur', password: hash, role: 'admin' });
    console.log('👤 Admin créé → login: admin / mdp: admin123');
  }
}

// ── Seed complet : types, risques, mots-clés, EPI ────────────
async function seedRisksAndKeywords() {
  const { InterventionType, Risk, KeywordRule, EPIItem } = require('./models');

  // Types d'intervention natifs
  const NATIVE_TYPES = [
    { name: 'Travaux en hauteur',             icon: '🏗️', order: 1 },
    { name: 'Travaux électriques',            icon: '⚡',  order: 2 },
    { name: 'Manutention & levage',           icon: '🏋️', order: 3 },
    { name: 'Travaux en espace confiné',      icon: '🕳️', order: 4 },
    { name: 'Produits chimiques & dangereux', icon: '🧪',  order: 5 },
    { name: 'Soudage & découpe thermique',    icon: '🔥',  order: 6 },
    { name: 'Travaux sur voirie & route',     icon: '🚧',  order: 7 },
    { name: 'Maintenance industrielle',       icon: '🔧',  order: 8 },
    { name: 'Travaux de démolition',          icon: '🪨',  order: 9 },
    { name: 'Travaux de toiture & étanchéité',icon: '🏠',  order: 10 },
    { name: 'Terrassement & fouilles',        icon: '⛏️', order: 11 },
    { name: 'Peinture & traitement de surface',icon: '🖌️', order: 12 },
    { name: 'Outils numériques & IA',         icon: '🤖',  order: 13 },
  ];

  // Seed types
  let typesSeeded = 0;
  for (const t of NATIVE_TYPES) {
    const exists = await InterventionType.findOne({ name: t.name });
    if (!exists) {
      await InterventionType.create({ ...t, source: 'builtin', hidden: false });
      typesSeeded++;
    }
  }
  if (typesSeeded > 0) console.log(`✅ ${typesSeeded} types d'intervention créés en DB`);

  // Seed risques (résumé des risques natifs)
  const NATIVE_RISKS = getRisksForSeed();
  let risksSeeded = 0;
  for (const r of NATIVE_RISKS) {
    const exists = await Risk.findOne({ riskId: r.riskId });
    if (!exists) {
      await Risk.create({ ...r, source: 'builtin', hidden: false });
      risksSeeded++;
    }
  }
  if (risksSeeded > 0) console.log(`✅ ${risksSeeded} risques créés en DB`);

  // Seed mots-clés
  const NATIVE_KW = getKeywordsForSeed();
  let kwSeeded = 0;
  for (const r of NATIVE_KW) {
    const exists = await KeywordRule.findOne({ kwId: r.id });
    if (!exists) {
      await KeywordRule.create({ kwId: r.id, interventionType: r.type, words: r.w, riskIds: r.r, score: r.s, source: 'builtin' });
      kwSeeded++;
    }
  }
  if (kwSeeded > 0) console.log(`✅ ${kwSeeded} règles mots-clés créées en DB`);

  // Seed EPI/EPC
  const EPI_DATA = getEPIForSeed();
  let epiSeeded = 0;
  for (const it of EPI_DATA) {
    const exists = await EPIItem.findOne({ interventionType: it.interventionType, category: it.category, label: it.label });
    if (!exists) {
      await EPIItem.create({ ...it, source: 'builtin', hidden: false });
      epiSeeded++;
    }
  }
  if (epiSeeded > 0) console.log(`✅ ${epiSeeded} items EPI/EPC créés en DB`);
}

// ── Données de seed : risques natifs (extrait représentatif) ─────────────
function getRisksForSeed() {
  return [
    // Hauteur
    { riskId:'h1', interventionType:'Travaux en hauteur', name:'Chute de hauteur de l\'opérateur', sev:'high', order:1,
      causes:['Absence/inadaptation des protections collectives','Harnais non porté ou mal réglé','Point d\'ancrage non certifié','Fatigue, inattention ou vertiges'],
      consequences:['Blessures graves voire mortelles','Fractures multiples, traumatismes crâniens','Incapacité permanente'],
      solutions:['Installer des garde-corps ≥ 1 m conformes NF EN 13374','Utiliser un harnais EN 361 avec longe EN 355','Vérifier les points d\'ancrage EN 795 avant utilisation','Établir un plan de prévention chute (PPSPS)','Former et habiliter le personnel','Inspecter les EPI avant chaque utilisation'] },
    { riskId:'h2', interventionType:'Travaux en hauteur', name:'Chute d\'objet sur les tiers', sev:'high', order:2,
      causes:['Outils/matériaux non sécurisés en hauteur','Absence de protection périmétrique','Zone non balisée en dessous'],
      consequences:['Blessures graves au sol','Dommages matériels','Responsabilité pénale'],
      solutions:['Installer des plinthes de retenue ≥ 15 cm','Ancrer tous les outils avec des longes','Délimiter et baliser la zone d\'exclusion au sol','Utiliser des filets pare-gravats'] },
    { riskId:'h3', interventionType:'Travaux en hauteur', name:'Instabilité d\'échafaudage ou d\'échelle', sev:'high', order:3,
      causes:['Montage incorrect ou non conforme','Sol instable ou inégal','Surcharge non contrôlée'],
      consequences:['Effondrement partiel ou total','Chute de l\'opérateur et des matériaux'],
      solutions:['Confier le montage à des compagnons habilités','Réceptionner l\'échafaudage par personne compétente','Vérifier la planéité et résistance du sol'] },
    { riskId:'h4', interventionType:'Travaux en hauteur', name:'Conditions météorologiques défavorables', sev:'medium', order:4,
      causes:['Vent fort, pluie verglaçante, gel'],
      consequences:['Glissade et perte d\'équilibre'],
      solutions:['Consulter Météo France avant chaque intervention','Arrêter par vent > 72 km/h ou verglas'] },
    { riskId:'h5', interventionType:'Travaux en hauteur', name:'Contact avec une ligne électrique aérienne', sev:'high', order:5,
      causes:['Ligne HTB/BT non identifiée à proximité'],
      consequences:['Électrocution mortelle','Chute électrisée'],
      solutions:['Identifier toutes les lignes aériennes (DICT)','Respecter distances sécurité (3m BT, 5m HTA/HTB)'] },
    // Électrique
    { riskId:'e1', interventionType:'Travaux électriques', name:'Électrocution et électrisation', sev:'high', order:1,
      causes:['Travail sous tension non consigné','Habilitation absente ou expirée'],
      consequences:['Arrêt cardiaque, brûlures internes/externes','Décès'],
      solutions:['Respecter les habilitations NF C 18-510','Appliquer LOTO : consignation, cadenas, étiquetage','Vérifier l\'absence de tension (VAT homologué)'] },
    { riskId:'e2', interventionType:'Travaux électriques', name:'Arc électrique et flash thermique', sev:'high', order:2,
      causes:['Court-circuit installation haute énergie'],
      consequences:['Brûlures 2e/3e degré','Cécité'],
      solutions:['Évaluer l\'énergie incidente','Porter combinaison arc flash IEC 61482-2'] },
    { riskId:'e3', interventionType:'Travaux électriques', name:'Incendie d\'origine électrique', sev:'medium', order:3,
      causes:['Surcharge de circuit','Connexions oxydées'],
      consequences:['Incendie du local électrique'],
      solutions:['Inspecter les câblages avant remise sous tension','Extincteurs CO2 uniquement'] },
    { riskId:'e4', interventionType:'Travaux électriques', name:'Contact avec réseau enterré ou aérien', sev:'high', order:4,
      causes:['DICT non réalisée','Plans de réseaux obsolètes'],
      consequences:['Électrocution','Explosion de gaz'],
      solutions:['Déposer une DICT obligatoirement','Utiliser un détecteur de réseaux électromagnétique'] },
    { riskId:'e5', interventionType:'Travaux électriques', name:'Risque d\'explosion en zone ATEX', sev:'high', order:5,
      causes:['Gaz inflammables ou poussières explosives'],
      consequences:['Explosion et incendie généralisé'],
      solutions:['Identifier les zones ATEX','Matériel exclusivement certifié ATEX'] },
    // Manutention
    { riskId:'m1', interventionType:'Manutention & levage', name:'Chute ou renversement de charge levée', sev:'high', order:1,
      causes:['Dépassement de la CMU','Élingues usées ou mal gréées'],
      consequences:['Écrasement mortel'],
      solutions:['Calculer la CMU selon l\'angle d\'élingage','Inspecter chaque élingue avant utilisation'] },
    { riskId:'m2', interventionType:'Manutention & levage', name:'Troubles musculosquelettiques (TMS)', sev:'medium', order:2,
      causes:['Port manuel de charges lourdes ou répétitif'],
      consequences:['Lombalgies, hernies discales'],
      solutions:['Utiliser aides mécaniques (transpalette, lève-charge)','Respecter les limites de charge'] },
    { riskId:'m3', interventionType:'Manutention & levage', name:'Renversement d\'engin de manutention', sev:'high', order:3,
      causes:['Pente dépassant la limite constructeur'],
      consequences:['Écrasement du conducteur'],
      solutions:['Vérifier les pentes selon le constructeur','Former et habiliter les conducteurs (CACES R489)'] },
    { riskId:'m4', interventionType:'Manutention & levage', name:'Écrasement et cisaillement de membres', sev:'high', order:4,
      causes:['Proximité des membres de la charge'],
      consequences:['Fractures, amputations'],
      solutions:['Chaussures S3 à embout acier obligatoires','Distance de sécurité minimum un bras avec la charge'] },
    // Espace confiné
    { riskId:'ec1', interventionType:'Travaux en espace confiné', name:'Asphyxie par déficience en oxygène', sev:'high', order:1,
      causes:['Consommation O2 par rouille, fermentation'],
      consequences:['Perte de conscience rapide','Décès (O2 < 6%)'],
      solutions:['Mesurer O2 avant entrée (min. 19,5%)','Ventilation forcée continue'] },
    { riskId:'ec2', interventionType:'Travaux en espace confiné', name:'Intoxication aux gaz toxiques (CO, H₂S)', sev:'high', order:2,
      causes:['Gaz résiduels de combustion'],
      consequences:['Intoxication aiguë mortelle'],
      solutions:['Identifier tous les gaz potentiellement présents','Purger et ventiler avant entrée'] },
    { riskId:'ec3', interventionType:'Travaux en espace confiné', name:'Incendie ou explosion dans l\'espace confiné', sev:'high', order:3,
      causes:['Gaz inflammable concentré > 10% LIE'],
      consequences:['Onde de choc en espace fermé, décès immédiat'],
      solutions:['Mesurer concentrations de gaz inflammables','Interdire toute source d\'ignition'] },
    { riskId:'ec4', interventionType:'Travaux en espace confiné', name:'Impossibilité d\'évacuation rapide', sev:'high', order:4,
      causes:['Accès trop étroit','Opérateur seul sans surveillance'],
      consequences:['Impossible de secourir rapidement'],
      solutions:['Accès min. Ø 50 cm','Surveillant EN PERMANENCE à l\'extérieur'] },
    // Chimique
    { riskId:'ch1', interventionType:'Produits chimiques & dangereux', name:'Intoxication par inhalation de vapeurs', sev:'high', order:1,
      causes:['Émanations de solvants, acides, bases'],
      consequences:['Irritation respiratoire, cancers professionnels'],
      solutions:['Consulter les FDS avant toute manipulation','VLA à la source','Masque respiratoire adapté'] },
    { riskId:'ch2', interventionType:'Produits chimiques & dangereux', name:'Brûlures chimiques cutanées et oculaires', sev:'high', order:2,
      causes:['Projection lors du transvasement'],
      consequences:['Brûlures 2e/3e degré','Cécité irréversible'],
      solutions:['Lunettes étanches EN 166 + écran facial','Douche sécurité + rince-yeux à < 10 secondes'] },
    { riskId:'ch3', interventionType:'Produits chimiques & dangereux', name:'Incendie ou explosion par produit inflammable', sev:'high', order:3,
      causes:['Stockage en zone non ventilée'],
      consequences:['Incendie généralisé'],
      solutions:['Armoire agréée pour le stockage','Éliminer toutes sources d\'ignition'] },
    { riskId:'ch4', interventionType:'Produits chimiques & dangereux', name:'Déversement accidentel et pollution', sev:'medium', order:4,
      causes:['Renversement de contenants'],
      consequences:['Contamination des sols et nappes'],
      solutions:['Bacs de rétention (110% du plus grand)','Kit anti-déversement disponible'] },
    // Soudage
    { riskId:'s1', interventionType:'Soudage & découpe thermique', name:'Brûlures et projections de métal en fusion', sev:'high', order:1,
      causes:['Projections de spatter','Contact avec pièce chaude'],
      consequences:['Brûlures 2e/3e degré'],
      solutions:['Tenue complète soudeur homologuée EN ISO 11611'] },
    { riskId:'s2', interventionType:'Soudage & découpe thermique', name:'Rayonnement UV/IR — coup d\'arc', sev:'high', order:2,
      causes:['Absence ou filtre inadapté du masque'],
      consequences:['Kératite (coup d\'arc)','Cécité temporaire'],
      solutions:['Masque auto-obscurcissant DIN adapté'] },
    { riskId:'s3', interventionType:'Soudage & découpe thermique', name:'Incendie par points chauds', sev:'high', order:3,
      causes:['Projections sur matériaux combustibles'],
      consequences:['Incendie différé 1 à 2h après les travaux'],
      solutions:['Permis de feu signé avant tout travail','Surveillance incendie ≥ 2h après fin des travaux'] },
    { riskId:'s4', interventionType:'Soudage & découpe thermique', name:'Intoxication par fumées de soudage', sev:'medium', order:4,
      causes:['Fumées métalliques (Mn, Cr VI, Ni)'],
      consequences:['Fièvre des métaux','Cancer bronchopulmonaire à long terme'],
      solutions:['Aspiration à la source','Masque filtrant P3 adapté'] },
    { riskId:'s5', interventionType:'Soudage & découpe thermique', name:'Explosion de bouteille de gaz', sev:'high', order:5,
      causes:['Bouteille exposée à la chaleur'],
      consequences:['Explosion BLEVE','Incendie immédiat'],
      solutions:['Bouteilles enchaînées et sécurisées verticalement','Clapets anti-retour de flamme obligatoires'] },
    // Voirie
    { riskId:'r1', interventionType:'Travaux sur voirie & route', name:'Collision avec un véhicule en circulation', sev:'high', order:1,
      causes:['Signalisation temporaire absente/non conforme'],
      consequences:['Renversement de l\'opérateur','Blessures mortelles'],
      solutions:['Signalisation temporaire conforme SETRA/GTS','Véhicules avec flèche lumineuse et gyrophares'] },
    { riskId:'r2', interventionType:'Travaux sur voirie & route', name:'Effondrement de tranchée ou fouille', sev:'high', order:2,
      causes:['Sol saturé d\'eau ou argileux','Absence de blindage'],
      consequences:['Ensevelissement fatal'],
      solutions:['Étayer ou blinder au-delà de 1,30 m'] },
    { riskId:'r3', interventionType:'Travaux sur voirie & route', name:'Contact avec réseaux enterrés', sev:'high', order:3,
      causes:['DICT non réalisée'],
      consequences:['Électrocution','Explosion de gaz'],
      solutions:['DICT obligatoire avant tout travail'] },
    { riskId:'r4', interventionType:'Travaux sur voirie & route', name:'Chute dans une fouille ou regard ouvert', sev:'medium', order:4,
      causes:['Fouille non balisée'],
      consequences:['Fractures','Traumatismes crâniens'],
      solutions:['Baliser toutes les ouvertures avec cônes et barrières rigides'] },
    // Maintenance
    { riskId:'mi1', interventionType:'Maintenance industrielle', name:'Contact avec pièces mécaniques en mouvement', sev:'high', order:1,
      causes:['Consignation incomplète ou non réalisée'],
      consequences:['Sectionnement, écrasement, arrachement'],
      solutions:['LOTO strict : consignation, étiquetage, vérification'] },
    { riskId:'mi2', interventionType:'Maintenance industrielle', name:'Brûlures par fluides chauds sous pression', sev:'high', order:2,
      causes:['Ouverture circuit chaud sans dépressurisation'],
      consequences:['Brûlures vapeur très sévères'],
      solutions:['Dépressuriser et refroidir avant ouverture'] },
    { riskId:'mi3', interventionType:'Maintenance industrielle', name:'Exposition au bruit et aux vibrations', sev:'medium', order:3,
      causes:['Machines non insonorisées'],
      consequences:['Surdité professionnelle irréversible'],
      solutions:['Mesurer le niveau sonore (seuil action 80 dB(A))'] },
    { riskId:'mi4', interventionType:'Maintenance industrielle', name:'Explosion ou incendie sur machine', sev:'high', order:4,
      causes:['Vapeurs de lubrifiant accumulées'],
      consequences:['Incendie de l\'installation'],
      solutions:['Purger régulièrement les circuits hydrauliques'] },
    { riskId:'mi5', interventionType:'Maintenance industrielle', name:'Risque chimique (lubrifiants)', sev:'medium', order:5,
      causes:['Contact cutané avec huiles de coupe'],
      consequences:['Dermatoses professionnelles'],
      solutions:['Gants nitrile résistant aux huiles'] },
    { riskId:'mi6', interventionType:'Maintenance industrielle', name:'Blessure par heurt ou chute de pièce lors du démontage', sev:'high', order:6,
      causes:['Pièce lourde mal soutenue lors du dévissage','Tension résiduelle dans les assemblages'],
      consequences:['Fractures des membres supérieurs / doigts'],
      solutions:['Soutenir systématiquement la pièce avant le dernier point de fixation','Utiliser des extracteurs et outillages adaptés'] },
    { riskId:'mi7', interventionType:'Maintenance industrielle', name:'Coupures et lacérations sur arêtes vives', sev:'medium', order:7,
      causes:['Arêtes vives de tôles, engrenages'],
      consequences:['Plaies profondes des mains'],
      solutions:['Gants anti-coupure niveau D (EN 388) obligatoires'] },
    { riskId:'mi8', interventionType:'Maintenance industrielle', name:'Chute de charge lors de la dépose / repose d\'équipement', sev:'high', order:8,
      causes:['Équipement lourd mal équilibré sur le moyen de levage'],
      consequences:['Écrasement de l\'opérateur'],
      solutions:['Identifier les points de levage','Chef de manœuvre unique désigné'] },
    // Démolition
    { riskId:'d1', interventionType:'Travaux de démolition', name:'Effondrement de structure ou de plancher', sev:'high', order:1,
      causes:['Structure affaiblie non étayée'],
      consequences:['Ensevelissement mortel'],
      solutions:['Diagnostic structurel complet','Plan de démolition progressif'] },
    { riskId:'d2', interventionType:'Travaux de démolition', name:'Exposition à l\'amiante', sev:'high', order:2,
      causes:['Matériaux amiantés non repérés'],
      consequences:['Mésothéliome pleural','Cancer bronchopulmonaire'],
      solutions:['DTA obligatoire','Entreprise certifiée SS4'] },
    { riskId:'d3', interventionType:'Travaux de démolition', name:'Projection de débris et éclats', sev:'high', order:3,
      causes:['Marteau-piqueur, broyeur'],
      consequences:['Blessures oculaires graves'],
      solutions:['Casque renforcé, lunettes-masque intégral'] },
    { riskId:'d4', interventionType:'Travaux de démolition', name:'Inhalation de poussières de silice cristalline', sev:'high', order:4,
      causes:['Découpe ou perçage de béton'],
      consequences:['Silicose irréversible'],
      solutions:['Outils avec aspiration intégrée','Masque FFP3 homologué'] },
    // Toiture
    { riskId:'t1', interventionType:'Travaux de toiture & étanchéité', name:'Chute en rive de toiture', sev:'high', order:1,
      causes:['Absence de garde-corps périmétriques'],
      consequences:['Chute mortelle'],
      solutions:['Garde-corps de rive NF EN 13374 classe B ou C'] },
    { riskId:'t2', interventionType:'Travaux de toiture & étanchéité', name:'Chute au travers d\'un élément fragile', sev:'high', order:2,
      causes:['Plaques fibrociment, polycarbonate'],
      consequences:['Chute à l\'intérieur du bâtiment'],
      solutions:['Cartographier tous les éléments fragiles'] },
    { riskId:'t3', interventionType:'Travaux de toiture & étanchéité', name:'Brûlures par chalumeau ou bitume chaud', sev:'high', order:3,
      causes:['Projections de bitume'],
      consequences:['Brûlures profondes'],
      solutions:['Permis de feu + extincteur à portée'] },
    { riskId:'t4', interventionType:'Travaux de toiture & étanchéité', name:'Effondrement du support sous le poids', sev:'medium', order:4,
      causes:['Toiture ancienne ou endommagée'],
      consequences:['Chute en dessous de la toiture'],
      solutions:['Expertise structurelle avant travaux lourds'] },
    // Terrassement
    { riskId:'tf1', interventionType:'Terrassement & fouilles', name:'Effondrement de paroi de fouille', sev:'high', order:1,
      causes:['Sol saturé d\'eau ou argileux','Absence de blindage'],
      consequences:['Ensevelissement fatal'],
      solutions:['Blinder systématiquement les fouilles > 1,30 m'] },
    { riskId:'tf2', interventionType:'Terrassement & fouilles', name:'Renversement d\'engin dans la fouille', sev:'high', order:2,
      causes:['Travail en bord de fouille sans sécurisation'],
      consequences:['Renversement engin et conducteur'],
      solutions:['Butées de bord de fouille'] },
    { riskId:'tf3', interventionType:'Terrassement & fouilles', name:'Contact avec réseau enterré gazier ou électrique', sev:'high', order:3,
      causes:['DICT non réalisée'],
      consequences:['Explosion de gaz','Électrocution'],
      solutions:['DICT obligatoire (télédéclaration)'] },
    { riskId:'tf4', interventionType:'Terrassement & fouilles', name:'Inondation de fouille', sev:'medium', order:4,
      causes:['Remontée de nappe phréatique'],
      consequences:['Noyade de l\'opérateur'],
      solutions:['Système de pompage préventif'] },
    // Peinture
    { riskId:'p1', interventionType:'Peinture & traitement de surface', name:'Intoxication par inhalation (solvants, isocyanates)', sev:'high', order:1,
      causes:['Application par pistolet (aérosols fins)'],
      consequences:['Asthme professionnel irréversible'],
      solutions:['Masque à adduction d\'air frais pour isocyanates'] },
    { riskId:'p2', interventionType:'Peinture & traitement de surface', name:'Incendie et explosion de vapeurs inflammables', sev:'high', order:2,
      causes:['Accumulation vapeurs en espace fermé'],
      consequences:['Flash fire','Explosion de la pièce'],
      solutions:['Ventiler abondamment','Éliminer toutes sources d\'ignition'] },
    { riskId:'p3', interventionType:'Peinture & traitement de surface', name:'Brûlures chimiques et allergies cutanées', sev:'medium', order:3,
      causes:['Contact avec acides de décapage, époxy'],
      consequences:['Dermatose de contact allergique irréversible'],
      solutions:['Gants résistants EN 374'] },
    { riskId:'p4', interventionType:'Peinture & traitement de surface', name:'Chute lors du travail en hauteur (façades)', sev:'high', order:4,
      causes:['Travail sur échafaudage ou nacelle'],
      consequences:['Chute mortelle'],
      solutions:['Harnais antichute si nacelle non protégée'] },
    // IA
    { riskId:'ia1', interventionType:'Outils numériques & IA', name:'Décision erronée basée sur une recommandation IA', sev:'high', order:1,
      causes:['Confiance excessive envers une IA sans validation humaine'],
      consequences:['Accident grave par sous-estimation du danger réel'],
      solutions:['Appliquer le principe de double validation : IA + expert humain'] },
    { riskId:'ia2', interventionType:'Outils numériques & IA', name:'Cybersécurité : accès non autorisé via outil IA connecté', sev:'high', order:2,
      causes:['Outil IA connecté au réseau OT/SCADA sans cloisonnement'],
      consequences:['Prise de contrôle à distance d\'une installation industrielle'],
      solutions:['Cloisonner le réseau IA du réseau industriel (DMZ, firewall OT)'] },
    { riskId:'ia3', interventionType:'Outils numériques & IA', name:'Défaillance d\'un capteur IoT ou d\'un système de surveillance IA', sev:'high', order:3,
      causes:['Capteur mal étalonné ou hors plage de mesure'],
      consequences:['Non-détection d\'une anomalie critique'],
      solutions:['Étalonner les capteurs IoT selon un calendrier défini'] },
    { riskId:'ia4', interventionType:'Outils numériques & IA', name:'Dépendance technologique et perte de compétences humaines', sev:'medium', order:4,
      causes:['Automatisation excessive sans maintien des savoirs-faire manuels'],
      consequences:['Incapacité à gérer une situation non couverte par l\'IA'],
      solutions:['Maintenir des formations pratiques sans assistance IA'] },
    { riskId:'ia5', interventionType:'Outils numériques & IA', name:'Protection des données personnelles lors de l\'usage d\'un outil IA', sev:'medium', order:5,
      causes:['Saisie de données sensibles dans un outil IA non sécurisé'],
      consequences:['Violation du RGPD'],
      solutions:['Établir une charte d\'utilisation des outils IA en entreprise'] },
    { riskId:'ia6', interventionType:'Outils numériques & IA', name:'Mauvaise utilisation d\'un robot ou cobotique assisté par IA', sev:'high', order:6,
      causes:['Zone de collaboration homme-robot non correctement définie'],
      consequences:['Collision entre l\'opérateur et le robot en mouvement'],
      solutions:['Définir et baliser clairement les zones de collaboration homme-robot (ISO/TS 15066)'] },
  ];
}

// ── Keywords de seed (échantillon représentatif) ─────────────
function getKeywordsForSeed() {
  return [
    // Hauteur
    { id:'kw_h_01', type:'Travaux en hauteur', w:['hauteur','travail en hauteur','en hauteur'], r:['h1','h2','h3'], s:5 },
    { id:'kw_h_02', type:'Travaux en hauteur', w:['echafaudage','nacelle','pirl'], r:['h1','h3'], s:5 },
    { id:'kw_h_03', type:'Travaux en hauteur', w:['toiture','toit','couverture','charpente'], r:['h1','h2'], s:4 },
    { id:'kw_h_04', type:'Travaux en hauteur', w:['harnais','antichute','longe','cordiste'], r:['h1','h3'], s:4 },
    { id:'kw_h_05', type:'Travaux en hauteur', w:['vent','verglas','tempete'], r:['h4'], s:2 },
    { id:'kw_h_06', type:'Travaux en hauteur', w:['ligne aerienne','htb aerien'], r:['h5'], s:5 },
    // Électrique
    { id:'kw_e_01', type:'Travaux électriques', w:['electrique','electricite','tableau electrique'], r:['e1','e2'], s:5 },
    { id:'kw_e_02', type:'Travaux électriques', w:['consignation','loto','vat','absence de tension'], r:['e1'], s:5 },
    { id:'kw_e_03', type:'Travaux électriques', w:['hta','htb','haute tension'], r:['e1','e2'], s:5 },
    { id:'kw_e_04', type:'Travaux électriques', w:['arc electrique','electrocution','court-circuit'], r:['e1','e2'], s:5 },
    { id:'kw_e_05', type:'Travaux électriques', w:['atex','zone atex'], r:['e5'], s:5 },
    // Manutention
    { id:'kw_m_01', type:'Manutention & levage', w:['levage','grue','pont roulant'], r:['m1','m3'], s:5 },
    { id:'kw_m_02', type:'Manutention & levage', w:['elingue','sangles de levage','crochet'], r:['m1'], s:5 },
    { id:'kw_m_03', type:'Manutention & levage', w:['chariot elevateur','transpalette','caces'], r:['m1','m2'], s:4 },
    { id:'kw_m_04', type:'Manutention & levage', w:['tms','lombaire','dos','hernie'], r:['m2'], s:4 },
    // Espace confiné
    { id:'kw_ec_01', type:'Travaux en espace confiné', w:['espace confine','espace restreint'], r:['ec1','ec2','ec3','ec4'], s:5 },
    { id:'kw_ec_02', type:'Travaux en espace confiné', w:['cuve','reservoir','silo','citerne','fosse'], r:['ec1','ec2'], s:5 },
    { id:'kw_ec_03', type:'Travaux en espace confiné', w:['gaz asphyxiant','manque oxygene','h2s','monoxyde'], r:['ec2'], s:5 },
    // Chimique
    { id:'kw_ch_01', type:'Produits chimiques & dangereux', w:['produit chimique','substance chimique'], r:['ch1','ch2'], s:5 },
    { id:'kw_ch_02', type:'Produits chimiques & dangereux', w:['solvant','acide','base','soude','chlore'], r:['ch1','ch2'], s:5 },
    { id:'kw_ch_03', type:'Produits chimiques & dangereux', w:['deversement','fuite chimique'], r:['ch3','ch4'], s:4 },
    // Soudage
    { id:'kw_s_01', type:'Soudage & découpe thermique', w:['soudage','soudure','souder'], r:['s1','s2','s3'], s:5 },
    { id:'kw_s_02', type:'Soudage & découpe thermique', w:['chalumeau','oxycoupage','acetylene'], r:['s2','s3'], s:5 },
    { id:'kw_s_03', type:'Soudage & découpe thermique', w:['permis feu','travail a chaud'], r:['s2','s3'], s:5 },
    // Voirie
    { id:'kw_r_01', type:'Travaux sur voirie & route', w:['voirie','route','chaussee'], r:['r1','r2'], s:5 },
    { id:'kw_r_02', type:'Travaux sur voirie & route', w:['signalisation temporaire','gts'], r:['r1'], s:5 },
    // Maintenance
    { id:'kw_mi_01', type:'Maintenance industrielle', w:['consignation machine','loto mecanique'], r:['mi1','mi2'], s:5 },
    { id:'kw_mi_02', type:'Maintenance industrielle', w:['machine tournante','organe rotatif'], r:['mi1','mi3'], s:4 },
    { id:'kw_mi_03', type:'Maintenance industrielle', w:['demontage','demonter','depose'], r:['mi6','mi7','mi8'], s:5 },
    { id:'kw_mi_04', type:'Maintenance industrielle', w:['coupure','laceration','arete vive'], r:['mi7'], s:5 },
    { id:'kw_mi_05', type:'Maintenance industrielle', w:['chute piece','piece qui tombe'], r:['mi8','m4'], s:5 },
    // Démolition
    { id:'kw_d_01', type:'Travaux de démolition', w:['demolition','deconstruction'], r:['d1','d2'], s:5 },
    { id:'kw_d_02', type:'Travaux de démolition', w:['amiante','fibre amiante'], r:['d2'], s:5 },
    // Toiture
    { id:'kw_t_01', type:'Travaux de toiture & étanchéité', w:['toiture etancheite','couvreur','zingueur'], r:['t1','t2'], s:5 },
    { id:'kw_t_02', type:'Travaux de toiture & étanchéité', w:['bitume','membrane bitumineuse'], r:['t3'], s:5 },
    // Terrassement
    { id:'kw_tf_01', type:'Terrassement & fouilles', w:['terrassement','fouilles','excavation','tranchee'], r:['tf1','tf2'], s:5 },
    { id:'kw_tf_02', type:'Terrassement & fouilles', w:['effondrement paroi','ensevelissement'], r:['tf1'], s:5 },
    // Peinture
    { id:'kw_p_01', type:'Peinture & traitement de surface', w:['peinture','pistolage','grenaillage'], r:['p1','p2'], s:5 },
    { id:'kw_p_02', type:'Peinture & traitement de surface', w:['isocyanate','polyurethane','epoxy'], r:['p1'], s:5 },
    // IA
    { id:'kw_ia_01', type:'Outils numériques & IA', w:['intelligence artificielle','ia industrielle','outil ia'], r:['ia1','ia4'], s:5 },
    { id:'kw_ia_02', type:'Outils numériques & IA', w:['cybersecurite','cyberattaque','scada'], r:['ia2'], s:5 },
    { id:'kw_ia_03', type:'Outils numériques & IA', w:['capteur iot','capteur connecte','iiot'], r:['ia3'], s:5 },
    { id:'kw_ia_04', type:'Outils numériques & IA', w:['cobot','cobotique','robot collaboratif'], r:['ia6'], s:5 },
  ];
}

// ── EPI/EPC de seed ─────────────────────────────────────────
function getEPIForSeed() {
  const items = [];
  const EPC = {
    'Travaux en hauteur': ['Garde-corps provisoires NF EN 13374','Filets de sécurité anti-chute','Plateforme individuelle roulante (PIRL)','Échafaudage fixe homologué','Ligne de vie collective horizontale','Balisage et signalisation périmètre'],
    'Travaux électriques': ['Consignation LOTO (verrouillage)','Balisage zone de travail','Extincteur CO2 à proximité','Tapis isolants de sol','Détecteur de présence tension'],
    'Manutention & levage': ['Balisage zone de levage','Interdiction passage sous charge','Stabilisateurs et cales','Signal sonore de manœuvre'],
    'Travaux en espace confiné': ['Ventilation forcée continue','Détecteur multigaz fixe/portable','Système de surveillance externe','Trépied de sauvetage','Plan de secours affiché'],
    'Produits chimiques & dangereux': ['Ventilation locale aspirante (VLA)','Douche de sécurité','Rince-yeux urgence EN 15154','Bacs de rétention 110%','Kit anti-déversement'],
    'Soudage & découpe thermique': ['Écrans anti-arc et anti-projections','Rideaux de soudage ignifugés','Extraction fumées centralisée','Balisage zone à chaud','Extincteur CO2 immédiat'],
    'Travaux sur voirie & route': ['Signalisation temporaire GTS','Flèche lumineuse de rabattement','Véhicule avec gyrophares','Barrières de protection'],
    'Maintenance industrielle': ['Consignation LOTO complète','Capots et protecteurs machine','Balisage zones dangereuses','Purge automatique pneumatique'],
    'Travaux de démolition': ['Filets et bâches anti-projection','Étaiement des structures','Balisage périmètre étendu','Aspersion eau (réduction poussières)'],
    'Travaux de toiture & étanchéité': ['Garde-corps de rive périphérie','Filets sous toiture','Balisage périmètre au sol','Ancrages collectifs certifiés'],
    'Terrassement & fouilles': ['Blindage de fouilles >1,30m','Béquilles et étais de sécurité','Balisage périmètre fouille','Passerelles accès garde-corps'],
    'Peinture & traitement de surface': ['Ventilation forcée du local','Extraction vapeurs bras aspirant','Bacs de rétention solvants','Armoire stockage inflammables'],
    'Outils numériques & IA': ['Affichage consignes utilisation outils IA','Procédure dégradée documentée et affichée','Cloisonnement réseau OT/IT (firewall industriel)','Arrêt d\'urgence accessible et testé'],
  };
  const EPI = {
    'Travaux en hauteur': ['Harnais antichute EN 361','Longe à absorption énergie EN 355','Casque avec mentonnière EN 397','Chaussures S3 EN ISO 20345','Gants anti-coupure EN 388','Vêtements haute visibilité cl.3'],
    'Travaux électriques': ['Gants diélectriques EN 60903','Casque diélectrique EN 50365','Combinaison ignifugée EN ISO 11612','Chaussures diélectriques','Visière faciale anti-arc'],
    'Manutention & levage': ['Chaussures S3 embout acier','Gants anti-écrasement EN 388','Casque si risque chute objet','Vêtement haute visibilité','Ceinture lombaire'],
    'Travaux en espace confiné': ['Appareil respiratoire isolant ARI','Combinaison protection type 5/6','Harnais évacuation complet','Chaussures antistatiques'],
    'Produits chimiques & dangereux': ['Masque FFP3 ou cartouche vapeurs','Lunettes étanches EN 166','Gants chimiquement résistants EN 374','Combinaison protection chimique','Bottes résistant aux produits'],
    'Soudage & découpe thermique': ['Masque auto-obscurcissant DIN≥11','Combinaison soudeur EN ISO 11611','Gants de soudeur EN 12477','Tablier cuir soudeur','Guêtres et jambières soudeur'],
    'Travaux sur voirie & route': ['Vêtement haute visibilité cl.3','Chaussures S3','Casque de chantier','Bouchons anti-bruit'],
    'Maintenance industrielle': ['Chaussures S3','Gants anti-coupure EN 388','Lunettes de protection','Bouchons/casque anti-bruit EN 352','Vêtement de travail ajusté'],
    'Travaux de démolition': ['Casque renforcé','Masque FFP3 poussières/amiante','Lunettes-masque intégral','Gants anti-coupure et anti-vibrations','Combinaison jetable type 5'],
    'Travaux de toiture & étanchéité': ['Harnais antichute EN 361','Casque avec mentonnière','Chaussures S3 antidérapantes','Vêtements haute visibilité'],
    'Terrassement & fouilles': ['Casque de chantier','Chaussures S3 anti-perforation','Gants de travail renforcés','Vêtements haute visibilité'],
    'Peinture & traitement de surface': ['Masque demi-masque + cartouche A2P3','Combinaison protection type 5','Gants résistant solvants EN 374','Chaussures antistatiques'],
    'Outils numériques & IA': ['Formation et habilitation outils IA (obligatoire)','Badge d\'accès zones automatisées','Vêtement haute visibilité dans zones robotisées','Chaussures S3 dans zones cobotique'],
  };
  let order = 0;
  for (const [type, list] of Object.entries(EPC)) {
    list.forEach(label => { items.push({ interventionType: type, category: 'collectif', label, order: order++ }); });
  }
  for (const [type, list] of Object.entries(EPI)) {
    list.forEach(label => { items.push({ interventionType: type, category: 'individuel', label, order: order++ }); });
  }
  return items;
}

module.exports = app;
