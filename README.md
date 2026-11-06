# 🏃 Marathon Live

Page de suivi en direct d'un coureur, superposée à la trace GPX du parcours.

- **Carte** : parcours avec sens de course (flèches), bornes km, ravitos 💧, départ 🚦, arrivée 🏁.
- **Coureur** : position en direct, partie déjà courue en orange, position estimée entre deux signaux GPS.
- **Horaires de passage** : prochains points avec heure estimée, et **toucher n'importe quel point du parcours** donne l'heure de passage (y compris quand le parcours passe plusieurs fois au même endroit).
- **Stats** : temps de course, allure actuelle, arrivée estimée, avance/retard sur l'objectif, temps par km.
- **Objectif** : temps final visé (ex. 3h45) **ou** allure (ex. 5'20/km), réglable depuis `runner.html`, même pendant la course ; mis à jour en direct chez tous les spectateurs.
- **Ludique** : lièvre virtuel ⏱️ à l'allure objectif, confettis à l'arrivée.
- **Démo** : `…/#demo` simule une course (temps accéléré ×20).

## Comment ça marche

```
iPhone (OwnTracks) ──POST──▶ Firebase Realtime Database ◀──flux en direct── page GitHub Pages (proches)
```

GitHub Pages ne sert que des fichiers statiques : les positions sont stockées dans une base Firebase gratuite.
La **clé secrète** est dans le lien partagé (après le `#`), jamais dans le dépôt : le dépôt peut donc être public.

## Mise en place (≈ 20 min, à faire une fois)

### 1. Base Firebase (gratuite)
1. https://console.firebase.google.com → **Créer un projet** (Analytics inutile).
2. Menu **Build → Realtime Database → Créer une base**, région **europe-west1**, démarrer en **mode verrouillé**.
3. Onglet **Règles** : colle le contenu de `database.rules.json`, puis **Publier**.
4. Copie l'URL de la base (ex. `https://xxx-default-rtdb.europe-west1.firebasedatabase.app`) dans `config.js` → `firebaseUrl`.
5. Ajuste aussi `runnerName`, `raceName`, l'objectif par défaut (`targetTime` ou `targetPace`) et éventuellement `startTime`.

### 2. GitHub Pages
1. Crée un dépôt et pousse ces fichiers.
2. **Settings → Pages → Source : Deploy from a branch → `main` / root**.
3. Le site est disponible sur `https://<ton-pseudo>.github.io/<depot>/`.

### 3. Espace coureur (sur ton iPhone)
Ouvre `https://<ton-pseudo>.github.io/<depot>/runner.html` :
- une clé secrète est générée ;
- tu obtiens le **lien à partager** et l'**URL à coller dans OwnTracks**.

### 4. OwnTracks (envoi GPS en arrière-plan)
1. App Store → **OwnTracks** (gratuit).
2. Réglages → **Mode : HTTP**, **URL** : celle donnée par l'espace coureur.
3. Réglages iPhone → OwnTracks → Position : **Toujours** + **Position exacte**.
4. Le jour J : mode de suivi **Move** (envoi fréquent).

> Plan B : le bouton « Démarrer l'envoi » de `runner.html` envoie la position depuis Safari, mais **uniquement écran allumé**.

### 5. Avant le départ
Dans `runner.html` : **Effacer toutes les positions** (supprime les tests et l'échauffement).

## Coût
Gratuit pour cet usage : offre Firebase « Spark » sans carte bancaire (1 Go stocké, 10 Go/mois téléchargés, 100 connexions simultanées ; une course ≈ quelques centaines de Ko). GitHub Pages est gratuit pour un dépôt public. Ne passe pas Firebase en offre « Blaze » : inutile ici.

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html`, `app.js`, `style.css` | Page de suivi |
| `runner.html` | Espace coureur (clé, liens, envoi de secours, remise à zéro) |
| `config.js` | **Seul fichier à modifier** |
| `target.js` | Calculs d'objectif (temps final ↔ allure) |
| `trace.gpx` | Parcours (remplaçable par n'importe quel GPX) |
| `database.rules.json` | Règles de sécurité Firebase |
| `vendor/leaflet` | Bibliothèque de carte (incluse, pas de dépendance externe) |
