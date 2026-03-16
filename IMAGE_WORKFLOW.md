# Image Workflow

The site should serve generated web images from `assets/images/`.

Untouched source images should live in `assets/image-sources/`.

## Update Steps

1. Add or replace the original file under `assets/image-sources/` using the same relative path as the live asset.
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-Images.ps1
```

3. Review the generated files in `assets/images/`.
4. Commit both the source image and the generated web asset.

## Notes

- The optimization rules live in `scripts/image-rules.json`.
- Files without a matching rule are copied as-is.
- The current rules optimize the large construction photos and partner PNG logos while leaving smaller assets untouched.
- This keeps the originals safe and makes the web-ready assets reproducible.
- `assets/image-sources/` is a source folder, not a public asset folder.
- Vercel is covered by `.vercelignore`, which excludes `assets/image-sources/`, `scripts/`, and this workflow note from production deployment.
- For other hosts, make sure those workflow-only files are excluded from the final upload or publish directory.
