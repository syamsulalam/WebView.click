<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WebView.click

[WebView.click](https://webview.click/) finds business listings and prepares website previews. The WordPress staging service at `wpwv.codev.id` generates the sites, and `sites.webview.click/<slug>/` serves published static previews.

From the repository root, generate and download a staging artifact for one prospect:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-smb-pipeline.ps1 -ProspectFile .\prospect-brief.json -Limit 1 -StageOnly
```

The command uses the configured Oracle SSH runner and prints the local artifact directory. Omit `-StageOnly` to publish a reviewed brief and verify the public preview and direct ZIP. Use `-VerifyR2` for private upload verification. Run `python scripts/check-r2-usage.py` for account-wide R2 usage estimates. See the [pipeline guide](GUIDE.md), [outreach SOP](SOP.md), and [codebase reference](CODEBASE.md).

Check a niche against a current Starter Templates Companion manifest before planning a client preview. The build requires a reviewed mapping in `data/smb-template-layouts.json`. The first mapped template is Car Repair.

```powershell
python scripts/resolve-smb-template.py --manifest C:/path/to/companion/assets/templates/manifest.json --query 'car detailing business bay dubai'
```

Run `python scripts/check-sites-edge.py` to check the [live publishing fixture](https://sites.webview.click/webview-publishing-check-20261119/) and its ZIP.
