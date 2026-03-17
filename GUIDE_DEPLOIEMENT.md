# Guide complet — MongoDB Atlas + Railway
## EvalRisque NORDCHROME — Mise en production multi-postes

---

## PARTIE 1 — Créer un compte MongoDB Atlas (gratuit)

### Étape 1 : S'inscrire sur MongoDB Atlas
1. Allez sur **https://www.mongodb.com/cloud/atlas/register**
2. Remplissez le formulaire (email + mot de passe) ou connectez-vous avec Google
3. Cliquez **"Create your Atlas account"**
4. Vérifiez votre email (lien de confirmation)

### Étape 2 : Créer un cluster gratuit
1. Après connexion, vous arrivez sur la page "Deploy your cluster"
2. Choisissez **"M0"** (Free Forever — 512 MB, suffisant pour EvalRisque)
3. **Provider** : AWS (recommandé) ou Google Cloud
4. **Region** : choisissez une région en Europe (ex: Frankfurt, Paris)
5. **Cluster Name** : `evalrisque` (ou ce que vous voulez)
6. Cliquez **"Create Deployment"**

### Étape 3 : Créer un utilisateur MongoDB
Une fenêtre "Connect to Cluster" s'ouvre automatiquement.

1. **Username** : `evalrisque_user` (retenez-le)
2. **Password** : cliquez **"Autogenerate Secure Password"** → **copiez ce mot de passe** (vous ne le reverrez plus)
3. Cliquez **"Create Database User"**

### Étape 4 : Autoriser les connexions depuis Railway
1. Dans la même fenêtre, section **"Where would you like to connect from?"**
2. Sélectionnez **"Cloud Environment"** (ou "Add My Current IP Address" + "Allow access from anywhere")
3. Dans le champ IP Address, entrez : **`0.0.0.0/0`** (autorise toutes les IPs — nécessaire pour Railway)
4. Cliquez **"Add Entry"** puis **"Finish and Close"**

### Étape 5 : Récupérer la chaîne de connexion (URI)
1. Sur le tableau de bord Atlas, cliquez **"Connect"** sur votre cluster
2. Choisissez **"Drivers"**
3. **Driver** : Node.js, **Version** : 5.5 or later
4. Copiez la chaîne de connexion qui ressemble à :
   ```
   mongodb+srv://evalrisque_user:<password>@evalrisque.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Remplacez `<password>`** par le mot de passe copié à l'étape 3
6. **Ajoutez le nom de la base** avant le `?` :
   ```
   mongodb+srv://evalrisque_user:VOTRE_MDP@evalrisque.xxxxx.mongodb.net/evalrisque?retryWrites=true&w=majority
   ```

**Gardez cette URI précieusement — vous en aurez besoin pour Railway.**

---

## PARTIE 2 — Déployer sur Railway

### Étape 1 : Créer un compte Railway
1. Allez sur **https://railway.app**
2. Cliquez **"Login"** → **"Login with GitHub"**
3. Autorisez Railway à accéder à votre GitHub

### Étape 2 : Préparer le code sur GitHub
1. Créez un nouveau repository GitHub (privé recommandé)
   - Sur **github.com** → cliquez **"+"** → **"New repository"**
   - Nom : `evalrisque-nordchrome`
   - Visibilité : **Private**
   - Cliquez **"Create repository"**

2. Décompressez le fichier `evalrisque-railway.zip` téléchargé

3. Uploadez les fichiers sur GitHub :
   - **Option simple** : sur la page du repo, cliquez **"uploading an existing file"**
   - Glissez-déposez TOUT le contenu du dossier `evalrisque-backend/`
   - Commit message : `Initial deploy`
   - Cliquez **"Commit changes"**

   > ⚠️ Ne pas uploader le dossier `node_modules/` (il est dans `.gitignore`)

### Étape 3 : Créer le projet Railway
1. Sur **railway.app** → cliquez **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Sélectionnez votre repo `evalrisque-nordchrome`
4. Railway détecte automatiquement que c'est un projet Node.js

### Étape 4 : Configurer les variables d'environnement
**C'est l'étape la plus importante.**

1. Dans Railway, cliquez sur votre service déployé
2. Allez dans l'onglet **"Variables"**
3. Cliquez **"+ New Variable"** et ajoutez ces 3 variables :

```
MONGODB_URI = mongodb+srv://evalrisque_user:VOTRE_MDP@evalrisque.xxxxx.mongodb.net/evalrisque?retryWrites=true&w=majority
```
(copiez exactement l'URI de MongoDB Atlas avec votre vrai mot de passe)

```
JWT_SECRET = (générez une chaîne aléatoire longue — voir ci-dessous)
```

```
FRONTEND_URL = *
```

**Générer un JWT_SECRET :**
Utilisez un de ces générateurs en ligne :
- https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx (choisissez 256-bit)
- Ou tapez dans n'importe quel terminal : `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

Exemple : `a3f8e2c1d9b7456f0a8e3c2d1b9f7456a3e8f2c1d9b745...` (64+ caractères)

### Étape 5 : Générer le domaine public
1. Dans Railway → votre service → onglet **"Settings"**
2. Section **"Networking"** → cliquez **"Generate Domain"**
3. Railway vous donne une URL du type : `https://evalrisque-nordchrome-production.up.railway.app`

**C'est l'URL à partager avec tous vos utilisateurs.**

### Étape 6 : Vérifier le déploiement
1. Cliquez sur **"Deployments"** pour voir les logs
2. Vous devriez voir :
   ```
   ✅ MongoDB connecté
   👤 Admin par défaut créé — login: admin / pass: admin123
   🚀 Serveur démarré sur le port XXXX
   ```
3. Ouvrez l'URL Railway dans votre navigateur → la page de connexion EvalRisque apparaît

---

## PARTIE 3 — Première utilisation

### Connexion initiale
- **URL** : votre URL Railway
- **Login** : `admin`
- **Mot de passe** : `admin123`

### ⚠️ Actions immédiates après la première connexion

1. **Changer le mot de passe admin**
   - Panel Admin → Utilisateurs → 🔑 MDP → entrez un nouveau mot de passe fort

2. **Renseigner les informations de la société**
   - Panel Admin → Société → remplissez Nom, SIRET, adresse, etc.

3. **Créer les comptes utilisateurs**
   - Panel Admin → Utilisateurs → remplissez les champs (login, nom, site, responsable)

---

## PARTIE 4 — Accès multi-postes

Une fois déployé, chaque utilisateur accède à l'application via la même URL Railway.
**Aucune installation nécessaire** — fonctionne dans tout navigateur moderne.

### Partager l'accès
Envoyez à chaque utilisateur :
- **URL** : `https://votre-app.up.railway.app`
- **Login** : leur identifiant
- **Mot de passe** : leur mot de passe initial

### Fonctionnement
- Toutes les données sont partagées en temps réel via MongoDB Atlas
- Les rapports en attente de validation apparaissent instantanément pour le responsable
- Les plans de prévention sont accessibles à tous les utilisateurs autorisés

---

## Tarification

| Service | Offre gratuite | Limite |
|---------|---------------|--------|
| MongoDB Atlas | M0 Free Forever | 512 MB stockage |
| Railway | Hobby ($5/mois) | Nécessaire pour les déploiements continus |

> Railway offre $5 de crédit gratuit au démarrage.
> Pour un usage professionnel continu, le plan **Hobby à $5/mois** est suffisant.

---

## Résolution de problèmes courants

### "MongoServerError: bad auth"
→ Le mot de passe dans MONGODB_URI contient des caractères spéciaux.
Encodez-les : `@` → `%40`, `#` → `%23`, `$` → `%24`

### "MongoNetworkTimeoutError"
→ L'IP de Railway n'est pas autorisée dans Atlas.
Vérifiez que vous avez bien ajouté `0.0.0.0/0` dans Network Access.

### L'app affiche une page blanche
→ Vérifiez les logs Railway (onglet Deployments).
La variable MONGODB_URI est peut-être manquante ou incorrecte.

### "Cannot find module"
→ Railway n'a pas installé les dépendances.
Vérifiez que `package.json` est bien à la racine du repo (pas dans un sous-dossier).
EOF