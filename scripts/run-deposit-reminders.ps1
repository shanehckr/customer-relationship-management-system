param([string]$PhpPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$worker = Join-Path $projectRoot 'cron-booking-deadlines.php'

if ([string]::IsNullOrWhiteSpace($PhpPath)) {
    $phpCommand = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($phpCommand) { $PhpPath = $phpCommand.Source }
    else {
        $candidates = @('C:\xampp\php\php.exe', (Join-Path $env:ProgramFiles 'xampp\php\php.exe'))
        $PhpPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
}
if (-not $PhpPath -or -not (Test-Path -LiteralPath $PhpPath)) { exit 2 }

$logDir = Join-Path $projectRoot 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir 'deposit-reminders.log'
if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 2MB) {
    Move-Item -LiteralPath $logFile -Destination ($logFile + '.1') -Force
}
$output = & $PhpPath $worker 2>&1
$exitCode = $LASTEXITCODE
if ($output) { Add-Content -LiteralPath $logFile -Value ($output | ForEach-Object { [string]$_ }) }
exit $exitCode
