import { registerStudent, isAllowedEmail } from "./studentAuth.js";
import { DEPARTMENTS } from "./departments.js";

export function initStudentRegisterPage() {
  const form = document.getElementById("studentRegisterForm");
  const alert = document.getElementById("registerAlert");
  const submitBtn = document.getElementById("registerSubmit");
  if (!form) return;

  // Populate department dropdown from the shared canonical list.
  const deptSelect = document.getElementById("department");
  if (deptSelect) {
    const placeholder = deptSelect.querySelector('option[value=""]');
    deptSelect.innerHTML = "";
    if (placeholder) deptSelect.appendChild(placeholder);
    else deptSelect.insertAdjacentHTML("afterbegin", `<option value="">Select department</option>`);
    DEPARTMENTS.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d; opt.textContent = d;
      deptSelect.appendChild(opt);
    });
  }

  form.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      const input = document.getElementById(id);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  form.querySelectorAll(".form-input").forEach((input) => {
    input.addEventListener("input", () => {
      clearError(input);
      alert?.classList.remove("is-visible");
    });
    input.addEventListener("change", () => clearError(input));
  });

  enhanceSearchableSelect(document.getElementById("department"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alert?.classList.remove("is-visible");
    const data = Object.fromEntries(new FormData(form).entries());
    let valid = true;

    const required = ["fullName", "registerNumber", "email", "department", "year", "cgpa", "password", "confirmPassword"];
    required.forEach((name) => {
      const input = form.elements[name];
      if (!String(data[name] || "").trim()) { showError(input, "This field is required."); valid = false; }
    });

    if (data.email && !isAllowedEmail(data.email)) {
      showError(form.elements.email, "Please use your official college email address."); valid = false;
    }
    if (data.cgpa) {
      const n = parseFloat(data.cgpa);
      if (isNaN(n) || n < 0 || n > 10) { showError(form.elements.cgpa, "CGPA must be between 0 and 10."); valid = false; }
    }
    if (data.password && data.password.length < 6) {
      showError(form.elements.password, "Password must be at least 6 characters."); valid = false;
    }
    if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
      showError(form.elements.confirmPassword, "Passwords do not match."); valid = false;
    }
    if (!valid) return;

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const res = await registerStudent(data);
    if (!res.ok) {
      setLoading(false);
      showAlert(res.error);
      return;
    }
    window.location.href = "/student-login.html";
  });

  function showError(input, msg) {
    if (!input) return;
    input.classList.add("is-invalid");
    const group = input.closest(".form-group");
    const trigger = group?.querySelector(".searchable-select__trigger");
    if (trigger) trigger.classList.add("is-invalid");
    const err = group?.querySelector(".form-error");
    if (err) { err.querySelector("span").textContent = msg; err.classList.add("is-visible"); }
  }
  function clearError(input) {
    if (!input) return;
    input.classList.remove("is-invalid");
    const group = input.closest(".form-group");
    const trigger = group?.querySelector(".searchable-select__trigger");
    if (trigger) trigger.classList.remove("is-invalid");
    group?.querySelector(".form-error")?.classList.remove("is-visible");
  }
  function showAlert(msg) {
    if (!alert) return;
    alert.querySelector("span").textContent = msg;
    alert.classList.add("is-visible");
  }
  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Creating account...`;
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Register";
    }
  }

  function enhanceSearchableSelect(select) {
    if (!select) return;
    const options = Array.from(select.options);
    const placeholder = options[0]?.text || "Select";

    const wrapper = document.createElement("div");
    wrapper.className = "searchable-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("searchable-select__source");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "searchable-select__trigger form-input";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.id = "departmentTrigger";
    const label = select.closest(".form-group")?.querySelector("label");
    if (label) {
      label.id = label.id || "departmentLabel";
      label.htmlFor = trigger.id;
    }
    trigger.setAttribute("aria-labelledby", `${label?.id || ""} ${trigger.id}`.trim());
    trigger.innerHTML = `<span class="searchable-select__value is-placeholder">${escapeHtml(placeholder)}</span><span class="searchable-select__arrow" aria-hidden="true"></span>`;
    wrapper.appendChild(trigger);
    select.setAttribute("tabindex", "-1");

    const dropdown = document.createElement("div");
    dropdown.className = "searchable-select__dropdown";
    dropdown.setAttribute("role", "listbox");
    dropdown.hidden = true;
    dropdown.innerHTML = `
      <div class="searchable-select__search">
        <input type="text" class="searchable-select__search-input" placeholder="Search departments..." autocomplete="off" aria-label="Search departments" />
      </div>
      <ul class="searchable-select__list"></ul>
    `;
    wrapper.appendChild(dropdown);

    const list = dropdown.querySelector(".searchable-select__list");
    const searchInput = dropdown.querySelector(".searchable-select__search-input");

    function renderItems(filter = "") {
      const term = filter.toLowerCase();
      list.innerHTML = "";
      let count = 0;
      options.slice(1).forEach((opt) => {
        if (!opt.text.toLowerCase().includes(term)) return;
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("tabindex", "-1");
        li.dataset.value = opt.value;
        li.textContent = opt.text;
        if (select.value === opt.value) {
          li.setAttribute("aria-selected", "true");
          li.classList.add("is-selected");
        }
        list.appendChild(li);
        count++;
      });
      if (count === 0) {
        const li = document.createElement("li");
        li.className = "searchable-select__no-results";
        li.setAttribute("role", "option");
        li.setAttribute("aria-disabled", "true");
        li.textContent = "No departments found";
        list.appendChild(li);
      }
    }

    function updateTrigger() {
      const selected = options.find((o) => o.value === select.value);
      const valueEl = trigger.querySelector(".searchable-select__value");
      if (selected && selected.value) {
        valueEl.textContent = selected.text;
        valueEl.classList.remove("is-placeholder");
      } else {
        valueEl.textContent = placeholder;
        valueEl.classList.add("is-placeholder");
      }
    }

    function open() {
      dropdown.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      searchInput.value = "";
      renderItems();
      searchInput.focus();
    }
    function close() {
      dropdown.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      if (dropdown.hidden) open(); else close();
    });

    searchInput.addEventListener("input", (e) => renderItems(e.target.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const item = list.querySelector("li[role='option']:not([aria-disabled='true'])");
        item?.focus();
      }
    });

    list.addEventListener("click", (e) => {
      const li = e.target.closest("li[role='option']");
      if (!li || li.getAttribute("aria-disabled") === "true") return;
      select.value = li.dataset.value;
      updateTrigger();
      clearError(select);
      close();
    });

    list.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll("li[role='option']:not([aria-disabled='true'])"));
      const idx = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[Math.min(idx + 1, items.length - 1)]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx <= 0) { searchInput.focus(); return; }
        items[Math.max(idx - 1, 0)]?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        document.activeElement?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
        trigger.focus();
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) close();
    });

    updateTrigger();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
