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
let currentView = "size";

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
    bindViewToggle();
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

  const partyContext = activeParties.size === 0 ? "" : `Showing ${[...activeParties].join(", ")}.`;

  document.querySelector("#detail-title").textContent = conversation;
  document.querySelector("#detail-summary").textContent =
    [noiseLevel(allConversationPolicies), partyContext].filter(Boolean).join(". ");

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

function bindViewToggle() {
  document.querySelectorAll(".view-tab").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
}

function switchView(view) {
  if (view === currentView) return;

  const outgoing = document.querySelector(`[data-view-pane="${currentView}"]`);
  const incoming = document.querySelector(`[data-view-pane="${view}"]`);

  currentView = view;

  document.querySelectorAll(".view-tab").forEach(tab => {
    tab.setAttribute("aria-pressed", String(tab.dataset.view === view));
  });

  outgoing.classList.add("is-transitioning");

  window.setTimeout(() => {
    outgoing.hidden = true;
    outgoing.classList.remove("is-transitioning");

    incoming.hidden = false;
    incoming.classList.add("is-transitioning");

    if (view === "shape") renderShape();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incoming.classList.remove("is-transitioning");
      });
    });
  }, 220);
}

function renderShape() {
  const field = document.querySelector("#shape-field");
  const rect = field.getBoundingClientRect();
  const width = rect.width || 1000;
  const height = rect.height || 540;
  const margin = 70;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodes = policies.map(policy => {
    const radius = (SIZE_MAP[policy.size] || SIZE_MAP.Niche) / 2 * 0.7;
    const jitter = hashJitter(policy.id);
    const targetX = margin + ((policy.immediacy - 1) / 4) * (width - margin * 2) + jitter.x;
    const targetY = margin + ((5 - policy.mechanism) / 4) * (height - margin * 2) + jitter.y;
    return { policy, radius, targetX, targetY, x: targetX, y: targetY };
  });

  // Stage-pull + collide relaxation: nodes are pulled toward their true
  // Immediacy/Mechanism position each step, pushed apart only when they
  // overlap more than the "squash" allowance, and given a gentle overall
  // pull toward the shared centre so the five stage-columns read as one
  // connected mass rather than five separate little clusters.
  for (let iteration = 0; iteration < 260; iteration++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDistance = a.radius + b.radius;

        if (distance < minDistance) {
          const overlap = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
      }
    }

    nodes.forEach(node => {
      node.x += (node.targetX - node.x) * 0.018;
      node.y += (node.targetY - node.y) * 0.03;
      node.x += (centerX - node.x) * 0.01;
      node.y += (centerY - node.y) * 0.01;
      node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
      node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
    });
  }

  field.classList.remove("is-ready");

  const calloutX = width / 2 + (width / 2 - margin) / 2;
  const calloutY = height / 2 + (height / 2 - margin) / 2;

  const calloutHtml = `
    <span
      class="shape-callout"
      tabindex="0"
      role="note"
      data-tooltip="Nothing much here, because cost of living policies are a short term thing."
      style="left:${calloutX}px; top:${calloutY}px"
    ></span>
  `;

  field.innerHTML = calloutHtml + nodes.map((node, index) => {
    const policy = node.policy;
    const colour = PARTY_COLOURS[policy.party] || "#777777";
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
        style="--party-colour:${colour}; --circle-size:${node.radius * 2}px; --enter-delay:${Math.min(index * 12, 380)}ms; left:${centerX}px; top:${centerY}px"
      ></button>
    `;
  }).join("");

  field.querySelectorAll(".policy-circle").forEach(circle => {
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

  updateCircleFocus();

  const callout = field.querySelector(".shape-callout");
  callout.addEventListener("pointerenter", showTooltip);
  callout.addEventListener("pointermove", moveTooltip);
  callout.addEventListener("pointerleave", hideTooltip);
  callout.addEventListener("focus", showTooltip);
  callout.addEventListener("blur", hideTooltip);

  // Spawn every circle at the field's centre, then on the next frame move
  // them all out to their true position together — one blob assembling
  // itself, not 44 dots appearing where they land.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      field.classList.add("is-ready");
      const circles = field.querySelectorAll(".policy-circle");
      nodes.forEach((node, index) => {
        circles[index].style.left = `${node.x}px`;
        circles[index].style.top = `${node.y}px`;
      });
    });
  });
}

function hashJitter(id) {
  const hashX = hashString(`${id}-x`);
  const hashY = hashString(`${id}-y`);
  const spreadX = 78;
  const spreadY = 42;
  return {
    x: (((hashX % 2000) / 2000) - 0.5) * 2 * spreadX,
    y: (((hashY % 2000) / 2000) - 0.5) * 2 * spreadY
  };
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function noiseLevel(conversationPolicies) {
  const score = conversationPolicies.reduce(
    (sum, p) => sum + sizeWeight(p.size) * (p.verified === false ? 0.5 : 1), 0);
  if (score === 0) return "Nothing to see";
  if (score <= 3) return "Not much noise";
  if (score <= 7) return "A bit of noise";
  if (score <= 12) return "Lots of noise";
  return "Really quite noisy";
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
