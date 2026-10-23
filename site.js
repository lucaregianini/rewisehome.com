// rewisehome.com: mobile menu, scroll reveals, the sign-up form and the compatibility checker.
(function () {
  "use strict";
  var SIGNUP_URL = "https://api.rewisehome.com/v1/signups";

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

  // Reveal sections as they scroll in
  var reveals = document.querySelectorAll(".reveal");
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  // Sign-up form: name + email, emailed to Rewise by the Rewise server.
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
        form.innerHTML = '<div class="form-done" role="status"><div class="check" aria-hidden="true">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
          "<h3>Order received.</h3><p></p></div>";
        form.querySelector(".form-done p").textContent = "Thanks, " + first + ". We’ll email " + email.value.trim() + " with your order confirmation, payment details and delivery time.";
      }).catch(function (problem) {
        button.disabled = false;
        button.textContent = label;
        fail(problem && problem.message && problem.message !== "Failed to fetch" ? problem.message
          : "Couldn’t reach Rewise. Check your connection, or email support@rewisehome.com.");
      });
    });
  });

  // "Register Interest" on the Rewise Home card picks that plan in the form.
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
      var hit = null;
      chips.forEach(function (chip) {
        var names = [chip.textContent].concat((chip.dataset.aka || "").split("|"));
        var match = query.length > 1 && names.some(function (n) { return clean(n).indexOf(query) === 0; });
        chip.classList.toggle("hit", match);
        if (match && !hit) hit = chip;
      });
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
