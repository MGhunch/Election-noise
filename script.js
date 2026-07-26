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

// Ordered by seats in the current Parliament. TOP has none, so it sits last.
const PARTY_ORDER = [
  "National",
  "Labour",
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

// SIZE_MAP is the fixed scale. The Shape view and the detail-panel dots read
// it directly and must keep doing so — the blob's collide relaxation is tuned
// against these numbers and shouldn't move because the grid changed.
const SIZE_MAP = {
  "Niche": 24,
  "Significant": 36,
  "Flagship": 52
};

// The grid uses relative ratios instead, scaled at render time so that the
// fullest conversation just fills its square. That's what makes "how full the
// tile is" mean something: the loudest tile is always near the top of its
// range, and every other tile reads as less than it.
const GRID_SIZE_RATIO = {
  "Niche": 0.42,
  "Significant": 0.62,
  "Flagship": 1
};

// A record is drawn only if it is a live commitment AND carries a real size.
// Two independent gates on purpose: status is the editorial decision, the size
// check is a backstop so a malformed record can never put a phantom circle on
// the page the way a null size used to fall through to Niche.
function isRenderable(policy) {
  return (policy.status || "live") === "live" && Boolean(SIZE_MAP[policy.size]);
}

let policies = [];
let parkedPolicies = [];
let politicsNodes = [];
let activeParties = new Set();
let openConversation = null;
let currentView = "size";

const grid = document.querySelector("#conversation-grid");
const filters = document.querySelector("#party-filters");
const dialog = document.querySelector("#policy-dialog");
const floatingTooltip = document.querySelector("#floating-tooltip");

async function init() {
  try {
    const response = await fetch("./data/policies.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load policies.json");
    const payload = await response.json();

    const allPolicies = Array.isArray(payload) ? payload : payload.policies;
    const updated = Array.isArray(payload) ? null : payload.updated;

    // Parked records stay in the file so they can come back when a party
    // publishes detail, but they are never drawn and never counted.
    policies = allPolicies.filter(isRenderable);
    parkedPolicies = allPolicies.filter(policy => !isRenderable(policy));

    document.querySelector("#policy-count").textContent =
      `${policies.length} ${policies.length === 1 ? "policy" : "policies"}`;

    document.querySelector("#updated-date").textContent =
      updated ? `Updated ${formatDate(updated)}` : "Live policy map";

    renderFilters();
    renderGrid();
    bindStaticControls();
    bindViewToggle();
    bindResize();
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

      if (currentView === "politics") renderPartyCentroid();

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
        <button
          class="card-overlay"
          type="button"
          data-open-conversation="${escapeHtml(conversation)}"
          aria-label="${escapeHtml(`Open ${conversation}`)}"
        ></button>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-open-conversation]").forEach(button => {
    button.addEventListener("click", () => {
      openConversation = button.dataset.openConversation;
      renderDetail(openConversation);
      showDialogState("list");
      openDialog();
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

  sizeHero();
  calibrateGrid();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      grid.classList.add("is-ready");
    });
  });

  updateCircleFocus();
}

const RAIL_WIDTH = 168;
const RAIL_GAP = 40;
const HERO_MAX = 1180 - RAIL_WIDTH - RAIL_GAP;
const HERO_FLOOR = 500;
const HERO_TAIL = 28;

// The hero square is the page. Both views are contents of it, so switching
// between them changes what's inside and never the footprint. Size is the
// smaller of what the width allows and what the viewport height allows —
// which means a tall screen is never constrained, and a letterbox one shrinks
// the square rather than pushing it off the bottom. Below the floor we stop
// shrinking and let the page scroll: a small laptop scrolling a little beats
// everyone looking at postage stamps.
function sizeHero() {
  const stage = document.querySelector(".stage");
  if (!stage) return;

  const isNarrow = window.matchMedia("(max-width: 720px)").matches;
  const pageWidth = Math.min(1180, window.innerWidth - 32);
  const availableWidth = isNarrow ? pageWidth : pageWidth - RAIL_WIDTH - RAIL_GAP;

  const documentTop = stage.getBoundingClientRect().top + window.scrollY;
  const availableHeight = window.innerHeight - documentTop - HERO_TAIL;

  const hero = isNarrow
    ? availableWidth
    : Math.min(availableWidth, HERO_MAX, Math.max(HERO_FLOOR, availableHeight));

  const rounded = Math.max(160, Math.round(hero));
  document.documentElement.style.setProperty("--hero", `${rounded}px`);
  document.documentElement.style.setProperty(
    "--content",
    isNarrow ? "1180px" : `${rounded + RAIL_WIDTH + RAIL_GAP}px`
  );
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
      data-size="${escapeHtml(policy.size)}"
      data-tooltip="${escapeHtml(policy.title)}"
      style="--party-colour:${colour}; --circle-size:${size}px"
    ></button>
  `;
}

// Lay circles out the way flex-wrap will, and report how tall that comes to.
// Used to test a candidate scale without touching the DOM.
function packedHeight(sizes, base, width, gap) {
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const size of sizes) {
    const diameter = base * (GRID_SIZE_RATIO[size] || GRID_SIZE_RATIO.Niche);
    if (x > 0 && x + diameter > width) {
      y += rowHeight + gap;
      x = 0;
      rowHeight = 0;
    }
    x += diameter + gap;
    if (diameter > rowHeight) rowHeight = diameter;
  }

  return y + rowHeight;
}

// Find the largest scale at which every conversation still fits its square,
// then apply it. The fullest conversation is the binding constraint, so it
// ends up near-full and the quiet ones read as visibly emptier.
function calibrateGrid() {
  const cards = [...grid.querySelectorAll(".conversation-card")];
  if (!cards.length) return;

  const measured = cards.map(card => {
    const field = card.querySelector(".policy-field");
    const conversation = card.dataset.conversation;
    return {
      width: field.clientWidth,
      height: field.clientHeight,
      sizes: policies
        .filter(policy => policy.conversation === conversation)
        .sort((a, b) => sizeWeight(b.size) - sizeWeight(a.size))
        .map(policy => policy.size)
    };
  }).filter(item => item.width > 0 && item.height > 0 && item.sizes.length);

  if (!measured.length) return;

  let low = 6;
  let high = Math.max(...measured.map(item => Math.min(item.width, item.height)));

  for (let step = 0; step < 26; step++) {
    const candidate = (low + high) / 2;
    const gap = Math.max(3, candidate * 0.15);
    const fits = measured.every(
      item => packedHeight(item.sizes, candidate, item.width, gap) <= item.height
    );
    if (fits) low = candidate; else high = candidate;
  }

  const gap = Math.max(3, low * 0.15);
  grid.style.setProperty("--circle-gap", `${Math.round(gap)}px`);
  grid.style.setProperty("--circle-ring", `${Math.max(2, Math.round(low * 0.055))}px`);

  grid.querySelectorAll(".policy-circle").forEach(circle => {
    const ratio = GRID_SIZE_RATIO[circle.dataset.size] || GRID_SIZE_RATIO.Niche;
    circle.style.setProperty("--circle-size", `${Math.round(low * ratio)}px`);
  });
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

  // The noise line describes what you can currently see, not what's in the
  // file. Filter to one party and the quiet conversations say so — that
  // emptiness is the point of the view, so it shouldn't be contradicted by a
  // label still reporting the unfiltered total.
  grid.querySelectorAll(".conversation-card").forEach(card => {
    const visible = policies.filter(policy =>
      policy.conversation === card.dataset.conversation &&
      (activeParties.size === 0 || activeParties.has(policy.party))
    );

    const stats = card.querySelector(".conversation-stats");
    if (stats) stats.textContent = noiseLevel(visible);

    const isQuiet = visible.length === 0;
    card.classList.toggle("is-quiet", isQuiet);
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

  document.querySelector("#list-title").textContent = conversation;
  document.querySelector("#list-summary").textContent =
    [noiseLevel(visiblePolicies), partyContext].filter(Boolean).join(". ");

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
      openPolicy(policy, { fromList: true });
    });
  });
}

function openDialog() {
  if (!dialog.open) dialog.showModal();
}

// The dialog holds two states and swaps between them in place. Stacking a
// second dialog on top would mean two Escapes to get out, and on a phone a
// sheet over a sheet.
function showDialogState(state) {
  document.querySelector("#dialog-list").hidden = state !== "list";
  document.querySelector("#dialog-detail").hidden = state !== "detail";
  if (state !== "detail") document.querySelector("#flag-policy").hidden = true;
  dialog.dataset.state = state;
}

// The modal speaks the legend's language, not the data's. Impact uses the
// same words as the rail; Source names the outlet the link actually goes to,
// derived from the domain so the label can never drift from the destination.
const IMPACT_LABELS = { Flagship: "Broad impact", Significant: "Key policy", Niche: "Specific policy" };
const OUTLETS = {
  "rnz.co.nz": "RNZ",
  "nzherald.co.nz": "NZ Herald",
  "thepost.co.nz": "The Post",
  "odt.co.nz": "Otago Daily Times",
  "teaonews.co.nz": "Te Ao Māori News",
  "1news.co.nz": "1News",
  "stuff.co.nz": "Stuff",
  "newsroom.co.nz": "Newsroom",
  "chrislynchmedia.com": "Chris Lynch Media",
  "scoop.co.nz": "Scoop"
};

function sourceDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function sourceInfo(policy) {
  if (policy.verified) {
    const domain = sourceDomain(policy.source || "");
    return { label: `${OUTLETS[domain] || domain || "News"} reporting`, cta: "Read the story" };
  }
  return { label: "Party website", cta: "Read the policy" };
}

let currentDialogPolicy = null;

function openPolicy(policy, { fromList = false } = {}) {
  if (!policy) return;

  const back = document.querySelector("#dialog-back");
  back.hidden = !fromList;
  back.textContent = fromList ? `Back to ${policy.conversation}` : "";

  document.querySelector("#dialog-description").textContent = policy.description || "";
  document.querySelector("#dialog-party").textContent = policy.party;
  document.querySelector("#dialog-title").textContent = policy.title;
  document.querySelector("#dialog-conversation").textContent =
    policy.secondary
      ? `${policy.conversation} · also ${policy.secondary}`
      : policy.conversation;
  document.querySelector("#dialog-size").textContent = IMPACT_LABELS[policy.size] || policy.size;

  const info = sourceInfo(policy);
  document.querySelector("#dialog-source-type").textContent = info.label;

  const sourceLink = document.querySelector("#dialog-source");
  if (policy.source) {
    sourceLink.href = policy.source;
    sourceLink.textContent = info.cta;
    sourceLink.hidden = false;
  } else {
    sourceLink.hidden = true;
  }

  // Verified records carry both facts: the story that proves it, and the
  // party page that states it. Show the second, quieter, when it exists.
  const partyLink = document.querySelector("#dialog-party-link");
  if (policy.verified && policy.party_link) {
    partyLink.href = policy.party_link;
    partyLink.hidden = false;
  } else {
    partyLink.hidden = true;
  }

  currentDialogPolicy = policy;
  document.querySelector("#flag-policy").hidden = false;

  showDialogState("detail");
  openDialog();
}

// The prompt is fetched from the deployed copy rather than from GitHub, so
// what the modal shows is always the version that produced the data on screen
// — no external dependency, and no drift between the repo and the site.
const PROMPT_PATHS = [
  "./data/source.md",
  "./data/sort.md",
  "./data/summarise.md"
];
let promptMarkup = null;

function renderMarkdown(source) {
  const inline = text => escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  // Headings carry a slug id so the contents list has somewhere to land.
  const slug = text => text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const out = [];
  let inFence = false;
  let fence = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map(item => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  source.split("\n").forEach(line => {
    if (line.trim().startsWith("```")) {
      if (inFence) {
        out.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = [];
      } else {
        flushList();
      }
      inFence = !inFence;
      return;
    }
    if (inFence) { fence.push(line); return; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level} id="${slug(heading[2])}" tabindex="-1">${inline(heading[2])}</h${level}>`);
      return;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    if (/^---+$/.test(line.trim())) { flushList(); out.push("<hr>"); return; }
    if (!line.trim()) { flushList(); return; }

    flushList();
    out.push(`<p>${inline(line)}</p>`);
  });

  flushList();
  if (inFence && fence.length) out.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  return out.join("");
}

async function openPrompts() {
  const body = document.querySelector("#prompts-body");
  document.querySelector("#prompts-dialog").showModal();

  if (promptMarkup !== null) { body.innerHTML = promptMarkup; return; }

  try {
    const sources = await Promise.all(PROMPT_PATHS.map(async path => {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return response.text();
    }));

    promptMarkup = sources.map(text => `<article class="prompt-doc">${renderMarkdown(text)}` +
      `<p class="back-to-top"><a href="#prompts-top">Back to top</a></p></article>`).join("");
    body.innerHTML = promptMarkup;
  } catch (error) {
    body.innerHTML = `<p>The prompts could not be loaded. They live in the repo at <code>${escapeHtml(PROMPT_PATHS.join(", "))}</code>.</p>`;
    console.error(error);
  }
}

function bindStaticControls() {
  document.querySelector("#close-policy").addEventListener("click", () => {
    dialog.close();
  });

  // The flag spins the modal into a report form — next build. The click
  // lands here so the wiring exists; openReportForm gets its body when the
  // form and the /report endpoint do.
  document.querySelector("#flag-policy").addEventListener("click", () => {
    openReportForm(currentDialogPolicy);
  });

  document.querySelector("#dialog-back").addEventListener("click", () => {
    if (!openConversation) return;
    renderDetail(openConversation);
    showDialogState("list");
  });

  dialog.addEventListener("close", () => {
    openConversation = null;
  });

  document.querySelector("#prompts-button").addEventListener("click", openPrompts);

  const promptsDialog = document.querySelector("#prompts-dialog");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  promptsDialog.addEventListener("click", event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });

  document.querySelector("#close-prompts").addEventListener("click", () => {
    document.querySelector("#prompts-dialog").close();
  });

  [dialog, document.querySelector("#prompts-dialog")]
    .forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
    });
}

function bindResize() {
  let pending;
  const relayout = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      sizeHero();
      calibrateGrid();
      if (currentView === "shape") renderShape();
      if (currentView === "politics") renderPolitics();
    }, 140);
  };
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", relayout);
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

    sizeHero();
    if (view === "shape") renderShape();
    else if (view === "politics") renderPolitics();
    else calibrateGrid();

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

function renderPolitics() {
  const field = document.querySelector("#politics-field");
  const rect = field.getBoundingClientRect();
  const width = rect.width || 1000;
  const height = rect.height || 540;
  // Shape's fixed 70px margin and ±78/42 jitter were sized for a wide field.
  // The hero is square, and on a phone it drops to under 300px — at which
  // point a fixed margin eats half the plot and fixed jitter shuffles the
  // rungs out of order. Scaling both to the field keeps the same proportions
  // it has on the desktop hero, where these resolve to 68 and 76/41.
  const margin = Math.max(26, Math.round(Math.min(width, height) * 0.13));
  const spreadX = Math.round(width * 0.145);
  const spreadY = Math.round(height * 0.16);
  const centerX = width / 2;
  const centerY = height / 2;

  // Econ runs left (govt steps in, -3) to right (govt steps back, +3).
  // Direction runs bottom (tried and tested, -3) to top (trying new things, +3).
  const nodes = policies.map(policy => {
    const radius = (SIZE_MAP[policy.size] || SIZE_MAP.Niche) / 2 * 0.7;
    const jitter = hashJitter(policy.id, spreadX, spreadY);
    const targetX = margin + ((policy.econ + 3) / 6) * (width - margin * 2) + jitter.x;
    const targetY = margin + ((3 - policy.direction) / 6) * (height - margin * 2) + jitter.y;
    return { policy, radius, targetX, targetY, x: targetX, y: targetY };
  });

  politicsNodes = nodes;

  // Same relaxation as renderShape, with one constant deliberately different.
  // Shape pulls harder vertically (0.03) than horizontally, because Mechanism
  // is its crowded axis and needs holding. Here it is the other way round:
  // direction sits in three heavy clusters — 27 records at 0, 27 at +2, 16 at
  // -2 — and a strong vertical pull cancels the collision displacement that
  // would let them mix, so circles slide along their row instead of escaping
  // it and the view bands into three rafts. At 0.012 they merge into one mass.
  // The trade is the one already accepted for Shape: these are judgement
  // calls, not measurements, so a position reads as a neighbourhood.
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
      node.y += (node.targetY - node.y) * 0.012;
      node.x += (centerX - node.x) * 0.01;
      node.y += (centerY - node.y) * 0.01;
      node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
      node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
    });
  }

  field.classList.remove("is-ready");

  field.innerHTML = nodes.map((node, index) => {
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

  renderPartyCentroid();
}

// The party's average, weighted the way the noise score already weights a
// conversation: Flagship 3, Significant 2, Niche 1, so a flagship pulls harder
// than a one-off niche policy. One ring per selected party.
//
// The ring sits at the weighted middle of that party's circles as drawn, not
// at its true score. The two are not the same: the relaxation pulls every
// circle toward the centre of the field, compressing the picture inward by
// around 130px for Labour and over 200px for ACT. A ring at the true score
// would sit outside its own cloud, and worst for the parties furthest from
// centre. The words still come from the real scores.
function renderPartyCentroid() {
  const field = document.querySelector("#politics-field");
  if (!field) return;

  field.querySelectorAll(".party-centroid, .party-centroid-label")
    .forEach(node => node.remove());

  if (!activeParties.size || !politicsNodes.length) return;

  const placed = [];

  PARTY_ORDER.filter(party => activeParties.has(party)).forEach(party => {
    const partyNodes = politicsNodes.filter(node => node.policy.party === party);
    if (!partyNodes.length) return;

    const weight = partyNodes.reduce((sum, n) => sum + sizeWeight(n.policy.size), 0);
    const cx = partyNodes.reduce((sum, n) => sum + n.x * sizeWeight(n.policy.size), 0) / weight;
    const cy = partyNodes.reduce((sum, n) => sum + n.y * sizeWeight(n.policy.size), 0) / weight;

    // Econ averages only the records the axis applies to. Including off-axis
    // zeros would drag parties with a lot of crime and constitutional policy
    // toward the middle and leave parties without any exactly where they are.
    const onAxis = partyNodes.filter(n => n.policy.econ_engaged);
    if (!onAxis.length) return;
    const onWeight = onAxis.reduce((sum, n) => sum + sizeWeight(n.policy.size), 0);
    const econAvg = onAxis.reduce((sum, n) => sum + n.policy.econ * sizeWeight(n.policy.size), 0) / onWeight;

    const colour = PARTY_COLOURS[party] || "#777777";

    const dot = document.createElement("div");
    dot.className = "party-centroid";
    dot.dataset.party = party;
    dot.style.setProperty("--marker-colour", colour);
    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    field.appendChild(dot);

    // Rings can sit almost on top of each other — Te Pāti Māori and TOP land
    // within a couple of pixels — so labels step down rather than overlap.
    let labelY = cy;
    while (placed.some(prev => Math.abs(prev.y - labelY) < 26 && Math.abs(prev.x - cx) < 130)) {
      labelY += 26;
    }
    placed.push({ x: cx, y: labelY });

    const label = document.createElement("div");
    label.className = "party-centroid-label";
    label.style.left = `${cx}px`;
    label.style.top = `${labelY}px`;
    label.textContent = econSummary(econAvg);
    field.appendChild(label);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dot.classList.add("is-ready");
        label.classList.add("is-ready");
      });
    });
  });
}

// Three terms only. The ring's position carries how far and which way; the
// words only need to carry roughly where.
function econSummary(value) {
  if (value < -1) return "Mostly left";
  if (value > 1) return "Mostly right";
  return "Mostly centre";
}

function hashJitter(id, spreadX = 78, spreadY = 42) {
  const hashX = hashString(`${id}-x`);
  const hashY = hashString(`${id}-y`);
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

// Placeholder until the report form exists. Keeps the flag safe to ship:
// clicking it does nothing visible yet.
function openReportForm(policy) {
  if (!policy) return;
}
