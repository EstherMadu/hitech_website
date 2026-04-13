<?php

declare(strict_types=1);

require_once __DIR__ . '/../app/bootstrap.php';

$config = app_config();
app_send_security_headers(false);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    app_json_response(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

if (!app_request_origin_is_allowed($config)) {
    app_json_response(403, ['ok' => false, 'message' => 'Forbidden request origin.']);
}

// Generate or reuse an existing CSRF token for this visitor.
$cookieName = 'csrf_pub';
$existingToken = trim((string) ($_COOKIE[$cookieName] ?? ''));

if ($existingToken === '' || strlen($existingToken) !== 64 || !ctype_xdigit($existingToken)) {
    $existingToken = bin2hex(random_bytes(32));
}

setcookie($cookieName, $existingToken, [
    'expires'  => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => app_request_is_secure(),
    'httponly' => false, // must be readable by JS for double-submit pattern
    'samesite' => 'Strict',
]);

app_json_response(200, ['ok' => true, 'token' => $existingToken]);
