<?php

/*
 * Example configuration template for the application's environment settings.
 * Use placeholder values only; never store production credentials here.
 */

return [
    "host" => "localhost",
    // Create this dedicated, least-privileged MariaDB account for the CRM.
    "username" => "crm_app",
    "password" => "",
    "database" => "catering_crm",
    // Optional business pickup address shown read-only in Customer Pickup inquiries.
    "pickup_location" => ""
];
