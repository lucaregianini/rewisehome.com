// rewisehome.com checkout (copied to checkout.js only in REWISE_CHECKOUT=sandbox or live builds; see Docs/STRIPE_CHECKOUT.md).
// The Rewise server decides the product, price, stock and delivery; this page only says which checkout it is (a random
// token kept in this browser) and mounts Stripe's embedded Checkout with the session's client secret.
(function () {
  "use strict";
  var root = document.querySelector("[data-checkout-api]");
  if (!root) return;
  var API = root.getAttribute("data-checkout-api");
  // The mode this page was built for. It works only with a server in the same mode with keys of the same kind, so a
  // sandbox page never takes a real payment and a live page never shows a test checkout; anything else reads as off.
  var MODE = root.getAttribute("data-checkout-mode") === "live" ? "live" : "sandbox";
  var STRIPE_PREFIX = MODE === "live" ? "live_" : "test_";
  function usable(config) {
    return !!(config && config.enabled && config.mode === MODE && typeof config.publishableKey === "string" &&
      config.publishableKey.indexOf("pk_" + STRIPE_PREFIX) === 0);
  }
  function ours(sessionId) { return typeof sessionId === "string" && sessionId.indexOf("cs_" + STRIPE_PREFIX) === 0; }
  // The checkout this browser is buying with: {token, sessionId}. Only the checkout page starts or replaces it.
  // A confirmation page never reads its own order from here (its URL says which order it is), and clears it only
  // when it is provably the same order, so an older confirmation can't touch a newer checkout.
  var KEY = "rewise.checkout";

  function active() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return saved && typeof saved.token === "string" ? saved : {};
    } catch (e) { return {}; }
  }
  function setActive(value) {
    try { if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY); } catch (e) {}
  }
  function newToken() {
    var bytes = new Uint8Array(32);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var text = "";
    for (var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
    return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function call(method, path, body) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 25000);
    return fetch(API + path, {
      method: method, headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined, signal: controller ? controller.signal : undefined, credentials: "omit"
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { status: response.status, body: data };
      });
    }, function () {
      return { status: 0, body: { state: "offline" } };
    }).then(function (result) { if (timer) clearTimeout(timer); return result; });
  }
  function wait(seconds) { return new Promise(function (resolve) { setTimeout(resolve, seconds * 1000); }); }

  // ------------------------------------------------------------ Order page: Buy card
  var buy = document.querySelector("[data-buy]");
  // The server says only "available", "temporarily_unavailable" or "sold_out": never how many are left.
  if (buy) {
    var buyState = document.querySelector("[data-buy-state]");
    var href = buy.getAttribute("href");
    var setBuy = function (enabled, label) {
      buy.textContent = label;
      if (enabled) { buy.setAttribute("href", href); buy.removeAttribute("aria-disabled"); }
      else { buy.removeAttribute("href"); buy.setAttribute("aria-disabled", "true"); }
    };
    var showAvailability = function (tries) {
      call("GET", "/v1/checkout/config").then(function (result) {
        var config = result.body || {};
        document.querySelector("[data-buy-soldout]").hidden = true;
        if (!usable(config)) {
          buy.hidden = true;
          buyState.hidden = true;
          document.querySelector("[data-buy-note]").hidden = true;
          document.querySelector("[data-buy-off]").hidden = false;
          return;
        }
        if (config.availability === "sold_out") {
          setBuy(false, "Sold Out");
          buyState.textContent = "Rewise Air is sold out for now.";
          buyState.hidden = false;
          document.querySelector("[data-buy-soldout]").hidden = false;
        } else if (config.availability === "temporarily_unavailable") {
          // Unpaid checkouts hold every unit for now; they're not sold. Look again in a while.
          setBuy(false, "Buy Now");
          buyState.textContent = "Checkout is temporarily unavailable. Please try again shortly.";
          buyState.hidden = false;
          if (tries < 10) setTimeout(function () { showAvailability(tries + 1); }, 30000);
        } else {
          setBuy(true, "Buy Now");
          buyState.hidden = true;
        }
      });
    };
    showAvailability(0);
  }

  // ------------------------------------------------------------ Checkout page
  var mountPoint = document.getElementById("checkout");
  if (mountPoint) {
    var status = document.querySelector("[data-status]");
    var statusText = document.querySelector("[data-status-text]");
    var errorBox = document.querySelector("[data-error]");
    var errorActions = document.querySelector("[data-error-actions]");
    var fail = function (message, enquire) {
      status.hidden = true;
      mountPoint.setAttribute("aria-busy", "false");
      errorBox.textContent = message;
      errorBox.hidden = false;
      errorActions.hidden = false;
      errorActions.querySelector(".link-arrow").hidden = !enquire;
      errorBox.focus();
    };
    document.querySelector("[data-retry]").addEventListener("click", function () { location.reload(); });

    // The order this page is paying for, once known; the watcher and the recovery link use it.
    var checkoutToken = "";
    var toOrder = function () { location.replace("order#t=" + encodeURIComponent(checkoutToken)); };
    var help = document.querySelector("[data-checkout-help]");

    // Stripe sends the buyer to /order?session_id=… after paying. If that doesn't happen (or the form ends on
    // Stripe's "You're all done here"), this notices from our server, which asks Stripe itself: paid, processing,
    // expired or failed all go to this order's own confirmation page. The browser is never the proof of payment.
    var watch = function () {
      var started = Date.now();
      var timer = null;
      var check = function () {
        timer = null;
        if (document.hidden) return;  // resumes when the page is visible again (e.g. back from a bank app)
        call("POST", "/v1/checkout/status", { token: checkoutToken }).then(function (result) {
          var state = (result.body || {}).state;
          if (state === "paid" || state === "processing" || state === "received" || state === "expired" || state === "failed") return toOrder();
          if (Date.now() - started < 50 * 60 * 1000) timer = setTimeout(check, 6000);
        });
      };
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden && timer === null) check();
      });
      timer = setTimeout(check, 6000);
      // A way out that doesn't depend on any of that: after a while, a link to this order's status page.
      setTimeout(function () {
        help.querySelector("[data-order-link]").setAttribute("href", "order#t=" + encodeURIComponent(checkoutToken));
        help.hidden = false;
      }, 20000);
    };

    // Ask the server for this browser's checkout: a new one, or the one already started (never two).
    var fetchClientSecret = function () {
      var token = active().token || newToken();
      setActive({ token: token });
      var attempt = function (tries) {
        return call("POST", "/v1/checkout/sessions", { token: token }).then(function (result) {
          var body = result.body || {};
          if (body.clientSecret && !ours(body.sessionId)) {  // the server changed mode since the page loaded
            var other = new Error("Online checkout isn’t open right now. Send us an enquiry and we’ll email you.");
            other.state = "unavailable";
            throw other;
          }
          if (body.clientSecret) {
            setActive({ token: token, sessionId: body.sessionId || "" });
            checkoutToken = token;
            watch();
            return body.clientSecret;
          }
          if (body.state === "paid" || body.state === "processing" || body.state === "received") {
            // Already bought: show that order's own confirmation. The token rides in the #fragment, which
            // isn't sent to the web server, so the page reloads as the same order.
            location.href = "order#t=" + encodeURIComponent(token);
            return new Promise(function () {});
          }
          if ((body.state === "expired" || body.state === "failed") && tries < 3) {
            token = newToken();  // that checkout is over; start a fresh one
            setActive({ token: token });
            return attempt(tries + 1);
          }
          if ((body.state === "retry" || body.state === "offline") && tries < 3) {
            statusText.textContent = "Still connecting…";
            return wait(1.5 * (tries + 1)).then(function () { return attempt(tries + 1); });
          }
          var problem = new Error((body.error && body.error.message) ||
            (body.state === "offline" ? "Couldn’t reach Rewise. Check your connection and try again." : "Checkout couldn’t start. Try again in a moment."));
          problem.state = body.state;
          throw problem;
        });
      };
      return attempt(0);
    };

    call("GET", "/v1/checkout/config").then(function (result) {
      var config = result.body || {};
      if (!usable(config)) {
        if (result.status === 0) throw new Error("Couldn’t reach Rewise. Check your connection and try again.");
        var closed = new Error("Online checkout isn’t open right now. Send us an enquiry and we’ll email you.");
        closed.state = "unavailable";
        throw closed;
      }
      var banner = config.mode === "sandbox" && document.querySelector("[data-test-banner]");
      if (banner) banner.hidden = false;
      if (typeof window.Stripe !== "function") throw new Error("The secure payment form didn’t load. Check your connection and try again.");
      var stripe = window.Stripe(config.publishableKey);
      return stripe.createEmbeddedCheckoutPage({ fetchClientSecret: fetchClientSecret });
    }).then(function (checkout) {
      checkout.mount("#checkout");
      status.hidden = true;
      mountPoint.setAttribute("aria-busy", "false");
    }).catch(function (problem) {
      var state = problem && problem.state;
      fail(problem && problem.message ? problem.message : "Checkout couldn’t start. Try again in a moment.",
        state === "sold_out" || state === "unavailable" || state === "temporarily_unavailable" || state === "busy");
    });
  }

  // ------------------------------------------------------------ Confirmation page (Stripe's return URL)
  var orderPage = document.querySelector("[data-order-page]");
  if (orderPage) {
    // Which order this page is about comes only from its own address: Stripe's return (?session_id=) or the
    // recovery route (#t=token). Never from whichever checkout happens to be active in this browser.
    var sessionId = new URLSearchParams(location.search).get("session_id") || "";
    var token = sessionId ? "" : new URLSearchParams((location.hash || "").slice(1)).get("t") || "";
    if (sessionId && !ours(sessionId)) sessionId = "";  // another environment's session: not an order this page shows
    var show = function (state, reference) {
      orderPage.querySelectorAll("[data-state]").forEach(function (block) {
        var on = block.getAttribute("data-state") === state;
        if (on && block.hidden) {
          block.hidden = false;
          var heading = block.querySelector("h1");
          if (heading && state !== "loading") heading.focus();
        } else if (!on) {
          block.hidden = true;
        }
      });
      if (reference) orderPage.querySelectorAll("[data-reference]").forEach(function (el) { el.textContent = "Order " + reference; });
    };
    if (!sessionId && !token) {
      show("unknown");
    } else {
      // A slow webhook only delays this page: the server checks with Stripe while we ask, for about ten minutes.
      // "open" is never taken as final here: arriving from Stripe, our server may not have heard yet, or Stripe
      // may be slow to answer. So it reads "Checking your payment…" for the first minute, then "We haven't
      // received your payment yet", and keeps checking either way. No link to the checkout page while the outcome
      // is uncertain: it opens whichever checkout this browser holds, maybe another order. When the checking
      // ends, the page stops promising to update itself and offers "Check payment status" for this same order.
      var delays = [0, 2, 2, 3, 3, 4, 5, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 120, 120];
      var CHECKING = 11;  // polls (about a minute) during which "open" still reads as "Checking your payment…"
      var ask = function () {
        return call("POST", "/v1/checkout/status", sessionId ? { sessionId: sessionId } : { token: token }).then(function (result) {
          var body = result.body || {};
          return { state: result.status === 404 ? "unknown" : body.state, reference: body.reference };
        });
      };
      // Shows a final answer and returns true; anything else (open, processing, no answer) isn't one.
      var settled = function (answer) {
        if (answer.state === "paid" || answer.state === "received") {
          // Done: if this is the browser's active checkout, the next purchase starts afresh. A newer checkout
          // (another order) is left alone.
          var current = active();
          if (current.token && ((token && current.token === token) || (sessionId && current.sessionId === sessionId))) setActive(null);
          show(answer.state, answer.reference);
          return true;
        }
        if (answer.state === "expired" || answer.state === "failed" || answer.state === "unknown") {
          show(answer.state, answer.reference);
          return true;
        }
        return false;
      };
      var stop = function (answer) { show(answer.state === "open" ? "stalled" : "slow", answer.reference); };
      var poll = function (index) {
        ask().then(function (answer) {
          if (settled(answer)) return;
          if (answer.state === "processing") show("processing", answer.reference);
          if (answer.state === "open") show(index < CHECKING ? "loading" : "open", answer.reference);
          if (index + 1 >= delays.length) return stop(answer);
          setTimeout(function () { poll(index + 1); }, delays[index + 1] * 1000);
        });
      };
      // One more look at this order when the buyer asks; it never starts or resumes a payment.
      var buttons = orderPage.querySelectorAll("[data-recheck]");
      var asking = false;
      buttons.forEach(function (button) {
        button.addEventListener("click", function () {
          if (asking) return;
          asking = true;
          buttons.forEach(function (b) { b.disabled = true; b.textContent = "Checking…"; });
          ask().then(function (answer) {
            asking = false;
            buttons.forEach(function (b) { b.disabled = false; b.textContent = "Check payment status"; });
            if (settled(answer)) return;
            stop(answer);
            var now = new Date();
            var time = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
            orderPage.querySelectorAll("[data-checked]").forEach(function (note) {
              note.textContent = (answer.state === "open" || answer.state === "processing" ? "Not confirmed yet" :
                "Couldn’t reach Rewise") + " (checked at " + time + ").";
              note.hidden = false;
            });
          });
        });
      });
      poll(0);
    }
  }
})();
