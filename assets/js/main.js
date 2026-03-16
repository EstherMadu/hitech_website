const root = document.documentElement;
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const siteState = {
  themeOptions: [],
  themeIcon: null,
  themeLabel: null,
  header: null,
  backToTopButton: null,
  heroCarousel: null,
  projectFilterButtons: [],
  projectsGrid: null,
  projectTiles: [],
  galleryCards: [],
  gallerySpotlightPanel: null,
  gallerySpotlightTrigger: null,
  gallerySpotlightImage: null,
  gallerySpotlightRegion: null,
  gallerySpotlightTitle: null,
  gallerySpotlightText: null,
  gallerySpotlightLocation: null,
  gallerySpotlightDiscipline: null,
  gallerySpotlightLink: null,
  partnersCarousel: null,
  partnersTrack: null,
  partnersAdvanceTimeout: null,
  partnersResumeTimeout: null,
  partnerCurrentIndex: 0,
  partnerVisibleCount: 5,
  partnerStepSize: 0,
};

function readCachedPartial(source) {
  try {
    return window.sessionStorage.getItem(`partial:${source}`);
  } catch (error) {
    return null;
  }
}

function writeCachedPartial(source, markup) {
  try {
    window.sessionStorage.setItem(`partial:${source}`, markup);
  } catch (error) {
    // Ignore storage quota or privacy-mode failures and continue.
  }
}

async function loadSharedPartials() {
  const includeMounts = Array.from(document.querySelectorAll("[data-include]"));

  await Promise.all(
    includeMounts.map(async (mount) => {
      const source = mount.dataset.include;
      if (!source) {
        return;
      }

      try {
        const cachedMarkup = readCachedPartial(source);
        if (cachedMarkup) {
          mount.outerHTML = cachedMarkup;
          return;
        }

        const response = await fetch(source, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(`Failed to load ${source}: ${response.status}`);
        }

        const markup = await response.text();
        writeCachedPartial(source, markup);
        mount.outerHTML = markup;
      } catch (error) {
        console.error(error);
      }
    }),
  );
}

function cacheDom() {
  siteState.themeOptions = Array.from(document.querySelectorAll("[data-theme-value]"));
  siteState.themeIcon = document.querySelector(".theme-icon-active");
  siteState.themeLabel = document.querySelector(".theme-toggle-label");
  siteState.header = document.querySelector(".header-sticky");
  siteState.backToTopButton = document.querySelector(".back-to-top");
  siteState.heroCarousel = document.querySelector("[data-hero-carousel]");
  siteState.projectFilterButtons = Array.from(document.querySelectorAll("[data-project-filter]"));
  siteState.projectsGrid = document.querySelector("[data-projects-grid]");
  siteState.projectTiles = Array.from(document.querySelectorAll("[data-project-location]"));
  siteState.galleryCards = Array.from(document.querySelectorAll("[data-gallery-card]"));
  siteState.gallerySpotlightPanel = document.querySelector("[data-gallery-spotlight]");
  siteState.gallerySpotlightTrigger = document.querySelector("[data-gallery-spotlight-trigger]");
  siteState.gallerySpotlightImage = document.querySelector("[data-gallery-spotlight-image]");
  siteState.gallerySpotlightRegion = document.querySelector("[data-gallery-spotlight-region]");
  siteState.gallerySpotlightTitle = document.querySelector("[data-gallery-spotlight-title]");
  siteState.gallerySpotlightText = document.querySelector("[data-gallery-spotlight-text]");
  siteState.gallerySpotlightLocation = document.querySelector("[data-gallery-spotlight-location]");
  siteState.gallerySpotlightDiscipline = document.querySelector("[data-gallery-spotlight-discipline]");
  siteState.gallerySpotlightLink = document.querySelector("[data-gallery-spotlight-link]");
  siteState.partnersCarousel = document.querySelector("[data-partners-carousel]");
  siteState.partnersTrack = document.querySelector("[data-partners-track]");
}

function loadDeferredBackground(element) {
  if (!element) {
    return;
  }

  const source = element.dataset.bg;
  if (!source) {
    return;
  }

  if (element.style.backgroundImage) {
    element.dataset.bgLoaded = "true";
    return;
  }

  if (element.dataset.bgLoaded === "true") {
    return;
  }

  element.style.backgroundImage = `url("${source}")`;
  element.dataset.bgLoaded = "true";
}

function setSubscribeStatus(form, state, message) {
  const statusNode = form.parentElement?.querySelector("[data-subscribe-status]");
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message || "";
  if (message) {
    statusNode.dataset.state = state;
  } else {
    delete statusNode.dataset.state;
  }
}

function bindNewsletterForms() {
  document.querySelectorAll("[data-subscribe-form]").forEach((form) => {
    if (form.dataset.subscribeBound === "true") {
      return;
    }

    form.addEventListener("submit", async (event) => {
      if (typeof window.fetch === "undefined") {
        return;
      }

      event.preventDefault();

      const submitButton = form.querySelector(".newsletter-card__submit");
      const emailInput = form.querySelector("input[name='email']");
      const emailValue = emailInput?.value.trim() || "";

      if (!emailValue) {
        setSubscribeStatus(form, "error", "Please enter a valid email address.");
        emailInput?.focus();
        return;
      }

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
      }

      form.setAttribute("aria-busy", "true");
      setSubscribeStatus(form, "pending", "Submitting your details...");

      try {
        const response = await fetch(form.action, {
          method: form.method || "POST",
          body: new FormData(form),
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        const payload = await response.json().catch(() => ({
          ok: false,
          message: "We could not save your details right now.",
        }));

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "We could not save your details right now.");
        }

        form.reset();
        setSubscribeStatus(form, "success", payload.message || "Thanks for subscribing.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "We could not save your details right now.";
        setSubscribeStatus(form, "error", message);
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
        }

        form.removeAttribute("aria-busy");
      }
    });

    form.dataset.subscribeBound = "true";
  });
}

function hydrateSubscribeStatusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const subscribeState = params.get("subscribe");
  if (!subscribeState) {
    return;
  }

  const form = document.querySelector("[data-subscribe-form]");
  if (!form) {
    return;
  }

  const messages = {
    success: {
      state: "success",
      message: "Thanks for subscribing. We will keep you updated.",
    },
    duplicate: {
      state: "success",
      message: "You are already subscribed with this email address.",
    },
    invalid: {
      state: "error",
      message: "Please enter a valid email address.",
    },
    error: {
      state: "error",
      message: "We could not save your details right now.",
    },
  };

  const resolved = messages[subscribeState];
  if (!resolved) {
    return;
  }

  setSubscribeStatus(form, resolved.state, resolved.message);
  params.delete("subscribe");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function setContactStatus(form, state, message) {
  const statusNode = form.parentElement?.querySelector("[data-contact-status]");
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message || "";
  if (message) {
    statusNode.dataset.state = state;
  } else {
    delete statusNode.dataset.state;
  }
}

function bindContactForms() {
  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    if (form.dataset.contactBound === "true") {
      return;
    }

    form.addEventListener("submit", async (event) => {
      if (typeof window.fetch === "undefined") {
        return;
      }

      event.preventDefault();

      const submitButton = form.querySelector(".contact-form__submit");
      const fullNameInput = form.querySelector("input[name='full_name']");
      const emailInput = form.querySelector("input[name='email']");
      const messageInput = form.querySelector("textarea[name='message']");

      if (!fullNameInput?.value.trim() || !emailInput?.value.trim() || !messageInput?.value.trim()) {
        setContactStatus(form, "error", "Please complete the required contact fields.");
        return;
      }

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
      }

      form.setAttribute("aria-busy", "true");
      setContactStatus(form, "pending", "Sending your inquiry...");

      try {
        const response = await fetch(form.action, {
          method: form.method || "POST",
          body: new FormData(form),
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        const payload = await response.json().catch(() => ({
          ok: false,
          message: "We could not send your inquiry right now.",
        }));

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "We could not send your inquiry right now.");
        }

        form.reset();
        setContactStatus(form, "success", payload.message || "Thanks for reaching out.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "We could not send your inquiry right now.";
        setContactStatus(form, "error", message);
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
        }

        form.removeAttribute("aria-busy");
      }
    });

    form.dataset.contactBound = "true";
  });
}

function hydrateContactStatusFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const contactState = params.get("contact");
  if (!contactState) {
    return;
  }

  const form = document.querySelector("[data-contact-form]");
  if (!form) {
    return;
  }

  const messages = {
    success: {
      state: "success",
      message: "Thanks for reaching out. Our team will get back to you shortly.",
    },
    invalid: {
      state: "error",
      message: "Please complete the required contact fields.",
    },
    error: {
      state: "error",
      message: "We could not send your inquiry right now.",
    },
  };

  const resolved = messages[contactState];
  if (!resolved) {
    return;
  }

  setContactStatus(form, resolved.state, resolved.message);
  params.delete("contact");
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function setReportStatus(form, state, message) {
  const statusNode = form.parentElement?.querySelector("[data-report-status]");
  if (!statusNode) {
    return;
  }

  statusNode.textContent = message || "";
  if (message) {
    statusNode.dataset.state = state;
  } else {
    delete statusNode.dataset.state;
  }
}

function bindReportForms() {
  document.querySelectorAll("[data-report-form]").forEach((form) => {
    if (form.dataset.reportBound === "true") {
      return;
    }

    const storageKey = `report-draft:${window.location.pathname}`;
    const clearButton = form.querySelector("[data-report-clear]");

    const restoreDraft = () => {
      try {
        const rawDraft = localStorage.getItem(storageKey);
        if (!rawDraft) {
          return;
        }

        const draft = JSON.parse(rawDraft);
        if (!draft || typeof draft !== "object") {
          return;
        }

        Object.entries(draft).forEach(([name, value]) => {
          const field = form.elements.namedItem(name);
          if (field instanceof RadioNodeList) {
            Array.from(field).forEach((option) => {
              if (option instanceof HTMLInputElement) {
                option.checked = option.value === String(value);
              }
            });
            return;
          }

          if (
            field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement ||
            field instanceof HTMLSelectElement
          ) {
            field.value = typeof value === "string" ? value : "";
          }
        });

        setReportStatus(form, "success", "Saved draft restored on this device.");
      } catch (error) {
        setReportStatus(form, "error", "We found a saved draft, but it could not be restored.");
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {};
      for (const [name, value] of new FormData(form).entries()) {
        payload[name] = String(value);
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setReportStatus(form, "success", "Draft saved on this device. You can return and continue editing later.");
      } catch (error) {
        setReportStatus(form, "error", "We could not save the draft in this browser.");
      }
    });

    if (clearButton instanceof HTMLButtonElement) {
      clearButton.addEventListener("click", () => {
        form.reset();

        try {
          localStorage.removeItem(storageKey);
          setReportStatus(form, "success", "Draft cleared from this device.");
        } catch (error) {
          setReportStatus(form, "error", "We could not clear the saved draft in this browser.");
        }
      });
    }

    restoreDraft();
    form.dataset.reportBound = "true";
  });
}

function bindHeroCarousel() {
  if (!siteState.heroCarousel) {
    return;
  }

  const activeSlide = siteState.heroCarousel.querySelector(".carousel-item.active .hero-slide");
  const nextSlide =
    siteState.heroCarousel.querySelector(".carousel-item.active")?.nextElementSibling?.querySelector(".hero-slide") ||
    siteState.heroCarousel.querySelector(".carousel-item .hero-slide");

  loadDeferredBackground(activeSlide);
  loadDeferredBackground(nextSlide);

  siteState.heroCarousel.addEventListener("slide.bs.carousel", (event) => {
    const upcomingSlide = event.relatedTarget?.querySelector(".hero-slide");
    const followingSlide =
      event.relatedTarget?.nextElementSibling?.querySelector(".hero-slide") ||
      siteState.heroCarousel.querySelector(".carousel-item .hero-slide");

    loadDeferredBackground(upcomingSlide);
    loadDeferredBackground(followingSlide);
  });
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

function themeLabelText(theme) {
  if (theme === "light") {
    return "Light";
  }

  if (theme === "dark") {
    return "Dark";
  }

  return "Auto";
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

  if (siteState.themeLabel) {
    siteState.themeLabel.textContent = themeLabelText(theme);
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

  if (siteState.galleryCards.length > 0) {
    const visibleGalleryCards = siteState.galleryCards.filter((card) => !card.hidden);
    const activeGalleryCard = visibleGalleryCards.find((card) => card.classList.contains("is-active"));
    updateGallerySpotlight(activeGalleryCard || visibleGalleryCards[0] || siteState.galleryCards[0]);
  }
}

function buildSpotlightText(card) {
  const image = card?.querySelector(".nigeria-gallery-card__image");
  if (image?.alt) {
    return `Hitech project archive image showing ${image.alt.charAt(0).toLowerCase()}${image.alt.slice(1)}.`;
  }

  const fallbackText = card?.querySelector(".nigeria-gallery-card__text")?.textContent?.trim();
  if (fallbackText) {
    return fallbackText;
  }

  return "Hitech project archive selection from the Nigeria gallery.";
}

function updateGallerySpotlight(card, scrollIntoView = false) {
  if (!card || !siteState.gallerySpotlightPanel) {
    return;
  }

  const image = card.querySelector(".nigeria-gallery-card__image");
  const title = card.querySelector(".nigeria-gallery-card__title")?.textContent?.trim() || "Hitech Project";
  const region = card.querySelector(".nigeria-gallery-card__region")?.textContent?.trim() || "Hitech Project Archive";
  const discipline = card.querySelector(".nigeria-gallery-card__discipline")?.textContent?.trim() || "Project Gallery";
  const spotlightEyebrow = document.body.dataset.galleryEyebrow || "Hitech Project Archive";
  const link = card.dataset.projectLink || "";

  siteState.galleryCards.forEach((galleryCard) => {
    const isActive = galleryCard === card;
    galleryCard.classList.toggle("is-active", isActive);
    galleryCard.setAttribute("aria-pressed", String(isActive));
  });

  if (siteState.gallerySpotlightImage && image) {
    siteState.gallerySpotlightImage.src = image.currentSrc || image.src;
    siteState.gallerySpotlightImage.alt = image.alt;
  }

  if (siteState.gallerySpotlightRegion) {
    siteState.gallerySpotlightRegion.textContent = spotlightEyebrow;
  }

  if (siteState.gallerySpotlightTitle) {
    siteState.gallerySpotlightTitle.textContent = title;
  }

  if (siteState.gallerySpotlightText) {
    siteState.gallerySpotlightText.textContent = buildSpotlightText(card);
  }

  if (siteState.gallerySpotlightLocation) {
    siteState.gallerySpotlightLocation.textContent = region;
  }

  if (siteState.gallerySpotlightDiscipline) {
    siteState.gallerySpotlightDiscipline.textContent = discipline;
  }

  if (siteState.gallerySpotlightLink) {
    if (link) {
      siteState.gallerySpotlightLink.href = link;
      siteState.gallerySpotlightLink.hidden = false;
    } else {
      siteState.gallerySpotlightLink.hidden = true;
      siteState.gallerySpotlightLink.removeAttribute("href");
    }
  }

  if (scrollIntoView) {
    siteState.gallerySpotlightPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bindNigeriaGallerySpotlight() {
  if (siteState.galleryCards.length === 0 || !siteState.gallerySpotlightPanel) {
    return;
  }

  siteState.galleryCards.forEach((card) => {
    card.addEventListener("click", () => {
      updateGallerySpotlight(card);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      updateGallerySpotlight(card);
    });
  });

  if (siteState.gallerySpotlightTrigger) {
    siteState.gallerySpotlightTrigger.addEventListener("click", () => {
      const nextCard = siteState.galleryCards.find((card) => !card.hidden) || siteState.galleryCards[0];
      updateGallerySpotlight(nextCard, true);
    });
  }

  const initialCard = siteState.galleryCards.find((card) => card.classList.contains("is-active")) || siteState.galleryCards[0];
  updateGallerySpotlight(initialCard);
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
  bindHeroCarousel();
  bindThemeOptions();
  applyActiveNavigation();
  bindDesktopDropdownHover();
  bindNewsletterForms();
  hydrateSubscribeStatusFromUrl();
  bindContactForms();
  hydrateContactStatusFromUrl();
  bindReportForms();
  bindNigeriaGallerySpotlight();
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
