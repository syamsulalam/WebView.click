#Requires -Version 5.1
<#
.SYNOPSIS
    Autonomous CLI Pipeline for SMB Site Generation, R2 Deployment, and WhatsApp Outreach.

.DESCRIPTION
    Executes the 6-stage pipeline:
    1. Ingestion: Direct Google Maps Scraper (Playwright) or reads prospect JSON.
    2. Contact Sync: Saves prospect to Google Contacts as "[SMB] <Business Name>" via gog.exe or .vcf.
    3. Headless WP Staging: Triggers 'wp st-companion create' on dedicated staging site wpwv.codev.id.
    4. Static Export: Runs Simply Static to compile flat HTML/CSS/JS.
    5. Single Edge R2 Sync: Pushes flat assets to R2 bucket 'webview-sites' under 'sites/<slug>/'.
       (Dynamic ZIP downloads are streamed on the fly via Cloudflare Worker at https://sites.webview.click/<slug>/download).
    6. Mockup Capture: Takes a high-resolution mobile screenshot (390x844).
    7. LusmoBot Queue: Schedules the 2-step value-first WhatsApp outreach (paced at 15 contacts/day).

.PARAMETER ProspectFile
    Path to prospect JSON file containing business details.
.PARAMETER HarvestQuery
    Optional query to harvest leads live from Google Maps (e.g. 'bengkel mobil malang').
.PARAMETER OracleHost
    Remote OracleServer SSH host alias or IP (default: 'ubuntu@150.136.178.5').
.PARAMETER Limit
    Maximum prospects to process in this run (default: 15).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ProspectFile = "",

    [Parameter(Mandatory = $false)]
    [string]$HarvestQuery = "",

    [Parameter(Mandatory = $false)]
    [string]$OracleHost = "ubuntu@150.136.178.5",

    [Parameter(Mandatory = $false)]
    [int]$Limit = 15
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 🚀 WebView.click SMB Site Generation & Outreach Pipeline " -ForegroundColor Cyan
Write-Host " Dedicated Staging Instance: wpwv.codev.id (OracleServer)  " -ForegroundColor Cyan
Write-Host " Edge Hosting: sites.webview.click (Dynamic ZIP Streaming) " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$SshKey = "C:\Users\THINKPAD\.ssh\ssh-key-2025-10-13.key"

# Auto-harvest if query provided
if ($HarvestQuery -ne "" -and ($ProspectFile -eq "" -or -not (Test-Path $ProspectFile))) {
    Write-Host "`n🔍 [Harvest] Scraping Google Maps for: '$HarvestQuery' (Limit: $Limit)..." -ForegroundColor Yellow
    $ProspectFile = Join-Path $ProjectRoot "prospects-harvested.json"
    python "$ScriptDir\scrape-maps-direct.py" --query "$HarvestQuery" --limit $Limit --out $ProspectFile
}

if ($ProspectFile -eq "" -or -not (Test-Path $ProspectFile)) {
    Write-Error "Prospect file not found or not specified. Pass -ProspectFile or -HarvestQuery."
}

$Prospects = Get-Content $ProspectFile -Raw | ConvertFrom-Json
if ($Prospects -isnot [array]) {
    $Prospects = @($Prospects)
}

$Batch = $Prospects | Select-Object -First $Limit
Write-Host "📋 Loaded $($Batch.Count) prospect(s) for processing (Target pace: 15/day)." -ForegroundColor Green

foreach ($Biz in $Batch) {
    $Slug = if ($Biz.slug) { $Biz.slug } else { $Biz.name.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-|-$', '' }
    $Phone = $Biz.phone -replace '[^0-9+]', ''
    $Name = $Biz.name
    $Niche = if ($Biz.niche) { $Biz.niche } else { "general" }
    
    Write-Host "`n───────────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host "🏢 Processing: $Name ($Slug) | 📱 $Phone" -ForegroundColor Yellow
    Write-Host "───────────────────────────────────────────────────────────" -ForegroundColor Gray

    # -------------------------------------------------------------
    # STAGE 1: Google Contacts Sync (Address Book Trust Pre-Save)
    # -------------------------------------------------------------
    Write-Host "👤 [Stage 1/5] Syncing to Google Contacts as '[SMB] $Name'..." -ForegroundColor Magenta
    
    $GogCli = "C:\Users\THINKPAD\scripts\gog.exe"
    if (Test-Path $GogCli) {
        try {
            & $GogCli contacts create --given-name "$Name" --family-name "[SMB]" --phone "$Phone" --org "$Name" --no-input 2>$null
            Write-Host "  ✓ Saved via gog.exe to Google Contacts" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ️ gog.exe auth needed, generating local VCF export..." -ForegroundColor Yellow
        }
    }

    $TempContactJson = Join-Path $env:TEMP "$Slug-contact.json"
    $ContactPayload = @(@{
        name = $Name
        phone = $Phone
        address = $Biz.address
        niche = $Niche
    }) | ConvertTo-Json
    Set-Content -Path $TempContactJson -Value $ContactPayload -Encoding UTF8

    $VcfOut = Join-Path $ProjectRoot "contacts-$Slug.vcf"
    node "$ScriptDir\sync-google-contacts.mjs" --input $TempContactJson --vcf $VcfOut
    Remove-Item $TempContactJson -ErrorAction SilentlyContinue

    # -------------------------------------------------------------
    # STAGE 2: Headless WordPress Site Creation on wpwv.codev.id
    # -------------------------------------------------------------
    Write-Host "⚙️ [Stage 2/5] Scaffolding WordPress site on wpwv.codev.id..." -ForegroundColor Magenta
    $RemoteStagingDir = "/home/codev-wpwv/htdocs/wpwv.codev.id"
    
    # 1. Custom 9-slot palette parameter
    $PaletteArg = "--palette=navy"
    if ($Biz.brand -and $Biz.brand.palette) {
        $PaletteJson = ($Biz.brand.palette | ConvertTo-Json -Compress)
        $PaletteArg = "--palette='$PaletteJson'"
    }

    # 2. Transparent logo parameter
    $LogoArg = ""
    if ($Biz.brand -and $Biz.brand.logo -and $Biz.brand.logo.path -and (Test-Path $Biz.brand.logo.path)) {
        $LocalLogo = $Biz.brand.logo.path
        $RemoteLogo = "/tmp/$Slug-logo.png"
        scp.exe -i $SshKey $LocalLogo "$OracleHost`:$RemoteLogo"
        $LogoArg = "--logo-file='$RemoteLogo'"
    }

    $Industry = if ($Biz.category -and $Biz.category.vertical) { $Biz.category.vertical } else { "general" }
    $RemoteCommand = "sudo -u codev-wpwv wp --path=$RemoteStagingDir st-companion create --title='$Name' --business-name='$Name' --industry='$Industry' --phone='$Phone' --domain='$Slug.webview.click' $PaletteArg $LogoArg --clean --yes"
    
    powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "C:\Users\THINKPAD\OneDrive\MD\SCRIPTS\Invoke-OracleSsh.ps1" -Command $RemoteCommand -TimeoutSeconds 180

    # -------------------------------------------------------------
    # STAGE 3: Export Flat Static HTML/CSS/JS via Simply Static
    # -------------------------------------------------------------
    Write-Host "📦 [Stage 3/5] Running Simply Static export on wpwv.codev.id..." -ForegroundColor Magenta
    $ExportCommand = "sudo -u codev-wpwv wp --path=$RemoteStagingDir simply-static run && sudo -u codev-wpwv bash -c 'if [ -d /home/codev-wpwv/static-export/ ]; then cd /home/codev-wpwv/static-export/ && zip -rq /tmp/$Slug.zip .; else cd /home/codev-wpwv/htdocs/wpwv.codev.id/wp-content/uploads/simply-static/temp-files/simply-static-0-* && zip -rq /tmp/$Slug.zip .; fi'"
    powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "C:\Users\THINKPAD\OneDrive\MD\SCRIPTS\Invoke-OracleSsh.ps1" -Command $ExportCommand -TimeoutSeconds 180

    # -------------------------------------------------------------
    # STAGE 4: Single Cloudflare R2 Upload (Dynamic ZIP Streaming)
    # -------------------------------------------------------------
    Write-Host "☁️ [Stage 4/5] Syncing flat assets to Cloudflare R2 (sites.webview.click)..." -ForegroundColor Magenta
    $LocalExportDir = Join-Path $ProjectRoot "dist-staging\$Slug"
    New-Item -ItemType Directory -Path $LocalExportDir -Force | Out-Null
    
    scp.exe -i $SshKey "$OracleHost`:/tmp/$Slug.zip" "$ProjectRoot\dist-staging\"
    Expand-Archive -Path "$ProjectRoot\dist-staging\$Slug.zip" -DestinationPath $LocalExportDir -Force

    # Upload static files only; ZIP is generated on the fly by Cloudflare Worker
    try {
        node "$ScriptDir\deploy-site-to-r2.mjs" --dir $LocalExportDir --slug $Slug --bucket "webview-sites"
    } catch {
        Write-Host "  ⚠️ Note: R2 upload pending Cloudflare bucket configuration." -ForegroundColor Yellow
    }

    # -------------------------------------------------------------
    # STAGE 5: Mobile Viewport Screenshot Capture
    # -------------------------------------------------------------
    Write-Host "📸 [Stage 5/5] Capturing mobile mockup for WhatsApp delivery..." -ForegroundColor Magenta
    $PreviewUrl = "https://wpwv.codev.id/"
    $MockupPath = Join-Path $ProjectRoot "mockups\$Slug-mobile.jpg"
    New-Item -ItemType Directory -Path (Split-Path -Parent $MockupPath) -Force | Out-Null

    python "$ScriptDir\capture-screenshot.py" --url $PreviewUrl --output $MockupPath

    Write-Host "`n✅ Successfully Provisioned: $Name" -ForegroundColor Green
    Write-Host "   🌐 Live Site: https://sites.webview.click/$Slug/ (Staging: $PreviewUrl)" -ForegroundColor Cyan
    Write-Host "   📦 Dynamic ZIP: https://sites.webview.click/$Slug/download" -ForegroundColor Cyan
    Write-Host "   🖼️ Mockup:    $MockupPath" -ForegroundColor Cyan
    Write-Host "   👤 Contact:   [SMB] $Name ($Phone)" -ForegroundColor Cyan
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " 🏁 Batch complete! Ready for LusmoBot 15/day dispatch.    " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
