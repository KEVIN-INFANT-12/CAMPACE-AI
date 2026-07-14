export function initNavbar() {
  const nav = document.getElementById("navbar");
  const toggle = document.getElementById("navToggle");
  const panel = document.getElementById("mobilePanel");

  const onScroll = () => {
    if (window.scrollY > 12) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      if (open) panel.setAttribute("hidden", "");
      else panel.removeAttribute("hidden");
    });
    panel.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        panel.setAttribute("hidden", "");
      })
    );
  }
}