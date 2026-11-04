// NEhelp front end. The server decides what each role may see; this file just draws it.

const STATUS_LABELS = {
  unknown: "Not sure / skip",
  none: "Don't have this",
  happy: "Using it, happy",
  unhappy: "Using it, not happy",
  past: "Used it before",
};

const RATING_LABELS = { 1: "😞 1", 2: "🙁 2", 3: "😐 3", 4: "🙂 4", 5: "😀 5" };

const VERDICT_LABELS = {
  sort_now: "Sort this now",
  worth_considering: "Worth considering",
  not_needed: "You can skip this",
  already_sorted: "Already sorted",
};

// Pin states for the provider view, best lead first.
const PIN_STATES = [
  { state: "open", label: "Wants help", color: "--pin-open" },
  { state: "customer_unhappy", label: "Your customer, not happy", color: "--pin-unhappy" },
  { state: "customer_happy", label: "Your customer, happy", color: "--pin-happy" },
  { state: "public_gap", label: "Not signed up, gap in public info", color: "--pin-gap" },
  { state: "served", label: "Sorted elsewhere", color: "--pin-quiet" },
  { state: "private", label: "Not shared", color: "--pin-quiet" },
  { state: "no_info", label: "No info", color: "--pin-quiet" },
];

let meta;
let map;
let pins;
let currentBusiness;

// ---------- Small helpers ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child != null) node.append(child);
  }
  return node;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Something went wrong (${response.status}).`);
  return body;
}

function publicTags(b) {
  const pub = b.public;
  const tags = [];
  if (b.real) tags.push("Real business · name changed");
  tags.push(pub.has_website ? "Has a website" : b.real ? "No website on OpenStreetMap" : "No website listed");
  if (pub.has_social === true) tags.push("On social media");
  if (pub.has_social === false) tags.push("No social media found");
  if (pub.hygiene_rating != null) {
    const year = pub.hygiene_date ? ` (${pub.hygiene_date.slice(0, 4)})` : "";
    tags.push(`Food hygiene: ${pub.hygiene_rating}/5${year}`);
  }
  return el("div", { class: "tags" }, tags.map((t) => el("span", { class: "tag" }, t)));
}

function addPin(b, color, radius, popup) {
  const marker = L.circleMarker([b.lat, b.lng], {
    radius,
    color: cssVar("--surface"),
    weight: 2,
    fillColor: cssVar(color),
    fillOpacity: 0.95,
  });
  marker.bindPopup(popup);
  marker.addTo(pins);
  return marker;
}

// ---------- Small business owner view ----------

async function showOwner() {
  const select = document.getElementById("business-select");
  if (!select.options.length) {
    for (const b of meta.claimed) select.append(el("option", { value: b.id }, b.name));
    select.addEventListener("change", () => loadBusiness(select.value));
  }
  await loadBusiness(select.value);
}

async function loadBusiness(id) {
  currentBusiness = await api(`/api/business/${id}`);
  document.getElementById("advice").replaceChildren();
  document.getElementById("save-status").textContent = "";
  renderBusinessHeader();
  renderSignals();
  renderNeedsForm();
  await drawOwnerMap();
}

function renderBusinessHeader() {
  const b = currentBusiness;
  const offers = b.offers.length
    ? el("p", { class: "muted" }, "Offering: ", b.offers.join("; "))
    : null;
  document.getElementById("business-header").replaceChildren(
    el("h2", {}, b.name),
    el("p", { class: "muted" }, `${b.type} · ${b.area}`),
    offers,
    publicTags(b),
  );
}

function renderSignals() {
  const list = document.getElementById("signals");
  const signals = currentBusiness.signals;
  list.replaceChildren(
    ...(signals.length
      ? signals.map((s) => el("li", {}, s.text, el("span", { class: "muted" }, ` (${s.source})`)))
      : [el("li", {}, "Nothing to flag right now.")]),
  );
}

function providerOptions(needKey, selected) {
  const matching = meta.providers.filter((p) => p.categories.includes(needKey));
  const options = [
    { value: "", label: "Nobody / did it myself" },
    ...matching.map((p) => ({ value: p.id, label: p.name })),
    { value: "other", label: "Another provider" },
  ];
  return options.map((o) =>
    el("option", { value: o.value, selected: (selected || "") === o.value }, o.label),
  );
}

function renderNeedsForm() {
  const form = document.getElementById("needs-form");
  form.replaceChildren(
    ...meta.needs.map(({ key, label }) => {
      const need = currentBusiness.needs[key] || {
        status: "unknown", provider: null, rating: null, comment: "", note: "", shared: false,
      };
      const row = el("div", { class: "need", "data-need": key });

      const status = el("select", { name: "status", "aria-label": `${label} status` },
        Object.entries(STATUS_LABELS).map(([value, text]) =>
          el("option", { value, selected: need.status === value }, text)),
      );
      const provider = el("select", { name: "provider", "aria-label": `${label} provider` },
        providerOptions(key, need.provider));
      const rating = el("select", { name: "rating", "aria-label": `${label} rating` },
        el("option", { value: "" }, "No rating"),
        Object.entries(RATING_LABELS).map(([value, text]) =>
          el("option", { value, selected: String(need.rating) === value }, text)),
      );
      const comment = el("input", {
        type: "text", name: "comment", class: "wide", value: need.comment,
        placeholder: "Short review for other businesses (optional)", maxlength: 280,
      });
      const note = el("input", {
        type: "text", name: "note", class: "wide", value: need.note,
        placeholder: "Anything providers should know? (optional)", maxlength: 280,
      });
      const shared = el("input", { type: "checkbox", name: "shared", checked: need.shared });

      // Provider, rating and review only make sense if they've used someone.
      const toggle = () => {
        const used = ["happy", "unhappy", "past"].includes(status.value);
        for (const field of [provider, rating, comment]) field.hidden = !used;
      };
      status.addEventListener("change", toggle);
      toggle();

      row.append(
        el("div", { class: "need-title" }, label,
          el("label", { class: "share" }, shared, "Show providers")),
        status, provider, rating, comment, note,
      );
      return row;
    }),
  );
}

function readNeedsForm() {
  const needs = {};
  for (const row of document.querySelectorAll("#needs-form .need")) {
    const field = (name) => row.querySelector(`[name="${name}"]`);
    const used = ["happy", "unhappy", "past"].includes(field("status").value);
    needs[row.dataset.need] = {
      status: field("status").value,
      provider: used ? field("provider").value || null : null,
      rating: used && field("rating").value ? Number(field("rating").value) : null,
      comment: used ? field("comment").value : "",
      note: field("note").value,
      shared: field("shared").checked,
    };
  }
  return needs;
}

async function saveNeeds() {
  const status = document.getElementById("save-status");
  status.textContent = "Saving…";
  try {
    currentBusiness = await api(`/api/business/${currentBusiness.id}/needs`, {
      method: "PUT",
      body: JSON.stringify(readNeedsForm()),
    });
    status.textContent = "Saved.";
  } catch (err) {
    status.textContent = err.message;
  }
}

async function askAdviser() {
  const button = document.getElementById("advise");
  const out = document.getElementById("advice");
  button.disabled = true;
  out.replaceChildren(el("p", { class: "muted" }, "Saving your answers, then asking the adviser. This can take a little while…"));
  try {
    await saveNeeds();
    const result = await api(`/api/business/${currentBusiness.id}/advise`, { method: "POST" });
    const labels = Object.fromEntries(meta.needs.map((n) => [n.key, n.label]));
    out.replaceChildren(
      el("p", {}, result.summary),
      ...result.advice.map((a) =>
        el("div", { class: `advice-item v-${a.verdict}` },
          el("p", { class: "verdict" }, `${labels[a.need]}: ${VERDICT_LABELS[a.verdict]}`),
          el("p", {}, a.reason),
          el("p", {}, el("b", {}, "Next step: "), a.next_step),
        )),
    );
  } catch (err) {
    out.replaceChildren(el("p", { class: "error" }, err.message));
  } finally {
    button.disabled = false;
  }
}

async function drawOwnerMap() {
  const all = await api("/api/businesses");
  pins.clearLayers();
  for (const b of all) {
    const isYou = b.id === currentBusiness.id;
    const popup = el("div", {},
      el("b", {}, b.name), isYou ? " (you)" : null, el("br"),
      `${b.type} · ${b.area}`,
      publicTags(b),
    );
    const marker = addPin(b, isYou ? "--pin-you" : "--pin-quiet", isYou ? 11 : 7, popup);
    if (isYou) {
      marker.bringToFront();
      map.setView([b.lat, b.lng], 13);
    }
  }
}

// ---------- Provider view ----------

async function showProvider() {
  const select = document.getElementById("provider-select");
  if (!select.options.length) {
    for (const p of meta.providers) select.append(el("option", { value: p.id }, `${p.name} (${p.kind})`));
    select.addEventListener("change", () => loadProvider(select.value));
  }
  await loadProvider(select.value);
}

function bestState(matches) {
  const order = PIN_STATES.map((s) => s.state);
  return matches.map((m) => m.state).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
}

function matchLine(m) {
  const pin = PIN_STATES.find((s) => s.state === m.state);
  const rating = m.rating ? ` · ${RATING_LABELS[m.rating]}` : "";
  return [
    el("div", { class: "lead-line" },
      el("span", { class: "dot", style: `background:${cssVar(pin.color)}` }),
      el("span", {}, m.text + rating)),
    m.comment ? el("p", { class: "quote" }, `“${m.comment}”`) : null,
    m.note && m.state === "open" ? el("p", { class: "quote" }, `Owner says: ${m.note}`) : null,
  ];
}

async function loadProvider(id) {
  const view = await api(`/api/provider/${id}/map`);
  const order = PIN_STATES.map((s) => s.state);
  view.sort((a, b) => order.indexOf(bestState(a.matches)) - order.indexOf(bestState(b.matches)));

  // Legend with a count per pin colour.
  const counts = {};
  for (const b of view) counts[bestState(b.matches)] = (counts[bestState(b.matches)] || 0) + 1;
  document.getElementById("legend").replaceChildren(
    el("h2", {}, "On your map"),
    ...PIN_STATES.filter((s) => counts[s.state]).map((s) =>
      el("div", { class: "legend-row" },
        el("span", { class: "dot", style: `background:${cssVar(s.color)}` }),
        `${s.label}: ${counts[s.state]}`)),
  );

  pins.clearLayers();
  const bounds = [];
  const leads = view.map((b) => {
    const state = PIN_STATES.find((s) => s.state === bestState(b.matches));
    const details = () => [
      el("div", { class: "lead-name" }, b.name),
      el("div", { class: "muted" }, `${b.type} · ${b.area}${b.claimed ? "" : " · not on NEhelp yet"}`),
      ...b.matches.flatMap(matchLine),
      b.claimed ? null : publicTags(b),
      b.offers.length ? el("p", { class: "quote" }, `Offers: ${b.offers.join("; ")}`) : null,
    ];
    const quiet = ["served", "private", "no_info"].includes(state.state);
    const marker = addPin(b, state.color, quiet ? 6 : 9, el("div", {}, details()));
    bounds.push([b.lat, b.lng]);
    return el("li", { onclick: () => { map.setView([b.lat, b.lng], 15); marker.openPopup(); } }, details());
  });
  document.getElementById("leads").replaceChildren(...leads);
  map.fitBounds(bounds, { padding: [30, 30] });
}

// ---------- Start up ----------

async function setRole(role) {
  for (const tab of document.querySelectorAll(".roles button")) {
    tab.setAttribute("aria-selected", String(tab.dataset.role === role));
  }
  document.getElementById("owner-view").hidden = role !== "owner";
  document.getElementById("provider-view").hidden = role !== "provider";
  map.closePopup();
  await (role === "owner" ? showOwner() : showProvider());
}

async function start() {
  map = L.map("map").setView([54.975, -1.6], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  pins = L.layerGroup().addTo(map);

  meta = await api("/api/meta");
  if (!meta.adviser_ready) {
    document.getElementById("advise").after(
      el("p", { class: "muted" }, "Adviser is off: install Claude Code or add a Claude API key to .env."));
  }

  for (const tab of document.querySelectorAll(".roles button")) {
    tab.addEventListener("click", () => setRole(tab.dataset.role));
  }
  document.getElementById("save-needs").addEventListener("click", saveNeeds);
  document.getElementById("advise").addEventListener("click", askAdviser);

  await setRole("owner");
}

start();
