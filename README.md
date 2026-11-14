# Apex-Advisor-
Apex Advisor est un agent IA stratège d'affaires de haut niveau conçu pour agir comme un conseiller exécutif personnel auprès des dirigeants, investisseurs et entrepreneurs à hauts revenus. Son rôle unique est de transformer n'importe quel blocage financier, commercial ou stratégique en un plan d'action concret et chiffré en moins de 30 secondes.

## Fonctionnement
Interface de chat française (thème sombre) + API Node.js/Express qui interroge Claude (Anthropic) avec le
prompt système « Apex Advisor v1.0 ». Chaque réponse suit le format imposé :
**1. Diagnostic immédiat → 2. Plan d'action (< 24 h) → 3. Risque critique à éviter**.

Le Pass Découverte offre 5 analyses par navigateur (quota compté côté serveur), puis l'interface propose les
pass Essentiel (20 €/mois), Pro (30 €/mois) et VIP Temps Réel (150 €/mois).

## Lancer
```sh
docker compose -f docker-compose.base44.yml up -d
```
L'app écoute sur http://localhost:3000.

## Configuration
| Variable | Rôle |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clé API Anthropic — requise pour générer les analyses |
| `ANTHROPIC_MODEL` | Modèle utilisé (défaut `claude-sonnet-4-5`) |
| `FREE_QUOTA` | Nombre d'analyses du Pass Découverte (défaut `5`) |
| `CHARIOW_ESSENTIEL_URL`, `CHARIOW_PRO_URL`, `CHARIOW_VIP_URL` | Liens de paiement affichés dans la barre de mise à niveau |

Les secrets sont fournis par l'environnement Base44 (`/run/base44/app.env`) ; aucun n'est stocké dans le dépôt.

## API
- `GET /api/config` — quota, consommation du visiteur, liens d'abonnement.
- `POST /api/chat` — `{"message": "..."}` → `{"reply": "...", "used": n, "quota": 5}`.

Voir `AGENTS.md` pour les détails d'exploitation et de vérification.
