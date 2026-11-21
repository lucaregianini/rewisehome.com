// rewisehome.com: mobile menu, scroll reveals and staggered grids, count-up numbers, films, the enquiry form and the compatibility checker.
// Rewise Air is on sale at rewisehome.com/get (€27.99, Stripe checkout); the enquiry form is for questions and Rewise Home.
(function () {
  "use strict";
  var SIGNUP_URL = "https://api.rewisehome.com/v1/signups";

  // Old links end in .html; show the short address GitHub Pages also serves (/features, not /features.html).
  if (/\.html$/.test(location.pathname) && window.history && history.replaceState) {
    history.replaceState(null, "", location.pathname.replace(/(index)?\.html$/, "") + location.search + location.hash);
  }

  // Mobile menu
  var nav = document.querySelector(".nav");
  var menu = document.querySelector(".menu-button");
  if (nav && menu) {
    menu.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menu.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && nav.classList.contains("open")) {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.focus();
      }
    });
  }

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Grids come in one item after another (styles.css: .stagger)
  if (!still && "IntersectionObserver" in window) {
    document.querySelectorAll(".bento, .steps, .stats, .spec-chips, .needs, .rail, .plans, .status-list, .brands, .how-order, .app-cards")
      .forEach(function (grid) {
        grid.classList.add("stagger");
        Array.prototype.forEach.call(grid.children, function (child, i) { child.style.setProperty("--i", Math.min(i, 12)); });
        if (!grid.closest(".reveal") && !grid.classList.contains("reveal")) grid.classList.add("reveal");
      });
  }

  // Phones: the order bar slides up once the hero has scrolled away, and steps aside at the footer
  var buybar = document.querySelector("[data-buybar]");
  if (buybar) {
    var hero = document.querySelector("main > section");
    var foot = document.querySelector("footer");
    var placeBar = function () {
      var past = hero ? hero.getBoundingClientRect().bottom < 0 : scrollY > 500;
      var atFoot = foot ? foot.getBoundingClientRect().top < innerHeight - 40 : false;
      var show = past && !atFoot;
      buybar.classList.toggle("show", show);
      buybar.setAttribute("aria-hidden", show ? "false" : "true");
      buybar.querySelector("a").tabIndex = show ? 0 : -1;
    };
    addEventListener("scroll", placeBar, { passive: true });
    addEventListener("resize", placeBar);
    placeBar();
  }

  // Savings calculator: seasonal average draw × hours × days × price (the same rough model as the app's estimates)
  document.querySelectorAll("[data-calc]").forEach(function (calc) {
    var price = parseFloat(calc.getAttribute("data-price")) || 0.13, PRICE_AIR = 27.99;
    var q = function (sel) { return calc.querySelector(sel); };
    var out = function (name, text) { var el = q('[data-out="' + name + '"]'); if (el) el.textContent = text; };
    var euro = function (n) { return "€" + n.toFixed(2); };
    var update = function () {
      var watts = parseFloat(q("[data-calc-size]").value), acs = +q("[data-calc-acs]").value;
      var hours = +q("[data-calc-hours]").value, saved = Math.min(+q("[data-calc-saved]").value, hours);
      var perHour = watts / 1000 * price * acs, cost = perHour * hours * 30, save = perHour * saved * 30;
      out("acs", acs); out("hours", hours); out("saved", saved);
      out("cost", euro(cost)); out("save", euro(save));
      var wrap = q('[data-out-wrap="payback"]');
      if (save > 0) {
        var months = Math.ceil(PRICE_AIR * acs / save);  // one Rewise Air per AC
        out("payback", months > 36 ? "more than 3 years" : months === 1 ? "a month" : months + " months");
        wrap.hidden = false;
      } else { wrap.hidden = true; }
      var share = cost > 0 ? save / cost * 100 : 0;
      q("[data-bar-keep]").style.flexBasis = (100 - share) + "%";
      q("[data-bar-save]").style.flexBasis = share + "%";
    };
    calc.addEventListener("input", update);
    update();
  });

  // Numbers count up the first time they're seen
  function countUp(el) {
    var end = parseFloat(el.getAttribute("data-count")), suffix = el.getAttribute("data-suffix") || "", start = null;
    function step(time) {
      if (start === null) start = time;
      var t = Math.min((time - start) / 1200, 1), eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(end * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    el.textContent = "0" + suffix;
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && !still && "IntersectionObserver" in window) {
    var counting = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { countUp(entry.target); counting.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { counting.observe(el); });
  }

  // Films play muted while on screen; the button turns the sound on
  var films = document.querySelectorAll("video[data-film]");
  if (films.length) {
    var playing = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting && !still) { video.play().catch(function () {}); } else { video.pause(); }
      });
    }, { threshold: 0.5 }) : null;
    films.forEach(function (video) {
      if (playing) playing.observe(video);
      var sound = video.parentNode.querySelector("[data-film-sound]");
      if (sound) sound.addEventListener("click", function () {
        video.muted = !video.muted;
        if (!video.muted) video.play().catch(function () {});
        sound.setAttribute("aria-pressed", video.muted ? "false" : "true");
        sound.setAttribute("aria-label", video.muted ? "Turn sound on" : "Turn sound off");
      });
    });
  }

  // Reveal sections as they scroll in
  var reveals = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || still) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); observer.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { observer.observe(el); });
  }

  // Enquiry form: name + email, emailed to Rewise by the Rewise server.
  document.querySelectorAll("form.signup").forEach(function (form) {
    var error = form.querySelector(".form-error");
    var button = form.querySelector("button[type=submit]");
    var label = button.textContent;
    function fail(message, field) {
      error.textContent = message;
      if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
      var name = form.elements.name, email = form.elements.email;
      if (!name.value.trim()) return fail("Enter your name.", name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail("Enter an email address like name@example.com.", email);
      button.disabled = true;
      button.textContent = "Sending…";
      fetch(SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.value.trim(), email: email.value.trim(),
          country: form.elements.country ? form.elements.country.value : "",
          plan: form.querySelector("input[name=plan]:checked") ? form.querySelector("input[name=plan]:checked").value : "air",
          website: form.elements.website ? form.elements.website.value : ""
        })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) {
          if (!response.ok) throw new Error((body.error && body.error.message) || "Something went wrong. Try again.");
        });
      }).then(function () {
        var first = name.value.trim().split(" ")[0];
        // An enquiry form says what it is (data-done-*); the order form keeps its wording.
        var title = form.getAttribute("data-done-title") || "Order received.";
        var text = form.getAttribute("data-done-text") ||
          "We’ll email " + email.value.trim() + " with your order confirmation, payment details and delivery time.";
        form.innerHTML = '<div class="form-done" role="status"><div class="check" aria-hidden="true">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
          "<h3></h3><p></p></div>";
        form.querySelector(".form-done h3").textContent = title;
        form.querySelector(".form-done p").textContent = "Thanks, " + first + ". " + text;
      }).catch(function (problem) {
        button.disabled = false;
        button.textContent = label;
        fail(problem && problem.message && problem.message !== "Failed to fetch" ? problem.message
          : "Couldn’t reach Rewise. Check your connection, or email support@rewisehome.com.");
      });
    });
  });

  // "Ask About Rewise Home" on the Rewise Home card picks that plan in the enquiry form.
  document.querySelectorAll("[data-plan]").forEach(function (link) {
    link.addEventListener("click", function () {
      var radio = document.querySelector('form.signup input[name=plan][value="' + link.dataset.plan + '"]');
      if (radio) radio.checked = true;
    });
  });
  if (location.hash === "#home-plan") {
    var home = document.querySelector('form.signup input[name=plan][value="home"]');
    if (home) home.checked = true;
  }

  // Compatibility checker
  var search = document.getElementById("brand-search");
  if (search) {
    var chips = Array.prototype.slice.call(document.querySelectorAll(".brands span"));
    var result = document.getElementById("brand-result");
    var clean = function (text) { return text.toLowerCase().replace(/[^a-z0-9]/g, ""); };
    search.addEventListener("input", function () {
      var query = clean(search.value);
      var starts = function (n) { return query.length > 1 && clean(n).indexOf(query) === 0; };
      // A brand's own name beats another brand's alias: "midea" is Midea, not Carrier ("Midea Carrier").
      var named = chips.filter(function (chip) { return starts(chip.textContent); });
      var matches = named.length ? named : chips.filter(function (chip) {
        return (chip.dataset.aka || "").split("|").some(function (n) { return n && starts(n); });
      });
      chips.forEach(function (chip) { chip.classList.toggle("hit", matches.indexOf(chip) !== -1); });
      if (chips.length) chips[0].parentNode.classList.toggle("searching", matches.length > 0);
      var hit = matches[0] || null;
      if (!query) { result.textContent = ""; return; }
      result.innerHTML = "";
      var b = document.createElement("b");
      if (hit) {
        b.textContent = hit.textContent;
        result.append(b, " is built in. Rewise Air recognises it from one press of your remote.");
      } else if (query.length > 1) {
        b.textContent = search.value.trim();
        result.append(b, " works too: Rewise Air learns the buttons straight from your remote.");
      }
    });
  }
})();
