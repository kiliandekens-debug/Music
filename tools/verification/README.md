# Harnais de vérification

Outils de développement uniquement. **Rien ici n'est utilisé par l'application** :
ni en développement normal, ni en production. Le dossier sert à faire tourner
Atelier de bout en bout sur une machine sans projet Supabase, pour vérifier
qu'aucune régression n'a été introduite.

Le harnais rejoue les trois services de Supabase :

| Service  | Remplacé par                                          |
| -------- | ----------------------------------------------------- |
| Postgres | un vrai PostgreSQL local, avec la migration du projet |
| REST     | PostgREST, avec le même secret JWT                    |
| Auth     | un faux GoTrue minimal (`supabase-harness.mjs`)       |
| Storage  | un stockage en mémoire (`supabase-harness.mjs`)       |

La Row Level Security est donc **réellement** exercée : PostgREST se connecte
avec le rôle `authenticated` et les claims du JWT, exactement comme Supabase.

> ⚠️ Le faux service d'authentification accepte le code `123456` pour n'importe
> quel compte. Il ne doit jamais être exposé sur un réseau ni servir ailleurs
> qu'en local.

## Prérequis

- PostgreSQL 16 (`initdb`, `pg_ctl`, `psql`)
- Le binaire [PostgREST](https://github.com/PostgREST/postgrest/releases) dans le `PATH` ou dans `/tmp/postgrest`
- Les dépendances du projet installées (`npm install`)

## Mise en route

```bash
# 1. Base de données : stub Supabase + migration + rôles
createdb atelier
psql -d atelier -f tools/verification/00-supabase-stub.sql
psql -d atelier -f supabase/migrations/0001_init.sql
psql -d atelier -f tools/verification/01-roles.sql

# 2. PostgREST
postgrest tools/verification/postgrest.conf

# 3. Faux services auth + storage
node tools/verification/supabase-harness.mjs

# 4. L'application, pointée sur le harnais
NEXT_PUBLIC_SUPABASE_URL=http://localhost:5555 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=harness-anon-key \
npm run dev -- -p 3111
```

Comptes disponibles : `producteur@exemple.com` et `autre@exemple.com`,
code de connexion `123456`.

## Vérifications

### Isolation des données et règles de base

```bash
psql -d atelier -f tools/verification/rls-test.sql
```

Contrôle que :

- un compte ne voit, ne modifie et ne supprime que ses propres lignes ;
- une insertion au nom d'un autre utilisateur est refusée ;
- « Répondu » découle bien de la présence d'une date de réponse ;
- la progression exclut les tâches ignorées ;
- les contraintes (BPM, unicité d'un relevé par jour) tiennent ;
- la suppression d'une track emporte ses enfants sans toucher aux labels.

### Parcours complet dans un navigateur

```bash
node tools/verification/make-wav.mjs /tmp/demo.wav 180   # fichier audio de test
node tools/verification/e2e.mjs
```

Le parcours couvre les critères de validation du produit : connexion,
onboarding, création et déplacement d'une track, checklist et recalcul de la
progression, version audio, correction horodatée et saut du lecteur au bon
instant, envoi à un label et suivi du délai, case « Répondu », campagne et
planning à rebours, Mode Session avec bilan, persistance après actualisation,
rendu mobile, et absence de fuite de données entre deux comptes.

Deux parcours complémentaires couvrent le reste des critères :

```bash
node tools/verification/e2e-artwork-campagne.mjs    # artwork, proposition de campagne, réorganisation du planning
node tools/verification/e2e-contenu-resultats.mjs   # contenu planifié, relevé de résultats, changement d'étape, fiche label
node tools/verification/e2e-kanban.mjs              # glisser-déposer du pipeline et trace dans l'historique
```

Les captures d'écran sont écrites dans `/tmp/shots`.

### Logique métier

Les règles pures (progression, relances, planning promotionnel, moteur
« Prochaine action ») sont couvertes par des tests unitaires qui ne
nécessitent aucun service :

```bash
npm test
```
