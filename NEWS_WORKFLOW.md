# News Workflow

Use the Hitech newsroom as an admin-only publishing workflow.

## Main files

- `assets/data/news-articles.json`
- `news/index.html`
- `news/article/index.html`
- `news/studio/index.php`
- `assets/js/news.js`
- `assets/css/news.css`
- `api/news-admin.php`

## Admin setup

1. Copy `app/config.sample.php` to `app/config.php`.
2. Set `admin.username`.
3. Generate a password hash with:
   `php -r "echo password_hash('your-strong-password', PASSWORD_DEFAULT), PHP_EOL;"`
4. Paste that value into `admin.password_hash`.
5. Upload the updated files.

## Easiest way to publish a story

1. Open `/news/studio/` in the browser.
2. Sign in with the configured admin account.
3. Click `New Article`.
4. Fill in the title, summary, image path, highlights, and article body.
5. Click `Save To Feed`.
6. Click `Publish Live`.

## Body formatting supported in the studio

- Blank line: new paragraph
- `## Heading`: section heading
- `- item`: bullet list item
- `> quote`: pull quote/callout

## Notes

- The newsroom listing page and the article detail page both read from `assets/data/news-articles.json`.
- Only authenticated admins can access the publishing editor and publish changes to the live feed.
- Articles are automatically ordered by published date, newest first.
- The newest article becomes the lead story on the newsroom page.
- Article links currently use `/news/article/?slug=your-article-slug`.
- Use image paths that already exist in the project, or add new images under `assets/images/` and reference them here.
- `Download Backup JSON` is still available if you want an offline copy of the current feed.
