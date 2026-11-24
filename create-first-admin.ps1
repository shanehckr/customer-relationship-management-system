$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$phpExe = 'C:\xampp\php\php.exe'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'config.local.php'))) {
    throw 'config.local.php is missing. Configure the dedicated application database account first.'
}
if (-not (Test-Path -LiteralPath $phpExe)) { throw 'PHP CLI was not found at C:\xampp\php\php.exe.' }

$fullName = (Read-Host 'Admin full name').Trim()
$username = (Read-Host 'Admin username').Trim()
$email = (Read-Host 'Admin email').Trim()
$passwordSecure = Read-Host 'Admin password (minimum 12 characters)' -AsSecureString
$confirmSecure = Read-Host 'Confirm admin password' -AsSecureString

$bstrPassword = [IntPtr]::Zero
$bstrConfirm = [IntPtr]::Zero
$tempPhp = Join-Path $env:TEMP ('catering-crm-first-admin-' + [guid]::NewGuid().ToString('N') + '.php')
try {
    $bstrPassword = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)
    $bstrConfirm = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmSecure)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrPassword)
    $confirm = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstrConfirm)
    if ($password -cne $confirm) { throw 'The passwords do not match.' }

    $env:CRM_BOOTSTRAP_FULL_NAME = $fullName
    $env:CRM_BOOTSTRAP_USERNAME = $username
    $env:CRM_BOOTSTRAP_EMAIL = $email
    $env:CRM_BOOTSTRAP_PASSWORD = $password
    $env:CRM_BOOTSTRAP_DB_CONFIG = Join-Path $projectRoot 'config/database.php'

    $php = @'
<?php
declare(strict_types=1);
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$fullName = trim((string)getenv('CRM_BOOTSTRAP_FULL_NAME'));
$username = trim((string)getenv('CRM_BOOTSTRAP_USERNAME'));
$email = trim((string)getenv('CRM_BOOTSTRAP_EMAIL'));
$password = (string)getenv('CRM_BOOTSTRAP_PASSWORD');
if ($fullName === '' || mb_strlen($fullName, 'UTF-8') > 150 || $username === '' || mb_strlen($username, 'UTF-8') > 50 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255 || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Invalid account details. Name/username lengths must fit the schema, email must be valid, and password must be 12–72 bytes.\n");
    exit(2);
}
require (string)getenv('CRM_BOOTSTRAP_DB_CONFIG');
$transactionOpen = false;
try {
    $conn->begin_transaction();
    $transactionOpen = true;
    $role = $conn->query("SELECT role_id FROM roles WHERE role_name = 'Admin' LIMIT 1 FOR UPDATE")->fetch_assoc();
    if (!$role) { throw new RuntimeException("The Admin role is missing. Install the approved schema first."); }
    $roleId = (int)$role['role_id'];
    $existing = $conn->query("SELECT user_id FROM users WHERE role_id = {$roleId} LIMIT 1")->fetch_assoc();
    if ($existing) { throw new RuntimeException("An Admin account already exists; bootstrap refused."); }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) { throw new RuntimeException("Password hashing failed."); }
    $status = 'Active';
    $insert = $conn->prepare('INSERT INTO users (full_name, username, email, password_hash, role_id, account_status) VALUES (?, ?, ?, ?, ?, ?)');
    $insert->bind_param('ssssis', $fullName, $username, $email, $hash, $roleId, $status);
    $insert->execute();
    $userId = $insert->insert_id;
    $conn->commit();
    $transactionOpen = false;
    fwrite(STDOUT, "First Admin account created successfully (user ID {$userId}).\n");
} catch (Throwable $e) {
    if ($transactionOpen) { try { $conn->rollback(); } catch (Throwable $ignored) {} }
    fwrite(STDERR, 'Admin bootstrap failed: ' . $e->getMessage() . "\n");
    exit(1);
} finally {
    $password = '';
    putenv('CRM_BOOTSTRAP_PASSWORD');
}
'@
    [System.IO.File]::WriteAllText($tempPhp, $php, [System.Text.UTF8Encoding]::new($false))
    $output = & $phpExe $tempPhp 2>&1
    $phpExitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Output $_ }
    if ($phpExitCode -ne 0 -or -not (($output -join "`n") -match 'First Admin account created successfully')) {
        throw 'Admin account creation did not complete.'
    }
} finally {
    Remove-Item Env:CRM_BOOTSTRAP_FULL_NAME, Env:CRM_BOOTSTRAP_USERNAME, Env:CRM_BOOTSTRAP_EMAIL, Env:CRM_BOOTSTRAP_PASSWORD, Env:CRM_BOOTSTRAP_DB_CONFIG -ErrorAction SilentlyContinue
    if ($bstrPassword -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrPassword) }
    if ($bstrConfirm -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrConfirm) }
    Remove-Item -LiteralPath $tempPhp -Force -ErrorAction SilentlyContinue
    $password = $null
    $confirm = $null
    $passwordSecure.Dispose()
    $confirmSecure.Dispose()
}
