# cPanel Setup

## Newsletter Endpoint

The newsletter form posts to `/api/subscribe.php`.

Submitted emails are stored in:

`app/storage/newsletter-subscribers.csv`

## Contact Endpoint

The contact form posts to `/api/contact.php`.

Submitted inquiries are stored in:

`app/storage/contact-inquiries.csv`

## Basic Setup

1. Upload the project files to your cPanel web root.
2. Make sure PHP is enabled for the site.
3. If you want notification emails, copy `app/config.sample.php` to `app/config.php`.
4. Edit `app/config.php` and set:
   - `newsletter.notify_email`
   - `newsletter.from_email`
   - `contact.notify_email`
   - `contact.from_email`
5. Make sure `app/storage/` is writable by PHP.

## Security Notes

- `.htaccess` blocks direct public access to:
  - `app/`
  - `scripts/`
  - `assets/image-sources/`
- Keep `app/config.php` out of version control if you place real email addresses or secrets in it.

## Next Steps

- For long-term newsletter management, connect `subscribe.php` to a provider like Brevo or Mailchimp instead of only saving CSV rows.
- For long-term contact handling, you can move `contact.php` from CSV storage to MySQL or a CRM integration later without changing the frontend form action.
