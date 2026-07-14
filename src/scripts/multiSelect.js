// Multi-select checkbox dropdown with "Select All" and removable chips.
// Renders into a container `<div data-multiselect="fieldName">`, reads the
// initial value from `data-initial` (JSON array or comma string), and stores
// its current value as a JSON array on the container's dataset.
//
// Reading the value from outside:
//   JSON.parse(container.dataset.value || "[]")

import { DEPARTMENTS } from "./departments.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
);

export function initDepartmentMultiSelect(container, {
  placeholder = "Select departments",
  options = DEPARTMENTS,
  initial = [],
} = {}) {
  if (!container || container.dataset.ready === "1") return;
  container.dataset.ready = "1";

  let selected = new Set(
    Array.isArray(initial)
      ? initial
      : String(initial || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  // keep only known departments
  selected = new Set([...selected].filter((s) => options.includes(s)));

  container.classList.add("ms-field");
  container.innerHTML = `
    <button type="button" class="ms-trigger form-input" aria-haspopup="listbox" aria-expanded="false">
      <span class="ms-trigger-label">${esc(placeholder)}</span>
      <span class="ms-trigger-arrow" aria-hidden="true">▾</span>
    </button>
    <div class="ms-dropdown" hidden role="listbox" aria-multiselectable="true">
      <label class="ms-option ms-option-all">
        <input type="checkbox" class="ms-all" />
        <span>Select All</span>
      </label>
      <div class="ms-divider"></div>
      <div class="ms-list">
        ${options.map((o) => `
          <label class="ms-option">
            <input type="checkbox" value="${esc(o)}" class="ms-opt" />
            <span>${esc(o)}</span>
          </label>`).join("")}
      </div>
    </div>
    <div class="ms-chips" aria-live="polite"></div>
  `;

  const trigger = container.querySelector(".ms-trigger");
  const label = container.querySelector(".ms-trigger-label");
  const dropdown = container.querySelector(".ms-dropdown");
  const allBox = container.querySelector(".ms-all");
  const boxes = Array.from(container.querySelectorAll(".ms-opt"));
  const chipsWrap = container.querySelector(".ms-chips");

  function persist() {
    container.dataset.value = JSON.stringify([...selected]);
    container.dispatchEvent(new CustomEvent("change", { bubbles: true }));
  }

  function paint() {
    boxes.forEach((b) => { b.checked = selected.has(b.value); });
    allBox.checked = selected.size === options.length;
    allBox.indeterminate = selected.size > 0 && selected.size < options.length;

    label.textContent = selected.size === 0
      ? placeholder
      : selected.size === options.length
        ? "All Departments"
        : `${selected.size} department${selected.size === 1 ? "" : "s"} selected`;
    label.classList.toggle("is-placeholder", selected.size === 0);

    chipsWrap.innerHTML = [...selected].map((v) => `
      <span class="ms-chip">
        <span class="ms-chip-text">${esc(v)}</span>
        <button type="button" class="ms-chip-x" data-remove="${esc(v)}" aria-label="Remove ${esc(v)}">×</button>
      </span>`).join("");
  }

  function open() { dropdown.hidden = false; trigger.setAttribute("aria-expanded", "true"); }
  function close() { dropdown.hidden = true; trigger.setAttribute("aria-expanded", "false"); }

  trigger.addEventListener("click", (e) => { e.preventDefault(); dropdown.hidden ? open() : close(); });
  document.addEventListener("click", (e) => { if (!container.contains(e.target)) close(); });
  container.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); trigger.focus(); } });

  allBox.addEventListener("change", () => {
    if (allBox.checked) options.forEach((o) => selected.add(o));
    else selected.clear();
    paint(); persist();
  });

  boxes.forEach((b) => {
    b.addEventListener("change", () => {
      if (b.checked) selected.add(b.value);
      else selected.delete(b.value);
      paint(); persist();
    });
  });

  chipsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    selected.delete(btn.dataset.remove);
    paint(); persist();
  });

  paint();
  persist();

  return {
    getValue: () => [...selected],
    setValue: (arr) => {
      selected = new Set((arr || []).filter((s) => options.includes(s)));
      paint(); persist();
    },
  };
}
