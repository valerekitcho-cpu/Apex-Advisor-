const chatBox = document.getElementById("chatBox");
const form = document.getElementById("chatForm");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const quotaLine = document.getElementById("quotaLine");
const upgradeBar = document.getElementById("upgradeBar");

const state = { quota: 5, used: 0, plans: [], busy: false };

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
}

// Rendu léger de la réponse structurée : titres ###, listes -, gras.
function formatReply(text) {
  let html = "";
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const raw of escapeHtml(text).split("\n")) {
    const line = raw.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (/^#{1,4}\s+/.test(line)) {
      closeList();
      html += `<h3>${inline(line.replace(/^#{1,4}\s+/, ""))}</h3>`;
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-•*]\s+/, ""))}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inline(line)}</p>`;
  }

  closeList();
  return html;
}

function scrollDown() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addMessage(className, html) {
  const node = document.createElement("div");
  node.className = `msg ${className}`;
  node.innerHTML = html;
  chatBox.appendChild(node);
  scrollDown();
  return node;
}

function addUserMessage(text) {
  const node = document.createElement("div");
  node.className = "msg user";
  node.textContent = text;
  chatBox.appendChild(node);
  scrollDown();
}

function plansMarkup(plans) {
  return plans
    .filter((plan) => plan.url)
    .map((plan) => `<a href="${escapeHtml(plan.url)}" target="_blank" rel="noopener">${escapeHtml(plan.name)} (${escapeHtml(plan.price)})</a>`)
    .join('<span class="sep">•</span>');
}

function renderUpgradeBar() {
  const links = plansMarkup(state.plans);
  if (!links) {
    upgradeBar.innerHTML = "Pass Découverte actif — 5 analyses offertes.";
    return;
  }
  upgradeBar.innerHTML = `Besoin d'analyses illimitées ? Passez au niveau ${links}`;
}

function renderQuota() {
  const remaining = Math.max(state.quota - state.used, 0);
  quotaLine.textContent = `Analyses restantes sur votre Pass Découverte : ${remaining} / ${state.quota}`;
}

function quotaReachedMarkup() {
  const links = plansMarkup(state.plans);
  return `<strong>Limite du Pass Découverte atteinte.</strong><br>
    Pour continuer à obtenir des stratégies en temps réel, activez votre abonnement :<br>
    ${links || "Les liens d'abonnement sont en cours d'activation dans votre espace client."}`;
}

function setBusy(busy) {
  state.busy = busy;
  sendBtn.disabled = busy;
  input.disabled = busy;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();

    state.quota = config.quota ?? state.quota;
    state.used = config.used ?? 0;
    state.plans = Array.isArray(config.plans) ? config.plans : [];

    renderUpgradeBar();
    renderQuota();

    if (!config.configured) {
      addMessage(
        "system",
        "Le moteur d'analyse n'est pas encore activé. Ajoutez la clé ANTHROPIC_API_KEY pour lancer les analyses.",
      );
    }
  } catch {
    renderQuota();
  }
}

async function sendMessage(text) {
  addUserMessage(text);
  setBusy(true);

  const pending = addMessage("bot", '<span class="typing"><span></span><span></span><span></span></span>');

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (response.status === 402) {
      const data = await response.json();
      state.used = data.used ?? state.quota;
      renderQuota();
      pending.className = "msg system";
      pending.innerHTML = quotaReachedMarkup();
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      pending.className = "msg error";
      pending.innerHTML =
        data.error === "unconfigured"
          ? "Le moteur d'analyse n'est pas encore connecté. Ajoutez la clé ANTHROPIC_API_KEY, puis relancez la requête."
          : "Analyse indisponible pour le moment. Reformulez ou réessayez dans quelques instants.";
      return;
    }

    const data = await response.json();
    state.used = data.used ?? state.used + 1;
    pending.className = "msg bot";
    pending.innerHTML = formatReply(data.reply);
    renderQuota();
  } catch {
    pending.className = "msg error";
    pending.innerHTML = "Connexion interrompue. Vérifiez votre réseau et relancez la requête.";
  } finally {
    setBusy(false);
    scrollDown();
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || state.busy) return;
  input.value = "";
  sendMessage(text);
});

addMessage(
  "bot",
  "<strong>Apex Advisor :</strong> Système prêt. Décrivez votre problème financier, commercial ou stratégique pour recevoir un plan d'action immédiat.",
);

loadConfig();
