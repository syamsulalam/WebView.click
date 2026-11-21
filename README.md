<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WebView.click

[WebView.click](https://webview.click/) finds business listings and prepares website previews. The WordPress staging service at `wpwv.codev.id` generates the sites, and `sites.webview.click/<slug>/` serves published static previews.

Cloudflare Pages serves the React app and `/api`. Pages Functions use Clerk for admin authorization, D1 for CRM and orders, and the `webview` R2 bucket for app assets. The separate `sites-webview-click` Worker reads the private `webview-sites` bucket for static previews and ZIPs. **Download Your Site** opens `webview.click/site-package/<slug>` for the free download and optional managed setup.

Use the [PRD](PRD.md) for current product decisions, the [codebase reference](CODEBASE.md) for architecture, the [pipeline guide](GUIDE.md) for publishing, and the [Cloudflare setup guide](docs/setup-panduan.md) for bindings. Start verification with `pnpm install --frozen-lockfile`, `pnpm run lint`, and `pnpm run build`.

From the repository root, generate and download a staging artifact for one prospect:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-smb-pipeline.ps1 -ProspectFile .\prospect-brief.json -Limit 1 -StageOnly
```

The command uses the configured Oracle SSH runner and prints the local artifact directory. Omit `-StageOnly` to publish a reviewed brief and verify the public preview and direct ZIP. Use `-VerifyR2` for private upload verification. Run `python scripts/check-r2-usage.py` for account-wide R2 usage estimates. See the [pipeline guide](GUIDE.md), [outreach SOP](SOP.md), and [codebase reference](CODEBASE.md).

Check a niche against a current Starter Templates Companion manifest before planning a client preview. The build requires a reviewed mapping in `data/smb-template-layouts.json`. The first mapped template is Car Repair.

```powershell
python scripts/resolve-smb-template.py --manifest C:/path/to/companion/assets/templates/manifest.json --query 'car detailing business bay dubai'
```

To verify a published export and its ZIP, run `python scripts/check-sites-edge.py --export <export-folder> --slug <slug>`. Keep the same slug when replacing a business's release.
