Param(
    [string]$OutputDir = "deploy_bundle"
)

$ErrorActionPreference = "Stop"

function Invoke-Step([string]$label, [scriptblock]$action) {
    Write-Host $label
    & $action
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $label (exit code $LASTEXITCODE)"
    }
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Ensure-Dir([string]$path) {
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
    }
}

if (!(Test-Path "node_modules")) {
    Invoke-Step "[1/8] Installing root dependencies..." { npm install }
} else {
    Write-Host "[1/8] Root dependencies already installed, skipping."
}

Invoke-Step "[2/8] Building server..." { npm --workspace server run build }
Invoke-Step "[3/8] Building client..." { npm --workspace client run build }

Invoke-Step "[4/8] Building backend exe..." {
    Set-Location "$root\server"
    npm run build:exe
    Set-Location $root
}

Write-Host "[5/8] Preparing bundle folders..."
$bundleRoot = Join-Path $root $OutputDir
if (Test-Path $bundleRoot) {
    Remove-Item -Recurse -Force $bundleRoot
}
Ensure-Dir $bundleRoot
Ensure-Dir "$bundleRoot\client\dist"
Ensure-Dir "$bundleRoot\server\release"
Ensure-Dir "$bundleRoot\server\db"
Ensure-Dir "$bundleRoot\server\uploads"
Ensure-Dir "$bundleRoot\server\assets"
Ensure-Dir "$bundleRoot\server\python_ml"
Ensure-Dir "$bundleRoot\samples"
Ensure-Dir "$bundleRoot\logs"

Write-Host "[6/8] Copying frontend build..."
Copy-Item -Recurse -Force "$root\client\dist\*" "$bundleRoot\client\dist\"

Write-Host "[7/8] Copying backend exe and runtime assets..."
if (!(Test-Path "$root\server\release\statlab-server.exe")) {
    throw "Backend exe was not generated: $root\server\release\statlab-server.exe"
}
Copy-Item -Force "$root\server\release\statlab-server.exe" "$bundleRoot\server\release\"
if (Test-Path "$root\server\db\statlab.sqlite") {
    Copy-Item -Force "$root\server\db\statlab.sqlite" "$bundleRoot\server\db\"
}
Copy-Item -Recurse -Force "$root\server\assets\*" "$bundleRoot\server\assets\"
Copy-Item -Recurse -Force "$root\server\python_ml\*" "$bundleRoot\server\python_ml\"
Copy-Item -Recurse -Force "$root\samples\*" "$bundleRoot\samples\"

Write-Host "[8/8] Copying deployment docs/templates..."
Copy-Item -Force "$root\DEPLOY_IIS_NSSM.md" "$bundleRoot\"
Copy-Item -Force "$root\server\.env.production.example" "$bundleRoot\server\"
Copy-Item -Force "$root\server\prisma\schema.prisma" "$bundleRoot\server\"

Write-Host "[9/9] Writing bundle manifest..."
$manifest = @{
    created_at = (Get-Date).ToString("s")
    bundle_root = (Resolve-Path $bundleRoot).Path
    frontend = "client\\dist"
    backend_exe = "server\\release\\statlab-server.exe"
    sqlite_db = "server\\db\\statlab.sqlite"
    python_ml = "server\\python_ml"
    env_template = "server\\.env.production.example"
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content "$bundleRoot\bundle-manifest.json" -Encoding UTF8

Write-Host "Bundle ready at: $bundleRoot"
