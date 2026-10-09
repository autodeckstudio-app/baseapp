// AutoDeck site â reveals, nav state, hero parallax, grand-opening countdown
(function () {
  "use strict";

  // Reveal on scroll
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  // Nav background after scroll
  var nav = document.getElementById("nav");
  var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 40); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Hero glow follows pointer (desktop only)
  var glow = document.getElementById("heroGlow");
  var fine = window.matchMedia("(pointer: fine)").matches;
  if (glow && fine) {
    var tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 90;
      ty = (e.clientY / window.innerHeight - 0.5) * 60;
    }, { passive: true });
    (function tick() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      glow.style.transform = "translate(calc(-50% + " + cx.toFixed(1) + "px), calc(-58% + " + cy.toFixed(1) + "px))";
      requestAnimationFrame(tick);
    })();
  }

  // Countdown to grand opening: 11 Oct 2026, 10:00 IST
  var target = Date.UTC(2026, 9, 11, 4, 30, 0); // 10:00 IST = 04:30 UTC
  var d = document.getElementById("cdD"), h = document.getElementById("cdH"),
      m = document.getElementById("cdM"), s = document.getElementById("cdS"),
      label = document.getElementById("cdLabel"), timer = document.getElementById("cdTimer");
  function pad(n) { return String(n).padStart(2, "0"); }
  function tickCd() {
    var diff = target - Date.now();
    if (diff <= 0) {
      label.textContent = "Now open Â· Ellisbridge, Ahmedabad";
      timer.style.display = "none";
      return;
    }
    d.textContent = pad(Math.floor(diff / 86400000));
    h.textContent = pad(Math.floor(diff / 3600000) % 24);
    m.textContent = pad(Math.floor(diff / 60000) % 60);
    s.textContent = pad(Math.floor(diff / 1000) % 60);
    setTimeout(tickCd, 1000);
  }
  tickCd();
})();
