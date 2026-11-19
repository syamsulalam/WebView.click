<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# WebView.click

[WebView.click](https://webview.click/) finds business listings and prepares website previews. The WordPress staging service at `wpwv.codev.id` generates the sites, and `sites.webview.click/<slug>/` serves published static previews.

From the repository root, generate and download a staging artifact for one prospect:

```powershell
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File .\scripts\run-smb-pipeline.ps1 -ProspectFile .\prospects-today.json -Limit 1 -StageOnly
```

The command uses the configured Oracle SSH runner and prints the local artifact directory. See the [pipeline guide](GUIDE.md) for input and publishing steps, the [outreach SOP](SOP.md) for when to generate sites, and the [codebase reference](CODEBASE.md) for the architecture.
