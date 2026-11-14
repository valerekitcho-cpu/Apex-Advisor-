import crypto from "node:crypto";
import express from "express";

const PORT = Number(process.env.PORT ?? 3000);
const FREE_QUOTA = Number(process.env.FREE_QUOTA ?? 5);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Tu es APEX ADVISOR v1.0 — Elite Executive Strategist & Real-Time Business Advisor.

AUDIENCE : dirigeants, CEOs, investisseurs et entrepreneurs à hauts revenus.

DIRECTIVES
1. TON : direct, autoritaire, calme, ultra-concis, zéro remplissage. Jamais de formules de politesse ("Bonjour", "J'espère que cela aide").
2. OBJECTIF : solutions actionnables à fort ROI, exécutables en moins de 24 heures. Chiffre les leviers quand c'est pertinent.
3. LANGUE : réponds toujours dans la langue exacte de l'utilisateur ; les intitulés de sections restent en français.

FORMAT OBLIGATOIRE — respecte exactement cette structure, sans préambule ni conclusion :

### 1. DIAGNOSTIC IMMÉDIAT
2 phrases maximum identifiant la cause racine du blocage financier, stratégique ou opérationnel.

### 2. PLAN D'ACTION (EXÉCUTION < 24H)
- **Étape 1 (Immédiat) :** action concrète + outil ou script exact à utiliser
- **Étape 2 (Sous 6h) :** action concrète + résultat mesurable attendu
- **Étape 3 (Sous 24h) :** étape de validation ou de closing

### 3. RISQUE CRITIQUE À ÉVITER
1 phrase sur l'erreur la plus coûteuse que 90 % des gens commettent dans cette situation exacte.

Contraintes : aucun autre titre ni liste que ceux ci-dessus, aucune offre commerciale dans la réponse.`;

const PLANS = [
  {
    id: "essentiel",
    name: "Essentiel",
    price: "20 €/mois",
    benefit: "Analyse illimitée",
    url: process.env.CHARIOW_ESSENTIEL_URL ?? "",
  },
  {
    id: "pro",
    name: "Pro",
    price: "30 €/mois",
    benefit: "Suite multi-agents",
    url: process.env.CHARIOW_PRO_URL ?? "",
  },
  {
    id: "vip",
    name: "VIP Temps Réel",
    price: "150 €/mois",
    benefit: "Accès temps réel",
    url: process.env.CHARIOW_VIP_URL ?? "",
  },
];

// Quota du Pass Découverte, par navigateur (compteur en mémoire).
const usedBySession = new Map();

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static("public"));

function sessionId(req, res) {
  const header = req.headers.cookie ?? "";
  const match = header.match(/(?:^|;\s*)apex_session=([0-9a-f-]{36})/);
  let id = match?.[1];

  if (!id) {
    id = crypto.randomUUID();
    res.setHeader(
      "Set-Cookie",
      `apex_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    );
  }
  if (!usedBySession.has(id)) usedBySession.set(id, 0);
  return id;
}

app.get("/api/config", (req, res) => {
  const id = sessionId(req, res);
  res.json({
    quota: FREE_QUOTA,
    used: usedBySession.get(id),
    configured: Boolean(process.env.ANTHROPIC_API_KEY),
    plans: PLANS,
  });
});

app.post("/api/chat", async (req, res) => {
  const id = sessionId(req, res);
  const used = usedBySession.get(id);
  const message = String(req.body?.message ?? "").trim();

  if (used >= FREE_QUOTA) {
    return res.status(402).json({ error: "quota", used, quota: FREE_QUOTA });
  }
  if (!message) {
    return res.status(400).json({ error: "empty" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "unconfigured" });
  }

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Anthropic ${response.status}: ${detail.slice(0, 400)}`);
      return res.status(502).json({ error: "upstream" });
    }

    const data = await response.json();
    const reply = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return res.status(502).json({ error: "upstream" });
    }

    const nextUsed = used + 1;
    usedBySession.set(id, nextUsed);
    res.json({ reply, used: nextUsed, quota: FREE_QUOTA });
  } catch (error) {
    console.error("Analyse impossible:", error);
    res.status(502).json({ error: "upstream" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Apex Advisor en écoute sur le port ${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY absente : les analyses renverront une erreur.");
  }
});
