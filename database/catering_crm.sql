-- ESPINOSILLA'S KAINAN CATERING CRM - normalized application schema
-- MariaDB 10.11.19+, InnoDB, utf8mb4. Application database: catering_crm.
-- Includes normalized domain tables and compatibility structures required while
-- the PHP application is migrated away from its legacy table/column names.
CREATE DATABASE IF NOT EXISTS catering_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE catering_crm;
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE roles (
 role_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 role_name VARCHAR(50) NOT NULL UNIQUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
 user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 role_id INT UNSIGNED NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 username VARCHAR(50) NULL UNIQUE,
 email VARCHAR(255) NOT NULL UNIQUE,
 contact_number VARCHAR(30) NULL,
 phone VARCHAR(30) NULL,
 password_hash VARCHAR(255) NOT NULL,
 photo_path VARCHAR(255) NULL,
 account_status ENUM('Active','Inactive','Suspended') NOT NULL DEFAULT 'Active',
 email_verified_at DATETIME NULL,
 failed_login_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 locked_until DATETIME NULL,
 last_failed_login_at DATETIME NULL,
 last_login_at DATETIME NULL,
 password_changed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_users_failed_attempts CHECK (failed_login_attempts <= 3),
 UNIQUE KEY uq_users_phone (phone),
 INDEX idx_users_role_status (role_id, account_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_items (
 menu_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 item_name VARCHAR(150) NOT NULL,
 category VARCHAR(50) NOT NULL,
 base_price DECIMAL(12,2) NULL,
 display_price VARCHAR(80) NOT NULL DEFAULT '',
 serving_specs VARCHAR(255) NULL,
 photo_path VARCHAR(255) NULL,
 status ENUM('Active','Inactive','Archived') NOT NULL DEFAULT 'Active',
 created_by INT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 archived_at DATETIME NULL,
 CONSTRAINT fk_menu_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 CONSTRAINT chk_menu_base_price CHECK (base_price IS NULL OR base_price >= 0),
 INDEX idx_menu_category_status (category,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE menu_item_tiers (
 tier_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 menu_item_id INT UNSIGNED NOT NULL,
 tier_name VARCHAR(100) NOT NULL,
 price DECIMAL(12,2) NOT NULL,
 pax_description VARCHAR(150) NULL,
 sort_order INT UNSIGNED NOT NULL DEFAULT 0,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_tiers_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT uq_tier_name UNIQUE (menu_item_id,tier_name),
 CONSTRAINT uq_tier_menu_pair UNIQUE (tier_id,menu_item_id),
 CONSTRAINT chk_tier_price CHECK (price >= 0),
 INDEX idx_tiers_order (menu_item_id,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leads (
 lead_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inquiry_reference VARCHAR(40) NOT NULL UNIQUE,
 inquiry_ref VARCHAR(40) NULL UNIQUE,
 customer_id INT UNSIGNED NOT NULL,
 assigned_staff_id INT UNSIGNED NULL,
 event_name VARCHAR(160) NOT NULL,
 event_date DATE NOT NULL,
 event_time TIME NULL,
 event_location VARCHAR(255) NOT NULL,
 delivery_details JSON NULL,
 customer_name VARCHAR(160) NOT NULL DEFAULT '',
 customer_email VARCHAR(255) NOT NULL DEFAULT '',
 package VARCHAR(160) NOT NULL DEFAULT '',
 dishes TEXT NULL,
 menu_item_ids TEXT NULL,
 notes TEXT NULL,
 assigned_staff_name VARCHAR(120) NULL,
 claimed_at DATETIME NULL,
 arrangement ENUM('pickup','delivery','on_site_catering') NOT NULL,
 expected_guests INT UNSIGNED NULL,
 estimated_budget DECIMAL(12,2) NULL,
 special_requests TEXT NULL,
 stage VARCHAR(40) NOT NULL DEFAULT 'New Inquiry',
 decline_reason TEXT NULL,
 declined_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_leads_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_leads_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_leads_budget CHECK (estimated_budget IS NULL OR estimated_budget >= 0),
 INDEX idx_leads_customer_created (customer_id,created_at),
 INDEX idx_leads_staff_stage (assigned_staff_id,stage),
 INDEX idx_leads_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiry_items (
 inquiry_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lead_id INT UNSIGNED NOT NULL,
 menu_item_id INT UNSIGNED NOT NULL,
 tier_id INT UNSIGNED NULL,
 item_name_snapshot VARCHAR(150) NOT NULL,
 tier_name_snapshot VARCHAR(100) NULL,
 quantity INT UNSIGNED NOT NULL,
 estimated_unit_price DECIMAL(12,2) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_inquiry_items_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_inquiry_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_inquiry_items_tier FOREIGN KEY (tier_id,menu_item_id) REFERENCES menu_item_tiers(tier_id,menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_inquiry_qty CHECK (quantity > 0),
 CONSTRAINT chk_inquiry_price CHECK (estimated_unit_price >= 0),
 INDEX idx_inquiry_items_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inquiry_assignments (
 assignment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lead_id INT UNSIGNED NOT NULL,
 previous_staff_id INT UNSIGNED NULL,
 new_staff_id INT UNSIGNED NOT NULL,
 changed_by INT UNSIGNED NOT NULL,
 reason VARCHAR(150) NULL,
 reason_note TEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_assignment_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_assignment_previous FOREIGN KEY (previous_staff_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_assignment_new FOREIGN KEY (new_staff_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_assignment_actor FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_assignment_lead_date (lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- QUOTATIONS: response_status is only Accepted/Declined when customer responds.
-- Draft/sent/superseded are represented by timestamps and is_current, not extra customer statuses.
CREATE TABLE quotations (
 quotation_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lead_id INT UNSIGNED NOT NULL,
 inquiry_id INT UNSIGNED NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 status VARCHAR(20) NOT NULL DEFAULT 'Draft',
 items LONGTEXT NULL,
 discount DECIMAL(12,2) NOT NULL DEFAULT 0,
 extra_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
 total DECIMAL(12,2) NOT NULL DEFAULT 0,
 deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 notes TEXT NULL,
 prepared_by VARCHAR(120) NULL,
 prepared_by_id INT UNSIGNED NULL,
 prepared_at DATETIME NULL,
 sent_at DATETIME NULL,
 responded_at DATETIME NULL,
 created_by INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_quotations_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_quotations_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_quotations_lead (lead_id),
 INDEX idx_quotations_inquiry (inquiry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_versions (
 quotation_version_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 quotation_id INT UNSIGNED NOT NULL,
 version_number INT UNSIGNED NOT NULL,
 is_current BOOLEAN NOT NULL DEFAULT TRUE,
 response_status ENUM('Accepted','Declined') NULL,
 subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
 discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 additional_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
 total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 deposit_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
 deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 remaining_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
 valid_until DATE NULL,
 valid_until_time TIME NULL,
 terms_conditions TEXT NULL,
 revision_reason TEXT NULL,
 sent_at DATETIME NULL,
 responded_at DATETIME NULL,
 created_by INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT uq_quote_version UNIQUE (quotation_id,version_number),
 CONSTRAINT uq_quote_version_pair UNIQUE (quotation_version_id,quotation_id),
 CONSTRAINT fk_qv_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_qv_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_qv_version CHECK (version_number > 0),
 CONSTRAINT chk_qv_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND additional_charges >= 0 AND total_amount >= 0 AND deposit_rate BETWEEN 0 AND 100 AND deposit_amount >= 0 AND remaining_balance >= 0),
 INDEX idx_qv_current (quotation_id,is_current),
 INDEX idx_qv_response (quotation_id,response_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quotation_items (
 quotation_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 quotation_version_id INT UNSIGNED NOT NULL,
 menu_item_id INT UNSIGNED NULL,
 tier_id INT UNSIGNED NULL,
 item_name_snapshot VARCHAR(150) NOT NULL,
 serving_option_snapshot VARCHAR(100) NULL,
 quantity DECIMAL(12,3) UNSIGNED NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL,
 subtotal DECIMAL(12,2) NOT NULL,
 CONSTRAINT fk_qi_version FOREIGN KEY (quotation_version_id) REFERENCES quotation_versions(quotation_version_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_qi_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_qi_tier FOREIGN KEY (tier_id,menu_item_id) REFERENCES menu_item_tiers(tier_id,menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_qi_values CHECK (quantity > 0 AND unit_price >= 0 AND subtotal >= 0),
 INDEX idx_qi_version (quotation_version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
 booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_reference VARCHAR(40) NOT NULL UNIQUE,
 booking_ref VARCHAR(40) NULL UNIQUE,
 lead_id INT UNSIGNED NOT NULL UNIQUE,
 inquiry_id INT UNSIGNED NULL UNIQUE,
 quotation_version_id INT UNSIGNED NOT NULL,
 customer_id INT UNSIGNED NOT NULL,
 assigned_staff_id INT UNSIGNED NULL,
 event_name VARCHAR(160) NOT NULL,
 event_title VARCHAR(160) NOT NULL DEFAULT '',
 event_date DATE NOT NULL,
 event_time TIME NULL,
 event_address VARCHAR(255) NOT NULL,
 location VARCHAR(255) NOT NULL DEFAULT '',
 arrangement ENUM('pickup','delivery','on_site_catering') NOT NULL,
 expected_guests INT UNSIGNED NULL,
 booking_status ENUM('Confirmed','Completed','Cancelled') NOT NULL DEFAULT 'Confirmed',
 operational_status VARCHAR(40) NULL,
 quotation_total DECIMAL(12,2) NOT NULL,
 quotation_amount DECIMAL(12,2) NULL,
 deposit_amount DECIMAL(12,2) NULL,
 amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
 deposit_required DECIMAL(12,2) NOT NULL,
 remaining_balance DECIMAL(12,2) NOT NULL,
 payment_status VARCHAR(20) NOT NULL DEFAULT 'Unpaid',
 payment_method VARCHAR(40) NULL,
 payment_reference VARCHAR(60) NULL,
 paid_at DATETIME NULL,
 assigned_staff VARCHAR(120) NULL,
 fulfillment_status VARCHAR(30) NULL,
 fulfillment_updated_at DATETIME NULL,
 feedback_requested_at DATETIME NULL,
 balance_reminded_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_bookings_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bookings_qv FOREIGN KEY (quotation_version_id) REFERENCES quotation_versions(quotation_version_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bookings_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_booking_amounts CHECK (quotation_total >= 0 AND deposit_required >= 0 AND remaining_balance >= 0),
 INDEX idx_bookings_customer_date (customer_id,event_date),
 INDEX idx_bookings_staff_date (assigned_staff_id,event_date),
 INDEX idx_bookings_status_date (booking_status,event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_items (
 booking_item_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 menu_item_id INT UNSIGNED NULL,
 tier_id INT UNSIGNED NULL,
 item_name_snapshot VARCHAR(150) NOT NULL,
 serving_option_snapshot VARCHAR(100) NULL,
 quantity DECIMAL(12,3) UNSIGNED NOT NULL,
 unit_price DECIMAL(12,2) NOT NULL,
 subtotal DECIMAL(12,2) NOT NULL,
 CONSTRAINT fk_bi_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bi_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bi_tier FOREIGN KEY (tier_id,menu_item_id) REFERENCES menu_item_tiers(tier_id,menu_item_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_bi_values CHECK (quantity > 0 AND unit_price >= 0 AND subtotal >= 0),
 INDEX idx_bi_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_status_history (
 history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 status_type ENUM('booking','operational') NOT NULL,
 old_status VARCHAR(40) NULL,
 new_status VARCHAR(40) NOT NULL,
 changed_by INT UNSIGNED NULL,
 remarks TEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_bsh_user FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 INDEX idx_bsh_booking_date (booking_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PAYMENTS: unique (booking_id,payment_type) limits each booking to one DEPOSIT
-- and one BALANCE slot. The application transaction must create both slots.
-- Retry attempts and the chosen GCash/Maya method belong in gateway_transactions, not as extra payment rows.
CREATE TABLE payments (
 payment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 payment_reference VARCHAR(60) NOT NULL UNIQUE,
 payment_type ENUM('DEPOSIT','BALANCE') NOT NULL,
 amount DECIMAL(12,2) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'PHP',
 payment_status ENUM('PENDING','PAID','EXPIRED') NOT NULL DEFAULT 'PENDING',
 paid_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT uq_booking_payment_type UNIQUE (booking_id,payment_type),
 CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_payment_amount CHECK ((payment_type='DEPOSIT' AND amount > 0) OR (payment_type='BALANCE' AND amount >= 0)),
 INDEX idx_payments_booking_status (booking_id,payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gateway_transactions (
 transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 payment_id INT UNSIGNED NOT NULL,
 gateway_name VARCHAR(30) NOT NULL DEFAULT 'XENDIT',
 gateway_transaction_id VARCHAR(150) NULL,
 gateway_invoice_id VARCHAR(150) NULL,
 gateway_event_id VARCHAR(150) NULL,
 gateway_status VARCHAR(40) NOT NULL,
 payment_method ENUM('GCASH','MAYA') NOT NULL,
 request_reference VARCHAR(150) NULL,
 response_reference VARCHAR(150) NULL,
 amount DECIMAL(12,2) NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'PHP',
 initiated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_gt_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT uq_gt_gateway_tx UNIQUE (gateway_name,gateway_transaction_id),
 CONSTRAINT uq_gt_gateway_event UNIQUE (gateway_name,gateway_event_id),
 CONSTRAINT chk_gt_amount CHECK (amount > 0),
 INDEX idx_gt_payment_status (payment_id,gateway_status),
 INDEX idx_gt_invoice (gateway_invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- COMMUNICATION AND SUPPORT
CREATE TABLE conversations (
 conversation_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_id INT UNSIGNED NOT NULL,
 lead_id INT UNSIGNED NULL,
 booking_id INT UNSIGNED NULL,
 subject VARCHAR(150) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_conversations_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_conversations_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_conversations_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_conversation_context CHECK (NOT (lead_id IS NOT NULL AND booking_id IS NOT NULL)),
 INDEX idx_conversations_customer_updated (customer_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_participants (
 participant_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 conversation_id INT UNSIGNED NOT NULL,
 user_id INT UNSIGNED NOT NULL,
 joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_read_at DATETIME NULL,
 CONSTRAINT uq_conversation_participant UNIQUE (conversation_id,user_id),
 CONSTRAINT fk_cp_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_cp_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_cp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
 message_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 conversation_id INT UNSIGNED NOT NULL,
 sender_id INT UNSIGNED NOT NULL,
 message_body TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 edited_at DATETIME NULL,
 deleted_at DATETIME NULL,
 CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_messages_conversation_date (conversation_id,created_at),
 INDEX idx_messages_sender (sender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_tickets (
 ticket_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_id INT UNSIGNED NOT NULL,
 booking_id INT UNSIGNED NULL,
 lead_id INT UNSIGNED NULL,
 conversation_id INT UNSIGNED NULL,
 ticket_reference VARCHAR(50) NOT NULL UNIQUE,
 subject VARCHAR(150) NOT NULL,
 description TEXT NOT NULL,
 status ENUM('Open','In Progress','Resolved') NOT NULL DEFAULT 'Open',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 resolved_at DATETIME NULL,
 CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_tickets_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_tickets_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_tickets_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_tickets_customer_status (customer_id,status),
 INDEX idx_tickets_status_updated (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_attachments (
 attachment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT UNSIGNED NOT NULL,
 uploaded_by INT UNSIGNED NOT NULL,
 file_name VARCHAR(255) NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 file_path VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 file_size BIGINT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_ta_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_ta_user FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_ticket_file_size CHECK (file_size > 0 AND file_size <= 26214400),
 INDEX idx_ta_ticket (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ticket_status_history (
 history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT UNSIGNED NOT NULL,
 old_status VARCHAR(30) NULL,
 new_status ENUM('Open','In Progress','Resolved') NOT NULL,
 changed_by INT UNSIGNED NULL,
 remarks TEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_tsh_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_tsh_user FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 INDEX idx_tsh_ticket_date (ticket_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_logs (
 notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NULL,
 notification_type VARCHAR(50) NOT NULL,
 related_record_type VARCHAR(30) NULL,
 related_record_id BIGINT UNSIGNED NULL,
 channel ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
 recipient_email VARCHAR(255) NULL,
 recipient_name VARCHAR(150) NULL,
 sender_email VARCHAR(255) NULL,
 sender_identity VARCHAR(40) NULL,
 from_name VARCHAR(150) NULL,
 reply_to_email VARCHAR(255) NULL,
 email_subject VARCHAR(255) NULL,
 template_key VARCHAR(100) NULL,
 payload_encrypted MEDIUMTEXT NULL,
 dedupe_key VARCHAR(190) NULL,
 attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
 last_attempt_at DATETIME NULL,
 next_attempt_at DATETIME NULL,
 locked_until DATETIME NULL,
 delivery_status ENUM('PENDING','QUEUED','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
 error_details TEXT NULL,
 sent_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_notification_user_date (user_id,created_at),
 INDEX idx_notification_delivery (delivery_status,created_at),
 UNIQUE KEY uq_notification_dedupe (dedupe_key),
 INDEX idx_notification_email_queue (channel,delivery_status,next_attempt_at,locked_until,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CUSTOMER FEEDBACK
CREATE TABLE booking_feedback (
 feedback_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL UNIQUE,
 customer_id INT UNSIGNED NOT NULL,
 rating TINYINT UNSIGNED NOT NULL,
 comments VARCHAR(1000) NULL,
 images LONGTEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_feedback_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT fk_feedback_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
 INDEX idx_feedback_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE feedback_attachments (
 attachment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 feedback_id INT UNSIGNED NOT NULL,
 media_type ENUM('IMAGE','VIDEO') NOT NULL,
 file_path VARCHAR(255) NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 file_size BIGINT UNSIGNED NOT NULL,
 uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_fa_feedback FOREIGN KEY (feedback_id) REFERENCES booking_feedback(feedback_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT chk_feedback_file_size CHECK (
   (media_type='IMAGE' AND file_size > 0 AND file_size <= 26214400)
   OR (media_type='VIDEO' AND file_size > 0 AND file_size <= 104857600)
 ),
 INDEX idx_fa_feedback_type (feedback_id,media_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SECURITY AND AUDIT
CREATE TABLE audit_logs (
 audit_log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NULL,
 action VARCHAR(100) NOT NULL,
 module VARCHAR(50) NOT NULL,
 record_type VARCHAR(50) NULL,
 record_id BIGINT UNSIGNED NULL,
 old_values JSON NULL,
 new_values JSON NULL,
 ip_address VARCHAR(45) NULL,
 user_agent VARCHAR(500) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 INDEX idx_audit_user_date (user_id,created_at),
 INDEX idx_audit_module_date (module,created_at),
 INDEX idx_audit_record (record_type,record_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
 login_attempt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NULL,
 email_attempted VARCHAR(255) NOT NULL,
 ip_address VARCHAR(45) NULL,
 success BOOLEAN NOT NULL,
 attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 INDEX idx_login_email_time (email_attempted,attempted_at),
 INDEX idx_login_ip_time (ip_address,attempted_at),
 INDEX idx_login_user_time (user_id,attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_tokens (
 reset_token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 token_hash VARCHAR(255) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 used_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 INDEX idx_reset_user_expiry (user_id,expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE signup_email_otps (
 signup_otp_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 session_hash CHAR(64) NOT NULL,
 email VARCHAR(255) NOT NULL,
 otp_hash VARCHAR(255) NOT NULL,
 expires_at DATETIME NOT NULL,
 resend_available_at DATETIME NOT NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 send_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 verified_at DATETIME NULL,
 used_at DATETIME NULL,
 invalidated_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_signup_otp_session_created (session_hash, created_at),
 INDEX idx_signup_otp_email_created (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- APPLICATION COMPATIBILITY / FEATURE TABLES
-- These preserve behavior currently used by PHP while application queries are
-- migrated to the normalized entities above. They are provisioned here, not at
-- request time. Their data will be migrated into normalized tables in Stage 2.
CREATE TABLE inquiry_assignment_history (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 lead_id INT UNSIGNED NOT NULL,
 previous_staff_id INT UNSIGNED NULL,
 previous_staff_name VARCHAR(120) NULL,
 new_staff_id INT UNSIGNED NOT NULL,
 new_staff_name VARCHAR(120) NOT NULL,
 reason VARCHAR(120) NULL,
 reason_note TEXT NULL,
 changed_by_id INT UNSIGNED NULL,
 changed_by_name VARCHAR(120) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_iah_inquiry_date (lead_id,created_at),
 CONSTRAINT fk_iah_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE RESTRICT,
 CONSTRAINT fk_iah_previous FOREIGN KEY (previous_staff_id) REFERENCES users(user_id) ON DELETE SET NULL,
 CONSTRAINT fk_iah_new FOREIGN KEY (new_staff_id) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_iah_actor FOREIGN KEY (changed_by_id) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_requests (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 inquiry_id INT UNSIGNED NULL,
 customer_id INT UNSIGNED NULL,
 amount DECIMAL(12,2) NOT NULL,
 due_date DATE NULL,
 due_time TIME NULL,
 note VARCHAR(500) NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'Pending',
 requested_by VARCHAR(120) NULL,
 requested_by_id INT UNSIGNED NULL,
 requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 invoice_id VARCHAR(80) NULL UNIQUE,
 checkout_url TEXT NULL,
 invoice_created_at DATETIME NULL,
 invoice_expires_at DATETIME NULL,
 payment_id VARCHAR(80) NULL,
 method VARCHAR(40) NULL,
 paid_amount DECIMAL(12,2) NULL,
 paid_at DATETIME NULL,
 INDEX idx_pr_booking_status (booking_id,status),
 INDEX idx_pr_customer (customer_id),
 CONSTRAINT fk_pr_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT,
 CONSTRAINT fk_pr_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE SET NULL,
 CONSTRAINT fk_pr_requester FOREIGN KEY (requested_by_id) REFERENCES users(user_id) ON DELETE SET NULL,
 CONSTRAINT chk_pr_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE xendit_payments (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inquiry_id INT UNSIGNED NOT NULL,
 quotation_id INT UNSIGNED NOT NULL,
 customer_id INT UNSIGNED NULL,
 invoice_id VARCHAR(80) NULL UNIQUE,
 checkout_url TEXT NULL,
 amount DECIMAL(12,2) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'pending',
 payment_id VARCHAR(80) NULL UNIQUE,
 method VARCHAR(40) NULL,
 booking_id INT UNSIGNED NULL,
 invoice_expires_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 paid_at DATETIME NULL,
 INDEX idx_xen_inquiry (inquiry_id),
 INDEX idx_xen_booking (booking_id),
 CONSTRAINT fk_xen_lead FOREIGN KEY (inquiry_id) REFERENCES leads(lead_id) ON DELETE RESTRICT,
 CONSTRAINT fk_xen_quote FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE RESTRICT,
 CONSTRAINT fk_xen_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE SET NULL,
 CONSTRAINT fk_xen_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
 CONSTRAINT chk_xen_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_conversations (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_id INT UNSIGNED NOT NULL,
 title VARCHAR(160) NOT NULL,
 reference VARCHAR(60) NOT NULL DEFAULT '',
 status VARCHAR(30) NOT NULL DEFAULT 'Active',
 inquiry_id INT UNSIGNED NULL,
 booking_id INT UNSIGNED NULL,
 sales_read_at DATETIME NULL,
 customer_read_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_cib_inquiry (inquiry_id),
 INDEX idx_cib_customer_updated (customer_id,updated_at),
 CONSTRAINT fk_cib_conv_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_cib_conv_lead FOREIGN KEY (inquiry_id) REFERENCES leads(lead_id) ON DELETE RESTRICT,
 CONSTRAINT fk_cib_conv_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 conversation_id INT UNSIGNED NOT NULL,
 sender_type VARCHAR(20) NOT NULL,
 sender_name VARCHAR(120) NOT NULL DEFAULT '',
 sender_id INT UNSIGNED NULL,
 message TEXT NULL,
 attachments LONGTEXT NULL,
 quotation_id INT UNSIGNED NULL,
 payment_request_id INT UNSIGNED NULL,
 feedback_booking_id INT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_cib_msg_conversation (conversation_id,created_at),
 INDEX idx_cib_msg_quote (quotation_id),
 INDEX idx_cib_msg_payment (payment_request_id),
 CONSTRAINT fk_cib_msg_conv FOREIGN KEY (conversation_id) REFERENCES cib_conversations(id) ON DELETE RESTRICT,
 CONSTRAINT fk_cib_msg_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE SET NULL,
 CONSTRAINT fk_cib_msg_quote FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE SET NULL,
 CONSTRAINT fk_cib_msg_payment FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id) ON DELETE SET NULL,
 CONSTRAINT fk_cib_msg_feedback_booking FOREIGN KEY (feedback_booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_tickets (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_id INT UNSIGNED NOT NULL,
 ticket_number VARCHAR(50) NOT NULL DEFAULT '',
 subject VARCHAR(160) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'Open',
 priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
 customer_read_at DATETIME NULL,
 cs_read_at DATETIME NULL,
 manager_read_at DATETIME NULL,
 conversation_id INT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_cib_ticket_customer (customer_id,created_at),
 INDEX idx_cib_ticket_status (status,updated_at),
 CONSTRAINT fk_cib_ticket_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
 CONSTRAINT fk_cib_ticket_conv FOREIGN KEY (conversation_id) REFERENCES cib_conversations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_ticket_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT UNSIGNED NOT NULL,
 sender_type VARCHAR(20) NOT NULL,
 sender_name VARCHAR(120) NOT NULL DEFAULT '',
 sender_id INT UNSIGNED NULL,
 message TEXT NULL,
 attachments LONGTEXT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_cib_ticket_messages (ticket_id,id),
 INDEX idx_cib_ticket_sender (sender_id),
 CONSTRAINT fk_cib_ticket_msg_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE RESTRICT,
 CONSTRAINT fk_cib_tm_ticket FOREIGN KEY (ticket_id) REFERENCES cib_tickets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_ticket_activity (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT UNSIGNED NOT NULL,
 action VARCHAR(255) NOT NULL,
 performed_by VARCHAR(120) NOT NULL DEFAULT '',
 performed_by_role VARCHAR(60) NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_cib_ta_ticket (ticket_id,created_at),
 CONSTRAINT fk_cib_ta_ticket FOREIGN KEY (ticket_id) REFERENCES cib_tickets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cib_ticket_notes (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT UNSIGNED NOT NULL,
 note TEXT NOT NULL,
 created_by VARCHAR(120) NOT NULL DEFAULT '',
 created_by_role VARCHAR(60) NOT NULL DEFAULT '',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_cib_tn_ticket (ticket_id,created_at),
 CONSTRAINT fk_cib_tn_ticket FOREIGN KEY (ticket_id) REFERENCES cib_tickets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 type VARCHAR(20) NOT NULL DEFAULT 'ticket',
 title VARCHAR(120) NOT NULL,
 message VARCHAR(255) NOT NULL DEFAULT '',
 page VARCHAR(120) NOT NULL DEFAULT '',
 ref VARCHAR(60) NOT NULL DEFAULT '',
 is_read TINYINT(1) NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_notifications_user_read (user_id,is_read,created_at),
 CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE deadline_reminders (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 kind VARCHAR(30) NOT NULL,
 ref_id BIGINT UNSIGNED NOT NULL,
 stage VARCHAR(40) NOT NULL,
 sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_deadline_reminder (kind,ref_id,stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 token_hash VARCHAR(255) NOT NULL UNIQUE,
 expires_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_password_resets_user_expiry (user_id,expires_at),
 CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE legal_documents (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 doc_type VARCHAR(80) NOT NULL,
 version INT UNSIGNED NOT NULL,
 content LONGTEXT NOT NULL,
 change_note VARCHAR(500) NULL,
 effective_date DATE NULL,
 is_current TINYINT(1) NOT NULL DEFAULT 0,
 created_by INT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_legal_type_version (doc_type,version),
 INDEX idx_legal_current (doc_type,is_current),
 CONSTRAINT fk_legal_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE paymongo_payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NULL,
 inquiry_id INT UNSIGNED NULL,
 provider_reference VARCHAR(150) NULL,
 status VARCHAR(40) NOT NULL DEFAULT 'pending',
 amount DECIMAL(12,2) NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_paymongo_booking (booking_id),
 INDEX idx_paymongo_inquiry (inquiry_id),
 CONSTRAINT fk_paymongo_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
 CONSTRAINT fk_paymongo_lead FOREIGN KEY (inquiry_id) REFERENCES leads(lead_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed only the five approved roles. No Admin account is created here.
INSERT INTO roles (role_id,role_name) VALUES
(1,'Admin'),
(2,'Manager'),
(3,'Sales Staff'),
(4,'Customer Service Staff'),
(5,'Customer');

-- IMPORTANT APPLICATION-LEVEL RULES (cannot be fully enforced by simple FKs):
-- 1. Create exactly one DEPOSIT and one BALANCE payment row in the same
--    transaction that creates a booking. UNIQUE(booking_id,payment_type)
--    prevents duplicate slots but does not force both rows to exist.
-- 2. Only one successful gateway settlement may exist per payment slot.
--    Enforce this atomically when processing verified Xendit webhooks.
-- 3. Booking quotation_version_id must point to an Accepted version that
--    belongs to the same inquiry/lead and customer.
-- 4. Feedback customer_id must match the booking customer and booking must
--    be Completed. Enforce in the application transaction.
-- 5. Validate attachment count limits: 4 IMAGE and 2 VIDEO per feedback.
-- 6. Validate actual MIME/content, not just filename extension.
-- 7. Validate role eligibility and ownership in every PHP endpoint.
-- 8. Exactly one active Customer Service Staff account is a business rule
--    requiring a transactional application check or a dedicated guard.
-- 9. Quotation versions: maintain only one is_current=1 per quotation
--    transactionally; accepted versions must be immutable.
-- 10. Session timeout (30 min) and 3 failed attempts/15-min lockout are
--     enforced in PHP; SQL columns only persist the state.
