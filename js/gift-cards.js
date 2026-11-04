// Dream Cuts — Gift cards: build, customise, preview and (demo) purchase.
(function () {
  const data = window.DREAMCUTS || {};
  const $ = (s) => document.querySelector(s);
  const money = (n) => `$${Number(n || 0).toFixed(2)}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const AMOUNTS = [25, 50, 100];
  const MIN = 10;
  const MAX = 500;
  const DESIGNS = [
    { id: "pink", name: "Pink Cloud", icon: "bi-balloon-heart-fill" },
    { id: "rainbow", name: "Rainbow", icon: "bi-rainbow" },
    { id: "sky", name: "Sky Dream", icon: "bi-cloud-sun-fill" },
    { id: "mint", name: "Mint Sparkle", icon: "bi-stars" },
    { id: "butter", name: "Birthday", icon: "bi-cake2-fill" },
    { id: "lilac", name: "Snip Snip", icon: "bi-scissors" },
    { id: "night", name: "Starry Night", icon: "bi-moon-stars-fill" }
  ];
  const IDEAS = [
    ["Birthday", "Happy birthday! Enjoy a dreamy pamper day 💖"],
    ["Thank you", "Thank you so much! Treat yourself to something sparkly ✨"],
    ["Christmas", "Merry Christmas! A little magic for your next salon visit 🎄"],
    ["Just because", "Just because you’re awesome. Have fun at Dream Cuts! 🌈"]
  ];

  const state = {
    type: "amount",
    amount: 50,
    custom: false,
    category: (data.categories || []).find((c) => c.id !== "all")?.id || "little",
    serviceId: null,
    design: "pink",
    to: "",
    from: "",
    message: "",
    deliver: "recipient",
    toEmail: "",
    fromEmail: "",
    date: ""
  };

  // Prefill from URL: gift-cards.html?service=first-cut or ?amount=75
  const params = new URLSearchParams(location.search);
  const svcParam = (data.services || []).find((s) => s.id === params.get("service"));
  if (svcParam) Object.assign(state, { type: "service", serviceId: svcParam.id, category: svcParam.category });
  const amtParam = Number(params.get("amount"));
  if (amtParam >= MIN && amtParam <= MAX) Object.assign(state, { amount: amtParam, custom: !AMOUNTS.includes(amtParam) });

  const service = () => (data.services || []).find((s) => s.id === state.serviceId);
  const value = () => (state.type === "amount" ? state.amount : service()?.price || 0);
  const valid = () => (state.type === "amount" ? state.amount >= MIN && state.amount <= MAX : !!service());
  const giftLabel = () => {
    if (state.type === "service") return service() ? service().name : "Choose a service";
    return valid() ? `${money(state.amount)} gift card` : "Choose an amount";
  };

  /* ---------- Location ---------- */
  if (data.location) {
    $("#gcLocName").textContent = data.location.name;
    $("#gcLocAddr").textContent = data.location.address;
  }

  /* ---------- Type tabs ---------- */
  const tabs = document.querySelectorAll(".gc-seg [role=tab]");
  const setType = (type, focus) => {
    state.type = type;
    tabs.forEach((t) => {
      const on = t.dataset.type === type;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $("#panelAmount").hidden = type !== "amount";
    $("#panelService").hidden = type !== "service";
    update();
  };
  tabs.forEach((t) => {
    t.addEventListener("click", () => setType(t.dataset.type));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") setType(state.type === "amount" ? "service" : "amount", true);
    });
  });

  /* ---------- Amounts ---------- */
  const amountsEl = $("#gcAmounts");
  amountsEl.setAttribute("role", "radiogroup");
  amountsEl.setAttribute("aria-label", "Gift card amount");
  amountsEl.innerHTML = AMOUNTS.map(
    (a) => `<button type="button" class="gc-amt" role="radio" data-amt="${a}"><strong>$${a}</strong><small>${money(a)} gift card</small></button>`
  ).join("");
  const customInput = $("#gcCustom");
  const paintAmounts = () => {
    amountsEl.querySelectorAll(".gc-amt").forEach((b) => b.setAttribute("aria-checked", String(!state.custom && Number(b.dataset.amt) === state.amount)));
    $("#gcCustomWrap").classList.toggle("is-on", state.custom);
  };
  amountsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".gc-amt");
    if (!b) return;
    state.amount = Number(b.dataset.amt);
    state.custom = false;
    customInput.value = "";
    hideErr("#errAmount");
    update();
  });
  const onCustom = () => {
    const v = parseFloat(customInput.value);
    if (customInput.value === "") {
      state.custom = false;
      state.amount = 0;
    } else {
      state.custom = true;
      state.amount = Math.round((isNaN(v) ? 0 : v) * 100) / 100;
    }
    hideErr("#errAmount");
    update();
  };
  customInput.addEventListener("input", onCustom);
  customInput.addEventListener("focus", () => { if (customInput.value) onCustom(); });
  customInput.addEventListener("blur", () => {
    if (state.custom && !valid()) showErr("#errAmount", `Custom amounts must be between $${MIN} and $${MAX}.`);
  });
  if (state.custom) customInput.value = state.amount;

  /* ---------- Services ---------- */
  const cats = (data.categories || []).filter((c) => c.id !== "all");
  const catsEl = $("#gcCats");
  catsEl.innerHTML = cats.map((c) => `<button type="button" data-cat="${c.id}">${esc(c.label)}</button>`).join("");
  const svcEl = $("#gcServices");
  const paintServices = () => {
    catsEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.category)));
    const list = (data.services || []).filter((s) => s.category === state.category);
    svcEl.innerHTML = list
      .map(
        (s) => `<button type="button" class="gc-svc" role="radio" aria-checked="${s.id === state.serviceId}" data-svc="${s.id}">
          <b>${esc(s.name)}</b><span class="p">${money(s.price)}</span>
          <span class="d">${esc(s.blurb || "")}</span>
          <span class="t"><i class="bi bi-clock"></i> ${s.duration} min</span>
        </button>`
      )
      .join("");
  };
  catsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    state.category = b.dataset.cat;
    paintServices();
  });
  svcEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-svc]");
    if (!b) return;
    state.serviceId = b.dataset.svc;
    svcEl.querySelectorAll(".gc-svc").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    hideErr("#errService");
    update();
  });

  /* ---------- Designs ---------- */
  const designsEl = $("#gcDesigns");
  designsEl.innerHTML = DESIGNS.map(
    (d) => `<button type="button" class="gc-design" role="radio" data-design="${d.id}"><span class="sw" data-design="${d.id}"><i class="bi ${d.icon}"></i></span><small>${d.name}</small></button>`
  ).join("");
  designsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-design]");
    if (!b) return;
    state.design = b.dataset.design;
    update();
  });

  /* ---------- Personalise ---------- */
  const bindText = (sel, key, after) => {
    const el = $(sel);
    el.addEventListener("input", () => {
      state[key] = el.value;
      el.removeAttribute("aria-invalid");
      if (after) after();
      update();
    });
    return el;
  };
  bindText("#gcTo", "to", () => hideErr("#errNames"));
  bindText("#gcFrom", "from", () => hideErr("#errNames"));
  const msgEl = bindText("#gcMsg", "message");
  $("#gcIdeas").innerHTML = IDEAS.map((i, n) => `<button type="button" data-idea="${n}">${i[0]}</button>`).join("");
  $("#gcIdeas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-idea]");
    if (!b) return;
    msgEl.value = IDEAS[b.dataset.idea][1];
    state.message = msgEl.value;
    update();
  });

  /* ---------- Delivery ---------- */
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateEl = $("#gcDate");
  dateEl.min = iso(today);
  const maxD = new Date(today);
  maxD.setFullYear(maxD.getFullYear() + 1);
  dateEl.max = iso(maxD);
  dateEl.value = state.date = iso(today);
  dateEl.addEventListener("change", () => { state.date = dateEl.value || iso(today); update(); });
  document.querySelectorAll("input[name=deliver]").forEach((r) =>
    r.addEventListener("change", () => {
      state.deliver = r.value;
      hideErr("#errDelivery");
      update();
    })
  );
  bindText("#gcToEmail", "toEmail", () => hideErr("#errDelivery"));
  bindText("#gcFromEmail", "fromEmail", () => hideErr("#errDelivery"));

  /* ---------- Rendering ---------- */
  const design = () => DESIGNS.find((d) => d.id === state.design) || DESIGNS[0];
  const cardHTML = () => {
    const s = service();
    let val;
    if (state.type === "service") val = s ? `<div class="gc-value v-svc">${esc(s.name)}</div>` : `<div class="gc-value v-empty">Pick a service</div>`;
    else val = valid() ? `<div class="gc-value v-amt">${money(state.amount).replace(".00", "")}</div>` : `<div class="gc-value v-empty">Pick an amount</div>`;
    return `
      <i class="bi ${design().icon} gc-motif" aria-hidden="true"></i>
      <div class="gc-row"><img class="gc-logo" src="assets/img/logo-cloud.png" alt="Dream Cuts"><span class="gc-label">${state.type === "service" ? "Service" : "Amount"}<br>gift card</span></div>
      ${val}
      <div class="gc-names">
        <div><small>To</small><b>${esc(state.to.trim() || "Someone special")}</b></div>
        <div><small>From</small><b>${esc(state.from.trim() || "You")}</b></div>
      </div>`;
  };
  const prettyDate = (v) => {
    if (!v || v === iso(today)) return "Today";
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  };
  const backHTML = (code) => `
      <div class="msg ${state.message.trim() ? "" : "empty"}">${state.message.trim() ? esc(state.message.trim()).replace(/\n/g, "<br>") : "Your personal message will appear here."}</div>
      <div class="sig">— ${esc(state.from.trim() || "You")}</div>
      <div class="foot"><span>${esc(data.location?.name || "Dream Cuts")}<br>Valid 3 years from purchase</span><span style="text-align:right">Code<br><strong>${code || "DC-XXXX-XXXX"}</strong></span></div>`;

  const preview = $("#gcPreview");
  function update() {
    preview.dataset.design = state.design;
    preview.innerHTML = cardHTML();
    preview.setAttribute("aria-label", `${giftLabel()} for ${state.to || "someone special"}`);
    paintAmounts();
    designsEl.querySelectorAll(".gc-design").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.design === state.design)));
    $("#gcTypeTag").textContent = state.type === "service" ? "Service gift card" : "Amount gift card";
    $("#sumGift").textContent = giftLabel();
    $("#sumTo").textContent = state.to.trim() || "—";
    $("#sumFrom").textContent = state.from.trim() || "—";
    $("#sumDeliver").textContent = `${state.deliver === "me" ? "Email to me" : "Email recipient"} · ${prettyDate(state.date)}`;
    $("#gcMsgCount").textContent = state.message.length;
    $("#recipientEmailWrap").hidden = state.deliver !== "recipient";
    const total = valid() ? money(value()) : "$0.00";
    $("#sumTotal").textContent = total;
    $("#barTotal").textContent = total;
    const barCard = $("#barCard");
    barCard.dataset.design = state.design;
    barCard.innerHTML = cardHTML();
    $("#barLabel").textContent = valid() ? giftLabel() : "Gift card";
    if (viewDlg.open) paintBig();
  }

  /* ---------- Validation ---------- */
  function showErr(sel, msg) { const el = $(sel); el.textContent = msg; el.hidden = false; }
  function hideErr(sel) { $(sel).hidden = true; }
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  function validate() {
    let first = null;
    const flag = (el) => { el.setAttribute("aria-invalid", "true"); first = first || el; };
    if (state.type === "amount" && !valid()) {
      showErr("#errAmount", state.custom ? `Custom amounts must be between $${MIN} and $${MAX}.` : "Please choose an amount.");
      first = first || (state.custom ? customInput : amountsEl.querySelector(".gc-amt"));
    }
    if (state.type === "service" && !valid()) {
      showErr("#errService", "Please choose a service to gift.");
      first = first || catsEl.querySelector("button");
    }
    const missing = [];
    if (!state.to.trim()) { flag($("#gcTo")); missing.push("who it’s to"); }
    if (!state.from.trim()) { flag($("#gcFrom")); missing.push("who it’s from"); }
    if (missing.length) showErr("#errNames", `Please add ${missing.join(" and ")}.`);
    const dErr = [];
    if (state.deliver === "recipient" && !emailOk(state.toEmail)) { flag($("#gcToEmail")); dErr.push("the recipient’s email"); }
    if (!emailOk(state.fromEmail)) { flag($("#gcFromEmail")); dErr.push("your email"); }
    if (dErr.length) showErr("#errDelivery", `Please enter a valid ${dErr.join(" and ")}.`);
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.focus({ preventScroll: true });
      return false;
    }
    return true;
  }

  /* ---------- Dialogs ---------- */
  const viewDlg = $("#viewDlg");
  const payDlg = $("#payDlg");
  const flip = $("#gcFlip");
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  [viewDlg, payDlg].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  function paintBig(code) {
    const big = $("#gcBig");
    big.dataset.design = state.design;
    big.innerHTML = cardHTML();
    $("#gcBack").innerHTML = backHTML(code);
  }
  $("#gcViewBtn").addEventListener("click", () => {
    flip.classList.remove("is-flipped");
    paintBig();
    viewDlg.showModal();
  });
  preview.addEventListener("click", () => $("#gcViewBtn").click());
  preview.style.cursor = "zoom-in";
  $("#gcFlipBtn").addEventListener("click", () => flip.classList.toggle("is-flipped"));
  flip.addEventListener("click", () => flip.classList.toggle("is-flipped"));

  const openCheckout = () => {
    if (!validate()) return;
    $("#payView").hidden = false;
    $("#doneView").hidden = true;
    $("#payTitle").textContent = "Checkout";
    $("#paySum").innerHTML = `<div class="gcard" data-design="${state.design}">${cardHTML()}</div>
      <div><b>${esc(giftLabel())}</b><span>For ${esc(state.to.trim())}</span></div><strong>${money(value())}</strong>`;
    $("#payBtn").textContent = `Pay ${money(value())}`;
    hideErr("#errPay");
    payDlg.showModal();
  };
  $("#gcBuy").addEventListener("click", openCheckout);
  $("#barBuy").addEventListener("click", openCheckout);

  // Card input formatting
  const num = $("#cardNum");
  num.addEventListener("input", () => { num.value = num.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 "); });
  const exp = $("#cardExp");
  exp.addEventListener("input", () => {
    const d = exp.value.replace(/\D/g, "").slice(0, 4);
    exp.value = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
  });
  const cvc = $("#cardCvc");
  cvc.addEventListener("input", () => { cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4); });

  const makeCode = () => {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
    return `DC-${part()}-${part()}`;
  };

  $("#payForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#cardName").value.trim();
    const digits = num.value.replace(/\D/g, "");
    const [mm, yy] = exp.value.split("/").map((x) => Number(x.trim()));
    const now = new Date();
    const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm) > now;
    let msg = "";
    if (!name) msg = "Please enter the name on the card.";
    else if (digits.length < 15) msg = "Please enter a valid card number.";
    else if (!expOk) msg = "Please enter a valid expiry date.";
    else if (cvc.value.length < 3) msg = "Please enter the CVC.";
    if (msg) { showErr("#errPay", msg); return; }

    const btn = $("#payBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing…';
    setTimeout(() => {
      const code = makeCode();
      const record = {
        code,
        type: state.type,
        amount: value(),
        serviceId: state.type === "service" ? state.serviceId : null,
        serviceName: state.type === "service" ? service()?.name : null,
        design: state.design,
        to: state.to.trim(),
        from: state.from.trim(),
        message: state.message.trim(),
        deliver: state.deliver,
        toEmail: state.deliver === "recipient" ? state.toEmail.trim() : null,
        fromEmail: state.fromEmail.trim(),
        sendDate: state.date,
        location: data.location?.id,
        createdAt: new Date().toISOString()
      };
      try {
        const all = JSON.parse(localStorage.getItem("dreamcuts_giftcards") || "[]");
        all.push(record);
        localStorage.setItem("dreamcuts_giftcards", JSON.stringify(all));
      } catch (err) { /* demo only */ }

      btn.disabled = false;
      $("#payForm").reset();
      $("#payView").hidden = true;
      $("#doneView").hidden = false;
      $("#payTitle").textContent = "All done";
      $("#doneCode").textContent = code;
      const who = state.deliver === "recipient" ? state.toEmail.trim() : state.fromEmail.trim();
      $("#doneText").textContent =
        `Your ${giftLabel()} for ${state.to.trim()} will be emailed to ${who} ${state.date === iso(today) ? "shortly" : "on " + prettyDate(state.date)}.`;
    }, 900);
  });

  $("#doneAgain").addEventListener("click", () => {
    payDlg.close();
    ["#gcTo", "#gcMsg", "#gcToEmail"].forEach((s) => ($(s).value = ""));
    Object.assign(state, { to: "", message: "", toEmail: "" });
    update();
    $("#gcForm").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- Mobile bottom bar: show while the summary card is off-screen ---------- */
  const bar = $("#gcBar");
  const sideCard = document.querySelector(".gc-side-card");
  $("#barThumb").addEventListener("click", () => $("#gcViewBtn").click());

  // Mobile: show the live preview at the top of the builder instead of after it.
  // The element is moved (not cloned) so its handlers keep working.
  const block = $("#gcPreviewBlock");
  const slot = $("#gcMSlot");
  const anchor = document.createComment("gc-preview");
  block.before(anchor);
  const mobile = window.matchMedia("(max-width: 960px)");
  const placePreview = () => (mobile.matches ? slot.appendChild(block) : anchor.after(block));
  placePreview();
  mobile.addEventListener("change", placePreview);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => bar.classList.toggle("is-on", !en.isIntersecting), { threshold: 0.05 }).observe(sideCard);
  }

  // Initial paint
  paintServices();
  setType(state.type);
})();
