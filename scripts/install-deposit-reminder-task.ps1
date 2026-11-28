[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string]$PhpPath = '',
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$taskName = 'Espinosilla CRM Deposit Reminders'

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        if ($PSCmdlet.ShouldProcess($taskName, 'Unregister scheduled task')) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
    } else { Write-Output 'Task is not installed.' }
    exit 0
}
if ($Disable) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        if ($PSCmdlet.ShouldProcess($taskName, 'Disable scheduled task')) { Disable-ScheduledTask -TaskName $taskName | Out-Null; Write-Output 'Task disabled.' }
    } else { Write-Output 'Task is not installed.' }
    exit 0
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'run-deposit-reminders.ps1'
if ([string]::IsNullOrWhiteSpace($PhpPath)) {
    $phpCommand = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($phpCommand) { $PhpPath = $phpCommand.Source }
    else {
        $candidates = @('C:\xampp\php\php.exe', (Join-Path $env:ProgramFiles 'xampp\php\php.exe'))
        $PhpPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    }
}
if (-not $PhpPath -or -not (Test-Path -LiteralPath $PhpPath)) { throw 'Could not find php.exe. Pass -PhpPath with your XAMPP PHP location.' }
$PhpPath = (Resolve-Path -LiteralPath $PhpPath).Path
$runner = (Resolve-Path -LiteralPath $runner).Path
$taskCommand = 'powershell.exe'
$taskArgs = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -PhpPath "{1}"' -f $runner, $PhpPath
$start = (Get-Date).AddMinutes(1).ToString('s')
$escapedCmd = [System.Security.SecurityElement]::Escape($taskCommand)
$escapedArgs = [System.Security.SecurityElement]::Escape($taskArgs)
$escapedDir = [System.Security.SecurityElement]::Escape($projectRoot)
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Checks CRM payment deadlines every minute using the local project PHP worker.</Description></RegistrationInfo>
  <Triggers><CalendarTrigger><StartBoundary>$start</StartBoundary><Enabled>true</Enabled><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay><Repetition><Interval>PT1M</Interval><Duration>P1D</Duration><StopAtDurationEnd>false</StopAtDurationEnd></Repetition></CalendarTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>$([System.Security.SecurityElement]::Escape([System.Security.Principal.WindowsIdentity]::GetCurrent().Name))</UserId><LogonType>S4U</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowHardTerminate>true</AllowHardTerminate><StartWhenAvailable>true</StartWhenAvailable><Enabled>false</Enabled><Hidden>true</Hidden><ExecutionTimeLimit>PT5M</ExecutionTimeLimit></Settings>
  <Actions Context="Author"><Exec><Command>$escapedCmd</Command><Arguments>$escapedArgs</Arguments><WorkingDirectory>$escapedDir</WorkingDirectory></Exec></Actions>
</Task>
"@

if ($PSCmdlet.ShouldProcess($taskName, 'Register disabled per-user task (runs every minute)')) {
    Register-ScheduledTask -TaskName $taskName -Xml $xml -Force | Out-Null
    Write-Output 'Scheduled task registered DISABLED. Existing records have not been processed.'
}
if ($Enable) {
    $approval = Read-Host 'Enabling can immediately close overdue local inquiries. Type ENABLE to approve'
    if ($approval -ceq 'ENABLE' -and $PSCmdlet.ShouldProcess($taskName, 'Enable automatic deadline processing')) {
        Enable-ScheduledTask -TaskName $taskName | Out-Null
        Write-Output 'Scheduled task enabled. It may immediately process eligible overdue records.'
    } else {
        Write-Output 'Task remains disabled.'
    }
} else {
    Write-Output 'To enable after reviewing local records, rerun with -Enable and confirm the PowerShell approval prompt.'
}
