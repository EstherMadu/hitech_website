<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/bootstrap.php';

$config = app_config();
app_start_session($config);
app_send_security_headers(false);

$action = trim((string) ($_GET['action'] ?? ''));
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

// Only accept XHR requests from the same origin.
if (!app_is_json_request() || !app_request_origin_is_allowed($config)) {
    app_json_response(403, ['ok' => false, 'message' => 'Forbidden.']);
}

if (!app_admin_is_configured($config)) {
    app_json_response(503, ['ok' => false, 'message' => 'The admin system has not been configured yet.']);
}

$feedPath = (string) ($config['news']['storage']['file_path'] ?? (__DIR__ . '/../assets/data/news-articles.json'));

// -------------------------------------------------------------------------
// ACTION: login
// -------------------------------------------------------------------------
if ($action === 'login') {
    if ($method !== 'POST') {
        app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    if (app_is_rate_limited('news_admin_login', 10, 900)) {
        app_json_response(429, ['ok' => false, 'message' => 'Too many login attempts. Please wait a few minutes.']);
    }

    $body = app_request_json_body();
    $username = trim((string) ($body['username'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    $adminConfig = $config['admin'] ?? [];
    $expectedUsername = trim((string) ($adminConfig['username'] ?? ''));
    $expectedHash = trim((string) ($adminConfig['password_hash'] ?? ''));

    $usernameMatch = $expectedUsername !== '' && hash_equals($expectedUsername, $username);
    $passwordMatch = $expectedHash !== '' && password_verify($password, $expectedHash);

    if (!$usernameMatch || !$passwordMatch) {
        app_json_response(401, ['ok' => false, 'message' => 'Invalid username or password.']);
    }

    app_admin_login($username);

    $feed = news_admin_load_feed($feedPath);
    app_json_response(200, [
        'ok'        => true,
        'message'   => 'Signed in successfully.',
        'csrfToken' => app_csrf_token(),
        'data'      => $feed,
    ]);
}

// -------------------------------------------------------------------------
// ACTION: logout
// -------------------------------------------------------------------------
if ($action === 'logout') {
    if ($method !== 'POST') {
        app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    if (app_admin_is_authenticated()) {
        $body = app_request_json_body();
        app_verify_csrf_token((string) ($body['csrfToken'] ?? ''));
        app_admin_logout();
    }

    app_json_response(200, ['ok' => true, 'message' => 'Signed out.']);
}

// All remaining actions require an authenticated session.
if (!app_admin_is_authenticated()) {
    app_json_response(401, ['ok' => false, 'message' => 'You must be signed in to access the news studio.']);
}

// -------------------------------------------------------------------------
// ACTION: feed  — return the current live news feed
// -------------------------------------------------------------------------
if ($action === 'feed') {
    if ($method !== 'GET') {
        app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    $feed = news_admin_load_feed($feedPath);
    app_json_response(200, [
        'ok'        => true,
        'csrfToken' => app_csrf_token(),
        'data'      => $feed,
    ]);
}

// -------------------------------------------------------------------------
// ACTION: save  — write an updated feed to disk
// -------------------------------------------------------------------------
if ($action === 'save') {
    if ($method !== 'POST') {
        app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    $body = app_request_json_body();

    if (!app_verify_csrf_token((string) ($body['csrfToken'] ?? ''))) {
        app_json_response(403, ['ok' => false, 'message' => 'Invalid security token. Please reload the studio and try again.']);
    }

    $feed = $body['feed'] ?? null;
    if (!is_array($feed)) {
        app_json_response(422, ['ok' => false, 'message' => 'Invalid news feed payload.']);
    }

    $validated = news_admin_validate_feed($feed);
    if ($validated === null) {
        app_json_response(422, ['ok' => false, 'message' => 'The news feed could not be validated. Check that each article has a slug and title.']);
    }

    try {
        app_write_json_file($feedPath, $validated);
    } catch (Throwable $exception) {
        error_log('News feed save failed: ' . $exception->getMessage());
        app_json_response(500, ['ok' => false, 'message' => 'The news feed could not be saved. Check that the server has write access to the data directory.']);
    }

    app_json_response(200, [
        'ok'        => true,
        'message'   => 'News feed published successfully. Updates are now live on the site.',
        'csrfToken' => app_csrf_token(),
        'data'      => $validated,
    ]);
}

// Unknown action.
app_json_response(400, ['ok' => false, 'message' => 'Unknown action.']);

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function news_admin_load_feed(string $path): array
{
    if (!file_exists($path)) {
        return ['settings' => new stdClass(), 'articles' => []];
    }

    $raw = file_get_contents($path);
    if (!is_string($raw)) {
        return ['settings' => new stdClass(), 'articles' => []];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['settings' => new stdClass(), 'articles' => []];
    }

    return [
        'settings' => isset($decoded['settings']) && is_array($decoded['settings'])
            ? $decoded['settings']
            : new stdClass(),
        'articles' => isset($decoded['articles']) && is_array($decoded['articles'])
            ? $decoded['articles']
            : [],
    ];
}

function news_admin_validate_article(mixed $raw): ?array
{
    if (!is_array($raw)) {
        return null;
    }

    $title = trim((string) ($raw['title'] ?? ''));
    $slug  = trim((string) ($raw['slug'] ?? ''));

    if ($title === '' || $slug === '') {
        return null;
    }

    // Sanitize slug to safe URL characters only.
    $slug = preg_replace('/[^a-z0-9\-]/', '', strtolower($slug));
    if ($slug === '') {
        return null;
    }

    return [
        'slug'      => $slug,
        'title'     => $title,
        'category'  => substr(trim((string) ($raw['category'] ?? 'News')), 0, 120),
        'published' => trim((string) ($raw['published'] ?? '')),
        'readTime'  => substr(trim((string) ($raw['readTime'] ?? '5 min read')), 0, 40),
        'author'    => substr(trim((string) ($raw['author'] ?? 'Hitech Communications')), 0, 120),
        'location'  => substr(trim((string) ($raw['location'] ?? 'Nigeria')), 0, 120),
        'summary'   => trim((string) ($raw['summary'] ?? '')),
        'image'     => trim((string) ($raw['image'] ?? '/assets/images/conn/home/1.JPG')),
        'imageAlt'  => trim((string) ($raw['imageAlt'] ?? $title)),
        'ctaLabel'  => substr(trim((string) ($raw['ctaLabel'] ?? 'Contact Hitech')), 0, 120),
        'ctaUrl'    => trim((string) ($raw['ctaUrl'] ?? '/contact/')),
        'highlights' => is_array($raw['highlights'] ?? null)
            ? array_values(array_filter(array_map(
                static fn ($item) => substr(trim((string) $item), 0, 500),
                $raw['highlights'],
            ), static fn ($item) => $item !== ''))
            : [],
        'body'      => trim((string) ($raw['body'] ?? '')),
    ];
}

function news_admin_validate_feed(array $raw): ?array
{
    $settings = isset($raw['settings']) && is_array($raw['settings'])
        ? $raw['settings']
        : [];

    $rawArticles = isset($raw['articles']) && is_array($raw['articles'])
        ? $raw['articles']
        : [];

    $articles = [];
    $slugsSeen = [];

    foreach ($rawArticles as $rawArticle) {
        $article = news_admin_validate_article($rawArticle);
        if ($article === null) {
            continue;
        }

        if (in_array($article['slug'], $slugsSeen, true)) {
            continue; // skip duplicates
        }

        $slugsSeen[] = $article['slug'];
        $articles[]  = $article;
    }

    return [
        'settings' => $settings,
        'articles' => $articles,
    ];
}
