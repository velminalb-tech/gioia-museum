/* ============================================================
   login.js — the private entrance.
   This is a decorative gate only. The password lives in
   data/birthday.json and is visible to anyone who reads the
   source, which is fine for a personal surprise website.
   ============================================================ */

import { normaliseAnswer, setText } from "./content.js";

export const AUTH_KEY = "gioia:authenticated";

export function createLogin(content, { onSuccess }) {
  const screen = document.getElementById("screen-login");
  const form = document.getElementById("login-form");
  const card = screen.querySelector(".login__card");
  const input = document.getElementById("password");
  const error = document.getElementById("login-error");
  const hint = document.getElementById("login-hint");
  const hintToggle = document.getElementById("hint-toggle");
  const reveal = document.getElementById("reveal-password");

  const password = String(content.site.password ?? "love");
  let attempts = 0;
  let leaving = false;

  screen.querySelectorAll("[data-copy]").forEach((node) => {
    const key = node.getAttribute("data-copy");
    const value = key.split(".").reduce((obj, part) => (obj == null ? obj : obj[part]), content);
    if (value != null) node.textContent = String(value);
  });

  input.placeholder = content.login.placeholder || "What I call you";
  hint.textContent = content.site.passwordHint || "";
  error.textContent = "";
  hint.hidden = true;
  hintToggle.setAttribute("aria-expanded", "false");

  function hideHint() {
    hint.hidden = true;
    hintToggle.setAttribute("aria-expanded", "false");
  }

  function showHint() {
    if (!hint.textContent) return;
    hint.hidden = false;
    hintToggle.setAttribute("aria-expanded", "true");
  }

  hintToggle.addEventListener("click", () => {
    if (hint.hidden) showHint();
    else hideHint();
  });

  reveal.addEventListener("click", () => {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    reveal.setAttribute("aria-pressed", String(!showing));
    reveal.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    input.focus({ preventScroll: true });
  });

  input.addEventListener("input", () => {
    error.classList.remove("is-visible");
    error.textContent = "";
  });

  function fail() {
    attempts += 1;
    error.textContent = content.login.error || "Not quite. Try again.";
    error.classList.add("is-visible");
    card.classList.remove("is-shaking");
    // Restart the shake animation.
    void card.offsetWidth;
    card.classList.add("is-shaking");
    window.setTimeout(() => card.classList.remove("is-shaking"), 600);
    if (attempts >= 3) showHint();
    input.select();
  }

  function succeed() {
    if (leaving) return;
    leaving = true;
    sessionStorage.setItem(AUTH_KEY, "1");
    hideHint();
    error.classList.remove("is-visible");
    error.textContent = "";

    const finish = () => {
      leaving = false;
      hide();
      onSuccess?.();
    };

    if (window.gsap) {
      window.gsap.to(screen, {
        opacity: 0,
        duration: 0.65,
        ease: "power2.inOut",
        onComplete: () => {
          screen.style.opacity = "";
          finish();
        }
      });
    } else {
      screen.style.opacity = "0";
      window.setTimeout(() => {
        screen.style.opacity = "";
        finish();
      }, 450);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answer = normaliseAnswer(input.value);
    if (!answer) {
      error.textContent = "The door needs a word first.";
      error.classList.add("is-visible");
      input.focus();
      return;
    }
    if (normaliseAnswer(password) && answer === normaliseAnswer(password)) succeed();
    else fail();
  });

  function show() {
    screen.hidden = false;
    screen.classList.remove("is-ready");
    // Reset after a previous fade.
    screen.style.opacity = "";
    input.value = "";
    input.type = "password";
    reveal.setAttribute("aria-pressed", "false");
    reveal.setAttribute("aria-label", "Show password");
    hideHint();
    error.classList.remove("is-visible");
    error.textContent = "";
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        screen.classList.add("is-ready");
        window.setTimeout(() => {
          if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
        }, 500);
      });
    });
  }

  function hide() {
    screen.hidden = true;
    screen.classList.remove("is-ready");
  }

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === "1";
  }

  function lockAgain() {
    sessionStorage.removeItem(AUTH_KEY);
    attempts = 0;
    show();
  }

  return { show, hide, isAuthenticated, lockAgain, screen, input };
}
