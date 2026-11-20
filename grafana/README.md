# Supervision GED / BRAGATEST avec Grafana

Comme **snowAI** : les actions web (GED + BRAGATEST) sont journalisées dans Supabase (`bragatest_events`), puis visualisées dans **Grafana** via la source **PostgreSQL**.

## 1. Préparer Supabase

Dans le **SQL Editor** du projet lié au GED, exécutez :

`supabase/grafana-observability.sql`

| `event_type` | Signification |
|--------------|----------------|
| `page_view` | Ouverture GED ou BRAGATEST |
| `ged_load` | Chargement des procédures |
| `ged_insert` / `ged_update` / `ged_delete` | CRUD GED |
| `braga_search_complete` | Recherche BRAGATEST terminée |
| `client_error` | Erreur côté navigateur |

## 2. Grafana — source PostgreSQL

Le dashboard utilise l’**UID** `supabase-ged`. Sans cette source, tous les panneaux affichent **No data** (comme snowAI utilise `supabase-snowai` sur un autre projet).

**Automatique (recommandé)** :

```powershell
cd c:\Users\LASRY\Projects\ged\grafana
copy .env.example .env
# Éditez .env : GRAFANA_ADMIN_PASSWORD + SUPABASE_DB_PASSWORD (mot de passe Database GED)
.\setup-grafana-datasource.ps1
```

**Manuel** : **Connections → Data sources → PostgreSQL**

| Champ | Valeur |
|--------|--------|
| Name | Supabase GED |
| **UID** | **`supabase-ged`** (obligatoire) |
| Host | `db.bkjdvdngadytbzgdcuik.supabase.co` |
| Database | `postgres` |
| User | `postgres` |
| SSL | require |
| Password | mot de passe *Database* (Supabase → Settings → Database) |

**Lien dashboard** (Grafana local) : [http://localhost:3000/d/bragatest-supervision](http://localhost:3000/d/bragatest-supervision)

### Erreur « tenant/user postgres.… not found » (pooler)

Vous avez mélangé **pooler** et **utilisateur direct**. Corrigez :

| Mode | Host | User | Port |
|------|------|------|------|
| **Direct (recommandé)** | `db.bkjdvdngadytbzgdcuik.supabase.co` | `postgres` | 5432 |
| Pooler (Session) | *copier depuis Supabase* | `postgres.bkjdvdngadytbzgdcuik` | souvent 5432 ou 6543 |

Ne devinez pas `aws-0-eu-central-1.pooler…` : l’hôte exact est dans **Database → Connection string → Session pooler**.

Puis relancez `.\setup-grafana-datasource.ps1` ou **Save & test** dans Grafana.

## 3. Importer le tableau de bord

**Dashboards → Import** → `grafana/dashboards/bragatest-supervision.json`

Choisir la source PostgreSQL `supabase-ged`.

## 4. Panneaux

- Connectivité BDD / table `bragatest_events` / activité 30 min
- Volume d’événements par jour
- Recherches BRAGATEST (hits, durée)
- Opérations GED (insert / update / delete / load)
- Erreurs par source
- Journal des 50 derniers événements

## 5. Grafana local (optionnel)

Vous pouvez réutiliser le dossier `grafana/` de **snowAI** (`start-grafana.ps1`) en important ce dashboard et en pointant la même source Supabase.