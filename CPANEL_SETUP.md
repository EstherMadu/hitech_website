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
   - `admin.username`
   - `admin.password_hash`
   - `newsletter.notify_email`
   - `newsletter.from_email`
   - `contact.notify_email`
   - `contact.from_email`
5. Make sure `app/storage/` is writable by PHP.

## Admin News Publishing

- The news studio now runs as an admin-only page at `/news/studio/`.
- Create the admin password hash locally with:
  - `php -r "echo password_hash('your-strong-password', PASSWORD_DEFAULT), PHP_EOL;"`
- Put that hash into `app/config.php` under `admin.password_hash`.
- Never store the plain-text password in the codebase.
- After deployment, sign in at `/news/studio/` and use `Publish Live` to update the site news feed directly.

## SSL and HTTPS

- This project now includes an `.htaccess` rule that redirects HTTP traffic to HTTPS.
- The site can only use HTTPS after an SSL certificate is actually installed on the domain in cPanel.
- In cPanel, open `SSL/TLS Status` and run `AutoSSL`, or enable the SSL certificate provided by your host.
- After the certificate is active, visit `https://your-domain/` and confirm the browser shows a secure lock.

## Search Engine Setup

- `robots.txt` is included at the site root.
- `sitemap.xml` is included at the site root.
- The homepage now includes stronger SEO metadata, canonical tags, Open Graph tags, and organization schema.
- After deployment, add the site to Google Search Console and submit:
  - `https://hitech-company.com/sitemap.xml`
- Request indexing for the homepage after the first live deployment.

## Important SEO Note

- Code can improve search visibility, indexing, and relevance signals.
- Code cannot guarantee that the site will be the first result for every search for `Hitech`.
- Search ranking depends on competition, domain history, backlinks, search intent, brand authority, and Google indexing decisions.

## Security Notes

- `.htaccess` blocks direct public access to:
  - `app/`
  - `scripts/`
  - `assets/image-sources/`
- Keep `app/config.php` out of version control if you place real email addresses or secrets in it.

## Next Steps

- For long-term newsletter management, connect `subscribe.php` to a provider like Brevo or Mailchimp instead of only saving CSV rows.
- For long-term contact handling, you can move `contact.php` from CSV storage to MySQL or a CRM integration later without changing the frontend form action.
