const NEWS_DATA_URL = "/assets/data/news-articles.json";
const NEWS_ADMIN_URL = "/api/news-admin.php";

let newsDataCache = null;

function escapeNewsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugifyNewsText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNewsUrl(value, fallback = "/contact/") {
  const input = String(value ?? "").trim();
  if (!input) {
    return fallback;
  }

  if (input.startsWith("/") && !input.startsWith("//")) {
    return input;
  }

  try {
    const parsed = new URL(input, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return input;
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
}

function normalizeNewsAssetUrl(value, fallback = "/assets/images/conn/home/1.JPG") {
  return normalizeNewsUrl(value, fallback);
}

function getNewsAdminEndpoint() {
  return document.body?.dataset?.newsAdminEndpoint || NEWS_ADMIN_URL;
}

function getNewsAdminCsrf() {
  return document.body?.dataset?.newsAdminCsrf || "";
}

function setNewsAdminCsrf(token) {
  if (document.body && token) {
    document.body.dataset.newsAdminCsrf = token;
  }
}

async function requestNewsAdmin(action, { method = "GET", body } = {}) {
  const url = `${getNewsAdminEndpoint()}?action=${encodeURIComponent(action)}`;
  const options = {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("The admin server returned an invalid response.");
  }

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "The admin request failed.");
  }

  if (payload.csrfToken) {
    setNewsAdminCsrf(payload.csrfToken);
  }

  return payload;
}

function formatNewsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Hitech update";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sortNewsArticles(first, second) {
  const firstTime = new Date(first.published).getTime();
  const secondTime = new Date(second.published).getTime();
  const safeFirst = Number.isNaN(firstTime) ? 0 : firstTime;
  const safeSecond = Number.isNaN(secondTime) ? 0 : secondTime;

  if (safeSecond !== safeFirst) {
    return safeSecond - safeFirst;
  }

  return first.title.localeCompare(second.title);
}

function normalizeNewsArticle(article) {
  if (!article || typeof article !== "object") {
    return null;
  }

  const title = String(article.title ?? "").trim() || "Untitled Article";
  const slug = slugifyNewsText(article.slug || title);

  if (!slug) {
    return null;
  }

  return {
    slug,
    title,
    category: String(article.category ?? "News").trim() || "News",
    published: String(article.published ?? "").trim(),
    readTime: String(article.readTime ?? "5 min read").trim() || "5 min read",
    author: String(article.author ?? "Hitech Communications").trim() || "Hitech Communications",
    location: String(article.location ?? "Nigeria").trim() || "Nigeria",
    summary: String(article.summary ?? "").trim(),
    image:
      normalizeNewsAssetUrl(
        String(article.image ?? "/assets/images/conn/home/1.JPG").trim(),
        "/assets/images/conn/home/1.JPG",
      ) || "/assets/images/conn/home/1.JPG",
    imageAlt: String(article.imageAlt ?? title).trim() || title,
    ctaLabel: String(article.ctaLabel ?? "Contact Hitech").trim() || "Contact Hitech",
    ctaUrl: normalizeNewsUrl(String(article.ctaUrl ?? "/contact/").trim(), "/contact/") || "/contact/",
    highlights: Array.isArray(article.highlights)
      ? article.highlights.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    body: String(article.body ?? "").trim(),
  };
}

function normalizeNewsData(data) {
  const settings =
    data && typeof data.settings === "object" && data.settings !== null ? { ...data.settings } : {};

  const articles = Array.isArray(data?.articles)
    ? data.articles.map(normalizeNewsArticle).filter(Boolean).sort(sortNewsArticles)
    : [];

  return {
    settings,
    articles,
  };
}

async function loadNewsData(forceRefresh = false) {
  if (!forceRefresh && newsDataCache) {
    return normalizeNewsData(newsDataCache);
  }

  const response = await fetch(NEWS_DATA_URL, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Failed to load news feed: ${response.status}`);
  }

  const payload = await response.json();
  newsDataCache = normalizeNewsData(payload);
  return normalizeNewsData(newsDataCache);
}

function getNewsArticleUrl(article) {
  return `/news/article/?slug=${encodeURIComponent(article.slug)}`;
}

function renderNewsRichText(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const chunks = [];
  let paragraphBuffer = [];
  let listBuffer = [];
  let quoteBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    chunks.push(`<p>${paragraphBuffer.map(escapeNewsHtml).join(" ")}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) {
      return;
    }

    chunks.push(
      `<ul>${listBuffer.map((item) => `<li>${escapeNewsHtml(item)}</li>`).join("")}</ul>`,
    );
    listBuffer = [];
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) {
      return;
    }

    chunks.push(
      `<blockquote><p>${quoteBuffer.map(escapeNewsHtml).join(" ")}</p></blockquote>`,
    );
    quoteBuffer = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushQuote();
      return;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushQuote();
      chunks.push(`<h2>${escapeNewsHtml(line.slice(3))}</h2>`);
      return;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      flushQuote();
      listBuffer.push(line.slice(2));
      return;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      quoteBuffer.push(line.slice(2));
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushList();
  flushQuote();

  if (chunks.length === 0) {
    return "<p>No article body has been added yet.</p>";
  }

  return chunks.join("");
}

function buildNewsHighlightsMarkup(article) {
  if (!article.highlights.length) {
    return '<p class="news-article__aside-copy">Key highlights will appear here whenever they are included with the story.</p>';
  }

  return `<ul class="news-article__highlights-list" role="list">${article.highlights
    .map((item) => `<li>${escapeNewsHtml(item)}</li>`)
    .join("")}</ul>`;
}

function buildNewsLeadMarkup(article) {
  return `
    <article class="news-story news-story--lead">
      <div class="news-story__media">
        <img src="${escapeNewsHtml(article.image)}" alt="${escapeNewsHtml(article.imageAlt)}" class="news-story__image" loading="lazy" decoding="async">
      </div>
      <div class="news-story__body">
        <div class="news-story__meta">
          <span class="news-story__tag">${escapeNewsHtml(article.category)}</span>
          <span class="news-story__date">${escapeNewsHtml(formatNewsDate(article.published))}</span>
        </div>
        <h3 class="news-story__title">${escapeNewsHtml(article.title)}</h3>
        <p class="news-story__text">${escapeNewsHtml(article.summary)}</p>
        <div class="news-story__actions">
          <a class="news-story__link" href="${escapeNewsHtml(getNewsArticleUrl(article))}">Read featured story</a>
          <a class="news-story__link news-story__link--ghost" href="${escapeNewsHtml(article.ctaUrl)}">${escapeNewsHtml(article.ctaLabel)}</a>
        </div>
      </div>
    </article>
  `;
}

function buildNewsCompactMarkup(article, accent = false) {
  return `
    <article class="news-story news-story--compact${accent ? " news-story--accent" : ""}">
      <div class="news-story__meta">
        <span class="news-story__tag">${escapeNewsHtml(article.category)}</span>
        <span class="news-story__date">${escapeNewsHtml(article.readTime)}</span>
      </div>
      <h3 class="news-story__title">${escapeNewsHtml(article.title)}</h3>
      <p class="news-story__text">${escapeNewsHtml(article.summary)}</p>
      <a class="news-story__link" href="${escapeNewsHtml(getNewsArticleUrl(article))}">Read story</a>
    </article>
  `;
}

function buildNewsCardMarkup(article) {
  return `
    <article class="news-card">
      <img src="${escapeNewsHtml(article.image)}" alt="${escapeNewsHtml(article.imageAlt)}" class="news-card__image" loading="lazy" decoding="async">
      <div class="news-card__body">
        <div class="news-card__meta">
          <span class="news-card__tag">${escapeNewsHtml(article.category)}</span>
          <span class="news-card__dot" aria-hidden="true"></span>
          <span class="news-card__time">${escapeNewsHtml(formatNewsDate(article.published))}</span>
        </div>
        <h3 class="news-card__title">${escapeNewsHtml(article.title)}</h3>
        <p class="news-card__text">${escapeNewsHtml(article.summary)}</p>
        <a class="news-card__link" href="${escapeNewsHtml(getNewsArticleUrl(article))}">Read update</a>
      </div>
    </article>
  `;
}

function setNewsMessage(container, title, text, variant = "empty") {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <article class="news-state news-state--${escapeNewsHtml(variant)}">
      <h3 class="news-state__title">${escapeNewsHtml(title)}</h3>
      <p class="news-state__text">${escapeNewsHtml(text)}</p>
    </article>
  `;
}

function updateNewsMeta(name, content) {
  const node = document.querySelector(`meta[name="${name}"]`);
  if (node && content) {
    node.setAttribute("content", content);
  }
}

function resolveNewsArticleSlug() {
  const params = new URLSearchParams(window.location.search);
  const slugFromQuery = params.get("slug");
  if (slugFromQuery) {
    return slugFromQuery;
  }

  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  const newsIndex = pathSegments.indexOf("news");
  if (newsIndex === -1) {
    return "";
  }

  const slugFromPath = pathSegments[newsIndex + 1];
  if (!slugFromPath || slugFromPath === "article" || slugFromPath === "studio") {
    return "";
  }

  return decodeURIComponent(slugFromPath);
}

function renderNewsListingPage(data) {
  const leadCard = document.querySelector("[data-news-feature-card]");
  const categoriesTrack = document.querySelector("[data-news-categories]");
  const featuredContainer = document.querySelector("[data-news-featured]");
  const latestContainer = document.querySelector("[data-news-latest]");
  const totalArticlesNode = document.querySelector("[data-news-total-articles]");
  const totalCategoriesNode = document.querySelector("[data-news-total-categories]");
  const newestDateNode = document.querySelector("[data-news-newest-date]");
  const settingsTitleNode = document.querySelector("[data-newsroom-title]");
  const settingsIntroNode = document.querySelector("[data-newsroom-intro]");
  const settingsSecondaryNode = document.querySelector("[data-newsroom-secondary]");
  const editorialDeskNode = document.querySelector("[data-news-editorial-desk]");
  const workflowCountNode = document.querySelector("[data-news-workflow-count]");

  if (settingsTitleNode && data.settings.newsroomTitle) {
    settingsTitleNode.textContent = data.settings.newsroomTitle;
  }

  if (settingsIntroNode && data.settings.newsroomIntro) {
    settingsIntroNode.textContent = data.settings.newsroomIntro;
  }

  if (settingsSecondaryNode && data.settings.newsroomSecondaryText) {
    settingsSecondaryNode.textContent = data.settings.newsroomSecondaryText;
  }

  if (editorialDeskNode instanceof HTMLAnchorElement && data.settings.editorialDeskUrl) {
    editorialDeskNode.href = data.settings.editorialDeskUrl;
    editorialDeskNode.textContent = data.settings.editorialDeskLabel || "Contact Hitech";
  }

  const articles = data.articles;
  const uniqueCategories = [...new Set(articles.map((article) => article.category))];
  const leadArticle = articles[0] || null;
  const featuredArticles = articles.slice(1, 3);
  const latestArticles = articles.slice(3);

  if (totalArticlesNode) {
    totalArticlesNode.textContent = String(articles.length).padStart(2, "0");
  }

  if (totalCategoriesNode) {
    totalCategoriesNode.textContent = String(uniqueCategories.length).padStart(2, "0");
  }

  if (newestDateNode) {
    newestDateNode.textContent = leadArticle ? formatNewsDate(leadArticle.published) : "No Hitech stories yet";
  }

  if (workflowCountNode) {
    workflowCountNode.textContent = String(articles.length);
  }

  if (categoriesTrack) {
    categoriesTrack.innerHTML = uniqueCategories.length
      ? uniqueCategories.map((category) => `<span class="news-strip">${escapeNewsHtml(category)}</span>`).join("")
      : '<span class="news-strip">Hitech updates coming soon</span>';
  }

  if (leadCard) {
    if (leadArticle) {
      leadCard.innerHTML = `
        <span class="news-hero__feature-label">Featured Hitech story</span>
        <h2 class="news-hero__feature-title">${escapeNewsHtml(leadArticle.title)}</h2>
        <p class="news-hero__feature-text">${escapeNewsHtml(leadArticle.summary)}</p>
        <a class="news-hero__feature-link" href="${escapeNewsHtml(getNewsArticleUrl(leadArticle))}">Read the featured story</a>
      `;
    } else {
      setNewsMessage(leadCard, "No featured story yet", "Featured Hitech updates will appear here once stories are available.");
    }
  }

  if (featuredContainer) {
    if (!leadArticle) {
      setNewsMessage(featuredContainer, "No stories yet", "Hitech project and company stories will appear here as they are published.");
    } else {
      const compactMarkup = featuredArticles
        .map((article, index) => buildNewsCompactMarkup(article, index === 1))
        .join("");

      featuredContainer.innerHTML = `${buildNewsLeadMarkup(leadArticle)}${compactMarkup}`;
    }
  }

  if (latestContainer) {
    const cardsToRender = latestArticles.length > 0 ? latestArticles : articles.slice(0, 3);

    if (cardsToRender.length === 0) {
      setNewsMessage(latestContainer, "Latest Hitech updates will appear here", "This section will display recent Hitech project, operations, and company updates.");
    } else {
      latestContainer.innerHTML = cardsToRender.map(buildNewsCardMarkup).join("");
    }
  }
}

function renderNewsArticlePage(data) {
  const slug = resolveNewsArticleSlug();
  const article = data.articles.find((entry) => entry.slug === slug) || data.articles[0] || null;
  const titleNode = document.querySelector("[data-news-article-title]");
  const categoryNode = document.querySelector("[data-news-article-category]");
  const summaryNode = document.querySelector("[data-news-article-summary]");
  const dateNode = document.querySelector("[data-news-article-date]");
  const readTimeNode = document.querySelector("[data-news-article-read-time]");
  const authorNode = document.querySelector("[data-news-article-author]");
  const locationNode = document.querySelector("[data-news-article-location]");
  const imageNode = document.querySelector("[data-news-article-image]");
  const bodyNode = document.querySelector("[data-news-article-body]");
  const highlightsNode = document.querySelector("[data-news-article-highlights]");
  const ctaNode = document.querySelector("[data-news-article-cta]");
  const relatedNode = document.querySelector("[data-news-related]");
  const stateNode = document.querySelector("[data-news-article-state]");

  if (!article) {
    if (stateNode) {
      stateNode.hidden = false;
      setNewsMessage(stateNode, "Article not found", "The requested Hitech news article could not be loaded.", "error");
    }

    document.title = "Article Not Found | Hitech News";
    updateNewsMeta("description", "The requested Hitech news article could not be found.");
    return;
  }

  if (stateNode) {
    stateNode.hidden = true;
  }

  if (titleNode) {
    titleNode.textContent = article.title;
  }

  if (categoryNode) {
    categoryNode.textContent = article.category;
  }

  if (summaryNode) {
    summaryNode.textContent = article.summary;
  }

  if (dateNode) {
    dateNode.textContent = formatNewsDate(article.published);
  }

  if (readTimeNode) {
    readTimeNode.textContent = article.readTime;
  }

  if (authorNode) {
    authorNode.textContent = article.author;
  }

  if (locationNode) {
    locationNode.textContent = article.location;
  }

  if (imageNode instanceof HTMLImageElement) {
    imageNode.src = article.image;
    imageNode.alt = article.imageAlt;
  }

  if (bodyNode) {
    bodyNode.innerHTML = renderNewsRichText(article.body);
  }

  if (highlightsNode) {
    highlightsNode.innerHTML = buildNewsHighlightsMarkup(article);
  }

  if (ctaNode instanceof HTMLAnchorElement) {
    ctaNode.href = article.ctaUrl;
    ctaNode.textContent = article.ctaLabel;
  }

  if (relatedNode) {
    const relatedArticles = data.articles.filter((entry) => entry.slug !== article.slug).slice(0, 3);
    relatedNode.innerHTML = relatedArticles.length
      ? relatedArticles.map(buildNewsCardMarkup).join("")
      : '<p class="news-article__aside-copy">More Hitech updates will appear here as additional stories are published.</p>';
  }

  document.title = `${article.title} | Hitech News`;
  updateNewsMeta("description", article.summary);
}

function getStudioArticleFromForm(form) {
  const formData = new FormData(form);
  const title = String(formData.get("title") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title) {
    return null;
  }

  return normalizeNewsArticle({
    slug: formData.get("slug"),
    title,
    category: formData.get("category"),
    published: formData.get("published"),
    readTime: formData.get("readTime"),
    author: formData.get("author"),
    location: formData.get("location"),
    summary,
    image: formData.get("image"),
    imageAlt: formData.get("imageAlt"),
    ctaLabel: formData.get("ctaLabel"),
    ctaUrl: formData.get("ctaUrl"),
    highlights: String(formData.get("highlights") ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    body,
  });
}

function createBlankStudioArticle() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    slug: "",
    title: "",
    category: "Project Update",
    published: today,
    readTime: "4 min read",
    author: "Hitech Communications",
    location: "Nigeria",
    summary: "",
    image: "/assets/images/conn/home/1.JPG",
    imageAlt: "Hitech project image",
    ctaLabel: "Related page",
    ctaUrl: "/contact/",
    highlights: [],
    body: "## Opening summary\n\nWrite the lead paragraph here.\n\n## Key update\n\nAdd the next section here.\n\n- Add optional bullet points\n- One point per line",
  };
}

function downloadNewsFeed(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "news-articles.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function initNewsAdminLogin() {
  const form = document.querySelector("[data-news-admin-login-form]");
  const status = document.querySelector("[data-news-admin-login-status]");

  if (!(form instanceof HTMLFormElement) || !status) {
    return;
  }

  const setStatus = (state, message) => {
    status.textContent = message || "";
    if (message) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setStatus("error", "Enter both the admin username and password.");
      return;
    }

    setStatus("success", "Signing in...");

    try {
      await requestNewsAdmin("login", {
        method: "POST",
        body: { username, password },
      });
      window.location.reload();
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Admin sign-in failed.");
    }
  });
}

function initNewsStudio(data) {
  const studioRoot = document.querySelector("[data-news-studio]");
  if (!studioRoot) {
    return;
  }

  const form = studioRoot.querySelector("[data-news-studio-form]");
  const list = studioRoot.querySelector("[data-studio-list]");
  const previewCard = studioRoot.querySelector("[data-studio-preview-card]");
  const previewBody = studioRoot.querySelector("[data-studio-preview-body]");
  const previewLink = studioRoot.querySelector("[data-studio-preview-link]");
  const status = studioRoot.querySelector("[data-studio-status]");
  const newButton = studioRoot.querySelector("[data-studio-new]");
  const deleteButton = studioRoot.querySelector("[data-studio-delete]");
  const downloadButton = studioRoot.querySelector("[data-studio-download]");
  const publishButton = studioRoot.querySelector("[data-studio-publish]");
  const reloadButton = studioRoot.querySelector("[data-studio-reload]");
  const logoutButton = studioRoot.querySelector("[data-studio-logout]");
  const importInput = studioRoot.querySelector("[data-studio-import]");
  const slugInput = form?.querySelector("input[name='slug']");
  const titleInput = form?.querySelector("input[name='title']");

  if (!(form instanceof HTMLFormElement) || !list || !previewCard || !previewBody || !previewLink || !status) {
    return;
  }

  const studioState = {
    settings: { ...data.settings },
    articles: [...data.articles],
    selectedSlug: data.articles[0]?.slug || "",
  };

  const setStatus = (state, message) => {
    status.textContent = message || "";
    if (message) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  const renderList = () => {
    if (studioState.articles.length === 0) {
      list.innerHTML = '<p class="news-studio__empty">No articles have been added yet. Create one to get started.</p>';
      if (deleteButton instanceof HTMLButtonElement) {
        deleteButton.disabled = true;
      }
      return;
    }

    if (deleteButton instanceof HTMLButtonElement) {
      deleteButton.disabled = !studioState.selectedSlug;
    }

    list.innerHTML = studioState.articles
      .map((article) => {
        const isActive = article.slug === studioState.selectedSlug;
        return `
          <button class="news-studio__article-button${isActive ? " is-active" : ""}" type="button" data-studio-select="${escapeNewsHtml(article.slug)}">
            <span class="news-studio__article-category">${escapeNewsHtml(article.category)}</span>
            <span class="news-studio__article-title">${escapeNewsHtml(article.title)}</span>
            <span class="news-studio__article-date">${escapeNewsHtml(formatNewsDate(article.published))}</span>
          </button>
        `;
      })
      .join("");
  };

  const populateForm = (article) => {
    const nextArticle = article || createBlankStudioArticle();

    form.elements.namedItem("title").value = nextArticle.title;
    form.elements.namedItem("slug").value = nextArticle.slug;
    form.elements.namedItem("category").value = nextArticle.category;
    form.elements.namedItem("published").value = nextArticle.published;
    form.elements.namedItem("readTime").value = nextArticle.readTime;
    form.elements.namedItem("author").value = nextArticle.author;
    form.elements.namedItem("location").value = nextArticle.location;
    form.elements.namedItem("summary").value = nextArticle.summary;
    form.elements.namedItem("image").value = nextArticle.image;
    form.elements.namedItem("imageAlt").value = nextArticle.imageAlt;
    form.elements.namedItem("ctaLabel").value = nextArticle.ctaLabel;
    form.elements.namedItem("ctaUrl").value = nextArticle.ctaUrl;
    form.elements.namedItem("highlights").value = nextArticle.highlights.join("\n");
    form.elements.namedItem("body").value = nextArticle.body;

    if (slugInput) {
      slugInput.dataset.autoSlug = !nextArticle.slug || nextArticle.slug === slugifyNewsText(nextArticle.title) ? "true" : "false";
    }
  };

  const renderPreview = () => {
    const draftArticle = getStudioArticleFromForm(form);
    if (!draftArticle) {
      previewCard.innerHTML = '<p class="news-studio__preview-empty">Fill in the article fields to see a live preview.</p>';
      previewBody.innerHTML = "";
      previewLink.textContent = "";
      return;
    }

    previewCard.innerHTML = buildNewsCardMarkup(draftArticle);
    previewBody.innerHTML = `
      <div class="news-studio__preview-meta">
        <span>${escapeNewsHtml(formatNewsDate(draftArticle.published))}</span>
        <span>${escapeNewsHtml(draftArticle.readTime)}</span>
        <span>${escapeNewsHtml(draftArticle.location)}</span>
      </div>
      <h3 class="news-studio__preview-title">${escapeNewsHtml(draftArticle.title)}</h3>
      <div class="news-studio__preview-content">${renderNewsRichText(draftArticle.body)}</div>
    `;
    previewLink.textContent = draftArticle.slug
      ? `Article URL: ${getNewsArticleUrl(draftArticle)}`
      : "Article URL will appear after you add a title or slug.";
  };

  const loadSelectedArticle = (slug) => {
    const article = studioState.articles.find((entry) => entry.slug === slug);
    studioState.selectedSlug = article?.slug || "";
    populateForm(article || createBlankStudioArticle());
    renderList();
    renderPreview();
  };

  renderList();
  populateForm(studioState.articles[0] || createBlankStudioArticle());
  renderPreview();

  const upsertCurrentArticle = (successMessage = "Article saved in the current draft list. Publish it live when you are ready.") => {
    const nextArticle = getStudioArticleFromForm(form);
    if (!nextArticle) {
      setStatus("error", "Please complete the required article fields before saving.");
      return null;
    }

    const duplicate = studioState.articles.find(
      (article) => article.slug === nextArticle.slug && article.slug !== studioState.selectedSlug,
    );

    if (duplicate) {
      setStatus("error", "That slug is already in use. Choose a different article slug.");
      return null;
    }

    if (!nextArticle.summary || !nextArticle.body) {
      setStatus("error", "Add at least a summary and article body before saving.");
      return null;
    }

    const existingIndex = studioState.articles.findIndex((article) => article.slug === studioState.selectedSlug);
    if (existingIndex >= 0) {
      studioState.articles[existingIndex] = nextArticle;
    } else {
      studioState.articles.push(nextArticle);
    }

    studioState.articles.sort(sortNewsArticles);
    studioState.selectedSlug = nextArticle.slug;
    renderList();
    renderPreview();
    setStatus("success", successMessage);

    return nextArticle;
  };

  list.addEventListener("click", (event) => {
    const trigger = event.target instanceof HTMLElement ? event.target.closest("[data-studio-select]") : null;
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    loadSelectedArticle(trigger.dataset.studioSelect || "");
    setStatus("success", "Loaded article into the editor.");
  });

  form.addEventListener("input", (event) => {
    if (event.target === titleInput && slugInput && slugInput.dataset.autoSlug === "true") {
      slugInput.value = slugifyNewsText(titleInput?.value || "");
    }

    if (event.target === slugInput) {
      slugInput.dataset.autoSlug = "false";
    }

    renderPreview();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    upsertCurrentArticle();
  });

  if (newButton instanceof HTMLButtonElement) {
    newButton.addEventListener("click", () => {
      studioState.selectedSlug = "";
      populateForm(createBlankStudioArticle());
      renderList();
      renderPreview();
      if (slugInput) {
        slugInput.dataset.autoSlug = "true";
      }
      setStatus("success", "Started a new article draft.");
    });
  }

  if (deleteButton instanceof HTMLButtonElement) {
    deleteButton.addEventListener("click", () => {
      if (!studioState.selectedSlug) {
        setStatus("error", "Select an article before trying to delete it.");
        return;
      }

      studioState.articles = studioState.articles.filter((article) => article.slug !== studioState.selectedSlug);
      studioState.selectedSlug = studioState.articles[0]?.slug || "";
      populateForm(studioState.articles[0] || createBlankStudioArticle());
      renderList();
      renderPreview();
      setStatus("success", "Article removed from the current draft list.");
    });
  }

  if (downloadButton instanceof HTMLButtonElement) {
    downloadButton.addEventListener("click", () => {
      downloadNewsFeed({
        settings: studioState.settings,
        articles: studioState.articles,
      });
      setStatus("success", "Downloaded a backup copy of the current news feed.");
    });
  }

  if (publishButton instanceof HTMLButtonElement) {
    publishButton.addEventListener("click", async () => {
      const activeArticle = upsertCurrentArticle("Draft list saved. Publishing live...");
      if (!activeArticle) {
        return;
      }

      publishButton.disabled = true;

      try {
        const response = await requestNewsAdmin("save", {
          method: "POST",
          body: {
            csrfToken: getNewsAdminCsrf(),
            feed: {
              settings: studioState.settings,
              articles: studioState.articles,
            },
          },
        });

        const savedFeed = normalizeNewsData(response.data || {});
        newsDataCache = savedFeed;
        studioState.settings = { ...savedFeed.settings };
        studioState.articles = [...savedFeed.articles];
        studioState.selectedSlug = activeArticle.slug;
        renderList();
        renderPreview();
        setStatus("success", response.message || "News published successfully.");
      } catch (error) {
        setStatus("error", error instanceof Error ? error.message : "The live news feed could not be published.");
      } finally {
        publishButton.disabled = false;
      }
    });
  }

  if (reloadButton instanceof HTMLButtonElement) {
    reloadButton.addEventListener("click", async () => {
      try {
        const response = await requestNewsAdmin("feed");
        const liveData = normalizeNewsData(response.data || {});
        newsDataCache = liveData;
        studioState.settings = { ...liveData.settings };
        studioState.articles = [...liveData.articles];
        studioState.selectedSlug = studioState.articles[0]?.slug || "";
        populateForm(studioState.articles[0] || createBlankStudioArticle());
        renderList();
        renderPreview();
        setStatus("success", "Reloaded the live Hitech news feed from the server.");
      } catch (error) {
        setStatus("error", error instanceof Error ? error.message : "Could not reload the live Hitech news feed.");
      }
    });
  }

  if (importInput instanceof HTMLInputElement) {
    importInput.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) {
        return;
      }

      try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText);
        const imported = normalizeNewsData(parsed);
        studioState.settings = { ...imported.settings };
        studioState.articles = [...imported.articles];
        studioState.selectedSlug = studioState.articles[0]?.slug || "";
        populateForm(studioState.articles[0] || createBlankStudioArticle());
        renderList();
        renderPreview();
        setStatus("success", "Imported news data from the selected JSON file.");
      } catch (error) {
        setStatus("error", "The selected file could not be read as a valid news feed JSON file.");
      } finally {
        importInput.value = "";
      }
    });
  }

  if (logoutButton instanceof HTMLButtonElement) {
    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;

      try {
        await requestNewsAdmin("logout", {
          method: "POST",
          body: { csrfToken: getNewsAdminCsrf() },
        });
        window.location.reload();
      } catch (error) {
        logoutButton.disabled = false;
        setStatus("error", error instanceof Error ? error.message : "Could not log out right now.");
      }
    });
  }
}

async function initNewsExperience() {
  const newsView = document.body.dataset.newsView || "";
  if (!newsView) {
    return;
  }

  if (newsView === "studio") {
    initNewsAdminLogin();

    if (!document.querySelector("[data-news-studio]")) {
      return;
    }
  }

  try {
    const data = await loadNewsData();

    if (newsView === "listing") {
      renderNewsListingPage(data);
    }

    if (newsView === "article") {
      renderNewsArticlePage(data);
    }

    if (newsView === "studio") {
      initNewsStudio(data);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the Hitech news feed.";

    if (newsView === "listing") {
      setNewsMessage(
        document.querySelector("[data-news-featured]"),
        "News feed unavailable",
        message,
        "error",
      );
      setNewsMessage(
        document.querySelector("[data-news-latest]"),
        "Latest Hitech updates unavailable",
        "Hitech news updates could not be loaded right now.",
        "error",
      );
    }

    if (newsView === "article") {
      const articleState = document.querySelector("[data-news-article-state]");
      if (articleState) {
        articleState.hidden = false;
      }
      setNewsMessage(articleState, "Article unavailable", message, "error");
    }

    if (newsView === "studio") {
      const status = document.querySelector("[data-studio-status]");
      if (status) {
        status.textContent = message;
        status.dataset.state = "error";
      }
      initNewsStudio({ settings: {}, articles: [] });
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNewsExperience, { once: true });
} else {
  initNewsExperience();
}
