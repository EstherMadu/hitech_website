<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/bootstrap.php';

$config = app_config();
app_send_security_headers(false);
$newsletterConfig = $config['newsletter'] ?? [];
$redirectPath = app_safe_redirect_path((string) ($_POST['redirect'] ?? '/about/who-we-are/'));
$successMessage = (string) ($newsletterConfig['success_message'] ?? 'Thanks for subscribing.');
$duplicateMessage = (string) ($newsletterConfig['duplicate_message'] ?? 'You are already subscribed with this email address.');
$errorMessage = 'We could not save your details right now. Please try again shortly.';
$rateLimitMessage = 'Too many subscription attempts were received from your network. Please wait a few minutes and try again.';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    if (app_is_json_request()) {
        app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    http_response_code(405);
    echo 'Method not allowed.';
    exit;
}

if (!app_request_origin_is_allowed($config)) {
    if (app_is_json_request()) {
        app_json_response(403, ['ok' => false, 'message' => 'Forbidden request origin.']);
    }

    http_response_code(403);
    echo 'Forbidden.';
    exit;
}

if (app_request_exceeds_size(8192)) {
    if (app_is_json_request()) {
        app_json_response(413, ['ok' => false, 'message' => 'Your submission is too large.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'subscribe');
}

if (app_is_rate_limited('newsletter', 8, 900)) {
    if (app_is_json_request()) {
        app_json_response(429, ['ok' => false, 'message' => $rateLimitMessage]);
    }

    app_redirect_with_status($redirectPath, 'error', 'subscribe');
}

if (!app_verify_public_csrf_token($_POST)) {
    if (app_is_json_request()) {
        app_json_response(403, ['ok' => false, 'message' => 'Invalid or missing security token. Please refresh the page and try again.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'subscribe');
}

$honeypot = trim((string) ($_POST['company_name'] ?? ''));
if ($honeypot !== '') {
    if (app_is_json_request()) {
        app_json_response(200, ['ok' => true, 'message' => $successMessage]);
    }

    app_redirect_with_status($redirectPath, 'success', 'subscribe');
}

$email = strtolower(trim((string) ($_POST['email'] ?? '')));
if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    if (app_is_json_request()) {
        app_json_response(422, ['ok' => false, 'message' => 'Please enter a valid email address.']);
    }

    app_redirect_with_status($redirectPath, 'invalid', 'subscribe');
}

$storageDriver = (string) (($newsletterConfig['storage']['driver'] ?? 'file'));
$storagePath = (string) (($newsletterConfig['storage']['file_path'] ?? (__DIR__ . '/../app/storage/newsletter-subscribers.csv')));

if ($storageDriver !== 'file') {
    if (app_is_json_request()) {
        app_json_response(500, ['ok' => false, 'message' => 'Unsupported newsletter storage driver.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'subscribe');
}

try {
    if (app_csv_contains_email($storagePath, $email)) {
        if (app_is_json_request()) {
            app_json_response(200, ['ok' => true, 'message' => $duplicateMessage]);
        }

        app_redirect_with_status($redirectPath, 'duplicate', 'subscribe');
    }

    $clientIp = app_get_client_ip();
    $subscription = [
        'submitted_at' => gmdate('c'),
        'email' => $email,
        'source_page' => substr(trim((string) ($_POST['source_page'] ?? '')), 0, 200),
        'ip_address' => substr($clientIp, 0, 45),
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ];

    app_append_csv_row($storagePath, $subscription);
    app_send_newsletter_notification($config, $subscription);

    if (app_is_json_request()) {
        app_json_response(200, ['ok' => true, 'message' => $successMessage]);
    }

    app_redirect_with_status($redirectPath, 'success', 'subscribe');
} catch (Throwable $exception) {
    error_log('Newsletter subscription failed: ' . $exception->getMessage());

    if (app_is_json_request()) {
        app_json_response(500, ['ok' => false, 'message' => $errorMessage]);
    }

    app_redirect_with_status($redirectPath, 'error', 'subscribe');
}

