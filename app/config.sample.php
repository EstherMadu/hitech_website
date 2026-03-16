<?php

declare(strict_types=1);

return [
    'site_name' => 'Hitech Construction Company Limited',
    'security' => [
        'allowed_hosts' => [
            // Add production and staging hostnames here, for example:
            // 'example.com',
            // 'www.example.com',
        ],
    ],
    'newsletter' => [
        'storage' => [
            'driver' => 'file',
            'file_path' => __DIR__ . '/storage/newsletter-subscribers.csv',
        ],
        'notify_email' => '',
        'from_email' => '',
        'success_message' => 'Thanks for subscribing. We will keep you updated.',
        'duplicate_message' => 'You are already subscribed with this email address.',
    ],
    'contact' => [
        'storage' => [
            'driver' => 'file',
            'file_path' => __DIR__ . '/storage/contact-inquiries.csv',
        ],
        'notify_email' => '',
        'from_email' => '',
        'success_message' => 'Thanks for reaching out. Our team will get back to you shortly.',
    ],
];
