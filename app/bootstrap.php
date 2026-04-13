<?php

declare(strict_types=1);

function app_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        $configPath = __DIR__ . '/config.sample.php';
    }

    $loaded = require $configPath;
    $config = is_array($loaded) ? $loaded : [];

    return $config;
}

function app_send_security_headers(bool $cacheable = true): void
{
    if (headers_sent()) {
        return;
    }

    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

    if (!$cacheable) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
}

function app_is_json_request(): bool
{
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $requestedWith = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));

    return strpos($accept, 'application/json') !== false || $requestedWith === 'xmlhttprequest';
}

function app_json_response(int $statusCode, array $payload): void
{
    app_send_security_headers(false);
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function app_safe_redirect_path(string $path, string $fallback = '/about/who-we-are/'): string
{
    $path = trim($path);

    if ($path === '' || strpos($path, '/') !== 0 || strpos($path, '://') !== false) {
        return $fallback;
    }

    if (preg_match('/[\r\n\0]/', $path) === 1 || strpos($path, '/api/') === 0 || strpos($path, '/app/') === 0) {
        return $fallback;
    }

    return $path;
}

function app_redirect_with_status(string $path, string $status, string $parameter = 'status'): void
{
    app_send_security_headers(false);

    $safePath = app_safe_redirect_path($path);
    $separator = strpos($safePath, '?') !== false ? '&' : '?';

    header('Location: ' . $safePath . $separator . rawurlencode($parameter) . '=' . rawurlencode($status));
    exit;
}

function app_append_csv_row(string $path, array $row): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create storage directory.');
    }

    $fileExists = file_exists($path);
    $handle = fopen($path, 'ab');
    if ($handle === false) {
        throw new RuntimeException('Unable to open subscription storage file.');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Unable to lock subscription storage file.');
        }

        if (!$fileExists) {
            fputcsv($handle, array_keys($row));
        }

        fputcsv($handle, array_values($row));
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

function app_get_client_ip(): string
{
    $candidates = [
        (string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''),
        (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    ];

    foreach ($candidates as $candidate) {
        $candidate = trim($candidate);
        if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }

    return '';
}

function app_normalize_host(string $host): string
{
    $host = strtolower(trim($host));
    $host = preg_replace('/:\d+$/', '', $host);

    return is_string($host) ? $host : '';
}

function app_allowed_hosts(array $config): array
{
    $hosts = [];
    $configuredHosts = $config['security']['allowed_hosts'] ?? [];

    if (is_array($configuredHosts)) {
        foreach ($configuredHosts as $host) {
            $normalized = app_normalize_host((string) $host);
            if ($normalized !== '') {
                $hosts[] = $normalized;
            }
        }
    }

    $requestHost = app_normalize_host((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($requestHost !== '') {
        $hosts[] = $requestHost;
    }

    return array_values(array_unique($hosts));
}

function app_request_origin_is_allowed(array $config): bool
{
    $allowedHosts = app_allowed_hosts($config);
    if ($allowedHosts === []) {
        return true;
    }

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    $referer = trim((string) ($_SERVER['HTTP_REFERER'] ?? ''));

    if ($origin === '' && $referer === '') {
        return true;
    }

    foreach ([$origin, $referer] as $candidate) {
        if ($candidate === '') {
            continue;
        }

        $host = parse_url($candidate, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return false;
        }

        if (in_array(app_normalize_host($host), $allowedHosts, true)) {
            return true;
        }
    }

    return false;
}

function app_request_content_length(): int
{
    return max(0, (int) ($_SERVER['CONTENT_LENGTH'] ?? 0));
}

function app_request_exceeds_size(int $maxBytes): bool
{
    return app_request_content_length() > $maxBytes;
}

function app_is_rate_limited(string $bucket, int $limit, int $windowSeconds): bool
{
    $clientIp = app_get_client_ip();
    if ($clientIp === '') {
        $clientIp = 'unknown';
    }

    $directory = __DIR__ . '/storage/rate-limits';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        return true;
    }

    $path = $directory . '/' . hash('sha256', $bucket . '|' . $clientIp) . '.json';
    $handle = fopen($path, 'c+b');
    if ($handle === false) {
        return true;
    }

    $now = time();
    $windowStart = $now - $windowSeconds;
    $limited = false;

    try {
        if (!flock($handle, LOCK_EX)) {
            return true;
        }

        rewind($handle);
        $existing = stream_get_contents($handle);
        $timestamps = json_decode($existing ?: '[]', true);
        $timestamps = is_array($timestamps) ? $timestamps : [];
        $timestamps = array_values(array_filter($timestamps, static function ($timestamp) use ($windowStart): bool {
            return is_int($timestamp) && $timestamp >= $windowStart;
        }));

        if (count($timestamps) >= $limit) {
            $limited = true;
        } else {
            $timestamps[] = $now;
        }

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($timestamps));
        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }

    return $limited;
}

function app_csv_contains_email(string $path, string $email): bool
{
    if (!file_exists($path)) {
        return false;
    }

    $handle = fopen($path, 'rb');
    if ($handle === false) {
        return false;
    }

    try {
        $header = fgetcsv($handle);
        if (!is_array($header)) {
            return false;
        }

        $emailIndex = array_search('email', $header, true);
        if ($emailIndex === false) {
            return false;
        }

        while (($row = fgetcsv($handle)) !== false) {
            $storedEmail = strtolower(trim((string) ($row[$emailIndex] ?? '')));
            if ($storedEmail !== '' && $storedEmail === strtolower($email)) {
                return true;
            }
        }
    } finally {
        fclose($handle);
    }

    return false;
}

function app_sanitize_mail_header(string $value): string
{
    return str_replace(["\r", "\n", "\0"], '', $value);
}

function app_send_newsletter_notification(array $config, array $subscription): void
{
    $newsletterConfig = $config['newsletter'] ?? [];
    $notifyEmail = trim((string) ($newsletterConfig['notify_email'] ?? ''));
    if ($notifyEmail === '' || filter_var($notifyEmail, FILTER_VALIDATE_EMAIL) === false) {
        return;
    }

    $siteName = app_sanitize_mail_header((string) ($config['site_name'] ?? 'Website'));
    $fromEmail = trim((string) ($newsletterConfig['from_email'] ?? ''));
    $headers = ['Content-Type: text/plain; charset=UTF-8'];

    if ($fromEmail !== '' && filter_var($fromEmail, FILTER_VALIDATE_EMAIL) !== false) {
        $headers[] = 'From: ' . $fromEmail;
        $headers[] = 'Reply-To: ' . $fromEmail;
    }

    $subject = $siteName . ' Newsletter Signup';
    $message = implode(PHP_EOL, [
        'A new newsletter subscription was received.',
        '',
        'Email: ' . (string) ($subscription['email'] ?? ''),
        'Submitted at: ' . (string) ($subscription['submitted_at'] ?? ''),
        'Source page: ' . (string) ($subscription['source_page'] ?? ''),
        'IP address: ' . (string) ($subscription['ip_address'] ?? ''),
    ]);

    @mail($notifyEmail, $subject, $message, implode("\r\n", $headers));
}

function app_send_contact_notification(array $config, array $contact): void
{
    $contactConfig = $config['contact'] ?? [];
    $notifyEmail = trim((string) ($contactConfig['notify_email'] ?? ''));
    if ($notifyEmail === '' || filter_var($notifyEmail, FILTER_VALIDATE_EMAIL) === false) {
        return;
    }

    $siteName = app_sanitize_mail_header((string) ($config['site_name'] ?? 'Website'));
    $fromEmail = trim((string) ($contactConfig['from_email'] ?? ''));
    $headers = ['Content-Type: text/plain; charset=UTF-8'];

    if ($fromEmail !== '' && filter_var($fromEmail, FILTER_VALIDATE_EMAIL) !== false) {
        $headers[] = 'From: ' . $fromEmail;
        $headers[] = 'Reply-To: ' . $fromEmail;
    }

    $subject = $siteName . ' Contact Inquiry';
    $message = implode(PHP_EOL, [
        'A new contact inquiry was received.',
        '',
        'Name: ' . (string) ($contact['full_name'] ?? ''),
        'Email: ' . (string) ($contact['email'] ?? ''),
        'Phone: ' . (string) ($contact['phone'] ?? ''),
        'Company: ' . (string) ($contact['company'] ?? ''),
        'Inquiry Type: ' . (string) ($contact['inquiry_type'] ?? ''),
        'Project Location: ' . (string) ($contact['project_location'] ?? ''),
        'Message: ' . (string) ($contact['message'] ?? ''),
        '',
        'Submitted at: ' . (string) ($contact['submitted_at'] ?? ''),
        'Source page: ' . (string) ($contact['source_page'] ?? ''),
        'IP address: ' . (string) ($contact['ip_address'] ?? ''),
    ]);

    @mail($notifyEmail, $subject, $message, implode("\r\n", $headers));
}

function app_request_is_secure(): bool
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    $forwardedSsl = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_SSL'] ?? ''));

    return $https === 'on' || $https === '1' || $forwardedProto === 'https' || $forwardedSsl === 'on';
}

function app_start_session(array $config): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $sessionName = trim((string) ($config['admin']['session_name'] ?? 'HITECHADMIN'));
    if ($sessionName !== '') {
        session_name($sessionName);
    }

    $params = session_get_cookie_params();
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $params['path'] ?? '/',
        'domain' => $params['domain'] ?? '',
        'secure' => app_request_is_secure(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_start();
}

function app_admin_is_configured(array $config): bool
{
    $username = trim((string) ($config['admin']['username'] ?? ''));
    $passwordHash = trim((string) ($config['admin']['password_hash'] ?? ''));

    return $username !== '' && $passwordHash !== '';
}

function app_admin_is_authenticated(): bool
{
    return !empty($_SESSION['admin_authenticated']) && !empty($_SESSION['admin_username']);
}

function app_admin_login(string $username): void
{
    session_regenerate_id(true);
    $_SESSION['admin_authenticated'] = true;
    $_SESSION['admin_username'] = $username;
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function app_admin_logout(): void
{
    $_SESSION = [];

    if (session_status() === PHP_SESSION_ACTIVE) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            [
                'expires' => time() - 3600,
                'path' => $params['path'] ?? '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) ($params['secure'] ?? false),
                'httponly' => (bool) ($params['httponly'] ?? true),
                'samesite' => $params['samesite'] ?? 'Strict',
            ]
        );
        session_destroy();
    }
}

function app_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function app_verify_csrf_token(?string $token): bool
{
    $expected = $_SESSION['csrf_token'] ?? '';

    return is_string($expected) && $expected !== '' && is_string($token) && hash_equals($expected, $token);
}

function app_verify_public_csrf_token(array $post): bool
{
    $cookieName = 'csrf_pub';
    $cookieToken = trim((string) ($_COOKIE[$cookieName] ?? ''));

    if ($cookieToken === '' || strlen($cookieToken) !== 64 || !ctype_xdigit($cookieToken)) {
        return false;
    }

    // Accept token from POST field or X-CSRF-Token header (JS fetch path).
    $submitted = trim((string) ($post['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));

    return $submitted !== '' && hash_equals($cookieToken, $submitted);
}

function app_request_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    return is_array($decoded) ? $decoded : [];
}

function app_write_json_file(string $path, array $payload): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create JSON storage directory.');
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') {
        throw new RuntimeException('Unable to encode JSON payload.');
    }

    $tempPath = $path . '.tmp';
    $backupPath = $path . '.bak';

    if (file_put_contents($tempPath, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write temporary JSON file.');
    }

    if (file_exists($path)) {
        @copy($path, $backupPath);
    }

    if (!rename($tempPath, $path)) {
        @unlink($tempPath);
        throw new RuntimeException('Unable to move JSON file into place.');
    }
}
