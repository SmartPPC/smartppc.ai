// LinkedIn Insight Tag (partner 9809242) — loads only after the visitor accepts
// cookies (UK PECR / GDPR). Shared by every page: each page just includes this
// script; the consent banner is added here.
(() => {
  const PARTNER_ID = "9809242";
  const KEY = "smartppc-consent";
  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  const save = (value) => {
    try {
      if (value === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // storage blocked — the choice applies to this visit only
    }
  };
  const loadTag = () => {
    window._linkedin_partner_id = PARTNER_ID;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(PARTNER_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    document.head.appendChild(s);
  };
  const showBanner = () => {
    const banner = document.createElement("div");
    banner.className = "consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie choice");
    banner.innerHTML =
      '<p>We use a LinkedIn cookie to measure which ads bring people here. OK? <a href="privacy.html">Privacy</a></p>' +
      '<div><button class="pill pill--small" type="button" data-consent="yes">Accept</button>' +
      '<button class="link" type="button" data-consent="no">Decline</button></div>';
    banner.addEventListener("click", (e) => {
      const choice = e.target.closest("[data-consent]")?.dataset.consent;
      if (!choice) return;
      save(choice);
      banner.remove();
      if (choice === "yes") loadTag();
    });
    document.body.appendChild(banner);
  };

  // "Change your cookie choice" control (privacy page)
  document.querySelectorAll("[data-consent-reset]").forEach((btn) =>
    btn.addEventListener("click", () => {
      save(null);
      location.reload();
    }),
  );

  const choice = read();
  if (choice === "yes") loadTag();
  else if (choice !== "no") showBanner();
})();
