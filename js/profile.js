// Dream Cuts — account / profile page. Demo only: everything is kept in localStorage,
// keyed by the login contact, until this is wired into Odoo.
(function () {
  const data = window.DREAMCUTS || {};
  const AUTH_KEY = "dreamcuts_auth";
  const PROFILE_KEY = "dreamcuts_profile";
  const GUEST_KEY = "dreamcuts_guestform";
  const WAIT_KEY = "dreamcuts_waitlist";
  const TABS = ["profile", "guest-form", "appointments", "gift-cards", "loyalty"];

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const digits = (v) => String(v || "").replace(/\D/g, "");
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const fromISO = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
  const money = (v) => Number(v || 0).toLocaleString("en-AU", { style: "currency", currency: "AUD" });

  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (err) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* storage unavailable */ }
  };

  const main = $("#main");
  const loginBtn = $("#loginBtn");
  const profileForm = $("#profileForm");
  const guestForm = $("#guestDataForm");
  const toastEl = $("#toast");

  let auth = read(AUTH_KEY, null);
  let profile = {};
  let editing = false;
  let tab = "profile";

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }

  /* ---------------- segmented controls ---------------- */
  function setSeg(seg, value) {
    $$("button", seg).forEach((b) => {
      const on = b.dataset.v === value;
      b.classList.toggle("is-on", on);
      b.setAttribute(b.getAttribute("role") === "tab" ? "aria-selected" : "aria-checked", String(on));
    });
  }
  const segValue = (seg) => ($("button.is-on", seg) || {}).dataset?.v || "";
  const segByName = (name) => $(`[data-seg="${name}"]`);

  /* ---------------- profile data ---------------- */
  function defaultProfile(contact) {
    return {
      firstName: "", lastName: "", preferredName: "", dob: "", gender: "",
      street: "", apt: "", city: "", country: "Australia", state: "", region: "", postcode: "",
      mobile: isEmail(contact) ? "" : contact,
      email: isEmail(contact) ? contact : "",
      emFirst: "", emLast: "", emMobile: "",
      language: "English - United States",
      mktSms: false, mktEmail: false, txSms: true, txEmail: true
    };
  }
  function loadProfile() {
    const all = read(PROFILE_KEY, {});
    profile = { ...defaultProfile(auth.contact), ...(all[auth.contact] || {}) };
  }
  function saveProfile() {
    const all = read(PROFILE_KEY, {});
    all[auth.contact] = profile;
    write(PROFILE_KEY, all);
  }

  const displayName = () => {
    const full = `${profile.firstName} ${profile.lastName}`.trim();
    return full || auth.contact;
  };
  const greetName = () => profile.preferredName || profile.firstName || auth.contact.split("@")[0];

  function paintIdentity() {
    const name = displayName();
    const contactLine = [profile.email, profile.mobile].filter(Boolean).join(" · ") || auth.contact;
    $$("[data-name]").forEach((el) => (el.textContent = name));
    $$("[data-contact]").forEach((el) => (el.textContent = contactLine));
    $$("[data-initial]").forEach((el) => (el.textContent = (greetName()[0] || "?").toUpperCase()));
    $$("[data-first]").forEach((el) => (el.textContent = greetName()));
    loginBtn.classList.add("is-in");
    loginBtn.querySelector("i").className = "bi bi-person-fill";
    loginBtn.querySelector("span").textContent = greetName().slice(0, 14);
  }

  function fillProfileForm() {
    const f = profileForm.elements;
    ["firstName", "lastName", "preferredName", "dob", "street", "apt", "city", "country", "state", "region", "postcode", "mobile", "email", "emFirst", "emLast", "emMobile", "language"]
      .forEach((k) => { if (f[k]) f[k].value = profile[k] || ""; });
    if (!f.country.value) f.country.value = "Australia";
    ["mktSms", "mktEmail", "txSms", "txEmail"].forEach((k) => (f[k].checked = Boolean(profile[k])));
    setSeg(segByName("gender"), profile.gender);
    paintCountry();
    $$(".ios-row.is-invalid", profileForm).forEach((r) => r.classList.remove("is-invalid"));
    $("#profileError").hidden = true;
  }

  function paintCountry() {
    const au = profileForm.elements.country.value === "Australia";
    $("#stateRow").hidden = !au;
    $("#regionRow").hidden = au;
  }

  function setEditing(on) {
    editing = on;
    profileForm.classList.toggle("is-readonly", !on);
    $$("input, select", profileForm).forEach((el) => (el.disabled = !on));
    $("#saveBar").hidden = !on;
    const btn = $("#editBtn");
    btn.classList.toggle("is-on", on);
    btn.innerHTML = on ? '<i class="bi bi-x-lg"></i> Cancel' : '<i class="bi bi-pencil"></i> Edit';
    if (on) setTimeout(() => profileForm.elements.firstName.focus({ preventScroll: true }), 50);
  }

  function submitProfile(e) {
    e.preventDefault();
    if (!editing) return;
    const f = profileForm.elements;
    const checks = [
      [f.firstName, f.firstName.value.trim(), "Please add your first name."],
      [f.lastName, f.lastName.value.trim(), "Please add your last name."],
      [f.mobile, !f.mobile.value.trim() || digits(f.mobile.value).length >= 8, "That mobile number looks too short."],
      [f.email, !f.email.value.trim() || isEmail(f.email.value.trim()), "Please check the email address."],
      [f.emMobile, !f.emMobile.value.trim() || digits(f.emMobile.value).length >= 8, "Emergency contact mobile looks too short."]
    ];
    let firstBad = null;
    checks.forEach(([el, ok, msg]) => {
      el.closest(".ios-row").classList.toggle("is-invalid", !ok);
      if (!ok && !firstBad) firstBad = [el, msg];
    });
    const err = $("#profileError");
    err.hidden = !firstBad;
    if (firstBad) {
      err.textContent = firstBad[1];
      firstBad[0].focus();
      return;
    }
    Object.keys(defaultProfile("")).forEach((k) => {
      if (!f[k]) return;
      profile[k] = f[k].type === "checkbox" ? f[k].checked : f[k].value.trim();
    });
    profile.gender = segValue(segByName("gender"));
    saveProfile();
    setEditing(false);
    paintIdentity();
    prefillGuest(false);
    toast("Profile saved");
  }

  /* ---------------- guest custom data ---------------- */
  const YES_NO = ["voucher", "hadBefore", "allergies", "swimming", "photos", "parties"];
  let guest = {};

  function fillServiceSelect() {
    const sel = $("#serviceSelect");
    const cats = (data.categories || []).filter((c) => c.id !== "all");
    sel.innerHTML = '<option value="">Choose a service</option>' + cats
      .map((c) => {
        const items = (data.services || []).filter((s) => s.category === c.id);
        if (!items.length) return "";
        return `<optgroup label="${esc(c.label)}">${items.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</optgroup>`;
      })
      .join("");
  }

  function loadGuest() {
    guest = read(GUEST_KEY, {})[auth.contact] || {};
  }

  function prefillGuest(force) {
    const f = guestForm.elements;
    const guardian = `${profile.firstName} ${profile.lastName}`.trim();
    const set = (k, v) => { if (force || !f[k].value) f[k].value = v || ""; };
    set("guardianName", guest.guardianName || guardian);
    set("guardianMobile", guest.guardianMobile || profile.mobile);
    set("guardianEmail", guest.guardianEmail || profile.email);
  }

  function fillGuestForm() {
    const f = guestForm.elements;
    ["customerName", "customerDob", "service", "reaction", "allergyList", "patientName"].forEach((k) => (f[k].value = guest[k] || ""));
    f.signDate.value = guest.signDate || todayISO();
    prefillGuest(true);
    YES_NO.forEach((q) => setSeg(segByName(q), guest[q] || ""));
    paintFollowUps();
    sig.load(guest.signature || "");
    $("#guestSaved").textContent = guest.savedAt ? `Last saved ${new Date(guest.savedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : "";
  }

  function paintFollowUps() {
    ["hadBefore", "allergies"].forEach((q) => {
      $(`[data-follow="${q}"]`).hidden = segValue(segByName(q)) !== "yes";
    });
  }

  function submitGuest(e) {
    e.preventDefault();
    const f = guestForm.elements;
    const err = $("#guestError");
    const problems = [];
    const mark = (el, ok) => el.classList.toggle("is-invalid", !ok);

    mark(f.customerName.closest(".ios-row"), Boolean(f.customerName.value.trim()));
    if (!f.customerName.value.trim()) problems.push([f.customerName, "Please add the customer’s name."]);
    mark(f.guardianName.closest(".ios-row"), Boolean(f.guardianName.value.trim()));
    if (!f.guardianName.value.trim()) problems.push([f.guardianName, "Please add the guardian’s name."]);
    if (f.guardianEmail.value.trim() && !isEmail(f.guardianEmail.value.trim())) {
      mark(f.guardianEmail.closest(".ios-row"), false);
      problems.push([f.guardianEmail, "Please check the guardian email."]);
    }
    if (segValue(segByName("allergies")) === "yes" && !f.allergyList.value.trim()) {
      problems.push([f.allergyList, "Please list your child’s allergies."]);
    }
    const signed = sig.hasInk();
    $("#sigGroup").classList.toggle("is-invalid", !signed);
    if (!signed) problems.push([$("#sigCanvas"), "Please sign to accept the terms and conditions."]);

    err.hidden = !problems.length;
    if (problems.length) {
      err.textContent = problems[0][1];
      problems[0][0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    guest = {
      customerName: f.customerName.value.trim(),
      customerDob: f.customerDob.value,
      guardianName: f.guardianName.value.trim(),
      guardianMobile: f.guardianMobile.value.trim(),
      guardianEmail: f.guardianEmail.value.trim(),
      service: f.service.value,
      reaction: f.reaction.value.trim(),
      allergyList: f.allergyList.value.trim(),
      patientName: f.patientName.value.trim() || f.customerName.value.trim(),
      signDate: f.signDate.value,
      signature: sig.toData(),
      savedAt: new Date().toISOString()
    };
    YES_NO.forEach((q) => (guest[q] = segValue(segByName(q))));
    const all = read(GUEST_KEY, {});
    all[auth.contact] = guest;
    write(GUEST_KEY, all);
    fillGuestForm();
    toast("Guest form saved");
  }

  /* ---------------- signature pad ---------------- */
  const sig = (function () {
    const pad = $("#sigPad");
    const canvas = $("#sigCanvas");
    const ctx = canvas.getContext("2d");
    let ink = false;
    let drawing = false;
    let pending = "";

    function size() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return false;
      const dpr = window.devicePixelRatio || 1;
      const keep = pending || (ink ? canvas.toDataURL() : "");
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#3b3340";
      if (keep) draw(keep);
      pending = "";
      return true;
    }
    function draw(src) {
      const img = new Image();
      img.onload = () => {
        const r = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, r.width, r.height);
        ctx.drawImage(img, 0, 0, r.width, r.height);
      };
      img.src = src;
      setInk(true);
    }
    function setInk(v) {
      ink = v;
      pad.classList.toggle("has-ink", v);
    }
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + .1, y + .1);
      ctx.stroke();
      setInk(true);
      $("#sigGroup").classList.remove("is-invalid");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => canvas.addEventListener(t, () => (drawing = false)));
    window.addEventListener("resize", () => size());

    return {
      size,
      clear() {
        const r = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, r.width || canvas.width, r.height || canvas.height);
        setInk(false);
      },
      load(src) {
        this.clear();
        if (!src) return;
        if (!size()) { pending = src; setInk(true); return; }
        draw(src);
      },
      hasInk: () => ink,
      toData: () => (ink ? canvas.toDataURL("image/png") : "")
    };
  })();

  /* ---------------- appointments ---------------- */
  function bookings() {
    const all = read("dreamcuts_bookings", []);
    const mine = all.filter((b) => !b.parent_email || b.parent_email === auth.contact);
    const rows = [];
    mine.forEach((b) => (b.guests || []).forEach((g) => (g.services || []).forEach((s) => {
      if (!s.appointment_date) return;
      rows.push({ ...s, guest: g.name || g.label || "Guest" });
    })));
    return rows.sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time));
  }

  function renderAppointments() {
    const which = segValue(segByName("appt")) || "upcoming";
    const today = todayISO();
    const rows = bookings().filter((r) => (which === "upcoming" ? r.appointment_date >= today : r.appointment_date < today));
    if (which === "past") rows.reverse();
    const box = $("#apptList");
    $(".pf-wait").hidden = which !== "upcoming";

    if (!rows.length) {
      box.innerHTML = which === "upcoming"
        ? `<div class="pf-card pf-empty"><span class="ic c-sky"><i class="bi bi-calendar-x"></i></span>
            <h3>No upcoming appointments available</h3><p>When you book a visit it will show up here.</p>
            <div class="btn-row"><a class="ios-btn primary" href="booking.html"><i class="bi bi-calendar-heart"></i> Book a visit</a></div></div>`
        : `<div class="pf-card pf-empty"><span class="ic c-lilac"><i class="bi bi-clock-history"></i></span>
            <h3>No past appointments</h3><p>Your visit history will appear here after your first appointment.</p></div>`;
      return;
    }

    const groups = {};
    rows.forEach((r) => (groups[r.appointment_date] = groups[r.appointment_date] || []).push(r));
    box.innerHTML = Object.entries(groups)
      .map(([day, list]) => {
        const label = fromISO(day).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        return `<p class="appt-day">${esc(label)}</p><div class="ios-list appt-list">${list
          .map((r) => {
            const svc = (data.services || []).find((s) => s.id === r.service_id);
            const img = svc ? svc.image : "assets/img/logo-cloud.png";
            const extras = (r.addons || []).map((a) => a.name).join(", ");
            return `<div class="co-line"><img src="${esc(img)}" alt="">
              <div><strong>${esc(r.service_name)}</strong>
              <small><span class="when">${esc(r.appointment_time || "")}</span> · ${esc(r.guest)}${r.stylist_name ? ` · with ${esc(r.stylist_name)}` : ""}</small>
              ${extras ? `<small>${esc(extras)}</small>` : ""}</div>
              <span class="pr">${money(r.price)}</span></div>`;
          })
          .join("")}</div>`;
      })
      .join("");
  }

  function paintWait() {
    const on = Boolean(read(WAIT_KEY, {})[auth.contact]);
    const btn = $("#waitBtn");
    btn.classList.toggle("is-done", on);
    btn.innerHTML = on ? '<i class="bi bi-check-lg"></i> On the list' : '<i class="bi bi-hourglass-split"></i> Join waiting list';
  }

  /* ---------------- tabs ---------------- */
  // Mobile shows an "account home" hub; a section opens on top of it with a back link.
  // Desktop always shows a section (the sidebar is the menu).
  const mobileQ = window.matchMedia("(max-width: 991.98px)");

  function showTab(name, scroll) {
    const valid = TABS.includes(name);
    const hub = !valid && mobileQ.matches;
    const prevView = main.dataset.view;
    main.dataset.view = hub ? "hub" : "section";
    tab = valid ? name : "profile";
    $$(".pf-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    $$("[data-tab]").forEach((a) => {
      const on = a.dataset.tab === tab;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (hub) paintHub();
    if (!hub && tab === "guest-form") requestAnimationFrame(() => sig.size());
    if (tab === "appointments") renderAppointments();

    const switched = mobileQ.matches && prevView && prevView !== main.dataset.view;
    if (switched) {
      // Slide forward into a section, or back to the hub
      main.classList.remove("go-in", "go-back");
      void main.offsetWidth;
      main.classList.add(hub ? "go-back" : "go-in");
    }
    if (scroll || switched) window.scrollTo({ top: 0, behavior: switched ? "auto" : "smooth" });
  }

  function paintHub() {
    const today = todayISO();
    const upcoming = bookings().filter((r) => r.appointment_date >= today);
    const next = upcoming[0];
    $('[data-hub="next"]').textContent = next
      ? fromISO(next.appointment_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
      : "None";
    const appts = $('[data-hub="appts"]');
    appts.hidden = !upcoming.length;
    appts.textContent = `${upcoming.length} upcoming`;
    const g = $('[data-hub="guest"]');
    const done = Boolean(guest && guest.savedAt);
    g.textContent = done ? "Done" : "To do";
    g.classList.toggle("is-done", done);
  }

  /* ---------------- auth ---------------- */
  function enter() {
    main.dataset.auth = "in";
    loadProfile();
    loadGuest();
    fillProfileForm();
    setEditing(false);
    fillGuestForm();
    paintIdentity();
    paintWait();
    showTab(location.hash.slice(1));
  }

  function leave() {
    try { localStorage.removeItem(AUTH_KEY); } catch (err) { /* ignore */ }
    auth = null;
    main.dataset.auth = "out";
    loginBtn.classList.remove("is-in");
    loginBtn.querySelector("i").className = "bi bi-person-circle";
    loginBtn.querySelector("span").textContent = "Log in";
    history.replaceState(null, "", location.pathname);
    window.scrollTo({ top: 0 });
    toast("You’ve signed out");
  }

  function submitLogin(e) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const contact = f.contact.value.trim();
    const contactOk = isEmail(contact) || digits(contact).length >= 8;
    const passOk = f.password.value.length >= 4;
    f.contact.closest(".ios-row").classList.toggle("is-invalid", !contactOk);
    f.password.closest(".ios-row").classList.toggle("is-invalid", !passOk);
    const err = $("#pfLoginError");
    if (!contactOk || !passOk) {
      err.hidden = false;
      err.textContent = !contactOk ? "Enter a mobile number or email." : "Password needs 4 or more characters.";
      return;
    }
    err.hidden = true;
    auth = { contact, at: Date.now() };
    write(AUTH_KEY, auth);
    e.currentTarget.reset();
    enter();
    toast("You’re logged in");
  }

  /* ---------------- events ---------------- */
  function bind() {
    $("#pfLoginForm").addEventListener("submit", submitLogin);
    $("#pfLoginForm").addEventListener("input", (e) => e.target.closest(".ios-row")?.classList.remove("is-invalid"));

    loginBtn.addEventListener("click", () => {
      if (auth) {
        location.hash = "profile";
        showTab("profile", true);
      } else {
        $("#pfLoginForm").elements.contact.focus();
      }
    });

    window.addEventListener("hashchange", () => auth && showTab(location.hash.slice(1)));
    mobileQ.addEventListener("change", () => auth && showTab(location.hash.slice(1)));

    // Segmented controls (gender, yes/no, appointment + gift card tabs)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".pf-seg button");
      if (!btn) return;
      const seg = btn.closest(".pf-seg");
      const name = seg.dataset.seg;
      if (name === "gender" && !editing) return;
      setSeg(seg, btn.dataset.v);
      if (name === "hadBefore" || name === "allergies") paintFollowUps();
      if (YES_NO.includes(name)) btn.closest(".q-row")?.classList.remove("is-invalid");
      if (name === "appt") renderAppointments();
      if (name === "gift") $$("[data-gift]").forEach((p) => (p.hidden = p.dataset.gift !== btn.dataset.v));
    });

    // Filter chips (visual only until there is data to filter)
    $$("[data-chips]").forEach((row) => row.addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;
      $$(".cat-chip", row).forEach((c) => c.classList.toggle("is-active", c === chip));
    }));

    $("#editBtn").addEventListener("click", () => {
      if (editing) { fillProfileForm(); setEditing(false); }
      else setEditing(true);
    });
    $("#cancelEdit").addEventListener("click", () => { fillProfileForm(); setEditing(false); });
    profileForm.addEventListener("submit", submitProfile);
    profileForm.addEventListener("input", (e) => e.target.closest(".ios-row")?.classList.remove("is-invalid"));
    profileForm.elements.country.addEventListener("change", paintCountry);

    guestForm.addEventListener("submit", submitGuest);
    guestForm.addEventListener("input", (e) => {
      e.target.closest(".ios-row")?.classList.remove("is-invalid");
      if (e.target.name === "customerName") {
        const p = guestForm.elements.patientName;
        if (!p.value || p.dataset.auto === "1") { p.value = e.target.value; p.dataset.auto = "1"; }
      }
      if (e.target.name === "patientName") e.target.dataset.auto = "0";
    });
    $("#sigClear").addEventListener("click", () => sig.clear());

    $("#waitBtn").addEventListener("click", () => {
      const all = read(WAIT_KEY, {});
      if (all[auth.contact]) delete all[auth.contact];
      else all[auth.contact] = new Date().toISOString();
      write(WAIT_KEY, all);
      paintWait();
      toast(all[auth.contact] ? "You’re on the waiting list. We’ll call you soon!" : "Removed from the waiting list");
    });

    $$("[data-signout]").forEach((b) => b.addEventListener("click", leave));
  }

  /* ---------------- init ---------------- */
  fillServiceSelect();
  setSeg(segByName("appt"), "upcoming");
  setSeg(segByName("gift"), "cards");
  bind();
  if (auth && auth.contact) enter();
})();
