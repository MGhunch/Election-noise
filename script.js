const CONVERSATIONS = [
  "Cost of Living",
  "Health",
  "Housing",
  "Economy",
  "Education",
  "Crime & Justice",
  "Environment",
  "Future & Infrastructure",
  "Government & Democracy"
];

const PARTY_ORDER = [
  "Labour",
  "National",
  "Green",
  "ACT",
  "NZ First",
  "Te Pāti Māori",
  "TOP"
];

const PARTY_COLOURS = {
  "Labour": "#d82c2f",
  "National": "#0057b8",
  "Green": "#159447",
  "ACT": "#f1c40f",
  "NZ First": "#54565A",
  "Te Pāti Māori": "#7A4033",
  "TOP": "#1b8f9c"
};

const SIZE_MAP = {
  "Niche": 24,
  "Significant": 36,
  "Flagship": 52
};

let policies = [];
let activeParties = new Set();
let openConversation = null;

const grid = document.querySelector("#conversation-grid");
const filters = document.querySelector("#party-filters");
const detailPanel = document.querySelector("#detail-panel");
const floatingTooltip = document.querySelector("#floating-tooltip");

async function init() {
  try {
    const response = await fetch("./data/policies.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load policies.json");
    const payload = await response.json();

    policies = Array.isArray(payload) ? payload : payload.policies;
    const updated = Array.isArray(payload) ? null : payload.updated;

    document.querySelector("#policy-count").textContent =
      `${policies.length} ${policies.length === 1 ? "policy" : "policies"}`;

    document.querySelector("#updated-date").textContent =
      updated ? `Updated ${formatDate(updated)}` : "Live policy map";

    renderFilters();
    renderGrid();
    bindStaticControls();
  } catch (error) {
    grid.innerHTML = `
      <div class="conversation-card" style="grid-column: 1 / -1;">
        <h2>We could not load the policy data.</h2>
        <p class="empty-state">${escapeHtml(error.message)}</p>
      </div>
    `;
    console.error(error);
  }
}

function renderFilters() {
  const partiesPresent = PARTY_ORDER.filter(party =>
    policies.some(policy => policy.party === party)
  );

  const options = ["All", ...partiesPresent];

  filters.innerHTML = options.map(party => {
    const colour = party === "All" ? "#777777" : PARTY_COLOURS[party];
    const pressed = party === "All" ? activeParties.size === 0 : activeParties.has(party);
    return `
      <button
        class="filter-button"
        type="button"
        data-party="${escapeHtml(party)}"
        aria-pressed="${pressed}"
        style="--party-colour:${colour}"
      >
        <span class="party-dot" aria-hidden="true"></span>
        ${escapeHtml(party)}
      </button>
    `;
  }).join("");

  filters.querySelectorAll(".filter-button").forEach(button => {
    button.addEventListener("click", () => {
      const party = button.dataset.party;
      if (party === "All") {
        activeParties.clear();
      } else if (activeParties.has(party)) {
        activeParties.delete(party);
      } else {
        activeParties.add(party);
      }
      renderFilters();
      updateCircleFocus();

      if (openConversation) {
        renderDetail(openConversation);
      }
    });
  });
}

function renderGrid() {
  grid.innerHTML = CONVERSATIONS.map(conversation => {
    const conversationPolicies = policies.filter(
      policy => policy.conversation === conversation
    );

    const partyCount = new Set(conversationPolicies.map(p => p.party)).size;
    const circles = conversationPolicies.length
      ? conversationPolicies
          .sort((a, b) => sizeWeight(b.size) - sizeWeight(a.size))
          .map(renderCircle)
          .join("")
      : `<p class="empty-state">No policies yet.</p>`;

    return `
      <article class="conversation-card" data-conversation="${escapeHtml(conversation)}">
        <button class="conversation-button" type="button" data-open-conversation="${escapeHtml(conversation)}">
          <h2>${escapeHtml(conversation)}</h2>
          <p class="conversation-stats">${noiseLevel(conversationPolicies)}</p>
        </button>
        <div class="policy-field">
          ${circles}
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-open-conversation]").forEach(button => {
    button.addEventListener("click", () => {
      openConversation = button.dataset.openConversation;
      renderDetail(openConversation);
      detailPanel.hidden = false;
      detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  grid.querySelectorAll(".policy-circle").forEach((circle, index) => {
    circle.style.setProperty("--enter-delay", `${Math.min(index * 24, 420)}ms`);

    circle.addEventListener("pointerenter", showTooltip);
    circle.addEventListener("pointermove", moveTooltip);
    circle.addEventListener("pointerleave", hideTooltip);
    circle.addEventListener("focus", showTooltip);
    circle.addEventListener("blur", hideTooltip);

    circle.addEventListener("click", event => {
      event.stopPropagation();
      hideTooltip();
      const policy = policies.find(item => String(item.id) === circle.dataset.policyId);
      openPolicy(policy);
    });
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      grid.classList.add("is-ready");
    });
  });

  updateCircleFocus();
}

function renderCircle(policy) {
  const colour = PARTY_COLOURS[policy.party] || "#777777";
  const size = SIZE_MAP[policy.size] || SIZE_MAP.Niche;
  const classes = [
    "policy-circle",
    policy.verified === false ? "is-unverified" : ""
  ].filter(Boolean).join(" ");

  return `
    <button
      class="${classes}"
      type="button"
      aria-label="${escapeHtml(`${policy.party}: ${policy.title}. ${policy.size} policy.`)}"
      data-policy-id="${escapeHtml(String(policy.id))}"
      data-party="${escapeHtml(policy.party)}"
      data-tooltip="${escapeHtml(policy.title)}"
      style="--party-colour:${colour}; --circle-size:${size}px"
    ></button>
  `;
}

function showTooltip(event) {
  const circle = event.currentTarget;
  floatingTooltip.textContent = circle.dataset.tooltip;
  floatingTooltip.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event) {
  if (floatingTooltip.hidden) return;

  const anchor = event.currentTarget.getBoundingClientRect();
  const pointerX = Number.isFinite(event.clientX) && event.clientX > 0
    ? event.clientX
    : anchor.left + anchor.width / 2;
  const pointerY = Number.isFinite(event.clientY) && event.clientY > 0
    ? event.clientY
    : anchor.top;

  const gap = 14;
  const padding = 10;
  const tooltipWidth = floatingTooltip.offsetWidth;
  const tooltipHeight = floatingTooltip.offsetHeight;

  let left = pointerX - tooltipWidth / 2;
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

  let top = pointerY - tooltipHeight - gap;
  if (top < padding) top = pointerY + gap;

  floatingTooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function hideTooltip() {
  floatingTooltip.hidden = true;
}

function updateCircleFocus() {
  document.querySelectorAll(".policy-circle").forEach(circle => {
    const isActive = activeParties.size === 0 || activeParties.has(circle.dataset.party);
    circle.classList.toggle("is-muted", !isActive);
    circle.classList.toggle("is-selected", activeParties.size > 0 && isActive);
  });
}

function renderDetail(conversation) {
  const allConversationPolicies = policies
    .filter(policy => policy.conversation === conversation)
    .sort((a, b) => sizeWeight(b.size) - sizeWeight(a.size));

  const visiblePolicies = activeParties.size === 0
    ? allConversationPolicies
    : allConversationPolicies.filter(policy => activeParties.has(policy.party));

  const partyContext = activeParties.size === 0 ? "" : ` Showing ${[...activeParties].join(", ")}.`;

  document.querySelector("#detail-title").textContent = conversation;
  document.querySelector("#detail-summary").textContent =
    `${noiseLevel(allConversationPolicies)}${partyContext}`;

  const list = document.querySelector("#detail-policies");

  if (!visiblePolicies.length) {
    list.innerHTML = `
      <div class="policy-row">
        <div></div>
        <div>
          <strong>No ${escapeHtml([...activeParties].join(", "))} policies here yet.</strong>
          <small>This empty space is part of the story.</small>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = visiblePolicies.map(policy => `
    <button class="policy-row" type="button" data-detail-policy="${escapeHtml(String(policy.id))}">
      <span class="policy-row-dot${policy.verified === false ? " is-unverified" : ""}" data-party="${escapeHtml(policy.party)}" style="--party-colour:${PARTY_COLOURS[policy.party] || "#777"}; --dot-size:${Math.round(SIZE_MAP[policy.size] * 0.6)}px"></span>
      <span>
        <strong>${escapeHtml(policy.title)}</strong>
        <small>${escapeHtml(policy.party)}${policy.secondary ? ` · also ${escapeHtml(policy.secondary)}` : ""}</small>
      </span>
      <span class="impact-badge">${escapeHtml(policy.size)}</span>
    </button>
  `).join("");

  list.querySelectorAll("[data-detail-policy]").forEach(button => {
    button.addEventListener("click", () => {
      const policy = policies.find(item => String(item.id) === button.dataset.detailPolicy);
      openPolicy(policy);
    });
  });
}

function openPolicy(policy) {
  if (!policy) return;

  document.querySelector("#dialog-party").textContent = policy.party;
  document.querySelector("#dialog-title").textContent = policy.title;
  document.querySelector("#dialog-conversation").textContent =
    policy.secondary
      ? `${policy.conversation} · also ${policy.secondary}`
      : policy.conversation;
  document.querySelector("#dialog-size").textContent = policy.size;
  document.querySelector("#dialog-status").textContent =
    policy.verified === false ? "From the party website" : "Reported by RNZ";

  const sourceLink = document.querySelector("#dialog-source");

  if (policy.source) {
    sourceLink.href = policy.source;
    sourceLink.hidden = false;
  } else {
    sourceLink.hidden = true;
  }

  document.querySelector("#policy-dialog").showModal();
}

function bindStaticControls() {
  document.querySelector("#close-detail").addEventListener("click", () => {
    detailPanel.hidden = true;
    openConversation = null;
  });

  document.querySelector("#close-policy").addEventListener("click", () => {
    document.querySelector("#policy-dialog").close();
  });

  document.querySelector("#about-button").addEventListener("click", () => {
    document.querySelector("#about-dialog").showModal();
  });

  document.querySelector("#close-about").addEventListener("click", () => {
    document.querySelector("#about-dialog").close();
  });

  [document.querySelector("#policy-dialog"), document.querySelector("#about-dialog")]
    .forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
    });
}

function noiseLevel(conversationPolicies) {
  const score = conversationPolicies.reduce(
    (sum, p) => sum + sizeWeight(p.size) * (p.verified === false ? 0.5 : 1), 0);
  if (score === 0) return "Nothing to see.";
  if (score <= 3) return "Not much noise.";
  if (score <= 8) return "A bit of noise.";
  return "Lots of noise.";
}

function sizeWeight(size) {
  return size === "Flagship" ? 3 : size === "Significant" ? 2 : 1;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
