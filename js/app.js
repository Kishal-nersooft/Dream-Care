(function () {
  const data = window.DREAMCUTS;
  const MAX_CUSTOMERS = 6;

  const state = {
    step: 1,
    customers: [newCustomer(1)],
    activeIndex: 0,
    category: "all",
    query: "",
    monthCursor: startOfMonth(new Date()),
    dobCursor: startOfMonth(new Date(new Date().getFullYear() - 6, new Date().getMonth(), 1)),
    dobOpen: false,
    openUid: null,
    loggedIn: false,
    loginContact: "",
    pendingCheckout: false
  };

  const els = {
    chips: document.querySelector("#categoryChips"),
    search: document.querySelector("#serviceSearch"),
    popular: document.querySelector("#popularRow"),
    grid: document.querySelector("#serviceGrid"),
    empty: document.querySelector("#emptyServices"),
    catalog: document.querySelector("#serviceCatalog"),
    selected: document.querySelector("#selectedServices"),
    addServiceBtn: document.querySelector("#addServiceBtn"),
    steps: [...document.querySelectorAll("[data-step]")],
    panels: [...document.querySelectorAll("[data-panel]")],
    actions: document.querySelector("#panelActions"),
    continueBtn: document.querySelector("#continueBtn"),
    backBtn: document.querySelector("#backBtn"),
    form: document.querySelector("#guestForm"),
    summary: document.querySelector("#summary"),
    success: document.querySelector("#successPanel"),
    payment: document.querySelector("#paymentPanel"),
    payForm: document.querySelector("#payForm"),
    payAmount: document.querySelector("#payAmount"),
    payBtn: document.querySelector("#payBtn"),
    payBack: document.querySelector("#payBack"),
    bookingMain: document.querySelector("#bookingMain"),
    folderDock: document.querySelector("[data-folders]"),
    checkoutHint: document.querySelector("#checkoutHint"),
    profileNotice: document.querySelector("#profileNotice"),
    profileTitle: document.querySelector("#profileTitle"),
    loginModal: document.querySelector("#loginModal"),
    loginForm: document.querySelector("#loginForm"),
    loginClose: document.querySelector("#loginClose"),
    loginTitle: document.querySelector("#loginTitle"),
    loginHint: document.querySelector("#loginHint"),
    headerLogin: document.querySelector("#headerLogin"),
    scroll: document.querySelector(".booking-scroll"),
    dobPicker: document.querySelector("#dobPicker"),
    dobToggle: document.querySelector("#dobToggle")
  };

  const mobileQuery = window.matchMedia("(max-width: 767.98px)");

  // Desktop scrolls inside the booking card; mobile scrolls the page itself.
  function scrollBookingTop() {
    if (els.scroll) els.scroll.scrollTop = 0;
    if (!mobileQuery.matches) return;
    const card = document.querySelector(".booking-card");
    if (!card) return;
    const header = document.querySelector(".site-header");
    const top = card.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 8;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }

  function newCustomer(n) {
    return {
      id: `c-${Date.now()}-${n}-${Math.random().toString(16).slice(2, 6)}`,
      firstName: "",
      lastName: "",
      mobile: "",
      dob: "",
      gender: "",
      services: [],
      adding: true
    };
  }

  function newLine(serviceId) {
    return {
      uid: `l-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      serviceId,
      stylistId: "",
      addonIds: [],
      date: null,
      time: null
    };
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function toLocalISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function fromLocalISO(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function money(value, fromPrice) {
    const formatted = Number(value).toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD"
    });
    return fromPrice ? `From ${formatted}` : formatted;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function activeCustomer() {
    return state.customers[state.activeIndex];
  }

  function isFirst(index = state.activeIndex) {
    return index === 0;
  }

  function isGroup() {
    return state.customers.length > 1;
  }

  function fullName(customer) {
    return `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  }

  function customerLabel(customer, index) {
    const name = fullName(customer);
    if (name) return name;
    if (index === 0 && state.loginContact) return state.loginContact;
    return index === 0 ? "Customer 1" : `Customer ${index + 1}`;
  }

  function serviceById(id) {
    return data.services.find((service) => service.id === id);
  }

  function stylistById(id) {
    const list = data.stylists || [];
    return list.find((stylist) => stylist.id === id) || null;
  }

  function addonById(id) {
    return (data.addons || []).find((addon) => addon.id === id);
  }

  function allowsAddons(service) {
    if (!service || service.noAddons) return false;
    return ["little", "girls", "boys", "styling"].includes(service.category);
  }

  function fromAmount(service) {
    if (!service) return 0;
    if (service.fromAmount != null) return service.fromAmount;
    if (service.fromPrice) return Math.round(service.price * 90) / 100;
    return service.price;
  }

  function quoteFor(service, stylistId) {
    const from = fromAmount(service);
    const full = service.price;
    const stylist = stylistById(stylistId);
    if (!stylist) {
      return {
        price: from,
        duration: service.duration,
        from: from < full
      };
    }
    const usesFrom = Boolean(stylist.any || stylist.fromTier);
    const extra = Number(stylist.extraMinutes || 0);
    return {
      price: usesFrom ? from : full,
      duration: service.duration + extra,
      from: Boolean(stylist.any && from < full)
    };
  }

  function lineAddons(line) {
    return (line.addonIds || []).map(addonById).filter(Boolean);
  }

  function lineTotals(line) {
    const extras = lineAddons(line);
    const quote = quoteFor(line.service, line.stylistId);
    return {
      price: quote.price + extras.reduce((sum, addon) => sum + addon.price, 0),
      duration: quote.duration + extras.reduce((sum, addon) => sum + addon.duration, 0),
      from: quote.from && !line.stylistId
    };
  }

  function customerServices(customer) {
    return (customer.services || [])
      .map((line) => ({ ...line, service: serviceById(line.serviceId), stylist: stylistById(line.stylistId) }))
      .filter((line) => line.service);
  }

  function lineComplete(line) {
    return Boolean(line.stylistId && line.date && line.time);
  }

  function parseDob(value) {
    const match = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today || year < 1990) return null;
    return date;
  }

  function formatDobDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getFullYear()}`;
  }

  function defaultDobCursor() {
    const parsed = parseDob(els.form?.elements.dob.value || activeCustomer()?.dob);
    if (parsed) return startOfMonth(parsed);
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() - 6);
    return startOfMonth(fallback);
  }

  function closeDobPicker() {
    state.dobOpen = false;
    if (els.dobPicker) els.dobPicker.hidden = true;
    if (els.dobToggle) els.dobToggle.setAttribute("aria-expanded", "false");
  }

  function renderDobPicker() {
    const picker = els.dobPicker;
    if (!picker) return;
    const month = state.dobCursor;
    const selected = parseDob(els.form?.elements.dob.value || "");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minYear = 1990;
    const maxYear = today.getFullYear();
    const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const canPrev = month.getFullYear() > minYear || month.getMonth() > 0;
    const canNext =
      month.getFullYear() < maxYear ||
      (month.getFullYear() === maxYear && month.getMonth() < today.getMonth());

    const monthOptions = Array.from({ length: 12 }, (_, index) => {
      const label = new Date(2000, index, 1).toLocaleDateString("en-AU", { month: "long" });
      return `<option value="${index}" ${index === month.getMonth() ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");

    const yearOptions = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      yearOptions.push(`<option value="${year}" ${year === month.getFullYear() ? "selected" : ""}>${year}</option>`);
    }

    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push("<div></div>");
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const disabled = date > today;
      const isSelected = selected && sameDay(date, selected);
      const isToday = sameDay(date, today);
      cells.push(`
        <button type="button" class="day-btn ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
          data-dob-day="${toLocalISO(date)}" ${disabled ? "disabled" : ""}>${day}</button>
      `);
    }

    picker.innerHTML = `
      <div class="dob-cal-head">
        <button class="icon-btn" type="button" data-dob-cal="-1" aria-label="Previous month" ${canPrev ? "" : "disabled"}><i class="bi bi-chevron-left"></i></button>
        <div class="dob-cal-selects">
          <select name="dob_month" aria-label="Birth month">${monthOptions}</select>
          <select name="dob_year" aria-label="Birth year">${yearOptions.join("")}</select>
        </div>
        <button class="icon-btn" type="button" data-dob-cal="1" aria-label="Next month" ${canNext ? "" : "disabled"}><i class="bi bi-chevron-right"></i></button>
      </div>
      <div class="cal-grid">
        ${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dow) => `<div class="cal-dow">${dow}</div>`).join("")}
        ${cells.join("")}
      </div>
    `;
  }

  function openDobPicker() {
    if (!guestNeedsDetails()) return;
    state.dobCursor = defaultDobCursor();
    state.dobOpen = true;
    renderDobPicker();
    if (els.dobPicker) els.dobPicker.hidden = false;
    if (els.dobToggle) els.dobToggle.setAttribute("aria-expanded", "true");
  }

  function toggleDobPicker() {
    if (state.dobOpen) closeDobPicker();
    else openDobPicker();
  }

  function setDobDay(iso) {
    const date = fromLocalISO(iso);
    if (!els.form) return;
    els.form.elements.dob.value = formatDobDate(date);
    saveFields();
    closeDobPicker();
    els.form.elements.dob.closest(".field")?.classList.remove("is-invalid");
    if (els.profileNotice && profileComplete(activeCustomer())) els.profileNotice.hidden = true;
    renderFolders();
    els.continueBtn.disabled = !canContinue();
  }

  function shiftDobMonth(delta) {
    const next = new Date(state.dobCursor.getFullYear(), state.dobCursor.getMonth() + delta, 1);
    const today = new Date();
    const min = new Date(1990, 0, 1);
    const max = startOfMonth(today);
    if (next < min || next > max) return;
    state.dobCursor = next;
    renderDobPicker();
  }

  function guestNeedsDetails(index = state.activeIndex) {
    return index > 0;
  }

  function profileComplete(customer) {
    return (
      String(customer.firstName || "").trim().length >= 2 &&
      String(customer.lastName || "").trim().length >= 1 &&
      String(customer.mobile || "").replace(/\s/g, "").length >= 8 &&
      Boolean(parseDob(customer.dob)) &&
      Boolean(customer.gender)
    );
  }

  function customerReady(customer, index) {
    const i = index == null ? state.customers.indexOf(customer) : index;
    const lines = customerServices(customer);
    const servicesOk = lines.length > 0 && lines.every(lineComplete);
    if (guestNeedsDetails(i)) return profileComplete(customer) && servicesOk;
    return servicesOk;
  }

  function bookingTotal() {
    return state.customers.reduce((sum, customer) => {
      return sum + customerServices(customer).reduce((inner, line) => inner + lineTotals(line).price, 0);
    }, 0);
  }

  function allReady() {
    return state.customers.every((customer, index) => customerReady(customer, index));
  }

  function canAddAnother(customer) {
    const lines = customerServices(customer);
    return lines.length > 0 && lines.every((line) => line.stylistId);
  }

  function filteredServices() {
    const q = state.query.trim().toLowerCase();
    const taken = new Set(activeCustomer().services.map((line) => line.serviceId));
    return data.services.filter((service) => {
      const inCat = state.category === "all" || service.category === state.category;
      const inQuery =
        !q ||
        service.name.toLowerCase().includes(q) ||
        service.blurb.toLowerCase().includes(q);
      return inCat && inQuery && !taken.has(service.id);
    });
  }

  function cardHTML(service) {
    const from = fromAmount(service) < service.price;
    return `
      <article class="service-card" data-service="${service.id}">
        <div class="card-photo">
          <img src="${service.image}" alt="${escapeHtml(service.name)}">
          <span class="badge-time">${service.duration} min</span>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(service.name)}</h3>
          <p>${escapeHtml(service.blurb)}</p>
          <div class="card-foot">
            <div class="price">${money(from ? fromAmount(service) : service.price, from)}</div>
            <button type="button" class="btn-select" data-select="${service.id}">Select</button>
          </div>
        </div>
      </article>
    `;
  }

  function sameDay(a, b) {
    return (
      a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function formatDay(date) {
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  function formatTime(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }

  function openingFor(date) {
    const day = date.getDay();
    const map = {
      0: [10, 17],
      1: [9, 17.5],
      2: [9, 17.5],
      3: [9, 17.5],
      4: [9, 19],
      5: [9, 17.5],
      6: [9, 17]
    };
    return map[day];
  }

  function slotSeed(date) {
    const key = date.toDateString();
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * 17) % 97;
    return hash;
  }

  function calendarHTML(line) {
    const month = state.monthCursor;
    const label = month.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push("<div></div>");

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const disabled = date < today;
      const selected = line.date && sameDay(date, line.date);
      const isToday = sameDay(date, today);
      cells.push(`
        <button type="button" class="day-btn ${selected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
          data-line-day="${line.uid}" data-day="${toLocalISO(date)}" ${disabled ? "disabled" : ""}>${day}</button>
      `);
    }

    const cal = `
      <div class="calendar">
        <div class="cal-head">
          <button class="icon-btn" type="button" data-cal="-1" aria-label="Previous month"><i class="bi bi-chevron-left"></i></button>
          <h3>${escapeHtml(label)}</h3>
          <button class="icon-btn" type="button" data-cal="1" aria-label="Next month"><i class="bi bi-chevron-right"></i></button>
        </div>
        <div class="cal-grid">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dow) => `<div class="cal-dow">${dow}</div>`).join("")}
          ${cells.join("")}
        </div>
      </div>
    `;

    if (!line.date) {
      return `<div class="calendar-layout">${cal}<div class="slots"><h3>Pick a day to see times</h3></div></div>`;
    }

    const hours = openingFor(line.date);
    const durationHours = lineTotals(line).duration / 60;
    const seed = slotSeed(line.date);
    const slots = [];

    for (let t = hours[0]; t + durationHours <= hours[1] - 0.25; t += 0.5) {
      const busy = (Math.floor(t * 2) + seed) % 5 === 0;
      const labelTime = formatTime(t);
      const selected = line.time === labelTime;
      slots.push(`
        <button type="button" class="slot ${selected ? "is-selected" : ""}" data-line-time="${line.uid}" data-time="${labelTime}" ${busy ? "disabled" : ""}>
          ${labelTime}
        </button>
      `);
    }

    return `
      <div class="calendar-layout">
        ${cal}
        <div class="slots">
          <h3>${formatDay(line.date)}</h3>
          <div class="slot-grid">${slots.join("")}</div>
        </div>
      </div>
    `;
  }

  function addonHTML(line) {
    if (!allowsAddons(line.service)) return "";
    const chosen = new Set(line.addonIds || []);
    const chips = (data.addons || [])
      .map((addon) => {
        const on = chosen.has(addon.id);
        return `
          <button type="button" class="addon-chip ${on ? "is-on" : ""}" data-addon="${line.uid}" data-addon-id="${addon.id}">
            <span>${escapeHtml(addon.name)}</span>
            <strong>${money(addon.price)}</strong>
            ${addon.duration ? `<small>+${addon.duration} min</small>` : ""}
          </button>
        `;
      })
      .join("");
    return `
      <div class="addon-block">
        <h4>Suggested add-ons</h4>
        <p class="setup-hint">Optional extras for this service. Tap as many as you like.</p>
        <div class="addon-grid">${chips}</div>
      </div>
    `;
  }

  function stylistHTML(line) {
    const tiles = (data.stylists || [])
      .map((stylist) => {
        const quote = quoteFor(line.service, stylist.id);
        const on = line.stylistId === stylist.id;
        const photo = stylist.image
          ? `<img src="${stylist.image}" alt="">`
          : `<span class="stylist-any"><i class="bi bi-stars"></i></span>`;
        return `
          <button type="button" class="stylist-tile ${on ? "is-on" : ""}" data-pick-stylist="${line.uid}" data-stylist-id="${stylist.id}">
            ${photo}
            <span>
              <strong>${escapeHtml(stylist.name)}</strong>
              <small>${money(quote.price, quote.from)} · ${quote.duration} min</small>
            </span>
          </button>
        `;
      })
      .join("");
    return `
      <div class="stylist-block">
        <h4>Choose a stylist</h4>
        <div class="stylist-grid">${tiles}</div>
      </div>
    `;
  }

  function lineOpen(line) {
    if (!lineComplete(line)) return true;
    return state.openUid === line.uid;
  }

  function setupCardHTML(line) {
    const totals = lineTotals(line);
    const done = lineComplete(line);
    const open = lineOpen(line);
    const photo = (line.stylist && line.stylist.image) || line.service.image;
    const when =
      line.date && line.time ? `${formatDay(line.date)} · ${line.time}` : "Pick a date and time";
    const withWho = line.stylist ? `With ${line.stylist.name}` : "Choose a stylist";
    const extras = lineAddons(line)
      .map((addon) => escapeHtml(addon.name))
      .join(" · ");

    return `
      <article class="setup-card ${done ? "is-done" : ""} ${open ? "is-open" : ""}" data-line="${line.uid}">
        <header class="setup-head" data-toggle-line="${line.uid}">
          <img src="${photo}" alt="">
          <div class="setup-copy">
            <strong>${escapeHtml(line.service.name)}</strong>
            <small>${totals.duration} min · ${money(totals.price, totals.from)}</small>
            <em>${escapeHtml(withWho)}${done ? ` · ${when}` : ""}</em>
            ${extras ? `<em class="setup-extras">${extras}</em>` : ""}
          </div>
          <button type="button" class="line-x" data-remove-line="${line.uid}" aria-label="Remove service">×</button>
        </header>
        ${
          open
            ? `
          <div class="setup-body">
            ${addonHTML(line)}
            ${stylistHTML(line)}
            ${
              line.stylistId
                ? `<div class="when-block"><h4>Pick a date and time for this service</h4>${calendarHTML(line)}</div>`
                : `<p class="setup-hint">Choose a stylist to see times for this service.</p>`
            }
          </div>`
            : ""
        }
      </article>
    `;
  }

  function renderChips() {
    els.chips.innerHTML = data.categories
      .map(
        (cat) => `
        <button type="button" class="chip ${state.category === cat.id ? "is-active" : ""}" data-cat="${cat.id}">
          ${cat.label}
        </button>`
      )
      .join("");
  }

  function renderSelected() {
    const customer = activeCustomer();
    const lines = customerServices(customer);
    els.selected.innerHTML = lines.map(setupCardHTML).join("");

    const showCatalog = customer.adding || lines.length === 0;
    els.catalog.hidden = !showCatalog;
    els.addServiceBtn.hidden = showCatalog || !canAddAnother(customer);
    placeActions();
  }

  function renderServices() {
    const popular = data.services.filter((service) => service.popular);
    const taken = new Set(activeCustomer().services.map((line) => line.serviceId));
    els.popular.innerHTML = popular.filter((service) => !taken.has(service.id)).map(cardHTML).join("");
    const list = filteredServices();
    els.grid.innerHTML = list.map(cardHTML).join("");
    els.empty.hidden = list.length > 0;
    renderSelected();
  }

  function renderFolders() {
    const tabs = state.customers
      .map((customer, index) => {
        const active = index === state.activeIndex ? "is-active" : "";
        const canRemove = index > 0;
        return `
          <button type="button" class="folder-tab ${active}" data-tab="${index}">
            ${escapeHtml(customerLabel(customer, index))}
            ${canRemove ? `<span class="tab-x" data-remove="${index}" aria-label="Remove">×</span>` : ""}
          </button>
        `;
      })
      .join("");
    const add =
      state.customers.length < MAX_CUSTOMERS
        ? `<button type="button" class="folder-add" data-add-customer>+</button>`
        : "";
    els.folderDock.innerHTML = `<div class="folder-bar">${tabs}${add}</div>`;
    els.folderDock.hidden = false;
  }

  function fillFields() {
    const customer = activeCustomer();
    if (!customer || !els.form) return;
    const show = guestNeedsDetails();
    els.form.hidden = !show;
    if (!show) {
      closeDobPicker();
      if (els.profileNotice) els.profileNotice.hidden = true;
      return;
    }
    els.form.elements.first_name.value = customer.firstName;
    els.form.elements.last_name.value = customer.lastName;
    els.form.elements.mobile.value = customer.mobile;
    els.form.elements.dob.value = customer.dob;
    els.form.elements.gender.value = customer.gender;
    state.dobCursor = defaultDobCursor();
    closeDobPicker();
    if (els.profileTitle) {
      els.profileTitle.textContent = `Details for ${customerLabel(customer, state.activeIndex)}`;
    }
    els.form.querySelectorAll(".field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
    if (els.profileNotice) els.profileNotice.hidden = true;
  }

  function saveFields() {
    const customer = activeCustomer();
    if (!customer || !els.form || isFirst()) return;
    customer.firstName = String(els.form.elements.first_name.value || "").trim();
    customer.lastName = String(els.form.elements.last_name.value || "").trim();
    customer.mobile = String(els.form.elements.mobile.value || "").trim();
    customer.dob = String(els.form.elements.dob.value || "").trim();
    customer.gender = String(els.form.elements.gender.value || "").trim();
  }

  function guestBlockHTML(customer, index, { mine = false } = {}) {
    const lines = customerServices(customer);
    const ready = customerReady(customer, index);
    const lineRows = lines.length
      ? lines
          .map((line) => {
            const totals = lineTotals(line);
            const when =
              line.date && line.time ? `${formatDay(line.date)} · ${line.time}` : "Time not chosen yet";
            const extras = lineAddons(line)
              .map((addon) => addon.name)
              .join(", ");
            return `
          <div class="checkout-line">
            <img src="${line.service.image}" alt="">
            <div>
              <strong>${escapeHtml(line.service.name)}</strong>
              <small>${escapeHtml(line.stylist ? line.stylist.name : "No stylist")} · ${totals.duration} min · ${money(totals.price)}</small>
              <small>${escapeHtml(when)}${extras ? ` · ${escapeHtml(extras)}` : ""}</small>
            </div>
          </div>`;
          })
          .join("")
      : `<p class="pending">No services chosen yet.</p>`;

    return `
      <article class="checkout-card ${mine ? "is-mine" : ""} ${ready ? "" : "is-pending"}">
        <header>
          <div>
            <strong>${escapeHtml(customerLabel(customer, index))}</strong>
            ${mine ? "<em>You</em>" : ""}
          </div>
        </header>
        ${lineRows}
      </article>
    `;
  }

  function renderSummary() {
    const mine = state.activeIndex;
    const mineCard = guestBlockHTML(state.customers[mine], mine, { mine: true });
    const others = state.customers
      .map((customer, index) => ({ customer, index }))
      .filter(({ index }) => index !== mine)
      .map(({ customer, index }) => guestBlockHTML(customer, index))
      .join("");

    const total = bookingTotal();
    const othersBlock = isGroup()
      ? `<h3 class="section-label">Other guests in this booking</h3><div class="checkout-stack">${others}</div>`
      : "";

    els.summary.innerHTML = `
      <h3 class="section-label">Your order</h3>
      <div class="checkout-stack">${mineCard}</div>
      <div class="summary-card" style="margin-top:16px">
        <div class="summary-body" style="padding:18px">
          <div class="meta-list">
            <div><span>Guests</span><strong>${state.customers.length}</strong></div>
            <div><span>Contact</span><strong>${escapeHtml(state.loginContact || state.customers[0].mobile || "—")}</strong></div>
            <div><span>Salon</span><strong>${escapeHtml(data.location.name)}</strong></div>
          </div>
          <div class="total-row">
            <span>Total</span>
            <span>${money(total)}</span>
          </div>
          ${allReady() ? "" : '<p class="pending checkout-note">Payment stays locked until every extra guest has details, and every service has a stylist and a time.</p>'}
        </div>
      </div>
      ${othersBlock}
    `;
  }

  function updateHints() {
    if (els.checkoutHint) {
      els.checkoutHint.textContent = isGroup()
        ? "Review the group order, then continue to payment."
        : "Review this booking, then continue to payment.";
    }
  }

  function placeActions() {
    if (!els.actions) return;
    const panel = document.querySelector(`[data-panel="${state.step}"]`);
    if (!panel) return;

    if (state.step === 1) {
      const lines = customerServices(activeCustomer());
      const ready = lines.length > 0 && lines.every(lineComplete);
      els.actions.hidden = !ready;
      if (els.addServiceBtn && !els.addServiceBtn.hidden) {
        els.addServiceBtn.insertAdjacentElement("afterend", els.actions);
      } else {
        els.selected.insertAdjacentElement("afterend", els.actions);
      }
    } else {
      els.actions.hidden = false;
      panel.appendChild(els.actions);
    }
  }

  function updateStepper() {
    els.steps.forEach((step) => {
      const n = Number(step.dataset.step);
      step.classList.toggle("is-active", n === state.step);
      step.classList.toggle("is-done", n < state.step);
      if (n === state.step) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });

    els.panels.forEach((panel) => {
      panel.classList.toggle("is-visible", Number(panel.dataset.panel) === state.step);
    });

    els.backBtn.hidden = state.step === 1;
    const labels = {
      1: "Book now",
      2: "Pay now"
    };
    els.continueBtn.textContent = labels[state.step];
    els.continueBtn.disabled = !canContinue();
    renderFolders();
    placeActions();
    updateHints();
  }

  function canContinue() {
    const customer = activeCustomer();
    if (state.step === 1) {
      const lines = customerServices(customer);
      const servicesOk = lines.length > 0 && lines.every(lineComplete);
      if (guestNeedsDetails()) return profileComplete(customer) && servicesOk;
      return servicesOk;
    }
    if (state.step === 2) return allReady();
    return true;
  }

  function validateProfile(show) {
    saveFields();
    const customer = activeCustomer();
    const firstOk = String(customer.firstName || "").trim().length >= 2;
    const lastOk = String(customer.lastName || "").trim().length >= 1;
    const mobileOk = String(customer.mobile || "").replace(/\s/g, "").length >= 8;
    const dobOk = Boolean(parseDob(customer.dob));
    const genderOk = Boolean(customer.gender);
    if (show && els.form) {
      els.form.elements.first_name.closest(".field").classList.toggle("is-invalid", !firstOk);
      els.form.elements.last_name.closest(".field").classList.toggle("is-invalid", !lastOk);
      els.form.elements.mobile.closest(".field").classList.toggle("is-invalid", !mobileOk);
      els.form.elements.dob.closest(".field").classList.toggle("is-invalid", !dobOk);
      els.form.elements.gender.closest(".field").classList.toggle("is-invalid", !genderOk);
    }
    return firstOk && lastOk && mobileOk && dobOk && genderOk;
  }

  function askForDetails() {
    validateProfile(true);
    if (els.profileNotice) {
      els.profileNotice.hidden = false;
      els.profileNotice.textContent = "Enter details";
    }
    scrollBookingTop();
    els.form?.classList.add("is-attention");
    window.setTimeout(() => els.form?.classList.remove("is-attention"), 900);
  }

  function setStep(next) {
    saveFields();
    state.step = next;
    if (next === 1) {
      renderServices();
      fillFields();
    }
    if (next === 2) renderSummary();
    updateStepper();
    updateLoginButton();
    scrollBookingTop();
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatCardNumber(value) {
    return digitsOnly(value)
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatDob(value) {
    const digits = digitsOnly(value).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function updateLoginButton() {
    if (!els.headerLogin) return;
    els.headerLogin.textContent = state.loggedIn ? "Logged in" : "Login";
  }

  function openLogin(forCheckout) {
    state.pendingCheckout = Boolean(forCheckout);
    if (els.loginForm) els.loginForm.reset();
    if (els.loginTitle) els.loginTitle.textContent = forCheckout ? "Log in to continue" : "Quick login";
    if (els.loginHint) {
      els.loginHint.textContent = forCheckout
        ? "To continue, you should log in."
        : "Demo only — any phone or email works.";
    }
    els.loginModal.hidden = false;
    els.loginForm?.elements.login_contact.focus();
  }

  function closeLogin() {
    els.loginModal.hidden = true;
    state.pendingCheckout = false;
  }

  function finishLogin() {
    const contact = String(els.loginForm.elements.login_contact.value || "").trim();
    const password = String(els.loginForm.elements.login_password.value || "");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const phoneOk = contact.replace(/\s/g, "").length >= 8;
    const passOk = password.length >= 4;
    els.loginForm.elements.login_contact.closest(".field").classList.toggle("is-invalid", !(emailOk || phoneOk));
    els.loginForm.elements.login_password.closest(".field").classList.toggle("is-invalid", !passOk);
    if (!(emailOk || phoneOk) || !passOk) return;
    state.loggedIn = true;
    state.loginContact = contact;
    els.loginModal.hidden = true;
    updateLoginButton();
    if (state.pendingCheckout) {
      state.pendingCheckout = false;
      setStep(2);
    }
  }

  function requestCheckout() {
    saveFields();
    if (!canContinue()) return;
    if (!state.loggedIn) {
      openLogin(true);
      return;
    }
    setStep(2);
  }

  function formatExpiry(value) {
    const digits = digitsOnly(value).slice(0, 4);
    if (digits.length < 3) return digits;
    return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  }

  function validatePay(show) {
    const name = els.payForm.elements.card_name;
    const number = els.payForm.elements.card_number;
    const expiry = els.payForm.elements.card_expiry;
    const cvc = els.payForm.elements.card_cvc;
    const nameOk = String(name.value || "").trim().length >= 2;
    const numberOk = digitsOnly(number.value).length === 16;
    const expDigits = digitsOnly(expiry.value);
    const month = Number(expDigits.slice(0, 2));
    const year = 2000 + Number(expDigits.slice(2, 4));
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const expiryDate = new Date(year, month - 1, 1);
    const expOk = expDigits.length === 4 && month >= 1 && month <= 12 && expiryDate >= thisMonth;
    const cvcOk = digitsOnly(cvc.value).length >= 3 && digitsOnly(cvc.value).length <= 4;
    if (show) {
      name.closest(".field").classList.toggle("is-invalid", !nameOk);
      number.closest(".field").classList.toggle("is-invalid", !numberOk);
      expiry.closest(".field").classList.toggle("is-invalid", !expOk);
      cvc.closest(".field").classList.toggle("is-invalid", !cvcOk);
    }
    return nameOk && numberOk && expOk && cvcOk;
  }

  function openPayment() {
    saveFields();
    if (!allReady()) return;
    const total = money(bookingTotal());
    els.payAmount.textContent = total;
    els.payBtn.textContent = `Pay ${total}`;
    els.bookingMain.hidden = true;
    els.payment.hidden = false;
    els.success.hidden = true;
    scrollBookingTop();
  }

  function closePayment() {
    els.payment.hidden = true;
    els.success.hidden = true;
    els.bookingMain.hidden = false;
    setStep(2);
  }

  function selectService(id) {
    saveFields();
    if (guestNeedsDetails() && !profileComplete(activeCustomer())) {
      askForDetails();
      return;
    }
    const customer = activeCustomer();
    if (customer.services.some((line) => line.serviceId === id)) return;
    if (customer.services.length && !canAddAnother(customer) && !customer.adding) return;
    const line = newLine(id);
    customer.services.push(line);
    customer.adding = false;
    state.openUid = line.uid;
    renderServices();
    updateStepper();
    scrollBookingTop();
  }

  function removeLine(uid) {
    const customer = activeCustomer();
    customer.services = customer.services.filter((line) => line.uid !== uid);
    if (!customer.services.length) customer.adding = true;
    if (state.openUid === uid) state.openUid = null;
    renderServices();
    updateStepper();
  }

  function findLine(uid) {
    return activeCustomer().services.find((item) => item.uid === uid);
  }

  function setStylist(uid, stylistId) {
    const line = findLine(uid);
    if (!line) return;
    line.stylistId = stylistId;
    state.openUid = uid;
    renderSelected();
    updateStepper();
  }

  function toggleAddon(uid, addonId) {
    const line = findLine(uid);
    if (!line) return;
    const current = new Set(line.addonIds || []);
    if (current.has(addonId)) current.delete(addonId);
    else current.add(addonId);
    line.addonIds = [...current];
    state.openUid = uid;
    renderSelected();
    updateStepper();
  }

  function setLineDay(uid, iso) {
    const line = findLine(uid);
    if (!line) return;
    line.date = fromLocalISO(iso);
    line.time = null;
    state.openUid = uid;
    renderSelected();
    updateStepper();
  }

  function setLineTime(uid, time) {
    const line = findLine(uid);
    if (!line) return;
    line.time = time;
    state.openUid = uid;
    renderSelected();
    updateStepper();
  }

  function addCustomer() {
    if (state.customers.length >= MAX_CUSTOMERS) return;
    saveFields();
    state.customers.push(newCustomer(state.customers.length + 1));
    state.activeIndex = state.customers.length - 1;
    state.step = 1;
    state.openUid = null;
    fillFields();
    renderServices();
    updateStepper();
    if (els.profileNotice) {
      els.profileNotice.hidden = false;
      els.profileNotice.textContent = "Enter details";
    }
    scrollBookingTop();
  }

  function removeCustomer(index) {
    if (index === 0 || state.customers.length === 1) return;
    saveFields();
    state.customers.splice(index, 1);
    state.activeIndex = Math.min(state.activeIndex, state.customers.length - 1);
    state.openUid = null;
    fillFields();
    renderServices();
    if (state.step === 2) renderSummary();
    updateStepper();
  }

  function switchCustomer(index) {
    saveFields();
    state.activeIndex = index;
    state.openUid = null;
    fillFields();
    renderServices();
    if (state.step === 2) renderSummary();
    updateStepper();
  }

  function confirmBooking() {
    saveFields();
    const payload = {
      location_id: data.location.id,
      party: isGroup() ? "group" : "solo",
      parent_name: fullName(state.customers[0]) || state.loginContact,
      parent_email: state.loginContact,
      parent_phone: state.customers[0].mobile,
      guests: state.customers.map((customer, index) => ({
        label: customerLabel(customer, index),
        is_parent: index === 0,
        first_name: customer.firstName,
        last_name: customer.lastName,
        name: fullName(customer),
        mobile: customer.mobile,
        dob: customer.dob,
        gender: customer.gender,
        services: customerServices(customer).map((line) => {
          const totals = lineTotals(line);
          return {
            service_id: line.serviceId,
            service_name: line.service.name,
            duration: totals.duration,
            price: totals.price,
            stylist_id: line.stylistId,
            stylist_name: line.stylist ? line.stylist.name : "",
            addons: lineAddons(line).map((addon) => ({
              id: addon.id,
              name: addon.name,
              price: addon.price,
              duration: addon.duration
            })),
            appointment_date: line.date ? toLocalISO(line.date) : null,
            appointment_time: line.time
          };
        })
      }))
    };

    localStorage.setItem("dreamcuts_booking", JSON.stringify(payload));
    els.bookingMain.hidden = true;
    els.payment.hidden = true;
    els.success.hidden = false;
    scrollBookingTop();
    const names = payload.guests.map((guest) => guest.name).join(payload.guests.length === 2 ? " and " : ", ");
    const count = payload.guests.reduce((sum, guest) => sum + guest.services.length, 0);
    document.querySelector("#successWho").textContent = `${names} ${payload.guests.length > 1 ? "are" : "is"}`;
    document.querySelector("#successService").textContent =
      count === 1 ? payload.guests[0].services[0].service_name : `${count} services`;
    const firstLine = state.customers[0] && customerServices(state.customers[0])[0];
    document.querySelector("#successWhen").textContent =
      firstLine && firstLine.date && firstLine.time
        ? `${formatDay(firstLine.date)} at ${firstLine.time}`
        : "See checkout for each service time";
  }

  function resetBooking() {
    state.step = 1;
    state.customers = [newCustomer(1)];
    state.activeIndex = 0;
    state.openUid = null;
    state.pendingCheckout = false;
    els.form.reset();
    els.payForm.reset();
    els.loginForm?.reset();
    fillFields();
    els.bookingMain.hidden = false;
    els.payment.hidden = true;
    els.success.hidden = true;
    renderServices();
    updateStepper();
    scrollBookingTop();
  }

  function bind() {
    els.chips.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cat]");
      if (!btn) return;
      state.category = btn.dataset.cat;
      renderChips();
      renderServices();
    });

    els.search.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderServices();
    });

    els.addServiceBtn.addEventListener("click", () => {
      activeCustomer().adding = true;
      state.openUid = null;
      renderServices();
    });

    document.addEventListener("click", (event) => {
      const dobDay = event.target.closest("[data-dob-day]");
      if (dobDay) {
        setDobDay(dobDay.dataset.dobDay);
        return;
      }
      const dobCal = event.target.closest("[data-dob-cal]");
      if (dobCal) {
        shiftDobMonth(Number(dobCal.dataset.dobCal));
        return;
      }
      if (event.target.closest("#dobToggle")) {
        toggleDobPicker();
        return;
      }
      if (event.target.closest("#dob")) {
        if (!state.dobOpen) openDobPicker();
        return;
      }
      if (state.dobOpen && !event.target.closest(".dob-field")) closeDobPicker();

      const add = event.target.closest("[data-add-customer]");
      if (add) {
        addCustomer();
        return;
      }
      const remove = event.target.closest("[data-remove]");
      if (remove) {
        event.preventDefault();
        event.stopPropagation();
        removeCustomer(Number(remove.dataset.remove));
        return;
      }
      const tab = event.target.closest("[data-tab]");
      if (tab) {
        switchCustomer(Number(tab.dataset.tab));
        return;
      }
      const dropLine = event.target.closest("[data-remove-line]");
      if (dropLine) {
        event.preventDefault();
        event.stopPropagation();
        removeLine(dropLine.dataset.removeLine);
        return;
      }
      const addon = event.target.closest("[data-addon]");
      if (addon) {
        toggleAddon(addon.dataset.addon, addon.dataset.addonId);
        return;
      }
      const pick = event.target.closest("[data-pick-stylist]");
      if (pick) {
        setStylist(pick.dataset.pickStylist, pick.dataset.stylistId);
        return;
      }
      const cal = event.target.closest("[data-cal]");
      if (cal) {
        state.monthCursor = new Date(
          state.monthCursor.getFullYear(),
          state.monthCursor.getMonth() + Number(cal.dataset.cal),
          1
        );
        renderSelected();
        return;
      }
      const day = event.target.closest("[data-line-day]");
      if (day) {
        setLineDay(day.dataset.lineDay, day.dataset.day);
        return;
      }
      const time = event.target.closest("[data-line-time]");
      if (time) {
        setLineTime(time.dataset.lineTime, time.dataset.time);
        return;
      }
      const toggle = event.target.closest("[data-toggle-line]");
      if (toggle) {
        const uid = toggle.dataset.toggleLine;
        state.openUid = state.openUid === uid ? null : uid;
        renderSelected();
        updateStepper();
        return;
      }
      const select = event.target.closest("[data-select]");
      if (select) {
        selectService(select.dataset.select);
        return;
      }
      const card = event.target.closest("[data-service]");
      if (card) selectService(card.dataset.service);
    });

    els.dobPicker?.addEventListener("change", (event) => {
      const month = event.target.closest("select[name='dob_month']");
      const year = event.target.closest("select[name='dob_year']");
      if (month) {
        state.dobCursor = new Date(state.dobCursor.getFullYear(), Number(month.value), 1);
        renderDobPicker();
        return;
      }
      if (year) {
        state.dobCursor = new Date(Number(year.value), state.dobCursor.getMonth(), 1);
        renderDobPicker();
      }
    });

    els.form.addEventListener("input", (event) => {
      if (event.target.name === "dob") {
        event.target.value = formatDob(event.target.value);
        const parsed = parseDob(event.target.value);
        if (parsed) {
          state.dobCursor = startOfMonth(parsed);
          if (state.dobOpen) renderDobPicker();
        }
      }
      saveFields();
      if (els.profileNotice && profileComplete(activeCustomer())) els.profileNotice.hidden = true;
      renderFolders();
      els.continueBtn.disabled = !canContinue();
    });

    els.form.addEventListener("change", () => {
      saveFields();
      renderFolders();
      els.continueBtn.disabled = !canContinue();
    });

    els.continueBtn.addEventListener("click", () => {
      if (state.step === 1) {
        requestCheckout();
        return;
      }
      if (state.step === 2) {
        openPayment();
      }
    });

    els.backBtn.addEventListener("click", () => {
      setStep(Math.max(1, state.step - 1));
    });

    els.payBack.addEventListener("click", closePayment);

    els.payForm.elements.card_number.addEventListener("input", (event) => {
      event.target.value = formatCardNumber(event.target.value);
    });

    els.payForm.elements.card_expiry.addEventListener("input", (event) => {
      event.target.value = formatExpiry(event.target.value);
    });

    els.payForm.elements.card_cvc.addEventListener("input", (event) => {
      event.target.value = digitsOnly(event.target.value).slice(0, 4);
    });

    els.payForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!allReady() || !validatePay(true)) return;
      confirmBooking();
    });

    els.headerLogin?.addEventListener("click", () => openLogin(false));
    els.loginClose?.addEventListener("click", closeLogin);
    els.loginModal?.addEventListener("click", (event) => {
      if (event.target === els.loginModal) closeLogin();
    });
    els.loginForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      finishLogin();
    });

    document.querySelector("#bookAgain")?.addEventListener("click", resetBooking);
  }

  function initHours() {
    const list = document.querySelector("#hoursList");
    if (!list) return;
    list.innerHTML = data.location.hours
      .map((row) => `<li>${row.days}<span>${row.time}</span></li>`)
      .join("");
  }

  renderChips();
  renderServices();
  fillFields();
  updateStepper();
  updateLoginButton();
  initHours();
  bind();
  window.scrollTo(0, 0);
})();
