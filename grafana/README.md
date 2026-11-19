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

1. **Connections → Data sources → PostgreSQL**
2. **Host** : `db.<votre-ref>.supabase.co` (sans `:5432` dans le host)
3. **Database** : `postgres` · **User** : `postgres` · **SSL** : require
4. **Password** : mot de passe *Database* (Settings → Database dans Supabase)
5. **UID** de la source : `supabase-ged` (recommandé pour import direct du JSON)

Référence projet GED actuel : `bkjdvdngadytbzgdcuik` → host `db.bkjdvdngadytbzgdcuik.supabase.co`

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