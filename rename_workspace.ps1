# PowerShell script to rename the workspace folder from Infero to sonoro.
# IMPORTANT: Close your VS Code / IDE window BEFORE running this script to avoid folder lock issues.

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "             SONORO WORKSPACE RENAMER" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will rename your project directory from 'Infero' to 'sonoro'." -ForegroundColor Yellow
Write-Host "To ensure a smooth rename:" -ForegroundColor Yellow
Write-Host "1. Close this VS Code or IDE window completely." -ForegroundColor White
Write-Host "2. Open a new PowerShell window." -ForegroundColor White
Write-Host "3. Run this script from the parent folder, or execute the commands below." -ForegroundColor White
Write-Host ""
Write-Host "Starting folder rename in 5 seconds... (Press Ctrl+C to cancel)" -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Determine paths
$currentScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir = Split-Path -Parent $currentScriptDir
$sourcePath = Join-Path $parentDir "Infero"
$destPath = Join-Path $parentDir "sonoro"

if (Test-Path $sourcePath) {
    try {
        Write-Host "Renaming folder: '$sourcePath' -> '$destPath'" -ForegroundColor Cyan
        Rename-Item -Path $sourcePath -NewName "sonoro" -ErrorAction Stop
        Write-Host "Success! The folder has been renamed to 'sonoro'." -ForegroundColor Green
        Write-Host "You can now open the folder '$destPath' in VS Code." -ForegroundColor Green
    }
    catch {
        Write-Host "Error: Could not rename the folder." -ForegroundColor Red
        Write-Host "Details: $_" -ForegroundColor DarkRed
        Write-Host "Please make sure ALL instances of VS Code, terminal shells, or file explorers targeting 'Infero' are CLOSED, then try again." -ForegroundColor Red
    }
} else {
    Write-Host "Folder '$sourcePath' not found. It may have already been renamed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
