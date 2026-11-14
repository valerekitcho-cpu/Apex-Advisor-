# AGENTS.md — Apex Advisor

## Ce que fait le projet
Application Node.js (Express) mono-service : API `/api/chat` + interface statique dans `public/`.
Aucune étape de build — le serveur sert directement `public/`.

## Lancer
```sh
docker compose -f docker-compose.base44.yml up -d
curl -s http://localhost:3000/            # doit renvoyer le HTML de l'app
docker compose -f docker-compose.base44.yml logs -f web
```
Le conteneur installe les dépendances (`npm ci`) au démarrage puis lance `node --watch server.js`
(rechargement automatique sur modification de `server.js` et de `public/`).
Une modification de `package.json` / `package-lock.json` est prise en compte au redémarrage du service :
```sh
docker compose -f docker-compose.base44.yml restart web
```

## Points non évidents
- `ANTHROPIC_API_KEY` est injectée via `/run/base44/app.env` (`env_file`). Sans elle le serveur démarre
  normalement et `/api/chat` répond `503 {"error":"unconfigured"}` — c'est l'état attendu avant connexion de la clé.
- L'appel modèle se fait avec `fetch` vers `https://api.anthropic.com/v1/messages` (aucun SDK) ; modèle réglable
  par `ANTHROPIC_MODEL` (défaut `claude-sonnet-4-5`).
- Le quota du Pass Découverte (`FREE_QUOTA`, défaut 5) est compté **côté serveur** par cookie `apex_session`
  (Map en mémoire) et n'incrémente qu'après une analyse réussie. Il est donc remis à zéro à chaque redémarrage
  du serveur : c'est volontaire en développement, pas un bug.
- `GET /api/config` expose quota, consommation courante et liens d'abonnement ; le front s'en sert pour la barre
  de mise à niveau (masquée en simple mention si aucun `CHARIOW_*_URL` n'est fourni).
- Les trois liens de paiement (`CHARIOW_ESSENTIEL_URL`, `CHARIOW_PRO_URL`, `CHARIOW_VIP_URL`) sont optionnels et
  proviennent des secrets de l'app, jamais du code.

## Vérifier
```sh
curl -s http://localhost:3000/api/config              # quota, used, configured, plans
curl -s -X POST http://localhost:3000/api/chat -H 'content-type: application/json' \
  -d '{"message":"Comment négocier un contrat de 50 000 € ?"}'
```
Avec une clé valide, la réponse doit contenir les trois sections `1. DIAGNOSTIC IMMÉDIAT`,
`2. PLAN D'ACTION (EXÉCUTION < 24H)`, `3. RISQUE CRITIQUE À ÉVITER`.
