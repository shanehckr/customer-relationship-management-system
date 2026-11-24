<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars((string) $_SESSION["role_name"], ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8") ?> Dashboard</title>

    <!-- Restore the collapsed sidebar state before rendering. -->
    <script>
        (function () {
            if (localStorage.getItem('sidebarCollapsed') === 'true') {
                document.documentElement.classList.add('sidebar-is-collapsed');
            }
        })();
    </script>


    <!-- Sync display values with the authenticated session. -->
    <script>
        // These values control display only; PHP still enforces authorization.
        localStorage.setItem(
            "userRole",
            <?= json_encode(
                $_SESSION["role_name"],
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
            ) ?>
        );

        localStorage.setItem(
            "userName",
            <?= json_encode(
                $_SESSION["full_name"],
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
            ) ?>
        );
    </script>


    <!-- Apply the role class before rendering to prevent a sidebar flash. -->
    <script>
        (function () {
            var r = (localStorage.getItem('userRole') || 'admin').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (r === 'cs' || r === 'cs staff' || r === 'customer service staff') r = 'customer service';
            if (r === 'sales') r = 'sales staff';
            document.documentElement.classList.add('role-' + r.replace(/\s+/g, '-'));
        })();
    </script>
    <style>
        /* Hide items that do not allow this role; "all" is visible to everyone. */
        html.role-admin .nav-item[data-role]:not([data-role="all"]):not([data-role*="admin"]),
        html.role-manager .nav-item[data-role]:not([data-role="all"]):not([data-role*="manager"]),
        html.role-customer-service .nav-item[data-role]:not([data-role="all"]):not([data-role*="customer service"]),
        html.role-sales-staff .nav-item[data-role]:not([data-role="all"]):not([data-role*="sales staff"]) {
            display: none !important;
        }

        /* Customer sees only "all" items and items whose data-role is exactly "customer".
           (Exact match on purpose: *="customer" would also match "customer service".)
           Staff rules above already hide data-role="customer" items from staff. */
        html.role-customer .nav-item:not([data-role="all"]):not([data-role="customer"]) {
            display: none !important;
        }

        /* navbar.js fills in the subtitle, user name, and role. */
        html:not(.role-ready) .brand-subtitle,
        html:not(.role-ready) #dropdownUserName,
        html:not(.role-ready) #dropdownUserRole {
            visibility: hidden !important;
        }
    </style>
    <script>
        // Show the text if navbar.js fails to initialize.
        setTimeout(function () { document.documentElement.classList.add('role-ready'); }, 1500);
    </script>

    
    <link href="all-pages-css/bootstrap/bootstrap.min.css?v=5.3.3" rel="stylesheet">
    <!-- Bootstrap Icons: loaded locally so icons still show without internet.
         Files live in all-pages-css/bootstrap-icons/ (bootstrap-icons.min.css + fonts/ folder). -->
    <link rel="stylesheet" href="all-pages-css/bootstrap-icons/bootstrap-icons.min.css?v=1.11.3">

    
    <link rel="stylesheet" href="all-pages-css/stylesheet-login.css">
    <link rel="stylesheet" href="all-pages-css/navbar.css?v=7">
    <link rel="stylesheet" href="all-pages-css/all-pages.css?v=54">
    <link rel="stylesheet" href="all-pages-css/Notification.css">
    <link rel="stylesheet" href="all-pages-css/toast.css?v=2">
    
    
   
    <script src="all-pages-js/theme.js"></script>
    <style>
        /* "Settings" link in the customer's profile menu */
        .settings-action-btn { padding: 10px 14px; height: 42px; display: flex; align-items: center; gap: 10px; text-decoration: none;
            color: var(--text-main); font-size: 13px; font-weight: 600; border-top: 1px solid var(--border-color); }
        .settings-action-btn:first-of-type { border-top: 0; }
        .settings-action-btn:hover { background: rgba(43, 182, 115, 0.12); color: var(--text-main); }
        .settings-action-icon { width: 16px; height: 16px; object-fit: contain; flex-shrink: 0; }
        html.dark-mode .settings-action-icon { filter: brightness(0) invert(1); }
    </style>
</head>

<body>

    <div class="crm-layout">

        
        <aside class="crm-sidebar" id="crmSidebar">
            <div class="sidebar-header d-flex align-items-center justify-content-between px-3">
                <div class="brand-group">
                    <h1 class="brand-title m-0 fw-bold">CRM</h1>
                    <span class="brand-subtitle">
                        <?= htmlspecialchars($_SESSION["role_name"], ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8") ?>
                    </span>
                </div>
                <button class="btn p-0 border-0 burger-toggle-btn" id="burgerToggle"
                    aria-label="Toggle Sidebar Navigation">
                    <i class="bi bi-list fs-2"></i>
                </button>
            </div>

            <!-- data-role controls sidebar visibility; dashboard and report files are role-specific. -->
            <nav class="sidebar-nav px-2">
                <ul class="nav flex-column">
                    <li class="nav-item" data-role="admin, manager, customer service, sales staff">
                        <a href="#" onclick="loadPage('dashboard', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/dashboard-icon.svg" class="sidebar-icon" alt="Dashboard Icon">
                            <span class="nav-text ms-3">Dashboard</span>
                        </a>
                    </li>

                    <!-- Customer menu: only visible to the Customer role.
                         Icon files go in the icons/ folder with these exact names. -->
                         <li class="nav-item" data-role="customer">
                        <a href="#" onclick="loadPage('customer-home.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/home-icon.svg" class="sidebar-icon" alt="Home Icon">
                            <span class="nav-text ms-3">Home</span>
                        </a>
                    </li>
                    <li class="nav-item" data-role="customer">
                        <a href="#" onclick="loadPage('customer-inquiries.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/inquiries-icon.svg" class="sidebar-icon" alt="Inquiries Icon">
                            <span class="nav-text ms-3">My Inquiries</span>
                        </a>
                        </li>
                    <li class="nav-item" data-role="customer">
                        <a href="#" onclick="loadPage('customer-bookings.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/bookings-icon.svg" class="sidebar-icon" alt="Bookings Icon">
                            <span class="nav-text ms-3">My Bookings</span>
                        </a>
                    </li>
                    <li class="nav-item" data-role="customer">
                        <a href="#" onclick="loadPage('customer-inbox.html', this); return false;" class="nav-link d-flex align-items-center">
                             <img src="icons/inbox-icon.svg" class="sidebar-icon" alt="Inbox Icon">
                                <span class="nav-text ms-3">Inbox</span>
                    </a>
                </li>

                    <!-- Sales Staff menu: Catering Operations, followed by Inbox and Reports.
                         Page files go in html-content-navbar/ with these exact names. -->
                    <li class="nav-item nav-group" data-role="sales staff">
                        <button type="button" class="nav-link nav-group-toggle" title="Catering Operations"
                            aria-expanded="false" aria-controls="navGroupCatering">
                            <img src="icons/catering-operations-icon.svg" class="sidebar-icon" alt="Catering Operations Icon">
                            <span class="nav-text ms-3">Catering Operations</span>
                            <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
                        </button>
                        <div class="nav-submenu" id="navGroupCatering">
                            <ul class="nav-submenu-list">
                                <li class="nav-item" data-role="sales staff">
                                    <a href="#" onclick="loadPage('sales-available.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Available</span></a>
                                </li>
                                <li class="nav-item" data-role="sales staff">
                                    <a href="#" onclick="loadPage('sales-inquiries.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">My Inquiries</span></a>
                                </li>
                                <li class="nav-item" data-role="sales staff">
                                    <a href="#" onclick="loadPage('sales-bookings.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Bookings</span></a>
                                </li>
                                <li class="nav-item" data-role="sales staff">
                                    <a href="#" onclick="loadPage('admin-manager-sales-calendar.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Calendar</span></a>
                                </li>
                            </ul>
                        </div>
                    </li>
                    <!-- Admin + Manager menu: Customers, Catering Operations (dropdown), Inbox, then the shared Tickets / Reports,
                         then Menu Management. Page files go in html-content-navbar/ with these exact names. -->
                    <li class="nav-item" data-role="admin, manager">
                        <a href="#" onclick="loadPage('manager-admin-customers.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/contacts-icon.svg" class="sidebar-icon" alt="Customers Icon">
                            <span class="nav-text ms-3">Customers</span>
                        </a>
                    </li>
                    <li class="nav-item nav-group" data-role="admin, manager">
                        <button type="button" class="nav-link nav-group-toggle" title="Catering Operations"
                            aria-expanded="false" aria-controls="navGroupManagerCatering">
                            <img src="icons/catering-operations-icon.svg" class="sidebar-icon" alt="Catering Operations Icon">
                            <span class="nav-text ms-3">Catering Operations</span>
                            <i class="bi bi-chevron-down nav-chevron" aria-hidden="true"></i>
                        </button>
                        <div class="nav-submenu" id="navGroupManagerCatering">
                            <ul class="nav-submenu-list">
                                <li class="nav-item" data-role="admin, manager">
                                    <a href="#" onclick="loadPage('manager-admin-inquiries.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Inquiries</span></a>
                                </li>
                                <li class="nav-item" data-role="admin, manager">
                                    <a href="#" onclick="loadPage('manager-admin-bookings.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Bookings</span></a>
                                </li>
                                <li class="nav-item" data-role="admin, manager">
                                    <a href="#" onclick="loadPage('admin-manager-sales-calendar.html', this); return false;"
                                        class="nav-link nav-sublink"><span class="nav-sub-text">Calendar</span></a>
                                </li>
                            </ul>
                        </div>
                    </li>
                    <!-- Manager Inbox sits before Tickets; the Sales / CS Inbox sits after Tickets. -->
                    <li class="nav-item" data-role="admin, manager">
                        <a href="#" onclick="loadPage('inbox', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/inbox-icon.svg" class="sidebar-icon" alt="Inbox Icon">
                            <span class="nav-text ms-3">Inbox</span>
                        </a>
                    </li>

                    <li class="nav-item" data-role="admin, manager, customer service">
                        <a href="#" onclick="loadPage('manager-admin-ticket.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/tickets-icon.svg" class="sidebar-icon" alt="Tickets Icon">
                            <span class="nav-text ms-3">Tickets</span>
                        </a>
                    </li>
                    <!-- Staff Inbox: shared by Sales Staff and Customer Service, role-specific page file. -->
                    <li class="nav-item" data-role="sales staff, customer service">
                        <a href="#" onclick="loadPage('inbox', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/inbox-icon.svg" class="sidebar-icon" alt="Inbox Icon">
                            <span class="nav-text ms-3">Inbox</span>
                        </a>
                    </li>

                    <li class="nav-item" data-role="admin, manager, sales staff, customer service">
                        <a href="#" onclick="loadPage('reports', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/report-icon.svg" class="sidebar-icon" alt="Reports Icon">
                            <span class="nav-text ms-3">Reports</span>
                        </a>
                    </li>
                    <li class="nav-item" data-role="admin, manager">
                        <a href="#" onclick="loadPage('manager-admin-menu-management.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/menu-management-icon.svg" class="sidebar-icon" alt="Menu Management Icon">
                            <span class="nav-text ms-3">Menu Management</span>
                        </a>
                    </li>
                    <li class="nav-item" data-role="admin, manager">
                        <a href="#" onclick="loadPage('settings-pages.html', this); return false;"
                            class="nav-link d-flex align-items-center">
                            <img src="icons/settings-icon.svg" class="sidebar-icon" alt="Settings Icon">
                            <span class="nav-text ms-3">Settings</span>
                        </a>
                    </li>
                </ul>
            </nav>
        </aside>

        
        <div class="crm-main-content d-flex flex-column flex-grow-1">

            
            <header class="top-navbar d-flex align-items-center justify-content-end px-4">
                <div class="top-navbar-actions d-flex align-items-center gap-3 gap-md-4">

                    
                    <button type="button" class="theme-toggle-header border-0 bg-transparent p-0" id="themeToggle"
                        aria-label="Toggle theme">
                        <img src="icons/sun-icon.svg" class="sun-icon" alt="Sun Icon">
                        <img src="icons/moon-icon.svg" class="moon-icon" alt="Moon Icon">
                    </button>

                    
                    <button class="btn-icon position-relative border-0 bg-transparent p-0" id="notificationBell"
                        aria-label="Notifications">
                        <i class="bi bi-bell fs-5"></i>
                        <span class="notification-badge" id="notificationDot"></span>
                    </button>

                    
                    <div class="dropdown">
                        <button class="user-avatar-btn border-0 d-flex align-items-center justify-content-center p-0"
                            id="userMenuDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                            <?php
                            // Google-style avatar: first letter of the first name. A customer's photo is added by navbar.js.
                            $avatarName = trim((string) ($_SESSION["full_name"] ?? ""));
                            $avatarParts = preg_split("/\\s+/u", $avatarName, -1, PREG_SPLIT_NO_EMPTY) ?: [];
                            $avatarInitial = $avatarParts
                                ? mb_strtoupper(mb_substr($avatarParts[0], 0, 1, "UTF-8"), "UTF-8")
                                : "?";
                            ?>
                            <span class="user-avatar-initial" id="userAvatarInitial" aria-hidden="true"><?= htmlspecialchars($avatarInitial, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8") ?></span>
                        </button>
                        <div class="dropdown-menu user-profile-card dropdown-menu-end shadow border-0 p-0 overflow-hidden"
                            aria-labelledby="userMenuDropdown">
                            <div class="user-info-section p-3">
                                
                                <h6 class="user-name mb-1 fw-bold" id="dropdownUserName">
                                    <?= htmlspecialchars($_SESSION["full_name"], ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8") ?>
                                </h6>
                                
                                <span class="user-role small"
                                    id="dropdownUserRole"><?= htmlspecialchars($_SESSION["role_name"], ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8") ?></span>
                            </div>
                            <?php if (strcasecmp((string) ($_SESSION["role_name"] ?? ""), "Customer") === 0) : ?>
                            <a class="settings-action-btn" href="#" onclick="loadPage('customer-settings.html'); return false;">
                                <img src="icons/settings-icon.svg" class="settings-action-icon" alt="">
                                <span>Profile Settings</span>
                            </a>
                            <?php endif; ?>
                            <!-- Confirm logout before ending the session. -->
                            <a class="logout-action-btn d-flex align-items-center gap-3 text-decoration-none"
                                id="logoutBtn" href="#logoutConfirmationModal" data-bs-toggle="modal"
                                data-bs-target="#logoutConfirmationModal" role="button">
                                <img src="icons/leave-icon.svg" class="leave-icon" alt="Logout Icon">
                                <span class="logout-text fw-semibold">Logout</span>
                            </a>
                        </div>
                    </div>

                </div>
            </header>

            
            <main class="content-body p-3 p-md-4 flex-grow-1" id="mainContentArea">
                <!-- Page content is inserted here. -->
            </main>

        </div>

    </div>

    
   <div class="modal fade" id="logoutConfirmationModal" tabindex="-1" aria-labelledby="logoutConfirmationTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content custom-modal-card">
            <div class="modal-header border-0 pb-0">
                <h5 class="modal-title fw-bold" id="logoutConfirmationTitle">Confirm Logout</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-3 modal-delete-text">
                Are you sure you want to log out of your account?
            </div>
            <div class="modal-footer border-0 pt-0">
                <button type="button" class="btn modal-btn-cancel px-4" data-bs-dismiss="modal">Cancel</button>
                <a href="logout.php" id="logoutConfirmBtn" class="btn modal-btn-danger px-4">Log Out</a>
            </div>
        </div>
    </div>
</div>

    
    <script src="all-pages-js/bootstrap.bundle.min.js?v=5.3.3"></script>
    <!-- ExcelJS: needed by download-export.js for a real .xlsx file (without it "Export Excel" falls back to CSV). Load it BEFORE pages.js / download-export.js. -->
    <script src="all-pages-js/exceljs.min.js?v=4.4.0"></script>
    <script src="all-pages-js/loading.js"></script>
    <script src="all-pages-js/navbar.js?v=11"></script>
    <script src="all-pages-js/toast.js?v=2"></script>
    <script src="all-pages-js/pages.js?v=33"></script>
   <script src="all-pages-js/customer-pages.js?v=18"></script>
    <script src="all-pages-js/customer-settings.js?v=2"></script>
    <script src="all-pages-js/settings.js?v=6"></script>
    <script src="all-pages-js/legal-pages.js?v=4"></script>
    <script src="all-pages-js/notification.js"></script>
    <script src="all-pages-js/download-export.js?v=3"></script>
    <script src="all-pages-js/date-picker.js?v=1" defer></script>

    <!-- Handle sidebar collapse state. -->
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const burgerToggle = document.getElementById("burgerToggle");
            const crmSidebar = document.getElementById("crmSidebar");

            // Restore the saved sidebar state.
            const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
            if (isCollapsed && crmSidebar) {
                crmSidebar.classList.add("collapsed");
                document.documentElement.classList.add("sidebar-is-collapsed");
            }

            if (burgerToggle && crmSidebar) {
                burgerToggle.addEventListener("click", () => {
                    crmSidebar.classList.toggle("collapsed");
                    const currentlyCollapsed = crmSidebar.classList.contains("collapsed");
                    localStorage.setItem("sidebarCollapsed", currentlyCollapsed);

                    if (currentlyCollapsed) {
                        document.documentElement.classList.add("sidebar-is-collapsed");
                    } else {
                        document.documentElement.classList.remove("sidebar-is-collapsed");
                    }
                });
            }
        });
    </script>
</body>

</html>
