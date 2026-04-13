<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/bootstrap.php';

$config = app_config();
app_send_security_headers(false);
$contactConfig = $config['contact'] ?? [];
$redirectPath = app_safe_redirect_path((string) ($_POST['redirect'] ?? '/contact/'), '/contact/');
$successMessage = (string) ($contactConfig['success_message'] ?? 'Thanks for reaching out. Our team will get back to you shortly.');
$errorMessage = 'We could not send your inquiry right now. Please try again shortly.';
$rateLimitMessage = 'Too many inquiries were received from your network. Please wait a few minutes and try again.';

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

if (app_request_exceeds_size(65536)) {
    if (app_is_json_request()) {
        app_json_response(413, ['ok' => false, 'message' => 'Your submission is too large.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'contact');
}

if (app_is_rate_limited('contact', 6, 900)) {
    if (app_is_json_request()) {
        app_json_response(429, ['ok' => false, 'message' => $rateLimitMessage]);
    }

    app_redirect_with_status($redirectPath, 'error', 'contact');
}

if (!app_verify_public_csrf_token($_POST)) {
    if (app_is_json_request()) {
        app_json_response(403, ['ok' => false, 'message' => 'Invalid or missing security token. Please refresh the page and try again.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'contact');
}

$honeypot = trim((string) ($_POST['company_name'] ?? ''));
if ($honeypot !== '') {
    if (app_is_json_request()) {
        app_json_response(200, ['ok' => true, 'message' => $successMessage]);
    }

    app_redirect_with_status($redirectPath, 'success', 'contact');
}

$fullName = trim((string) ($_POST['full_name'] ?? ''));
$email = strtolower(trim((string) ($_POST['email'] ?? '')));
$message = trim((string) ($_POST['message'] ?? ''));

if ($fullName === '' || $email === '' || $message === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    if (app_is_json_request()) {
        app_json_response(422, ['ok' => false, 'message' => 'Please complete the required contact fields.']);
    }

    app_redirect_with_status($redirectPath, 'invalid', 'contact');
}

$storageDriver = (string) ($contactConfig['storage']['driver'] ?? 'file');
$storagePath = (string) ($contactConfig['storage']['file_path'] ?? (__DIR__ . '/../app/storage/contact-inquiries.csv'));

if ($storageDriver !== 'file') {
    if (app_is_json_request()) {
        app_json_response(500, ['ok' => false, 'message' => 'Unsupported contact storage driver.']);
    }

    app_redirect_with_status($redirectPath, 'error', 'contact');
}

try {
    $clientIp = app_get_client_ip();
    $inquiry = [
        'submitted_at' => gmdate('c'),
        'full_name' => substr($fullName, 0, 120),
        'email' => substr($email, 0, 190),
        'phone' => substr(trim((string) ($_POST['phone'] ?? '')), 0, 60),
        'company' => substr(trim((string) ($_POST['company'] ?? '')), 0, 120),
        'inquiry_type' => substr(trim((string) ($_POST['inquiry_type'] ?? 'General project inquiry')), 0, 120),
        'project_location' => substr(trim((string) ($_POST['project_location'] ?? '')), 0, 120),
        'message' => substr($message, 0, 5000),
        'source_page' => substr(trim((string) ($_POST['source_page'] ?? '')), 0, 200),
        'ip_address' => substr($clientIp, 0, 45),
        'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ];

    app_append_csv_row($storagePath, $inquiry);
    app_send_contact_notification($config, $inquiry);

    if (app_is_json_request()) {
        app_json_response(200, ['ok' => true, 'message' => $successMessage]);
    }

    app_redirect_with_status($redirectPath, 'success', 'contact');
} catch (Throwable $exception) {
    error_log('Contact inquiry failed: ' . $exception->getMessage());

    if (app_is_json_request()) {
        app_json_response(500, ['ok' => false, 'message' => $errorMessage]);
    }

    app_redirect_with_status($redirectPath, 'error', 'contact');
}

