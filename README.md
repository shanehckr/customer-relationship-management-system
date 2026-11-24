# Espinosilla's Kainan Catering CRM

A role-based CRM for handling catering inquiries, quotations, bookings, customer communications, payments, and operational reporting.

## Technology

- PHP 8.1 or later (the included XAMPP setup currently uses PHP 8.4)
- MariaDB 10.11.19 or later, or a compatible MySQL release
- Apache and MySQLi with `mysqlnd`
- Browser-side JavaScript, HTML, and CSS
- PHPMailer (included under `phpmailer/src`)
- Xendit Invoice API for hosted deposit payments

## Requirements

Install XAMPP or an equivalent local stack with Apache, PHP, MariaDB/MySQL, and the PHP `mysqli`, `curl`, and `openssl` extensions enabled. The database schema uses InnoDB, `utf8mb4`, JSON columns, and database constraints. The first-admin helper expects the default XAMPP PHP path `C:\xampp\php\php.exe`.

## Run locally

1. Clone the repository into the web server's document root, such as `C:\xampp\htdocs\customer-relationship-management-system`.
2. Start Apache and MariaDB/MySQL from the XAMPP Control Panel.
3. Create the `catering_crm` database and import `database/catering_crm.sql` using phpMyAdmin or the MariaDB client. This file defines the schema and the five roles; it does not create an administrator account.
4. Create a dedicated database account for this application and grant it only the privileges needed on `catering_crm`. Do not use the MariaDB `root` account.
5. Copy `config.example.php` to the ignored, local-only `config.local.php`. Set the local database host, dedicated username, password, and database name. Keep this file out of Git.
6. Open `http://localhost/customer-relationship-management-system/` in a browser.
7. To create the first Admin user, run `database/create-first-admin.ps1` in PowerShell. It prompts for the account details and does not store the password in the repository. Run it only after configuring the database and importing the schema.

Each developer must configure their own local database account and `config.local.php`. The account is intentionally not supplied by the repository. Never copy another developer's local credentials.

## Optional integrations

### Xendit

For payment testing, configure `xendit_secret_key` and, when using callbacks, `xendit_callback_token` in the local `config.local.php`. Use test-mode credentials for local development. The application makes payment requests server-side; never put these keys in JavaScript, HTML, or a checked-in file. The Xendit return URL is currently configured for the local project URL in `xendit-api.php`; deployments at another URL need an appropriate server-side URL configuration.

### Phone verification

Customer registration requires a provider-confirmed mobile verification code before account creation. No SMS provider is currently configured, so live registration cannot be completed until a provider is integrated server-side. Do not add a fallback, default code, or verification bypass.

### Email

The tracked `.env.example` lists the mail queue environment variables. Set values in the environment used by Apache/PHP and, for the queue key, the scheduled CLI worker; `.env.example` itself is documentation and is not loaded automatically. SMTP passwords belong in a protected PHP config outside the public document root. Follow [docs/email-system-setup.md](docs/email-system-setup.md) for the protected file format, queue key, and Windows Task Scheduler setup. Each developer or deployment administrator configures their own credentials. Do not enable email until the SMTP account and queue encryption key are configured.

### Database migrations

The base installation schema is `database/catering_crm.sql`. It includes the current notification-log email queue columns and delivery details for inquiries, so it is intended for fresh installations and requires no migration afterward. Back up existing databases before any future schema changes.

## Roles

- **Admin:** system administration and access to administrative operations.
- **Manager:** management dashboards, operational oversight, reports, and shared business workflows.
- **Sales Staff:** inquiry handling, quotations, booking coordination, and customer communication.
- **Customer Service Staff:** customer support, inbox, and ticket workflows.
- **Customer:** inquiries, quotations, bookings, payments, messaging, support, and feedback.

Access is role-based. Keep authorization checks in the PHP endpoints; hiding a page or control in the browser is not an authorization boundary.

## Main workflow

Customers submit catering inquiries. Staff review the event details and prepare or revise quotations. Customers can accept a quotation and pay through the hosted payment flow; successful payment is verified server-side before booking conversion. Staff fulfill bookings and communicate with customers through inbox and ticket workflows. Customers can submit feedback, while authorized staff manage menus, pricing, notifications, and reports.

## Security for contributors

- Never commit `config.local.php`, `.env` files containing real values, SMTP config, API keys, webhook tokens, private keys, database exports containing live data, or customer uploads.
- Use test credentials and a disposable local database. Never run development checks against production data.
- Keep Xendit and mail credentials on the server. Do not log secrets or include them in browser responses.
- Use a dedicated, least-privileged database user. Do not weaken the `config/database.php` root-account check.
- Treat SQL files and upload assets as publishable only after checking them for real customer records and other private information.
- Before pushing, inspect both staged and unstaged changes and verify that secrets are not already present in Git history. `.gitignore` does not remove previously committed content.

## Repository notes

Bundled Bootstrap, Bootstrap Icons, ExcelJS, and PHPMailer files are runtime dependencies. Menu images under `uploads/menu/` are used by menu management and the public menu presentation; do not ignore or remove them without checking the configured menu records. The email queue smoke script writes temporary rows to the configured database and cleans those rows up; run it only against a disposable development database.
