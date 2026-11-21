#Requires -Version 5.1
<#
.SYNOPSIS
    Autonomous CLI Pipeline for SMB Site Generation, R2 Deployment, and WhatsApp Outreach.

.DESCRIPTION
    Executes the pipeline:
    1. Ingestion: Direct Google Maps Scraper (Playwright) or reads prospect JSON.
    2. Headless WP Staging: Builds a prospect-grounded site on wpwv.codev.id.
    3. Static Export: Runs Simply Static, optionally localizes, and checks links and routes.
    4. Single Edge R2 Sync: Pushes flat assets to R2 and verifies the result.
       (Dynamic ZIP downloads are streamed on the fly via Cloudflare Worker at https://sites.webview.click/<slug>.zip).
    5. Public hosting: Verifies the preview and ZIP. Contact sync and mobile mockups are opt-in.
    The resulting artifacts can be used by the separate LusmoBot outreach workflow.

.PARAMETER ProspectFile
    Path to prospect JSON file containing business details.
.PARAMETER HarvestQuery
    Optional query to harvest leads live from Google Maps (e.g. 'bengkel mobil malang').
.PARAMETER OracleHost
    Remote OracleServer SSH host alias or IP (default: 'ubuntu@150.136.178.5').
.PARAMETER Limit
    Maximum prospects to process in this run (default: 15).
.PARAMETER StageOnly
    Generate and download the static artifact. Skip contacts, R2 and mockups.
.PARAMETER VerifyR2
    Verify the compiled static site through a private R2 upload and byte read-back.
    Skip contacts, public publication and mockups.
.PARAMETER PrepareOutreach
    Require the prospect outreach checks and affirmative reply, then sync contacts
    and capture a mobile mockup after the public preview and ZIP pass verification.
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
    [int]$Limit = 15,

    [switch]$StageOnly,

    [switch]$VerifyR2,

    [switch]$PrepareOutreach,

    [string]$TemplateManifest = "",

    [string]$TemplateCache = "",

    [string]$LocalizationFile = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if ($StageOnly -and $VerifyR2) { throw "Choose either -StageOnly or -VerifyR2." }
$Publish = !$StageOnly -and !$VerifyR2
if ($PrepareOutreach -and !$Publish) { throw "-PrepareOutreach requires the public publishing mode." }

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 🚀 WebView.click SMB Site Generation & Outreach Pipeline " -ForegroundColor Cyan
Write-Host " Dedicated Staging Instance: wpwv.codev.id (OracleServer)  " -ForegroundColor Cyan
Write-Host " Edge Hosting: sites.webview.click (Dynamic ZIP Streaming) " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir
$SshKey = "C:\Users\THINKPAD\.ssh\ssh-key-2025-10-13.key"
$SshRunner = "C:\Users\THINKPAD\OneDrive\MD\SCRIPTS\Invoke-OracleSsh.ps1"
$SshOptions = @("-i", $SshKey, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=10", "-o", "ServerAliveCountMax=3")
$Generator = Join-Path $ScriptDir "wpwv-generate.php"
$BuildScript = Get-Content -LiteralPath (Join-Path $ScriptDir "wpwv-build.sh") -Raw -Encoding UTF8
if ($OracleHost -cne "ubuntu@150.136.178.5") {
    throw "WebView staging must use the OracleServer host configured in Invoke-OracleSsh.ps1."
}

# Auto-harvest if query provided
if ($HarvestQuery -ne "" -and ($ProspectFile -eq "" -or -not (Test-Path -LiteralPath $ProspectFile))) {
    Write-Host "`n🔍 [Harvest] Scraping Google Maps for: '$HarvestQuery' (Limit: $Limit)..." -ForegroundColor Yellow
    $ProspectFile = Join-Path $ProjectRoot "prospects-harvested.json"
    python "$ScriptDir\scrape-maps-direct.py" --query "$HarvestQuery" --limit $Limit --out $ProspectFile
    if ($LASTEXITCODE -ne 0) { throw "Prospect harvest failed." }
}

if ($ProspectFile -eq "" -or -not (Test-Path -LiteralPath $ProspectFile -PathType Leaf)) {
    Write-Error "Prospect file not found or not specified. Pass -ProspectFile or -HarvestQuery."
}

$ProspectFile = (Resolve-Path -LiteralPath $ProspectFile).Path
$ProspectDir = Split-Path -Parent $ProspectFile
$Prospects = Get-Content -LiteralPath $ProspectFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Prospects -isnot [array]) {
    $Prospects = @($Prospects)
}

$Batch = @($Prospects | Where-Object { $null -ne $_ } | Select-Object -First $Limit)
if ($Batch.Count -eq 0) { throw "No prospects selected." }
Write-Host "📋 Loaded $($Batch.Count) prospect(s) for processing (Target pace: 15/day)." -ForegroundColor Green

foreach ($Biz in $Batch) {
    $Phone = $Biz.phone -replace '[^0-9+]', ''
    $Name = $Biz.name
    $Niche = if ($Biz.niche) { $Biz.niche } else { "general" }
    if ([string]::IsNullOrWhiteSpace($Name) -or $Name.Length -gt 160 -or $Phone -notmatch '\A\+[1-9][0-9]{7,14}\z') {
        throw "A prospect must have a business name and an E.164 phone number."
    }
    
    $RunId = [guid]::NewGuid().ToString('N')
    $RemoteDir = "/tmp/webview-$RunId"
    $LocalZip = Join-Path $env:TEMP "webview-$RunId-site.zip"
    $LocalBrief = Join-Path $env:TEMP "webview-$RunId-brief.json"
    $LocalCompiled = Join-Path $env:TEMP "webview-$RunId-input.json"

    $TransferStarted = $false
    try {
        $Biz.phone = $Phone
        $Biz | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $LocalBrief -Encoding UTF8
        $Slug = & python "$ScriptDir\check-smb-export.py" slug $LocalBrief
        if ($LASTEXITCODE -ne 0) { throw "Review the business name, niche, country and city for $Name." }
        $LocalExportDir = Join-Path $ProjectRoot "dist-staging\$Slug-$RunId"
        $RemoteCommand = "set -- '$RunId' '$Slug'" + [Environment]::NewLine + $BuildScript
        $CompileArgs = @("$ScriptDir\compile-smb-site.py", $LocalBrief, $LocalCompiled, "--asset-dir", $ProspectDir)
        if ($TemplateManifest) { $CompileArgs += @("--manifest", $TemplateManifest) }
        if ($TemplateCache) { $CompileArgs += @("--template-cache", $TemplateCache) }
        if ($PrepareOutreach) { $CompileArgs += "--outreach" }
        & python @CompileArgs
        if ($LASTEXITCODE -ne 0) { throw "Template or prospect brief needs review for $Slug." }
        Write-Host "⚙️ Generating and exporting $Slug on wpwv.codev.id..." -ForegroundColor Magenta
        $TransferStarted = $true
        "umask 077; mkdir -- '$RemoteDir'" |
            & powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File $SshRunner -TimeoutSeconds 20
        if ($LASTEXITCODE -ne 0) { throw "Could not create the remote transfer directory." }
        $RemoteInput = '{0}:{1}/input.json' -f $OracleHost, $RemoteDir
        $RemoteWriter = '{0}:{1}/wpwv-generate.php' -f $OracleHost, $RemoteDir
        & scp.exe @SshOptions $LocalCompiled $RemoteInput
        if ($LASTEXITCODE -ne 0) { throw "Compiled input upload failed for $Slug." }
        & scp.exe @SshOptions $Generator $RemoteWriter
        if ($LASTEXITCODE -ne 0) { throw "Staging writer upload failed for $Slug." }
        $RemoteCommand | & powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File $SshRunner -TimeoutSeconds 305
        if ($LASTEXITCODE -ne 0) { throw "WordPress generation or export failed for $Slug." }
        New-Item -ItemType Directory -Path $LocalExportDir | Out-Null
        $RemoteZip = '{0}:{1}/site.zip' -f $OracleHost, $RemoteDir
        & scp.exe @SshOptions $RemoteZip $LocalZip
        if ($LASTEXITCODE -ne 0) { throw "Static export download failed for $Slug." }
        Expand-Archive -LiteralPath $LocalZip -DestinationPath $LocalExportDir
        if (-not (Test-Path -LiteralPath (Join-Path $LocalExportDir "index.html") -PathType Leaf)) {
            throw "Missing exported homepage for $Slug."
        }
        if ($LocalizationFile) {
            & python "$ScriptDir\localize-smb-export.py" $LocalExportDir --catalog $LocalizationFile
            if ($LASTEXITCODE -ne 0) { throw "Localized static export needs review for $Slug." }
        }
        & python "$ScriptDir\check-smb-export.py" check $LocalExportDir $Slug
        if ($LASTEXITCODE -ne 0) { throw "Static references failed validation for $Slug." }
    } finally {
        foreach ($LocalTemp in @($LocalBrief, $LocalCompiled, $LocalZip)) {
            if (Test-Path -LiteralPath $LocalTemp) { Remove-Item -LiteralPath $LocalTemp }
        }
        if ($TransferStarted) {
            "if [ -d '$RemoteDir' ] && [ ! -L '$RemoteDir' ]; then rm -f -- '$RemoteDir/site.zip' '$RemoteDir/input.json' '$RemoteDir/wpwv-generate.php' && rmdir -- '$RemoteDir'; fi" |
                & powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File $SshRunner -TimeoutSeconds 25
            if ($LASTEXITCODE -ne 0) { Write-Warning "Could not clean remote export $RunId." }
        }
    }
    Write-Host "Static artifact: $LocalExportDir" -ForegroundColor Green
    if ($StageOnly) { continue }

    Write-Host "☁️ Syncing flat assets to Cloudflare R2..." -ForegroundColor Magenta
    $DeployArgs = @("$ScriptDir\deploy-site-to-r2.mjs", "--dir", $LocalExportDir, "--slug", $Slug)
    if ($VerifyR2) { $DeployArgs += @("--verification-run", $RunId) }
    & node @DeployArgs
    if ($LASTEXITCODE -ne 0) { throw "R2 upload failed for $Slug." }
    if ($VerifyR2) { continue }

    & python "$ScriptDir\check-sites-edge.py" --export $LocalExportDir --slug $Slug
    if ($LASTEXITCODE -ne 0) { throw "Public preview or ZIP verification failed for $Slug." }

    $PreviewUrl = "https://sites.webview.click/$Slug/"
    Write-Host "🌐 Live Site: $PreviewUrl" -ForegroundColor Cyan
    Write-Host "📦 Dynamic ZIP: https://sites.webview.click/${Slug}.zip" -ForegroundColor Cyan
    if (!$PrepareOutreach) { continue }

    Write-Host "👤 Syncing to Google Contacts as '[SMB] $Name'..." -ForegroundColor Magenta
    
    $GogCli = "C:\Users\THINKPAD\scripts\gog.exe"
    if (Test-Path $GogCli) {
        try {
            & $GogCli contacts create --given-name "$Name" --family-name "[SMB]" --phone "$Phone" --org "$Name" --no-input 2>$null
            if ($LASTEXITCODE -ne 0) { throw "Google Contacts sync failed." }
            Write-Host "  ✓ Saved via gog.exe to Google Contacts" -ForegroundColor Green
        } catch {
            Write-Host "  ℹ️ gog.exe auth needed, generating local VCF export..." -ForegroundColor Yellow
        }
    }

    $TempContactJson = Join-Path $env:TEMP "$RunId-contact.json"
    $ContactPayload = @(@{
        name = $Name
        phone = $Phone
        address = $Biz.address
        niche = $Niche
    }) | ConvertTo-Json
    Set-Content -Path $TempContactJson -Value $ContactPayload -Encoding UTF8

    $VcfOut = Join-Path $ProjectRoot "contacts-$Slug.vcf"
    try {
        node "$ScriptDir\sync-google-contacts.mjs" --input $TempContactJson --vcf $VcfOut
        if ($LASTEXITCODE -ne 0) { throw "Local vCard generation failed for $Slug." }
    } finally {
        Remove-Item -LiteralPath $TempContactJson -ErrorAction SilentlyContinue
    }

    Write-Host "📸 Capturing mobile mockup for WhatsApp delivery..." -ForegroundColor Magenta
    $MockupPath = Join-Path $ProjectRoot "mockups\$Slug-mobile.jpg"
    New-Item -ItemType Directory -Path (Split-Path -Parent $MockupPath) -Force | Out-Null

    python "$ScriptDir\capture-screenshot.py" --url $PreviewUrl --output $MockupPath
    if ($LASTEXITCODE -ne 0) { throw "Mobile mockup failed for $Slug." }

    Write-Host "`n✅ Prepared for outreach: $Name" -ForegroundColor Green
    Write-Host "   🖼️ Mockup:    $MockupPath" -ForegroundColor Cyan
    Write-Host "   👤 Contact:   [SMB] $Name ($Phone)" -ForegroundColor Cyan
}

if (!$PrepareOutreach) { return }

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " 🏁 Batch complete! Ready for LusmoBot 15/day dispatch.    " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
