# Atelier

Gestionnaire de production musicale pour producteur de musique électronique.
Suit le cycle de vie complet d'une track : de la première idée jusqu'à la
sortie, sa promotion et l'analyse de ses résultats.

Application personnelle, en français, installable sur ordinateur et iPhone.

---

## Ce que fait l'application

| Section         | Rôle                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| **Aujourd'hui** | La prochaine action recommandée, les retards, les relances, les sorties proches   |
| **Studio**      | Le pipeline de production en Kanban, la fiche complète de chaque track            |
| **Sessions**    | Le Mode Session : une track, trois tâches maximum, un chronomètre, un bilan       |
| **Releases**    | Campagnes promotionnelles, contenus, contacts promo, résultats                    |
| **Labels**      | Mini-CRM : fiches labels, envois, réponses, relances, historique                  |
| **Calendrier**  | Vue mensuelle et agenda de tout ce qui est daté                                   |
| **Analyses**    | Production, labels et promotion, calculés sur vos données réelles                 |
| **Paramètres**  | Espaces, étapes du pipeline, modèles de checklists, préférences                   |

Quelques partis pris :

- **Deux progressions distinctes.** Une track peut être terminée musicalement à
  100 % et n'être qu'à 35 % de promotion. Les deux ne se mélangent jamais.
- **Le moteur « Prochaine action » est un moteur de règles**, pas une IA. Chaque
  suggestion affiche la règle qui l'a produite, et vous pouvez toujours épingler
  une autre action à la place.
- **Une réponse appartient à un envoi**, jamais à un label : le même label peut
  recevoir plusieurs tracks et répondre différemment à chacune.
- **Une relance crée un rappel, jamais un e-mail automatique.** Le bouton
  « Ouvrir dans mon application e-mail » prépare un message, vous l'envoyez.
- **Les analyses ne montrent que de vraies données.** Aucun chiffre n'est
  inventé ni estimé ; les résultats de sortie sont saisis à la main.

---

## Installation

### 1. Créer le projet Supabase

Sur [supabase.com](https://supabase.com), créez un projet, puis dans
**SQL Editor** exécutez le contenu de :

```
supabase/migrations/0001_init.sql
```

Cette migration crée les 22 tables, les index, les déclencheurs `updated_at`,
la Row Level Security sur chaque table, le bucket de stockage privé `media`,
et la création automatique du profil à l'inscription.

### 2. Configurer l'authentification

Dans **Authentication → Providers**, gardez uniquement `Email` activé.

L'application se connecte par lien envoyé par e-mail (pas de mot de passe).
Une fois **votre** compte créé, désactivez les inscriptions publiques dans
**Authentication → Sign In / Providers → Allow new users to sign up** :
l'application est personnelle et n'affiche aucun écran d'inscription.

Pour pouvoir aussi vous connecter avec un code à 6 chiffres (pratique sur
iPhone), ajoutez `{{ .Token }}` au modèle d'e-mail « Magic Link » dans
**Authentication → Email Templates**.

Dans **Authentication → URL Configuration**, ajoutez vos URL de redirection :
`http://localhost:3000/auth/callback` et celle de votre déploiement.

### 3. Configurer l'application

```bash
cp .env.example .env.local
```

Renseignez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(**Project Settings → API**), ainsi que `NEXT_PUBLIC_SITE_URL`.

> La clé `service_role` ne doit jamais être placée dans une variable
> `NEXT_PUBLIC_*` : elle contourne la Row Level Security. L'application n'en a
> pas besoin.

### 4. Lancer

```bash
npm install
npm run dev
```

À la première connexion, un onboarding court propose vos espaces
(Deepest Mind, ELVIK, Remixes, Idées à trier), les étapes du pipeline, le délai
de relance par défaut, une première track et quelques labels.

---

## Déploiement

Compatible Vercel sans configuration particulière :

1. Importez le dépôt.
2. Ajoutez les trois variables d'environnement de `.env.example`
   (`NEXT_PUBLIC_SITE_URL` doit pointer sur l'URL de production).
3. Déployez.

Ajoutez ensuite l'URL de production dans les **Redirect URLs** de Supabase.

---

## Installer comme application (PWA)

- **iPhone** — ouvrez le site dans Safari, bouton Partager, « Sur l'écran
  d'accueil ». L'application s'ouvre en plein écran, avec la barre de
  navigation inférieure.
- **Windows** — dans Chrome ou Edge, icône d'installation dans la barre
  d'adresse, ou menu ⋯ → « Installer ».

Le service worker met en cache la coquille de l'interface pour un démarrage
immédiat. **Les données ne sont jamais mises en cache** : elles sont toujours
demandées au réseau, pour ne jamais afficher d'information périmée comme si
elle était à jour.

---

## Architecture

```
src/
├── app/
│   ├── (app)/              Sections protégées par le middleware
│   │   ├── aujourdhui/     Tableau de bord et prochaine action
│   │   ├── studio/         Pipeline + fiche track (9 onglets)
│   │   ├── sessions/       Historique et Mode Session
│   │   ├── releases/       Campagnes, contenus, contacts, résultats
│   │   ├── labels/         Mini-CRM et suivi des envois
│   │   ├── calendrier/     Mois et agenda
│   │   ├── analyses/       Production, labels, promotion
│   │   ├── parametres/     Espaces, pipeline, modèles, compte
│   │   └── plus/           Écran « Plus » de la navigation mobile
│   ├── connexion/          Connexion par e-mail
│   └── auth/callback/      Retour des liens de connexion
├── components/
│   ├── ui/                 Primitives accessibles + icônes + toasts
│   ├── layout/             Barre latérale, navigation mobile, ajout rapide
│   ├── tracks/             Cartes, Kanban, formulaire, onglets de la fiche
│   ├── labels/             Formulaires, liste d'envois, réponse, fiche label
│   ├── promo/              Campagne, contenus, envois promo, résultats
│   ├── sessions/           Démarrage d'une session
│   └── audio/              Lecteur partagé et corrections horodatées
└── lib/
    ├── domain/             Règles métier pures, testées unitairement
    │   ├── progress.ts     Progression pondérée, production et promotion
    │   ├── submissions.ts  Délais, relances, réponses, statistiques
    │   ├── promo-plan.ts   Planning à rebours J−28 → J+14 et assets
    │   ├── next-action.ts  Moteur de règles « Prochaine action »
    │   ├── templates.ts    Modèles de checklists fournis
    │   └── calendar.ts     Agrégation des évènements datés
    ├── store/              Données, filtres, session en cours, sélecteurs
    ├── supabase/           Clients navigateur et serveur
    ├── types.ts            Types des 22 tables
    └── constants.ts        Vocabulaire de l'interface (français)
```

### Couche de données

Le jeu de données d'un producteur reste petit (quelques milliers de lignes).
Il est chargé une fois en mémoire au démarrage, ce qui rend les filtres, le
Kanban et les analyses instantanés. Chaque mutation est écrite dans Supabase
avec **mise à jour optimiste et retour arrière** en cas d'échec : l'interface
répond immédiatement, et une erreur réseau ne laisse jamais un état faux à
l'écran.

Les valeurs par défaut de la base sont répliquées côté client
(`COLUMN_DEFAULTS`) pour qu'une ligne affichée avant la réponse du serveur ait
exactement la même forme qu'une ligne réelle.

### Sécurité

- Chaque table utilisateur porte un `user_id` référençant `auth.users`.
- Quatre politiques RLS par table (`select`, `insert`, `update`, `delete`),
  toutes vérifiant `auth.uid() = user_id`.
- Le bucket `media` est privé ; les politiques de stockage exigent que le
  premier segment du chemin soit l'identifiant de l'utilisateur.
- Les fichiers sont servis par des URL signées temporaires.
- Le middleware redirige toute page non publique vers la connexion.

L'isolation est vérifiée par un test qui tente réellement de lire, modifier,
supprimer et insérer les données d'un autre compte (voir ci-dessous).

### Internationalisation

L'interface est entièrement en français. Les libellés visibles sont regroupés
dans `src/lib/constants.ts` et les valeurs stockées en base sont des
identifiants stables non traduits (`a_faire`, `reponse_recue`, …). Ajouter une
langue plus tard ne demandera donc aucune migration de données.

---

## Développement

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm run typecheck  # TypeScript strict, sans émission
npm test           # tests unitaires des règles métier
npm run icons      # régénère les icônes PWA
```

### Vérification

Les règles métier sont couvertes par des tests unitaires (`npm test`) :
progression pondérée, exclusion des tâches ignorées, indépendance
production / promotion, libellés de relance, bascule automatique en « Refusé »,
détection des envois en double, planning à rebours, et ordre des règles du
moteur « Prochaine action ».

Pour vérifier l'application entière sans projet Supabase — y compris la Row
Level Security, le téléversement audio et le parcours complet dans un
navigateur — voir [`tools/verification/README.md`](tools/verification/README.md).

---

## Choix assumés de cette première version

- Pas d'abonnement, de paiement, d'équipe ni d'organisation : usage personnel.
  L'architecture reste multi-utilisateur (`user_id` partout) pour permettre une
  évolution ultérieure.
- Pas de connexion aux plateformes de streaming : les résultats de sortie sont
  saisis manuellement. Aucun chiffre n'est simulé.
- Pas d'envoi d'e-mails depuis l'application : elle prépare le message et
  crée les rappels, l'envoi reste dans votre client e-mail.
- Le chemin d'un projet Ableton est stocké comme texte avec un bouton de copie.
  Un navigateur ne peut pas ouvrir un fichier local, et l'application ne
  prétend pas le contraire.
