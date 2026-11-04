// Dream Cuts — shared behaviour for the marketing pages.
(function () {
  const data = window.DREAMCUTS || {};

  // Mobile menu — slide-in panel from the right
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    if (!links.id) links.id = "site-nav";
    toggle.innerHTML = '<span class="burger" aria-hidden="true"><span></span><span></span><span></span></span>';
    toggle.setAttribute("aria-controls", links.id);

    const head = document.createElement("li");
    head.className = "nav-panel-head";
    head.innerHTML = '<span>Menu</span><button class="nav-close" type="button" aria-label="Close menu"><i class="bi bi-x-lg"></i></button>';
    links.prepend(head);

    const backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);

    const setOpen = (open) => {
      links.classList.toggle("is-open", open);
      backdrop.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-locked", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) head.querySelector(".nav-close").focus();
      else if (links.contains(document.activeElement)) toggle.focus();
    };

    // Profile / login button: lives in the navbar on desktop, inside the panel on mobile.
    // The element itself is moved (not cloned) so booking.js / profile.js keep their handlers.
    const account = document.querySelector(".nav-login");
    if (account) {
      const slot = document.createElement("li");
      slot.className = "nav-account";
      head.after(slot);
      const anchor = document.createComment("nav-login");
      account.before(anchor);
      const mobile = window.matchMedia("(max-width: 960px)");
      const place = () => (mobile.matches ? slot.appendChild(account) : anchor.after(account));
      place();
      mobile.addEventListener("change", place);
    }

    toggle.addEventListener("click", () => setOpen(!links.classList.contains("is-open")));
    head.querySelector(".nav-close").addEventListener("click", () => setOpen(false));
    backdrop.addEventListener("click", () => setOpen(false));
    links.addEventListener("click", (e) => { if (e.target.closest("a, .nav-login")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && links.classList.contains("is-open")) setOpen(false);
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  // Highlight current page
  const page = document.body.dataset.page;
  document.querySelectorAll(`.nav-links a[data-page="${page}"]`).forEach((a) => a.setAttribute("aria-current", "page"));

  // Opening hours (any element with data-hours)
  if (data.location) {
    document.querySelectorAll("[data-hours]").forEach((list) => {
      list.innerHTML = data.location.hours.map((r) => `<li>${r.days}<span>${r.time}</span></li>`).join("");
    });
  }

  // Year
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  // Services page: render the full menu from data.js
  const menu = document.querySelector("#serviceMenu");
  if (menu && data.services) {
    const icons = {
      little: ["bi-balloon-heart", "c-pink"],
      girls: ["bi-flower1", "c-lilac"],
      boys: ["bi-lightning-charge", "c-sky"],
      styling: ["bi-magic", "c-butter"],
      fun: ["bi-stars", "c-peach"],
      nails: ["bi-palette", "c-mint"],
      mum: ["bi-hearts", "c-pink"]
    };
    const money = (n) => `$${n.toFixed(2)}`;
    const cats = data.categories.filter((c) => c.id !== "all");
    const nav = document.querySelector("#serviceCats");
    if (nav) nav.innerHTML = cats.map((c) => `<a href="#cat-${c.id}">${c.label}</a>`).join("");
    menu.innerHTML = cats
      .map((c) => {
        const items = data.services.filter((s) => s.category === c.id);
        if (!items.length) return "";
        const [icon, tone] = icons[c.id] || ["bi-scissors", "c-pink"];
        return `
        <section class="svc-group" id="cat-${c.id}">
          <div class="svc-group-head">
            <span class="ic ${tone}"><i class="bi ${icon}"></i></span>
            <h2>${c.label}</h2>
          </div>
          <div class="svc-list">
            ${items
              .map(
                (s) => `
              <article class="svc">
                <h3>${s.name}</h3>
                <div class="price">${s.fromPrice ? "<small>from</small>" : ""}${money(s.fromAmount || s.price)}</div>
                <p>${s.blurb}</p>
                <div class="meta">
                  <span class="time"><i class="bi bi-clock"></i> ${s.duration} min</span>
                  <a class="book-link" href="booking.html?service=${s.id}">Book this <i class="bi bi-arrow-right"></i></a>
                </div>
              </article>`
              )
              .join("")}
          </div>
        </section>`;
      })
      .join("");

    const addons = document.querySelector("#addonList");
    if (addons && data.addons) {
      addons.innerHTML = data.addons
        .map((a) => `<article class="svc"><h3>${a.name}</h3><div class="price">${money(a.price)}</div></article>`)
        .join("");
    }
  }

  // Contact form (demo only: no backend yet)
  const form = document.querySelector("#contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.reset();
      const status = document.querySelector("#formStatus");
      if (status) {
        status.hidden = false;
        status.textContent = "Thanks! We’ll get back to you soon. 💖";
      }
    });
  }

  // Reveal on scroll
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      }),
      { threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }
})();
