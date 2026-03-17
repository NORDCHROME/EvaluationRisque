# EvalRisque — Déploiement Railway + MongoDB

Application multi-poste d'évaluation des risques professionnels.
Accessible depuis n'importe quel PC via un navigateur web.

---

## Architecture

```
evalrisque-backend/
├── src/
│   ├── server.js          ← Point d'entrée Express
│   ├── models/index.js    ← Modèles Mongoose (MongoDB)
│   ├── routes/
│   │   ├── auth.js        ← Login / JWT
│   │   ├── users.js       ← Gestion utilisateurs
│   │   └── data.js        ← Toutes les données (risques, PP, etc.)
│   └── middleware/auth.js ← Vérification JWT
├── public/
│   └── index.html         ← Frontend (EvalRisque complet)
├── package.json
├── railway.json
└── .env.example
```

---

## Déploiement sur Railway (5 étapes)

### 1. Créer un compte Railway
Allez sur [railway.app](https://railway.app) et connectez-vous avec GitHub.

### 2. Créer un nouveau projet

```bash
# Option A : Via GitHub (recommandé)
# → Poussez ce dossier sur un repo GitHub privé
# → Sur Railway : "New Project" → "Deploy from GitHub repo"

# Option B : Via Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### 3. Ajouter MongoDB

Dans votre projet Railway :
- Cliquez **"+ New"** → **"Database"** → **"Add MongoDB"**
- Railway crée automatiquement `MONGODB_URL` (ou `MONGO_URL`) dans vos variables

> ⚠️ Vérifiez le nom exact de la variable dans l'onglet **Variables** du plugin MongoDB.
> Railway peut l'appeler `MONGODB_URL` ou `MONGO_URL` selon la version.

### 4. Configurer les variables d'environnement

Dans Railway → votre service → onglet **Variables**, ajoutez :

| Variable | Valeur |
|----------|--------|
| `MONGODB_URI` | Copiez la valeur de `MONGODB_URL` du plugin MongoDB |
| `JWT_SECRET` | Une chaîne aléatoire longue (ex: `openssl rand -hex 64`) |
| `FRONTEND_URL` | `*` (ou votre domaine Railway si vous le connaissez) |
| `PORT` | `3000` (Railway le définit souvent automatiquement) |

### 5. Déployer

Railway déploie automatiquement à chaque push GitHub.
Votre app sera disponible à l'URL fournie par Railway (ex: `https://evalrisque-xxx.railway.app`).

---

## Première connexion

Identifiants par défaut créés automatiquement :
- **Login** : `admin`
- **Mot de passe** : `admin123`

> ⚠️ **CHANGEZ le mot de passe admin immédiatement** après la première connexion
> (Panel Admin → Utilisateurs → 🔑 MDP)

---

## Utilisation multi-postes

Une fois déployé, **tous les utilisateurs** accèdent à la même URL Railway.
Les données sont partagées en temps réel via MongoDB :
- Utilisateurs et droits gérés centralement
- Plans de prévention visibles par tous
- Validations et signatures synchronisées
- Historique des rapports centralisé

---

## Développement local

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier .env
cp .env.example .env
# Éditez .env avec votre MongoDB local ou Atlas

# 3. Démarrer
npm run dev   # avec nodemon (rechargement auto)
# ou
npm start     # production
```

L'app sera disponible sur `http://localhost:3000`

---

## Variables d'environnement complètes

```env
# MongoDB (Railway fournit automatiquement MONGODB_URL si plugin ajouté)
MONGODB_URI=mongodb://localhost:27017/evalrisque

# JWT — OBLIGATOIRE en production, doit être long et aléatoire
JWT_SECRET=changez_moi_avec_une_vraie_valeur_aleatoire_longue

# Port (Railway le définit automatiquement)
PORT=3000

# CORS — mettez votre domaine Railway en production
FRONTEND_URL=*
```

---

## Structure de la base MongoDB

| Collection | Contenu |
|------------|---------|
| `users` | Utilisateurs, rôles, sites, responsables |
| `companies` | Informations société NORDCHROME |
| `externalcompanies` | Carnet entreprises extérieures |
| `workers` | Carnet intervenants |
| `pplans` | Plans de prévention sauvegardés |
| `reports` | Historique des rapports PDF générés |
| `validations` | Rapports en attente / validés / refusés |
| `customrisks` | Risques ajoutés par l'admin |
| `customkeywords` | Mots-clés IA personnalisés |
| `customtypes` | Types d'intervention créés par l'admin |
| `hiddenrisks` | Risques masqués par l'admin |
| `settings` | Paramètres (features, signature, etc.) |

---

## Sécurité

- Authentification JWT (12h d'expiration)
- Mots de passe hashés avec bcrypt (10 rounds)
- Rate limiting sur `/api/auth/login` (20 req / 15 min)
- Seuls les admins accèdent aux routes sensibles
- CORS configurable par variable d'environnement
