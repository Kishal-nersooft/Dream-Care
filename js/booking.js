// Dream Cuts — booking flow (mobile-first, iOS-style).
// Same flow and rules as the original app.js: guests → services (add-ons, stylist, date, time)
// → login → checkout → payment → confirmation.
(function () {
  const data = window.DREAMCUTS;
  const MAX_CUSTOMERS = 6;
  const DAYS_AHEAD = 60;
  const VIEWS = ["services", "checkout", "payment", "success"];
  const TITLES = {
    services: ["Book a visit", "Dream Cuts · Westfield Marion"],
    checkout: ["Checkout", "Check everything looks right"],
    payment: ["Payment", "Secure card payment"],
    success: ["All done!", "See you soon at Dream Cuts"]
  };

  const $ = (s) => document.querySelector(s);
  const els = {
    guestBar: $("#guestBar"),
    guestAdd: $("#guestAdd"),
    guestForm: $("#guestForm"),
    guestFormTitle: $("#guestFormTitle"),
    guestFormBadge: $("#guestFormBadge"),
    genderSeg: $("#genderSeg"),
    basket: $("#basket"),
    catalogTitle: $("#catalogTitle"),
    search: $("#search"),
    chips: $("#chips"),
    popularWrap: $("#popularWrap"),
    popular: $("#popular"),
    list: $("#serviceList"),
    allTitle: $("#allTitle"),
    empty: $("#emptyState"),
    checkout: $("#checkout"),
    payForm: $("#payForm"),
    payBtn: $("#payBtn"),
    payError: $("#payError"),
    ccNum: $("#ccNum"),
    ccName: $("#ccName"),
    ccExp: $("#ccExp"),
    successText: $("#successText"),
    successList: $("#successList"),
    side: $("#sideCard"),
    bar: $("#bar"),
    barInfo: $("#barInfo"),
    barCount: $("#barCount"),
    barTotal: $("#barTotal"),
    barBtn: $("#barBtn"),
    sheet: $("#sheet"),
    sheetInner: $("#sheetInner"),
    sheetGrab: $("#sheetGrab"),
    backdrop: $("#sheetBackdrop"),
    toast: $("#toast"),
    viewBack: $("#viewBack"),
    viewTitle: $("#viewTitle"),
    viewSub: $("#viewSub"),
    loginBtn: $("#loginBtn")
  };

  // Login is shared with profile.html through localStorage (demo only).
  const AUTH_KEY = "dreamcuts_auth";
  const savedAuth = (() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch (err) { return null; }
  })();

  const state = {
    view: "services",
    customers: [newCustomer(1)],
    active: 0,
    category: "all",
    query: "",
    loggedIn: Boolean(savedAuth && savedAuth.contact),
    loginContact: (savedAuth && savedAuth.contact) || "",
    pendingCheckout: false,
    sheet: null, // { type: "line", uid, isNew, fromCart } | { type: "login" } | { type: "cart" }
    done: false,
    lastTotal: 0
  };

  /* ---------------- helpers ---------------- */
  function newCustomer(n) {
    return { id: `c-${Date.now()}-${n}`, firstName: "", lastName: "", mobile: "", dob: "", gender: "", services: [] };
  }
  function newLine(serviceId) {
    return { uid: `l-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, serviceId, stylistId: "", addonIds: [], date: null, time: null };
  }
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (v, from) => {
    const f = Number(v).toLocaleString("en-AU", { style: "currency", currency: "AUD" });
    return from ? `From ${f}` : f;
  };
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromISO = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const fmtDay = (d) => d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  const fmtDayLong = (d) => d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  function fmtTime(hours) {
    const d = new Date();
    d.setHours(Math.floor(hours), Math.round((hours % 1) * 60), 0, 0);
    return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }

  const serviceById = (id) => data.services.find((s) => s.id === id);
  const stylistById = (id) => (data.stylists || []).find((s) => s.id === id) || null;
  const addonById = (id) => (data.addons || []).find((a) => a.id === id);
  const active = () => state.customers[state.active];
  const isGroup = () => state.customers.length > 1;
  const needsDetails = (i = state.active) => i > 0;
  const fullName = (c) => `${c.firstName || ""} ${c.lastName || ""}`.trim();

  function label(c, i) {
    const n = fullName(c);
    if (n) return n;
    if (i === 0 && state.loginContact) return state.loginContact;
    return i === 0 ? "Customer 1" : `Customer ${i + 1}`;
  }
  function initial(c, i) {
    const n = fullName(c);
    return n ? n[0].toUpperCase() : String(i + 1);
  }

  function allowsAddons(s) {
    return s && !s.noAddons && ["little", "girls", "boys", "styling"].includes(s.category);
  }
  function fromAmount(s) {
    if (s.fromAmount != null) return s.fromAmount;
    if (s.fromPrice) return Math.round(s.price * 90) / 100;
    return s.price;
  }
  function quoteFor(s, stylistId) {
    const from = fromAmount(s);
    const st = stylistById(stylistId);
    if (!st) return { price: from, duration: s.duration, from: from < s.price };
    const usesFrom = Boolean(st.any || st.fromTier);
    return {
      price: usesFrom ? from : s.price,
      duration: s.duration + Number(st.extraMinutes || 0),
      from: Boolean(st.any && from < s.price)
    };
  }
  const lineAddons = (l) => (l.addonIds || []).map(addonById).filter(Boolean);
  function lineTotals(l) {
    const s = serviceById(l.serviceId);
    const q = quoteFor(s, l.stylistId);
    const ex = lineAddons(l);
    return {
      price: q.price + ex.reduce((n, a) => n + a.price, 0),
      duration: q.duration + ex.reduce((n, a) => n + a.duration, 0),
      from: q.from && !l.stylistId
    };
  }
  const lineComplete = (l) => Boolean(l.stylistId && l.date && l.time);
  const lines = (c) => (c.services || []).filter((l) => serviceById(l.serviceId));

  function dobValid(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return false;
    const d = fromISO(v);
    const today = new Date();
    return d.getFullYear() >= 1990 && d <= today;
  }
  function profileIssues(c) {
    const bad = [];
    if (String(c.firstName).trim().length < 2) bad.push("first_name");
    if (String(c.lastName).trim().length < 1) bad.push("last_name");
    if (digits(c.mobile).length < 8) bad.push("mobile");
    if (!dobValid(c.dob)) bad.push("dob");
    if (!c.gender) bad.push("gender");
    return bad;
  }
  const profileComplete = (c) => profileIssues(c).length === 0;
  function customerReady(c, i) {
    const ls = lines(c);
    const ok = ls.length > 0 && ls.every(lineComplete);
    return needsDetails(i) ? ok && profileComplete(c) : ok;
  }
  const allReady = () => state.customers.every(customerReady);
  const total = () => state.customers.reduce((n, c) => n + lines(c).reduce((m, l) => m + lineTotals(l).price, 0), 0);
  const serviceCount = () => state.customers.reduce((n, c) => n + lines(c).length, 0);

  // What blocks the Continue button on the services view (null = good to go)
  function servicesBlocker() {
    const c = active();
    if (needsDetails() && !profileComplete(c)) return `Add details for ${label(c, state.active)}`;
    const ls = lines(c);
    if (!ls.length) return "Choose a service to continue";
    const open = ls.find((l) => !lineComplete(l));
    if (open) return `Finish setting up ${serviceById(open.serviceId).name}`;
    return null;
  }

  /* ---------------- opening hours / slots ---------------- */
  function openingFor(date) {
    return { 0: [10, 17], 1: [9, 17.5], 2: [9, 17.5], 3: [9, 17.5], 4: [9, 19], 5: [9, 17.5], 6: [9, 17] }[date.getDay()];
  }
  function slotSeed(date) {
    const key = date.toDateString();
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h + key.charCodeAt(i) * 17) % 97;
    return h;
  }
  function slotsFor(line) {
    const [open, close] = openingFor(line.date);
    const dur = lineTotals(line).duration / 60;
    const seed = slotSeed(line.date);
    const now = new Date();
    const isToday = sameDay(line.date, now);
    const nowH = now.getHours() + now.getMinutes() / 60;
    const out = [];
    for (let t = open; t + dur <= close - 0.25; t += 0.5) {
      const busy = (Math.floor(t * 2) + seed) % 5 === 0 || (isToday && t <= nowH + 0.25);
      out.push({ t, label: fmtTime(t), busy });
    }
    return out;
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("is-on"), 2200);
  }

  /* ---------------- render: guests ---------------- */
  function renderGuests() {
    const pills = state.customers
      .map((c, i) => {
        const on = i === state.active;
        const ready = customerReady(c, i);
        return `<button type="button" role="tab" aria-selected="${on}" class="guest-pill ${on ? "is-active" : ""}" data-guest="${i}">
          <span class="av">${esc(initial(c, i))}</span>${esc(label(c, i))}
          ${ready ? '<i class="bi bi-check-circle-fill ok"></i>' : ""}
          ${i > 0 ? `<span class="x" data-remove-guest="${i}" aria-label="Remove guest"><i class="bi bi-x"></i></span>` : ""}
        </button>`;
      })
      .join("");
    const full = state.customers.length >= MAX_CUSTOMERS;
    els.guestBar.innerHTML = pills;
    els.guestAdd.disabled = full;
  }

  function fillGuestForm() {
    const show = needsDetails();
    els.guestForm.hidden = !show;
    if (!show) return;
    const c = active();
    const f = els.guestForm.elements;
    f.first_name.value = c.firstName;
    f.last_name.value = c.lastName;
    f.mobile.value = c.mobile;
    f.dob.value = c.dob;
    f.dob.max = toISO(new Date());
    els.guestFormTitle.textContent = `Details for ${label(c, state.active)}`;
    els.guestForm.querySelectorAll(".is-invalid").forEach((r) => r.classList.remove("is-invalid"));
    paintGender();
    paintGuestBadge();
  }
  function paintGender() {
    const g = active().gender;
    const btns = [...els.genderSeg.querySelectorAll("[data-gender]")];
    const idx = btns.findIndex((b) => b.dataset.gender === g);
    btns.forEach((b, i) => b.setAttribute("aria-checked", String(i === idx)));
    const thumb = els.genderSeg.querySelector(".seg-thumb");
    thumb.style.width = `calc((100% - 4px) / ${btns.length})`;
    thumb.style.opacity = idx < 0 ? "0" : "1";
    thumb.style.transform = `translateX(${Math.max(idx, 0) * 100}%)`;
  }
  function paintGuestBadge() {
    const ok = profileComplete(active());
    els.guestFormBadge.textContent = ok ? "Complete" : "Required";
    els.guestFormBadge.classList.toggle("ok", ok);
  }
  function saveGuestForm() {
    if (!needsDetails()) return;
    const c = active();
    const f = els.guestForm.elements;
    c.firstName = f.first_name.value.trim();
    c.lastName = f.last_name.value.trim();
    c.mobile = f.mobile.value.trim();
    c.dob = f.dob.value;
  }
  function flagGuestForm() {
    const bad = profileIssues(active());
    els.guestForm.querySelectorAll(".ios-row").forEach((row) => {
      const input = row.querySelector("input");
      const key = input ? input.name : row.classList.contains("ios-row-seg") ? "gender" : "";
      row.classList.toggle("is-invalid", bad.includes(key));
    });
  }
  function askForDetails() {
    flagGuestForm();
    els.guestForm.classList.remove("shake");
    void els.guestForm.offsetWidth;
    els.guestForm.classList.add("shake");
    els.guestForm.scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`Add details for ${label(active(), state.active)} first`);
  }

  /* ---------------- render: basket + catalog ---------------- */
  function renderBasket() {
    const ls = lines(active());
    if (!ls.length) {
      els.basket.innerHTML = "";
      return;
    }
    els.basket.innerHTML =
      `<div class="basket-head"><h2>${isGroup() ? `${esc(label(active(), state.active))}’s services` : "Your services"}</h2></div>` +
      ls
        .map((l) => {
          const s = serviceById(l.serviceId);
          const st = stylistById(l.stylistId);
          const t = lineTotals(l);
          const ok = lineComplete(l);
          const status = ok
            ? `<small class="done"><i class="bi bi-check-circle-fill"></i> ${esc(st.name)} · ${fmtDay(l.date)}, ${esc(l.time)}</small>`
            : `<small class="warn"><i class="bi bi-exclamation-circle"></i> Tap to ${!l.stylistId ? "choose a stylist" : !l.date ? "pick a date" : "pick a time"}</small>`;
          const extras = lineAddons(l).map((a) => a.name).join(" · ");
          return `<div class="line-card ${ok ? "" : "is-incomplete"}" data-edit-line="${l.uid}" role="button" tabindex="0">
            <img src="${(st && st.image) || s.image}" alt="">
            <div><strong>${esc(s.name)}</strong><small>${t.duration} min${extras ? ` · ${esc(extras)}` : ""}</small>${status}</div>
            <div class="line-side"><span class="line-price">${money(t.price, t.from)}</span>
              <button type="button" class="line-del" data-remove-line="${l.uid}" aria-label="Remove ${esc(s.name)}"><i class="bi bi-trash3"></i></button></div>
          </div>`;
        })
        .join("");
  }

  function renderChips() {
    els.chips.innerHTML = data.categories
      .map((c) => `<button type="button" role="tab" class="cat-chip ${state.category === c.id ? "is-active" : ""}" data-cat="${c.id}">${esc(c.label)}</button>`)
      .join("");
  }

  function priceLabel(s) {
    const from = fromAmount(s) < s.price;
    return money(from ? fromAmount(s) : s.price, from);
  }

  function renderCatalog() {
    const taken = new Set(active().services.map((l) => l.serviceId));
    const q = state.query.trim().toLowerCase();
    const filtering = q || state.category !== "all";

    els.catalogTitle.textContent = lines(active()).length ? "Add another service" : "Choose a service";

    const pop = data.services.filter((s) => s.popular && !taken.has(s.id));
    els.popularWrap.hidden = filtering || !pop.length;
    els.popular.innerHTML = pop
      .map(
        (s) => `<button type="button" class="pop-card" data-pick="${s.id}">
          <img src="${s.image}" alt=""><span class="pc-time">${s.duration} min</span>
          <div class="pc-body"><strong>${esc(s.name)}</strong>
            <div class="pc-foot"><span class="pc-price">${priceLabel(s)}</span><span class="add-dot"><i class="bi bi-plus"></i></span></div></div>
        </button>`
      )
      .join("");

    const list = data.services.filter((s) => {
      const inCat = state.category === "all" || s.category === state.category;
      const inQ = !q || s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q);
      return inCat && inQ && !taken.has(s.id);
    });
    els.allTitle.textContent = filtering ? `${list.length} result${list.length === 1 ? "" : "s"}` : "All services";
    els.list.innerHTML = list
      .map(
        (s) => `<button type="button" class="svc-row" data-pick="${s.id}">
          <img src="${s.image}" alt="" loading="lazy">
          <span><strong>${esc(s.name)}</strong><p>${esc(s.blurb)}</p><span class="meta"><b>${priceLabel(s)}</b> · ${s.duration} min</span></span>
          <span class="add-dot"><i class="bi bi-plus"></i></span>
        </button>`
      )
      .join("");
    els.empty.hidden = list.length > 0;
  }

  /* ---------------- render: summary (bar + side) ---------------- */
  function primaryAction() {
    if (state.view === "services") {
      const blocker = servicesBlocker();
      return { text: "Continue", blocked: blocker, run: requestCheckout };
    }
    if (state.view === "checkout") {
      return { text: `Pay ${money(total())}`, blocked: allReady() ? null : "Every guest needs details and every service needs a time", run: () => go("payment") };
    }
    return null;
  }

  function renderSummary() {
    const t = total();
    const n = serviceCount();
    const action = primaryAction();

    // Mobile bar
    els.bar.classList.toggle("is-hidden", !action || state.sheet);
    if (action) {
      els.barCount.textContent = n ? `${n} service${n > 1 ? "s" : ""}${isGroup() ? ` · ${state.customers.length} guests` : ""}` : "No services yet";
      els.barTotal.textContent = money(t);
      const canOpenCart = state.view === "services" && n > 0;
      els.barInfo.disabled = !canOpenCart;
      els.barInfo.classList.toggle("can-open", canOpenCart);
      els.barBtn.textContent = action.text;
      els.barBtn.disabled = false;
      els.barBtn.style.opacity = action.blocked ? ".45" : "";
      els.barBtn.setAttribute("aria-disabled", String(Boolean(action.blocked)));
      if (t !== state.lastTotal) {
        els.barTotal.classList.remove("bump");
        void els.barTotal.offsetWidth;
        els.barTotal.classList.add("bump");
      }
    }
    state.lastTotal = t;

    // Desktop side card
    const guests = state.customers
      .map((c, i) => {
        const ls = lines(c);
        const rows = ls.length
          ? ls
              .map((l) => {
                const s = serviceById(l.serviceId);
                const when = l.date && l.time ? `${fmtDay(l.date)} · ${l.time}` : "Time not set";
                return `<div class="side-line"><div>${esc(s.name)}<br><span>${esc(when)}</span></div><b>${money(lineTotals(l).price)}</b></div>`;
              })
              .join("")
          : `<p class="side-empty">No services yet</p>`;
        return `<div class="side-guest"><strong>${esc(label(c, i))} ${customerReady(c, i) ? '<i class="bi bi-check-circle-fill"></i>' : ""}</strong>${rows}</div>`;
      })
      .join("");
    els.side.innerHTML = `
      <h2>Your booking</h2>
      <p class="muted"><i class="bi bi-geo-alt"></i> ${esc(data.location.name)}</p>
      ${guests}
      <div class="side-total"><span>Total</span><strong>${money(t)}</strong></div>
      ${action ? `<button type="button" class="ios-btn primary block" data-primary style="${action.blocked ? "opacity:.45" : ""}">${esc(action.text)}</button>` : ""}
      ${action && action.blocked ? `<p class="side-note"><i class="bi bi-info-circle"></i>${esc(action.blocked)}</p>` : ""}
    `;
  }

  function runPrimary() {
    const a = primaryAction();
    if (!a) return;
    if (a.blocked) {
      toast(a.blocked);
      if (state.view === "services" && needsDetails() && !profileComplete(active())) askForDetails();
      else if (state.view === "services") {
        const open = lines(active()).find((l) => !lineComplete(l));
        if (open) openLineSheet(open.uid, false);
      }
      return;
    }
    a.run();
  }

  function renderServicesView() {
    renderGuests();
    renderBasket();
    renderCatalog();
    renderSummary();
  }

  /* ---------------- views + navigation ---------------- */
  function go(view, { back = false, fromHistory = false } = {}) {
    const prev = state.view;
    if (prev === view) return;
    state.view = view;
    document.querySelectorAll(".bk-view").forEach((v) => {
      const on = v.dataset.view === view;
      v.hidden = !on;
      v.classList.remove("push-in", "pop-in");
      if (on) {
        void v.offsetWidth;
        v.classList.add(back ? "pop-in" : "push-in");
      }
    });
    const [title, sub] = TITLES[view];
    els.viewTitle.textContent = title;
    els.viewSub.textContent = sub;
    els.viewBack.hidden = view === "success";
    const idx = VIEWS.indexOf(view);
    document.querySelectorAll("[data-prog]").forEach((li) => {
      const i = VIEWS.indexOf(li.dataset.prog);
      li.classList.toggle("is-done", i < idx || view === "success");
      li.classList.toggle("is-current", i === idx);
    });

    if (view === "services") renderServicesView();
    if (view === "checkout") renderCheckout();
    if (view === "payment") preparePayment();
    renderSummary();

    if (!fromHistory) {
      if (view === "success" || back) history.replaceState({ view }, "");
      else history.pushState({ view }, "");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (state.view === "payment") go("checkout", { back: true });
    else if (state.view === "checkout") go("services", { back: true });
  }

  /* ---------------- service selection + sheet ---------------- */
  function pickService(id) {
    saveGuestForm();
    if (needsDetails() && !profileComplete(active())) {
      askForDetails();
      return;
    }
    const c = active();
    if (c.services.some((l) => l.serviceId === id)) return;
    const line = newLine(id);
    c.services.push(line);
    openLineSheet(line.uid, true);
    renderServicesView();
  }

  function findLine(uid) {
    return active().services.find((l) => l.uid === uid);
  }

  function removeLine(uid) {
    const c = active();
    const l = findLine(uid);
    c.services = c.services.filter((x) => x.uid !== uid);
    renderServicesView();
    if (l) toast(`Removed ${serviceById(l.serviceId).name}`);
  }

  function openSheet(spec) {
    state.sheet = spec;
    renderSheet();
    els.sheet.hidden = false;
    els.backdrop.hidden = false;
    document.body.classList.add("sheet-open");
    void els.sheet.offsetWidth;
    requestAnimationFrame(() => {
      els.sheet.classList.add("is-open");
      els.backdrop.classList.add("is-open");
    });
    els.sheetInner.scrollTop = 0;
    renderSummary();
  }

  function closeSheet() {
    const spec = state.sheet;
    if (!spec) return;
    if (spec.type === "line") {
      const l = findLine(spec.uid);
      if (l && spec.isNew && !lineComplete(l)) {
        active().services = active().services.filter((x) => x.uid !== l.uid);
      } else if (l && !lineComplete(l)) {
        toast(`${serviceById(l.serviceId).name} still needs a ${!l.stylistId ? "stylist" : !l.date ? "date" : "time"}`);
      }
    }
    if (spec.type === "login") state.pendingCheckout = false;
    if (spec.type === "line" && spec.fromCart && serviceCount() > 0 && state.view === "services") {
      openSheet({ type: "cart" });
      return;
    }
    state.sheet = null;
    els.sheet.classList.remove("is-open");
    els.backdrop.classList.remove("is-open");
    els.sheet.style.transform = "";
    document.body.classList.remove("sheet-open");
    setTimeout(() => {
      if (!state.sheet) {
        els.sheet.hidden = true;
        els.backdrop.hidden = true;
      }
    }, 450);
    if (state.view === "services") renderServicesView();
    else if (state.view === "checkout") renderCheckout();
    renderSummary();
  }

  function openLineSheet(uid, isNew, fromCart = false) {
    openSheet({ type: "line", uid, isNew, fromCart });
  }

  /* ---------------- cart sheet (mobile) ---------------- */
  function openCart() {
    if (state.view !== "services" || !serviceCount()) return;
    saveGuestForm();
    openSheet({ type: "cart" });
  }

  function renderCartSheet() {
    const t = total();
    const n = serviceCount();
    const action = primaryAction();
    const groups = state.customers
      .map((c, i) => {
        const ls = lines(c);
        if (!ls.length) return "";
        const rows = ls
          .map((l) => {
            const s = serviceById(l.serviceId);
            const st = stylistById(l.stylistId);
            const lt = lineTotals(l);
            const ok = lineComplete(l);
            const extras = lineAddons(l).map((a) => a.name).join(" · ");
            const status = ok
              ? `<small class="done"><i class="bi bi-check-circle-fill"></i> ${esc(st.name)} · ${fmtDay(l.date)}, ${esc(l.time)}</small>`
              : `<small class="warn"><i class="bi bi-exclamation-circle"></i> Tap to ${!l.stylistId ? "choose a stylist" : !l.date ? "pick a date" : "pick a time"}</small>`;
            return `<div class="cart-row ${ok ? "" : "is-incomplete"}" data-cart-edit="${i}:${l.uid}" role="button" tabindex="0">
              <img src="${(st && st.image) || s.image}" alt="">
              <div class="cart-txt"><strong>${esc(s.name)}</strong><small>${lt.duration} mins${extras ? ` · ${esc(extras)}` : ""}</small>${status}</div>
              <div class="cart-side"><span class="cart-price">${money(lt.price, lt.from)}</span>
                <button type="button" class="line-del" data-cart-remove="${i}:${l.uid}" aria-label="Remove ${esc(s.name)}"><i class="bi bi-trash3"></i></button></div>
            </div>`;
          })
          .join("");
        const head = isGroup() ? `<h3 class="cart-guest">${esc(label(c, i))} ${customerReady(c, i) ? '<i class="bi bi-check-circle-fill"></i>' : ""}</h3>` : "";
        return `<section class="cart-group">${head}<div class="cart-list">${rows}</div></section>`;
      })
      .join("");

    els.sheetInner.innerHTML = `
      <header class="cart-head">
        <div><h2 id="sheetTitle">Your services</h2><small>${n} service${n > 1 ? "s" : ""}${isGroup() ? ` · ${state.customers.length} guests` : ""}</small></div>
        <button type="button" class="sh-close" data-close-sheet aria-label="Close"><i class="bi bi-x-lg"></i></button>
      </header>
      ${groups}
      ${action && action.blocked ? `<p class="sh-hint cart-note"><i class="bi bi-info-circle"></i> ${esc(action.blocked)}</p>` : ""}
      <div class="sh-foot">
        <button type="button" class="ios-btn" data-close-sheet>Add more</button>
        <button type="button" class="ios-btn primary" data-cart-continue style="${action && action.blocked ? "opacity:.45" : ""}">Continue · ${money(t)}</button>
      </div>`;
  }

  function cartRef(v) {
    const [i, uid] = v.split(":");
    return { i: Number(i), uid };
  }

  function cartClick(e) {
    const rm = e.target.closest("[data-cart-remove]");
    if (rm) {
      const { i, uid } = cartRef(rm.dataset.cartRemove);
      const c = state.customers[i];
      const l = c && c.services.find((x) => x.uid === uid);
      if (!l) return;
      c.services = c.services.filter((x) => x.uid !== uid);
      toast(`Removed ${serviceById(l.serviceId).name}`);
      renderServicesView();
      if (!serviceCount()) return closeSheet();
      return renderCartSheet();
    }
    const edit = e.target.closest("[data-cart-edit]");
    if (edit) {
      const { i, uid } = cartRef(edit.dataset.cartEdit);
      if (i !== state.active) switchGuest(i);
      return openLineSheet(uid, false, true);
    }
    if (e.target.closest("[data-cart-continue]")) {
      const a = primaryAction();
      // Going straight to checkout → slide the cart away first.
      // Otherwise the login / service sheet simply replaces the cart in place.
      if (a && !a.blocked && state.loggedIn) closeSheet();
      return runPrimary();
    }
  }

  function renderSheet(scrollTo) {
    const spec = state.sheet;
    if (!spec) return;
    if (spec.type === "login") {
      renderLoginSheet();
      return;
    }
    if (spec.type === "cart") {
      renderCartSheet();
      return;
    }
    const l = findLine(spec.uid);
    if (!l) return closeSheet();
    const s = serviceById(l.serviceId);
    const t = lineTotals(l);

    // keep scroll positions across re-renders
    const keep = {
      inner: els.sheetInner.scrollTop,
      sty: els.sheetInner.querySelector(".stylist-scroll")?.scrollLeft,
      day: els.sheetInner.querySelector(".day-strip")?.scrollLeft
    };

    const addons = allowsAddons(s)
      ? `<section class="sh-sec"><h3>Add a little sparkle <span>Optional</span></h3>
          <div class="addon-list">${data.addons
            .map((a) => {
              const on = l.addonIds.includes(a.id);
              return `<button type="button" class="addon-row ${on ? "is-on" : ""}" data-addon="${a.id}" aria-pressed="${on}">
                <span class="chk"><i class="bi bi-check-lg"></i></span><span class="nm">${esc(a.name)}</span>
                <span class="pr">+${money(a.price)}${a.duration ? ` · ${a.duration} min` : ""}</span></button>`;
            })
            .join("")}</div></section>`
      : "";

    const stylists = `<section class="sh-sec" id="secStylist"><h3>Choose a stylist ${l.stylistId ? '<i class="bi bi-check-circle-fill step-ok"></i>' : ""}</h3>
      <div class="stylist-scroll">${data.stylists
        .map((st) => {
          const q = quoteFor(s, st.id);
          const photo = st.image ? `<img src="${st.image}" alt="">` : `<span class="any"><i class="bi bi-stars"></i></span>`;
          return `<button type="button" class="sty ${l.stylistId === st.id ? "is-on" : ""}" data-stylist="${st.id}" aria-pressed="${l.stylistId === st.id}">
            ${photo}<strong>${esc(st.any ? "Anyone" : st.name)}</strong><small>${esc(st.role)}</small><small>${money(q.price, q.from)} · ${q.duration}m</small></button>`;
        })
        .join("")}</div></section>`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < DAYS_AHEAD; i += 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const sub = i === 0 ? "Today" : d.getDate() === 1 || i === 1 ? d.toLocaleDateString("en-AU", { month: "short" }) : "&nbsp;";
      days.push(`<button type="button" class="day ${l.date && sameDay(d, l.date) ? "is-on" : ""} ${i === 0 ? "is-today" : ""}" data-day="${toISO(d)}" data-month="${d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}">
        <small>${d.toLocaleDateString("en-AU", { weekday: "short" })}</small><b>${d.getDate()}</b><i>${sub}</i></button>`);
    }
    const monthLabel = (l.date || today).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    const dateSec = `<section class="sh-sec ${l.stylistId ? "" : "is-locked"}" id="secDate"><h3>Pick a day ${l.date ? '<i class="bi bi-check-circle-fill step-ok"></i>' : ""}</h3>
      <div class="day-head"><strong id="monthLabel">${monthLabel}</strong>
        <div class="day-nav"><button type="button" data-day-nav="-1" aria-label="Earlier days"><i class="bi bi-chevron-left"></i></button>
        <button type="button" data-day-nav="1" aria-label="Later days"><i class="bi bi-chevron-right"></i></button></div></div>
      <div class="day-strip">${days.join("")}</div></section>`;

    let timeSec = "";
    if (l.date) {
      const slots = slotsFor(l);
      const groups = [
        ["Morning", "bi-sunrise", slots.filter((x) => x.t < 12)],
        ["Afternoon", "bi-sun", slots.filter((x) => x.t >= 12 && x.t < 17)],
        ["Evening", "bi-moon-stars", slots.filter((x) => x.t >= 17)]
      ].filter((g) => g[2].length);
      const anyFree = slots.some((x) => !x.busy);
      timeSec = `<section class="sh-sec" id="secTime"><h3>${esc(fmtDayLong(l.date))} ${l.time ? '<i class="bi bi-check-circle-fill step-ok"></i>' : ""}</h3>
        ${anyFree ? groups
          .map((g) => `<div class="slot-group"><h4><i class="bi ${g[1]}"></i> ${g[0]}</h4><div class="slot-grid">${g[2]
            .map((x) => `<button type="button" class="slot ${l.time === x.label ? "is-on" : ""}" data-time="${x.label}" ${x.busy ? "disabled" : ""}>${x.label}</button>`)
            .join("")}</div></div>`)
          .join("") : `<p class="sh-hint">No times left on this day — try another day.</p>`}
      </section>`;
    } else if (l.stylistId) {
      timeSec = `<p class="sh-hint" style="margin-bottom:20px">Pick a day to see available times.</p>`;
    }

    const ok = lineComplete(l);
    const need = !l.stylistId ? "Choose a stylist" : !l.date ? "Pick a day" : !l.time ? "Pick a time" : "";
    const btnText = ok ? (spec.isNew ? "Add to booking" : "Save changes") : need;

    els.sheetInner.innerHTML = `
      <header class="sh-head">
        <img src="${s.image}" alt="">
        <div><h2 id="sheetTitle">${esc(s.name)}</h2><small>${t.duration} min · <b>${money(t.price, t.from)}</b></small></div>
        <button type="button" class="sh-close" data-close-sheet aria-label="Close"><i class="bi bi-x-lg"></i></button>
      </header>
      <p class="sh-hint" style="margin:-4px 4px 16px">${esc(s.blurb)}</p>
      ${addons}${stylists}${dateSec}${timeSec}
      <div class="sh-foot">
        <div class="sum"><small>Total</small><strong>${money(t.price, t.from)}</strong></div>
        <button type="button" class="ios-btn primary" data-sheet-done ${ok ? "" : "disabled"}>${esc(btnText)}</button>
      </div>`;

    els.sheetInner.scrollTop = keep.inner;
    const sty = els.sheetInner.querySelector(".stylist-scroll");
    const strip = els.sheetInner.querySelector(".day-strip");
    if (sty && keep.sty != null) sty.scrollLeft = keep.sty;
    if (strip) {
      if (keep.day != null) strip.scrollLeft = keep.day;
      else if (l.date) {
        const on = strip.querySelector(".is-on");
        if (on) strip.scrollLeft = on.offsetLeft - strip.offsetLeft - 8;
      }
      strip.addEventListener("scroll", onStripScroll, { passive: true });
    }
    if (scrollTo) {
      const target = els.sheetInner.querySelector(scrollTo);
      if (target) {
        const top = target.offsetTop - els.sheetInner.querySelector(".sh-head").offsetHeight - 6;
        requestAnimationFrame(() => els.sheetInner.scrollTo({ top, behavior: "smooth" }));
      }
    }
  }

  function onStripScroll(e) {
    const strip = e.currentTarget;
    const first = [...strip.children].find((d) => d.offsetLeft - strip.offsetLeft + d.offsetWidth / 2 >= strip.scrollLeft);
    const lbl = document.getElementById("monthLabel");
    if (first && lbl) lbl.textContent = first.dataset.month;
  }

  function sheetClick(e) {
    const spec = state.sheet;
    if (!spec) return;
    if (e.target.closest("[data-close-sheet]")) return closeSheet();
    if (spec.type === "cart") return cartClick(e);
    if (spec.type !== "line") return;
    const l = findLine(spec.uid);
    if (!l) return;

    const addon = e.target.closest("[data-addon]");
    if (addon) {
      const id = addon.dataset.addon;
      l.addonIds = l.addonIds.includes(id) ? l.addonIds.filter((x) => x !== id) : [...l.addonIds, id];
      return renderSheet();
    }
    const sty = e.target.closest("[data-stylist]");
    if (sty) {
      const first = !l.stylistId;
      l.stylistId = sty.dataset.stylist;
      return renderSheet(first ? "#secDate" : null);
    }
    const nav = e.target.closest("[data-day-nav]");
    if (nav) {
      const strip = els.sheetInner.querySelector(".day-strip");
      strip.scrollBy({ left: Number(nav.dataset.dayNav) * strip.clientWidth * 0.8, behavior: "smooth" });
      return;
    }
    const day = e.target.closest("[data-day]");
    if (day) {
      l.date = fromISO(day.dataset.day);
      l.time = null;
      return renderSheet("#secTime");
    }
    const time = e.target.closest("[data-time]");
    if (time && !time.disabled) {
      l.time = time.dataset.time;
      renderSheet(".sh-foot");
      return;
    }
    if (e.target.closest("[data-sheet-done]") && lineComplete(l)) {
      const isNew = spec.isNew;
      spec.isNew = false;
      closeSheet();
      toast(isNew ? `${serviceById(l.serviceId).name} added 💖` : "Saved");
    }
  }

  // Drag-to-dismiss (mobile)
  (function enableDrag() {
    let startY = 0;
    let dy = 0;
    let startT = 0;
    let dragging = false;
    const canDrag = (e) => window.innerWidth < 760 && (e.target.closest("#sheetGrab") || e.target.closest(".sh-head, .cart-head, .login-sheet > img"));
    els.sheet.addEventListener("pointerdown", (e) => {
      if (!canDrag(e) || e.target.closest("button")) return;
      dragging = true;
      startY = e.clientY;
      startT = Date.now();
      dy = 0;
      els.sheet.classList.add("dragging");
      els.sheet.setPointerCapture(e.pointerId);
    });
    els.sheet.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      els.sheet.style.transform = `translateY(${dy}px)`;
      els.backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      els.sheet.classList.remove("dragging");
      els.backdrop.style.opacity = "";
      const fast = dy / Math.max(1, Date.now() - startT) > 0.6;
      if (dy > 140 || (fast && dy > 40)) closeSheet();
      else els.sheet.style.transform = "";
    };
    els.sheet.addEventListener("pointerup", end);
    els.sheet.addEventListener("pointercancel", end);
  })();

  /* ---------------- login ---------------- */
  function renderLoginSheet() {
    const forCheckout = state.pendingCheckout;
    els.sheetInner.innerHTML = `
      <div class="login-sheet">
        <div style="display:flex;justify-content:flex-end;padding-top:8px"><button type="button" class="sh-close" data-close-sheet aria-label="Close"><i class="bi bi-x-lg"></i></button></div>
        <img src="assets/img/logo-cloud.png" alt="">
        <h2 id="sheetTitle">${forCheckout ? "Log in to continue" : "Welcome back"}</h2>
        <p>${forCheckout ? "Log in so we can confirm your booking." : "Demo only — any phone or email works."}</p>
        <form id="loginForm" novalidate>
          <div class="ios-list">
            <label class="ios-row stack"><span>Mobile or email</span><input name="contact" autocomplete="username" placeholder="0400 000 000"></label>
            <label class="ios-row stack"><span>Password</span><input name="password" type="password" autocomplete="current-password" placeholder="••••••"></label>
          </div>
          <p class="form-error" id="loginError" hidden></p>
          <div class="sh-foot" style="margin-top:18px"><button type="submit" class="ios-btn primary">Log in</button></div>
        </form>
      </div>`;
    els.sheetInner.querySelector("#loginForm").addEventListener("submit", submitLogin);
    setTimeout(() => els.sheetInner.querySelector("input")?.focus({ preventScroll: true }), 350);
  }
  function openLogin(forCheckout) {
    state.pendingCheckout = Boolean(forCheckout);
    openSheet({ type: "login" });
  }
  function submitLogin(e) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const contact = f.contact.value.trim();
    const contactOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || digits(contact).length >= 8;
    const passOk = f.password.value.length >= 4;
    f.contact.closest(".ios-row").classList.toggle("is-invalid", !contactOk);
    f.password.closest(".ios-row").classList.toggle("is-invalid", !passOk);
    const err = els.sheetInner.querySelector("#loginError");
    if (!contactOk || !passOk) {
      err.hidden = false;
      err.textContent = !contactOk ? "Enter a mobile number or email." : "Password needs 4 or more characters.";
      return;
    }
    state.loggedIn = true;
    state.loginContact = contact;
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ contact, at: Date.now() })); } catch (err) { /* demo only */ }
    const goCheckout = state.pendingCheckout;
    state.pendingCheckout = false;
    paintLogin();
    closeSheet();
    toast("You’re logged in");
    if (goCheckout) go("checkout");
  }
  function paintLogin() {
    els.loginBtn.classList.toggle("is-in", state.loggedIn);
    els.loginBtn.querySelector("span").textContent = state.loggedIn ? state.loginContact.split("@")[0].slice(0, 14) : "Log in";
    els.loginBtn.querySelector("i").className = state.loggedIn ? "bi bi-person-fill" : "bi bi-person-circle";
    els.loginBtn.title = state.loggedIn ? "My account (" + state.loginContact + ")" : "";
  }

  function requestCheckout() {
    saveGuestForm();
    if (servicesBlocker()) return;
    if (!state.loggedIn) return openLogin(true);
    go("checkout");
  }

  /* ---------------- checkout ---------------- */
  function renderCheckout() {
    const guests = state.customers
      .map((c, i) => {
        const ready = customerReady(c, i);
        const ls = lines(c);
        const rows = ls
          .map((l) => {
            const s = serviceById(l.serviceId);
            const st = stylistById(l.stylistId);
            const t = lineTotals(l);
            const extras = lineAddons(l).map((a) => a.name).join(", ");
            const when = l.date && l.time ? `${fmtDay(l.date)} · ${l.time}` : "Time not chosen yet";
            return `<div class="co-line"><img src="${s.image}" alt="">
              <div><strong>${esc(s.name)}</strong><small>${esc(st ? st.name : "No stylist")} · ${t.duration} min</small><small>${esc(when)}${extras ? ` · ${esc(extras)}` : ""}</small></div>
              <span class="pr">${money(t.price)}</span></div>`;
          })
          .join("");
        let pending = "";
        if (!ready) {
          const why = needsDetails(i) && !profileComplete(c) ? "Needs guest details" : !ls.length ? "No services chosen yet" : "A service still needs a time";
          pending = `<div class="co-pending"><i class="bi bi-exclamation-circle"></i> ${why} · <button type="button" class="co-edit" data-fix-guest="${i}">Fix now</button></div>`;
        }
        return `<div class="ios-group co-guest" style="animation-delay:${i * 60}ms">
          <div class="ios-group-head"><h2>${esc(label(c, i))} ${i === state.active ? '<span class="ios-badge ok">You</span>' : ""}</h2>
            <button type="button" class="co-edit" data-fix-guest="${i}">Edit</button></div>
          <div class="ios-list">${rows}${pending}</div></div>`;
      })
      .join("");

    const ready = allReady();
    els.checkout.innerHTML = `
      ${guests}
      <div class="ios-group co-guest">
        <div class="ios-group-head"><h2>Booking details</h2></div>
        <div class="ios-list">
          <div class="kv"><span>Guests</span><strong>${state.customers.length}</strong></div>
          <div class="kv"><span>Contact</span><strong>${esc(state.loginContact || "—")}</strong></div>
          <div class="kv"><span>Salon</span><strong>${esc(data.location.name)}</strong></div>
          <div class="kv total"><span>Total</span><strong>${money(total())}</strong></div>
        </div>
      </div>
      ${ready ? "" : '<p class="co-note"><i class="bi bi-lock-fill"></i> Payment unlocks once every extra guest has details and every service has a stylist and time.</p>'}
      <button type="button" class="ios-btn primary block co-desktop-btn" data-primary ${ready ? "" : "disabled"}>Continue to payment</button>
    `;
  }

  /* ---------------- payment ---------------- */
  function preparePayment() {
    if (!allReady()) return go("checkout", { back: true });
    els.payBtn.textContent = `Pay ${money(total())}`;
    els.payBtn.disabled = false;
    els.payError.hidden = true;
  }
  function fmtCard(v) {
    return digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  }
  function fmtExp(v) {
    const d = digits(v).slice(0, 4);
    return d.length < 3 ? d : `${d.slice(0, 2)} / ${d.slice(2)}`;
  }
  function paintCard() {
    const f = els.payForm.elements;
    const num = digits(f.card_number.value).padEnd(16, "•");
    els.ccNum.textContent = num.replace(/(.{4})(?=.)/g, "$1 ");
    els.ccName.textContent = f.card_name.value.trim() || "YOUR NAME";
    const e = digits(f.card_expiry.value);
    els.ccExp.textContent = e.length ? `${e.slice(0, 2).padEnd(2, "M")}/${e.slice(2, 4).padEnd(2, "Y")}` : "MM/YY";
  }
  function validatePay() {
    const f = els.payForm.elements;
    const nameOk = f.card_name.value.trim().length >= 2;
    const numOk = digits(f.card_number.value).length === 16;
    const ed = digits(f.card_expiry.value);
    const m = Number(ed.slice(0, 2));
    const y = 2000 + Number(ed.slice(2, 4));
    const now = new Date();
    const expOk = ed.length === 4 && m >= 1 && m <= 12 && new Date(y, m - 1, 1) >= new Date(now.getFullYear(), now.getMonth(), 1);
    const cvcOk = digits(f.card_cvc.value).length >= 3;
    const map = { card_name: nameOk, card_number: numOk, card_expiry: expOk, card_cvc: cvcOk };
    Object.entries(map).forEach(([k, ok]) => f[k].closest(".ios-row").classList.toggle("is-invalid", !ok));
    const firstBad = Object.entries(map).find(([, ok]) => !ok);
    const msgs = { card_name: "Add the name on the card.", card_number: "Enter a 16-digit card number.", card_expiry: "Enter a valid expiry date.", card_cvc: "Enter a 3 or 4 digit CVC." };
    els.payError.hidden = !firstBad;
    if (firstBad) els.payError.textContent = msgs[firstBad[0]];
    return !firstBad;
  }
  function submitPay(e) {
    e.preventDefault();
    if (!allReady() || !validatePay()) return;
    els.payBtn.disabled = true;
    els.payBtn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Processing…';
    setTimeout(confirmBooking, 1100);
  }

  /* ---------------- confirm ---------------- */
  function confirmBooking() {
    const payload = {
      location_id: data.location.id,
      party: isGroup() ? "group" : "solo",
      parent_name: fullName(state.customers[0]) || state.loginContact,
      parent_email: state.loginContact,
      parent_phone: state.customers[0].mobile,
      guests: state.customers.map((c, i) => ({
        label: label(c, i),
        is_parent: i === 0,
        first_name: c.firstName,
        last_name: c.lastName,
        name: fullName(c),
        mobile: c.mobile,
        dob: c.dob,
        gender: c.gender,
        services: lines(c).map((l) => {
          const s = serviceById(l.serviceId);
          const st = stylistById(l.stylistId);
          const t = lineTotals(l);
          return {
            service_id: l.serviceId,
            service_name: s.name,
            duration: t.duration,
            price: t.price,
            stylist_id: l.stylistId,
            stylist_name: st ? st.name : "",
            addons: lineAddons(l).map((a) => ({ id: a.id, name: a.name, price: a.price, duration: a.duration })),
            appointment_date: l.date ? toISO(l.date) : null,
            appointment_time: l.time
          };
        })
      }))
    };
    try {
      localStorage.setItem("dreamcuts_booking", JSON.stringify(payload));
      // Keep a running list so the profile page can show appointments.
      const all = JSON.parse(localStorage.getItem("dreamcuts_bookings") || "[]");
      all.push({ ...payload, total: total(), created_at: new Date().toISOString() });
      localStorage.setItem("dreamcuts_bookings", JSON.stringify(all));
    } catch (err) {
      /* storage unavailable — demo only */
    }
    state.done = true;

    const count = payload.guests.reduce((n, g) => n + g.services.length, 0);
    els.successText.textContent = `${count} service${count > 1 ? "s" : ""} for ${payload.guests.length} guest${payload.guests.length > 1 ? "s" : ""} · ${money(total())} paid`;
    els.successList.innerHTML = `<div class="ios-list">${state.customers
      .flatMap((c, i) =>
        lines(c).map((l) => `<div class="co-line"><img src="${serviceById(l.serviceId).image}" alt="">
          <div><strong>${esc(serviceById(l.serviceId).name)}</strong><small>${esc(label(c, i))} · with ${esc(stylistById(l.stylistId).name)}</small><small>${esc(fmtDayLong(l.date))} · ${esc(l.time)}</small></div></div>`)
      )
      .join("")}</div>`;
    go("success");
    confetti();
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ea86a6", "#8fd4ea", "#ffe7a8", "#c8efe6", "#c994b0"];
    for (let i = 0; i < 70; i += 1) {
      const p = document.createElement("i");
      p.className = "confetti";
      p.style.left = `${Math.random() * 100}vw`;
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      p.style.animationDelay = `${Math.random() * 0.4}s`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }

  function resetBooking() {
    state.customers = [newCustomer(1)];
    state.active = 0;
    state.done = false;
    state.category = "all";
    state.query = "";
    els.search.value = "";
    els.payForm.reset();
    paintCard();
    els.payBtn.textContent = "Pay";
    renderChips();
    fillGuestForm();
    go("services", { back: true });
  }

  /* ---------------- guests ---------------- */
  function addGuest() {
    if (state.customers.length >= MAX_CUSTOMERS) return;
    saveGuestForm();
    state.customers.push(newCustomer(state.customers.length + 1));
    state.active = state.customers.length - 1;
    fillGuestForm();
    renderServicesView();
    els.guestBar.lastElementChild?.classList.add("pill-in");
    revealGuestPill(state.active);
    // Keep the Add guest button where the user's finger is: only scroll the page
    // if the guest row has drifted out of view, never push it away.
    const row = els.guestAdd.getBoundingClientRect();
    if (row.top < 0 || row.bottom > window.innerHeight) {
      els.guestAdd.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  function removeGuest(i) {
    if (i === 0) return;
    const name = label(state.customers[i], i);
    state.customers.splice(i, 1);
    if (state.active >= i) state.active = Math.max(0, state.active - 1);
    fillGuestForm();
    renderServicesView();
    toast(`Removed ${name}`);
  }
  function switchGuest(i) {
    saveGuestForm();
    state.active = i;
    fillGuestForm();
    renderServicesView();
    revealGuestPill(i);
  }
  // The guest bar is re-rendered on every change, so the tapped pill is a new
  // element: scroll it to the middle of the bar and give it focus again.
  function revealGuestPill(i, behavior = "smooth") {
    const pill = els.guestBar.querySelector(`[data-guest="${i}"]`);
    if (!pill) return;
    const bar = els.guestBar;
    const b = bar.getBoundingClientRect(), r = pill.getBoundingClientRect();
    const left = bar.scrollLeft + (r.left - b.left) - (b.width - r.width) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior });
    pill.focus({ preventScroll: true });
  }

  /* ---------------- events ---------------- */
  function bind() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("#sheet")) return sheetClick(e);
      if (e.target.closest("#sheetBackdrop")) return closeSheet();

      const rmGuest = e.target.closest("[data-remove-guest]");
      if (rmGuest) {
        e.stopPropagation();
        return removeGuest(Number(rmGuest.dataset.removeGuest));
      }
      if (e.target.closest("[data-add-guest]")) return addGuest();
      const guest = e.target.closest("[data-guest]");
      if (guest) return switchGuest(Number(guest.dataset.guest));

      const g = e.target.closest("[data-gender]");
      if (g) {
        active().gender = g.dataset.gender;
        paintGender();
        paintGuestBadge();
        g.closest(".ios-row").classList.remove("is-invalid");
        renderGuests();
        renderSummary();
        return;
      }

      const rmLine = e.target.closest("[data-remove-line]");
      if (rmLine) {
        e.stopPropagation();
        return removeLine(rmLine.dataset.removeLine);
      }
      const edit = e.target.closest("[data-edit-line]");
      if (edit) return openLineSheet(edit.dataset.editLine, false);

      const cat = e.target.closest("[data-cat]");
      if (cat) {
        state.category = cat.dataset.cat;
        renderChips();
        renderCatalog();
        cat.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        return;
      }
      const pick = e.target.closest("[data-pick]");
      if (pick) return pickService(pick.dataset.pick);

      const fix = e.target.closest("[data-fix-guest]");
      if (fix) {
        state.active = Number(fix.dataset.fixGuest);
        fillGuestForm();
        return go("services", { back: true });
      }

      if (e.target.closest("[data-primary]")) return runPrimary();
    });

    els.basket.addEventListener("keydown", (e) => {
      const edit = e.target.closest("[data-edit-line]");
      if (edit && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openLineSheet(edit.dataset.editLine, false);
      }
    });

    els.barBtn.addEventListener("click", runPrimary);
    els.barInfo.addEventListener("click", openCart);
    els.sheetInner.addEventListener("keydown", (e) => {
      const edit = state.sheet && state.sheet.type === "cart" && e.target.closest("[data-cart-edit]");
      if (edit && (e.key === "Enter" || e.key === " ") && !e.target.closest("button")) {
        e.preventDefault();
        cartClick({ target: edit });
      }
    });
    els.viewBack.addEventListener("click", () => {
      // First step leaves the booking flow for the home page; later steps go back one step.
      if (state.view === "services") location.href = "index.html";
      else history.back();
    });
    els.loginBtn.addEventListener("click", () => {
      if (state.loggedIn) location.href = "profile.html";
      else openLogin(false);
    });
    $("#bookAgain").addEventListener("click", resetBooking);

    els.search.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderCatalog();
    });

    els.guestForm.addEventListener("input", (e) => {
      saveGuestForm();
      e.target.closest(".ios-row")?.classList.remove("is-invalid");
      paintGuestBadge();
      renderGuests();
      renderSummary();
    });
    els.guestForm.addEventListener("submit", (e) => e.preventDefault());

    const f = els.payForm.elements;
    f.card_number.addEventListener("input", (e) => { e.target.value = fmtCard(e.target.value); paintCard(); });
    f.card_expiry.addEventListener("input", (e) => { e.target.value = fmtExp(e.target.value); paintCard(); });
    f.card_cvc.addEventListener("input", (e) => { e.target.value = digits(e.target.value).slice(0, 4); });
    f.card_name.addEventListener("input", paintCard);
    els.payForm.addEventListener("input", (e) => e.target.closest(".ios-row")?.classList.remove("is-invalid"));
    els.payForm.addEventListener("submit", submitPay);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.sheet) closeSheet();
    });

    window.addEventListener("popstate", (e) => {
      if (state.sheet) closeSheet();
      if (state.done) return resetBooking();
      const target = (e.state && e.state.view) || "services";
      const back = VIEWS.indexOf(target) < VIEWS.indexOf(state.view);
      if (target === "payment" && !allReady()) return go("checkout", { back: true, fromHistory: true });
      go(target, { back, fromHistory: true });
    });
  }

  /* ---------------- init ---------------- */
  history.replaceState({ view: "services" }, "");
  renderChips();
  fillGuestForm();
  renderServicesView();
  paintLogin();
  bind();

  // booking.html?service=<id> opens that service straight away (used by the Services page)
  const pre = new URLSearchParams(location.search).get("service");
  if (pre && serviceById(pre)) setTimeout(() => pickService(pre), 250);
})();
