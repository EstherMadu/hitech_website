<?php

declare(strict_types=1);

require_once __DIR__ . '/../../app/bootstrap.php';

$config = app_config();
app_start_session($config);
app_send_security_headers(false);

$isAuthenticated = app_admin_is_authenticated();
$csrfToken       = $isAuthenticated ? htmlspecialchars(app_csrf_token(), ENT_QUOTES) : '';
$adminConfigured = app_admin_is_configured($config);

?><!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>News Studio | Hitech Construction Company Limited</title>
  <meta name="robots" content="noindex,nofollow">
  <script src="/assets/js/theme-init.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/vendor-style.css">
  <link rel="stylesheet" href="/assets/css/styles.css">
  <link rel="stylesheet" href="/assets/css/news.css">
</head>
<body
  data-page="news-studio"
  data-news-view="studio"
  data-news-admin-endpoint="/api/news-admin.php"
  <?php if ($csrfToken !== ''): ?>data-news-admin-csrf="<?= $csrfToken ?>"<?php endif; ?>
>
  <div data-include="/partials/site-header.html"></div>

  <main>

    <!-- Studio hero -->
    <section class="news-studio-hero">
      <div class="container">
        <div class="news-studio-hero__shell">
          <div>
            <h1 class="news-studio-hero__title">Hitech<br>News Studio</h1>
            <ol class="news-studio-hero__steps">
              <li>Write or edit an article in the editor panel.</li>
              <li>Check the live preview on the right.</li>
              <li>Click <strong>Publish Live</strong> to push updates to the site instantly.</li>
            </ol>
          </div>
          <div class="news-studio-hero__card">
            <p class="news-hero__eyebrow">Admin Only</p>
            <h2 class="news-studio-hero__card-title">
              <?php if (!$adminConfigured): ?>
                Admin not configured
              <?php elseif ($isAuthenticated): ?>
                Signed in as <?= htmlspecialchars((string) ($_SESSION['admin_username'] ?? 'admin'), ENT_QUOTES) ?>
              <?php else: ?>
                Sign in to manage news
              <?php endif; ?>
            </h2>
            <p class="news-studio-hero__text">
              <?php if (!$adminConfigured): ?>
                Set <code>admin.username</code> and <code>admin.password_hash</code> in <code>app/config.php</code> before using the studio.
              <?php elseif ($isAuthenticated): ?>
                Use the editor below to create, edit, and publish articles. Changes go live the moment you hit Publish Live.
              <?php else: ?>
                Enter your admin credentials below to access the Hitech News Studio.
              <?php endif; ?>
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="news-section" style="padding-top: 0;">
      <div class="container">

        <?php if (!$adminConfigured): ?>
        <!-- Admin not configured -->
        <div class="news-studio__auth-card">
          <h2 class="news-studio__sidebar-title">Setup required</h2>
          <p class="news-studio__status" style="margin-top:1rem;">
            The news studio cannot be used until <code>admin.username</code> and <code>admin.password_hash</code>
            are set in <code>app/config.php</code>. See <code>CPANEL_SETUP.md</code> for instructions.
          </p>
        </div>

        <?php elseif (!$isAuthenticated): ?>
        <!-- Login form -->
        <div class="news-studio__auth-card">
          <h2 class="news-studio__sidebar-title">Admin sign-in</h2>
          <form class="news-studio__auth-form" method="post" data-news-admin-login-form autocomplete="off">
            <div>
              <label class="form-label" for="studio-username">Username</label>
              <input class="form-control" type="text" id="studio-username" name="username" autocomplete="username" required>
            </div>
            <div>
              <label class="form-label" for="studio-password">Password</label>
              <input class="form-control" type="password" id="studio-password" name="password" autocomplete="current-password" required>
            </div>
            <div>
              <button class="btn btn-primary" type="submit">Sign in</button>
            </div>
          </form>
          <p class="news-studio__status" style="margin-top:1rem;" data-news-admin-login-status></p>
        </div>

        <?php else: ?>
        <!-- Authenticated studio -->
        <div data-news-studio>

          <!-- Toolbar -->
          <div class="news-studio__toolbar">
            <p class="news-studio__toolbar-note">
              Unsaved changes exist only in this browser tab. Use <strong>Save Draft</strong> to hold your work, then <strong>Publish Live</strong> when ready.
            </p>
            <div class="news-studio__toolbar-actions">
              <button class="btn btn-sm btn-outline-secondary" type="button" data-studio-new>+ New Article</button>
              <button class="btn btn-sm btn-outline-danger" type="button" data-studio-delete>Delete Selected</button>
              <label class="btn btn-sm btn-outline-secondary news-studio__import-label">
                Import JSON
                <input type="file" accept=".json,application/json" hidden data-studio-import>
              </label>
              <button class="btn btn-sm btn-outline-secondary" type="button" data-studio-download>Download Backup</button>
              <button class="btn btn-sm btn-outline-secondary" type="button" data-studio-reload>Reload Live</button>
              <button class="btn btn-sm btn-primary" type="button" data-studio-publish>Publish Live</button>
              <button class="btn btn-sm btn-outline-secondary" type="button" data-studio-logout>Sign Out</button>
            </div>
          </div>

          <!-- Status bar -->
          <p class="news-studio__status" style="margin-bottom:1rem;" data-studio-status></p>

          <!-- Three-column layout: article list | editor | preview -->
          <div class="news-studio__layout">

            <!-- Sidebar: article list -->
            <div class="news-studio__sidebar">
              <div class="news-studio__sidebar-header">
                <p class="news-studio__sidebar-label">Published articles</p>
                <h2 class="news-studio__sidebar-title">Select to edit</h2>
              </div>
              <div class="news-studio__article-list" data-studio-list>
                <p class="news-studio__empty">Loading articles&hellip;</p>
              </div>
            </div>

            <!-- Editor: article form -->
            <div class="news-studio__editor">
              <form data-news-studio-form>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-title">Title <span class="text-danger">*</span></label>
                  <input class="form-control" type="text" id="sf-title" name="title" placeholder="Article headline" required>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-slug">Slug <span class="text-danger">*</span></label>
                  <input class="form-control font-monospace" type="text" id="sf-slug" name="slug" placeholder="auto-generated-from-title" data-auto-slug="true" required>
                  <div class="form-text">URL-safe identifier. Auto-fills from the title.</div>
                </div>

                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label class="form-label fw-semibold" for="sf-category">Category</label>
                    <input class="form-control" type="text" id="sf-category" name="category" placeholder="Project Update">
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label fw-semibold" for="sf-published">Published date</label>
                    <input class="form-control" type="date" id="sf-published" name="published">
                  </div>
                </div>

                <div class="row g-3 mb-3">
                  <div class="col-sm-4">
                    <label class="form-label fw-semibold" for="sf-readTime">Read time</label>
                    <input class="form-control" type="text" id="sf-readTime" name="readTime" placeholder="4 min read">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label fw-semibold" for="sf-author">Author</label>
                    <input class="form-control" type="text" id="sf-author" name="author" placeholder="Hitech Communications">
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label fw-semibold" for="sf-location">Location</label>
                    <input class="form-control" type="text" id="sf-location" name="location" placeholder="Nigeria">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-summary">Summary <span class="text-danger">*</span></label>
                  <textarea class="form-control" id="sf-summary" name="summary" rows="3" placeholder="One or two sentences that appear on the news listing page."></textarea>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-image">Image path</label>
                  <input class="form-control font-monospace" type="text" id="sf-image" name="image" placeholder="/assets/images/conn/home/1.JPG">
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-imageAlt">Image alt text</label>
                  <input class="form-control" type="text" id="sf-imageAlt" name="imageAlt" placeholder="Describe the image for screen readers">
                </div>

                <div class="row g-3 mb-3">
                  <div class="col-sm-5">
                    <label class="form-label fw-semibold" for="sf-ctaLabel">CTA button label</label>
                    <input class="form-control" type="text" id="sf-ctaLabel" name="ctaLabel" placeholder="Open project page">
                  </div>
                  <div class="col-sm-7">
                    <label class="form-label fw-semibold" for="sf-ctaUrl">CTA button URL</label>
                    <input class="form-control font-monospace" type="text" id="sf-ctaUrl" name="ctaUrl" placeholder="/projects/example/">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-highlights">Key highlights</label>
                  <textarea class="form-control font-monospace" id="sf-highlights" name="highlights" rows="4" placeholder="One highlight per line.&#10;They appear as bullet points on the article page."></textarea>
                  <div class="form-text">One bullet point per line.</div>
                </div>

                <div class="mb-3">
                  <label class="form-label fw-semibold" for="sf-body">Article body <span class="text-danger">*</span></label>
                  <textarea class="form-control font-monospace" id="sf-body" name="body" rows="14" placeholder="## Section heading&#10;&#10;Write your paragraph here.&#10;&#10;- Bullet point one&#10;- Bullet point two"></textarea>
                  <div class="form-text">Supports: <code>## Heading</code>, paragraphs, <code>- list items</code>, <code>&gt; blockquote</code>.</div>
                </div>

                <div class="d-flex gap-2">
                  <button class="btn btn-outline-secondary" type="submit">Save Draft</button>
                  <button class="btn btn-primary" type="button" data-studio-publish>Publish Live</button>
                </div>

              </form>
            </div>

            <!-- Preview panel -->
            <div class="news-studio__preview-shell">
              <div class="news-studio__preview-header">
                <p class="news-studio__sidebar-label">Live preview</p>
                <h2 class="news-studio__preview-title">Article card &amp; body</h2>
              </div>
              <div data-studio-preview-card>
                <p class="news-studio__preview-empty">Fill in the article fields to see a live preview.</p>
              </div>
              <p class="news-studio__preview-link" data-studio-preview-link></p>
              <hr style="margin: 1.5rem 0; opacity: 0.12;">
              <div data-studio-preview-body></div>
            </div>

          </div>
        </div>
        <?php endif; ?>

      </div>
    </section>

  </main>

  <div data-include="/partials/site-footer.html"></div>

  <script src="/assets/js/bootstrap.bundle.min.js"></script>
  <script src="/assets/js/main.js" defer></script>
  <script src="/assets/js/news.js" defer></script>
</body>
</html>
