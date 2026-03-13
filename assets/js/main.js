const root = document.documentElement;
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const siteState = {
  themeOptions: [],
  themeIcon: null,
  header: null,
  backToTopButton: null,
  projectFilterButtons: [],
  projectsGrid: null,
  projectTiles: [],
  partnersCarousel: null,
  partnersTrack: null,
  partnersAdvanceTimeout: null,
  partnersResumeTimeout: null,
  partnerCurrentIndex: 0,
  partnerVisibleCount: 5,
  partnerStepSize: 0,
};

async function loadSharedPartials() {
  const includeMounts = Array.from(document.querySelectorAll("[data-include]"));

  await Promise.all(
    includeMounts.map(async (mount) => {
      const source = mount.dataset.include;
      if (!source) {
        return;
      }

      try {
        const response = await fetch(source, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(`Failed to load ${source}: ${response.status}`);
        }

        mount.outerHTML = await response.text();
      } catch (error) {
        console.error(error);
      }
    }),
  );
}

function cacheDom() {
  siteState.themeOptions = Array.from(document.querySelectorAll("[data-theme-value]"));
  siteState.themeIcon = document.querySelector(".theme-icon-active");
  siteState.header = document.querySelector(".header-sticky");
  siteState.backToTopButton = document.querySelector(".back-to-top");
  siteState.projectFilterButtons = Array.from(document.querySelectorAll("[data-project-filter]"));
  siteState.projectsGrid = document.querySelector("[data-projects-grid]");
  siteState.projectTiles = Array.from(document.querySelectorAll("[data-project-location]"));
  siteState.partnersCarousel = document.querySelector("[data-partners-carousel]");
  siteState.partnersTrack = document.querySelector("[data-partners-track]");
}

function resolveTheme(theme) {
  return theme === "auto" ? (darkQuery.matches ? "dark" : "light") : theme;
}

function iconMarkup(theme) {
  if (theme === "light") {
    return '<path d="M8 0a.5.5 0 0 1 .5.5v1.57a.5.5 0 0 1-1 0V.5A.5.5 0 0 1 8 0zm0 11.93a.5.5 0 0 1 .5.5V14a.5.5 0 0 1-1 0v-1.57a.5.5 0 0 1 .5-.5zM16 8a.5.5 0 0 1-.5.5h-1.57a.5.5 0 0 1 0-1h1.57A.5.5 0 0 1 16 8zM2.07 8a.5.5 0 0 1-.5.5H0a.5.5 0 0 1 0-1h1.57a.5.5 0 0 1 .5.5zm10.14 4.95a.5.5 0 0 1 0 .71l-1.11 1.11a.5.5 0 0 1-.71-.71l1.11-1.11a.5.5 0 0 1 .71 0zM4.61 5.35a.5.5 0 0 1 0 .71L3.5 7.17a.5.5 0 1 1-.71-.71L3.9 5.35a.5.5 0 0 1 .71 0zm7.6-2.56a.5.5 0 0 1 .71 0l1.11 1.11a.5.5 0 1 1-.71.71L12.21 3.5a.5.5 0 0 1 0-.71zM4.61 10.65a.5.5 0 0 1 .71 0l1.11 1.11a.5.5 0 0 1-.71.71L4.61 11.36a.5.5 0 0 1 0-.71zM8 4.25a3.75 3.75 0 1 1 0 7.5a3.75 3.75 0 0 1 0-7.5z"></path>';
  }

  if (theme === "dark") {
    return '<path d="M6 0a.75.75 0 0 1 .75.84A6.5 6.5 0 0 0 15.16 9.25a.75.75 0 0 1 .84.75A7.75 7.75 0 1 1 6 0z"></path>';
  }

  return '<path d="M8 15A7 7 0 1 0 8 1v14zm0 1A8 8 0 1 1 8 0a8 8 0 0 1 0 16z"></path>';
}

function applyTheme(theme) {
  const resolvedTheme = resolveTheme(theme);
  root.setAttribute("data-bs-theme", resolvedTheme);
  root.dataset.themePreference = theme;

  siteState.themeOptions.forEach((option) => {
    option.classList.toggle("active", option.dataset.themeValue === theme);
  });

  if (siteState.themeIcon) {
    siteState.themeIcon.innerHTML = iconMarkup(theme);
  }
}

function syncTheme(theme) {
  localStorage.setItem("theme", theme);
  applyTheme(theme);
}

function bindThemeOptions() {
  siteState.themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      syncTheme(option.dataset.themeValue);
    });
  });
}

function handleStickyHeader() {
  if (!siteState.header) {
    return;
  }

  siteState.header.classList.toggle("header-sticky-on", window.scrollY > 20);
}

function handleBackToTopVisibility() {
  if (!siteState.backToTopButton) {
    return;
  }

  siteState.backToTopButton.classList.toggle("is-visible", window.scrollY > 500);
}

function bindDesktopDropdownHover() {
  if (window.innerWidth < 1200 || typeof bootstrap === "undefined") {
    return;
  }

  document.querySelectorAll(".navbar .dropdown").forEach((dropdown) => {
    if (dropdown.dataset.hoverBound === "true") {
      return;
    }

    const toggle = dropdown.querySelector(":scope > [data-bs-toggle='dropdown']");
    if (!toggle) {
      return;
    }

    const instance = bootstrap.Dropdown.getOrCreateInstance(toggle);

    dropdown.addEventListener("mouseenter", () => {
      instance.show();
    });

    dropdown.addEventListener("mouseleave", () => {
      instance.hide();
    });

    dropdown.dataset.hoverBound = "true";
  });
}

function applyActiveNavigation() {
  const currentPage = document.body.dataset.page || "";
  const currentParent = document.body.dataset.navParent || "";

  document.querySelectorAll("[data-nav-target]").forEach((link) => {
    const isActive = link.dataset.navTarget === currentPage;
    link.classList.toggle("active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  document.querySelectorAll("[data-nav-parent-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.navParentLink === currentParent);
  });
}

function applyProjectFilter(filterValue) {
  if (!siteState.projectsGrid || siteState.projectTiles.length === 0) {
    return;
  }

  const isAll = filterValue === "all";

  siteState.projectFilterButtons.forEach((button) => {
    const isActive = button.dataset.projectFilter === filterValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  siteState.projectTiles.forEach((tile) => {
    const matches = isAll || tile.dataset.projectLocation === filterValue;
    tile.hidden = !matches;
  });

  siteState.projectsGrid.classList.toggle("projects-grid--filtered", !isAll);
}

function stopPartnersCarousel() {
  window.clearTimeout(siteState.partnersAdvanceTimeout);
  window.clearTimeout(siteState.partnersResumeTimeout);
  siteState.partnersAdvanceTimeout = null;
  siteState.partnersResumeTimeout = null;
}

function queuePartnersAdvance() {
  if (!siteState.partnersCarousel || !siteState.partnersTrack || reducedMotionQuery.matches) {
    return;
  }

  stopPartnersCarousel();
  siteState.partnersAdvanceTimeout = window.setTimeout(() => {
    const originalCount = Number(siteState.partnersCarousel.dataset.originalCount || "0");
    if (originalCount <= 1) {
      return;
    }

    siteState.partnerCurrentIndex += 1;
    siteState.partnersTrack.style.transition = "transform 0.55s ease";
    siteState.partnersTrack.style.transform = `translateX(-${siteState.partnerCurrentIndex * siteState.partnerStepSize}px)`;
  }, 2200);
}

function setupPartnersCarousel() {
  if (!siteState.partnersCarousel || !siteState.partnersTrack) {
    return;
  }

  stopPartnersCarousel();

  Array.from(siteState.partnersTrack.querySelectorAll("[data-partner-clone='true']")).forEach((item) => {
    item.remove();
  });

  const originalItems = Array.from(siteState.partnersTrack.children);
  if (originalItems.length === 0) {
    return;
  }

  const styles = getComputedStyle(siteState.partnersCarousel);
  siteState.partnerVisibleCount = Number.parseInt(styles.getPropertyValue("--partner-visible"), 10) || 5;
  const gap = Number.parseFloat(styles.getPropertyValue("--partner-gap")) || 0;
  const itemWidth = (siteState.partnersCarousel.clientWidth - gap * (siteState.partnerVisibleCount - 1)) / siteState.partnerVisibleCount;

  siteState.partnersCarousel.style.setProperty("--partner-item-width", `${itemWidth}px`);
  siteState.partnersCarousel.dataset.originalCount = String(originalItems.length);

  originalItems.slice(0, siteState.partnerVisibleCount).forEach((item) => {
    const clone = item.cloneNode(true);
    clone.dataset.partnerClone = "true";
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("img").forEach((image) => {
      image.alt = "";
    });
    siteState.partnersTrack.appendChild(clone);
  });

  siteState.partnerStepSize = itemWidth + gap;
  siteState.partnerCurrentIndex = 0;
  siteState.partnersTrack.style.transition = "none";
  siteState.partnersTrack.style.transform = "translateX(0)";

  if (!reducedMotionQuery.matches) {
    queuePartnersAdvance();
  }
}

function handlePartnersTransitionEnd() {
  if (!siteState.partnersCarousel || !siteState.partnersTrack) {
    return;
  }

  const originalCount = Number(siteState.partnersCarousel.dataset.originalCount || "0");
  if (siteState.partnerCurrentIndex < originalCount) {
    queuePartnersAdvance();
    return;
  }

  siteState.partnersTrack.style.transition = "none";
  siteState.partnerCurrentIndex = 0;
  siteState.partnersTrack.style.transform = "translateX(0)";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      queuePartnersAdvance();
    });
  });
}

function bindProjectFilters() {
  siteState.projectFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyProjectFilter(button.dataset.projectFilter);
    });
  });

  if (siteState.projectFilterButtons.length > 0) {
    const defaultButton =
      siteState.projectFilterButtons.find((button) => button.classList.contains("is-active")) ||
      siteState.projectFilterButtons[0];

    applyProjectFilter(defaultButton?.dataset.projectFilter || "all");
  }
}

function bindPartnersCarousel() {
  if (!siteState.partnersTrack || !siteState.partnersCarousel) {
    return;
  }

  siteState.partnersTrack.addEventListener("transitionend", handlePartnersTransitionEnd);
  siteState.partnersCarousel.addEventListener("mouseenter", stopPartnersCarousel);
  siteState.partnersCarousel.addEventListener("mouseleave", queuePartnersAdvance);
  siteState.partnersCarousel.addEventListener("focusin", stopPartnersCarousel);
  siteState.partnersCarousel.addEventListener("focusout", queuePartnersAdvance);

  setupPartnersCarousel();
}

function bindGlobalEvents() {
  darkQuery.addEventListener("change", () => {
    applyTheme(localStorage.getItem("theme") || "auto");
  });

  reducedMotionQuery.addEventListener("change", setupPartnersCarousel);

  window.addEventListener(
    "scroll",
    () => {
      handleStickyHeader();
      handleBackToTopVisibility();
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    bindDesktopDropdownHover();
    setupPartnersCarousel();
  });

  if (siteState.backToTopButton) {
    siteState.backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

async function initSite() {
  await loadSharedPartials();
  cacheDom();
  bindThemeOptions();
  applyActiveNavigation();
  bindDesktopDropdownHover();
  bindProjectFilters();
  bindPartnersCarousel();
  bindGlobalEvents();
  handleStickyHeader();
  handleBackToTopVisibility();
  applyTheme(localStorage.getItem("theme") || root.dataset.themePreference || "auto");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSite, { once: true });
} else {
  initSite();
}
