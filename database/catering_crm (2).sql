-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 20, 2026 at 11:41 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `catering_crm`
--

-- --------------------------------------------------------

--
-- Table structure for table `activities`
--

CREATE TABLE `activities` (
  `activity_id` int(11) NOT NULL,
  `activity_name` varchar(150) NOT NULL,
  `contact_id` int(11) NOT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `ticket_id` int(11) DEFAULT NULL,
  `activity_type` enum('Call','Email','Meeting','Other') NOT NULL,
  `due_date` date NOT NULL,
  `assigned_user_id` int(11) NOT NULL,
  `status` enum('Upcoming','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Upcoming',
  `notes` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `booking_id` int(11) NOT NULL,
  `booking_ref` varchar(30) DEFAULT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_name` varchar(160) DEFAULT '',
  `event_title` varchar(160) DEFAULT '',
  `event_date` date DEFAULT NULL,
  `event_time` varchar(20) DEFAULT NULL,
  `location` varchar(255) DEFAULT '',
  `arrangement` varchar(60) DEFAULT '',
  `package` varchar(160) DEFAULT '',
  `expected_guests` int(11) DEFAULT NULL,
  `quotation_amount` decimal(12,2) DEFAULT NULL,
  `amount_paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `remaining_balance` decimal(12,2) DEFAULT NULL,
  `payment_status` varchar(20) NOT NULL DEFAULT 'Unpaid',
  `payment_method` varchar(40) DEFAULT NULL,
  `payment_reference` varchar(60) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `assigned_staff_id` int(11) DEFAULT NULL,
  `assigned_staff` varchar(120) DEFAULT NULL,
  `booking_status` varchar(20) NOT NULL DEFAULT 'Confirmed',
  `created_at` datetime DEFAULT NULL,
  `deposit_amount` decimal(12,2) DEFAULT NULL,
  `feedback_requested_at` datetime DEFAULT NULL,
  `balance_reminded_at` datetime DEFAULT NULL,
  `fulfillment_status` varchar(30) DEFAULT NULL,
  `fulfillment_updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`booking_id`, `booking_ref`, `inquiry_id`, `customer_id`, `customer_name`, `event_title`, `event_date`, `event_time`, `location`, `arrangement`, `package`, `expected_guests`, `quotation_amount`, `amount_paid`, `remaining_balance`, `payment_status`, `payment_method`, `payment_reference`, `paid_at`, `assigned_staff_id`, `assigned_staff`, `booking_status`, `created_at`, `deposit_amount`, `feedback_requested_at`, `balance_reminded_at`, `fulfillment_status`, `fulfillment_updated_at`) VALUES
(1, 'BK-0001', 1, 3, 'jaycustomer', 'wedding', '2026-11-17', NULL, 'Parklane', 'Delivery', '', NULL, 4000.00, 800.00, 3200.00, 'Partially Paid', 'GCash', '2698455970', '2026-11-12 15:07:16', 2, 'jaystaff', 'Cancelled', '2026-11-12 15:07:16', 800.00, NULL, NULL, NULL, NULL),
(2, 'BK-0002', 4, 3, 'jaycustomer', 'Anniversary', '2026-11-16', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 2400.00, 480.00, 1920.00, 'Partially Paid', 'GCash', 'ewc_291b158a-dc32-4e23-9e89-8e31ba7ba074', '2026-11-13 01:31:59', 2, 'jaystaff', 'Completed', '2026-11-13 01:31:59', 480.00, '2026-11-17 19:45:00', '2026-11-20 01:20:56', NULL, NULL),
(3, 'BK-0003', 7, 9, 'jayhans', 'CELEBRATE', '2026-11-15', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 750.00, 750.00, 0.00, 'Paid', 'GCash', 'ewc_7ab3a77e-599c-4897-8c5c-051b7f2888e4', '2026-11-16 13:44:49', 2, 'jaystaff', 'Completed', '2026-11-13 02:44:40', 150.00, '2026-11-16 13:44:51', NULL, NULL, NULL),
(4, 'BK-0004', 8, 9, 'jayhans', 'trip', '2026-11-27', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 1200.00, 1200.00, 0.00, 'Paid', 'GCash', 'ewc_b70f63bd-4bde-41d6-a181-ad6f98ce7a5c', '2026-11-20 01:35:24', 2, 'jaystaff', 'Confirmed', '2026-11-13 03:21:41', 240.00, NULL, NULL, 'ready_pickup', '2026-11-20 01:37:35'),
(5, 'BK-0005', 9, 9, 'jayhans', 'rtewrt', '2026-11-18', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 4472.00, 4472.00, 0.00, 'Paid', 'GCash', 'ewc_04fae55a-faad-40d0-b97d-d10e417cc9cc', '2026-11-18 10:25:10', 2, 'jaystaff', 'Completed', '2026-11-13 03:26:39', 894.40, '2026-11-18 10:26:24', NULL, 'picked_up', '2026-11-18 10:26:17'),
(6, 'BK-0006', 10, 9, 'jayhans', 'BIRTDAY', '2026-11-17', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 5000.00, 1000.00, 4000.00, 'Partially Paid', 'GCash', 'ewc_4c6df667-5c10-4127-8440-957809f601c0', '2026-11-13 16:22:55', 2, 'jaystaff', 'Cancelled', '2026-11-13 16:22:55', 1000.00, NULL, NULL, NULL, NULL),
(7, 'BK-0007', 11, 9, 'jayhans', 'BWHGEU3TWQR', '2026-11-17', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 7800.00, 1560.00, 6240.00, 'Partially Paid', 'GCash', 'ewc_d67a2f0f-3479-4973-bd7c-b0dc73a47fd9', '2026-11-13 16:29:24', 2, 'jaystaff', 'Cancelled', '2026-11-13 16:29:24', 1560.00, NULL, NULL, NULL, NULL),
(8, 'BK-0008', 12, 9, 'jayhans', 'BIRTDAYYYY', '2026-11-16', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 2806.00, 561.20, 2244.80, 'Partially Paid', 'GCash', 'ewc_3c262f00-533f-4db8-999d-651e49cc6faf', '2026-11-13 16:39:31', 2, 'jaystaff', 'Completed', '2026-11-13 16:39:31', 561.20, NULL, '2026-11-20 01:20:56', NULL, NULL),
(9, 'BK-0009', 13, 9, 'jayhans', 'debuuuuu', '2026-11-17', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 2000.00, 400.00, 1600.00, 'Partially Paid', 'Maya', 'ewc_fe0aea1e-f456-43b8-9462-77c99d8b2ddf', '2026-11-13 16:44:31', 2, 'jaystaff', 'Cancelled', '2026-11-13 16:44:31', 400.00, NULL, NULL, NULL, NULL),
(10, 'BK-0010', 14, 9, 'jayhans', 'testing', '2026-11-27', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 5000.00, 1000.00, 4000.00, 'Partially Paid', 'GCash', 'ewc_3555d3a7-90e8-41b9-a12e-9b2b492c224c', '2026-11-13 16:55:25', 2, 'jaystaff', 'Confirmed', '2026-11-13 16:55:25', 1000.00, NULL, NULL, NULL, NULL),
(11, 'BK-0011', 15, 9, 'jayhans', 'tesing3', '2026-11-18', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 3029.00, 3029.00, 0.00, 'Paid', 'GCash', 'ewc_549bcbd7-ed92-4275-ba7f-a49bc9bb0993', '2026-11-18 10:38:08', 2, 'jaystaff', 'Completed', '2026-11-13 16:59:53', 605.80, '2026-11-19 00:12:20', NULL, NULL, NULL),
(12, 'BK-0012', 16, 9, 'jayhans', 'test4', '2026-11-22', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 2800.00, 560.00, 2240.00, 'Partially Paid', 'Maya', 'ewc_9c478dc7-a853-48c7-a52a-bdca5c4e9f44', '2026-11-13 17:10:23', 2, 'jaystaff', 'Confirmed', '2026-11-13 17:10:23', 560.00, NULL, NULL, NULL, NULL),
(13, 'BK-0013', 18, 10, 'jaytest', 'testjay', '2026-11-16', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 3900.00, 780.00, 3120.00, 'Partially Paid', 'GCash', 'ewc_dfcc5daf-04ef-40d7-8044-fe5cb0a77ca9', '2026-11-13 17:39:14', 2, 'jaystaff', 'Completed', '2026-11-13 17:39:14', 780.00, '2026-11-17 19:45:00', '2026-11-20 01:20:56', NULL, NULL),
(14, 'BK-0014', 19, 3, 'jaycustomer', 'testtt8', '2026-11-15', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 6900.00, 1380.00, 5520.00, 'Partially Paid', 'GCash', 'ewc_0f8907ef-fae4-4cfb-877d-e4fc67765f1d', '2026-11-13 21:53:53', 2, 'jaystaff', 'Completed', '2026-11-13 21:53:53', 1380.00, '2026-11-17 19:45:00', '2026-11-19 00:12:20', NULL, NULL),
(15, 'BK-0015', 3, 3, 'jaycustomer', 'BIRTDAY', '2026-11-16', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 2676.00, 535.20, 2140.80, 'Partially Paid', 'GCash', 'ewc_a89a7c20-8e61-4098-92a7-7e6a63db387e', '2026-11-13 22:11:22', 2, 'jaystaff', 'Completed', '2026-11-13 22:11:22', 535.20, '2026-11-17 19:45:00', '2026-11-20 01:20:56', NULL, NULL),
(16, 'BK-0016', 21, 9, 'jayhans', 'anniv22', '2026-11-15', NULL, 'parklane', 'Buffet with setup', '', 30, 900.00, 900.00, 0.00, 'Paid', 'Maya', 'ewc_4781ab16-dce9-471b-add5-f52118bac873', '2026-11-14 21:11:45', 2, 'jaystaff', 'Completed', '2026-11-13 23:12:23', 180.00, NULL, NULL, NULL, NULL),
(17, 'BK-0017', 22, 9, 'jayhans', 'BIRTDAY CELEBRATION', '2026-11-25', NULL, 'PARKLANE GENERAL TRIAS CAVITE', 'Buffet with setup', '', NULL, 4600.00, 4600.00, 0.00, 'Paid', 'GCash', 'ewc_c2cdfe6c-70d6-4858-9496-5d31c67d161c', '2026-11-14 20:23:56', 2, 'jaystaff', 'Confirmed', '2026-11-13 23:59:19', 920.00, NULL, NULL, NULL, NULL),
(18, 'BK-0018', 24, 3, 'jaycustomer', 'NIEL BIRTDAY', '2026-11-16', NULL, 'parkalane', 'Delivery', '', NULL, 3950.00, 3950.00, 0.00, 'Paid', 'GCash', 'ewc_d2bc64a5-a9f0-489b-921e-afcb41462559', '2026-11-14 20:05:16', 2, 'jaystaff', 'Completed', '2026-11-14 16:58:59', 790.00, '2026-11-17 00:13:19', NULL, NULL, NULL),
(19, 'BK-0019', 23, 9, 'jayhans', 'WEDDING ANNIV', '2026-11-16', NULL, 'TAGAYTAY CITY', 'Buffet with setup', 'PANCIT MALABON', NULL, 4300.00, 4300.00, 0.00, 'Paid', 'GCash', 'ewc_71cd8ee5-234d-43b8-a7e0-88c3f7d86dfa', '2026-11-14 21:03:01', 2, 'jaystaff', 'Completed', '2026-11-14 21:02:20', 860.00, '2026-11-17 00:13:19', NULL, NULL, NULL),
(20, 'BK-0020', 26, 9, 'jayhans', 'shane bday', '2026-11-26', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 3800.00, 760.00, 3040.00, 'Partially Paid', 'GCash', 'ewc_7253e6ba-d290-4b39-81cf-da39e3e4e1d3', '2026-11-15 11:14:12', 2, 'jaystaff', 'Confirmed', '2026-11-15 11:14:12', 760.00, NULL, NULL, NULL, NULL),
(21, 'BK-0021', 29, 9, 'jayhans', 'gab birthday', '2026-11-17', NULL, 'PARKLANE, PH.8 BLK.10 LOT.6', 'Buffet with setup', 'BIHON GUISADO - MEDIUM (₱2,800.00)', NULL, 4300.00, 4300.00, 0.00, 'Paid', 'GCash', 'ewc_3575f027-fca5-4d2d-be8b-ecda65a010dc', '2026-11-16 13:45:18', 2, 'jaystaff', 'Completed', '2026-11-15 23:14:11', 860.00, '2026-11-18 10:24:08', NULL, NULL, NULL),
(22, 'BK-0022', 30, 9, 'jayhans', 'NIEL WEDDING', '2026-11-20', NULL, 'GENTRI', 'Buffet with setup', 'BIHON GUISADO - MEDIUM (₱2,800.00)', NULL, 4300.00, 4300.00, 0.00, 'Paid', 'Maya', 'ewc_3bc3e3cd-49ca-4c87-9de5-92ccf42f27d8', '2026-11-16 00:08:17', 2, 'jaystaff', 'Confirmed', '2026-11-16 00:05:52', 860.00, NULL, NULL, NULL, NULL),
(23, 'BK-0023', 33, 9, 'jayhans', 'TEST5', '2026-11-18', NULL, 'Customer pickup', 'Customer Pickup', 'PANCIT MALABON, BIHON GUISADO - LARGE (₱3,000.00)', NULL, 5800.00, 1160.00, 4640.00, 'Partially Paid', 'GCash', 'ewc_6d569419-2baf-4fd8-a1c5-6069d8c2a345', '2026-11-16 14:15:00', 2, 'jaystaff', 'Cancelled', '2026-11-16 14:15:00', 1160.00, NULL, NULL, NULL, NULL),
(24, 'BK-0024', 35, 9, 'jayhans', 'whayne debu', '2026-11-20', NULL, 'BACOOR CAVITE', 'Delivery', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 3750.00, 3750.00, 0.00, 'Paid', 'GCash', 'ewc_b95baeca-f0e0-4ae2-85ac-e817dce2fafb', '2026-11-17 16:45:01', 2, 'jaystaff', 'Completed', '2026-11-17 16:43:10', 750.00, '2026-11-20 01:33:33', NULL, 'delivered', '2026-11-20 01:33:17'),
(25, 'BK-0025', 37, 9, 'jayhans', 'SYSTEM TEST', '2026-11-23', NULL, 'Customer pickup', 'Customer Pickup', '', NULL, 3500.00, 700.00, 2800.00, 'Partially Paid', 'GCash', 'ewc_b38756de-e2eb-4433-9278-548cfbc4b1f3', '2026-11-17 20:49:39', 2, 'jaystaff', 'Cancelled', '2026-11-15 21:07:44', 700.00, NULL, NULL, NULL, NULL),
(26, 'BK-0026', 38, 9, 'jayhans', 'test99', '2026-11-21', NULL, 'Customer pickup', 'Customer Pickup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 3000.00, 3000.00, 0.00, 'Paid', 'GCash', 'ewc_41ada8f8-af2a-45f1-870b-318c52c231fc', '2026-11-17 22:29:51', 2, 'jaystaff', 'Confirmed', '2026-11-17 22:27:28', 600.00, NULL, NULL, NULL, NULL),
(27, 'BK-0027', 39, 9, 'jayhans', 'SYSTEM TESTING JAY', '2026-11-22', '09:00:00', 'Customer pickup', 'Customer Pickup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 3000.00, 600.00, 2400.00, 'Partially Paid', 'Maya', 'ewc_43f9ee0d-ea86-4e0f-8391-15a98ad7e8e5', '2026-11-18 13:26:04', 2, 'jaystaff', 'Confirmed', '2026-11-18 13:26:04', 600.00, NULL, NULL, NULL, NULL),
(28, 'BK-0028', 40, 9, 'jayhans', 'SYSTEM TEST V2', '2026-11-23', '10:15:00', 'NEW YORK BLK20, BROOKE STREET', 'Buffet with setup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 4800.00, 4800.00, 0.00, 'Paid', 'GCash', 'ewc_a7dd9124-a4d3-493c-b5ae-91c287eb8450', '2026-11-18 13:35:53', 2, 'jaystaff', 'Confirmed', '2026-11-18 13:34:19', 960.00, NULL, NULL, NULL, NULL),
(29, 'BK-0029', 41, 9, 'jayhans', 'INBOX TESTING', '2026-11-21', '09:45:00', 'ewtfwetewr', 'Delivery', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 3450.00, 690.00, 2760.00, 'Partially Paid', 'GCash', 'ewc_cadc35bf-deb3-4c4a-85aa-6efc5aad5344', '2026-11-18 14:00:12', 2, 'jaystaff', 'Cancelled', '2026-11-18 14:00:12', 690.00, NULL, NULL, NULL, NULL),
(30, 'BK-0030', 46, 9, 'jayhans', 'testtttf', '2026-11-21', '18:00:00', 'Customer pickup', 'Customer Pickup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 3000.00, 3000.00, 0.00, 'Paid', 'GCash', 'ewc_9b5a8a9b-ce75-4df5-bce1-6378f61edf59', '2026-11-18 23:44:59', 2, 'jaystaff', 'Confirmed', '2026-11-18 20:24:35', 600.00, NULL, NULL, 'ready_pickup', '2026-11-18 23:47:49'),
(31, 'BK-0031', 47, 9, 'jayhans', 'thsssssssssss', '2026-11-21', '17:00:00', 'Customer pickup', 'Customer Pickup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 6500.00, 6500.00, 0.00, 'Paid', 'GCash', 'ewc_9f132d2c-e9b0-4055-b019-4b6d895549d4', '2026-11-18 20:57:05', 2, 'jaystaff', 'Confirmed', '2026-11-18 20:45:49', 1300.00, NULL, NULL, 'preparing', '2026-11-19 21:42:44'),
(32, 'BK-0032', 50, 9, 'jayhans', 'NIEL WEDDING ANNIVERSARY', '2026-11-22', '18:15:00', 'IMUS CAVITE', 'Buffet with setup', 'BIHON GUISADO - LARGE (₱3,000.00)', NULL, 5000.00, 5000.00, 0.00, 'Paid', 'GCash', 'ewc_5f60a809-e97d-46ec-b2c7-38a0bba03c82', '2026-11-18 23:40:43', 2, 'jaystaff', 'Confirmed', '2026-11-18 23:37:46', 1000.00, NULL, NULL, 'setting_up', '2026-11-18 23:41:36'),
(33, 'BK-0033', 56, 9, 'jayhans', 'yoooooooot', '2026-11-22', '10:30:00', 'ytooooooooo', 'Buffet with setup', 'BIHON GUISADO - LARGE (₱3,000.00) x2', NULL, 7500.00, 7500.00, 0.00, 'Paid', 'GCash', 'ewc_081d7e44-31fa-43e5-9d95-eb0a4e12b75f', '2026-11-19 13:18:34', 2, 'jaystaff', 'Confirmed', '2026-11-19 12:56:30', 1500.00, NULL, NULL, 'setting_up', '2026-11-19 13:19:49'),
(34, 'BK-0034', 62, 9, 'jayhans', 'FINAL TESTING SYSTEM', '2026-11-23', '10:00:00', 'PH.8 BLK.10 LOT6, PARKLANE COUNTRY HOMES, GENERAL TRIAS CAVITE', 'Buffet with setup', 'BIHON GUISADO - LARGE (₱3,000.00) x3', NULL, 11000.00, 2200.00, 8800.00, 'Partially Paid', 'GCash', 'ewc_698da63a-c9aa-49d0-b56d-0cb84d8a5891', '2026-11-19 21:49:36', 2, 'jaystaff', 'Cancelled', '2026-11-19 21:49:36', 2200.00, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `booking_feedback`
--

CREATE TABLE `booking_feedback` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `rating` tinyint(4) NOT NULL DEFAULT 0,
  `comments` text DEFAULT NULL,
  `images` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `booking_feedback`
--

INSERT INTO `booking_feedback` (`id`, `booking_id`, `customer_id`, `rating`, `comments`, `images`, `created_at`) VALUES
(1, 16, 9, 4, 'THE FOOD IS SO GOOD', '[{\"name\":\"Pancit Canton Bihon Guisado.jpg\",\"url\":\"uploads\\/feedback\\/1ad50f1cd61d5b5f.jpg\",\"size\":156905,\"mime_type\":\"image\\/jpeg\"}]', '2026-11-16 12:56:59'),
(2, 8, 9, 5, 'THE FOOD IS SO GOOD', '[{\"name\":\"Pancit Canton Bihon Guisado.jpg\",\"url\":\"uploads\\/feedback\\/4d8629c424b4cfb4.jpg\",\"size\":156905,\"mime_type\":\"image\\/jpeg\"}]', '2026-11-16 12:58:27'),
(3, 3, 9, 4, 'THE SERVICE IS SO GREATT', '[{\"name\":\"906011568_1005115801979818_6704056493042618777_n.jpg\",\"url\":\"uploads\\/feedback\\/52ca5eb1739b2639.jpg\",\"size\":125949,\"mime_type\":\"image\\/jpeg\"}]', '2026-11-16 13:54:45'),
(8, 19, 9, 5, 'the service is excellent', '[{\"name\":\"WIN_20260905_15_09_04_Pro.jpg\",\"url\":\"uploads\\/feedback\\/c17373dace79ce1d.jpg\",\"size\":275618,\"mime_type\":\"image\\/jpeg\"}]', '2026-11-17 16:46:52'),
(9, 24, 9, 1, 'the service is to slow', '[{\"name\":\"Minimalist Cream Cabinet Facade.png\",\"url\":\"uploads\\/feedback\\/0a40e5adb21819a2.png\",\"size\":1399322,\"mime_type\":\"image\\/png\"}]', '2026-11-20 01:38:52');

-- --------------------------------------------------------

--
-- Table structure for table `cib_attachment_reviews`
--

CREATE TABLE `cib_attachment_reviews` (
  `id` int(11) NOT NULL,
  `message_id` int(11) NOT NULL,
  `attachment_index` int(11) NOT NULL DEFAULT 0,
  `conversation_id` int(11) NOT NULL,
  `file_url` varchar(255) NOT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `kind` varchar(12) NOT NULL DEFAULT 'photo',
  `amount` decimal(12,2) DEFAULT NULL,
  `method` varchar(40) DEFAULT NULL,
  `reference` varchar(60) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `booking_id` int(11) DEFAULT NULL,
  `reviewed_by` varchar(120) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `detector_version` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cib_attachment_reviews`
--

INSERT INTO `cib_attachment_reviews` (`id`, `message_id`, `attachment_index`, `conversation_id`, `file_url`, `file_name`, `kind`, `amount`, `method`, `reference`, `status`, `booking_id`, `reviewed_by`, `reviewed_at`, `created_at`, `detector_version`) VALUES
(1, 3, 0, 1, 'uploads/inbox/c6819098919deca1.jpg', '63e7cb0c-ab6e-453a-839f-f65512de7c95.jpg', 'receipt', 800.00, 'GCash', '2698455970', 'confirmed', 1, 'jaystaff', '2026-11-12 15:07:16', '2026-11-12 15:04:46', 2),
(2, 5, 0, 1, 'uploads/inbox/943a65e66f14e52f.jpg', '141917b9-a26a-4714-98ec-540e67d30be2.jpg', 'photo', NULL, NULL, NULL, 'pending', NULL, NULL, NULL, '2026-11-12 15:16:04', 2),
(3, 6, 0, 1, 'uploads/inbox/454deb51044ec3ba.jpg', 'c2fea6a4-5c59-4725-be48-6f0f6ed9c90f.jpg', 'receipt', 46000.00, NULL, NULL, 'pending', NULL, 'jaystaff', '2026-11-12 15:17:30', '2026-11-12 15:16:46', 2),
(4, 13, 0, 3, 'uploads/inbox/6985581da81a6a39.jpg', 'a9f5be6d-e7ac-4185-898a-56a1e7cc8361.jpg', 'receipt', 11.00, 'GCash', '2045956321910OCT10', 'pending', NULL, NULL, NULL, '2026-11-13 00:59:07', 2);

-- --------------------------------------------------------

--
-- Table structure for table `cib_conversations`
--

CREATE TABLE `cib_conversations` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `title` varchar(160) NOT NULL,
  `reference` varchar(60) DEFAULT '',
  `status` varchar(30) NOT NULL DEFAULT 'Active',
  `inquiry_id` int(11) DEFAULT NULL,
  `sales_read_at` datetime DEFAULT NULL,
  `customer_read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cib_conversations`
--

INSERT INTO `cib_conversations` (`id`, `customer_id`, `title`, `reference`, `status`, `inquiry_id`, `sales_read_at`, `customer_read_at`, `created_at`, `updated_at`) VALUES
(1, 3, 'wedding (INQ-0001)', 'INQ-0001', 'Active', 1, '2026-11-17 21:07:52', '2026-11-13 21:40:59', '2026-11-12 15:00:08', '2026-11-17 21:07:52'),
(2, 3, 'DEBU (INQ-0002)', 'INQ-0002', 'Active', 2, '2026-11-17 21:07:52', '2026-11-13 21:40:59', '2026-11-13 00:14:41', '2026-11-17 21:07:52'),
(3, 3, 'BIRTDAY (INQ-0003)', 'INQ-0003', 'Active', 3, '2026-11-17 20:06:32', '2026-11-14 20:16:37', '2026-11-13 00:26:25', '2026-11-17 19:45:00'),
(4, 3, 'Anniversary (INQ-0004)', 'INQ-0004', 'Active', 4, '2026-11-17 19:51:02', '2026-11-13 21:40:58', '2026-11-13 01:13:09', '2026-11-17 19:45:00'),
(5, 3, 'birtday father (INQ-0005)', 'INQ-0005', 'Active', 5, '2026-11-17 21:07:52', '2026-11-13 21:40:58', '2026-11-13 01:34:22', '2026-11-17 21:07:52'),
(6, 9, 'CELEBRATE (INQ-0007)', 'INQ-0007', 'Active', 7, '2026-11-16 13:44:51', '2026-11-16 14:06:49', '2026-11-13 02:39:49', '2026-11-16 13:44:51'),
(7, 9, 'trip (INQ-0008)', 'INQ-0008', 'Active', 8, '2026-11-20 01:37:35', '2026-11-20 01:48:56', '2026-11-13 03:21:05', '2026-11-20 01:37:35'),
(8, 3, 'ahqsh1w (INQ-0006)', 'INQ-0006', 'Active', 6, '2026-11-17 21:07:52', '2026-11-13 22:28:12', '2026-11-13 03:24:28', '2026-11-17 21:07:52'),
(9, 9, 'rtewrt (INQ-0009)', 'INQ-0009', 'Active', 9, '2026-11-18 12:31:51', '2026-11-18 13:36:37', '2026-11-13 03:26:04', '2026-11-18 10:26:24'),
(10, 9, 'BIRTDAY (INQ-0010)', 'INQ-0010', 'Active', 10, '2026-11-17 21:07:52', '2026-11-13 22:29:10', '2026-11-13 16:21:56', '2026-11-17 21:07:52'),
(11, 9, 'BWHGEU3TWQR (INQ-0011)', 'INQ-0011', 'Active', 11, '2026-11-17 21:07:52', '2026-11-13 16:29:41', '2026-11-13 16:28:44', '2026-11-17 21:07:52'),
(12, 9, 'BIRTDAYYYY (INQ-0012)', 'INQ-0012', 'Active', 12, '2026-11-14 00:00:16', '2026-11-13 23:36:15', '2026-11-13 16:38:40', '2026-11-13 16:39:31'),
(13, 9, 'debuuuuu (INQ-0013)', 'INQ-0013', 'Active', 13, '2026-11-17 21:07:52', NULL, '2026-11-13 16:43:37', '2026-11-17 21:07:52'),
(14, 9, 'testing (INQ-0014)', 'INQ-0014', 'Active', 14, '2026-11-17 21:07:52', '2026-11-18 20:58:00', '2026-11-13 16:49:30', '2026-11-17 21:07:52'),
(15, 9, 'tesing3 (INQ-0015)', 'INQ-0015', 'Active', 15, '2026-11-19 00:12:20', '2026-11-19 20:44:23', '2026-11-13 16:59:12', '2026-11-19 00:12:20'),
(16, 9, 'test4 (INQ-0016)', 'INQ-0016', 'Active', 16, '2026-11-17 21:07:52', '2026-11-13 22:34:08', '2026-11-13 17:09:41', '2026-11-17 21:07:52'),
(17, 10, 'testjay (INQ-0018)', 'INQ-0018', 'Active', 18, '2026-11-17 19:51:01', '2026-11-13 17:39:21', '2026-11-13 17:38:33', '2026-11-17 19:45:00'),
(18, 3, 'testtt8 (INQ-0019)', 'INQ-0019', 'Active', 19, '2026-11-17 19:51:00', '2026-11-13 22:10:30', '2026-11-13 21:41:39', '2026-11-17 19:45:00'),
(19, 9, 'test7 (INQ-0017)', 'INQ-0017', 'Active', 17, '2026-11-14 00:05:16', '2026-11-13 22:37:58', '2026-11-13 22:28:54', '2026-11-14 00:01:03'),
(20, 9, 'testtt990', 'INQ-0020', 'Active', 20, '2026-11-14 00:05:19', NULL, '2026-11-13 22:53:38', '2026-11-13 22:53:38'),
(21, 9, 'anniv22', 'INQ-0021', 'Active', 21, '2026-11-15 10:41:31', '2026-11-15 00:47:45', '2026-11-13 23:11:07', '2026-11-14 21:11:45'),
(22, 9, 'BIRTDAY CELEBRATION', 'INQ-0022', 'Active', 22, '2026-11-14 20:55:32', '2026-11-14 21:01:16', '2026-11-13 23:53:49', '2026-11-14 20:23:56'),
(23, 9, 'WEDDING ANNIV', 'INQ-0023', 'Active', 23, '2026-11-17 00:13:19', '2026-11-17 16:46:02', '2026-11-14 08:17:11', '2026-11-17 00:13:19'),
(24, 3, 'NIEL BIRTDAY', 'INQ-0024', 'Active', 24, '2026-11-17 00:13:19', '2026-11-14 20:12:46', '2026-11-14 16:46:57', '2026-11-17 00:13:19'),
(25, 9, 'PALABOK', '', 'Support', NULL, NULL, '2026-11-15 00:01:59', '2026-11-15 00:01:59', '2026-11-15 00:01:59'),
(26, 9, 'SERVICE', '', 'Support', NULL, NULL, '2026-11-15 00:12:03', '2026-11-15 00:12:03', '2026-11-15 00:12:03'),
(27, 9, 'TEST', '', 'Support', NULL, NULL, NULL, '2026-11-15 00:14:58', '2026-11-15 00:14:58'),
(28, 9, 'NIEL DEBU', 'INQ-0025', 'Active', 25, '2026-11-17 21:07:52', '2026-11-18 20:57:57', '2026-11-15 10:34:09', '2026-11-17 21:07:52'),
(29, 9, 'shane bday', 'INQ-0026', 'Active', 26, '2026-11-18 12:41:49', '2026-11-18 13:51:13', '2026-11-15 11:11:04', '2026-11-18 12:31:07'),
(30, 9, 'FOOD', '', 'Support', NULL, NULL, NULL, '2026-11-15 11:21:59', '2026-11-15 11:21:59'),
(31, 9, 'test34', 'INQ-0027', 'Active', 27, NULL, '2026-11-15 15:37:10', '2026-11-15 11:26:44', '2026-11-15 11:26:44'),
(32, 9, 'xample', 'INQ-0028', 'Active', 28, '2026-11-18 13:53:53', '2026-11-18 13:54:35', '2026-11-15 15:37:26', '2026-11-18 13:53:53'),
(33, 9, 'gab birthday', 'INQ-0029', 'Active', 29, '2026-11-18 23:01:49', '2026-11-18 12:32:36', '2026-11-15 23:12:34', '2026-11-18 10:24:08'),
(34, 9, 'NIEL WEDDING', 'INQ-0030', 'Active', 30, '2026-11-16 00:12:10', '2026-11-16 00:55:59', '2026-11-16 00:02:33', '2026-11-16 00:09:18'),
(35, 9, 'FOOD', '', 'Support', NULL, NULL, NULL, '2026-11-16 00:31:04', '2026-11-16 00:31:04'),
(36, 9, 'try', 'INQ-0031', 'Active', 31, NULL, '2026-11-16 11:21:55', '2026-11-16 01:17:57', '2026-11-16 01:17:57'),
(37, 9, 'Menu or package concern', '', 'Support', NULL, NULL, NULL, '2026-11-16 12:06:00', '2026-11-16 12:06:00'),
(38, 9, 'TEST5', 'INQ-0033', 'Active', 33, '2026-11-17 21:38:18', '2026-11-17 21:32:49', '2026-11-16 14:13:52', '2026-11-17 21:38:18'),
(39, 9, 'test67', 'INQ-0032', 'Active', 32, '2026-11-17 21:38:18', '2026-11-17 21:32:47', '2026-11-16 22:00:15', '2026-11-17 21:38:18'),
(40, 3, 'test3', 'INQ-0034', 'Active', 34, '2026-11-17 19:51:03', NULL, '2026-11-17 14:58:00', '2026-11-17 14:58:00'),
(41, 9, 'whayne debu', 'INQ-0035', 'Active', 35, '2026-11-20 01:33:33', '2026-11-20 01:38:17', '2026-11-17 16:40:37', '2026-11-20 01:33:33'),
(42, 9, 'TESTING45', 'INQ-0036', 'Active', 36, '2026-11-17 21:38:18', '2026-11-17 21:49:41', '2026-11-17 20:08:41', '2026-11-17 21:38:18'),
(43, 9, 'SYSTEM TEST', 'INQ-0037', 'Active', 37, '2026-11-17 21:38:18', '2026-11-17 22:28:42', '2026-11-17 20:36:51', '2026-11-17 21:38:18'),
(44, 9, 'test99', 'INQ-0038', 'Active', 38, '2026-11-17 23:37:08', '2026-11-18 12:32:50', '2026-11-17 22:25:19', '2026-11-17 22:29:51'),
(45, 9, 'SYSTEM TESTING JAY', 'INQ-0039', 'Active', 39, '2026-11-20 12:29:00', '2026-11-20 13:09:02', '2026-11-18 13:18:46', '2026-11-20 12:29:00'),
(46, 9, 'SYSTEM TEST V2', 'INQ-0040', 'Active', 40, '2026-11-18 13:38:34', '2026-11-18 13:52:12', '2026-11-18 13:32:28', '2026-11-18 13:35:53'),
(47, 9, 'INBOX TESTING', 'INQ-0041', 'Active', 41, '2026-11-19 00:12:20', '2026-11-19 20:44:23', '2026-11-18 13:54:40', '2026-11-19 00:12:20'),
(48, 9, 'SYSTEM TEST NEW', 'INQ-0042', 'Active', 42, '2026-11-18 23:02:03', '2026-11-18 20:57:57', '2026-11-18 19:00:15', '2026-11-18 19:00:15'),
(49, 9, 'xample', 'INQ-0043', 'Active', 43, '2026-11-18 23:02:00', '2026-11-18 20:58:06', '2026-11-18 19:39:36', '2026-11-18 19:39:36'),
(50, 9, 'SYSTEM TES 10', 'INQ-0044', 'Active', 44, '2026-11-18 23:01:57', NULL, '2026-11-18 20:06:59', '2026-11-18 20:06:59'),
(51, 9, 'system test 20', 'INQ-0045', 'Active', 45, '2026-11-19 14:07:07', '2026-11-19 19:05:37', '2026-11-18 20:08:07', '2026-11-19 14:07:07'),
(52, 9, 'testtttf', 'INQ-0046', 'Active', 46, '2026-11-20 12:29:00', '2026-11-20 13:08:43', '2026-11-18 20:23:41', '2026-11-20 12:29:00'),
(53, 9, 'thsssssssssss', 'INQ-0047', 'Active', 47, '2026-11-20 12:29:00', '2026-11-20 13:11:29', '2026-11-18 20:32:13', '2026-11-20 12:29:00'),
(54, 9, 'TESTINGG', 'INQ-0048', 'Active', 48, NULL, NULL, '2026-11-18 23:04:16', '2026-11-18 23:04:16'),
(55, 9, 'QWEFFFFFFFF', 'INQ-0049', 'Active', 49, NULL, NULL, '2026-11-18 23:09:04', '2026-11-18 23:09:04'),
(56, 9, 'NIEL WEDDING ANNIVERSARY', 'INQ-0050', 'Active', 50, '2026-11-18 23:41:36', '2026-11-18 23:40:46', '2026-11-18 23:32:40', '2026-11-18 23:41:36'),
(57, 9, '21333333333333', 'INQ-0052', 'Active', 52, NULL, '2026-11-19 19:03:08', '2026-11-19 00:12:18', '2026-11-19 00:12:18'),
(58, 9, 'dwcedcewcedc', 'INQ-0053', 'Active', 53, NULL, '2026-11-19 19:03:09', '2026-11-19 00:19:19', '2026-11-19 00:19:19'),
(59, 9, 'yoooooooot', 'INQ-0056', 'Active', 56, '2026-11-19 13:19:49', '2026-11-19 20:44:22', '2026-11-19 12:32:08', '2026-11-19 13:19:49'),
(60, 9, 'testing', 'INQ-0057', 'Active', 57, '2026-11-19 18:33:12', '2026-11-19 20:44:22', '2026-11-19 14:10:42', '2026-11-19 18:33:12'),
(61, 9, 'SYSTEM TEST', 'INQ-0058', 'Active', 58, '2026-11-19 20:37:30', '2026-11-19 20:43:07', '2026-11-19 19:06:18', '2026-11-19 20:37:30'),
(62, 9, 'testing', 'INQ-0059', 'Active', 59, '2026-11-19 20:37:30', '2026-11-19 20:43:11', '2026-11-19 19:21:11', '2026-11-19 20:37:30'),
(63, 9, 'TEST', 'INQ-0060', 'Active', 60, '2026-11-19 21:01:25', '2026-11-19 21:06:00', '2026-11-19 19:36:10', '2026-11-19 21:01:25'),
(64, 9, 'testing', 'INQ-0061', 'Active', 61, '2026-11-20 12:29:00', '2026-11-20 13:10:28', '2026-11-19 20:23:03', '2026-11-20 12:29:00'),
(65, 9, 'FINAL TESTING SYSTEM', 'INQ-0062', 'Active', 62, '2026-11-20 12:29:00', '2026-11-20 13:11:28', '2026-11-19 21:47:03', '2026-11-20 12:29:00');

-- --------------------------------------------------------

--
-- Table structure for table `cib_messages`
--

CREATE TABLE `cib_messages` (
  `id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  `sender_type` varchar(20) NOT NULL,
  `sender_name` varchar(120) DEFAULT '',
  `message` text DEFAULT NULL,
  `attachments` text DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `quotation_id` int(11) DEFAULT NULL,
  `payment_request_id` int(11) DEFAULT NULL,
  `feedback_booking_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cib_messages`
--

INSERT INTO `cib_messages` (`id`, `conversation_id`, `sender_type`, `sender_name`, `message`, `attachments`, `created_at`, `quotation_id`, `payment_request_id`, `feedback_booking_id`) VALUES
(1, 1, 'staff', 'jaystaff', 'Your quotation QT-0001 (v1) is ready. Total: ₱ 4,000.00. Deposit to reserve your date: ₱ 800.00 (20%). Valid until Nov 17, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-12 15:02:11', 1, NULL, NULL),
(2, 1, 'customer', 'You', 'I accept quotation QT-0001 (v1). I will send the ₱ 800.00 deposit receipt here.', NULL, '2026-11-12 15:04:07', NULL, NULL, NULL),
(3, 1, 'customer', 'You', '', '[{\"name\":\"63e7cb0c-ab6e-453a-839f-f65512de7c95.jpg\",\"url\":\"uploads\\/inbox\\/c6819098919deca1.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-12 15:04:32', NULL, NULL, NULL),
(4, 1, 'staff', 'jaystaff', 'Payment received: PHP 800.00 via GCash (Ref. 2698455970). Your booking BK-0001 is confirmed. Thank you!', NULL, '2026-11-12 15:07:16', NULL, NULL, NULL),
(5, 1, 'customer', 'You', '', '[{\"name\":\"141917b9-a26a-4714-98ec-540e67d30be2.jpg\",\"url\":\"uploads\\/inbox\\/943a65e66f14e52f.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-12 15:15:52', NULL, NULL, NULL),
(6, 1, 'customer', 'You', '', '[{\"name\":\"c2fea6a4-5c59-4725-be48-6f0f6ed9c90f.jpg\",\"url\":\"uploads\\/inbox\\/454deb51044ec3ba.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-12 15:16:41', NULL, NULL, NULL),
(7, 1, 'staff', 'jaystaff', 'Hi! The image you sent is hard to read. Could you please upload a clearer photo of your payment receipt? Thank you.', NULL, '2026-11-12 15:17:01', NULL, NULL, NULL),
(8, 2, 'staff', 'jaystaff', 'Your quotation QT-0002 (v1) is ready. Total: ₱ 660.00. Deposit to reserve your date: ₱ 132.00 (20%). Valid until Nov 17, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 00:15:05', 2, NULL, NULL),
(9, 2, 'customer', 'You', 'I accept quotation QT-0002 (v1). I will pay the ₱ 132.00 deposit online now.', NULL, '2026-11-13 00:15:20', NULL, NULL, NULL),
(10, 2, 'customer', 'You', '', '[{\"name\":\"63e7cb0c-ab6e-453a-839f-f65512de7c95.jpg\",\"url\":\"uploads\\/inbox\\/0e673236fbed1855.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-13 00:16:15', NULL, NULL, NULL),
(11, 3, 'staff', 'jaystaff', 'Your quotation QT-0003 (v1) is ready. Total: ₱ 2,640.00. Deposit to reserve your date: ₱ 528.00 (20%). Valid until Nov 16, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 00:27:01', 3, NULL, NULL),
(12, 3, 'customer', 'You', 'I accept quotation QT-0003 (v1). I will pay the ₱ 528.00 deposit online now.', NULL, '2026-11-13 00:27:10', NULL, NULL, NULL),
(13, 3, 'customer', 'You', '', '[{\"name\":\"a9f5be6d-e7ac-4185-898a-56a1e7cc8361.jpg\",\"url\":\"uploads\\/inbox\\/6985581da81a6a39.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-13 00:58:58', NULL, NULL, NULL),
(14, 4, 'staff', 'jaystaff', 'Your quotation QT-0004 (v1) is ready. Total: ₱ 2,400.00. Deposit to reserve your date: ₱ 480.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 01:13:30', 4, NULL, NULL),
(15, 4, 'customer', 'You', 'I accept quotation QT-0004 (v1). I will pay the ₱ 480.00 deposit online now.', NULL, '2026-11-13 01:13:37', NULL, NULL, NULL),
(16, 4, 'staff', 'Payments', 'Payment received: ₱ 480.00 via GCash (Ref. ewc_291b158a-dc32-4e23-9e89-8e31ba7ba074). Your booking BK-0002 is confirmed. Thank you!', NULL, '2026-11-13 01:31:59', NULL, NULL, NULL),
(17, 5, 'staff', 'jaystaff', 'Your quotation QT-0005 (v1) is ready. Total: ₱ 12,000.00. Deposit to reserve your date: ₱ 2,400.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 01:34:45', 5, NULL, NULL),
(18, 5, 'customer', 'You', 'I accept quotation QT-0005 (v1). I will pay the ₱ 2,400.00 deposit online now.', NULL, '2026-11-13 01:35:07', NULL, NULL, NULL),
(19, 5, 'customer', 'You', 'I would like to request changes to quotation QT-0005 (v1) (I had accepted it, but changed my mind before paying). Requested changes: reduce quantity Could you please send a revised quotation?', NULL, '2026-11-13 02:14:29', NULL, NULL, NULL),
(20, 5, 'staff', 'jaystaff', 'Your quotation QT-0005 (v2) is ready. Total: ₱ 8,000.00. Deposit to reserve your date: ₱ 1,600.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 02:15:32', 6, NULL, NULL),
(21, 5, 'customer', 'You', 'I accept quotation QT-0005 (v2). I will pay the ₱ 1,600.00 deposit online now.', NULL, '2026-11-13 02:17:57', NULL, NULL, NULL),
(22, 5, 'customer', 'You', 'I would like to request changes to quotation QT-0005 (v2) (I had accepted it, but changed my mind before paying). Requested changes: reduce 20 Could you please send a revised quotation?', NULL, '2026-11-13 02:20:10', NULL, NULL, NULL),
(23, 5, 'staff', 'jaystaff', 'Your quotation QT-0005 (v3) is ready. Total: ₱ 8,040.00. Deposit to reserve your date: ₱ 1,608.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 02:20:31', 7, NULL, NULL),
(24, 5, 'customer', 'You', 'I accept quotation QT-0005 (v3). I will pay the ₱ 1,608.00 deposit online now.', NULL, '2026-11-13 02:23:29', NULL, NULL, NULL),
(25, 5, 'customer', 'You', 'I would like to request changes to quotation QT-0005 (v3) (I had accepted it, but changed my mind before paying). Requested changes: 23 Could you please send a revised quotation?', NULL, '2026-11-13 02:24:22', NULL, NULL, NULL),
(26, 5, 'staff', 'jaystaff', 'Your quotation QT-0005 (v4) is ready. Total: ₱ 8,020.00. Deposit to reserve your date: ₱ 1,604.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 02:24:33', 8, NULL, NULL),
(27, 5, 'customer', 'You', 'I accept quotation QT-0005 (v4). I will pay the ₱ 1,604.00 deposit online now.', NULL, '2026-11-13 02:25:58', NULL, NULL, NULL),
(28, 3, 'customer', 'You', 'I would like to request changes to quotation QT-0003 (v1) (I had accepted it, but changed my mind before paying). Requested changes: reduce 10 Could you please send a revised quotation?', NULL, '2026-11-13 02:28:00', NULL, NULL, NULL),
(29, 3, 'staff', 'jaystaff', 'Your quotation QT-0003 (v2) is ready. Total: ₱ 2,676.00. Deposit to reserve your date: ₱ 535.20 (20%). Valid until Nov 16, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 02:28:29', 9, NULL, NULL),
(30, 3, 'customer', 'You', 'I accept quotation QT-0003 (v2). I will pay the ₱ 535.20 deposit to confirm my booking.', NULL, '2026-11-13 02:28:39', NULL, NULL, NULL),
(31, 6, 'staff', 'jaystaff', 'Your quotation QT-0007 (v1) is ready. Total: ₱ 750.00. Deposit to reserve your date: ₱ 150.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 02:40:12', 10, NULL, NULL),
(32, 6, 'customer', 'You', 'I accept quotation QT-0007 (v1). I will pay the ₱ 150.00 deposit to confirm my booking.', NULL, '2026-11-13 02:40:17', NULL, NULL, NULL),
(33, 6, 'staff', 'Payments', 'Payment received: ₱ 150.00 via GCash (Ref. ewc_6a1431e6-baf2-48bb-b2f5-ea57e1efd331). Your booking BK-0003 is confirmed. Thank you!', NULL, '2026-11-13 02:44:40', NULL, NULL, NULL),
(34, 7, 'staff', 'jaystaff', 'Your quotation QT-0008 (v1) is ready. Total: ₱ 1,200.00. Deposit to reserve your date: ₱ 240.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 03:21:19', 11, NULL, NULL),
(35, 7, 'customer', 'You', 'I accept quotation QT-0008 (v1). I will pay the ₱ 240.00 deposit to confirm my booking.', NULL, '2026-11-13 03:21:25', NULL, NULL, NULL),
(36, 7, 'staff', 'Payments', 'Payment received: ₱ 240.00 via GCash (Ref. ewc_20981c05-4c61-4e53-bf57-2bf5d4e95325). Your booking BK-0004 is confirmed. Thank you!', NULL, '2026-11-13 03:21:41', NULL, NULL, NULL),
(37, 8, 'staff', 'jaystaff', 'Your quotation QT-0006 (v1) is ready. Total: ₱ 575.00. Deposit to reserve your date: ₱ 115.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 03:24:56', 12, NULL, NULL),
(38, 9, 'staff', 'jaystaff', 'Your quotation QT-0009 (v1) is ready. Total: ₱ 4,472.00. Deposit to reserve your date: ₱ 894.40 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 03:26:20', 13, NULL, NULL),
(39, 9, 'customer', 'You', 'I accept quotation QT-0009 (v1). I will pay the ₱ 894.40 deposit to confirm my booking.', NULL, '2026-11-13 03:26:25', NULL, NULL, NULL),
(40, 9, 'staff', 'Payments', 'Payment received: ₱ 894.40 via Maya (Ref. ewc_91b7ab1e-12b0-4c1e-a7d4-a1996de0c092). Your booking BK-0005 is confirmed. Thank you!', NULL, '2026-11-13 03:26:39', NULL, NULL, NULL),
(41, 10, 'customer', 'jayhans', 'i dont have', NULL, '2026-11-13 16:21:56', NULL, NULL, NULL),
(42, 10, 'staff', 'jaystaff', 'Your quotation QT-0010 (v1) is ready. Total: ₱ 5,000.00. Deposit to reserve your date: ₱ 1,000.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:22:20', 14, NULL, NULL),
(43, 10, 'customer', 'You', 'I accept quotation QT-0010 (v1). I will pay the ₱ 1,000.00 deposit to confirm my booking.', NULL, '2026-11-13 16:22:37', NULL, NULL, NULL),
(44, 10, 'staff', 'Payments', 'Payment received: ₱ 1,000.00 via GCash (Ref. ewc_4c6df667-5c10-4127-8440-957809f601c0). Your booking BK-0006 is confirmed. Thank you!', NULL, '2026-11-13 16:22:55', NULL, NULL, NULL),
(45, 11, 'staff', 'jaystaff', 'Your quotation QT-0011 (v1) is ready. Total: ₱ 7,800.00. Deposit to reserve your date: ₱ 1,560.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:29:01', 15, NULL, NULL),
(46, 11, 'customer', 'You', 'I accept quotation QT-0011 (v1). I will pay the ₱ 1,560.00 deposit to confirm my booking.', NULL, '2026-11-13 16:29:08', NULL, NULL, NULL),
(47, 11, 'staff', 'Payments', 'Payment received: ₱ 1,560.00 via GCash (Ref. ewc_d67a2f0f-3479-4973-bd7c-b0dc73a47fd9). Your booking BK-0007 is confirmed. Thank you!', NULL, '2026-11-13 16:29:24', NULL, NULL, NULL),
(48, 12, 'staff', 'jaystaff', 'Your quotation QT-0012 (v1) is ready. Total: ₱ 2,806.00. Deposit to reserve your date: ₱ 561.20 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:38:54', 16, NULL, NULL),
(49, 12, 'customer', 'You', 'I accept quotation QT-0012 (v1). I will pay the ₱ 561.20 deposit to confirm my booking.', NULL, '2026-11-13 16:39:16', NULL, NULL, NULL),
(50, 12, 'staff', 'Payments', 'Payment received: ₱ 561.20 via GCash (Ref. ewc_3c262f00-533f-4db8-999d-651e49cc6faf). Your booking BK-0008 is confirmed. Thank you!', NULL, '2026-11-13 16:39:31', NULL, NULL, NULL),
(51, 13, 'staff', 'jaystaff', 'Your quotation QT-0013 (v1) is ready. Total: ₱ 2,000.00. Deposit to reserve your date: ₱ 400.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:44:05', 17, NULL, NULL),
(52, 13, 'customer', 'You', 'I accept quotation QT-0013 (v1). I will pay the ₱ 400.00 deposit to confirm my booking.', NULL, '2026-11-13 16:44:11', NULL, NULL, NULL),
(53, 13, 'staff', 'Payments', 'Payment received: ₱ 400.00 via Maya (Ref. ewc_fe0aea1e-f456-43b8-9462-77c99d8b2ddf). Your booking BK-0009 is confirmed. Thank you!', NULL, '2026-11-13 16:44:31', NULL, NULL, NULL),
(54, 14, 'staff', 'jaystaff', 'Your quotation QT-0014 (v1) is ready. Total: ₱ 5,000.00. Deposit to reserve your date: ₱ 1,000.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:54:49', 18, NULL, NULL),
(55, 14, 'customer', 'You', 'I accept quotation QT-0014 (v1). I will pay the ₱ 1,000.00 deposit to confirm my booking.', NULL, '2026-11-13 16:55:08', NULL, NULL, NULL),
(56, 14, 'staff', 'Payments', 'Payment received: ₱ 1,000.00 via GCash (Ref. ewc_3555d3a7-90e8-41b9-a12e-9b2b492c224c). Your booking BK-0010 is confirmed. Thank you!', NULL, '2026-11-13 16:55:25', NULL, NULL, NULL),
(57, 15, 'staff', 'jaystaff', 'Your quotation QT-0015 (v1) is ready. Total: ₱ 3,029.00. Deposit to reserve your date: ₱ 605.80 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 16:59:31', 19, NULL, NULL),
(58, 15, 'customer', 'You', 'I accept quotation QT-0015 (v1). I will pay the ₱ 605.80 deposit to confirm my booking.', NULL, '2026-11-13 16:59:39', NULL, NULL, NULL),
(59, 15, 'staff', 'Payments', 'Payment received: ₱ 605.80 via Maya (Ref. ewc_b34032dc-8b0d-4a73-b0a8-42fcdd6447e5). Your booking BK-0011 is confirmed. Thank you!', NULL, '2026-11-13 16:59:53', NULL, NULL, NULL),
(60, 16, 'staff', 'jaystaff', 'Your quotation QT-0016 (v1) is ready. Total: ₱ 2,800.00. Deposit to reserve your date: ₱ 560.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 17:10:02', 20, NULL, NULL),
(61, 16, 'customer', 'You', 'I accept quotation QT-0016 (v1). I will pay the ₱ 560.00 deposit to confirm my booking.', NULL, '2026-11-13 17:10:09', NULL, NULL, NULL),
(62, 16, 'staff', 'Payments', 'Payment received: ₱ 560.00 via Maya (Ref. ewc_9c478dc7-a853-48c7-a52a-bdca5c4e9f44). Your booking BK-0012 is confirmed. Thank you!', NULL, '2026-11-13 17:10:23', NULL, NULL, NULL),
(63, 17, 'staff', 'jaystaff', 'Your quotation QT-0018 (v1) is ready. Total: ₱ 3,900.00. Deposit to reserve your date: ₱ 780.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 17:38:50', 21, NULL, NULL),
(64, 17, 'customer', 'You', 'I accept quotation QT-0018 (v1). I will pay the ₱ 780.00 deposit to confirm my booking.', NULL, '2026-11-13 17:38:57', NULL, NULL, NULL),
(65, 17, 'staff', 'Payments', 'Payment received: ₱ 780.00 via GCash (Ref. ewc_dfcc5daf-04ef-40d7-8044-fe5cb0a77ca9). Your booking BK-0013 is confirmed. Thank you!', NULL, '2026-11-13 17:39:14', NULL, NULL, NULL),
(66, 18, 'staff', 'jaystaff', 'Your quotation for testtt8 is ready. Total: ₱ 6,900.00. Deposit to reserve your date: ₱ 1,380.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 21:42:03', 22, NULL, NULL),
(67, 18, 'customer', 'You', 'I accept the quotation for \"testtt8\". I will pay the ₱ 1,380.00 deposit to confirm my booking.', NULL, '2026-11-13 21:44:41', NULL, NULL, NULL),
(68, 18, 'staff', 'Payments', 'Payment received: ₱ 1,380.00 via GCash (Ref. ewc_0f8907ef-fae4-4cfb-877d-e4fc67765f1d). Your booking BK-0014 is confirmed. Thank you!', NULL, '2026-11-13 21:53:53', NULL, NULL, NULL),
(69, 3, 'staff', 'Payments', 'Payment received: ₱ 535.20 via GCash (Ref. ewc_a89a7c20-8e61-4098-92a7-7e6a63db387e). Your booking for \"BIRTDAY\" is confirmed. Thank you!', NULL, '2026-11-13 22:11:22', NULL, NULL, NULL),
(70, 8, 'customer', 'You', 'I accept the quotation for \"ahqsh1w\". I will pay the ₱ 115.00 deposit to confirm my booking.', NULL, '2026-11-13 22:20:28', NULL, NULL, NULL),
(71, 19, 'staff', 'jaystaff', 'Your quotation for test7 is ready. Total: ₱ 8,500.00. Deposit to reserve your date: ₱ 1,700.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 22:32:30', 23, NULL, NULL),
(72, 21, 'staff', 'jaystaff', 'Your quotation for anniv22 is ready. Total: ₱ 900.00. Deposit to reserve your date: ₱ 180.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 23:11:59', 24, NULL, NULL),
(73, 21, 'customer', 'You', 'I accept the quotation for \"anniv22\". I will pay the ₱ 180.00 deposit to confirm my booking.', NULL, '2026-11-13 23:12:09', NULL, NULL, NULL),
(74, 21, 'staff', 'Payments', 'Payment received: ₱ 180.00 via GCash (Ref. ewc_ed83a726-2cce-4a29-9927-c3168c090ba2). Your booking for \"anniv22\" is confirmed. Thank you!', NULL, '2026-11-13 23:12:23', NULL, NULL, NULL),
(75, 22, 'staff', 'jaystaff', 'Your quotation for BIRTDAY CELEBRATION is ready. Total: ₱ 4,600.00. Deposit to reserve your date: ₱ 920.00 (20%). Valid until Nov 27, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-13 23:54:05', 25, NULL, NULL),
(76, 22, 'customer', 'You', 'I accept the quotation for **BIRTDAY CELEBRATION**. I will pay the ₱ 920.00 deposit to confirm my booking.', NULL, '2026-11-13 23:54:24', NULL, NULL, NULL),
(77, 22, 'staff', 'Payments', 'Payment received: ₱ 920.00 via GCash (Ref. ewc_3bb6b99f-4547-4cd8-bb43-44ef908d9f8b). Your booking for **BIRTDAY CELEBRATION** is confirmed. Thank you!', NULL, '2026-11-13 23:59:19', NULL, NULL, NULL),
(78, 19, 'customer', 'You', 'I would like to request changes to the quotation for **test7**. Requested changes: REDUCE TO 20 PAX Could you please send a revised quotation?', NULL, '2026-11-14 00:01:03', NULL, NULL, NULL),
(79, 23, 'staff', 'jaystaff', 'Your quotation for WEDDING ANNIV is ready. Total: ₱ 4,300.00. Deposit to reserve your date: ₱ 860.00 (20%). Valid until Nov 28, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-14 15:11:21', 26, NULL, NULL),
(80, 24, 'staff', 'jaystaff', 'Your quotation for NIEL BIRTDAY is ready. Total: ₱ 3,950.00. Deposit to reserve your date: ₱ 790.00 (20%). Valid until Nov 28, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-14 16:58:25', 27, NULL, NULL),
(81, 24, 'customer', 'You', 'I accept the quotation for **NIEL BIRTDAY**. I will pay the ₱ 790.00 deposit to confirm my booking.', NULL, '2026-11-14 16:58:40', NULL, NULL, NULL),
(82, 24, 'staff', 'Payments', 'Payment received: ₱ 790.00 via GCash (Ref. ewc_ed4e0fd2-2d17-44c2-ba52-da58fcb73a9e). Your booking for **NIEL BIRTDAY** is confirmed. Thank you!', NULL, '2026-11-14 16:58:59', NULL, NULL, NULL),
(83, 24, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,160.00** for **NIEL BIRTDAY** on or before **Nov 15, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-14 20:04:43', NULL, 1, NULL),
(84, 24, 'staff', 'Payments', 'Payment received: ₱ 3,160.00 via GCash (Ref. ewc_d2bc64a5-a9f0-489b-921e-afcb41462559). Your booking for **NIEL BIRTDAY** is now fully paid. Thank you!', NULL, '2026-11-14 20:05:16', NULL, NULL, NULL),
(85, 3, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,140.80** for **BIRTDAY** on or before **Nov 15, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-14 20:16:21', NULL, 2, NULL),
(86, 22, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,680.00** for **BIRTDAY CELEBRATION** on or before **Nov 22, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-14 20:22:41', NULL, 3, NULL),
(87, 22, 'staff', 'Payments', 'Payment received: ₱ 3,680.00 via GCash (Ref. ewc_c2cdfe6c-70d6-4858-9496-5d31c67d161c). Your booking for **BIRTDAY CELEBRATION** is now fully paid. Thank you!', NULL, '2026-11-14 20:23:56', NULL, NULL, NULL),
(88, 23, 'customer', 'You', 'I accept the quotation for **WEDDING ANNIV**. I will pay the ₱ 860.00 deposit to confirm my booking.', NULL, '2026-11-14 21:02:00', NULL, NULL, NULL),
(89, 23, 'staff', 'Payments', 'Payment received: ₱ 860.00 via GCash (Ref. ewc_f862de36-aa46-4661-a6f2-69c912a80f24). Your booking for **WEDDING ANNIV** is confirmed. Thank you!', NULL, '2026-11-14 21:02:20', NULL, NULL, NULL),
(90, 23, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,440.00** for **WEDDING ANNIV** on or before **Nov 14, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-14 21:02:42', NULL, 4, NULL),
(91, 23, 'staff', 'Payments', 'Payment received: ₱ 3,440.00 via GCash (Ref. ewc_71cd8ee5-234d-43b8-a7e0-88c3f7d86dfa). Your booking for **WEDDING ANNIV** is now fully paid. Thank you!', NULL, '2026-11-14 21:03:01', NULL, NULL, NULL),
(92, 21, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 720.00** for **anniv22** on or before **Nov 14, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-14 21:11:01', NULL, 5, NULL),
(93, 21, 'staff', 'Payments', 'Payment received: ₱ 720.00 via Maya (Ref. ewc_4781ab16-dce9-471b-add5-f52118bac873). Your booking for **anniv22** is now fully paid. Thank you!', NULL, '2026-11-14 21:11:45', NULL, NULL, NULL),
(94, 25, 'customer', 'You', 'THE PALABOK IS HAVE LITTLE SERVING', NULL, '2026-11-15 00:01:59', NULL, NULL, NULL),
(95, 26, 'customer', 'You', 'THE SERVICE IS NOT GOOD', NULL, '2026-11-15 00:12:03', NULL, NULL, NULL),
(96, 27, 'customer', 'You', 'TEST34', NULL, '2026-11-15 00:14:58', NULL, NULL, NULL),
(97, 28, 'staff', 'jaystaff', 'Your quotation for NIEL DEBU is ready. Total: ₱ 6,000.00. Deposit to reserve your date: ₱ 1,200.00 (20%). Valid until Nov 16, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-15 10:35:13', 28, NULL, NULL),
(98, 28, 'staff', 'jaystaff', 'hi good morning', NULL, '2026-11-15 10:36:14', NULL, NULL, NULL),
(99, 28, 'staff', 'jaystaff', 'hi good morning', NULL, '2026-11-15 10:40:04', NULL, NULL, NULL),
(100, 28, 'staff', 'jaystaff', 'test 5', NULL, '2026-11-15 10:40:06', NULL, NULL, NULL),
(101, 28, 'staff', 'jaystaff', 'test 7', NULL, '2026-11-15 10:40:09', NULL, NULL, NULL),
(102, 29, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **shane bday**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-15 11:11:04', NULL, NULL, NULL),
(103, 29, 'staff', 'jaystaff', 'Your quotation for shane bday is ready. Total: ₱ 3,800.00. Deposit to reserve your date: ₱ 760.00 (20%). Valid until Nov 16, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-15 11:12:58', 29, NULL, NULL),
(104, 29, 'customer', 'You', 'I accept the quotation for **shane bday**. I will pay the ₱ 760.00 deposit to confirm my booking.', NULL, '2026-11-15 11:13:43', NULL, NULL, NULL),
(105, 29, 'staff', 'Payments', 'Payment received: ₱ 760.00 via GCash (Ref. ewc_7253e6ba-d290-4b39-81cf-da39e3e4e1d3). Your booking for **shane bday** is confirmed. Thank you!', NULL, '2026-11-15 11:14:12', NULL, NULL, NULL),
(106, 29, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-15 11:14:12', NULL, NULL, NULL),
(107, 30, 'customer', 'You', 'MY spagheti is to salty', NULL, '2026-11-15 11:21:59', NULL, NULL, NULL),
(108, 31, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **test34**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-15 11:26:44', NULL, NULL, NULL),
(109, 32, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **xample**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-15 15:37:26', NULL, NULL, NULL),
(110, 33, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **gab birthday**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-15 23:12:34', NULL, NULL, NULL),
(111, 33, 'staff', 'jaystaff', 'Your quotation for gab birthday is ready. Total: ₱ 4,300.00. Deposit to reserve your date: ₱ 860.00 (20%). Valid until Nov 17, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-15 23:13:27', 30, NULL, NULL),
(112, 33, 'customer', 'You', 'I accept the quotation for **gab birthday**. I will pay the ₱ 860.00 deposit to confirm my booking.', NULL, '2026-11-15 23:13:53', NULL, NULL, NULL),
(113, 33, 'staff', 'Payments', 'Payment received: ₱ 860.00 via GCash (Ref. ewc_ba820be4-06fc-4ac8-b8df-7d5b54337da4). Your booking for **gab birthday** is confirmed. Thank you!', NULL, '2026-11-15 23:14:11', NULL, NULL, NULL),
(114, 33, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-15 23:14:11', NULL, NULL, NULL),
(115, 34, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **NIEL WEDDING**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-16 00:02:33', NULL, NULL, NULL),
(116, 34, 'staff', 'jaystaff', 'Your quotation for NIEL WEDDING is ready. Total: ₱ 4,300.00. Deposit to reserve your date: ₱ 860.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it.', NULL, '2026-11-16 00:03:55', 31, NULL, NULL),
(117, 34, 'customer', 'You', 'I accept the quotation for **NIEL WEDDING**. I will pay the ₱ 860.00 deposit to confirm my booking.', NULL, '2026-11-16 00:04:25', NULL, NULL, NULL),
(118, 34, 'staff', 'Payments', 'Payment received: ₱ 860.00 via Maya (Ref. ewc_79008647-1974-4d52-9955-27363992d026). Your booking for **NIEL WEDDING** is confirmed. Thank you!', NULL, '2026-11-16 00:05:52', NULL, NULL, NULL),
(119, 34, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-16 00:05:52', NULL, NULL, NULL),
(120, 34, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,440.00** for **NIEL WEDDING** on or before **Nov 18, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-16 00:07:03', NULL, 6, NULL),
(121, 34, 'staff', 'Payments', 'Payment received: ₱ 3,440.00 via Maya (Ref. ewc_3bc3e3cd-49ca-4c87-9de5-92ccf42f27d8). Your booking for **NIEL WEDDING** is now fully paid. Thank you!', NULL, '2026-11-16 00:08:17', NULL, NULL, NULL),
(122, 34, 'customer', 'You', 'RTG4E5YETYRT', NULL, '2026-11-16 00:09:18', NULL, NULL, NULL),
(123, 35, 'customer', 'You', 'Late delivery', NULL, '2026-11-16 00:31:04', NULL, NULL, NULL),
(124, 36, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **try**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-16 01:17:57', NULL, NULL, NULL),
(125, 33, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,440.00** for **gab birthday** on or before **Nov 16, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-16 11:24:23', NULL, 7, NULL),
(126, 37, 'customer', 'You', 'the food is not good', NULL, '2026-11-16 12:06:00', NULL, NULL, NULL),
(127, 6, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 600.00** for **CELEBRATE** on or before **Nov 16, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-16 13:43:55', NULL, 8, NULL),
(128, 6, 'staff', 'Payments', 'Payment received: ₱ 600.00 via GCash (Ref. ewc_7ab3a77e-599c-4897-8c5c-051b7f2888e4). Your booking for **CELEBRATE** is now fully paid. Thank you!', NULL, '2026-11-16 13:44:49', NULL, NULL, NULL),
(129, 6, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **CELEBRATE**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-16 13:44:51', NULL, NULL, 3),
(130, 33, 'staff', 'Payments', 'Payment received: ₱ 3,440.00 via GCash (Ref. ewc_3575f027-fca5-4d2d-be8b-ecda65a010dc). Your booking for **gab birthday** is now fully paid. Thank you!', NULL, '2026-11-16 13:45:18', NULL, NULL, NULL),
(131, 38, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **TEST5**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-16 14:13:52', NULL, NULL, NULL),
(132, 38, 'staff', 'jaystaff', 'Hello! Your quotation for **TEST5** (QT-0033 (v1)) is ready. Total: ₱ 5,800.00. Deposit to reserve your date: ₱ 1,160.00 (20%). Valid until Nov 30, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-16 14:14:04', 32, NULL, NULL),
(133, 38, 'customer', 'You', 'I accept the quotation for **TEST5**. I will pay the ₱ 1,160.00 deposit to confirm my booking.', NULL, '2026-11-16 14:14:47', NULL, NULL, NULL),
(134, 38, 'staff', 'Payments', 'Payment received: ₱ 1,160.00 via GCash (Ref. ewc_6d569419-2baf-4fd8-a1c5-6069d8c2a345). Your booking for **TEST5** is confirmed. Thank you!', NULL, '2026-11-16 14:15:00', NULL, NULL, NULL),
(135, 38, 'staff', 'Catering Team', 'Please note: once your deposit is paid, your booking is confirmed and the event date is reserved exclusively for you. Cancellations after this point are non-refundable. If you need to make changes, please message us as soon as possible.', NULL, '2026-11-16 14:15:00', NULL, NULL, NULL),
(136, 38, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-16 14:15:00', NULL, NULL, NULL),
(137, 39, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **test67**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-16 22:00:15', NULL, NULL, NULL),
(138, 39, 'staff', 'jaystaff', 'Hello! Your quotation for **test67** (QT-0032 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until Nov 30, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-16 22:00:33', 33, NULL, NULL),
(139, 39, 'customer', 'You', 'I accept the quotation for **test67**. I will pay the ₱ 600.00 deposit to confirm my booking.', NULL, '2026-11-16 22:00:43', NULL, NULL, NULL),
(140, 39, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **test67**! Please pay the ₱ 600.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-16 22:00:44', NULL, NULL, NULL),
(141, 24, 'staff', 'jaystaff', 'Hello jaycustomer! Thank you for trusting us with **NIEL BIRTDAY**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 00:13:19', NULL, NULL, 18),
(142, 23, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **WEDDING ANNIV**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 00:13:19', NULL, NULL, 19),
(143, 40, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **test3**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-17 14:58:00', NULL, NULL, NULL),
(144, 41, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **whayne debu**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-17 16:40:37', NULL, NULL, NULL),
(145, 41, 'staff', 'jaystaff', 'Hello! Your quotation for **whayne debu** (QT-0035 (v1)) is ready. Total: ₱ 3,750.00. Deposit to reserve your date: ₱ 750.00 (20%). Valid until Dec 1, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-17 16:41:05', 34, NULL, NULL),
(146, 41, 'customer', 'You', 'I accept the quotation for **whayne debu**. I will pay the ₱ 750.00 deposit to confirm my booking.', NULL, '2026-11-17 16:42:28', NULL, NULL, NULL),
(147, 41, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **whayne debu**! Please pay the ₱ 750.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-17 16:42:29', NULL, NULL, NULL),
(148, 41, 'staff', 'Payments', 'Payment received: ₱ 750.00 via GCash (Ref. ewc_35da98c2-9097-4a08-b39c-09156fcdd7a3). Your booking for **whayne debu** is confirmed. Thank you!', NULL, '2026-11-17 16:43:10', NULL, NULL, NULL),
(149, 41, 'staff', 'Catering Team', 'Please note: once your deposit is paid, your booking is confirmed and the event date is reserved exclusively for you. Cancellations after this point are non-refundable. If you need to make changes, please message us as soon as possible.', NULL, '2026-11-17 16:43:10', NULL, NULL, NULL),
(150, 41, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-17 16:43:10', NULL, NULL, NULL),
(151, 41, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,000.00** for **whayne debu** on or before **Nov 17, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-17 16:44:39', NULL, 9, NULL),
(152, 41, 'staff', 'Payments', 'Payment received: ₱ 3,000.00 via GCash (Ref. ewc_b95baeca-f0e0-4ae2-85ac-e817dce2fafb). Your booking for **whayne debu** is now fully paid. Thank you!', NULL, '2026-11-17 16:45:01', NULL, NULL, NULL),
(153, 4, 'staff', 'jaystaff', 'Hello jaycustomer! Thank you for trusting us with **Anniversary**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 19:45:00', NULL, NULL, 2),
(154, 17, 'staff', 'jaystaff', 'Hello jaytest! Thank you for trusting us with **testjay**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 19:45:00', NULL, NULL, 13),
(155, 18, 'staff', 'jaystaff', 'Hello jaycustomer! Thank you for trusting us with **testtt8**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 19:45:00', NULL, NULL, 14),
(156, 3, 'staff', 'jaystaff', 'Hello jaycustomer! Thank you for trusting us with **BIRTDAY**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-17 19:45:00', NULL, NULL, 15),
(157, 42, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **TESTING45**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-17 20:08:41', NULL, NULL, NULL),
(158, 42, 'staff', 'jaystaff', 'Hello! Your quotation for **TESTING45** (QT-0036 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-17 20:26:40', 35, NULL, NULL),
(159, 42, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TESTING45**: Please accept the quotation and pay the **₱ 600.00** deposit by **Nov 19, 2026** (in 2 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 20:26:51', NULL, NULL, NULL),
(160, 43, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TEST**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-17 20:36:51', NULL, NULL, NULL),
(161, 43, 'staff', 'jaystaff', 'Hello! Your quotation for **SYSTEM TEST** (QT-0037 (v1)) is ready. Total: ₱ 3,500.00. Deposit to reserve your date: ₱ 700.00 (20%). Valid until Nov 19, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-17 20:38:09', 36, NULL, NULL),
(162, 43, 'customer', 'You', 'I accept the quotation for **SYSTEM TEST**. I will pay the ₱ 700.00 deposit to confirm my booking.', NULL, '2026-11-17 20:38:34', NULL, NULL, NULL),
(163, 43, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **SYSTEM TEST**! Please pay the ₱ 700.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-17 20:38:35', NULL, NULL, NULL),
(164, 42, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TESTING45**: Please accept the quotation and pay the **₱ 600.00** deposit by **Nov 18, 2026** (tomorrow) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 20:47:31', NULL, NULL, NULL),
(165, 43, 'staff', 'jaystaff', 'Hi! A friendly reminder for **SYSTEM TEST**: Please pay the **₱ 700.00** deposit by **Nov 19, 2026** (in 2 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 20:47:31', NULL, NULL, NULL),
(166, 43, 'staff', 'Payments', 'Payment received: ₱ 700.00 via GCash (Ref. ewc_b38756de-e2eb-4433-9278-548cfbc4b1f3). Your booking for **SYSTEM TEST** is confirmed. Thank you!', NULL, '2026-11-17 20:49:39', NULL, NULL, NULL),
(167, 43, 'staff', 'Catering Team', 'Please note: once your deposit is paid, your booking is confirmed and the event date is reserved exclusively for you. Cancellations after this point are non-refundable. If you need to make changes, please message us as soon as possible.', NULL, '2026-11-17 20:49:39', NULL, NULL, NULL),
(168, 43, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-17 20:49:39', NULL, NULL, NULL),
(169, 43, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,800.00** for **SYSTEM TEST** on or before **Nov 21, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-17 20:52:52', NULL, 10, NULL),
(170, 2, 'staff', 'jaystaff', 'Hi! A friendly reminder for **DEBU**: Please pay the **₱ 132.00** deposit by **Nov 17, 2026** (today) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(171, 5, 'staff', 'jaystaff', 'Hi! A friendly reminder for **birtday father**: Please pay the **₱ 1,604.00** deposit by **Nov 23, 2026** (in 6 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(172, 8, 'staff', 'jaystaff', 'Hi! A friendly reminder for **ahqsh1w**: Please pay the **₱ 115.00** deposit by **Nov 24, 2026** (in 7 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(173, 28, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 1,200.00 deposit for **NIEL DEBU** by Nov 16, 2026, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(174, 1, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 3,200.00** for **wedding** by Nov 16, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(175, 7, 'staff', 'jaystaff', 'Hi! A reminder for **trip**: please pay the remaining balance of **₱ 960.00** on or before **Nov 26, 2026** (in 9 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 11, NULL),
(176, 9, 'staff', 'jaystaff', 'Hi! A reminder for **rtewrt**: please pay the remaining balance of **₱ 3,577.60** on or before **Nov 17, 2026** (today). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 12, NULL),
(177, 10, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 4,000.00** for **BIRTDAY** by Nov 16, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(178, 11, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 6,240.00** for **BWHGEU3TWQR** by Nov 16, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(179, 13, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 1,600.00** for **debuuuuu** by Nov 16, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:07:52', NULL, NULL, NULL),
(180, 14, 'staff', 'jaystaff', 'Hi! A reminder for **testing**: please pay the remaining balance of **₱ 4,000.00** on or before **Nov 26, 2026** (in 9 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 13, NULL),
(181, 15, 'staff', 'jaystaff', 'Hi! A reminder for **tesing3**: please pay the remaining balance of **₱ 2,423.20** on or before **Nov 17, 2026** (today). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 14, NULL),
(182, 16, 'staff', 'jaystaff', 'Hi! A reminder for **test4**: please pay the remaining balance of **₱ 2,240.00** on or before **Nov 21, 2026** (in 4 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 15, NULL),
(183, 29, 'staff', 'jaystaff', 'Hi! A reminder for **shane bday**: please pay the remaining balance of **₱ 3,040.00** on or before **Nov 25, 2026** (in 8 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 16, NULL),
(184, 38, 'staff', 'jaystaff', 'Hi! A reminder for **TEST5**: please pay the remaining balance of **₱ 4,640.00** on or before **Nov 17, 2026** (today). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 17, NULL),
(185, 43, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TEST**: please pay the remaining balance of **₱ 2,800.00** on or before **Nov 22, 2026** (in 5 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:07:52', NULL, 10, NULL),
(186, 42, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TESTING45**: Please accept the quotation and pay the **₱ 600.00** deposit by **Nov 18, 2026** (tomorrow) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:27:22', NULL, NULL, NULL),
(187, 42, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TESTING45**: Please accept the quotation and pay the **₱ 600.00** deposit by **Nov 18, 2026** (tomorrow) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:27:56', NULL, NULL, NULL),
(188, 39, 'staff', 'jaystaff', 'Hi! A friendly reminder for **test67**: Please pay the **₱ 600.00** deposit by **Nov 22, 2026** (in 5 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:30:26', NULL, NULL, NULL),
(189, 42, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TESTING45**: Please accept the quotation and pay the **₱ 600.00** deposit by **Nov 18, 2026** (tomorrow) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-17 21:30:26', NULL, NULL, NULL),
(190, 29, 'staff', 'jaystaff', 'Hi! A reminder for **shane bday**: please pay the remaining balance of **₱ 3,040.00** on or before **Nov 25, 2026** (in 8 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:30:26', NULL, 16, NULL),
(191, 38, 'staff', 'jaystaff', 'Hi! A reminder for **TEST5**: please pay the remaining balance of **₱ 4,640.00** on or before **Nov 17, 2026** (today). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:30:26', NULL, 17, NULL),
(192, 43, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TEST**: please pay the remaining balance of **₱ 2,800.00** on or before **Nov 21, 2026** (in 4 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-17 21:30:26', NULL, 10, NULL),
(193, 39, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 600.00 deposit for **test67** by Nov 22, 2026, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-17 21:38:18', NULL, NULL, NULL),
(194, 42, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 600.00 deposit for **TESTING45** by Nov 18, 2026, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-17 21:38:18', NULL, NULL, NULL),
(195, 38, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 4,640.00** for **TEST5** by Nov 17, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:38:18', NULL, NULL, NULL),
(196, 43, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 2,800.00** for **SYSTEM TEST** by Nov 22, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-17 21:38:18', NULL, NULL, NULL),
(197, 44, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **test99**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-17 22:25:19', NULL, NULL, NULL),
(198, 44, 'staff', 'jaystaff', 'Hello! Your quotation for **test99** (QT-0038 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-17 22:26:05', 37, NULL, NULL);
INSERT INTO `cib_messages` (`id`, `conversation_id`, `sender_type`, `sender_name`, `message`, `attachments`, `created_at`, `quotation_id`, `payment_request_id`, `feedback_booking_id`) VALUES
(199, 44, 'customer', 'You', 'I accept the quotation for **test99**. I will pay the ₱ 600.00 deposit to confirm my booking.', NULL, '2026-11-17 22:26:43', NULL, NULL, NULL),
(200, 44, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **test99**! Please pay the ₱ 600.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-17 22:26:44', NULL, NULL, NULL),
(201, 44, 'staff', 'Payments', 'Payment received: ₱ 600.00 via GCash (Ref. ewc_3122225e-e923-4bd7-b5cb-89f2991da575). Your booking for **test99** is confirmed. Thank you!', NULL, '2026-11-17 22:27:28', NULL, NULL, NULL),
(202, 44, 'staff', 'Catering Team', 'Please note: once your deposit is paid, your booking is confirmed and the event date is reserved exclusively for you. Cancellations after this point are non-refundable. If you need to make changes, please message us as soon as possible.', NULL, '2026-11-17 22:27:28', NULL, NULL, NULL),
(203, 44, 'staff', 'Catering Team', 'Our catering team will contact you before your event date to confirm the final details. If you have any questions in the meantime, you can message us here.', NULL, '2026-11-17 22:27:28', NULL, NULL, NULL),
(204, 44, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,400.00** for **test99** on or before **Nov 19, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-17 22:28:24', NULL, 18, NULL),
(205, 44, 'staff', 'Payments', 'Payment received: ₱ 2,400.00 via GCash (Ref. ewc_41ada8f8-af2a-45f1-870b-318c52c231fc). Your booking for **test99** is now fully paid. Thank you!', NULL, '2026-11-17 22:29:51', NULL, NULL, NULL),
(206, 33, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **gab birthday**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-18 10:24:08', NULL, NULL, 21),
(207, 9, 'staff', 'Payments', 'Payment received: ₱ 3,577.60 via GCash (Ref. ewc_04fae55a-faad-40d0-b97d-d10e417cc9cc). Your booking for **rtewrt** is now fully paid. Thank you!', NULL, '2026-11-18 10:25:10', NULL, NULL, NULL),
(208, 9, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **rtewrt**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-18 10:26:24', NULL, NULL, 5),
(209, 15, 'staff', 'Payments', 'Payment received: ₱ 2,423.20 via GCash (Ref. ewc_549bcbd7-ed92-4275-ba7f-a49bc9bb0993). Your booking for **tesing3** is now fully paid. Thank you!', NULL, '2026-11-18 10:38:08', NULL, NULL, NULL),
(210, 29, 'staff', 'jaystaff', 'Hi! A reminder for **shane bday**: please pay the remaining balance of **₱ 3,040.00** on or before **Nov 25, 2026** (in 7 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-18 12:31:07', NULL, 16, NULL),
(211, 45, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TESTING JAY**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 13:18:46', NULL, NULL, NULL),
(212, 45, 'staff', 'jaystaff', 'Hello! Your quotation for **SYSTEM TESTING JAY** (QT-0039 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until Nov 19, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 13:23:17', 38, NULL, NULL),
(213, 45, 'customer', 'You', 'I accept the quotation for **SYSTEM TESTING JAY**. I will pay the ₱ 600.00 deposit to confirm my booking.', NULL, '2026-11-18 13:24:02', NULL, NULL, NULL),
(214, 45, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **SYSTEM TESTING JAY**! Please pay the ₱ 600.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 13:24:03', NULL, NULL, NULL),
(215, 45, 'staff', 'Payments', 'Payment received: ₱ 600.00 via Maya (Ref. ewc_43f9ee0d-ea86-4e0f-8391-15a98ad7e8e5). Your booking for **SYSTEM TESTING JAY** is confirmed. Thank you!', NULL, '2026-11-18 13:26:05', NULL, NULL, NULL),
(216, 45, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 2,400.00 is due by **Nov 21, 2026**, and we will send you a reminder here every day until then. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 13:26:05', NULL, NULL, NULL),
(217, 45, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TESTING JAY**: please pay the remaining balance of **₱ 2,400.00** on or before **Nov 21, 2026** (in 3 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-18 13:32:20', NULL, 19, NULL),
(218, 46, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TEST V2**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 13:32:28', NULL, NULL, NULL),
(219, 46, 'staff', 'jaystaff', 'Hello! Your quotation for **SYSTEM TEST V2** (QT-0040 (v1)) is ready. Total: ₱ 4,800.00. Deposit to reserve your date: ₱ 960.00 (20%). Valid until Nov 20, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 13:32:50', 39, NULL, NULL),
(220, 46, 'customer', 'You', 'I accept the quotation for **SYSTEM TEST V2**. I will pay the ₱ 960.00 deposit to confirm my booking.', NULL, '2026-11-18 13:33:30', NULL, NULL, NULL),
(221, 46, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **SYSTEM TEST V2**! Please pay the ₱ 960.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 13:33:31', NULL, NULL, NULL),
(222, 46, 'staff', 'Payments', 'Payment received: ₱ 960.00 via Maya (Ref. ewc_fb35b0c4-38e0-4015-a39a-74aae3c43b3b). Your booking for **SYSTEM TEST V2** is confirmed. Thank you!', NULL, '2026-11-18 13:34:19', NULL, NULL, NULL),
(223, 46, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 3,840.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 13:34:19', NULL, NULL, NULL),
(224, 46, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 3,840.00** for **SYSTEM TEST V2** on or before **Nov 20, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 13:35:17', NULL, 20, NULL),
(225, 46, 'staff', 'Payments', 'Payment received: ₱ 3,840.00 via GCash (Ref. ewc_a7dd9124-a4d3-493c-b5ae-91c287eb8450). Your booking for **SYSTEM TEST V2** is now fully paid. Thank you!', NULL, '2026-11-18 13:35:53', NULL, NULL, NULL),
(226, 32, 'staff', 'jaystaff', 'Hello! Your quotation for **xample** (QT-0028 (v1)) is ready. Total: ₱ 2,800.00. Deposit to reserve your date: ₱ 560.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 13:53:47', 40, NULL, NULL),
(227, 32, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 560.00 deposit for **xample** by Nov 16, 2026, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-18 13:53:53', NULL, NULL, NULL),
(228, 47, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **INBOX TESTING**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 13:54:40', NULL, NULL, NULL),
(229, 47, 'staff', 'jaystaff', 'Hello! Your quotation for **INBOX TESTING** (QT-0041 (v1)) is ready. Total: ₱ 3,450.00. Deposit to reserve your date: ₱ 690.00 (20%). Valid until Nov 18, 2026. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 13:55:44', 41, NULL, NULL),
(230, 47, 'customer', 'You', 'I accept the quotation for **INBOX TESTING**. I will pay the ₱ 690.00 deposit to confirm my booking.', NULL, '2026-11-18 13:59:19', NULL, NULL, NULL),
(231, 47, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **INBOX TESTING**! Please pay the ₱ 690.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 13:59:20', NULL, NULL, NULL),
(232, 47, 'staff', 'Payments', 'Payment received: ₱ 690.00 via GCash (Ref. ewc_cadc35bf-deb3-4c4a-85aa-6efc5aad5344). Your booking for **INBOX TESTING** is confirmed. Thank you!', NULL, '2026-11-18 14:00:12', NULL, NULL, NULL),
(233, 47, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 2,760.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 14:00:12', NULL, NULL, NULL),
(234, 47, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,760.00** for **INBOX TESTING** on or before **Nov 20, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 14:02:44', NULL, 21, NULL),
(235, 47, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,760.00** for **INBOX TESTING** on or before **Nov 19, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 14:02:52', NULL, 22, NULL),
(236, 47, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,760.00** for **INBOX TESTING** on or before **Nov 18, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 14:03:17', NULL, 23, NULL),
(237, 47, 'staff', 'jaystaff', 'Hi! A reminder for **INBOX TESTING**: please pay the remaining balance of **₱ 2,760.00** on or before **Nov 20, 2026** (in 2 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-18 14:04:12', NULL, 23, NULL),
(238, 48, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TEST NEW**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 19:00:15', NULL, NULL, NULL),
(239, 49, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **xample**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 19:39:36', NULL, NULL, NULL),
(240, 50, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TES 10**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 20:06:59', NULL, NULL, NULL),
(241, 51, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **system test 20**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 20:08:07', NULL, NULL, NULL),
(242, 51, 'staff', 'jaystaff', 'Hello! Your quotation for **system test 20** (QT-0045 (v1)) is ready. Total: ₱ 3,450.00. Deposit to reserve your date: ₱ 690.00 (20%). Valid until Nov 18, 2026, 9:30 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 20:13:31', 42, NULL, NULL),
(243, 51, 'customer', 'You', 'I accept the quotation for **system test 20**. I will pay the ₱ 690.00 deposit to confirm my booking.', NULL, '2026-11-18 20:17:23', NULL, NULL, NULL),
(244, 51, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **system test 20**! Please pay the ₱ 690.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 20:17:24', NULL, NULL, NULL),
(245, 52, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **testtttf**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 20:23:41', NULL, NULL, NULL),
(246, 52, 'staff', 'jaystaff', 'Hello! Your quotation for **testtttf** (QT-0046 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until Nov 18, 2026, 9:30 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 20:23:54', 43, NULL, NULL),
(247, 52, 'customer', 'You', 'I accept the quotation for **testtttf**. I will pay the ₱ 600.00 deposit to confirm my booking.', NULL, '2026-11-18 20:24:06', NULL, NULL, NULL),
(248, 52, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **testtttf**! Please pay the ₱ 600.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 20:24:07', NULL, NULL, NULL),
(249, 52, 'staff', 'Payments', 'Payment received: ₱ 600.00 via GCash (Ref. ewc_2e52a557-cb37-4cb0-b135-0b30459babee). Your booking for **testtttf** is confirmed. Thank you!', NULL, '2026-11-18 20:24:35', NULL, NULL, NULL),
(250, 52, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 2,400.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 20:24:35', NULL, NULL, NULL),
(251, 53, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **thsssssssssss**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 20:32:13', NULL, NULL, NULL),
(252, 53, 'staff', 'jaystaff', 'Hello! Your quotation for **thsssssssssss** (QT-0047 (v1)) is ready. Total: ₱ 6,500.00. Deposit to reserve your date: ₱ 1,300.00 (20%). Valid until Nov 18, 2026, 10:00 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 20:44:02', 44, NULL, NULL),
(253, 53, 'customer', 'You', 'I accept the quotation for **thsssssssssss**. I will pay the ₱ 1,300.00 deposit to confirm my booking.', NULL, '2026-11-18 20:45:08', NULL, NULL, NULL),
(254, 53, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **thsssssssssss**! Please pay the ₱ 1,300.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 20:45:09', NULL, NULL, NULL),
(255, 53, 'staff', 'Payments', 'Payment received: ₱ 1,300.00 via GCash (Ref. ewc_6849243f-ddac-4de7-b37e-7bb2cdeb1052). Your booking for **thsssssssssss** is confirmed. Thank you!', NULL, '2026-11-18 20:45:49', NULL, NULL, NULL),
(256, 53, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 5,200.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 20:45:49', NULL, NULL, NULL),
(257, 53, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 5,200.00** for **thsssssssssss** on or before **Nov 20, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 20:50:15', NULL, 24, NULL),
(258, 53, 'staff', 'Payments', 'Payment received: ₱ 5,200.00 via GCash (Ref. ewc_9f132d2c-e9b0-4055-b019-4b6d895549d4). Your booking for **thsssssssssss** is now fully paid. Thank you!', NULL, '2026-11-18 20:57:05', NULL, NULL, NULL),
(259, 47, 'staff', 'jaystaff', 'Hi! A reminder for **INBOX TESTING**: please pay the remaining balance of **₱ 2,760.00** on or before **Nov 18, 2026** (in about 2 hours). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-18 23:02:04', NULL, 23, NULL),
(260, 54, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **TESTINGG**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 23:04:16', NULL, NULL, NULL),
(261, 55, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **QWEFFFFFFFF**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 23:09:04', NULL, NULL, NULL),
(262, 56, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **NIEL WEDDING ANNIVERSARY**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-18 23:32:40', NULL, NULL, NULL),
(263, 56, 'staff', 'jaystaff', 'Hello! Your quotation for **NIEL WEDDING ANNIVERSARY** (QT-0050 (v1)) is ready. Total: ₱ 4,500.00. Deposit to reserve your date: ₱ 900.00 (20%). Valid until Nov 19, 2026, 11:00 AM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 23:33:20', 45, NULL, NULL),
(264, 56, 'customer', 'You', 'I accept the quotation for **NIEL WEDDING ANNIVERSARY**. I will pay the ₱ 900.00 deposit to confirm my booking.', NULL, '2026-11-18 23:34:06', NULL, NULL, NULL),
(265, 56, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **NIEL WEDDING ANNIVERSARY**! Please pay the ₱ 900.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 23:34:07', NULL, NULL, NULL),
(266, 56, 'customer', 'You', 'I would like to request changes to the quotation for **NIEL WEDDING ANNIVERSARY** (I had accepted it, but changed my mind before paying). Requested changes: I WANT TO CHANGE THE FOOD Could you please send a revised quotation?', NULL, '2026-11-18 23:34:36', NULL, NULL, NULL),
(267, 56, 'staff', 'jaystaff', 'Hello! Your quotation for **NIEL WEDDING ANNIVERSARY** (QT-0050 (v2)) is ready. Total: ₱ 5,000.00. Deposit to reserve your date: ₱ 1,000.00 (20%). Valid until Nov 19, 2026, 11:00 AM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-18 23:35:25', 46, NULL, NULL),
(268, 56, 'customer', 'You', 'I accept the quotation for **NIEL WEDDING ANNIVERSARY**. I will pay the ₱ 1,000.00 deposit to confirm my booking.', NULL, '2026-11-18 23:36:59', NULL, NULL, NULL),
(269, 56, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **NIEL WEDDING ANNIVERSARY**! Please pay the ₱ 1,000.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-18 23:37:00', NULL, NULL, NULL),
(270, 56, 'staff', 'Payments', 'Payment received: ₱ 1,000.00 via GCash (Ref. ewc_99fb9ca4-45c2-4d13-8da4-afd7ae47b117). Your booking for **NIEL WEDDING ANNIVERSARY** is confirmed. Thank you!', NULL, '2026-11-18 23:37:46', NULL, NULL, NULL),
(271, 56, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 4,000.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-18 23:37:46', NULL, NULL, NULL),
(272, 56, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 4,000.00** for **NIEL WEDDING ANNIVERSARY** on or before **Nov 20, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 23:39:54', NULL, 25, NULL),
(273, 56, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 4,000.00** for **NIEL WEDDING ANNIVERSARY** on or before **Nov 19, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 23:40:15', NULL, 26, NULL),
(274, 56, 'staff', 'Payments', 'Payment received: ₱ 4,000.00 via GCash (Ref. ewc_5f60a809-e97d-46ec-b2c7-38a0bba03c82). Your booking for **NIEL WEDDING ANNIVERSARY** is now fully paid. Thank you!', NULL, '2026-11-18 23:40:43', NULL, NULL, NULL),
(275, 56, 'staff', 'jaystaff', 'Hi! We started preparing the food for **NIEL WEDDING ANNIVERSARY**.', NULL, '2026-11-18 23:40:57', NULL, NULL, NULL),
(276, 56, 'staff', 'jaystaff', 'Hi! Our team is on the way to your venue for **NIEL WEDDING ANNIVERSARY**.', NULL, '2026-11-18 23:41:22', NULL, NULL, NULL),
(277, 56, 'staff', 'jaystaff', 'Hi! Our team is setting up at your venue for **NIEL WEDDING ANNIVERSARY**.', NULL, '2026-11-18 23:41:36', NULL, NULL, NULL),
(278, 52, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,400.00** for **testtttf** on or before **Nov 19, 2026**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-18 23:44:25', NULL, 27, NULL),
(279, 52, 'staff', 'Payments', 'Payment received: ₱ 2,400.00 via GCash (Ref. ewc_9b5a8a9b-ce75-4df5-bce1-6378f61edf59). Your booking for **testtttf** is now fully paid. Thank you!', NULL, '2026-11-18 23:44:59', NULL, NULL, NULL),
(280, 52, 'staff', 'jaystaff', 'Hi! We started preparing the food for **testtttf**.', NULL, '2026-11-18 23:47:46', NULL, NULL, NULL),
(281, 52, 'staff', 'jaystaff', 'Hi! Your order for **testtttf** is ready for pickup.', NULL, '2026-11-18 23:47:49', NULL, NULL, NULL),
(282, 57, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **21333333333333**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 00:12:18', NULL, NULL, NULL),
(283, 47, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 2,760.00** for **INBOX TESTING** by Nov 18, 2026, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-19 00:12:20', NULL, NULL, NULL),
(284, 15, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **tesing3**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-19 00:12:20', NULL, NULL, 11),
(285, 58, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **dwcedcewcedc**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 00:19:19', NULL, NULL, NULL),
(286, 45, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TESTING JAY**: please pay the remaining balance of **₱ 2,400.00** on or before **Nov 21, 2026** (in 2 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-19 12:08:07', NULL, 19, NULL),
(287, 59, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **yoooooooot**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 12:32:08', NULL, NULL, NULL),
(288, 59, 'staff', 'jaystaff', 'Hello! Your quotation for **yoooooooot** (QT-0056 (v1)) is ready. Total: ₱ 7,500.00. Deposit to reserve your date: ₱ 1,500.00 (20%). Valid until Nov 19, 2026, 2:00 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 12:52:58', 47, NULL, NULL),
(289, 59, 'customer', 'You', 'I accept the quotation for **yoooooooot**. I will pay the ₱ 1,500.00 deposit to confirm my booking.', NULL, '2026-11-19 12:55:08', NULL, NULL, NULL),
(290, 59, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **yoooooooot**! Please pay the ₱ 1,500.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-19 12:55:09', NULL, NULL, NULL),
(291, 59, 'staff', 'Payments', 'Payment received: ₱ 1,500.00 via GCash (Ref. ewc_57fc1e41-9b42-4e9a-83f9-4f5e89187666). Your booking for **yoooooooot** is confirmed. Thank you!', NULL, '2026-11-19 12:56:30', NULL, NULL, NULL),
(292, 59, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 6,000.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-19 12:56:30', NULL, NULL, NULL),
(293, 59, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 6,000.00** for **yoooooooot** on or before **Nov 20, 2026, 2:00 PM**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-19 12:58:50', NULL, 28, NULL),
(294, 59, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 6,000.00** for **yoooooooot** on or before **Nov 20, 2026, 8:30 AM**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-19 13:15:59', NULL, 29, NULL),
(295, 59, 'staff', 'Payments', 'Payment received: ₱ 6,000.00 via GCash (Ref. ewc_081d7e44-31fa-43e5-9d95-eb0a4e12b75f). Your booking for **yoooooooot** is now fully paid. Thank you!', NULL, '2026-11-19 13:18:34', NULL, NULL, NULL),
(296, 59, 'staff', 'jaystaff', 'Hi! We started preparing the food for **yoooooooot**.', NULL, '2026-11-19 13:19:43', NULL, NULL, NULL),
(297, 59, 'staff', 'jaystaff', 'Hi! Our team is on the way to your venue for **yoooooooot**.', NULL, '2026-11-19 13:19:46', NULL, NULL, NULL),
(298, 59, 'staff', 'jaystaff', 'Hi! Our team is setting up at your venue for **yoooooooot**.', NULL, '2026-11-19 13:19:49', NULL, NULL, NULL),
(299, 51, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 690.00 deposit for **system test 20** by Nov 18, 2026, 9:30 PM, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-19 14:07:07', NULL, NULL, NULL),
(300, 60, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **testing**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 14:10:42', NULL, NULL, NULL),
(301, 60, 'staff', 'jaystaff', 'Hello! Your quotation for **testing** (QT-0057 (v1)) is ready. Total: ₱ 16,500.00. Deposit to reserve your date: ₱ 3,300.00 (20%). Valid until Nov 20, 2026, 11:59 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 14:12:18', 48, NULL, NULL),
(302, 60, 'customer', 'You', 'I would like to request changes to the quotation for **testing**. Requested changes: move the date Could you please send a revised quotation?', NULL, '2026-11-19 14:12:57', NULL, NULL, NULL),
(303, 60, 'staff', 'jaystaff', 'Hello! Your quotation for **testing** (QT-0057 (v2)) is ready. Total: ₱ 16,500.00. Deposit to reserve your date: ₱ 3,300.00 (20%). Valid until Nov 19, 2026, 3:30 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 14:13:30', 49, NULL, NULL),
(304, 60, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 3,300.00 deposit for **testing** by Nov 19, 2026, 3:30 PM, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-19 18:33:12', NULL, NULL, NULL),
(305, 61, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **SYSTEM TEST**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 19:06:18', NULL, NULL, NULL),
(306, 61, 'staff', 'jaystaff', 'Hello! Your quotation for **SYSTEM TEST** (QT-0058 (v1)) is ready. Total: ₱ 2,800.00. Deposit to reserve your date: ₱ 560.00 (20%). Valid until Nov 19, 2026, 8:30 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 19:06:36', 50, NULL, NULL),
(307, 61, 'customer', 'You', 'I accept the quotation for **SYSTEM TEST**. I will pay the ₱ 560.00 deposit to confirm my booking.', NULL, '2026-11-19 19:06:59', NULL, NULL, NULL),
(308, 61, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **SYSTEM TEST**! Please pay the ₱ 560.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-19 19:07:00', NULL, NULL, NULL),
(309, 62, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **testing**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 19:21:11', NULL, NULL, NULL),
(310, 62, 'staff', 'jaystaff', 'Hello! Your quotation for **testing** (QT-0059 (v1)) is ready. Total: ₱ 2,800.00. Deposit to reserve your date: ₱ 560.00 (20%). Valid until today, Nov 19, 2026, 8:30 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 19:21:41', 51, NULL, NULL),
(311, 62, 'customer', 'You', 'I accept the quotation for **testing**. I will pay the ₱ 560.00 deposit to confirm my booking.', NULL, '2026-11-19 19:22:40', NULL, NULL, NULL),
(312, 62, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **testing**! Please pay the ₱ 560.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-19 19:22:41', NULL, NULL, NULL),
(313, 63, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **TEST**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 19:36:10', NULL, NULL, NULL),
(314, 63, 'staff', 'jaystaff', 'Hello! Your quotation for **TEST** (QT-0060 (v1)) is ready. Total: ₱ 5,500.00. Deposit to reserve your date: ₱ 1,100.00 (20%). Valid until today, Nov 19, 2026, 9:00 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 19:36:22', 52, NULL, NULL),
(315, 45, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TESTING JAY**: please pay the remaining balance of **₱ 2,400.00** on or before **Nov 21, 2026, 11:59 PM** (in 2 days). Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-19 19:37:30', NULL, 30, NULL),
(316, 45, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 2,400.00** for **SYSTEM TESTING JAY** on or before **tomorrow, Nov 20, 2026, 11:59 PM**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-19 19:42:35', NULL, 31, NULL),
(317, 61, 'staff', 'jaystaff', 'Hi! A friendly reminder for **SYSTEM TEST**: Please pay the **₱ 560.00** deposit by **today, Nov 19, 2026, 8:30 PM** (in about 25 minutes) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-19 20:06:42', NULL, NULL, NULL),
(318, 62, 'staff', 'jaystaff', 'Hi! A friendly reminder for **testing**: Please pay the **₱ 560.00** deposit by **today, Nov 19, 2026, 8:30 PM** (in about 25 minutes) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-19 20:06:42', NULL, NULL, NULL),
(319, 64, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **testing**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 20:23:03', NULL, NULL, NULL),
(320, 64, 'staff', 'jaystaff', 'Hello! Your quotation for **testing** (QT-0061 (v1)) is ready. Total: ₱ 3,000.00. Deposit to reserve your date: ₱ 600.00 (20%). Valid until tomorrow, Nov 20, 2026, 11:59 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 20:36:27', 53, NULL, NULL),
(321, 61, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 560.00 deposit for **SYSTEM TEST** by today, Nov 19, 2026, 8:30 PM, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-19 20:37:30', NULL, NULL, NULL),
(322, 62, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 560.00 deposit for **testing** by today, Nov 19, 2026, 8:30 PM, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-19 20:37:30', NULL, NULL, NULL),
(323, 63, 'staff', 'jaystaff', 'Hi! A friendly reminder for **TEST**: Please accept the quotation and pay the **₱ 1,100.00** deposit by **today, Nov 19, 2026, 9:00 PM** (in about 25 minutes) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-19 20:37:30', NULL, NULL, NULL),
(324, 63, 'customer', 'You', 'I accept the quotation for **TEST**. I will pay the ₱ 1,100.00 deposit to confirm my booking.', NULL, '2026-11-19 20:37:44', NULL, NULL, NULL),
(325, 63, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **TEST**! Please pay the ₱ 1,100.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-19 20:37:45', NULL, NULL, NULL),
(326, 63, 'staff', 'jaystaff', 'Hello! We did not receive the ₱ 1,100.00 deposit for **TEST** by today, Nov 19, 2026, 9:00 PM, so we had to release the date and close this inquiry. If you still need catering, you are welcome to send a new inquiry and we will gladly help.', NULL, '2026-11-19 21:01:25', NULL, NULL, NULL),
(327, 53, 'staff', 'jaystaff', 'Hi! We started preparing the food for **thsssssssssss**.', NULL, '2026-11-19 21:42:44', NULL, NULL, NULL),
(328, 65, 'customer', 'jayhans', 'I HAVE ALLERGY ON SEA FOOD ON PALABOK', NULL, '2026-11-19 21:47:03', NULL, NULL, NULL),
(329, 65, 'staff', 'jaystaff', 'Hi! Thank you for your inquiry for **FINAL TESTING SYSTEM**. I\'m jaystaff from our catering team and I\'ll be helping you with it. Feel free to message me here if you have any questions.', NULL, '2026-11-19 21:47:03', NULL, NULL, NULL),
(330, 65, 'staff', 'jaystaff', 'Hello! Your quotation for **FINAL TESTING SYSTEM** (QT-0062 (v1)) is ready. Total: ₱ 11,000.00. Deposit to reserve your date: ₱ 2,200.00 (20%). Valid until tomorrow, Nov 20, 2026, 11:59 PM. Please open My Inquiries > Quotation to accept or decline it. Note: once your deposit is paid, your booking is confirmed and the event date is reserved for you.', NULL, '2026-11-19 21:47:53', 54, NULL, NULL),
(331, 65, 'customer', 'You', 'I accept the quotation for **FINAL TESTING SYSTEM**. I will pay the ₱ 2,200.00 deposit to confirm my booking.', NULL, '2026-11-19 21:48:09', NULL, NULL, NULL),
(332, 65, 'staff', 'Catering Team', 'Thank you for accepting the quotation for **FINAL TESTING SYSTEM**! Please pay the ₱ 2,200.00 deposit to confirm and reserve your event date. Please note: once the deposit is paid, the booking is confirmed and **cancellations are non-refundable**. If you need to make any changes, please message us before paying the deposit.', NULL, '2026-11-19 21:48:10', NULL, NULL, NULL),
(333, 65, 'staff', 'Payments', 'Payment received: ₱ 2,200.00 via GCash (Ref. ewc_698da63a-c9aa-49d0-b56d-0cb84d8a5891). Your booking for **FINAL TESTING SYSTEM** is confirmed. Thank you!', NULL, '2026-11-19 21:49:36', NULL, NULL, NULL),
(334, 65, 'staff', 'Catering Team', 'Your event date is now reserved exclusively for you. The remaining balance of ₱ 8,800.00 will be requested by our catering team, and the payment request with its due date will be sent to you here. Our catering team will contact you before your event date to confirm the final details. If you need to make changes or have any questions, please message us here.', NULL, '2026-11-19 21:49:36', NULL, NULL, NULL),
(335, 41, 'staff', 'jaystaff', 'Hi! We started preparing the food for **whayne debu**.', NULL, '2026-11-20 01:25:18', NULL, NULL, NULL),
(336, 41, 'staff', 'jaystaff', 'Hi! Your order for **whayne debu** is out for delivery.', NULL, '2026-11-20 01:33:14', NULL, NULL, NULL),
(337, 41, 'staff', 'jaystaff', 'Hello jayhans! Thank you for trusting us with **whayne debu**. We hope everything was perfect. Please take a moment to rate our service. Tap Rate Now below, it helps us serve you and our future customers better.', NULL, '2026-11-20 01:33:33', NULL, NULL, 24),
(338, 65, 'staff', 'jaystaff', 'Hi! Please settle the remaining balance of **₱ 8,800.00** for **FINAL TESTING SYSTEM** on or before **today, Nov 20, 2026, 9:00 AM**. Tap Pay Now below to pay online (GCash or Maya).', NULL, '2026-11-20 01:34:27', NULL, 32, NULL),
(339, 7, 'staff', 'Payments', 'Payment received: ₱ 960.00 via GCash (Ref. ewc_b70f63bd-4bde-41d6-a181-ad6f98ce7a5c). Your booking for **trip** is now fully paid. Thank you!', NULL, '2026-11-20 01:35:24', NULL, NULL, NULL),
(340, 7, 'staff', 'jaystaff', 'Hi! We started preparing the food for **trip**.', NULL, '2026-11-20 01:37:25', NULL, NULL, NULL),
(341, 7, 'staff', 'jaystaff', 'Hi! Your order for **trip** is ready for pickup.', NULL, '2026-11-20 01:37:35', NULL, NULL, NULL),
(342, 65, 'customer', 'You', '', '[{\"name\":\"ce4723f4-008e-467e-832c-09f2d8ac5b94.jpg\",\"url\":\"uploads\\/inbox\\/f1e6fb02d5ce6a88.jpg\",\"mime_type\":\"image\\/jpeg\"}]', '2026-11-20 02:03:03', NULL, NULL, NULL),
(343, 64, 'staff', 'jaystaff', 'Hi! A friendly reminder for **testing**: Please accept the quotation and pay the **₱ 600.00** deposit by **today, Nov 20, 2026, 11:59 PM** (in 4 days) to reserve your event date. If the deposit is not paid by then, the inquiry is closed automatically and the date is released. Open your inquiry and tap Pay deposit, or message me here if you have questions.', NULL, '2026-11-20 12:29:00', NULL, NULL, NULL),
(344, 45, 'staff', 'jaystaff', 'Hi! A reminder for **SYSTEM TESTING JAY**: please pay the remaining balance of **₱ 2,400.00** on or before **today, Nov 20, 2026, 11:59 PM**. Tap Pay Now below to pay online (GCash or Maya). Bookings with an unpaid balance after that date are cancelled automatically, and the deposit is non-refundable.', NULL, '2026-11-20 12:29:00', NULL, 31, NULL),
(345, 65, 'staff', 'jaystaff', 'Hello! We did not receive the remaining balance of **₱ 8,800.00** for **FINAL TESTING SYSTEM** by today, Nov 20, 2026, 9:00 AM, so the booking has been cancelled and the food and service will not proceed. As stated in our policy, the deposit is non-refundable. If you already paid or think this is a mistake, please message us here right away.', NULL, '2026-11-20 12:29:00', NULL, NULL, NULL),
(346, 52, 'staff', 'jaystaff', 'Hi! A reminder that your event **testtttf** is tomorrow, **Nov 21, 2026**. Pickup time: **6:00 PM**. Location: Customer pickup. Please make sure someone is ready to receive the order. If you need to change anything, message us here as early as possible.', NULL, '2026-11-20 12:29:00', NULL, NULL, NULL),
(347, 53, 'staff', 'jaystaff', 'Hi! A reminder that your event **thsssssssssss** is tomorrow, **Nov 21, 2026**. Pickup time: **5:00 PM**. Location: Customer pickup. Please make sure someone is ready to receive the order. If you need to change anything, message us here as early as possible.', NULL, '2026-11-20 12:29:00', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `cib_tickets`
--

CREATE TABLE `cib_tickets` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `ticket_number` varchar(30) DEFAULT '',
  `subject` varchar(160) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'Open',
  `priority` varchar(20) NOT NULL DEFAULT 'Medium',
  `conversation_id` int(11) DEFAULT NULL,
  `cs_read_at` datetime DEFAULT NULL,
  `customer_read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cib_tickets`
--

INSERT INTO `cib_tickets` (`id`, `customer_id`, `ticket_number`, `subject`, `status`, `priority`, `conversation_id`, `cs_read_at`, `customer_read_at`, `created_at`, `updated_at`) VALUES
(1, 9, 'TCK-0001', 'PALABOK', 'Pending', 'Medium', 25, '2026-11-15 00:03:09', '2026-11-16 00:18:04', '2026-11-15 00:01:59', '2026-11-15 00:07:26'),
(2, 9, 'TCK-0002', 'SERVICE', 'Open', 'Medium', 26, '2026-11-16 00:51:53', '2026-11-16 00:18:05', '2026-11-15 00:12:03', '2026-11-15 00:12:03'),
(3, 9, 'TCK-0003', 'TEST', 'Open', 'Medium', 27, '2026-11-16 00:56:30', '2026-11-15 11:22:12', '2026-11-15 00:14:58', '2026-11-15 00:47:55'),
(4, 9, 'TCK-0004', 'FOOD', 'Open', 'Medium', 30, '2026-11-16 00:51:45', '2026-11-16 12:09:06', '2026-11-15 11:21:59', '2026-11-15 11:21:59'),
(5, 9, 'TCK-0005', 'FOOD', 'Pending', 'Medium', 35, '2026-11-16 00:51:46', '2026-11-16 12:09:07', '2026-11-16 00:31:04', '2026-11-16 00:54:11'),
(6, 9, 'TCK-0006', 'Menu or package concern', 'Open', 'High', 37, '2026-11-17 01:41:21', '2026-11-20 13:08:41', '2026-11-16 12:06:00', '2026-11-17 01:41:09');

-- --------------------------------------------------------

--
-- Table structure for table `cib_ticket_activity`
--

CREATE TABLE `cib_ticket_activity` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `performed_by` varchar(120) NOT NULL DEFAULT '',
  `performed_by_role` varchar(60) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cib_ticket_activity`
--

INSERT INTO `cib_ticket_activity` (`id`, `ticket_id`, `action`, `performed_by`, `performed_by_role`, `created_at`) VALUES
(1, 1, 'Ticket priority changed to Urgent', 'jaysupport', 'CS Staff', '2026-11-15 00:07:16'),
(2, 1, 'Ticket status changed to Pending', 'jaysupport', 'CS Staff', '2026-11-15 00:07:20'),
(3, 1, 'Ticket priority changed to High', 'jaysupport', 'CS Staff', '2026-11-15 00:07:24'),
(4, 1, 'Ticket priority changed to Medium', 'jaysupport', 'CS Staff', '2026-11-15 00:07:26'),
(5, 3, 'Ticket status changed to In Progress', 'jaysupport', 'CS Staff', '2026-11-15 00:27:20'),
(6, 3, 'Ticket status changed to Resolved', 'jaysupport', 'CS Staff', '2026-11-15 00:27:53'),
(7, 3, 'Ticket priority changed to Low', 'jaysupport', 'CS Staff', '2026-11-15 00:28:11'),
(8, 3, 'Internal note added', 'jaysupport', 'CS Staff', '2026-11-15 00:28:16'),
(9, 3, 'Ticket priority changed to Medium', 'jaysupport', 'CS Staff', '2026-11-15 00:28:22'),
(10, 3, 'Ticket status changed to Open', 'jaysupport', 'CS Staff', '2026-11-15 00:32:36'),
(11, 3, 'Ticket resolved', 'jaysupport', 'CS Staff', '2026-11-15 00:33:29'),
(12, 3, 'Ticket reopened by the customer', '', 'Customer', '2026-11-15 00:35:06'),
(13, 3, 'Ticket status changed to Resolved', 'jaysupport', 'CS Staff', '2026-11-15 00:47:40'),
(14, 3, 'Ticket reopened by the customer', '', 'Customer', '2026-11-15 00:47:55'),
(15, 5, 'Ticket status changed to In Progress', 'jaysupport', 'CS Staff', '2026-11-16 00:31:44'),
(16, 5, 'Ticket status changed to Resolved', 'jaysupport', 'CS Staff', '2026-11-16 00:32:47'),
(17, 5, 'Ticket reopened by the customer', '', 'Customer', '2026-11-16 00:33:09'),
(18, 5, 'Internal note added', 'jaysupport', 'CS Staff', '2026-11-16 00:51:36'),
(19, 5, 'Ticket status changed to In Progress', 'jaysupport', 'CS Staff', '2026-11-16 00:54:06'),
(20, 5, 'Ticket status changed to Pending', 'jaysupport', 'CS Staff', '2026-11-16 00:54:11'),
(21, 6, 'Ticket priority changed to High', 'jaysupport', 'CS Staff', '2026-11-17 01:41:09');

-- --------------------------------------------------------

--
-- Table structure for table `cib_ticket_messages`
--

CREATE TABLE `cib_ticket_messages` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `sender_type` varchar(20) NOT NULL,
  `sender_name` varchar(120) DEFAULT '',
  `message` text DEFAULT NULL,
  `attachments` text DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cib_ticket_messages`
--

INSERT INTO `cib_ticket_messages` (`id`, `ticket_id`, `sender_type`, `sender_name`, `message`, `attachments`, `created_at`) VALUES
(1, 1, 'customer', 'You', 'THE PALABOK IS HAVE LITTLE SERVING', NULL, '2026-11-15 00:01:59'),
(2, 2, 'customer', 'You', 'THE SERVICE IS NOT GOOD', NULL, '2026-11-15 00:12:03'),
(3, 3, 'customer', 'You', 'TEST34', NULL, '2026-11-15 00:14:58'),
(4, 4, 'customer', 'You', 'MY spagheti is to salty', NULL, '2026-11-15 11:21:59'),
(5, 5, 'customer', 'You', 'Late delivery', NULL, '2026-11-16 00:31:04'),
(6, 5, 'staff', 'jaysupport', 'ryey6u7ids', NULL, '2026-11-16 00:31:44'),
(7, 5, 'customer', 'You', 'hi', NULL, '2026-11-16 00:32:29'),
(8, 6, 'customer', 'You', 'the food is not good', NULL, '2026-11-16 12:06:00');

-- --------------------------------------------------------

--
-- Table structure for table `cib_ticket_notes`
--

CREATE TABLE `cib_ticket_notes` (
  `id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `note` text NOT NULL,
  `created_by` varchar(120) NOT NULL DEFAULT '',
  `created_by_role` varchar(60) NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cib_ticket_notes`
--

INSERT INTO `cib_ticket_notes` (`id`, `ticket_id`, `note`, `created_by`, `created_by_role`, `created_at`) VALUES
(1, 3, 'wqeqeeeeeeeee', 'jaysupport', 'CS Staff', '2026-11-15 00:28:16'),
(2, 5, 'wtrewqrtwrte', 'jaysupport', 'CS Staff', '2026-11-16 00:51:36');

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
--

CREATE TABLE `contacts` (
  `contact_id` int(11) NOT NULL,
  `customer_name` varchar(150) NOT NULL,
  `email` varchar(100) NOT NULL,
  `contact_number` varchar(30) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `deadline_reminders`
--

CREATE TABLE `deadline_reminders` (
  `id` int(11) NOT NULL,
  `kind` varchar(20) NOT NULL,
  `ref_id` int(11) NOT NULL,
  `stage` int(11) NOT NULL,
  `sent_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `deadline_reminders`
--

INSERT INTO `deadline_reminders` (`id`, `kind`, `ref_id`, `stage`, `sent_at`) VALUES
(1, 'deposit', 36, 3, '2026-11-17 20:26:51'),
(2, 'dep_round', 36, 125, '2026-11-17 20:47:31'),
(3, 'dep_round', 37, 56, '2026-11-17 20:47:31'),
(4, 'dep_round', 2, 4, '2026-11-17 21:07:52'),
(5, 'dep_round', 5, 4, '2026-11-17 21:07:52'),
(6, 'dep_round', 6, 4, '2026-11-17 21:07:52'),
(7, 'bal_round', 4, 4, '2026-11-17 21:07:52'),
(8, 'bal_round', 5, 4, '2026-11-17 21:07:52'),
(9, 'bal_round', 10, 4, '2026-11-17 21:07:52'),
(10, 'bal_round', 11, 4, '2026-11-17 21:07:52'),
(11, 'bal_round', 12, 4, '2026-11-17 21:07:52'),
(12, 'bal_round', 20, 2, '2026-11-17 21:07:52'),
(13, 'bal_round', 23, 1, '2026-11-17 21:07:52'),
(15, 'dep_round', 36, 101, '2026-11-17 21:27:22'),
(16, 'dep_round', 36, 102, '2026-11-17 21:27:56'),
(17, 'dep_round', 32, 2349, '2026-11-17 21:30:26'),
(18, 'dep_round', 36, 106, '2026-11-17 21:30:26'),
(19, 'bal_round', 20, 5827, '2026-11-17 21:30:26'),
(20, 'bal_round', 23, 3125, '2026-11-17 21:30:26'),
(21, 'bal_round', 25, 4837, '2026-11-17 21:30:26'),
(29, 'bal_round', 20, 3, '2026-11-18 12:31:07'),
(30, 'balance', 27, 3, '2026-11-18 13:32:20'),
(34, 'balance', 29, 2, '2026-11-18 14:04:12'),
(37, 'bal2', 23, 99, '2026-11-18 23:02:04'),
(41, 'bal2', 19, 2, '2026-11-19 12:08:07'),
(58, 'bal2', 30, 2, '2026-11-19 19:37:30'),
(59, 'dep2', 50, 98, '2026-11-19 20:06:42'),
(60, 'dep2', 51, 98, '2026-11-19 20:06:42'),
(69, 'dep2', 52, 98, '2026-11-19 20:37:30'),
(73, 'dep2', 53, 0, '2026-11-20 12:29:00'),
(74, 'bal2', 31, 0, '2026-11-20 12:29:00'),
(75, 'event_eve', 30, 1, '2026-11-20 12:29:00'),
(76, 'event_eve', 31, 1, '2026-11-20 12:29:00');

-- --------------------------------------------------------

--
-- Table structure for table `deals`
--

CREATE TABLE `deals` (
  `deal_id` int(11) NOT NULL,
  `inquiry_event_name` varchar(150) NOT NULL,
  `lead_id` int(11) NOT NULL,
  `assigned_user_id` int(11) NOT NULL,
  `stage` enum('Quotation Preparation','Quotation Sent','Negotiation','Confirmed','Declined') NOT NULL DEFAULT 'Quotation Preparation',
  `food_orders` text NOT NULL,
  `number_of_guests` int(11) NOT NULL,
  `event_date` date NOT NULL,
  `service_arrangement` enum('Customer Pickup','Food Delivery','On-site Catering') NOT NULL,
  `pickup_date` date DEFAULT NULL,
  `pickup_time` time DEFAULT NULL,
  `delivery_address` varchar(255) DEFAULT NULL,
  `delivery_date` date DEFAULT NULL,
  `delivery_time` time DEFAULT NULL,
  `event_venue` varchar(255) DEFAULT NULL,
  `event_start_time` time DEFAULT NULL,
  `event_end_time` time DEFAULT NULL,
  `quotation_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Table structure for table `inquiry_assignment_history`
--

CREATE TABLE `inquiry_assignment_history` (
  `id` int(11) NOT NULL,
  `lead_id` int(11) NOT NULL,
  `previous_staff_id` int(11) DEFAULT NULL,
  `previous_staff_name` varchar(120) DEFAULT NULL,
  `new_staff_id` int(11) NOT NULL,
  `new_staff_name` varchar(120) NOT NULL,
  `reason` varchar(120) DEFAULT NULL,
  `reason_note` text DEFAULT NULL,
  `changed_by_id` int(11) DEFAULT NULL,
  `changed_by_name` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inquiry_assignment_history`
--

INSERT INTO `inquiry_assignment_history` (`id`, `lead_id`, `previous_staff_id`, `previous_staff_name`, `new_staff_id`, `new_staff_name`, `reason`, `reason_note`, `changed_by_id`, `changed_by_name`, `created_at`) VALUES
(1, 30, 2, 'jaystaff', 5, 'nielstaff', 'Workload redistribution', '', 6, 'jayadmin', '2026-11-16 00:46:08');

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `lead_id` int(11) NOT NULL,
  `inquiry_event_name` varchar(80) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `assigned_user_id` int(11) DEFAULT NULL,
  `stage` varchar(40) NOT NULL DEFAULT 'New Inquiry',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `inquiry_ref` varchar(30) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_name` varchar(160) DEFAULT '',
  `customer_email` varchar(160) DEFAULT '',
  `package` varchar(160) DEFAULT '',
  `dishes` text DEFAULT NULL,
  `menu_item_ids` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `assigned_staff_name` varchar(120) DEFAULT NULL,
  `claimed_at` datetime DEFAULT NULL,
  `event_name` varchar(160) DEFAULT NULL,
  `event_date` date DEFAULT NULL,
  `event_location` varchar(255) DEFAULT '',
  `arrangement` varchar(60) DEFAULT '',
  `assigned_staff_id` int(11) DEFAULT NULL,
  `decline_reason` text DEFAULT NULL,
  `declined_at` datetime DEFAULT NULL,
  `expected_guests` int(11) DEFAULT NULL,
  `estimated_budget` decimal(12,2) DEFAULT NULL,
  `event_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leads`
--

INSERT INTO `leads` (`lead_id`, `inquiry_event_name`, `contact_id`, `assigned_user_id`, `stage`, `created_at`, `updated_at`, `inquiry_ref`, `customer_id`, `customer_name`, `customer_email`, `package`, `dishes`, `menu_item_ids`, `notes`, `assigned_staff_name`, `claimed_at`, `event_name`, `event_date`, `event_location`, `arrangement`, `assigned_staff_id`, `decline_reason`, `declined_at`, `expected_guests`, `estimated_budget`, `event_time`) VALUES
(1, NULL, NULL, NULL, 'Completed', '2026-11-12 06:59:55', '2026-11-12 07:07:16', 'INQ-0001', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-12 15:00:08', 'wedding', '2026-11-17', 'Parklane', 'Delivery', 2, NULL, NULL, NULL, NULL, NULL),
(2, NULL, NULL, NULL, 'Quotation Sent', '2026-11-12 16:14:34', '2026-11-12 16:15:05', 'INQ-0002', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 00:14:41', 'DEBU', '2026-12-03', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(3, NULL, NULL, NULL, 'Completed', '2026-11-12 16:26:15', '2026-11-13 14:11:22', 'INQ-0003', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 00:26:25', 'BIRTDAY', '2026-11-16', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(4, NULL, NULL, NULL, 'Completed', '2026-11-12 17:13:02', '2026-11-12 17:31:59', 'INQ-0004', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 01:13:09', 'Anniversary', '2026-11-16', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(5, NULL, NULL, NULL, 'Quotation Sent', '2026-11-12 17:34:05', '2026-11-12 18:24:33', 'INQ-0005', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 01:34:22', 'birtday father', '2026-11-26', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(6, NULL, NULL, NULL, 'Quotation Sent', '2026-11-12 18:01:26', '2026-11-12 19:24:56', 'INQ-0006', 3, 'jaycustomer', '', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 03:24:28', 'ahqsh1w', '2026-11-27', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(7, NULL, NULL, NULL, 'Completed', '2026-11-12 18:39:40', '2026-11-13 08:35:56', 'INQ-0007', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 02:39:49', 'CELEBRATE', '2026-11-15', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(8, NULL, NULL, NULL, 'Completed', '2026-11-12 19:20:50', '2026-11-13 08:35:56', 'INQ-0008', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 03:21:05', 'trip', '2026-11-27', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(9, NULL, NULL, NULL, 'Completed', '2026-11-12 19:24:20', '2026-11-13 08:35:56', 'INQ-0009', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 03:26:04', 'rtewrt', '2026-11-18', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(10, NULL, NULL, NULL, 'Completed', '2026-11-13 08:21:50', '2026-11-13 08:35:56', 'INQ-0010', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', 'i dont have', 'jaystaff', '2026-11-13 16:21:56', 'BIRTDAY', '2026-11-17', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(11, NULL, NULL, NULL, 'Completed', '2026-11-13 08:28:08', '2026-11-13 08:35:56', 'INQ-0011', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 16:28:44', 'BWHGEU3TWQR', '2026-11-17', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(12, NULL, NULL, NULL, 'Completed', '2026-11-13 08:33:15', '2026-11-13 08:39:31', 'INQ-0012', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 16:38:40', 'BIRTDAYYYY', '2026-11-16', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(13, NULL, NULL, NULL, 'Completed', '2026-11-13 08:43:11', '2026-11-13 08:50:15', 'INQ-0013', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 16:43:37', 'debuuuuu', '2026-11-17', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(14, NULL, NULL, NULL, 'Completed', '2026-11-13 08:47:55', '2026-11-13 08:55:25', 'INQ-0014', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 16:49:30', 'testing', '2026-11-27', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(15, NULL, NULL, NULL, 'Completed', '2026-11-13 08:58:49', '2026-11-13 09:08:52', 'INQ-0015', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 16:59:12', 'tesing3', '2026-11-18', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(16, NULL, NULL, NULL, 'Completed', '2026-11-13 09:04:34', '2026-11-13 09:10:23', 'INQ-0016', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 17:09:41', 'test4', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(17, NULL, NULL, NULL, 'Negotiation', '2026-11-13 09:09:24', '2026-11-13 16:01:03', 'INQ-0017', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 22:28:54', 'test7', '2026-11-17', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(18, NULL, NULL, NULL, 'Completed', '2026-11-13 09:37:20', '2026-11-13 09:39:14', 'INQ-0018', 10, 'jaytest', 'chatgptcute12345@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 17:38:33', 'testjay', '2026-11-16', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(19, NULL, NULL, NULL, 'Completed', '2026-11-13 13:41:28', '2026-11-13 13:53:53', 'INQ-0019', 3, 'jaycustomer', 'jaycustomer@example.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 21:41:39', 'testtt8', '2026-11-15', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(20, NULL, NULL, NULL, 'In Progress', '2026-11-13 14:48:51', '2026-11-13 14:53:38', 'INQ-0020', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 22:53:38', 'testtt990', '2026-11-23', 'parklane', 'Buffet with setup', 2, NULL, NULL, NULL, NULL, NULL),
(21, NULL, NULL, NULL, 'Completed', '2026-11-13 15:05:47', '2026-11-13 15:12:23', 'INQ-0021', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 23:11:07', 'anniv22', '2026-11-15', 'parklane', 'Buffet with setup', 2, NULL, NULL, 30, NULL, NULL),
(22, NULL, NULL, NULL, 'Completed', '2026-11-13 15:53:35', '2026-11-13 15:59:19', 'INQ-0022', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY\"]', '[\"1\"]', '', 'jaystaff', '2026-11-13 23:53:49', 'BIRTDAY CELEBRATION', '2026-11-25', 'PARKLANE GENERAL TRIAS CAVITE', 'Buffet with setup', 2, NULL, NULL, 20, NULL, NULL),
(23, NULL, NULL, NULL, 'Completed', '2026-11-14 00:16:59', '2026-11-14 13:02:20', 'INQ-0023', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON', '[\"PORK BELLY\",\"PANCIT MALABON\"]', '[\"1\",\"2\"]', '', 'jaystaff', '2026-11-14 08:17:11', 'WEDDING ANNIV', '2026-11-16', 'TAGAYTAY CITY', 'Buffet with setup', 2, NULL, NULL, 30, NULL, NULL),
(24, NULL, NULL, NULL, 'Completed', '2026-11-14 08:46:45', '2026-11-14 08:58:59', 'INQ-0024', 3, 'jaycustomer', 'jaycustomer@example.com', '', '[\"PALABOK\"]', '[\"3\"]', '', 'jaystaff', '2026-11-14 16:46:57', 'NIEL BIRTDAY', '2026-11-16', 'parkalane', 'Delivery', 2, NULL, NULL, NULL, NULL, NULL),
(25, NULL, NULL, NULL, 'Declined', '2026-11-15 02:30:22', '2026-11-17 13:07:52', 'INQ-0025', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON', '[\"PALABOK\",\"PANCIT MALABON\"]', '[\"3\",\"2\"]', '', 'jaystaff', '2026-11-15 10:34:09', 'NIEL DEBU', '2026-11-19', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by Nov 16, 2026, so the inquiry was closed automatically.', NULL, NULL, NULL, NULL),
(26, NULL, NULL, NULL, 'Completed', '2026-11-15 03:10:46', '2026-11-15 03:14:12', 'INQ-0026', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"PALABOK\"]', '[\"1\",\"3\"]', '', 'jaystaff', '2026-11-15 11:11:04', 'shane bday', '2026-11-26', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(27, NULL, NULL, NULL, 'In Progress', '2026-11-15 03:26:31', '2026-11-15 03:26:44', 'INQ-0027', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"PALABOK\",\"PANCIT MALABON\"]', '[\"1\",\"3\",\"2\"]', '', 'jaystaff', '2026-11-15 11:26:44', 'test34', '2026-11-23', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(28, NULL, NULL, NULL, 'Declined', '2026-11-15 07:37:02', '2026-11-18 05:53:53', 'INQ-0028', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"PANCIT MALABON\"]', '[\"1\",\"2\"]', '', 'jaystaff', '2026-11-15 15:37:26', 'xample', '2026-11-18', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by Nov 16, 2026, so the inquiry was closed automatically.', NULL, NULL, NULL, NULL),
(29, NULL, NULL, NULL, 'Completed', '2026-11-15 15:12:01', '2026-11-15 15:14:11', 'INQ-0029', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-15 23:12:34', 'gab birthday', '2026-11-17', 'PARKLANE, PH.8 BLK.10 LOT.6', 'Buffet with setup', 2, NULL, NULL, 30, NULL, NULL),
(30, NULL, NULL, NULL, 'Completed', '2026-11-15 16:01:21', '2026-11-15 16:46:08', 'INQ-0030', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'nielstaff', '2026-11-16 00:46:08', 'NIEL WEDDING', '2026-11-20', 'GENTRI', 'Buffet with setup', 5, NULL, NULL, 30, NULL, NULL),
(31, NULL, NULL, NULL, 'In Progress', '2026-11-15 17:17:43', '2026-11-17 06:57:02', 'INQ-0031', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\"]', '[\"1\"]', '', 'jaystaff', '2026-11-16 01:17:57', 'try', '2026-11-18', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(32, NULL, NULL, NULL, 'Declined', '2026-11-16 04:16:50', '2026-11-17 13:38:18', 'INQ-0032', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-16 22:00:15', 'test67', '2026-11-25', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by Nov 22, 2026, so the inquiry was closed automatically.', NULL, NULL, NULL, NULL),
(33, NULL, NULL, NULL, 'Completed', '2026-11-16 06:13:43', '2026-11-16 06:15:00', 'INQ-0033', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON, BIHON GUISADO - LARGE (₱3,000.00)', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"PANCIT MALABON\",\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"1\",\"2\",\"4\"]', '', 'jaystaff', '2026-11-16 14:13:52', 'TEST5', '2026-11-18', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(34, NULL, NULL, NULL, 'In Progress', '2026-11-17 06:32:33', '2026-11-17 06:58:00', 'INQ-0034', 3, 'jaycustomer', 'jaycustomer@example.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-17 14:58:00', 'test3', '2026-11-27', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(35, NULL, NULL, NULL, 'Completed', '2026-11-17 08:40:22', '2026-11-17 08:43:10', 'INQ-0035', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"1\",\"4\"]', '', 'jaystaff', '2026-11-17 16:40:37', 'whayne debu', '2026-11-20', 'BACOOR CAVITE', 'Delivery', 2, NULL, NULL, NULL, NULL, NULL),
(36, NULL, NULL, NULL, 'Declined', '2026-11-17 12:08:09', '2026-11-17 13:38:18', 'INQ-0036', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-17 20:08:41', 'TESTING45', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by Nov 18, 2026, so the inquiry was closed automatically.', NULL, NULL, NULL, NULL),
(37, NULL, NULL, NULL, 'Completed', '2026-11-17 12:36:36', '2026-11-17 12:49:39', 'INQ-0037', 9, 'jayhans', 'estebanjayhans456@gmail.com', '', '[\"PALABOK\"]', '[\"3\"]', '', 'jaystaff', '2026-11-17 20:36:50', 'SYSTEM TEST', '2026-11-23', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(38, NULL, NULL, NULL, 'Completed', '2026-11-17 14:25:04', '2026-11-17 14:27:28', 'INQ-0038', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-17 22:25:19', 'test99', '2026-11-21', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, NULL),
(39, NULL, NULL, NULL, 'Completed', '2026-11-18 05:17:47', '2026-11-18 05:26:04', 'INQ-0039', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 13:18:46', 'SYSTEM TESTING JAY', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '09:00:00'),
(40, NULL, NULL, NULL, 'Completed', '2026-11-18 05:32:17', '2026-11-18 05:34:19', 'INQ-0040', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"1\",\"4\"]', '', 'jaystaff', '2026-11-18 13:32:28', 'SYSTEM TEST V2', '2026-11-23', 'NEW YORK BLK20, BROOKE STREET', 'Buffet with setup', 2, NULL, NULL, 30, NULL, '10:15:00'),
(41, NULL, NULL, NULL, 'Completed', '2026-11-18 05:52:43', '2026-11-18 06:00:12', 'INQ-0041', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 13:54:40', 'INBOX TESTING', '2026-11-21', 'ewtfwetewr', 'Delivery', 2, NULL, NULL, NULL, NULL, '09:45:00'),
(42, NULL, NULL, NULL, 'In Progress', '2026-11-18 10:59:12', '2026-11-18 11:00:15', 'INQ-0042', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 19:00:15', 'SYSTEM TEST NEW', '2026-11-21', 'SAN JOSE DASMA', 'Delivery', 2, NULL, NULL, NULL, NULL, '18:00:00'),
(43, NULL, NULL, NULL, 'In Progress', '2026-11-18 11:39:30', '2026-11-18 11:39:36', 'INQ-0043', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 19:39:36', 'xample', '2026-11-21', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '18:15:00'),
(44, NULL, NULL, NULL, 'In Progress', '2026-11-18 12:06:42', '2026-11-18 12:06:59', 'INQ-0044', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 20:06:59', 'SYSTEM TES 10', '2026-11-21', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '18:00:00'),
(45, NULL, NULL, NULL, 'Declined', '2026-11-18 12:08:02', '2026-11-19 06:07:07', 'INQ-0045', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 20:08:07', 'system test 20', '2026-11-21', 'PARKLANE GENTRI', 'Delivery', 2, 'The deposit was not paid by Nov 18, 2026, 9:30 PM, so the inquiry was closed automatically.', NULL, NULL, NULL, '18:00:00'),
(46, NULL, NULL, NULL, 'Completed', '2026-11-18 12:23:32', '2026-11-18 12:24:35', 'INQ-0046', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 20:23:41', 'testtttf', '2026-11-21', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '18:00:00'),
(47, NULL, NULL, NULL, 'Completed', '2026-11-18 12:32:01', '2026-11-18 12:45:49', 'INQ-0047', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"PALABOK\",\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"3\",\"4\"]', '', 'jaystaff', '2026-11-18 20:32:13', 'thsssssssssss', '2026-11-21', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '17:00:00'),
(48, NULL, NULL, NULL, 'In Progress', '2026-11-18 15:04:06', '2026-11-18 15:04:16', 'INQ-0048', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 23:04:16', 'TESTINGG', '2026-11-25', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '18:00:00'),
(49, NULL, NULL, NULL, 'In Progress', '2026-11-18 15:08:48', '2026-11-18 15:09:04', 'INQ-0049', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 23:09:04', 'QWEFFFFFFFF', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '10:30:00'),
(50, NULL, NULL, NULL, 'Completed', '2026-11-18 15:32:24', '2026-11-18 15:37:46', 'INQ-0050', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-18 23:32:40', 'NIEL WEDDING ANNIVERSARY', '2026-11-22', 'IMUS CAVITE', 'Buffet with setup', 2, NULL, NULL, 30, NULL, '18:15:00'),
(51, NULL, NULL, NULL, 'New Inquiry', '2026-11-18 16:08:54', '2026-11-18 16:08:54', 'INQ-0051', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', NULL, NULL, 'TEST', '2026-11-22', 'GENTRI', 'Buffet with setup', NULL, NULL, NULL, 50, NULL, '20:00:00'),
(52, NULL, NULL, NULL, 'In Progress', '2026-11-18 16:12:07', '2026-11-18 16:12:18', 'INQ-0052', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 00:12:18', '21333333333333', '2026-11-23', 'fwqeqwe', 'Buffet with setup', 2, NULL, NULL, 50, NULL, '09:45:00'),
(53, NULL, NULL, NULL, 'In Progress', '2026-11-18 16:19:04', '2026-11-18 16:19:19', 'INQ-0053', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 00:19:19', 'dwcedcewcedc', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '09:30:00'),
(54, NULL, NULL, NULL, 'New Inquiry', '2026-11-19 04:09:34', '2026-11-19 04:09:34', 'INQ-0054', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00) x2', '[\"PORK BELLY - 1\\/4 KG (₱300.00)\",\"BIHON GUISADO - LARGE (₱3,000.00) x2\"]', '[\"1\",\"4\"]', '', NULL, NULL, '3ffffffffffff', '2026-11-22', '3fffffffffffff42', 'Delivery', NULL, NULL, NULL, NULL, NULL, '17:15:00'),
(55, NULL, NULL, NULL, 'New Inquiry', '2026-11-19 04:11:38', '2026-11-19 04:11:38', 'INQ-0055', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00) x2', '[\"BIHON GUISADO - LARGE (₱3,000.00) x2\"]', '[\"4\"]', '', NULL, NULL, 'rwqfefefefefefefefefefefefefefefefefe', '2026-11-22', 'weqffffffffff', 'Buffet with setup', NULL, NULL, NULL, 50, NULL, '10:30:00'),
(56, NULL, NULL, NULL, 'Completed', '2026-11-19 04:15:26', '2026-11-19 04:56:30', 'INQ-0056', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00) x2', '[\"BIHON GUISADO - LARGE (₱3,000.00) x2\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 12:32:08', 'yoooooooot', '2026-11-22', 'ytooooooooo', 'Buffet with setup', 2, NULL, NULL, 50, NULL, '10:30:00'),
(57, NULL, NULL, NULL, 'Declined', '2026-11-19 06:09:41', '2026-11-19 10:33:12', 'INQ-0057', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - SMALL (₱2,500.00) x6', '[\"BIHON GUISADO - SMALL (₱2,500.00) x6\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 14:10:42', 'testing', '2026-11-25', 'parklane', 'Buffet with setup', 2, 'The deposit was not paid by Nov 19, 2026, 3:30 PM, so the inquiry was closed automatically.', NULL, 40, NULL, '19:15:00'),
(58, NULL, NULL, NULL, 'Declined', '2026-11-19 11:05:56', '2026-11-19 12:37:30', 'INQ-0058', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 19:06:18', 'SYSTEM TEST', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by today, Nov 19, 2026, 8:30 PM, so the inquiry was closed automatically.', NULL, NULL, NULL, '10:45:00'),
(59, NULL, NULL, NULL, 'Declined', '2026-11-19 11:20:59', '2026-11-19 12:37:30', 'INQ-0059', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - MEDIUM (₱2,800.00)', '[\"BIHON GUISADO - MEDIUM (₱2,800.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 19:21:11', 'testing', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by today, Nov 19, 2026, 8:30 PM, so the inquiry was closed automatically.', NULL, NULL, NULL, '09:30:00'),
(60, NULL, NULL, NULL, 'Declined', '2026-11-19 11:36:03', '2026-11-19 13:01:25', 'INQ-0060', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'PANCIT MALABON, BIHON GUISADO - LARGE (₱3,000.00)', '[\"PANCIT MALABON\",\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"2\",\"4\"]', '', 'jaystaff', '2026-11-19 19:36:10', 'TEST', '2026-11-22', 'Customer pickup', 'Customer Pickup', 2, 'The deposit was not paid by today, Nov 19, 2026, 9:00 PM, so the inquiry was closed automatically.', NULL, NULL, NULL, '10:15:00'),
(61, NULL, NULL, NULL, 'Quotation Sent', '2026-11-19 12:22:24', '2026-11-19 12:36:27', 'INQ-0061', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00)', '[\"BIHON GUISADO - LARGE (₱3,000.00)\"]', '[\"4\"]', '', 'jaystaff', '2026-11-19 20:23:03', 'testing', '2026-11-26', 'Customer pickup', 'Customer Pickup', 2, NULL, NULL, NULL, NULL, '19:00:00'),
(62, NULL, NULL, NULL, 'Completed', '2026-11-19 13:46:44', '2026-11-19 13:49:36', 'INQ-0062', 9, 'jayhans', 'estebanjayhans456@gmail.com', 'BIHON GUISADO - LARGE (₱3,000.00) x3', '[\"BIHON GUISADO - LARGE (₱3,000.00) x3\"]', '[\"4\"]', 'I HAVE ALLERGY ON SEA FOOD ON PALABOK', 'jaystaff', '2026-11-19 21:47:03', 'FINAL TESTING SYSTEM', '2026-11-23', 'PH.8 BLK.10 LOT6, PARKLANE COUNTRY HOMES, GENERAL TRIAS CAVITE', 'Buffet with setup', 2, NULL, NULL, 75, NULL, '10:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `legal_documents`
--

CREATE TABLE `legal_documents` (
  `id` int(10) UNSIGNED NOT NULL,
  `doc_type` enum('terms','privacy') NOT NULL,
  `version` int(10) UNSIGNED NOT NULL,
  `content` mediumtext NOT NULL,
  `change_note` varchar(255) DEFAULT NULL,
  `effective_date` date NOT NULL,
  `is_current` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `legal_documents`
--

INSERT INTO `legal_documents` (`id`, `doc_type`, `version`, `content`, `change_note`, `effective_date`, `is_current`, `created_by`, `created_at`) VALUES
(1, 'terms', 1, '<p>\r\n        These terms apply when you create an account or use the Customer Management System (the \"System\") of\r\n        <span class=\"fill\">[Company Name]</span> (\"we\", \"us\"), a catering business in the Philippines. By creating an\r\n        account you confirm that you have read and agree to these terms and to our <a href=\"#privacy\">Privacy Policy</a>.\r\n      </p>\r\n\r\n      <h3>1. Your account</h3>\r\n      <ul>\r\n        <li>Give us accurate details: your name, email address and a mobile number you can use. We verify the mobile number with a one-time code.</li>\r\n        <li>Keep your username and password private. You are responsible for what happens under your account. Tell us right away if you think someone else is using it.</li>\r\n        <li>We may suspend or close an account that is used to cheat, harass, or harm the System or other people.</li>\r\n        <li>For your safety, you are logged out automatically after 30 minutes without activity.</li>\r\n      </ul>\r\n\r\n      <h3>2. Inquiries and quotations</h3>\r\n      <ul>\r\n        <li>An inquiry is a request for a quotation. It is not a booking and does not reserve a date.</li>\r\n        <li>Our team replies in the System with a quotation. A quotation shows the items, the total price and the date it is valid until.</li>\r\n        <li>You can accept a quotation, decline it, or ask for changes before you pay the deposit. After a quotation expires you need to ask for a new one.</li>\r\n      </ul>\r\n\r\n      <h3>3. Bookings and payments</h3>\r\n      <ul>\r\n        <li>Your booking is confirmed once the deposit shown on the quotation is paid.</li>\r\n        <li>You can pay online through our payment partner, Xendit, using the methods it offers (for example GCash or Maya). Amounts are in Philippine pesos. We do not see or store your card or e-wallet login details.</li>\r\n        <li>We may ask you to pay the remaining balance by a due date. You will see the request in your messages and in My Bookings.</li>\r\n        <li>A booking counts as fully paid when the total on the quotation has been received.</li>\r\n      </ul>\r\n\r\n      <h3>4. Changes and cancellations</h3>\r\n      <ul>\r\n        <li>Please ask for any change to a quotation before you pay the deposit.</li>\r\n        <li>Once the deposit is paid, the booking is confirmed and <strong>cancellations are non-refundable</strong>.</li>\r\n        <li><span class=\"fill\">[Add your rules for date changes, guest count changes, and what happens if we have to cancel.]</span></li>\r\n      </ul>\r\n\r\n      <h3>5. Messages, files and feedback</h3>\r\n      <ul>\r\n        <li>You can message our team, attach files, open support tickets, and rate an event with comments and photos. Only upload things you have the right to share.</li>\r\n        <li>Do not send anything unlawful, abusive, or harmful. We may remove content that breaks this rule.</li>\r\n        <li>You allow us to use your feedback to improve our service.</li>\r\n      </ul>\r\n\r\n      <h3>6. Using the System</h3>\r\n      <p>Do not try to break into the System, test its security without our permission, overload it, copy it, or use it for anything other than dealing with us as a customer.</p>\r\n\r\n      <h3>7. Our responsibility</h3>\r\n      <p>\r\n        We work to keep the System available and accurate, but it may sometimes be down for maintenance or because of\r\n        problems outside our control. To the extent the law allows, we are not liable for losses caused by that.\r\n        Nothing in these terms removes rights you have under Philippine consumer law.\r\n      </p>\r\n\r\n      <h3>8. Changes to these terms</h3>\r\n      <p>We may update these terms. The date at the top shows the latest version. If you keep using the System after a change, you accept the new terms.</p>\r\n\r\n      <h3>9. Governing law and contact</h3>\r\n      <p>\r\n        These terms follow the laws of the Republic of the Philippines. Questions? Contact us at\r\n        <span class=\"fill\">[email address]</span> or <span class=\"fill\">[phone number]</span>.\r\n      </p>', 'Imported from terms.html', '2026-11-17', 1, NULL, '2026-11-20 13:47:36'),
(2, 'privacy', 1, '<p>\r\n        This policy explains what personal information <span class=\"fill\">[Company Name]</span> collects in the System,\r\n        why, and what your choices are. We follow the Data Privacy Act of 2012 (Republic Act No. 10173).\r\n      </p>\r\n\r\n      <h3>1. What we collect</h3>\r\n      <ul>\r\n        <li><strong>Account details:</strong> full name, email address, mobile number, username, and your password (stored only as a one-way hash, never as plain text). A profile photo if you add one.</li>\r\n        <li><strong>Inquiries and bookings:</strong> event name, date, venue or delivery address, service arrangement, number of guests, menu choices, notes, quotations, and booking status.</li>\r\n        <li><strong>Payments:</strong> amount, payment method, reference number and status. The payment itself is handled by Xendit, so we do not receive your card or e-wallet credentials.</li>\r\n        <li><strong>Messages and support:</strong> chat messages, attachments, support tickets, notifications, and your event feedback (rating, comments and photos).</li>\r\n        <li><strong>Technical data:</strong> the cookies described below.</li>\r\n      </ul>\r\n\r\n      <h3>2. Why we use it</h3>\r\n      <ul>\r\n        <li>To create and protect your account and confirm your mobile number.</li>\r\n        <li>To prepare quotations, manage your booking, take payments, and deliver your event.</li>\r\n        <li>To contact you about your inquiry, booking or payment, by chat, in-app notifications, SMS code, and email.</li>\r\n        <li>To give support, improve our service, keep records, and meet legal and tax obligations.</li>\r\n      </ul>\r\n\r\n      <h3>3. Who sees it</h3>\r\n      <ul>\r\n        <li><strong>Our staff,</strong> only as far as their job needs. Sales staff see the inquiries and bookings assigned to them. Managers and administrators can see all of them.</li>\r\n        <li><strong>Service providers</strong> that help us run the System: Xendit (payments), Google (sending email through the Gmail service), and our SMS provider (verification codes). They may only use your data to provide that service.</li>\r\n        <li>We do not sell your personal information. We share it with authorities only when the law requires it.</li>\r\n      </ul>\r\n\r\n      <h3>4. Cookies</h3>\r\n      <div class=\"table-wrap\">\r\n        <table>\r\n          <thead><tr><th>Cookie</th><th>Purpose</th><th>Kept for</th></tr></thead>\r\n          <tbody>\r\n            <tr><td>Session (PHPSESSID)</td><td>Strictly necessary. Keeps you logged in and protects forms and your account.</td><td>Until you close the browser, or 30 minutes without activity</td></tr>\r\n            <tr><td>cookie_consent</td><td>Strictly necessary. Remembers the choice you made in the Privacy Preference Center.</td><td>180 days</td></tr>\r\n            <tr><td>Functional</td><td>Optional. Remembers display preferences such as light or dark mode. Only used if you accept it.</td><td><span class=\"fill\">[period]</span></td></tr>\r\n          </tbody>\r\n        </table>\r\n      </div>\r\n      <p>You can change your choice at any time from the cookie settings, or by deleting the cookies in your browser. Blocking strictly necessary cookies will stop login from working.</p>\r\n\r\n      <h3>5. How we protect it</h3>\r\n      <p>\r\n        Passwords are hashed, sessions use protected cookies and end after 30 minutes of inactivity, and access depends on\r\n        the user\'s role. No system is perfectly secure, so please use a strong password and log out on shared devices.\r\n      </p>\r\n\r\n      <h3>6. How long we keep it</h3>\r\n      <p>\r\n        We keep your information while your account is active and for as long as needed for bookings, payments, tax and\r\n        legal records: <span class=\"fill\">[for example, up to X years after your last booking]</span>. After that we delete or anonymize it.\r\n      </p>\r\n\r\n      <h3>7. Your rights</h3>\r\n      <p>Under the Data Privacy Act you have the right to:</p>\r\n      <ul>\r\n        <li>be informed about how your data is used, and to access it;</li>\r\n        <li>correct information that is wrong or out of date;</li>\r\n        <li>object to processing, or ask us to block or delete your data (we may need to keep records that the law requires);</li>\r\n        <li>receive your data in a common format, where it applies;</li>\r\n        <li>be compensated for damages from inaccurate, unlawful or unauthorized use of your data, and to complain to the National Privacy Commission (privacy.gov.ph).</li>\r\n      </ul>\r\n      <p>\r\n        To use any of these rights, contact our Data Protection Officer: <span class=\"fill\">[name]</span>,\r\n        <span class=\"fill\">[email address]</span>.\r\n      </p>\r\n\r\n      <h3>8. Changes to this policy</h3>\r\n      <p>We will update the date above when this policy changes. For big changes we will also tell you in the System.</p>', 'Imported from terms.html', '2026-11-17', 0, NULL, '2026-11-20 13:47:36'),
(3, 'privacy', 2, '<p>\n        This policy explains what personal information Espinosilla Kainan collects in the System,\n        why, and what your choices are. We follow the Data Privacy Act of 2012 (Republic Act No. 10173).\n      </p>\n\n      <h3>1. What we collect</h3>\n      <ul>\n        <li><strong>Account details:</strong> full name, email address, mobile number, username, and your password (stored only as a one-way hash, never as plain text). A profile photo if you add one.</li>\n        <li><strong>Inquiries and bookings:</strong> event name, date, venue or delivery address, service arrangement, number of guests, menu choices, notes, quotations, and booking status.</li>\n        <li><strong>Payments:</strong> amount, payment method, reference number and status. The payment itself is handled by Xendit, so we do not receive your card or e-wallet credentials.</li>\n        <li><strong>Messages and support:</strong> chat messages, attachments, support tickets, notifications, and your event feedback (rating, comments and photos).</li>\n        <li><strong>Technical data:</strong> the cookies described below.</li>\n      </ul>\n\n      <h3>2. Why we use it</h3>\n      <ul>\n        <li>To create and protect your account and confirm your mobile number.</li>\n        <li>To prepare quotations, manage your booking, take payments, and deliver your event.</li>\n        <li>To contact you about your inquiry, booking or payment, by chat, in-app notifications, SMS code, and email.</li>\n        <li>To give support, improve our service, keep records, and meet legal and tax obligations.</li>\n      </ul>\n\n      <h3>3. Who sees it</h3>\n      <ul>\n        <li><strong>Our staff,</strong> only as far as their job needs. Sales staff see the inquiries and bookings assigned to them. Managers and administrators can see all of them.</li>\n        <li><strong>Service providers</strong> that help us run the System: Xendit (payments), Google (sending email through the Gmail service), and our SMS provider (verification codes). They may only use your data to provide that service.</li>\n        <li>We do not sell your personal information. We share it with authorities only when the law requires it.</li>\n      </ul>\n\n      <h3>4. Cookies</h3>\n      <div class=\"table-wrap\">\n        <table>\n          <thead><tr><th>Cookie</th><th>Purpose</th><th>Kept for</th></tr></thead>\n          <tbody>\n            <tr><td>Session (PHPSESSID)</td><td>Strictly necessary. Keeps you logged in and protects forms and your account.</td><td>Until you close the browser, or 30 minutes without activity</td></tr>\n            <tr><td>cookie_consent</td><td>Strictly necessary. Remembers the choice you made in the Privacy Preference Center.</td><td>180 days</td></tr>\n            <tr><td>Functional</td><td>Optional. Remembers display preferences such as light or dark mode. Only used if you accept it.</td><td><span class=\"fill\">[period]</span></td></tr>\n          </tbody>\n        </table>\n      </div>\n      <p>You can change your choice at any time from the cookie settings, or by deleting the cookies in your browser. Blocking strictly necessary cookies will stop login from working.</p>\n\n      <h3>5. How we protect it</h3>\n      <p>\n        Passwords are hashed, sessions use protected cookies and end after 30 minutes of inactivity, and access depends on\n        the user\'s role. No system is perfectly secure, so please use a strong password and log out on shared devices.\n      </p>\n\n      <h3>6. How long we keep it</h3>\n      <p>\n        We keep your information while your account is active and for as long as needed for bookings, payments, tax and\n        legal records: <span class=\"fill\">[for example, up to X years after your last booking]</span>. After that we delete or anonymize it.\n      </p>\n\n      <h3>7. Your rights</h3>\n      <p>Under the Data Privacy Act you have the right to:</p>\n      <ul>\n        <li>be informed about how your data is used, and to access it;</li>\n        <li>correct information that is wrong or out of date;</li>\n        <li>object to processing, or ask us to block or delete your data (we may need to keep records that the law requires);</li>\n        <li>receive your data in a common format, where it applies;</li>\n        <li>be compensated for damages from inaccurate, unlawful or unauthorized use of your data, and to complain to the National Privacy Commission (privacy.gov.ph).</li>\n      </ul>\n      <p>\n        To use any of these rights, contact our Data Protection Officer: <span class=\"fill\">[name]</span>,\n        <span class=\"fill\">[email address]</span>.\n      </p>\n\n      <h3>8. Changes to this policy</h3>\n      <p>We will update the date above when this policy changes. For big changes we will also tell you in the System.</p>', 'I update Company Name', '2026-11-20', 1, 6, '2026-11-20 13:56:23');

-- --------------------------------------------------------

--
-- Table structure for table `menu_items`
--

CREATE TABLE `menu_items` (
  `menu_item_id` int(11) NOT NULL,
  `item_name` varchar(150) NOT NULL,
  `category` varchar(40) NOT NULL,
  `display_price` varchar(80) NOT NULL,
  `serving_specs` varchar(255) NOT NULL,
  `photo_path` varchar(255) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `menu_items`
--

INSERT INTO `menu_items` (`menu_item_id`, `item_name`, `category`, `display_price`, `serving_specs`, `photo_path`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'PORK BELLY', 'Bilao', '₱1,800 – ₱2,300', '20–25 PAX', 'uploads/menu/e0d81db7433c19038d56cb7101d29de1.png', 1, '2026-11-11 22:05:31', '2026-11-11 22:05:31'),
(2, 'PANCIT MALABON', 'Catering Packages', '₱2,500 – ₱3,500', '20–30 PAX', 'uploads/menu/6d73af557a7b121e6c35ba89b3a07b8f.png', 4, '2026-11-14 08:15:57', '2026-11-14 08:15:57'),
(3, 'PALABOK', 'Bilao', '₱3,500 – ₱4,000', '20–25 PAX', 'uploads/menu/7aad736a771bcc1c83651dacaf21cf20.png', 4, '2026-11-14 13:46:08', '2026-11-14 13:46:08'),
(4, 'BIHON GUISADO', 'Catering Packages', '₱2,500 – ₱3,000', '20–25 PAX', 'uploads/menu/a6d2d297a977ef633d4f5b8e73a63e4d.jpg', 6, '2026-11-15 23:10:53', '2026-11-15 23:10:53');

-- --------------------------------------------------------

--
-- Table structure for table `menu_item_tiers`
--

CREATE TABLE `menu_item_tiers` (
  `tier_id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `tier_name` varchar(100) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pax_description` varchar(150) NOT NULL DEFAULT '',
  `sort_order` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `menu_item_tiers`
--

INSERT INTO `menu_item_tiers` (`tier_id`, `menu_item_id`, `tier_name`, `price`, `pax_description`, `sort_order`) VALUES
(1, 1, '1/4 KG', 300.00, 'Good for 2-3 PAX', 0),
(2, 4, 'LARGE', 3000.00, 'Good for 25 PAX', 0),
(3, 4, 'MEDIUM', 2800.00, 'Good for 23 PAX', 1),
(4, 4, 'SMALL', 2500.00, 'Good for 20 PAX', 2);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'ticket',
  `title` varchar(120) NOT NULL,
  `message` varchar(255) NOT NULL DEFAULT '',
  `page` varchar(80) NOT NULL DEFAULT '',
  `ref` varchar(60) NOT NULL DEFAULT '',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `page`, `ref`, `is_read`, `created_at`) VALUES
(1, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0025: NIEL DEBU', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:30:22'),
(2, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0025: NIEL DEBU', 'sales-available.html', 'INQ-0025', 1, '2026-11-15 10:30:22'),
(3, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0025: NIEL DEBU', 'manager-admin-inquiries.html', 'INQ-0025', 1, '2026-11-15 10:30:22'),
(4, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0025: NIEL DEBU', 'sales-available.html', 'INQ-0025', 0, '2026-11-15 10:30:22'),
(5, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0025: NIEL DEBU', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:30:22'),
(6, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for NIEL DEBU. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0025', 1, '2026-11-15 10:34:09'),
(7, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0025 (NIEL DEBU).', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:34:09'),
(8, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0025 (NIEL DEBU).', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:34:09'),
(9, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0025 (NIEL DEBU).', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:34:09'),
(10, 9, 'deal', 'Your quotation is ready', 'Your quotation for NIEL DEBU is ready (₱ 6,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0025', 1, '2026-11-15 10:35:13'),
(11, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL DEBU (INQ-0025): ₱ 6,000.00', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:35:13'),
(12, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL DEBU (INQ-0025): ₱ 6,000.00', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:35:13'),
(13, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL DEBU (INQ-0025): ₱ 6,000.00', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-15 10:35:13'),
(14, 9, 'customer', 'New message from our team', 'jaystaff sent you a message about .', 'customer-inbox.html', 'INQ-0025', 1, '2026-11-15 10:36:14'),
(15, 1, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:36:14'),
(16, 6, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:36:14'),
(17, 4, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:36:14'),
(18, 9, 'customer', 'New message from our team', 'jaystaff sent you a message about .', 'customer-inbox.html', 'INQ-0025', 1, '2026-11-15 10:40:04'),
(19, 1, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:04'),
(20, 6, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:04'),
(21, 4, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:04'),
(22, 9, 'customer', 'New message from our team', 'jaystaff sent you a message about .', 'customer-inbox.html', 'INQ-0025', 1, '2026-11-15 10:40:06'),
(23, 1, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:06'),
(24, 6, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:06'),
(25, 4, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:06'),
(26, 9, 'customer', 'New message from our team', 'jaystaff sent you a message about .', 'customer-inbox.html', 'INQ-0025', 1, '2026-11-15 10:40:09'),
(27, 1, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:09'),
(28, 6, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:09'),
(29, 4, 'customer', 'New message', 'jaystaff sent a message about .', 'inbox', 'INQ-0025', 0, '2026-11-15 10:40:09'),
(30, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0026: shane bday', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:10:46'),
(31, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0026: shane bday', 'sales-available.html', 'INQ-0026', 1, '2026-11-15 11:10:46'),
(32, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0026: shane bday', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:10:46'),
(33, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0026: shane bday', 'sales-available.html', 'INQ-0026', 0, '2026-11-15 11:10:46'),
(34, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0026: shane bday', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:10:46'),
(35, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for shane bday. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0026', 1, '2026-11-15 11:10:46'),
(36, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for shane bday. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0026', 1, '2026-11-15 11:11:04'),
(37, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0026 (shane bday).', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:11:04'),
(38, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0026 (shane bday).', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:11:04'),
(39, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0026 (shane bday).', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:11:04'),
(40, 9, 'deal', 'Your quotation is ready', 'Your quotation for shane bday is ready (₱ 3,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0026', 1, '2026-11-15 11:12:58'),
(41, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for shane bday (INQ-0026): ₱ 3,800.00', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:12:58'),
(42, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for shane bday (INQ-0026): ₱ 3,800.00', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:12:58'),
(43, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for shane bday (INQ-0026): ₱ 3,800.00', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:12:58'),
(44, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for shane bday.', 'sales-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:13:43'),
(45, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for shane bday.', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:13:43'),
(46, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for shane bday.', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:13:43'),
(47, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for shane bday.', 'manager-admin-inquiries.html', 'INQ-0026', 0, '2026-11-15 11:13:43'),
(48, 9, 'deal', 'Payment received', 'We received your ₱ 760.00 payment. Your booking for shane bday (BK-0020) is confirmed.', 'customer-bookings.html', 'BK-0020', 1, '2026-11-15 11:14:12'),
(49, 2, 'deal', 'Payment received - booking confirmed', '₱ 760.00 paid via GCash for shane bday. Booking BK-0020 is confirmed.', 'sales-bookings.html', 'BK-0020', 0, '2026-11-15 11:14:12'),
(50, 1, 'deal', 'Payment received - booking confirmed', '₱ 760.00 paid via GCash for shane bday. Booking BK-0020 is confirmed.', 'manager-admin-bookings.html', 'BK-0020', 0, '2026-11-15 11:14:12'),
(51, 6, 'deal', 'Payment received - booking confirmed', '₱ 760.00 paid via GCash for shane bday. Booking BK-0020 is confirmed.', 'manager-admin-bookings.html', 'BK-0020', 0, '2026-11-15 11:14:12'),
(52, 4, 'deal', 'Payment received - booking confirmed', '₱ 760.00 paid via GCash for shane bday. Booking BK-0020 is confirmed.', 'manager-admin-bookings.html', 'BK-0020', 0, '2026-11-15 11:14:12'),
(53, 1, 'ticket', 'New support ticket', 'jayhans submitted TCK-0004: FOOD', 'manager-admin-ticket.html', 'TCK-0004', 0, '2026-11-15 11:21:59'),
(54, 4, 'ticket', 'New support ticket', 'jayhans submitted TCK-0004: FOOD', 'manager-admin-ticket.html', 'TCK-0004', 0, '2026-11-15 11:21:59'),
(55, 6, 'ticket', 'New support ticket', 'jayhans submitted TCK-0004: FOOD', 'manager-admin-ticket.html', 'TCK-0004', 0, '2026-11-15 11:21:59'),
(56, 7, 'ticket', 'New support ticket', 'jayhans submitted TCK-0004: FOOD', 'manager-admin-ticket.html', 'TCK-0004', 1, '2026-11-15 11:21:59'),
(57, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0027: test34', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:31'),
(58, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0027: test34', 'sales-available.html', 'INQ-0027', 0, '2026-11-15 11:26:31'),
(59, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0027: test34', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:31'),
(60, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0027: test34', 'sales-available.html', 'INQ-0027', 0, '2026-11-15 11:26:31'),
(61, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0027: test34', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:31'),
(62, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for test34. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0027', 1, '2026-11-15 11:26:31'),
(63, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for test34. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0027', 1, '2026-11-15 11:26:44'),
(64, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0027 (test34).', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:44'),
(65, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0027 (test34).', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:44'),
(66, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0027 (test34).', 'manager-admin-inquiries.html', 'INQ-0027', 0, '2026-11-15 11:26:44'),
(67, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0028: xample', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:02'),
(68, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0028: xample', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:02'),
(69, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0028: xample', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:02'),
(70, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0028: xample', 'sales-available.html', 'INQ-0028', 0, '2026-11-15 15:37:02'),
(71, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0028: xample', 'sales-available.html', 'INQ-0028', 0, '2026-11-15 15:37:02'),
(72, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for xample. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0028', 1, '2026-11-15 15:37:02'),
(73, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for xample. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0028', 1, '2026-11-15 15:37:26'),
(74, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0028 (xample).', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:26'),
(75, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0028 (xample).', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:26'),
(76, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0028 (xample).', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-15 15:37:26'),
(77, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0029: gab birthday', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:01'),
(78, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0029: gab birthday', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:01'),
(79, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0029: gab birthday', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:01'),
(80, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0029: gab birthday', 'sales-available.html', 'INQ-0029', 0, '2026-11-15 23:12:01'),
(81, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0029: gab birthday', 'sales-available.html', 'INQ-0029', 0, '2026-11-15 23:12:01'),
(82, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for gab birthday. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0029', 1, '2026-11-15 23:12:01'),
(83, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for gab birthday. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0029', 1, '2026-11-15 23:12:34'),
(84, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0029 (gab birthday).', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:34'),
(85, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0029 (gab birthday).', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:34'),
(86, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0029 (gab birthday).', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:12:34'),
(87, 9, 'deal', 'Your quotation is ready', 'Your quotation for gab birthday is ready (₱ 4,300.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0029', 1, '2026-11-15 23:13:27'),
(88, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for gab birthday (INQ-0029): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:27'),
(89, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for gab birthday (INQ-0029): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:27'),
(90, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for gab birthday (INQ-0029): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:27'),
(91, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for gab birthday.', 'sales-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:53'),
(92, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for gab birthday.', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:53'),
(93, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for gab birthday.', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:53'),
(94, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for gab birthday.', 'manager-admin-inquiries.html', 'INQ-0029', 0, '2026-11-15 23:13:53'),
(95, 9, 'deal', 'Payment received', 'We received your ₱ 860.00 payment. Your booking for gab birthday (BK-0021) is confirmed.', 'customer-bookings.html', 'BK-0021', 1, '2026-11-15 23:14:11'),
(96, 2, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via GCash for gab birthday. Booking BK-0021 is confirmed.', 'sales-bookings.html', 'BK-0021', 0, '2026-11-15 23:14:11'),
(97, 1, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via GCash for gab birthday. Booking BK-0021 is confirmed.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-15 23:14:11'),
(98, 6, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via GCash for gab birthday. Booking BK-0021 is confirmed.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-15 23:14:11'),
(99, 4, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via GCash for gab birthday. Booking BK-0021 is confirmed.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-15 23:14:11'),
(100, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0030: NIEL WEDDING', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:01:21'),
(101, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0030: NIEL WEDDING', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:01:21'),
(102, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0030: NIEL WEDDING', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:01:21'),
(103, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0030: NIEL WEDDING', 'sales-available.html', 'INQ-0030', 0, '2026-11-16 00:01:21'),
(104, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0030: NIEL WEDDING', 'sales-available.html', 'INQ-0030', 0, '2026-11-16 00:01:21'),
(105, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for NIEL WEDDING. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0030', 1, '2026-11-16 00:01:21'),
(106, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for NIEL WEDDING. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0030', 1, '2026-11-16 00:02:33'),
(107, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0030 (NIEL WEDDING).', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:02:33'),
(108, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0030 (NIEL WEDDING).', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:02:33'),
(109, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0030 (NIEL WEDDING).', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:02:33'),
(110, 9, 'deal', 'Your quotation is ready', 'Your quotation for NIEL WEDDING is ready (₱ 4,300.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0030', 1, '2026-11-16 00:03:55'),
(111, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING (INQ-0030): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:03:55'),
(112, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING (INQ-0030): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:03:55'),
(113, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING (INQ-0030): ₱ 4,300.00', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:03:55'),
(114, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING.', 'sales-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:04:25'),
(115, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING.', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:04:25'),
(116, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING.', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:04:25'),
(117, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING.', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:04:25'),
(118, 9, 'deal', 'Payment received', 'We received your ₱ 860.00 payment. Your booking for NIEL WEDDING (BK-0022) is confirmed.', 'customer-bookings.html', 'BK-0022', 1, '2026-11-16 00:05:52'),
(119, 2, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via Maya for NIEL WEDDING. Booking BK-0022 is confirmed.', 'sales-bookings.html', 'BK-0022', 0, '2026-11-16 00:05:52'),
(120, 1, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via Maya for NIEL WEDDING. Booking BK-0022 is confirmed.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:05:52'),
(121, 6, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via Maya for NIEL WEDDING. Booking BK-0022 is confirmed.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:05:52'),
(122, 4, 'deal', 'Payment received - booking confirmed', '₱ 860.00 paid via Maya for NIEL WEDDING. Booking BK-0022 is confirmed.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:05:52'),
(123, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 3,440.00 for NIEL WEDDING on or before Nov 18, 2026.', 'customer-bookings.html', 'BK-0022', 1, '2026-11-16 00:07:03'),
(124, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for NIEL WEDDING (BK-0022), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:07:03'),
(125, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for NIEL WEDDING (BK-0022), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:07:03'),
(126, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for NIEL WEDDING (BK-0022), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:07:03'),
(127, 9, 'deal', 'Payment received', 'We received your ₱ 3,440.00 payment for NIEL WEDDING. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0022', 1, '2026-11-16 00:08:17'),
(128, 2, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via Maya for NIEL WEDDING (BK-0022). Fully paid.', 'sales-bookings.html', 'BK-0022', 0, '2026-11-16 00:08:17'),
(129, 1, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via Maya for NIEL WEDDING (BK-0022). Fully paid.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:08:17'),
(130, 6, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via Maya for NIEL WEDDING (BK-0022). Fully paid.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:08:17'),
(131, 4, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via Maya for NIEL WEDDING (BK-0022). Fully paid.', 'manager-admin-bookings.html', 'BK-0022', 0, '2026-11-16 00:08:17'),
(132, 2, 'customer', 'New customer message', 'jayhans sent a message about NIEL WEDDING.', 'inbox', 'INQ-0030', 0, '2026-11-16 00:09:18'),
(133, 1, 'customer', 'New customer message', 'jayhans sent a message about NIEL WEDDING.', 'inbox', 'INQ-0030', 0, '2026-11-16 00:09:18'),
(134, 6, 'customer', 'New customer message', 'jayhans sent a message about NIEL WEDDING.', 'inbox', 'INQ-0030', 0, '2026-11-16 00:09:18'),
(135, 4, 'customer', 'New customer message', 'jayhans sent a message about NIEL WEDDING.', 'inbox', 'INQ-0030', 0, '2026-11-16 00:09:18'),
(136, 1, 'ticket', 'New support ticket', 'jayhans submitted TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:04'),
(137, 6, 'ticket', 'New support ticket', 'jayhans submitted TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:04'),
(138, 7, 'ticket', 'New support ticket', 'jayhans submitted TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:04'),
(139, 4, 'ticket', 'New support ticket', 'jayhans submitted TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:04'),
(140, 9, 'ticket', 'Support replied to your ticket', 'Customer Service replied to TCK-0005: FOOD', 'customer-inbox.html', 'TCK-0005', 1, '2026-11-16 00:31:44'),
(141, 1, 'ticket', 'Support replied to a ticket', 'jaysupport replied to TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:44'),
(142, 6, 'ticket', 'Support replied to a ticket', 'jaysupport replied to TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:44'),
(143, 4, 'ticket', 'Support replied to a ticket', 'jaysupport replied to TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:31:44'),
(144, 1, 'ticket', 'New customer reply', 'jayhans replied on TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:29'),
(145, 6, 'ticket', 'New customer reply', 'jayhans replied on TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:29'),
(146, 7, 'ticket', 'New customer reply', 'jayhans replied on TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:29'),
(147, 4, 'ticket', 'New customer reply', 'jayhans replied on TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:29'),
(148, 9, 'ticket', 'Your ticket was resolved', 'TCK-0005 has been marked as resolved: FOOD', 'customer-inbox.html', 'TCK-0005', 1, '2026-11-16 00:32:47'),
(149, 1, 'ticket', 'Ticket resolved', 'jaysupport changed TCK-0005 to Resolved: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:47'),
(150, 6, 'ticket', 'Ticket resolved', 'jaysupport changed TCK-0005 to Resolved: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:47'),
(151, 4, 'ticket', 'Ticket resolved', 'jaysupport changed TCK-0005 to Resolved: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:32:47'),
(152, 1, 'ticket', 'Ticket reopened', 'jayhans reopened TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:33:09'),
(153, 6, 'ticket', 'Ticket reopened', 'jayhans reopened TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:33:09'),
(154, 7, 'ticket', 'Ticket reopened', 'jayhans reopened TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:33:09'),
(155, 4, 'ticket', 'Ticket reopened', 'jayhans reopened TCK-0005: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:33:09'),
(156, 5, 'lead', 'Inquiry assigned to you', 'jayadmin assigned INQ-0030 (NIEL WEDDING) to you.', 'sales-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:46:08'),
(157, 2, 'lead', 'Inquiry reassigned', 'INQ-0030 (NIEL WEDDING) was moved from you to nielstaff.', 'sales-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:46:08'),
(158, 9, 'lead', 'Your inquiry has a new contact', 'nielstaff is now handling your inquiry for NIEL WEDDING.', 'customer-inquiries.html', 'INQ-0030', 1, '2026-11-16 00:46:08'),
(159, 1, 'lead', 'Inquiry reassigned', 'jayadmin assigned INQ-0030 (NIEL WEDDING) to nielstaff (from jaystaff).', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:46:08'),
(160, 4, 'lead', 'Inquiry reassigned', 'jayadmin assigned INQ-0030 (NIEL WEDDING) to nielstaff (from jaystaff).', 'manager-admin-inquiries.html', 'INQ-0030', 0, '2026-11-16 00:46:08'),
(161, 9, 'ticket', 'Your ticket status was updated', 'TCK-0005 is now In Progress: FOOD', 'customer-inbox.html', 'TCK-0005', 1, '2026-11-16 00:54:06'),
(162, 1, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to In Progress: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:06'),
(163, 6, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to In Progress: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:06'),
(164, 4, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to In Progress: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:06'),
(165, 9, 'ticket', 'Your ticket status was updated', 'TCK-0005 is now Pending: FOOD', 'customer-inbox.html', 'TCK-0005', 1, '2026-11-16 00:54:11'),
(166, 1, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to Pending: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:11'),
(167, 6, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to Pending: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:11'),
(168, 4, 'ticket', 'Ticket status updated', 'jaysupport changed TCK-0005 to Pending: FOOD', 'manager-admin-ticket.html', 'TCK-0005', 0, '2026-11-16 00:54:11'),
(169, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0031: try', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:43'),
(170, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0031: try', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:43'),
(171, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0031: try', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:43'),
(172, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0031: try', 'sales-available.html', 'INQ-0031', 0, '2026-11-16 01:17:43'),
(173, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0031: try', 'sales-available.html', 'INQ-0031', 0, '2026-11-16 01:17:43'),
(174, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for try. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0031', 1, '2026-11-16 01:17:43'),
(175, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for try. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0031', 1, '2026-11-16 01:17:57'),
(176, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0031 (try).', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:57'),
(177, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0031 (try).', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:57'),
(178, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0031 (try).', 'manager-admin-inquiries.html', 'INQ-0031', 0, '2026-11-16 01:17:57'),
(179, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 3,440.00 for gab birthday on or before Nov 16, 2026.', 'customer-bookings.html', 'BK-0021', 1, '2026-11-16 11:24:23'),
(180, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for gab birthday (BK-0021), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 11:24:23'),
(181, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for gab birthday (BK-0021), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 11:24:23'),
(182, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,440.00 for gab birthday (BK-0021), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 11:24:23'),
(183, 1, 'ticket', 'New support ticket', 'jayhans submitted TCK-0006: Menu or package concern', 'manager-admin-ticket.html', 'TCK-0006', 0, '2026-11-16 12:06:00'),
(184, 6, 'ticket', 'New support ticket', 'jayhans submitted TCK-0006: Menu or package concern', 'manager-admin-ticket.html', 'TCK-0006', 0, '2026-11-16 12:06:00'),
(185, 7, 'ticket', 'New support ticket', 'jayhans submitted TCK-0006: Menu or package concern', 'manager-admin-ticket.html', 'TCK-0006', 0, '2026-11-16 12:06:00'),
(186, 4, 'ticket', 'New support ticket', 'jayhans submitted TCK-0006: Menu or package concern', 'manager-admin-ticket.html', 'TCK-0006', 0, '2026-11-16 12:06:00'),
(187, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0032: test67', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 12:16:50'),
(188, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0032: test67', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 12:16:50'),
(189, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0032: test67', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 12:16:50'),
(190, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0032: test67', 'sales-available.html', 'INQ-0032', 0, '2026-11-16 12:16:50'),
(191, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0032: test67', 'sales-available.html', 'INQ-0032', 0, '2026-11-16 12:16:50'),
(192, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for test67. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0032', 1, '2026-11-16 12:16:50'),
(193, 2, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'sales-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:49'),
(194, 1, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:49'),
(195, 6, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:49'),
(196, 4, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:49'),
(197, 2, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'sales-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:59'),
(198, 1, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:59'),
(199, 6, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:59'),
(200, 4, 'customer', 'New customer feedback', 'jayhans rated anniv22 (BK-0016) 4/5.', 'manager-admin-bookings.html', 'BK-0016', 0, '2026-11-16 12:56:59'),
(201, 2, 'customer', 'New customer feedback', 'jayhans rated BIRTDAYYYY (BK-0008) 5/5.', 'sales-bookings.html', 'BK-0008', 0, '2026-11-16 12:58:27'),
(202, 1, 'customer', 'New customer feedback', 'jayhans rated BIRTDAYYYY (BK-0008) 5/5.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-16 12:58:27'),
(203, 6, 'customer', 'New customer feedback', 'jayhans rated BIRTDAYYYY (BK-0008) 5/5.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-16 12:58:27'),
(204, 4, 'customer', 'New customer feedback', 'jayhans rated BIRTDAYYYY (BK-0008) 5/5.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-16 12:58:27'),
(205, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 600.00 for CELEBRATE on or before Nov 16, 2026.', 'customer-bookings.html', 'BK-0003', 1, '2026-11-16 13:43:55'),
(206, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 600.00 for CELEBRATE (BK-0003), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:43:55'),
(207, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 600.00 for CELEBRATE (BK-0003), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:43:55'),
(208, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 600.00 for CELEBRATE (BK-0003), due Nov 16, 2026.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:43:55'),
(209, 9, 'deal', 'Payment received', 'We received your ₱ 600.00 payment for CELEBRATE. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0003', 1, '2026-11-16 13:44:49'),
(210, 2, 'deal', 'Booking fully paid', '₱ 600.00 paid via GCash for CELEBRATE (BK-0003). Fully paid.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:49'),
(211, 1, 'deal', 'Booking fully paid', '₱ 600.00 paid via GCash for CELEBRATE (BK-0003). Fully paid.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:49'),
(212, 6, 'deal', 'Booking fully paid', '₱ 600.00 paid via GCash for CELEBRATE (BK-0003). Fully paid.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:49'),
(213, 4, 'deal', 'Booking fully paid', '₱ 600.00 paid via GCash for CELEBRATE (BK-0003). Fully paid.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:49'),
(214, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for CELEBRATE.', 'customer-bookings.html', 'BK-0003', 1, '2026-11-16 13:44:51'),
(215, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for CELEBRATE (BK-0003).', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:51'),
(216, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for CELEBRATE (BK-0003).', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:51'),
(217, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for CELEBRATE (BK-0003).', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:44:51'),
(218, 9, 'deal', 'Payment received', 'We received your ₱ 3,440.00 payment for gab birthday. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0021', 1, '2026-11-16 13:45:18'),
(219, 2, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via GCash for gab birthday (BK-0021). Fully paid.', 'sales-bookings.html', 'BK-0021', 0, '2026-11-16 13:45:18'),
(220, 1, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via GCash for gab birthday (BK-0021). Fully paid.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 13:45:18'),
(221, 6, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via GCash for gab birthday (BK-0021). Fully paid.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 13:45:18'),
(222, 4, 'deal', 'Booking fully paid', '₱ 3,440.00 paid via GCash for gab birthday (BK-0021). Fully paid.', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-16 13:45:18'),
(223, 2, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:41'),
(224, 1, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:41'),
(225, 6, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:41'),
(226, 4, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:41'),
(227, 2, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:43'),
(228, 1, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:43'),
(229, 6, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:43'),
(230, 4, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:43'),
(231, 2, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(232, 1, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(233, 6, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(234, 4, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(235, 2, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(236, 1, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(237, 6, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(238, 4, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:44'),
(239, 2, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'sales-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:45'),
(240, 1, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:45'),
(241, 6, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:45'),
(242, 4, 'customer', 'New customer feedback', 'jayhans rated CELEBRATE (BK-0003) 4/5.', 'manager-admin-bookings.html', 'BK-0003', 0, '2026-11-16 13:54:45'),
(243, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0033: TEST5', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:43'),
(244, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0033: TEST5', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:43'),
(245, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0033: TEST5', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:43'),
(246, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0033: TEST5', 'sales-available.html', 'INQ-0033', 0, '2026-11-16 14:13:43'),
(247, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0033: TEST5', 'sales-available.html', 'INQ-0033', 0, '2026-11-16 14:13:43'),
(248, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for TEST5. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0033', 1, '2026-11-16 14:13:43'),
(249, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for TEST5. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0033', 1, '2026-11-16 14:13:52'),
(250, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0033 (TEST5).', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:52'),
(251, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0033 (TEST5).', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:52'),
(252, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0033 (TEST5).', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:13:52'),
(253, 9, 'deal', 'Your quotation is ready', 'Your quotation for TEST5 is ready (₱ 5,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0033', 1, '2026-11-16 14:14:04'),
(254, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST5 (INQ-0033): ₱ 5,800.00', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:04'),
(255, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST5 (INQ-0033): ₱ 5,800.00', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:04'),
(256, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST5 (INQ-0033): ₱ 5,800.00', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:04'),
(257, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST5.', 'sales-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:47'),
(258, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST5.', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:47'),
(259, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST5.', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:47'),
(260, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST5.', 'manager-admin-inquiries.html', 'INQ-0033', 0, '2026-11-16 14:14:47'),
(261, 9, 'deal', 'Payment received', 'We received your ₱ 1,160.00 payment. Your booking for TEST5 (BK-0023) is confirmed.', 'customer-bookings.html', 'BK-0023', 1, '2026-11-16 14:15:00'),
(262, 2, 'deal', 'Payment received - booking confirmed', '₱ 1,160.00 paid via GCash for TEST5. Booking BK-0023 is confirmed.', 'sales-bookings.html', 'BK-0023', 0, '2026-11-16 14:15:00'),
(263, 1, 'deal', 'Payment received - booking confirmed', '₱ 1,160.00 paid via GCash for TEST5. Booking BK-0023 is confirmed.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-16 14:15:00'),
(264, 6, 'deal', 'Payment received - booking confirmed', '₱ 1,160.00 paid via GCash for TEST5. Booking BK-0023 is confirmed.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-16 14:15:00'),
(265, 4, 'deal', 'Payment received - booking confirmed', '₱ 1,160.00 paid via GCash for TEST5. Booking BK-0023 is confirmed.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-16 14:15:00'),
(266, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for test67. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0032', 1, '2026-11-16 22:00:15'),
(267, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0032 (test67).', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:15'),
(268, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0032 (test67).', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:15'),
(269, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0032 (test67).', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:15'),
(270, 9, 'deal', 'Your quotation is ready', 'Your quotation for test67 is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0032', 1, '2026-11-16 22:00:33'),
(271, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test67 (INQ-0032): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:33'),
(272, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test67 (INQ-0032): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:33'),
(273, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test67 (INQ-0032): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:33'),
(274, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test67.', 'sales-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:43'),
(275, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test67.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:43'),
(276, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test67.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:43'),
(277, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test67.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-16 22:00:43'),
(278, 3, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for NIEL BIRTDAY.', 'customer-bookings.html', 'BK-0018', 0, '2026-11-17 00:13:19'),
(279, 1, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for NIEL BIRTDAY (BK-0018).', 'manager-admin-bookings.html', 'BK-0018', 0, '2026-11-17 00:13:19'),
(280, 6, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for NIEL BIRTDAY (BK-0018).', 'manager-admin-bookings.html', 'BK-0018', 0, '2026-11-17 00:13:19'),
(281, 4, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for NIEL BIRTDAY (BK-0018).', 'manager-admin-bookings.html', 'BK-0018', 0, '2026-11-17 00:13:19'),
(282, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for WEDDING ANNIV.', 'customer-bookings.html', 'BK-0019', 1, '2026-11-17 00:13:19'),
(283, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for WEDDING ANNIV (BK-0019).', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 00:13:19'),
(284, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for WEDDING ANNIV (BK-0019).', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 00:13:19'),
(285, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for WEDDING ANNIV (BK-0019).', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 00:13:19'),
(286, 1, 'lead', 'New inquiry', 'jaycustomer submitted INQ-0034: test3', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(287, 6, 'lead', 'New inquiry', 'jaycustomer submitted INQ-0034: test3', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(288, 4, 'lead', 'New inquiry', 'jaycustomer submitted INQ-0034: test3', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(289, 2, 'lead', 'New inquiry', 'jaycustomer submitted INQ-0034: test3', 'sales-available.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(290, 5, 'lead', 'New inquiry', 'jaycustomer submitted INQ-0034: test3', 'sales-available.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(291, 3, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for test3. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:32:33'),
(292, 3, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for test3. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:58:00'),
(293, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0034 (test3).', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:58:00'),
(294, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0034 (test3).', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:58:00'),
(295, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0034 (test3).', 'manager-admin-inquiries.html', 'INQ-0034', 0, '2026-11-17 14:58:00'),
(296, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0035: whayne debu', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:22'),
(297, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0035: whayne debu', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:22'),
(298, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0035: whayne debu', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:22'),
(299, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0035: whayne debu', 'sales-available.html', 'INQ-0035', 0, '2026-11-17 16:40:22'),
(300, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0035: whayne debu', 'sales-available.html', 'INQ-0035', 0, '2026-11-17 16:40:22'),
(301, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for whayne debu. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0035', 1, '2026-11-17 16:40:22'),
(302, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for whayne debu. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0035', 1, '2026-11-17 16:40:37'),
(303, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0035 (whayne debu).', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:37'),
(304, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0035 (whayne debu).', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:37'),
(305, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0035 (whayne debu).', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:40:37'),
(306, 9, 'deal', 'Your quotation is ready', 'Your quotation for whayne debu is ready (₱ 3,750.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0035', 1, '2026-11-17 16:41:06'),
(307, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for whayne debu (INQ-0035): ₱ 3,750.00', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:41:06'),
(308, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for whayne debu (INQ-0035): ₱ 3,750.00', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:41:06'),
(309, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for whayne debu (INQ-0035): ₱ 3,750.00', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:41:06'),
(310, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for whayne debu.', 'sales-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:42:28'),
(311, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for whayne debu.', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:42:28'),
(312, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for whayne debu.', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:42:28');
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `page`, `ref`, `is_read`, `created_at`) VALUES
(313, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for whayne debu.', 'manager-admin-inquiries.html', 'INQ-0035', 0, '2026-11-17 16:42:28'),
(314, 9, 'deal', 'Payment received', 'We received your ₱ 750.00 payment. Your booking for whayne debu (BK-0024) is confirmed.', 'customer-bookings.html', 'BK-0024', 1, '2026-11-17 16:43:10'),
(315, 2, 'deal', 'Payment received - booking confirmed', '₱ 750.00 paid via GCash for whayne debu. Booking BK-0024 is confirmed.', 'sales-bookings.html', 'BK-0024', 0, '2026-11-17 16:43:10'),
(316, 1, 'deal', 'Payment received - booking confirmed', '₱ 750.00 paid via GCash for whayne debu. Booking BK-0024 is confirmed.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:43:10'),
(317, 6, 'deal', 'Payment received - booking confirmed', '₱ 750.00 paid via GCash for whayne debu. Booking BK-0024 is confirmed.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:43:10'),
(318, 4, 'deal', 'Payment received - booking confirmed', '₱ 750.00 paid via GCash for whayne debu. Booking BK-0024 is confirmed.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:43:10'),
(319, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 3,000.00 for whayne debu on or before Nov 17, 2026.', 'customer-bookings.html', 'BK-0024', 1, '2026-11-17 16:44:39'),
(320, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,000.00 for whayne debu (BK-0024), due Nov 17, 2026.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:44:39'),
(321, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,000.00 for whayne debu (BK-0024), due Nov 17, 2026.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:44:39'),
(322, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,000.00 for whayne debu (BK-0024), due Nov 17, 2026.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:44:39'),
(323, 9, 'deal', 'Payment received', 'We received your ₱ 3,000.00 payment for whayne debu. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0024', 1, '2026-11-17 16:45:01'),
(324, 2, 'deal', 'Booking fully paid', '₱ 3,000.00 paid via GCash for whayne debu (BK-0024). Fully paid.', 'sales-bookings.html', 'BK-0024', 0, '2026-11-17 16:45:01'),
(325, 1, 'deal', 'Booking fully paid', '₱ 3,000.00 paid via GCash for whayne debu (BK-0024). Fully paid.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:45:01'),
(326, 6, 'deal', 'Booking fully paid', '₱ 3,000.00 paid via GCash for whayne debu (BK-0024). Fully paid.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:45:01'),
(327, 4, 'deal', 'Booking fully paid', '₱ 3,000.00 paid via GCash for whayne debu (BK-0024). Fully paid.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-17 16:45:01'),
(328, 2, 'customer', 'New customer feedback', 'jayhans rated WEDDING ANNIV (BK-0019) 5/5.', 'sales-bookings.html', 'BK-0019', 0, '2026-11-17 16:46:52'),
(329, 1, 'customer', 'New customer feedback', 'jayhans rated WEDDING ANNIV (BK-0019) 5/5.', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 16:46:52'),
(330, 6, 'customer', 'New customer feedback', 'jayhans rated WEDDING ANNIV (BK-0019) 5/5.', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 16:46:52'),
(331, 4, 'customer', 'New customer feedback', 'jayhans rated WEDDING ANNIV (BK-0019) 5/5.', 'manager-admin-bookings.html', 'BK-0019', 0, '2026-11-17 16:46:52'),
(332, 3, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for Anniversary.', 'customer-bookings.html', 'BK-0002', 0, '2026-11-17 19:45:00'),
(333, 1, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for Anniversary (BK-0002).', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-17 19:45:00'),
(334, 6, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for Anniversary (BK-0002).', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-17 19:45:00'),
(335, 4, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for Anniversary (BK-0002).', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-17 19:45:00'),
(336, 10, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for testjay.', 'customer-bookings.html', 'BK-0013', 0, '2026-11-17 19:45:00'),
(337, 1, 'deal', 'Feedback requested', 'Feedback requested from jaytest for testjay (BK-0013).', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-17 19:45:00'),
(338, 6, 'deal', 'Feedback requested', 'Feedback requested from jaytest for testjay (BK-0013).', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-17 19:45:00'),
(339, 4, 'deal', 'Feedback requested', 'Feedback requested from jaytest for testjay (BK-0013).', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-17 19:45:00'),
(340, 3, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for testtt8.', 'customer-bookings.html', 'BK-0014', 0, '2026-11-17 19:45:00'),
(341, 1, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for testtt8 (BK-0014).', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-17 19:45:00'),
(342, 6, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for testtt8 (BK-0014).', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-17 19:45:00'),
(343, 4, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for testtt8 (BK-0014).', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-17 19:45:00'),
(344, 3, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for BIRTDAY.', 'customer-bookings.html', 'BK-0015', 0, '2026-11-17 19:45:00'),
(345, 1, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for BIRTDAY (BK-0015).', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-17 19:45:00'),
(346, 6, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for BIRTDAY (BK-0015).', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-17 19:45:00'),
(347, 4, 'deal', 'Feedback requested', 'Feedback requested from jaycustomer for BIRTDAY (BK-0015).', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-17 19:45:00'),
(348, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0036: TESTING45', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:09'),
(349, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0036: TESTING45', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:09'),
(350, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0036: TESTING45', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:09'),
(351, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0036: TESTING45', 'sales-available.html', 'INQ-0036', 0, '2026-11-17 20:08:09'),
(352, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0036: TESTING45', 'sales-available.html', 'INQ-0036', 0, '2026-11-17 20:08:09'),
(353, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for TESTING45. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 20:08:09'),
(354, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for TESTING45. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 20:08:41'),
(355, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0036 (TESTING45).', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:41'),
(356, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0036 (TESTING45).', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:41'),
(357, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0036 (TESTING45).', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:08:41'),
(358, 9, 'deal', 'Your quotation is ready', 'Your quotation for TESTING45 is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 20:26:40'),
(359, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TESTING45 (INQ-0036): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:26:40'),
(360, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TESTING45 (INQ-0036): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:26:40'),
(361, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TESTING45 (INQ-0036): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 20:26:40'),
(362, 9, 'lead', 'Deposit due in 2 days', 'Please pay the ₱ 600.00 deposit for TESTING45 by Nov 19, 2026.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 20:26:51'),
(363, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0037: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:36'),
(364, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0037: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:36'),
(365, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0037: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:36'),
(366, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0037: SYSTEM TEST', 'sales-available.html', 'INQ-0037', 0, '2026-11-17 20:36:36'),
(367, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0037: SYSTEM TEST', 'sales-available.html', 'INQ-0037', 0, '2026-11-17 20:36:36'),
(368, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TEST. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0037', 1, '2026-11-17 20:36:36'),
(369, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TEST. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0037', 1, '2026-11-17 20:36:51'),
(370, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0037 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:51'),
(371, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0037 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:51'),
(372, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0037 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:36:51'),
(373, 9, 'deal', 'Your quotation is ready', 'Your quotation for SYSTEM TEST is ready (₱ 3,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0037', 1, '2026-11-17 20:38:09'),
(374, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0037): ₱ 3,500.00', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:09'),
(375, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0037): ₱ 3,500.00', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:09'),
(376, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0037): ₱ 3,500.00', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:09'),
(377, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'sales-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:34'),
(378, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:34'),
(379, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:34'),
(380, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0037', 0, '2026-11-17 20:38:34'),
(381, 9, 'lead', 'Deposit due tomorrow', 'Please pay the ₱ 600.00 deposit for TESTING45 by Nov 18, 2026.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 20:47:31'),
(382, 9, 'lead', 'Deposit due in 2 days', 'Please pay the ₱ 700.00 deposit for SYSTEM TEST by Nov 19, 2026.', 'customer-inquiries.html', 'INQ-0037', 1, '2026-11-17 20:47:31'),
(383, 9, 'deal', 'Payment received', 'We received your ₱ 700.00 payment. Your booking for SYSTEM TEST (BK-0025) is confirmed.', 'customer-bookings.html', 'BK-0025', 1, '2026-11-17 20:49:39'),
(384, 2, 'deal', 'Payment received - booking confirmed', '₱ 700.00 paid via GCash for SYSTEM TEST. Booking BK-0025 is confirmed.', 'sales-bookings.html', 'BK-0025', 0, '2026-11-17 20:49:39'),
(385, 1, 'deal', 'Payment received - booking confirmed', '₱ 700.00 paid via GCash for SYSTEM TEST. Booking BK-0025 is confirmed.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:49:39'),
(386, 6, 'deal', 'Payment received - booking confirmed', '₱ 700.00 paid via GCash for SYSTEM TEST. Booking BK-0025 is confirmed.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:49:39'),
(387, 4, 'deal', 'Payment received - booking confirmed', '₱ 700.00 paid via GCash for SYSTEM TEST. Booking BK-0025 is confirmed.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:49:39'),
(388, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,800.00 for SYSTEM TEST on or before Nov 21, 2026.', 'customer-bookings.html', 'BK-0025', 1, '2026-11-17 20:52:52'),
(389, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,800.00 for SYSTEM TEST (BK-0025), due Nov 21, 2026.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:52:52'),
(390, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,800.00 for SYSTEM TEST (BK-0025), due Nov 21, 2026.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:52:52'),
(391, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,800.00 for SYSTEM TEST (BK-0025), due Nov 21, 2026.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 20:52:52'),
(392, 3, 'lead', 'Deposit due today', 'Please pay the ₱ 132.00 deposit for DEBU by Nov 17, 2026.', 'customer-inquiries.html', 'INQ-0002', 0, '2026-11-17 21:07:52'),
(393, 3, 'lead', 'Deposit due in 6 days', 'Please pay the ₱ 1,604.00 deposit for birtday father by Nov 23, 2026.', 'customer-inquiries.html', 'INQ-0005', 0, '2026-11-17 21:07:52'),
(394, 3, 'lead', 'Deposit due in 7 days', 'Please pay the ₱ 115.00 deposit for ahqsh1w by Nov 24, 2026.', 'customer-inquiries.html', 'INQ-0006', 0, '2026-11-17 21:07:52'),
(395, 2, 'lead', 'Inquiry closed: deposit not paid', 'NIEL DEBU (INQ-0025) was closed because the deposit was not paid by Nov 16, 2026.', 'sales-inquiries.html', 'INQ-0025', 0, '2026-11-17 21:07:52'),
(396, 1, 'lead', 'Inquiry closed: deposit not paid', 'NIEL DEBU (INQ-0025) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-17 21:07:52'),
(397, 6, 'lead', 'Inquiry closed: deposit not paid', 'NIEL DEBU (INQ-0025) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-17 21:07:52'),
(398, 4, 'lead', 'Inquiry closed: deposit not paid', 'NIEL DEBU (INQ-0025) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0025', 0, '2026-11-17 21:07:52'),
(399, 3, 'deal', 'Booking cancelled', 'Your booking for wedding was cancelled because the balance of ₱ 3,200.00 was not paid by Nov 16, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0001', 0, '2026-11-17 21:07:52'),
(400, 2, 'deal', 'Booking cancelled: unpaid balance', 'jaycustomer did not pay ₱ 3,200.00 for wedding (BK-0001) by Nov 16, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0001', 0, '2026-11-17 21:07:52'),
(401, 1, 'deal', 'Booking cancelled: unpaid balance', 'jaycustomer did not pay ₱ 3,200.00 for wedding (BK-0001) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0001', 0, '2026-11-17 21:07:52'),
(402, 6, 'deal', 'Booking cancelled: unpaid balance', 'jaycustomer did not pay ₱ 3,200.00 for wedding (BK-0001) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0001', 0, '2026-11-17 21:07:52'),
(403, 4, 'deal', 'Booking cancelled: unpaid balance', 'jaycustomer did not pay ₱ 3,200.00 for wedding (BK-0001) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0001', 0, '2026-11-17 21:07:52'),
(404, 9, 'deal', 'Balance due in 9 days', 'Please pay the remaining ₱ 960.00 for trip by Nov 26, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0004', 1, '2026-11-17 21:07:52'),
(405, 9, 'deal', 'Balance due today', 'Please pay the remaining ₱ 3,577.60 for rtewrt by Nov 17, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0005', 1, '2026-11-17 21:07:52'),
(406, 9, 'deal', 'Booking cancelled', 'Your booking for BIRTDAY was cancelled because the balance of ₱ 4,000.00 was not paid by Nov 16, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0006', 1, '2026-11-17 21:07:52'),
(407, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,000.00 for BIRTDAY (BK-0006) by Nov 16, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0006', 0, '2026-11-17 21:07:52'),
(408, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,000.00 for BIRTDAY (BK-0006) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0006', 0, '2026-11-17 21:07:52'),
(409, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,000.00 for BIRTDAY (BK-0006) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0006', 0, '2026-11-17 21:07:52'),
(410, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,000.00 for BIRTDAY (BK-0006) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0006', 0, '2026-11-17 21:07:52'),
(411, 9, 'deal', 'Booking cancelled', 'Your booking for BWHGEU3TWQR was cancelled because the balance of ₱ 6,240.00 was not paid by Nov 16, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0007', 1, '2026-11-17 21:07:52'),
(412, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 6,240.00 for BWHGEU3TWQR (BK-0007) by Nov 16, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0007', 0, '2026-11-17 21:07:52'),
(413, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 6,240.00 for BWHGEU3TWQR (BK-0007) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0007', 0, '2026-11-17 21:07:52'),
(414, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 6,240.00 for BWHGEU3TWQR (BK-0007) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0007', 0, '2026-11-17 21:07:52'),
(415, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 6,240.00 for BWHGEU3TWQR (BK-0007) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0007', 0, '2026-11-17 21:07:52'),
(416, 9, 'deal', 'Booking cancelled', 'Your booking for debuuuuu was cancelled because the balance of ₱ 1,600.00 was not paid by Nov 16, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0009', 1, '2026-11-17 21:07:52'),
(417, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 1,600.00 for debuuuuu (BK-0009) by Nov 16, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0009', 0, '2026-11-17 21:07:52'),
(418, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 1,600.00 for debuuuuu (BK-0009) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0009', 0, '2026-11-17 21:07:52'),
(419, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 1,600.00 for debuuuuu (BK-0009) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0009', 0, '2026-11-17 21:07:52'),
(420, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 1,600.00 for debuuuuu (BK-0009) by Nov 16, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0009', 0, '2026-11-17 21:07:52'),
(421, 9, 'deal', 'Balance due in 9 days', 'Please pay the remaining ₱ 4,000.00 for testing by Nov 26, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0010', 1, '2026-11-17 21:07:52'),
(422, 9, 'deal', 'Balance due today', 'Please pay the remaining ₱ 2,423.20 for tesing3 by Nov 17, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0011', 1, '2026-11-17 21:07:52'),
(423, 9, 'deal', 'Balance due in 4 days', 'Please pay the remaining ₱ 2,240.00 for test4 by Nov 21, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0012', 1, '2026-11-17 21:07:52'),
(424, 9, 'deal', 'Balance due in 8 days', 'Please pay the remaining ₱ 3,040.00 for shane bday by Nov 25, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0020', 1, '2026-11-17 21:07:52'),
(425, 9, 'deal', 'Balance due today', 'Please pay the remaining ₱ 4,640.00 for TEST5 by Nov 17, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0023', 1, '2026-11-17 21:07:52'),
(426, 9, 'deal', 'Balance due in 5 days', 'Please pay the remaining ₱ 2,800.00 for SYSTEM TEST by Nov 22, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0025', 1, '2026-11-17 21:07:52'),
(427, 9, 'lead', 'Deposit due tomorrow', 'Please pay the ₱ 600.00 deposit for TESTING45 by Nov 18, 2026.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 21:27:22'),
(428, 9, 'lead', 'Deposit due tomorrow', 'Please pay the ₱ 600.00 deposit for TESTING45 by Nov 18, 2026.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 21:27:56'),
(429, 9, 'lead', 'Deposit due in 5 days', 'Please pay the ₱ 600.00 deposit for test67 by Nov 22, 2026.', 'customer-inquiries.html', 'INQ-0032', 1, '2026-11-17 21:30:26'),
(430, 9, 'lead', 'Deposit due tomorrow', 'Please pay the ₱ 600.00 deposit for TESTING45 by Nov 18, 2026.', 'customer-inquiries.html', 'INQ-0036', 1, '2026-11-17 21:30:26'),
(431, 9, 'deal', 'Balance due in 8 days', 'Please pay the remaining ₱ 3,040.00 for shane bday by Nov 25, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0020', 1, '2026-11-17 21:30:26'),
(432, 9, 'deal', 'Balance due today', 'Please pay the remaining ₱ 4,640.00 for TEST5 by Nov 17, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0023', 1, '2026-11-17 21:30:26'),
(433, 9, 'deal', 'Balance due in 4 days', 'Please pay the remaining ₱ 2,800.00 for SYSTEM TEST by Nov 21, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0025', 1, '2026-11-17 21:30:26'),
(434, 2, 'lead', 'Inquiry closed: deposit not paid', 'test67 (INQ-0032) was closed because the deposit was not paid by Nov 22, 2026.', 'sales-inquiries.html', 'INQ-0032', 0, '2026-11-17 21:38:18'),
(435, 1, 'lead', 'Inquiry closed: deposit not paid', 'test67 (INQ-0032) was closed because the deposit was not paid by Nov 22, 2026.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-17 21:38:18'),
(436, 6, 'lead', 'Inquiry closed: deposit not paid', 'test67 (INQ-0032) was closed because the deposit was not paid by Nov 22, 2026.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-17 21:38:18'),
(437, 4, 'lead', 'Inquiry closed: deposit not paid', 'test67 (INQ-0032) was closed because the deposit was not paid by Nov 22, 2026.', 'manager-admin-inquiries.html', 'INQ-0032', 0, '2026-11-17 21:38:18'),
(438, 2, 'lead', 'Inquiry closed: deposit not paid', 'TESTING45 (INQ-0036) was closed because the deposit was not paid by Nov 18, 2026.', 'sales-inquiries.html', 'INQ-0036', 0, '2026-11-17 21:38:18'),
(439, 1, 'lead', 'Inquiry closed: deposit not paid', 'TESTING45 (INQ-0036) was closed because the deposit was not paid by Nov 18, 2026.', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 21:38:18'),
(440, 6, 'lead', 'Inquiry closed: deposit not paid', 'TESTING45 (INQ-0036) was closed because the deposit was not paid by Nov 18, 2026.', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 21:38:18'),
(441, 4, 'lead', 'Inquiry closed: deposit not paid', 'TESTING45 (INQ-0036) was closed because the deposit was not paid by Nov 18, 2026.', 'manager-admin-inquiries.html', 'INQ-0036', 0, '2026-11-17 21:38:18'),
(442, 9, 'deal', 'Booking cancelled', 'Your booking for TEST5 was cancelled because the balance of ₱ 4,640.00 was not paid by Nov 17, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0023', 1, '2026-11-17 21:38:18'),
(443, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,640.00 for TEST5 (BK-0023) by Nov 17, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0023', 0, '2026-11-17 21:38:18'),
(444, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,640.00 for TEST5 (BK-0023) by Nov 17, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-17 21:38:18'),
(445, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,640.00 for TEST5 (BK-0023) by Nov 17, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-17 21:38:18'),
(446, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 4,640.00 for TEST5 (BK-0023) by Nov 17, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0023', 0, '2026-11-17 21:38:18'),
(447, 9, 'deal', 'Booking cancelled', 'Your booking for SYSTEM TEST was cancelled because the balance of ₱ 2,800.00 was not paid by Nov 22, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0025', 1, '2026-11-17 21:38:18'),
(448, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,800.00 for SYSTEM TEST (BK-0025) by Nov 22, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0025', 0, '2026-11-17 21:38:18'),
(449, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,800.00 for SYSTEM TEST (BK-0025) by Nov 22, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 21:38:18'),
(450, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,800.00 for SYSTEM TEST (BK-0025) by Nov 22, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 21:38:18'),
(451, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,800.00 for SYSTEM TEST (BK-0025) by Nov 22, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0025', 0, '2026-11-17 21:38:18'),
(452, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0038: test99', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:04'),
(453, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0038: test99', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:04'),
(454, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0038: test99', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:04'),
(455, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0038: test99', 'sales-available.html', 'INQ-0038', 0, '2026-11-17 22:25:04'),
(456, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0038: test99', 'sales-available.html', 'INQ-0038', 0, '2026-11-17 22:25:04'),
(457, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for test99. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0038', 1, '2026-11-17 22:25:04'),
(458, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for test99. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0038', 1, '2026-11-17 22:25:19'),
(459, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0038 (test99).', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:19'),
(460, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0038 (test99).', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:19'),
(461, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0038 (test99).', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:25:19'),
(462, 9, 'deal', 'Your quotation is ready', 'Your quotation for test99 is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0038', 1, '2026-11-17 22:26:05'),
(463, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test99 (INQ-0038): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:05'),
(464, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test99 (INQ-0038): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:05'),
(465, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for test99 (INQ-0038): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:05'),
(466, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test99.', 'sales-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:43'),
(467, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test99.', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:43'),
(468, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test99.', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:43'),
(469, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for test99.', 'manager-admin-inquiries.html', 'INQ-0038', 0, '2026-11-17 22:26:43'),
(470, 9, 'deal', 'Payment received', 'We received your ₱ 600.00 payment. Your booking for test99 (BK-0026) is confirmed.', 'customer-bookings.html', 'BK-0026', 1, '2026-11-17 22:27:28'),
(471, 2, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for test99. Booking BK-0026 is confirmed.', 'sales-bookings.html', 'BK-0026', 0, '2026-11-17 22:27:28'),
(472, 1, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for test99. Booking BK-0026 is confirmed.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:27:28'),
(473, 6, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for test99. Booking BK-0026 is confirmed.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:27:28'),
(474, 4, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for test99. Booking BK-0026 is confirmed.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:27:28'),
(475, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,400.00 for test99 on or before Nov 19, 2026.', 'customer-bookings.html', 'BK-0026', 1, '2026-11-17 22:28:24'),
(476, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for test99 (BK-0026), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:28:24'),
(477, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for test99 (BK-0026), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:28:24'),
(478, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for test99 (BK-0026), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:28:24'),
(479, 9, 'deal', 'Payment received', 'We received your ₱ 2,400.00 payment for test99. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0026', 1, '2026-11-17 22:29:51'),
(480, 2, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for test99 (BK-0026). Fully paid.', 'sales-bookings.html', 'BK-0026', 0, '2026-11-17 22:29:51'),
(481, 1, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for test99 (BK-0026). Fully paid.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:29:51'),
(482, 6, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for test99 (BK-0026). Fully paid.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:29:51'),
(483, 4, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for test99 (BK-0026). Fully paid.', 'manager-admin-bookings.html', 'BK-0026', 0, '2026-11-17 22:29:51'),
(484, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for gab birthday.', 'customer-bookings.html', 'BK-0021', 1, '2026-11-18 10:24:08'),
(485, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for gab birthday (BK-0021).', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-18 10:24:08'),
(486, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for gab birthday (BK-0021).', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-18 10:24:08'),
(487, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for gab birthday (BK-0021).', 'manager-admin-bookings.html', 'BK-0021', 0, '2026-11-18 10:24:08'),
(488, 9, 'deal', 'Payment received', 'We received your ₱ 3,577.60 payment for rtewrt. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0005', 1, '2026-11-18 10:25:10'),
(489, 2, 'deal', 'Booking fully paid', '₱ 3,577.60 paid via GCash for rtewrt (BK-0005). Fully paid.', 'sales-bookings.html', 'BK-0005', 0, '2026-11-18 10:25:10'),
(490, 1, 'deal', 'Booking fully paid', '₱ 3,577.60 paid via GCash for rtewrt (BK-0005). Fully paid.', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:25:10'),
(491, 6, 'deal', 'Booking fully paid', '₱ 3,577.60 paid via GCash for rtewrt (BK-0005). Fully paid.', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:25:10'),
(492, 4, 'deal', 'Booking fully paid', '₱ 3,577.60 paid via GCash for rtewrt (BK-0005). Fully paid.', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:25:10'),
(493, 9, 'deal', 'We are preparing your food', 'We started preparing the food for rtewrt.', 'customer-bookings.html', 'BK-0005', 1, '2026-11-18 10:26:05'),
(494, 9, 'deal', 'Your order is ready for pickup', 'Your order for rtewrt is ready for pickup.', 'customer-bookings.html', 'BK-0005', 1, '2026-11-18 10:26:14'),
(495, 9, 'deal', 'Order picked up', 'Thank you! Your order for rtewrt was picked up.', 'customer-bookings.html', 'BK-0005', 1, '2026-11-18 10:26:17'),
(496, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for rtewrt.', 'customer-bookings.html', 'BK-0005', 1, '2026-11-18 10:26:24'),
(497, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for rtewrt (BK-0005).', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:26:24'),
(498, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for rtewrt (BK-0005).', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:26:24'),
(499, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for rtewrt (BK-0005).', 'manager-admin-bookings.html', 'BK-0005', 0, '2026-11-18 10:26:24'),
(500, 9, 'deal', 'Payment received', 'We received your ₱ 2,423.20 payment for tesing3. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0011', 1, '2026-11-18 10:38:08'),
(501, 2, 'deal', 'Booking fully paid', '₱ 2,423.20 paid via GCash for tesing3 (BK-0011). Fully paid.', 'sales-bookings.html', 'BK-0011', 0, '2026-11-18 10:38:08'),
(502, 1, 'deal', 'Booking fully paid', '₱ 2,423.20 paid via GCash for tesing3 (BK-0011). Fully paid.', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-18 10:38:08'),
(503, 6, 'deal', 'Booking fully paid', '₱ 2,423.20 paid via GCash for tesing3 (BK-0011). Fully paid.', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-18 10:38:08'),
(504, 4, 'deal', 'Booking fully paid', '₱ 2,423.20 paid via GCash for tesing3 (BK-0011). Fully paid.', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-18 10:38:08'),
(505, 9, 'deal', 'Balance due in 7 days', 'Please pay the remaining ₱ 3,040.00 for shane bday by Nov 25, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0020', 1, '2026-11-18 12:31:07'),
(506, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0039: SYSTEM TESTING JAY', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:17:47'),
(507, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0039: SYSTEM TESTING JAY', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:17:47'),
(508, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0039: SYSTEM TESTING JAY', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:17:47'),
(509, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0039: SYSTEM TESTING JAY', 'sales-available.html', 'INQ-0039', 0, '2026-11-18 13:17:47'),
(510, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0039: SYSTEM TESTING JAY', 'sales-available.html', 'INQ-0039', 0, '2026-11-18 13:17:47'),
(511, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TESTING JAY. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0039', 1, '2026-11-18 13:17:47'),
(512, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TESTING JAY. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0039', 1, '2026-11-18 13:18:46'),
(513, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0039 (SYSTEM TESTING JAY).', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:18:46'),
(514, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0039 (SYSTEM TESTING JAY).', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:18:46'),
(515, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0039 (SYSTEM TESTING JAY).', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:18:46'),
(516, 9, 'deal', 'Your quotation is ready', 'Your quotation for SYSTEM TESTING JAY is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0039', 1, '2026-11-18 13:23:17'),
(517, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TESTING JAY (INQ-0039): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:23:17'),
(518, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TESTING JAY (INQ-0039): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:23:17'),
(519, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TESTING JAY (INQ-0039): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:23:17'),
(520, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TESTING JAY.', 'sales-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:24:02'),
(521, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TESTING JAY.', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:24:02'),
(522, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TESTING JAY.', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:24:02'),
(523, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TESTING JAY.', 'manager-admin-inquiries.html', 'INQ-0039', 0, '2026-11-18 13:24:02'),
(524, 9, 'deal', 'Payment received', 'We received your ₱ 600.00 payment. Your booking for SYSTEM TESTING JAY (BK-0027) is confirmed.', 'customer-bookings.html', 'BK-0027', 1, '2026-11-18 13:26:05'),
(525, 2, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via Maya for SYSTEM TESTING JAY. Booking BK-0027 is confirmed.', 'sales-bookings.html', 'BK-0027', 0, '2026-11-18 13:26:05'),
(526, 1, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via Maya for SYSTEM TESTING JAY. Booking BK-0027 is confirmed.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-18 13:26:05'),
(527, 6, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via Maya for SYSTEM TESTING JAY. Booking BK-0027 is confirmed.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-18 13:26:05'),
(528, 4, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via Maya for SYSTEM TESTING JAY. Booking BK-0027 is confirmed.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-18 13:26:05'),
(529, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0040: SYSTEM TEST V2', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:17'),
(530, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0040: SYSTEM TEST V2', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:17'),
(531, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0040: SYSTEM TEST V2', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:17'),
(532, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0040: SYSTEM TEST V2', 'sales-available.html', 'INQ-0040', 0, '2026-11-18 13:32:17'),
(533, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0040: SYSTEM TEST V2', 'sales-available.html', 'INQ-0040', 0, '2026-11-18 13:32:17'),
(534, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TEST V2. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0040', 1, '2026-11-18 13:32:17'),
(535, 9, 'deal', 'Balance due in 3 days', 'Please pay the remaining ₱ 2,400.00 for SYSTEM TESTING JAY by Nov 21, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0027', 1, '2026-11-18 13:32:20'),
(536, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TEST V2. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0040', 1, '2026-11-18 13:32:28'),
(537, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0040 (SYSTEM TEST V2).', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:28'),
(538, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0040 (SYSTEM TEST V2).', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:28'),
(539, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0040 (SYSTEM TEST V2).', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:28'),
(540, 9, 'deal', 'Your quotation is ready', 'Your quotation for SYSTEM TEST V2 is ready (₱ 4,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0040', 1, '2026-11-18 13:32:50'),
(541, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST V2 (INQ-0040): ₱ 4,800.00', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:50'),
(542, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST V2 (INQ-0040): ₱ 4,800.00', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:50'),
(543, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST V2 (INQ-0040): ₱ 4,800.00', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:32:50'),
(544, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST V2.', 'sales-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:33:30'),
(545, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST V2.', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:33:30'),
(546, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST V2.', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:33:30'),
(547, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST V2.', 'manager-admin-inquiries.html', 'INQ-0040', 0, '2026-11-18 13:33:30'),
(548, 9, 'deal', 'Payment received', 'We received your ₱ 960.00 payment. Your booking for SYSTEM TEST V2 (BK-0028) is confirmed.', 'customer-bookings.html', 'BK-0028', 1, '2026-11-18 13:34:19'),
(549, 2, 'deal', 'Payment received - booking confirmed', '₱ 960.00 paid via Maya for SYSTEM TEST V2. Booking BK-0028 is confirmed.', 'sales-bookings.html', 'BK-0028', 0, '2026-11-18 13:34:19'),
(550, 1, 'deal', 'Payment received - booking confirmed', '₱ 960.00 paid via Maya for SYSTEM TEST V2. Booking BK-0028 is confirmed.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:34:19'),
(551, 6, 'deal', 'Payment received - booking confirmed', '₱ 960.00 paid via Maya for SYSTEM TEST V2. Booking BK-0028 is confirmed.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:34:19'),
(552, 4, 'deal', 'Payment received - booking confirmed', '₱ 960.00 paid via Maya for SYSTEM TEST V2. Booking BK-0028 is confirmed.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:34:19'),
(553, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 3,840.00 for SYSTEM TEST V2 on or before Nov 20, 2026.', 'customer-bookings.html', 'BK-0028', 1, '2026-11-18 13:35:17'),
(554, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,840.00 for SYSTEM TEST V2 (BK-0028), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:17'),
(555, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,840.00 for SYSTEM TEST V2 (BK-0028), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:17'),
(556, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 3,840.00 for SYSTEM TEST V2 (BK-0028), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:17'),
(557, 9, 'deal', 'Payment received', 'We received your ₱ 3,840.00 payment for SYSTEM TEST V2. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0028', 1, '2026-11-18 13:35:53'),
(558, 2, 'deal', 'Booking fully paid', '₱ 3,840.00 paid via GCash for SYSTEM TEST V2 (BK-0028). Fully paid.', 'sales-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:53'),
(559, 1, 'deal', 'Booking fully paid', '₱ 3,840.00 paid via GCash for SYSTEM TEST V2 (BK-0028). Fully paid.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:53'),
(560, 6, 'deal', 'Booking fully paid', '₱ 3,840.00 paid via GCash for SYSTEM TEST V2 (BK-0028). Fully paid.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:53'),
(561, 4, 'deal', 'Booking fully paid', '₱ 3,840.00 paid via GCash for SYSTEM TEST V2 (BK-0028). Fully paid.', 'manager-admin-bookings.html', 'BK-0028', 0, '2026-11-18 13:35:53'),
(562, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0041: INBOX TESTING', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:52:43'),
(563, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0041: INBOX TESTING', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:52:43'),
(564, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0041: INBOX TESTING', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:52:43'),
(565, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0041: INBOX TESTING', 'sales-available.html', 'INQ-0041', 0, '2026-11-18 13:52:43'),
(566, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0041: INBOX TESTING', 'sales-available.html', 'INQ-0041', 0, '2026-11-18 13:52:43'),
(567, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for INBOX TESTING. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0041', 1, '2026-11-18 13:52:43'),
(568, 9, 'deal', 'Your quotation is ready', 'Your quotation for xample is ready (₱ 2,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0028', 1, '2026-11-18 13:53:47'),
(569, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for xample (INQ-0028): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:47'),
(570, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for xample (INQ-0028): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:47'),
(571, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for xample (INQ-0028): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:47'),
(572, 2, 'lead', 'Inquiry closed: deposit not paid', 'xample (INQ-0028) was closed because the deposit was not paid by Nov 16, 2026.', 'sales-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:53'),
(573, 1, 'lead', 'Inquiry closed: deposit not paid', 'xample (INQ-0028) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:53'),
(574, 6, 'lead', 'Inquiry closed: deposit not paid', 'xample (INQ-0028) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:53'),
(575, 4, 'lead', 'Inquiry closed: deposit not paid', 'xample (INQ-0028) was closed because the deposit was not paid by Nov 16, 2026.', 'manager-admin-inquiries.html', 'INQ-0028', 0, '2026-11-18 13:53:53'),
(576, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for INBOX TESTING. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0041', 1, '2026-11-18 13:54:40'),
(577, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0041 (INBOX TESTING).', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:54:40'),
(578, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0041 (INBOX TESTING).', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:54:40'),
(579, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0041 (INBOX TESTING).', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:54:40'),
(580, 9, 'deal', 'Your quotation is ready', 'Your quotation for INBOX TESTING is ready (₱ 3,450.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0041', 1, '2026-11-18 13:55:44'),
(581, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for INBOX TESTING (INQ-0041): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:55:44'),
(582, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for INBOX TESTING (INQ-0041): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:55:44'),
(583, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for INBOX TESTING (INQ-0041): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:55:44'),
(584, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for INBOX TESTING.', 'sales-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:59:19'),
(585, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for INBOX TESTING.', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:59:19'),
(586, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for INBOX TESTING.', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:59:19'),
(587, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for INBOX TESTING.', 'manager-admin-inquiries.html', 'INQ-0041', 0, '2026-11-18 13:59:19'),
(588, 9, 'deal', 'Payment received', 'We received your ₱ 690.00 payment. Your booking for INBOX TESTING (BK-0029) is confirmed.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 14:00:12');
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `page`, `ref`, `is_read`, `created_at`) VALUES
(589, 2, 'deal', 'Payment received - booking confirmed', '₱ 690.00 paid via GCash for INBOX TESTING. Booking BK-0029 is confirmed.', 'sales-bookings.html', 'BK-0029', 0, '2026-11-18 14:00:12'),
(590, 1, 'deal', 'Payment received - booking confirmed', '₱ 690.00 paid via GCash for INBOX TESTING. Booking BK-0029 is confirmed.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:00:12'),
(591, 6, 'deal', 'Payment received - booking confirmed', '₱ 690.00 paid via GCash for INBOX TESTING. Booking BK-0029 is confirmed.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:00:12'),
(592, 4, 'deal', 'Payment received - booking confirmed', '₱ 690.00 paid via GCash for INBOX TESTING. Booking BK-0029 is confirmed.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:00:12'),
(593, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,760.00 for INBOX TESTING on or before Nov 20, 2026.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 14:02:44'),
(594, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:44'),
(595, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:44'),
(596, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:44'),
(597, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,760.00 for INBOX TESTING on or before Nov 19, 2026.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 14:02:52'),
(598, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:52'),
(599, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:52'),
(600, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:02:52'),
(601, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,760.00 for INBOX TESTING on or before Nov 18, 2026.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 14:03:17'),
(602, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:03:17'),
(603, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:03:17'),
(604, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,760.00 for INBOX TESTING (BK-0029), due Nov 18, 2026.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-18 14:03:17'),
(605, 9, 'deal', 'Balance due in 2 days', 'Please pay the remaining ₱ 2,760.00 for INBOX TESTING by Nov 20, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 14:04:12'),
(606, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0042: SYSTEM TEST NEW', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 18:59:12'),
(607, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0042: SYSTEM TEST NEW', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 18:59:12'),
(608, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0042: SYSTEM TEST NEW', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 18:59:12'),
(609, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0042: SYSTEM TEST NEW', 'sales-available.html', 'INQ-0042', 0, '2026-11-18 18:59:12'),
(610, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0042: SYSTEM TEST NEW', 'sales-available.html', 'INQ-0042', 0, '2026-11-18 18:59:12'),
(611, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TEST NEW. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0042', 1, '2026-11-18 18:59:12'),
(612, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TEST NEW. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0042', 1, '2026-11-18 19:00:15'),
(613, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0042 (SYSTEM TEST NEW).', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 19:00:15'),
(614, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0042 (SYSTEM TEST NEW).', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 19:00:15'),
(615, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0042 (SYSTEM TEST NEW).', 'manager-admin-inquiries.html', 'INQ-0042', 0, '2026-11-18 19:00:15'),
(616, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0043: xample', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:30'),
(617, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0043: xample', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:30'),
(618, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0043: xample', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:30'),
(619, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0043: xample', 'sales-available.html', 'INQ-0043', 0, '2026-11-18 19:39:30'),
(620, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0043: xample', 'sales-available.html', 'INQ-0043', 0, '2026-11-18 19:39:30'),
(621, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for xample. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0043', 1, '2026-11-18 19:39:30'),
(622, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for xample. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0043', 1, '2026-11-18 19:39:36'),
(623, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0043 (xample).', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:36'),
(624, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0043 (xample).', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:36'),
(625, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0043 (xample).', 'manager-admin-inquiries.html', 'INQ-0043', 0, '2026-11-18 19:39:36'),
(626, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0044: SYSTEM TES 10', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:42'),
(627, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0044: SYSTEM TES 10', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:42'),
(628, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0044: SYSTEM TES 10', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:42'),
(629, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0044: SYSTEM TES 10', 'sales-available.html', 'INQ-0044', 0, '2026-11-18 20:06:42'),
(630, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0044: SYSTEM TES 10', 'sales-available.html', 'INQ-0044', 0, '2026-11-18 20:06:42'),
(631, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TES 10. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0044', 1, '2026-11-18 20:06:42'),
(632, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TES 10. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0044', 1, '2026-11-18 20:06:59'),
(633, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0044 (SYSTEM TES 10).', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:59'),
(634, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0044 (SYSTEM TES 10).', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:59'),
(635, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0044 (SYSTEM TES 10).', 'manager-admin-inquiries.html', 'INQ-0044', 0, '2026-11-18 20:06:59'),
(636, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0045: system test 20', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:02'),
(637, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0045: system test 20', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:02'),
(638, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0045: system test 20', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:02'),
(639, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0045: system test 20', 'sales-available.html', 'INQ-0045', 0, '2026-11-18 20:08:02'),
(640, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0045: system test 20', 'sales-available.html', 'INQ-0045', 0, '2026-11-18 20:08:02'),
(641, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for system test 20. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0045', 1, '2026-11-18 20:08:02'),
(642, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for system test 20. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0045', 1, '2026-11-18 20:08:07'),
(643, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0045 (system test 20).', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:07'),
(644, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0045 (system test 20).', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:07'),
(645, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0045 (system test 20).', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:08:07'),
(646, 9, 'deal', 'Your quotation is ready', 'Your quotation for system test 20 is ready (₱ 3,450.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0045', 1, '2026-11-18 20:13:31'),
(647, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for system test 20 (INQ-0045): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:13:31'),
(648, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for system test 20 (INQ-0045): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:13:31'),
(649, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for system test 20 (INQ-0045): ₱ 3,450.00', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:13:31'),
(650, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for system test 20.', 'sales-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:17:23'),
(651, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for system test 20.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:17:23'),
(652, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for system test 20.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:17:23'),
(653, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for system test 20.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-18 20:17:23'),
(654, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0046: testtttf', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:32'),
(655, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0046: testtttf', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:32'),
(656, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0046: testtttf', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:32'),
(657, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0046: testtttf', 'sales-available.html', 'INQ-0046', 0, '2026-11-18 20:23:32'),
(658, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0046: testtttf', 'sales-available.html', 'INQ-0046', 0, '2026-11-18 20:23:32'),
(659, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for testtttf. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0046', 1, '2026-11-18 20:23:32'),
(660, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for testtttf. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0046', 1, '2026-11-18 20:23:41'),
(661, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0046 (testtttf).', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:41'),
(662, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0046 (testtttf).', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:41'),
(663, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0046 (testtttf).', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:41'),
(664, 9, 'deal', 'Your quotation is ready', 'Your quotation for testtttf is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0046', 1, '2026-11-18 20:23:54'),
(665, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testtttf (INQ-0046): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:54'),
(666, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testtttf (INQ-0046): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:54'),
(667, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testtttf (INQ-0046): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:23:54'),
(668, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testtttf.', 'sales-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:24:06'),
(669, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testtttf.', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:24:06'),
(670, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testtttf.', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:24:06'),
(671, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testtttf.', 'manager-admin-inquiries.html', 'INQ-0046', 0, '2026-11-18 20:24:06'),
(672, 9, 'deal', 'Payment received', 'We received your ₱ 600.00 payment. Your booking for testtttf (BK-0030) is confirmed.', 'customer-bookings.html', 'BK-0030', 1, '2026-11-18 20:24:35'),
(673, 2, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for testtttf. Booking BK-0030 is confirmed.', 'sales-bookings.html', 'BK-0030', 0, '2026-11-18 20:24:35'),
(674, 1, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for testtttf. Booking BK-0030 is confirmed.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 20:24:35'),
(675, 6, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for testtttf. Booking BK-0030 is confirmed.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 20:24:35'),
(676, 4, 'deal', 'Payment received - booking confirmed', '₱ 600.00 paid via GCash for testtttf. Booking BK-0030 is confirmed.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 20:24:35'),
(677, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0047: thsssssssssss', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:01'),
(678, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0047: thsssssssssss', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:01'),
(679, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0047: thsssssssssss', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:01'),
(680, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0047: thsssssssssss', 'sales-available.html', 'INQ-0047', 0, '2026-11-18 20:32:01'),
(681, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0047: thsssssssssss', 'sales-available.html', 'INQ-0047', 0, '2026-11-18 20:32:01'),
(682, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for thsssssssssss. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0047', 1, '2026-11-18 20:32:01'),
(683, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for thsssssssssss. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0047', 1, '2026-11-18 20:32:13'),
(684, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0047 (thsssssssssss).', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:13'),
(685, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0047 (thsssssssssss).', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:13'),
(686, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0047 (thsssssssssss).', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:32:13'),
(687, 9, 'deal', 'Your quotation is ready', 'Your quotation for thsssssssssss is ready (₱ 6,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0047', 1, '2026-11-18 20:44:02'),
(688, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for thsssssssssss (INQ-0047): ₱ 6,500.00', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:44:02'),
(689, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for thsssssssssss (INQ-0047): ₱ 6,500.00', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:44:02'),
(690, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for thsssssssssss (INQ-0047): ₱ 6,500.00', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:44:02'),
(691, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for thsssssssssss.', 'sales-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:45:08'),
(692, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for thsssssssssss.', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:45:08'),
(693, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for thsssssssssss.', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:45:08'),
(694, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for thsssssssssss.', 'manager-admin-inquiries.html', 'INQ-0047', 0, '2026-11-18 20:45:08'),
(695, 9, 'deal', 'Payment received', 'We received your ₱ 1,300.00 payment. Your booking for thsssssssssss (BK-0031) is confirmed.', 'customer-bookings.html', 'BK-0031', 1, '2026-11-18 20:45:49'),
(696, 2, 'deal', 'Payment received - booking confirmed', '₱ 1,300.00 paid via GCash for thsssssssssss. Booking BK-0031 is confirmed.', 'sales-bookings.html', 'BK-0031', 0, '2026-11-18 20:45:49'),
(697, 1, 'deal', 'Payment received - booking confirmed', '₱ 1,300.00 paid via GCash for thsssssssssss. Booking BK-0031 is confirmed.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:45:49'),
(698, 6, 'deal', 'Payment received - booking confirmed', '₱ 1,300.00 paid via GCash for thsssssssssss. Booking BK-0031 is confirmed.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:45:49'),
(699, 4, 'deal', 'Payment received - booking confirmed', '₱ 1,300.00 paid via GCash for thsssssssssss. Booking BK-0031 is confirmed.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:45:49'),
(700, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 5,200.00 for thsssssssssss on or before Nov 20, 2026.', 'customer-bookings.html', 'BK-0031', 1, '2026-11-18 20:50:15'),
(701, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 5,200.00 for thsssssssssss (BK-0031), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:50:15'),
(702, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 5,200.00 for thsssssssssss (BK-0031), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:50:15'),
(703, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 5,200.00 for thsssssssssss (BK-0031), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:50:15'),
(704, 9, 'deal', 'Payment received', 'We received your ₱ 5,200.00 payment for thsssssssssss. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0031', 1, '2026-11-18 20:57:05'),
(705, 2, 'deal', 'Booking fully paid', '₱ 5,200.00 paid via GCash for thsssssssssss (BK-0031). Fully paid.', 'sales-bookings.html', 'BK-0031', 0, '2026-11-18 20:57:05'),
(706, 1, 'deal', 'Booking fully paid', '₱ 5,200.00 paid via GCash for thsssssssssss (BK-0031). Fully paid.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:57:05'),
(707, 6, 'deal', 'Booking fully paid', '₱ 5,200.00 paid via GCash for thsssssssssss (BK-0031). Fully paid.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:57:05'),
(708, 4, 'deal', 'Booking fully paid', '₱ 5,200.00 paid via GCash for thsssssssssss (BK-0031). Fully paid.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-18 20:57:05'),
(709, 9, 'deal', 'Balance due in about 2 hours', 'Please pay the remaining ₱ 2,760.00 for INBOX TESTING by Nov 18, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-18 23:02:04'),
(710, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0048: TESTINGG', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:06'),
(711, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0048: TESTINGG', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:06'),
(712, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0048: TESTINGG', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:06'),
(713, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0048: TESTINGG', 'sales-available.html', 'INQ-0048', 0, '2026-11-18 23:04:06'),
(714, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0048: TESTINGG', 'sales-available.html', 'INQ-0048', 0, '2026-11-18 23:04:06'),
(715, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for TESTINGG. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0048', 1, '2026-11-18 23:04:06'),
(716, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for TESTINGG. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0048', 1, '2026-11-18 23:04:16'),
(717, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0048 (TESTINGG).', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:16'),
(718, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0048 (TESTINGG).', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:16'),
(719, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0048 (TESTINGG).', 'manager-admin-inquiries.html', 'INQ-0048', 0, '2026-11-18 23:04:16'),
(720, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0049: QWEFFFFFFFF', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:08:48'),
(721, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0049: QWEFFFFFFFF', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:08:48'),
(722, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0049: QWEFFFFFFFF', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:08:48'),
(723, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0049: QWEFFFFFFFF', 'sales-available.html', 'INQ-0049', 0, '2026-11-18 23:08:48'),
(724, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0049: QWEFFFFFFFF', 'sales-available.html', 'INQ-0049', 0, '2026-11-18 23:08:48'),
(725, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for QWEFFFFFFFF. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0049', 1, '2026-11-18 23:08:48'),
(726, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for QWEFFFFFFFF. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0049', 1, '2026-11-18 23:09:04'),
(727, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0049 (QWEFFFFFFFF).', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:09:04'),
(728, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0049 (QWEFFFFFFFF).', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:09:04'),
(729, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0049 (QWEFFFFFFFF).', 'manager-admin-inquiries.html', 'INQ-0049', 0, '2026-11-18 23:09:04'),
(730, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0050: NIEL WEDDING ANNIVERSARY', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:24'),
(731, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0050: NIEL WEDDING ANNIVERSARY', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:24'),
(732, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0050: NIEL WEDDING ANNIVERSARY', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:24'),
(733, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0050: NIEL WEDDING ANNIVERSARY', 'sales-available.html', 'INQ-0050', 0, '2026-11-18 23:32:24'),
(734, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0050: NIEL WEDDING ANNIVERSARY', 'sales-available.html', 'INQ-0050', 0, '2026-11-18 23:32:24'),
(735, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for NIEL WEDDING ANNIVERSARY. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0050', 1, '2026-11-18 23:32:24'),
(736, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for NIEL WEDDING ANNIVERSARY. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0050', 1, '2026-11-18 23:32:40'),
(737, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0050 (NIEL WEDDING ANNIVERSARY).', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:40'),
(738, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0050 (NIEL WEDDING ANNIVERSARY).', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:40'),
(739, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0050 (NIEL WEDDING ANNIVERSARY).', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:32:40'),
(740, 9, 'deal', 'Your quotation is ready', 'Your quotation for NIEL WEDDING ANNIVERSARY is ready (₱ 4,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0050', 1, '2026-11-18 23:33:20'),
(741, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 4,500.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:33:20'),
(742, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 4,500.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:33:20'),
(743, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 4,500.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:33:20'),
(744, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'sales-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:06'),
(745, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:06'),
(746, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:06'),
(747, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:06'),
(748, 2, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for NIEL WEDDING ANNIVERSARY. Reason: I WANT TO CHANGE THE FOOD', 'sales-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:36'),
(749, 1, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for NIEL WEDDING ANNIVERSARY. Reason: I WANT TO CHANGE THE FOOD', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:36'),
(750, 6, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for NIEL WEDDING ANNIVERSARY. Reason: I WANT TO CHANGE THE FOOD', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:36'),
(751, 4, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for NIEL WEDDING ANNIVERSARY. Reason: I WANT TO CHANGE THE FOOD', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:34:36'),
(752, 9, 'deal', 'Your quotation is ready', 'Your quotation for NIEL WEDDING ANNIVERSARY is ready (₱ 5,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0050', 1, '2026-11-18 23:35:25'),
(753, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 5,000.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:35:25'),
(754, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 5,000.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:35:25'),
(755, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for NIEL WEDDING ANNIVERSARY (INQ-0050): ₱ 5,000.00', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:35:25'),
(756, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'sales-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:36:59'),
(757, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:36:59'),
(758, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:36:59'),
(759, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for NIEL WEDDING ANNIVERSARY.', 'manager-admin-inquiries.html', 'INQ-0050', 0, '2026-11-18 23:36:59'),
(760, 9, 'deal', 'Payment received', 'We received your ₱ 1,000.00 payment. Your booking for NIEL WEDDING ANNIVERSARY (BK-0032) is confirmed.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:37:46'),
(761, 2, 'deal', 'Payment received - booking confirmed', '₱ 1,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY. Booking BK-0032 is confirmed.', 'sales-bookings.html', 'BK-0032', 0, '2026-11-18 23:37:46'),
(762, 1, 'deal', 'Payment received - booking confirmed', '₱ 1,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY. Booking BK-0032 is confirmed.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:37:46'),
(763, 6, 'deal', 'Payment received - booking confirmed', '₱ 1,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY. Booking BK-0032 is confirmed.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:37:46'),
(764, 4, 'deal', 'Payment received - booking confirmed', '₱ 1,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY. Booking BK-0032 is confirmed.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:37:46'),
(765, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY on or before Nov 20, 2026.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:39:54'),
(766, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:39:54'),
(767, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:39:54'),
(768, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 20, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:39:54'),
(769, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY on or before Nov 19, 2026.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:40:15'),
(770, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:15'),
(771, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:15'),
(772, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 4,000.00 for NIEL WEDDING ANNIVERSARY (BK-0032), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:15'),
(773, 9, 'deal', 'Payment received', 'We received your ₱ 4,000.00 payment for NIEL WEDDING ANNIVERSARY. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:40:43'),
(774, 2, 'deal', 'Booking fully paid', '₱ 4,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY (BK-0032). Fully paid.', 'sales-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:43'),
(775, 1, 'deal', 'Booking fully paid', '₱ 4,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY (BK-0032). Fully paid.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:43'),
(776, 6, 'deal', 'Booking fully paid', '₱ 4,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY (BK-0032). Fully paid.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:43'),
(777, 4, 'deal', 'Booking fully paid', '₱ 4,000.00 paid via GCash for NIEL WEDDING ANNIVERSARY (BK-0032). Fully paid.', 'manager-admin-bookings.html', 'BK-0032', 0, '2026-11-18 23:40:43'),
(778, 9, 'deal', 'We are preparing your food', 'We started preparing the food for NIEL WEDDING ANNIVERSARY.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:40:57'),
(779, 9, 'deal', 'Our team is on the way', 'Our team is on the way to your venue for NIEL WEDDING ANNIVERSARY.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:41:22'),
(780, 9, 'deal', 'Setting up your event', 'Our team is setting up at your venue for NIEL WEDDING ANNIVERSARY.', 'customer-bookings.html', 'BK-0032', 1, '2026-11-18 23:41:36'),
(781, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,400.00 for testtttf on or before Nov 19, 2026.', 'customer-bookings.html', 'BK-0030', 1, '2026-11-18 23:44:25'),
(782, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for testtttf (BK-0030), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:25'),
(783, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for testtttf (BK-0030), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:25'),
(784, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for testtttf (BK-0030), due Nov 19, 2026.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:25'),
(785, 9, 'deal', 'Payment received', 'We received your ₱ 2,400.00 payment for testtttf. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0030', 1, '2026-11-18 23:44:59'),
(786, 2, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for testtttf (BK-0030). Fully paid.', 'sales-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:59'),
(787, 1, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for testtttf (BK-0030). Fully paid.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:59'),
(788, 6, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for testtttf (BK-0030). Fully paid.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:59'),
(789, 4, 'deal', 'Booking fully paid', '₱ 2,400.00 paid via GCash for testtttf (BK-0030). Fully paid.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-18 23:44:59'),
(790, 9, 'deal', 'We are preparing your food', 'We started preparing the food for testtttf.', 'customer-bookings.html', 'BK-0030', 1, '2026-11-18 23:47:46'),
(791, 9, 'deal', 'Your order is ready for pickup', 'Your order for testtttf is ready for pickup.', 'customer-bookings.html', 'BK-0030', 1, '2026-11-18 23:47:49'),
(792, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0051: TEST', 'manager-admin-inquiries.html', 'INQ-0051', 0, '2026-11-19 00:08:54'),
(793, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0051: TEST', 'manager-admin-inquiries.html', 'INQ-0051', 0, '2026-11-19 00:08:54'),
(794, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0051: TEST', 'manager-admin-inquiries.html', 'INQ-0051', 0, '2026-11-19 00:08:54'),
(795, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0051: TEST', 'sales-available.html', 'INQ-0051', 0, '2026-11-19 00:08:54'),
(796, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0051: TEST', 'sales-available.html', 'INQ-0051', 0, '2026-11-19 00:08:54'),
(797, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for TEST. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0051', 1, '2026-11-19 00:08:54'),
(798, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0052: 21333333333333', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:07'),
(799, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0052: 21333333333333', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:07'),
(800, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0052: 21333333333333', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:07'),
(801, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0052: 21333333333333', 'sales-available.html', 'INQ-0052', 0, '2026-11-19 00:12:07'),
(802, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0052: 21333333333333', 'sales-available.html', 'INQ-0052', 0, '2026-11-19 00:12:07'),
(803, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for 21333333333333. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0052', 1, '2026-11-19 00:12:08'),
(804, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for 21333333333333. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0052', 1, '2026-11-19 00:12:18'),
(805, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0052 (21333333333333).', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:18'),
(806, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0052 (21333333333333).', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:18'),
(807, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0052 (21333333333333).', 'manager-admin-inquiries.html', 'INQ-0052', 0, '2026-11-19 00:12:18'),
(808, 9, 'deal', 'Booking cancelled', 'Your booking for INBOX TESTING was cancelled because the balance of ₱ 2,760.00 was not paid by Nov 18, 2026. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0029', 1, '2026-11-19 00:12:20'),
(809, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,760.00 for INBOX TESTING (BK-0029) by Nov 18, 2026. The booking was cancelled.', 'sales-bookings.html', 'BK-0029', 0, '2026-11-19 00:12:20'),
(810, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,760.00 for INBOX TESTING (BK-0029) by Nov 18, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-19 00:12:20'),
(811, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,760.00 for INBOX TESTING (BK-0029) by Nov 18, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-19 00:12:20'),
(812, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 2,760.00 for INBOX TESTING (BK-0029) by Nov 18, 2026. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0029', 0, '2026-11-19 00:12:20'),
(813, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for tesing3.', 'customer-bookings.html', 'BK-0011', 1, '2026-11-19 00:12:20'),
(814, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for tesing3 (BK-0011).', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-19 00:12:20'),
(815, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for tesing3 (BK-0011).', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-19 00:12:20'),
(816, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for tesing3 (BK-0011).', 'manager-admin-bookings.html', 'BK-0011', 0, '2026-11-19 00:12:20'),
(817, 3, 'deal', 'Balance still unpaid', 'Your remaining balance of ₱ 5,520.00 for testtt8 is still unpaid. Please settle it as soon as you can.', 'customer-bookings.html', 'BK-0014', 0, '2026-11-19 00:12:20'),
(818, 2, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 5,520.00 for testtt8 (BK-0014). The event date has passed.', 'sales-bookings.html', 'BK-0014', 0, '2026-11-19 00:12:20'),
(819, 1, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 5,520.00 for testtt8 (BK-0014). The event date has passed.', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-19 00:12:20'),
(820, 6, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 5,520.00 for testtt8 (BK-0014). The event date has passed.', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-19 00:12:20'),
(821, 4, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 5,520.00 for testtt8 (BK-0014). The event date has passed.', 'manager-admin-bookings.html', 'BK-0014', 0, '2026-11-19 00:12:20'),
(822, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0053: dwcedcewcedc', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:04'),
(823, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0053: dwcedcewcedc', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:04'),
(824, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0053: dwcedcewcedc', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:04'),
(825, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0053: dwcedcewcedc', 'sales-available.html', 'INQ-0053', 0, '2026-11-19 00:19:04'),
(826, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0053: dwcedcewcedc', 'sales-available.html', 'INQ-0053', 0, '2026-11-19 00:19:04'),
(827, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for dwcedcewcedc. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0053', 1, '2026-11-19 00:19:04'),
(828, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for dwcedcewcedc. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0053', 1, '2026-11-19 00:19:19'),
(829, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0053 (dwcedcewcedc).', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:19'),
(830, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0053 (dwcedcewcedc).', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:19'),
(831, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0053 (dwcedcewcedc).', 'manager-admin-inquiries.html', 'INQ-0053', 0, '2026-11-19 00:19:19'),
(832, 9, 'deal', 'Balance due in 2 days', 'Please pay the remaining ₱ 2,400.00 for SYSTEM TESTING JAY by Nov 21, 2026 or the booking is cancelled.', 'customer-bookings.html', 'BK-0027', 1, '2026-11-19 12:08:07'),
(833, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0054: 3ffffffffffff', 'manager-admin-inquiries.html', 'INQ-0054', 0, '2026-11-19 12:09:34'),
(834, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0054: 3ffffffffffff', 'manager-admin-inquiries.html', 'INQ-0054', 0, '2026-11-19 12:09:34'),
(835, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0054: 3ffffffffffff', 'manager-admin-inquiries.html', 'INQ-0054', 0, '2026-11-19 12:09:34'),
(836, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0054: 3ffffffffffff', 'sales-available.html', 'INQ-0054', 0, '2026-11-19 12:09:34'),
(837, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0054: 3ffffffffffff', 'sales-available.html', 'INQ-0054', 0, '2026-11-19 12:09:34'),
(838, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for 3ffffffffffff. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0054', 1, '2026-11-19 12:09:34'),
(839, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0055: rwqfefefefefefefefefefefefefefefefefe', 'manager-admin-inquiries.html', 'INQ-0055', 0, '2026-11-19 12:11:38'),
(840, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0055: rwqfefefefefefefefefefefefefefefefefe', 'manager-admin-inquiries.html', 'INQ-0055', 0, '2026-11-19 12:11:38'),
(841, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0055: rwqfefefefefefefefefefefefefefefefefe', 'manager-admin-inquiries.html', 'INQ-0055', 0, '2026-11-19 12:11:38'),
(842, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0055: rwqfefefefefefefefefefefefefefefefefe', 'sales-available.html', 'INQ-0055', 0, '2026-11-19 12:11:38'),
(843, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0055: rwqfefefefefefefefefefefefefefefefefe', 'sales-available.html', 'INQ-0055', 0, '2026-11-19 12:11:38'),
(844, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for rwqfefefefefefefefefefefefefefefefefe. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0055', 1, '2026-11-19 12:11:38'),
(845, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0056: yoooooooot', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:15:26'),
(846, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0056: yoooooooot', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:15:26'),
(847, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0056: yoooooooot', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:15:26'),
(848, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0056: yoooooooot', 'sales-available.html', 'INQ-0056', 0, '2026-11-19 12:15:26'),
(849, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0056: yoooooooot', 'sales-available.html', 'INQ-0056', 0, '2026-11-19 12:15:26'),
(850, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for yoooooooot. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0056', 1, '2026-11-19 12:15:26'),
(851, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for yoooooooot. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0056', 1, '2026-11-19 12:32:08'),
(852, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0056 (yoooooooot).', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:32:08'),
(853, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0056 (yoooooooot).', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:32:08'),
(854, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0056 (yoooooooot).', 'manager-admin-inquiries.html', 'INQ-0056', 1, '2026-11-19 12:32:08'),
(855, 9, 'deal', 'Your quotation is ready', 'Your quotation for yoooooooot is ready (₱ 7,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0056', 1, '2026-11-19 12:52:58'),
(856, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for yoooooooot (INQ-0056): ₱ 7,500.00', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:52:58'),
(857, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for yoooooooot (INQ-0056): ₱ 7,500.00', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:52:58'),
(858, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for yoooooooot (INQ-0056): ₱ 7,500.00', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:52:58'),
(859, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for yoooooooot.', 'sales-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:55:08'),
(860, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for yoooooooot.', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:55:08'),
(861, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for yoooooooot.', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:55:08'),
(862, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for yoooooooot.', 'manager-admin-inquiries.html', 'INQ-0056', 0, '2026-11-19 12:55:08'),
(863, 9, 'deal', 'Payment received', 'We received your ₱ 1,500.00 payment. Your booking for yoooooooot (BK-0033) is confirmed.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 12:56:30'),
(864, 2, 'deal', 'Payment received - booking confirmed', '₱ 1,500.00 paid via GCash for yoooooooot. Booking BK-0033 is confirmed.', 'sales-bookings.html', 'BK-0033', 0, '2026-11-19 12:56:30'),
(865, 1, 'deal', 'Payment received - booking confirmed', '₱ 1,500.00 paid via GCash for yoooooooot. Booking BK-0033 is confirmed.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:56:30'),
(866, 6, 'deal', 'Payment received - booking confirmed', '₱ 1,500.00 paid via GCash for yoooooooot. Booking BK-0033 is confirmed.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:56:30'),
(867, 4, 'deal', 'Payment received - booking confirmed', '₱ 1,500.00 paid via GCash for yoooooooot. Booking BK-0033 is confirmed.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:56:30'),
(868, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 6,000.00 for yoooooooot on or before Nov 20, 2026, 2:00 PM.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 12:58:50'),
(869, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 2:00 PM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:58:50'),
(870, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 2:00 PM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:58:50'),
(871, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 2:00 PM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 12:58:50'),
(872, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 6,000.00 for yoooooooot on or before Nov 20, 2026, 8:30 AM.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 13:15:59'),
(873, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 8:30 AM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:15:59'),
(874, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 8:30 AM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:15:59'),
(875, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 6,000.00 for yoooooooot (BK-0033), due Nov 20, 2026, 8:30 AM.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:15:59'),
(876, 9, 'deal', 'Payment received', 'We received your ₱ 6,000.00 payment for yoooooooot. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 13:18:34');
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `page`, `ref`, `is_read`, `created_at`) VALUES
(877, 2, 'deal', 'Booking fully paid', '₱ 6,000.00 paid via GCash for yoooooooot (BK-0033). Fully paid.', 'sales-bookings.html', 'BK-0033', 0, '2026-11-19 13:18:34'),
(878, 1, 'deal', 'Booking fully paid', '₱ 6,000.00 paid via GCash for yoooooooot (BK-0033). Fully paid.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:18:34'),
(879, 6, 'deal', 'Booking fully paid', '₱ 6,000.00 paid via GCash for yoooooooot (BK-0033). Fully paid.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:18:34'),
(880, 4, 'deal', 'Booking fully paid', '₱ 6,000.00 paid via GCash for yoooooooot (BK-0033). Fully paid.', 'manager-admin-bookings.html', 'BK-0033', 0, '2026-11-19 13:18:34'),
(881, 9, 'deal', 'We are preparing your food', 'We started preparing the food for yoooooooot.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 13:19:43'),
(882, 9, 'deal', 'Our team is on the way', 'Our team is on the way to your venue for yoooooooot.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 13:19:46'),
(883, 9, 'deal', 'Setting up your event', 'Our team is setting up at your venue for yoooooooot.', 'customer-bookings.html', 'BK-0033', 1, '2026-11-19 13:19:49'),
(884, 2, 'lead', 'Inquiry closed: deposit not paid', 'system test 20 (INQ-0045) was closed because the deposit was not paid by Nov 18, 2026, 9:30 PM.', 'sales-inquiries.html', 'INQ-0045', 0, '2026-11-19 14:07:07'),
(885, 1, 'lead', 'Inquiry closed: deposit not paid', 'system test 20 (INQ-0045) was closed because the deposit was not paid by Nov 18, 2026, 9:30 PM.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-19 14:07:07'),
(886, 6, 'lead', 'Inquiry closed: deposit not paid', 'system test 20 (INQ-0045) was closed because the deposit was not paid by Nov 18, 2026, 9:30 PM.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-19 14:07:07'),
(887, 4, 'lead', 'Inquiry closed: deposit not paid', 'system test 20 (INQ-0045) was closed because the deposit was not paid by Nov 18, 2026, 9:30 PM.', 'manager-admin-inquiries.html', 'INQ-0045', 0, '2026-11-19 14:07:07'),
(888, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0057: testing', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:09:41'),
(889, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0057: testing', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:09:41'),
(890, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0057: testing', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:09:41'),
(891, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0057: testing', 'sales-available.html', 'INQ-0057', 0, '2026-11-19 14:09:41'),
(892, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0057: testing', 'sales-available.html', 'INQ-0057', 0, '2026-11-19 14:09:41'),
(893, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for testing. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0057', 1, '2026-11-19 14:09:41'),
(894, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for testing. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0057', 1, '2026-11-19 14:10:42'),
(895, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0057 (testing).', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:10:42'),
(896, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0057 (testing).', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:10:42'),
(897, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0057 (testing).', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:10:42'),
(898, 9, 'deal', 'Your quotation is ready', 'Your quotation for testing is ready (₱ 16,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0057', 1, '2026-11-19 14:12:18'),
(899, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:18'),
(900, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:18'),
(901, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:18'),
(902, 2, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for testing. Reason: move the date', 'sales-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:57'),
(903, 1, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for testing. Reason: move the date', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:57'),
(904, 6, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for testing. Reason: move the date', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:57'),
(905, 4, 'deal', 'Changes requested', 'jayhans requested changes to the quotation for testing. Reason: move the date', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:12:57'),
(906, 9, 'deal', 'Your quotation is ready', 'Your quotation for testing is ready (₱ 16,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0057', 1, '2026-11-19 14:13:30'),
(907, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:13:30'),
(908, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:13:30'),
(909, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0057): ₱ 16,500.00', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 14:13:30'),
(910, 2, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0057) was closed because the deposit was not paid by Nov 19, 2026, 3:30 PM.', 'sales-inquiries.html', 'INQ-0057', 0, '2026-11-19 18:33:12'),
(911, 1, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0057) was closed because the deposit was not paid by Nov 19, 2026, 3:30 PM.', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 18:33:12'),
(912, 6, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0057) was closed because the deposit was not paid by Nov 19, 2026, 3:30 PM.', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 18:33:12'),
(913, 4, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0057) was closed because the deposit was not paid by Nov 19, 2026, 3:30 PM.', 'manager-admin-inquiries.html', 'INQ-0057', 0, '2026-11-19 18:33:12'),
(914, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0058: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(915, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0058: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(916, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0058: SYSTEM TEST', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(917, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0058: SYSTEM TEST', 'sales-available.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(918, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0058: SYSTEM TEST', 'sales-available.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(919, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for SYSTEM TEST. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:05:56'),
(920, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for SYSTEM TEST. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:18'),
(921, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0058 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:18'),
(922, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0058 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:18'),
(923, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0058 (SYSTEM TEST).', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:18'),
(924, 9, 'deal', 'Your quotation is ready', 'Your quotation for SYSTEM TEST is ready (₱ 2,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:36'),
(925, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0058): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:36'),
(926, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0058): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:36'),
(927, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for SYSTEM TEST (INQ-0058): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:36'),
(928, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'sales-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:59'),
(929, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:59'),
(930, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:59'),
(931, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for SYSTEM TEST.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 19:06:59'),
(932, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0059: testing', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(933, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0059: testing', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(934, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0059: testing', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(935, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0059: testing', 'sales-available.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(936, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0059: testing', 'sales-available.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(937, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for testing. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:20:59'),
(938, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for testing. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:11'),
(939, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0059 (testing).', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:11'),
(940, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0059 (testing).', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:11'),
(941, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0059 (testing).', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:11'),
(942, 9, 'deal', 'Your quotation is ready', 'Your quotation for testing is ready (₱ 2,800.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:41'),
(943, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0059): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:41'),
(944, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0059): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:41'),
(945, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0059): ₱ 2,800.00', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:21:41'),
(946, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testing.', 'sales-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:22:40'),
(947, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testing.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:22:40'),
(948, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testing.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:22:40'),
(949, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for testing.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 19:22:40'),
(950, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0060: TEST', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(951, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0060: TEST', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(952, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0060: TEST', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(953, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0060: TEST', 'sales-available.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(954, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0060: TEST', 'sales-available.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(955, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for TEST. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:03'),
(956, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for TEST. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:10'),
(957, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0060 (TEST).', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:10'),
(958, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0060 (TEST).', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:10'),
(959, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0060 (TEST).', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:10'),
(960, 9, 'deal', 'Your quotation is ready', 'Your quotation for TEST is ready (₱ 5,500.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:22'),
(961, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST (INQ-0060): ₱ 5,500.00', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:22'),
(962, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST (INQ-0060): ₱ 5,500.00', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:22'),
(963, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for TEST (INQ-0060): ₱ 5,500.00', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 19:36:22'),
(964, 9, 'deal', 'Balance due in 2 days', 'Please pay the remaining ₱ 2,400.00 for SYSTEM TESTING JAY by Nov 21, 2026, 11:59 PM or the booking is cancelled.', 'customer-bookings.html', 'BK-0027', 0, '2026-11-19 19:37:30'),
(965, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 2,400.00 for SYSTEM TESTING JAY on or before tomorrow, Nov 20, 2026, 11:59 PM.', 'customer-bookings.html', 'BK-0027', 0, '2026-11-19 19:42:35'),
(966, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for SYSTEM TESTING JAY (BK-0027), due tomorrow, Nov 20, 2026, 11:59 PM.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-19 19:42:35'),
(967, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for SYSTEM TESTING JAY (BK-0027), due tomorrow, Nov 20, 2026, 11:59 PM.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-19 19:42:35'),
(968, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 2,400.00 for SYSTEM TESTING JAY (BK-0027), due tomorrow, Nov 20, 2026, 11:59 PM.', 'manager-admin-bookings.html', 'BK-0027', 0, '2026-11-19 19:42:35'),
(969, 9, 'lead', 'Deposit due in about 25 minutes', 'Please pay the ₱ 560.00 deposit for SYSTEM TEST by today, Nov 19, 2026, 8:30 PM.', 'customer-inquiries.html', 'INQ-0058', 0, '2026-11-19 20:06:42'),
(970, 9, 'lead', 'Deposit due in about 25 minutes', 'Please pay the ₱ 560.00 deposit for testing by today, Nov 19, 2026, 8:30 PM.', 'customer-inquiries.html', 'INQ-0059', 0, '2026-11-19 20:06:42'),
(971, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0061: testing', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(972, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0061: testing', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(973, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0061: testing', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(974, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0061: testing', 'sales-available.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(975, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0061: testing', 'sales-available.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(976, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for testing. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:22:24'),
(977, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for testing. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:23:03'),
(978, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0061 (testing).', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:23:03'),
(979, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0061 (testing).', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:23:03'),
(980, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0061 (testing).', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:23:03'),
(981, 9, 'deal', 'Your quotation is ready', 'Your quotation for testing is ready (₱ 3,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:36:27'),
(982, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0061): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:36:27'),
(983, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0061): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:36:27'),
(984, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for testing (INQ-0061): ₱ 3,000.00', 'manager-admin-inquiries.html', 'INQ-0061', 0, '2026-11-19 20:36:27'),
(985, 2, 'lead', 'Inquiry closed: deposit not paid', 'SYSTEM TEST (INQ-0058) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'sales-inquiries.html', 'INQ-0058', 0, '2026-11-19 20:37:30'),
(986, 1, 'lead', 'Inquiry closed: deposit not paid', 'SYSTEM TEST (INQ-0058) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 20:37:30'),
(987, 6, 'lead', 'Inquiry closed: deposit not paid', 'SYSTEM TEST (INQ-0058) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 20:37:30'),
(988, 4, 'lead', 'Inquiry closed: deposit not paid', 'SYSTEM TEST (INQ-0058) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0058', 0, '2026-11-19 20:37:30'),
(989, 2, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0059) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'sales-inquiries.html', 'INQ-0059', 0, '2026-11-19 20:37:30'),
(990, 1, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0059) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 20:37:30'),
(991, 6, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0059) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 20:37:30'),
(992, 4, 'lead', 'Inquiry closed: deposit not paid', 'testing (INQ-0059) was closed because the deposit was not paid by today, Nov 19, 2026, 8:30 PM.', 'manager-admin-inquiries.html', 'INQ-0059', 0, '2026-11-19 20:37:30'),
(993, 9, 'lead', 'Deposit due in about 25 minutes', 'Please pay the ₱ 1,100.00 deposit for TEST by today, Nov 19, 2026, 9:00 PM.', 'customer-inquiries.html', 'INQ-0060', 0, '2026-11-19 20:37:30'),
(994, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST.', 'sales-inquiries.html', 'INQ-0060', 0, '2026-11-19 20:37:44'),
(995, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 20:37:44'),
(996, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 20:37:44'),
(997, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for TEST.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 20:37:44'),
(998, 2, 'lead', 'Inquiry closed: deposit not paid', 'TEST (INQ-0060) was closed because the deposit was not paid by today, Nov 19, 2026, 9:00 PM.', 'sales-inquiries.html', 'INQ-0060', 0, '2026-11-19 21:01:25'),
(999, 1, 'lead', 'Inquiry closed: deposit not paid', 'TEST (INQ-0060) was closed because the deposit was not paid by today, Nov 19, 2026, 9:00 PM.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 21:01:25'),
(1000, 6, 'lead', 'Inquiry closed: deposit not paid', 'TEST (INQ-0060) was closed because the deposit was not paid by today, Nov 19, 2026, 9:00 PM.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 21:01:25'),
(1001, 4, 'lead', 'Inquiry closed: deposit not paid', 'TEST (INQ-0060) was closed because the deposit was not paid by today, Nov 19, 2026, 9:00 PM.', 'manager-admin-inquiries.html', 'INQ-0060', 0, '2026-11-19 21:01:25'),
(1002, 9, 'deal', 'We are preparing your food', 'We started preparing the food for thsssssssssss.', 'customer-bookings.html', 'BK-0031', 0, '2026-11-19 21:42:44'),
(1003, 1, 'lead', 'New inquiry', 'jayhans submitted INQ-0062: FINAL TESTING SYSTEM', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1004, 6, 'lead', 'New inquiry', 'jayhans submitted INQ-0062: FINAL TESTING SYSTEM', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1005, 4, 'lead', 'New inquiry', 'jayhans submitted INQ-0062: FINAL TESTING SYSTEM', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1006, 2, 'lead', 'New inquiry', 'jayhans submitted INQ-0062: FINAL TESTING SYSTEM', 'sales-available.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1007, 5, 'lead', 'New inquiry', 'jayhans submitted INQ-0062: FINAL TESTING SYSTEM', 'sales-available.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1008, 9, 'lead', 'Inquiry received', 'Thank you! We received your inquiry for FINAL TESTING SYSTEM. Please wait while our team reviews it.', 'customer-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:46:44'),
(1009, 9, 'lead', 'Your inquiry is being handled', 'jaystaff from our sales team is now handling your inquiry for FINAL TESTING SYSTEM. You can chat with them in your Inbox.', 'customer-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:03'),
(1010, 1, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0062 (FINAL TESTING SYSTEM).', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:03'),
(1011, 6, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0062 (FINAL TESTING SYSTEM).', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:03'),
(1012, 4, 'lead', 'Inquiry accepted', 'jaystaff accepted INQ-0062 (FINAL TESTING SYSTEM).', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:03'),
(1013, 9, 'deal', 'Your quotation is ready', 'Your quotation for FINAL TESTING SYSTEM is ready (₱ 11,000.00). Open My Inquiries to accept or decline it.', 'customer-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:53'),
(1014, 1, 'deal', 'Quotation sent', 'jaystaff sent a quotation for FINAL TESTING SYSTEM (INQ-0062): ₱ 11,000.00', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:53'),
(1015, 6, 'deal', 'Quotation sent', 'jaystaff sent a quotation for FINAL TESTING SYSTEM (INQ-0062): ₱ 11,000.00', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:53'),
(1016, 4, 'deal', 'Quotation sent', 'jaystaff sent a quotation for FINAL TESTING SYSTEM (INQ-0062): ₱ 11,000.00', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:47:53'),
(1017, 2, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for FINAL TESTING SYSTEM.', 'sales-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:48:09'),
(1018, 1, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for FINAL TESTING SYSTEM.', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:48:09'),
(1019, 6, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for FINAL TESTING SYSTEM.', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:48:09'),
(1020, 4, 'deal', 'Quotation accepted', 'jayhans accepted the quotation for FINAL TESTING SYSTEM.', 'manager-admin-inquiries.html', 'INQ-0062', 0, '2026-11-19 21:48:09'),
(1021, 9, 'deal', 'Payment received', 'We received your ₱ 2,200.00 payment. Your booking for FINAL TESTING SYSTEM (BK-0034) is confirmed.', 'customer-bookings.html', 'BK-0034', 0, '2026-11-19 21:49:36'),
(1022, 2, 'deal', 'Payment received - booking confirmed', '₱ 2,200.00 paid via GCash for FINAL TESTING SYSTEM. Booking BK-0034 is confirmed.', 'sales-bookings.html', 'BK-0034', 0, '2026-11-19 21:49:36'),
(1023, 1, 'deal', 'Payment received - booking confirmed', '₱ 2,200.00 paid via GCash for FINAL TESTING SYSTEM. Booking BK-0034 is confirmed.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-19 21:49:36'),
(1024, 6, 'deal', 'Payment received - booking confirmed', '₱ 2,200.00 paid via GCash for FINAL TESTING SYSTEM. Booking BK-0034 is confirmed.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-19 21:49:36'),
(1025, 4, 'deal', 'Payment received - booking confirmed', '₱ 2,200.00 paid via GCash for FINAL TESTING SYSTEM. Booking BK-0034 is confirmed.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-19 21:49:36'),
(1026, 3, 'deal', 'Balance still unpaid', 'Your remaining balance of ₱ 1,920.00 for Anniversary is still unpaid. Please settle it as soon as you can.', 'customer-bookings.html', 'BK-0002', 0, '2026-11-20 01:20:56'),
(1027, 2, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 1,920.00 for Anniversary (BK-0002). The event date has passed.', 'sales-bookings.html', 'BK-0002', 0, '2026-11-20 01:20:56'),
(1028, 1, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 1,920.00 for Anniversary (BK-0002). The event date has passed.', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-20 01:20:56'),
(1029, 6, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 1,920.00 for Anniversary (BK-0002). The event date has passed.', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-20 01:20:56'),
(1030, 4, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 1,920.00 for Anniversary (BK-0002). The event date has passed.', 'manager-admin-bookings.html', 'BK-0002', 0, '2026-11-20 01:20:56'),
(1031, 9, 'deal', 'Balance still unpaid', 'Your remaining balance of ₱ 2,244.80 for BIRTDAYYYY is still unpaid. Please settle it as soon as you can.', 'customer-bookings.html', 'BK-0008', 0, '2026-11-20 01:20:56'),
(1032, 2, 'deal', 'Unpaid balance', 'jayhans still owes ₱ 2,244.80 for BIRTDAYYYY (BK-0008). The event date has passed.', 'sales-bookings.html', 'BK-0008', 0, '2026-11-20 01:20:56'),
(1033, 1, 'deal', 'Unpaid balance', 'jayhans still owes ₱ 2,244.80 for BIRTDAYYYY (BK-0008). The event date has passed.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-20 01:20:56'),
(1034, 6, 'deal', 'Unpaid balance', 'jayhans still owes ₱ 2,244.80 for BIRTDAYYYY (BK-0008). The event date has passed.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-20 01:20:56'),
(1035, 4, 'deal', 'Unpaid balance', 'jayhans still owes ₱ 2,244.80 for BIRTDAYYYY (BK-0008). The event date has passed.', 'manager-admin-bookings.html', 'BK-0008', 0, '2026-11-20 01:20:56'),
(1036, 10, 'deal', 'Balance still unpaid', 'Your remaining balance of ₱ 3,120.00 for testjay is still unpaid. Please settle it as soon as you can.', 'customer-bookings.html', 'BK-0013', 0, '2026-11-20 01:20:56'),
(1037, 2, 'deal', 'Unpaid balance', 'jaytest still owes ₱ 3,120.00 for testjay (BK-0013). The event date has passed.', 'sales-bookings.html', 'BK-0013', 0, '2026-11-20 01:20:56'),
(1038, 1, 'deal', 'Unpaid balance', 'jaytest still owes ₱ 3,120.00 for testjay (BK-0013). The event date has passed.', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-20 01:20:56'),
(1039, 6, 'deal', 'Unpaid balance', 'jaytest still owes ₱ 3,120.00 for testjay (BK-0013). The event date has passed.', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-20 01:20:56'),
(1040, 4, 'deal', 'Unpaid balance', 'jaytest still owes ₱ 3,120.00 for testjay (BK-0013). The event date has passed.', 'manager-admin-bookings.html', 'BK-0013', 0, '2026-11-20 01:20:56'),
(1041, 3, 'deal', 'Balance still unpaid', 'Your remaining balance of ₱ 2,140.80 for BIRTDAY is still unpaid. Please settle it as soon as you can.', 'customer-bookings.html', 'BK-0015', 0, '2026-11-20 01:20:56'),
(1042, 2, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 2,140.80 for BIRTDAY (BK-0015). The event date has passed.', 'sales-bookings.html', 'BK-0015', 0, '2026-11-20 01:20:56'),
(1043, 1, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 2,140.80 for BIRTDAY (BK-0015). The event date has passed.', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-20 01:20:56'),
(1044, 6, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 2,140.80 for BIRTDAY (BK-0015). The event date has passed.', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-20 01:20:56'),
(1045, 4, 'deal', 'Unpaid balance', 'jaycustomer still owes ₱ 2,140.80 for BIRTDAY (BK-0015). The event date has passed.', 'manager-admin-bookings.html', 'BK-0015', 0, '2026-11-20 01:20:56'),
(1046, 9, 'deal', 'We are preparing your food', 'We started preparing the food for whayne debu.', 'customer-bookings.html', 'BK-0024', 0, '2026-11-20 01:25:18'),
(1047, 9, 'deal', 'Your order is on its way', 'Your order for whayne debu is out for delivery.', 'customer-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:14'),
(1048, 9, 'deal', 'Order delivered', 'Your order for whayne debu was delivered. Enjoy!', 'customer-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:17'),
(1049, 9, 'deal', 'How was your event?', 'Thank you for choosing us! Please rate your experience for whayne debu.', 'customer-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:33'),
(1050, 1, 'deal', 'Feedback requested', 'Feedback requested from jayhans for whayne debu (BK-0024).', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:33'),
(1051, 6, 'deal', 'Feedback requested', 'Feedback requested from jayhans for whayne debu (BK-0024).', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:33'),
(1052, 4, 'deal', 'Feedback requested', 'Feedback requested from jayhans for whayne debu (BK-0024).', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:33:33'),
(1053, 9, 'deal', 'Payment requested', 'Please pay the remaining ₱ 8,800.00 for FINAL TESTING SYSTEM on or before today, Nov 20, 2026, 9:00 AM.', 'customer-bookings.html', 'BK-0034', 0, '2026-11-20 01:34:27'),
(1054, 1, 'deal', 'Payment requested', 'jaystaff requested ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034), due today, Nov 20, 2026, 9:00 AM.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 01:34:27'),
(1055, 6, 'deal', 'Payment requested', 'jaystaff requested ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034), due today, Nov 20, 2026, 9:00 AM.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 01:34:27'),
(1056, 4, 'deal', 'Payment requested', 'jaystaff requested ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034), due today, Nov 20, 2026, 9:00 AM.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 01:34:27'),
(1057, 9, 'deal', 'Payment received', 'We received your ₱ 960.00 payment for trip. Your booking is fully paid. Thank you!', 'customer-bookings.html', 'BK-0004', 0, '2026-11-20 01:35:24'),
(1058, 2, 'deal', 'Booking fully paid', '₱ 960.00 paid via GCash for trip (BK-0004). Fully paid.', 'sales-bookings.html', 'BK-0004', 0, '2026-11-20 01:35:24'),
(1059, 1, 'deal', 'Booking fully paid', '₱ 960.00 paid via GCash for trip (BK-0004). Fully paid.', 'manager-admin-bookings.html', 'BK-0004', 0, '2026-11-20 01:35:24'),
(1060, 6, 'deal', 'Booking fully paid', '₱ 960.00 paid via GCash for trip (BK-0004). Fully paid.', 'manager-admin-bookings.html', 'BK-0004', 0, '2026-11-20 01:35:24'),
(1061, 4, 'deal', 'Booking fully paid', '₱ 960.00 paid via GCash for trip (BK-0004). Fully paid.', 'manager-admin-bookings.html', 'BK-0004', 0, '2026-11-20 01:35:24'),
(1062, 9, 'deal', 'We are preparing your food', 'We started preparing the food for trip.', 'customer-bookings.html', 'BK-0004', 0, '2026-11-20 01:37:25'),
(1063, 9, 'deal', 'Your order is ready for pickup', 'Your order for trip is ready for pickup.', 'customer-bookings.html', 'BK-0004', 0, '2026-11-20 01:37:35'),
(1064, 2, 'customer', 'New customer feedback', 'jayhans rated whayne debu (BK-0024) 1/5.', 'sales-bookings.html', 'BK-0024', 0, '2026-11-20 01:38:52'),
(1065, 1, 'customer', 'New customer feedback', 'jayhans rated whayne debu (BK-0024) 1/5.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:38:52'),
(1066, 6, 'customer', 'New customer feedback', 'jayhans rated whayne debu (BK-0024) 1/5.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:38:52'),
(1067, 4, 'customer', 'New customer feedback', 'jayhans rated whayne debu (BK-0024) 1/5.', 'manager-admin-bookings.html', 'BK-0024', 0, '2026-11-20 01:38:52'),
(1068, 2, 'customer', 'New customer message', 'jayhans sent a message about FINAL TESTING SYSTEM.', 'inbox', 'INQ-0062', 0, '2026-11-20 02:03:04'),
(1069, 1, 'customer', 'New customer message', 'jayhans sent a message about FINAL TESTING SYSTEM.', 'inbox', 'INQ-0062', 0, '2026-11-20 02:03:04'),
(1070, 4, 'customer', 'New customer message', 'jayhans sent a message about FINAL TESTING SYSTEM.', 'inbox', 'INQ-0062', 0, '2026-11-20 02:03:04'),
(1071, 6, 'customer', 'New customer message', 'jayhans sent a message about FINAL TESTING SYSTEM.', 'inbox', 'INQ-0062', 0, '2026-11-20 02:03:04'),
(1072, 9, 'lead', 'Deposit due in 4 days', 'Please pay the ₱ 600.00 deposit for testing by today, Nov 20, 2026, 11:59 PM.', 'customer-inquiries.html', 'INQ-0061', 0, '2026-11-20 12:29:00'),
(1073, 9, 'deal', 'Balance due today', 'Please pay the remaining ₱ 2,400.00 for SYSTEM TESTING JAY by today, Nov 20, 2026, 11:59 PM or the booking is cancelled.', 'customer-bookings.html', 'BK-0027', 0, '2026-11-20 12:29:00'),
(1074, 9, 'deal', 'Booking cancelled', 'Your booking for FINAL TESTING SYSTEM was cancelled because the balance of ₱ 8,800.00 was not paid by today, Nov 20, 2026, 9:00 AM. The deposit is non-refundable.', 'customer-bookings.html', 'BK-0034', 0, '2026-11-20 12:29:00'),
(1075, 2, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034) by today, Nov 20, 2026, 9:00 AM. The booking was cancelled.', 'sales-bookings.html', 'BK-0034', 0, '2026-11-20 12:29:00'),
(1076, 1, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034) by today, Nov 20, 2026, 9:00 AM. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 12:29:00'),
(1077, 4, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034) by today, Nov 20, 2026, 9:00 AM. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 12:29:00'),
(1078, 6, 'deal', 'Booking cancelled: unpaid balance', 'jayhans did not pay ₱ 8,800.00 for FINAL TESTING SYSTEM (BK-0034) by today, Nov 20, 2026, 9:00 AM. The booking was cancelled.', 'manager-admin-bookings.html', 'BK-0034', 0, '2026-11-20 12:29:00'),
(1079, 9, 'deal', 'Your event is tomorrow', 'testtttf (BK-0030) is tomorrow, pickup time 6:00 PM.', 'customer-bookings.html', 'BK-0030', 0, '2026-11-20 12:29:00'),
(1080, 2, 'deal', 'Event tomorrow', 'testtttf (BK-0030) for jayhans is tomorrow, pickup time 6:00 PM.', 'sales-bookings.html', 'BK-0030', 0, '2026-11-20 12:29:00'),
(1081, 1, 'deal', 'Event tomorrow', 'testtttf (BK-0030) for jayhans is tomorrow, pickup time 6:00 PM.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-20 12:29:00'),
(1082, 4, 'deal', 'Event tomorrow', 'testtttf (BK-0030) for jayhans is tomorrow, pickup time 6:00 PM.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-20 12:29:00'),
(1083, 6, 'deal', 'Event tomorrow', 'testtttf (BK-0030) for jayhans is tomorrow, pickup time 6:00 PM.', 'manager-admin-bookings.html', 'BK-0030', 0, '2026-11-20 12:29:00'),
(1084, 9, 'deal', 'Your event is tomorrow', 'thsssssssssss (BK-0031) is tomorrow, pickup time 5:00 PM.', 'customer-bookings.html', 'BK-0031', 0, '2026-11-20 12:29:00'),
(1085, 2, 'deal', 'Event tomorrow', 'thsssssssssss (BK-0031) for jayhans is tomorrow, pickup time 5:00 PM.', 'sales-bookings.html', 'BK-0031', 0, '2026-11-20 12:29:00'),
(1086, 1, 'deal', 'Event tomorrow', 'thsssssssssss (BK-0031) for jayhans is tomorrow, pickup time 5:00 PM.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-20 12:29:00'),
(1087, 4, 'deal', 'Event tomorrow', 'thsssssssssss (BK-0031) for jayhans is tomorrow, pickup time 5:00 PM.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-20 12:29:00'),
(1088, 6, 'deal', 'Event tomorrow', 'thsssssssssss (BK-0031) for jayhans is tomorrow, pickup time 5:00 PM.', 'manager-admin-bookings.html', 'BK-0031', 0, '2026-11-20 12:29:00');

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `reset_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `password_resets`
--

INSERT INTO `password_resets` (`reset_id`, `user_id`, `token_hash`, `expires_at`, `created_at`) VALUES
(6, 9, 'bf19969297ec6c5b1da129c36bca14860225081c6e74d2782f9a1cfd23239496', '2026-11-20 13:09:24', '2026-11-20 04:39:24');

-- --------------------------------------------------------

--
-- Table structure for table `payment_requests`
--

CREATE TABLE `payment_requests` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `inquiry_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `due_date` date DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'Pending',
  `requested_by` varchar(120) DEFAULT NULL,
  `requested_by_id` int(11) DEFAULT NULL,
  `requested_at` datetime NOT NULL,
  `invoice_id` varchar(80) DEFAULT NULL,
  `checkout_url` text DEFAULT NULL,
  `invoice_created_at` datetime DEFAULT NULL,
  `payment_id` varchar(80) DEFAULT NULL,
  `method` varchar(40) DEFAULT NULL,
  `paid_amount` decimal(12,2) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `due_time` time DEFAULT NULL,
  `invoice_expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_requests`
--

INSERT INTO `payment_requests` (`id`, `booking_id`, `inquiry_id`, `customer_id`, `amount`, `due_date`, `note`, `status`, `requested_by`, `requested_by_id`, `requested_at`, `invoice_id`, `checkout_url`, `invoice_created_at`, `payment_id`, `method`, `paid_amount`, `paid_at`, `due_time`, `invoice_expires_at`) VALUES
(1, 18, 24, 3, 3160.00, '2026-11-15', NULL, 'Paid', 'jaystaff', 2, '2026-11-14 20:04:43', '6af84e6ca4105c5a53433377', 'https://checkout-staging.xendit.co/web/6af84e6ca4105c5a53433377', '2026-11-14 20:05:01', 'ewc_d2bc64a5-a9f0-489b-921e-afcb41462559', 'GCash', 3160.00, '2026-11-14 20:05:16', NULL, NULL),
(2, 15, 3, 3, 2140.80, '2026-11-15', NULL, 'Pending', 'jaystaff', 2, '2026-11-14 20:16:21', '6af85120a4105c5a534335fa', 'https://checkout-staging.xendit.co/web/6af85120a4105c5a534335fa', '2026-11-14 20:16:32', NULL, NULL, NULL, NULL, NULL, NULL),
(3, 17, 22, 9, 3680.00, '2026-11-22', NULL, 'Paid', 'jaystaff', 2, '2026-11-14 20:22:41', '6af852cc531128dfd3730b99', 'https://checkout-staging.xendit.co/web/6af852cc531128dfd3730b99', '2026-11-14 20:23:40', 'ewc_c2cdfe6c-70d6-4858-9496-5d31c67d161c', 'GCash', 3680.00, '2026-11-14 20:23:56', NULL, NULL),
(4, 19, 23, 9, 3440.00, '2026-11-14', NULL, 'Paid', 'jaystaff', 2, '2026-11-14 21:02:42', '6af85bf8e811fb759357981a', 'https://checkout-staging.xendit.co/web/6af85bf8e811fb759357981a', '2026-11-14 21:02:49', 'ewc_71cd8ee5-234d-43b8-a7e0-88c3f7d86dfa', 'GCash', 3440.00, '2026-11-14 21:03:01', NULL, NULL),
(5, 16, 21, 9, 720.00, '2026-11-14', NULL, 'Paid', 'jaystaff', 2, '2026-11-14 21:11:01', '6af85df0e34138a9c07b8f1f', 'https://checkout-staging.xendit.co/web/6af85df0e34138a9c07b8f1f', '2026-11-14 21:11:13', 'ewc_4781ab16-dce9-471b-add5-f52118bac873', 'Maya', 720.00, '2026-11-14 21:11:45', NULL, NULL),
(6, 22, 30, 9, 3440.00, '2026-11-18', NULL, 'Paid', 'jaystaff', 2, '2026-11-16 00:07:03', '6af9d8e394c7a71c9c5ea51c', 'https://checkout-staging.xendit.co/web/6af9d8e394c7a71c9c5ea51c', '2026-11-16 00:08:03', 'ewc_3bc3e3cd-49ca-4c87-9de5-92ccf42f27d8', 'Maya', 3440.00, '2026-11-16 00:08:17', NULL, NULL),
(7, 21, 29, 9, 3440.00, '2026-11-16', NULL, 'Paid', 'jaystaff', 2, '2026-11-16 11:24:23', '6afa98634de4ae59a687e735', 'https://checkout-staging.xendit.co/web/6afa98634de4ae59a687e735', '2026-11-16 13:45:07', 'ewc_3575f027-fca5-4d2d-be8b-ecda65a010dc', 'GCash', 3440.00, '2026-11-16 13:45:18', NULL, NULL),
(8, 3, 7, 9, 600.00, '2026-11-16', NULL, 'Paid', 'jaystaff', 2, '2026-11-16 13:43:55', '6afa98430464d7814bda6ad3', 'https://checkout-staging.xendit.co/web/6afa98430464d7814bda6ad3', '2026-11-16 13:44:35', 'ewc_7ab3a77e-599c-4897-8c5c-051b7f2888e4', 'GCash', 600.00, '2026-11-16 13:44:49', NULL, NULL),
(9, 24, 35, 9, 3000.00, '2026-11-17', NULL, 'Paid', 'jaystaff', 2, '2026-11-17 16:44:39', '6afc140094c7a71c9c6128ec', 'https://checkout-staging.xendit.co/web/6afc140094c7a71c9c6128ec', '2026-11-17 16:44:48', 'ewc_b95baeca-f0e0-4ae2-85ac-e817dce2fafb', 'GCash', 3000.00, '2026-11-17 16:45:01', NULL, NULL),
(10, 25, 37, 9, 2800.00, '2026-11-21', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-17 20:52:52', '6afc57884f82d8bba60ea5ff', 'https://checkout-staging.xendit.co/web/6afc57884f82d8bba60ea5ff', '2026-11-17 21:32:55', NULL, NULL, NULL, NULL, NULL, NULL),
(11, 4, 8, 9, 960.00, '2026-11-26', NULL, 'Paid', 'jaystaff', 2, '2026-11-17 21:07:52', '6aff334c712cc225a105cd42', 'https://checkout-staging.xendit.co/web/6aff334c712cc225a105cd42', '2026-11-20 01:35:11', 'ewc_b70f63bd-4bde-41d6-a181-ad6f98ce7a5c', 'GCash', 960.00, '2026-11-20 01:35:24', NULL, '2026-11-27 00:00:02'),
(12, 5, 9, 9, 3577.60, '2026-11-17', NULL, 'Paid', 'jaystaff', 2, '2026-11-17 21:07:52', '6afd0c630464d7814bddad39', 'https://checkout-staging.xendit.co/web/6afd0c630464d7814bddad39', '2026-11-18 10:24:35', 'ewc_04fae55a-faad-40d0-b97d-d10e417cc9cc', 'GCash', 3577.60, '2026-11-18 10:25:10', NULL, NULL),
(13, 10, 14, 9, 4000.00, '2026-11-26', NULL, 'Pending', 'jaystaff', 2, '2026-11-17 21:07:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(14, 11, 15, 9, 2423.20, '2026-11-17', NULL, 'Paid', 'jaystaff', 2, '2026-11-17 21:07:52', '6afd0de50464d7814bddaf92', 'https://checkout-staging.xendit.co/web/6afd0de50464d7814bddaf92', '2026-11-18 10:31:01', 'ewc_549bcbd7-ed92-4275-ba7f-a49bc9bb0993', 'GCash', 2423.20, '2026-11-18 10:38:08', NULL, NULL),
(15, 12, 16, 9, 2240.00, '2026-11-21', NULL, 'Pending', 'jaystaff', 2, '2026-11-17 21:07:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(16, 20, 26, 9, 3040.00, '2026-11-25', NULL, 'Pending', 'jaystaff', 2, '2026-11-17 21:07:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(17, 23, 33, 9, 4640.00, '2026-11-17', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-17 21:07:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(18, 26, 38, 9, 2400.00, '2026-11-19', NULL, 'Paid', 'jaystaff', 2, '2026-11-17 22:28:24', '6afc64d402e57e0e3e773946', 'https://checkout-staging.xendit.co/web/6afc64d402e57e0e3e773946', '2026-11-17 22:29:40', 'ewc_41ada8f8-af2a-45f1-870b-318c52c231fc', 'GCash', 2400.00, '2026-11-17 22:29:51', NULL, NULL),
(19, 27, 39, 9, 2400.00, '2026-11-21', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 13:32:20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(20, 28, 40, 9, 3840.00, '2026-11-20', NULL, 'Paid', 'jaystaff', 2, '2026-11-18 13:35:17', '6afd392daddd094f2d6d9e1c', 'https://checkout-staging.xendit.co/web/6afd392daddd094f2d6d9e1c', '2026-11-18 13:35:41', 'ewc_a7dd9124-a4d3-493c-b5ae-91c287eb8450', 'GCash', 3840.00, '2026-11-18 13:35:53', NULL, NULL),
(21, 29, 41, 9, 2760.00, '2026-11-20', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 14:02:44', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(22, 29, 41, 9, 2760.00, '2026-11-19', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 14:02:52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(23, 29, 41, 9, 2760.00, '2026-11-18', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 14:03:17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(24, 31, 47, 9, 5200.00, '2026-11-20', NULL, 'Paid', 'jaystaff', 2, '2026-11-18 20:50:15', '6afda09402e57e0e3e79108f', 'https://checkout-staging.xendit.co/web/6afda09402e57e0e3e79108f', '2026-11-18 20:56:52', 'ewc_9f132d2c-e9b0-4055-b019-4b6d895549d4', 'GCash', 5200.00, '2026-11-18 20:57:05', NULL, '2026-11-21 00:00:00'),
(25, 32, 50, 9, 4000.00, '2026-11-20', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 23:39:54', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(26, 32, 50, 9, 4000.00, '2026-11-19', NULL, 'Paid', 'jaystaff', 2, '2026-11-18 23:40:15', '6afdc6f002e57e0e3e793fb1', 'https://checkout-staging.xendit.co/web/6afdc6f002e57e0e3e793fb1', '2026-11-18 23:40:31', 'ewc_5f60a809-e97d-46ec-b2c7-38a0bba03c82', 'GCash', 4000.00, '2026-11-18 23:40:43', NULL, '2026-11-20 00:00:00'),
(27, 30, 46, 9, 2400.00, '2026-11-19', NULL, 'Paid', 'jaystaff', 2, '2026-11-18 23:44:25', '6afdc7ea0464d7814bdeaa82', 'https://checkout-staging.xendit.co/web/6afdc7ea0464d7814bdeaa82', '2026-11-18 23:44:41', 'ewc_9b5a8a9b-ce75-4df5-bce1-6378f61edf59', 'GCash', 2400.00, '2026-11-18 23:44:59', NULL, '2026-11-20 00:00:00'),
(28, 33, 56, 9, 6000.00, '2026-11-20', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-19 12:58:50', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '14:00:00', NULL),
(29, 33, 56, 9, 6000.00, '2026-11-20', NULL, 'Paid', 'jaystaff', 2, '2026-11-19 13:15:59', '6afe869d81fb3127dab092a7', 'https://checkout-staging.xendit.co/web/6afe869d81fb3127dab092a7', '2026-11-19 13:18:20', 'ewc_081d7e44-31fa-43e5-9d95-eb0a4e12b75f', 'GCash', 6000.00, '2026-11-19 13:18:34', '08:30:00', '2026-11-20 08:30:01'),
(30, 27, 39, 9, 2400.00, '2026-11-21', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-18 13:26:04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(31, 27, 39, 9, 2400.00, '2026-11-20', NULL, 'Pending', 'jaystaff', 2, '2026-11-19 19:42:35', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '23:59:00', NULL),
(32, 34, 62, 9, 8800.00, '2026-11-20', NULL, 'Cancelled', 'jaystaff', 2, '2026-11-20 01:34:27', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '09:00:00', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `paymongo_payments`
--

CREATE TABLE `paymongo_payments` (
  `id` int(11) NOT NULL,
  `inquiry_id` int(11) NOT NULL,
  `quotation_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `checkout_session_id` varchar(80) DEFAULT NULL,
  `checkout_url` text DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `payment_id` varchar(80) DEFAULT NULL,
  `method` varchar(40) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quotations`
--

CREATE TABLE `quotations` (
  `quotation_id` int(11) NOT NULL,
  `inquiry_id` int(11) NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `status` varchar(20) NOT NULL DEFAULT 'Draft',
  `items` text DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `deposit_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `valid_until` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `prepared_by` varchar(120) DEFAULT NULL,
  `prepared_by_id` int(11) DEFAULT NULL,
  `prepared_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `responded_at` datetime DEFAULT NULL,
  `kind` varchar(12) NOT NULL DEFAULT 'quotation',
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `extra_charge` decimal(12,2) NOT NULL DEFAULT 0.00,
  `deposit_rate` int(11) NOT NULL DEFAULT 20,
  `valid_until_time` time DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `quotations`
--

INSERT INTO `quotations` (`quotation_id`, `inquiry_id`, `version`, `status`, `items`, `subtotal`, `total`, `deposit_amount`, `valid_until`, `notes`, `prepared_by`, `prepared_by_id`, `prepared_at`, `sent_at`, `responded_at`, `kind`, `discount`, `extra_charge`, `deposit_rate`, `valid_until_time`) VALUES
(1, 1, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":200,\"amount\":4000}]', 4000.00, 4000.00, 800.00, '2026-11-17', '', 'jaystaff', 2, '2026-11-12 15:02:10', '2026-11-12 15:02:11', '2026-11-12 15:04:07', 'quotation', 0.00, 0.00, 20, NULL),
(2, 2, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":15,\"unit_price\":44,\"amount\":660}]', 660.00, 660.00, 132.00, '2026-11-17', '', 'jaystaff', 2, '2026-11-13 00:15:05', '2026-11-13 00:15:05', '2026-11-13 00:15:20', 'quotation', 0.00, 0.00, 20, NULL),
(3, 3, 1, 'Superseded', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":12,\"unit_price\":220,\"amount\":2640}]', 2640.00, 2640.00, 528.00, '2026-11-16', '', 'jaystaff', 2, '2026-11-13 00:27:01', '2026-11-13 00:27:01', '2026-11-13 02:28:00', 'quotation', 0.00, 0.00, 20, NULL),
(4, 4, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":120,\"amount\":2400}]', 2400.00, 2400.00, 480.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-13 01:13:30', '2026-11-13 01:13:30', '2026-11-13 01:13:37', 'quotation', 0.00, 0.00, 20, NULL),
(5, 5, 1, 'Superseded', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":30,\"unit_price\":400,\"amount\":12000}]', 12000.00, 12000.00, 2400.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 01:34:45', '2026-11-13 01:34:45', '2026-11-13 02:14:29', 'quotation', 0.00, 0.00, 20, NULL),
(6, 5, 2, 'Superseded', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":400,\"amount\":8000}]', 8000.00, 8000.00, 1600.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 02:15:31', '2026-11-13 02:15:32', '2026-11-13 02:20:10', 'quotation', 0.00, 0.00, 20, NULL),
(7, 5, 3, 'Superseded', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":402,\"amount\":8040}]', 8040.00, 8040.00, 1608.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 02:20:31', '2026-11-13 02:20:31', '2026-11-13 02:24:22', 'quotation', 0.00, 0.00, 20, NULL),
(8, 5, 4, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":401,\"amount\":8020}]', 8020.00, 8020.00, 1604.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 02:24:33', '2026-11-13 02:24:33', '2026-11-13 02:25:58', 'quotation', 0.00, 0.00, 20, NULL),
(9, 3, 2, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":12,\"unit_price\":223,\"amount\":2676}]', 2676.00, 2676.00, 535.20, '2026-11-16', '', 'jaystaff', 2, '2026-11-13 02:28:29', '2026-11-13 02:28:29', '2026-11-13 02:28:39', 'quotation', 0.00, 0.00, 20, NULL),
(10, 7, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":30,\"unit_price\":25,\"amount\":750}]', 750.00, 750.00, 150.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 02:40:11', '2026-11-13 02:40:12', '2026-11-13 02:40:17', 'quotation', 0.00, 0.00, 20, NULL),
(11, 8, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":40,\"unit_price\":30,\"amount\":1200}]', 1200.00, 1200.00, 240.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 03:21:19', '2026-11-13 03:21:19', '2026-11-13 03:21:25', 'quotation', 0.00, 0.00, 20, NULL),
(12, 6, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":23,\"unit_price\":25,\"amount\":575}]', 575.00, 575.00, 115.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 03:24:55', '2026-11-13 03:24:56', '2026-11-13 22:20:28', 'quotation', 0.00, 0.00, 20, NULL),
(13, 9, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":13,\"unit_price\":344,\"amount\":4472}]', 4472.00, 4472.00, 894.40, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 03:26:19', '2026-11-13 03:26:20', '2026-11-13 03:26:25', 'quotation', 0.00, 0.00, 20, NULL),
(14, 10, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":250,\"amount\":5000}]', 5000.00, 5000.00, 1000.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:22:20', '2026-11-13 16:22:20', '2026-11-13 16:22:37', 'quotation', 0.00, 0.00, 20, NULL),
(15, 11, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":39,\"unit_price\":200,\"amount\":7800}]', 7800.00, 7800.00, 1560.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:29:01', '2026-11-13 16:29:01', '2026-11-13 16:29:08', 'quotation', 0.00, 0.00, 20, NULL),
(16, 12, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":23,\"unit_price\":122,\"amount\":2806}]', 2806.00, 2806.00, 561.20, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:38:54', '2026-11-13 16:38:54', '2026-11-13 16:39:16', 'quotation', 0.00, 0.00, 20, NULL),
(17, 13, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":4,\"unit_price\":500,\"amount\":2000}]', 2000.00, 2000.00, 400.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:44:05', '2026-11-13 16:44:05', '2026-11-13 16:44:11', 'quotation', 0.00, 0.00, 20, NULL),
(18, 14, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":250,\"amount\":5000}]', 5000.00, 5000.00, 1000.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:54:49', '2026-11-13 16:54:49', '2026-11-13 16:55:08', 'quotation', 0.00, 0.00, 20, NULL),
(19, 15, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":13,\"unit_price\":233,\"amount\":3029}]', 3029.00, 3029.00, 605.80, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 16:59:31', '2026-11-13 16:59:31', '2026-11-13 16:59:39', 'quotation', 0.00, 0.00, 20, NULL),
(20, 16, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":40,\"unit_price\":70,\"amount\":2800}]', 2800.00, 2800.00, 560.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 17:10:02', '2026-11-13 17:10:02', '2026-11-13 17:10:09', 'quotation', 0.00, 0.00, 20, NULL),
(21, 18, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":13,\"unit_price\":300,\"amount\":3900}]', 3900.00, 3900.00, 780.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 17:38:50', '2026-11-13 17:38:50', '2026-11-13 17:38:57', 'quotation', 0.00, 0.00, 20, NULL),
(22, 19, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":30,\"unit_price\":230,\"amount\":6900}]', 6900.00, 6900.00, 1380.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 21:42:03', '2026-11-13 21:42:03', '2026-11-13 21:44:41', 'quotation', 0.00, 0.00, 20, NULL),
(23, 17, 1, 'Declined', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":34,\"unit_price\":250,\"amount\":8500}]', 8500.00, 8500.00, 1700.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 22:32:29', '2026-11-13 22:32:30', '2026-11-14 00:01:03', 'quotation', 0.00, 0.00, 20, NULL),
(24, 21, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":30,\"unit_price\":30,\"amount\":900}]', 900.00, 900.00, 180.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 23:11:59', '2026-11-13 23:11:59', '2026-11-13 23:12:09', 'quotation', 0.00, 0.00, 20, NULL),
(25, 22, 1, 'Accepted', '[{\"description\":\"PORK BELLY - 20–25 PAX\",\"quantity\":20,\"unit_price\":230,\"amount\":4600}]', 4600.00, 4600.00, 920.00, '2026-11-27', '', 'jaystaff', 2, '2026-11-13 23:54:05', '2026-11-13 23:54:05', '2026-11-13 23:54:24', 'quotation', 0.00, 0.00, 20, NULL),
(26, 23, 1, 'Accepted', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":2,\"category\":\"Catering Packages\",\"name\":\"PANCIT MALABON\",\"pax\":\"20–30 PAX\",\"description\":\"PANCIT MALABON\",\"quantity\":1,\"unit_price\":2500,\"amount\":2500}]', 2800.00, 4300.00, 860.00, '2026-11-28', '', 'jaystaff', 2, '2026-11-14 15:11:21', '2026-11-14 15:11:21', '2026-11-14 21:02:00', 'quotation', 0.00, 1500.00, 20, NULL),
(27, 24, 1, 'Accepted', '[{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500}]', 3500.00, 3950.00, 790.00, '2026-11-28', '', 'jaystaff', 2, '2026-11-14 16:58:25', '2026-11-14 16:58:25', '2026-11-14 16:58:40', 'quotation', 0.00, 450.00, 20, NULL),
(28, 25, 1, 'Withdrawn', '[{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500},{\"menu_item_id\":2,\"category\":\"Catering Packages\",\"name\":\"PANCIT MALABON\",\"pax\":\"20–30 PAX\",\"description\":\"PANCIT MALABON\",\"quantity\":1,\"unit_price\":2500,\"amount\":2500}]', 6000.00, 6000.00, 1200.00, '2026-11-16', '', 'jaystaff', 2, '2026-11-15 10:35:12', '2026-11-15 10:35:13', '2026-11-17 21:07:52', 'quotation', 0.00, 0.00, 20, NULL),
(29, 26, 1, 'Accepted', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500}]', 3800.00, 3800.00, 760.00, '2026-11-16', '', 'jaystaff', 2, '2026-11-15 11:12:58', '2026-11-15 11:12:58', '2026-11-15 11:13:43', 'quotation', 0.00, 0.00, 20, NULL),
(30, 29, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"MEDIUM\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 23 PAX\",\"description\":\"BIHON GUISADO - MEDIUM\",\"quantity\":1,\"unit_price\":2800,\"amount\":2800}]', 2800.00, 4300.00, 860.00, '2026-11-17', '', 'jaystaff', 2, '2026-11-15 23:13:27', '2026-11-15 23:13:27', '2026-11-15 23:13:53', 'quotation', 0.00, 1500.00, 20, NULL),
(31, 30, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"MEDIUM\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 23 PAX\",\"description\":\"BIHON GUISADO - MEDIUM\",\"quantity\":1,\"unit_price\":2800,\"amount\":2800}]', 2800.00, 4300.00, 860.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-16 00:03:55', '2026-11-16 00:03:55', '2026-11-16 00:04:25', 'quotation', 0.00, 1500.00, 20, NULL),
(32, 33, 1, 'Accepted', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":2,\"category\":\"Catering Packages\",\"name\":\"PANCIT MALABON\",\"pax\":\"20–30 PAX\",\"description\":\"PANCIT MALABON\",\"quantity\":1,\"unit_price\":2500,\"amount\":2500},{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 5800.00, 5800.00, 1160.00, '2026-11-30', '', 'jaystaff', 2, '2026-11-16 14:14:04', '2026-11-16 14:14:04', '2026-11-16 14:14:47', 'quotation', 0.00, 0.00, 20, NULL),
(33, 32, 1, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-30', '', 'jaystaff', 2, '2026-11-16 22:00:33', '2026-11-16 22:00:33', '2026-11-16 22:00:43', 'quotation', 0.00, 0.00, 20, NULL),
(34, 35, 1, 'Accepted', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3300.00, 3750.00, 750.00, '2026-12-01', '', 'jaystaff', 2, '2026-11-17 16:41:05', '2026-11-17 16:41:05', '2026-11-17 16:42:28', 'quotation', 0.00, 450.00, 20, NULL),
(35, 36, 1, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-17 20:26:39', '2026-11-17 20:26:40', '2026-11-17 21:38:18', 'quotation', 0.00, 0.00, 20, NULL),
(36, 37, 1, 'Accepted', '[{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500}]', 3500.00, 3500.00, 700.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-17 20:38:09', '2026-11-17 20:38:09', '2026-11-17 20:38:34', 'quotation', 0.00, 0.00, 20, NULL),
(37, 38, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-17 22:26:05', '2026-11-17 22:26:05', '2026-11-17 22:26:43', 'quotation', 0.00, 0.00, 20, NULL),
(38, 39, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-18 13:23:17', '2026-11-18 13:23:17', '2026-11-18 13:24:02', 'quotation', 0.00, 0.00, 20, NULL),
(39, 40, 1, 'Accepted', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3300.00, 4800.00, 960.00, '2026-11-20', '', 'jaystaff', 2, '2026-11-18 13:32:50', '2026-11-18 13:32:50', '2026-11-18 13:33:30', 'quotation', 0.00, 1500.00, 20, NULL),
(40, 28, 1, 'Withdrawn', '[{\"menu_item_id\":1,\"category\":\"Bilao\",\"tier\":\"1\\/4 KG\",\"name\":\"PORK BELLY\",\"pax\":\"Good for 2-3 PAX\",\"description\":\"PORK BELLY - 1\\/4 KG\",\"quantity\":1,\"unit_price\":300,\"amount\":300},{\"menu_item_id\":2,\"category\":\"Catering Packages\",\"name\":\"PANCIT MALABON\",\"pax\":\"20–30 PAX\",\"description\":\"PANCIT MALABON\",\"quantity\":1,\"unit_price\":2500,\"amount\":2500}]', 2800.00, 2800.00, 560.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-18 13:53:46', '2026-11-18 13:53:47', '2026-11-18 13:53:53', 'quotation', 0.00, 0.00, 20, NULL),
(41, 41, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3450.00, 690.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-18 13:55:44', '2026-11-18 13:55:44', '2026-11-18 13:59:19', 'quotation', 0.00, 450.00, 20, NULL),
(42, 45, 1, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3450.00, 690.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-18 20:13:30', '2026-11-18 20:13:31', '2026-11-18 20:17:23', 'quotation', 0.00, 450.00, 20, '21:30:00'),
(43, 46, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-18 20:23:54', '2026-11-18 20:23:54', '2026-11-18 20:24:06', 'quotation', 0.00, 0.00, 20, '21:30:00'),
(44, 47, 1, 'Accepted', '[{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500},{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 6500.00, 6500.00, 1300.00, '2026-11-18', '', 'jaystaff', 2, '2026-11-18 20:44:02', '2026-11-18 20:44:02', '2026-11-18 20:45:08', 'quotation', 0.00, 0.00, 20, '22:00:00'),
(45, 50, 1, 'Superseded', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 4500.00, 900.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-18 23:33:20', '2026-11-18 23:33:20', '2026-11-18 23:34:36', 'quotation', 0.00, 1500.00, 20, '11:00:00'),
(46, 50, 2, 'Accepted', '[{\"menu_item_id\":3,\"category\":\"Bilao\",\"name\":\"PALABOK\",\"pax\":\"20–25 PAX\",\"description\":\"PALABOK\",\"quantity\":1,\"unit_price\":3500,\"amount\":3500}]', 3500.00, 5000.00, 1000.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-18 23:35:24', '2026-11-18 23:35:25', '2026-11-18 23:36:59', 'quotation', 0.00, 1500.00, 20, '11:00:00'),
(47, 56, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":2,\"unit_price\":3000,\"amount\":6000}]', 6000.00, 7500.00, 1500.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-19 12:52:57', '2026-11-19 12:52:58', '2026-11-19 12:55:08', 'quotation', 0.00, 1500.00, 20, '14:00:00'),
(48, 57, 1, 'Superseded', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"SMALL\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 20 PAX\",\"description\":\"BIHON GUISADO - SMALL\",\"quantity\":6,\"unit_price\":2500,\"amount\":15000}]', 15000.00, 16500.00, 3300.00, '2026-11-20', '', 'jaystaff', 2, '2026-11-19 14:12:18', '2026-11-19 14:12:18', '2026-11-19 14:12:57', 'quotation', 0.00, 1500.00, 20, '23:59:00'),
(49, 57, 2, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"SMALL\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 20 PAX\",\"description\":\"BIHON GUISADO - SMALL\",\"quantity\":6,\"unit_price\":2500,\"amount\":15000}]', 15000.00, 16500.00, 3300.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-19 14:13:30', '2026-11-19 14:13:30', '2026-11-19 18:33:12', 'quotation', 0.00, 1500.00, 20, '15:30:00'),
(50, 58, 1, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"MEDIUM\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 23 PAX\",\"description\":\"BIHON GUISADO - MEDIUM\",\"quantity\":1,\"unit_price\":2800,\"amount\":2800}]', 2800.00, 2800.00, 560.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-19 19:06:36', '2026-11-19 19:06:36', '2026-11-19 19:06:59', 'quotation', 0.00, 0.00, 20, '20:30:00'),
(51, 59, 1, 'Withdrawn', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"MEDIUM\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 23 PAX\",\"description\":\"BIHON GUISADO - MEDIUM\",\"quantity\":1,\"unit_price\":2800,\"amount\":2800}]', 2800.00, 2800.00, 560.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-19 19:21:41', '2026-11-19 19:21:41', '2026-11-19 19:22:40', 'quotation', 0.00, 0.00, 20, '20:30:00'),
(52, 60, 1, 'Withdrawn', '[{\"menu_item_id\":2,\"category\":\"Catering Packages\",\"name\":\"PANCIT MALABON\",\"pax\":\"20–30 PAX\",\"description\":\"PANCIT MALABON\",\"quantity\":1,\"unit_price\":2500,\"amount\":2500},{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 5500.00, 5500.00, 1100.00, '2026-11-19', '', 'jaystaff', 2, '2026-11-19 19:36:21', '2026-11-19 19:36:22', '2026-11-19 20:37:44', 'quotation', 0.00, 0.00, 20, '21:00:00'),
(53, 61, 1, 'Sent', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":1,\"unit_price\":3000,\"amount\":3000}]', 3000.00, 3000.00, 600.00, '2026-11-20', '', 'jaystaff', 2, '2026-11-19 20:36:27', '2026-11-19 20:36:27', NULL, 'quotation', 0.00, 0.00, 20, '23:59:00'),
(54, 62, 1, 'Accepted', '[{\"menu_item_id\":4,\"category\":\"Catering Packages\",\"tier\":\"LARGE\",\"name\":\"BIHON GUISADO\",\"pax\":\"Good for 25 PAX\",\"description\":\"BIHON GUISADO - LARGE\",\"quantity\":3,\"unit_price\":3000,\"amount\":9000}]', 9000.00, 11000.00, 2200.00, '2026-11-20', '', 'jaystaff', 2, '2026-11-19 21:47:53', '2026-11-19 21:47:53', '2026-11-19 21:48:09', 'quotation', 0.00, 2000.00, 20, '23:59:00');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`role_id`, `role_name`) VALUES
(1, 'Admin'),
(5, 'Customer'),
(4, 'Customer Service Staff'),
(2, 'Manager'),
(3, 'Sales Staff');

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `ticket_id` int(11) NOT NULL,
  `ticket_name` varchar(150) NOT NULL,
  `contact_id` int(11) NOT NULL,
  `description` varchar(150) NOT NULL,
  `status` enum('Open','Pending','Resolved') NOT NULL DEFAULT 'Open',
  `priority` enum('High','Medium','Low') NOT NULL DEFAULT 'Medium',
  `assigned_user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role_id` int(11) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `photo_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `full_name`, `username`, `email`, `phone`, `role_id`, `password_hash`, `status`, `created_at`, `updated_at`, `photo_path`) VALUES
(1, 'Admin User', 'admin', 'admin@example.com', NULL, 1, '$2y$10$VLFGQm4mqKtgZ7N/MrDo/eUn.Cc9KPpi7UxAp7Jj6cYpMRTC5nPPe', 'Active', '2026-11-11 13:50:22', '2026-11-19 17:46:54', NULL),
(2, 'jaystaff', 'jaystaff', 'jaystaff@example.com', NULL, 3, '$2y$10$TCXov304OCPFth4IZsxHoeeY4RsGfIZn6LBhZGVqB9FP0/3Lsj5Wi', 'Active', '2026-11-11 14:06:16', '2026-11-11 14:06:16', NULL),
(4, 'jaymanager', 'jaymanager', 'jaymanager@example.com', NULL, 2, '$2y$10$bJl5xA6nulcyAK6Z3YVXce5syRs.b/PXtuAn1QOrK1.jZwCE0ueaK', 'Active', '2026-11-11 14:16:51', '2026-11-11 14:16:51', NULL),
(5, 'nielstaff', 'nielstaff', 'nielstaff@example.com', NULL, 3, '$2y$10$9y/krK0QmGxxGt7shgW.r.N.WO0ix.oymyfAruiaQAEhiiP8kKMda', 'Active', '2026-11-11 14:18:03', '2026-11-20 05:51:52', NULL),
(6, 'jayadmin', 'jayadmin', 'jayadmin@example.com', NULL, 1, '$2y$10$wmCaa3uyQmAFht8cintt.OFOVcRiZhXNWAF2rxdZFDGNT7auYbJH6', 'Active', '2026-11-11 14:44:52', '2026-11-11 14:44:52', NULL),
(7, 'jaysupport', 'jaysupport', 'jaysupport@example.com', NULL, 4, '$2y$10$d3by6Snjxcgyntr/m5Eqf.9nTj/i1aD66CQGPg8ZSTIibCGHjvEe2', 'Active', '2026-11-11 14:55:47', '2026-11-11 14:55:47', NULL),
(9, 'jayhans', 'jayhans', 'estebanjayhans456@gmail.com', '+639766671523', 5, '$2y$10$hlKtuyxtzXjsBDxIK/RZgefYN3q3KqviUugQZGiMSfpS.Xoq7wkcq', 'Active', '2026-11-12 18:38:49', '2026-11-15 12:41:18', 'uploads/profile/u9-860a3d650445.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `user_legal_acceptances`
--

CREATE TABLE `user_legal_acceptances` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `doc_type` enum('terms','privacy') NOT NULL,
  `version` int(10) UNSIGNED NOT NULL,
  `accepted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `ip_address` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `xendit_payments`
--

CREATE TABLE `xendit_payments` (
  `id` int(11) NOT NULL,
  `inquiry_id` int(11) NOT NULL,
  `quotation_id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `invoice_id` varchar(80) DEFAULT NULL,
  `checkout_url` text DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `payment_id` varchar(80) DEFAULT NULL,
  `method` varchar(40) DEFAULT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `invoice_expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `xendit_payments`
--

INSERT INTO `xendit_payments` (`id`, `inquiry_id`, `quotation_id`, `customer_id`, `invoice_id`, `checkout_url`, `amount`, `status`, `payment_id`, `method`, `booking_id`, `created_at`, `paid_at`, `invoice_expires_at`) VALUES
(1, 4, 4, 3, '6af5f7f24fcf7f2f30f415dd', 'https://checkout-staging.xendit.co/web/6af5f7f24fcf7f2f30f415dd', 480.00, 'paid', 'ewc_291b158a-dc32-4e23-9e89-8e31ba7ba074', 'GCash', 2, '2026-11-13 01:31:27', '2026-11-13 01:31:59', NULL),
(3, 5, 5, 3, '6af5fb5e0fc19ccc1405d1a0', 'https://checkout-staging.xendit.co/web/6af5fb5e0fc19ccc1405d1a0', 2400.00, 'pending', NULL, NULL, NULL, '2026-11-13 01:46:03', NULL, NULL),
(4, 3, 3, 3, '6af5fcd2a4105c5a5340501e', 'https://checkout-staging.xendit.co/web/6af5fcd2a4105c5a5340501e', 528.00, 'pending', NULL, NULL, NULL, '2026-11-13 01:52:14', NULL, NULL),
(5, 5, 6, 3, '6af602d80fc19ccc1405dca3', 'https://checkout-staging.xendit.co/web/6af602d80fc19ccc1405dca3', 1600.00, 'pending', NULL, NULL, NULL, '2026-11-13 02:17:57', NULL, NULL),
(6, 5, 7, 3, '6af60423531128dfd3702ce0', 'https://checkout-staging.xendit.co/web/6af60423531128dfd3702ce0', 1608.00, 'pending', NULL, NULL, NULL, '2026-11-13 02:23:29', NULL, NULL),
(7, 5, 8, 3, '6af604b9531128dfd3702d9f', 'https://checkout-staging.xendit.co/web/6af604b9531128dfd3702d9f', 1604.00, 'pending', NULL, NULL, NULL, '2026-11-13 02:25:58', NULL, NULL),
(8, 7, 10, 9, '6af60905a4105c5a53405f70', 'https://checkout-staging.xendit.co/web/6af60905a4105c5a53405f70', 150.00, 'paid', 'ewc_6a1431e6-baf2-48bb-b2f5-ea57e1efd331', 'GCash', 3, '2026-11-13 02:44:19', '2026-11-13 02:44:40', NULL),
(9, 8, 11, 9, '6af611b9531128dfd3703a93', 'https://checkout-staging.xendit.co/web/6af611b9531128dfd3703a93', 240.00, 'paid', 'ewc_20981c05-4c61-4e53-bf57-2bf5d4e95325', 'GCash', 4, '2026-11-13 03:21:26', '2026-11-13 03:21:41', NULL),
(10, 9, 13, 9, '6af612e4531128dfd3703bb9', 'https://checkout-staging.xendit.co/web/6af612e4531128dfd3703bb9', 894.40, 'paid', 'ewc_91b7ab1e-12b0-4c1e-a7d4-a1996de0c092', 'Maya', 5, '2026-11-13 03:26:25', '2026-11-13 03:26:39', NULL),
(11, 10, 14, 9, '6af6c8d2c51bbf9feac41bea', 'https://checkout-staging.xendit.co/web/6af6c8d2c51bbf9feac41bea', 1000.00, 'paid', 'ewc_4c6df667-5c10-4127-8440-957809f601c0', 'GCash', 6, '2026-11-13 16:22:40', '2026-11-13 16:22:55', NULL),
(12, 11, 15, 9, '6af6ca58a4105c5a53413d3c', 'https://checkout-staging.xendit.co/web/6af6ca58a4105c5a53413d3c', 1560.00, 'paid', 'ewc_d67a2f0f-3479-4973-bd7c-b0dc73a47fd9', 'GCash', 7, '2026-11-13 16:29:10', '2026-11-13 16:29:24', NULL),
(13, 12, 16, 9, '6af6ccb8a4105c5a53414162', 'https://checkout-staging.xendit.co/web/6af6ccb8a4105c5a53414162', 561.20, 'paid', 'ewc_3c262f00-533f-4db8-999d-651e49cc6faf', 'GCash', 8, '2026-11-13 16:39:17', '2026-11-13 16:39:31', NULL),
(14, 13, 17, 9, '6af6cde3a4105c5a53414397', 'https://checkout-staging.xendit.co/web/6af6cde3a4105c5a53414397', 400.00, 'paid', 'ewc_fe0aea1e-f456-43b8-9462-77c99d8b2ddf', 'Maya', 9, '2026-11-13 16:44:16', '2026-11-13 16:44:31', NULL),
(15, 14, 18, 9, '6af6d071c51bbf9feac4299a', 'https://checkout-staging.xendit.co/web/6af6d071c51bbf9feac4299a', 1000.00, 'paid', 'ewc_3555d3a7-90e8-41b9-a12e-9b2b492c224c', 'GCash', 10, '2026-11-13 16:55:11', '2026-11-13 16:55:25', NULL),
(16, 15, 19, 9, '6af6d17f458447fb0e1c4160', 'https://checkout-staging.xendit.co/web/6af6d17f458447fb0e1c4160', 605.80, 'paid', 'ewc_b34032dc-8b0d-4a73-b0a8-42fcdd6447e5', 'Maya', 11, '2026-11-13 16:59:41', '2026-11-13 16:59:53', NULL),
(17, 16, 20, 9, '6af6d3f4c51bbf9feac42fe0', 'https://checkout-staging.xendit.co/web/6af6d3f4c51bbf9feac42fe0', 560.00, 'paid', 'ewc_9c478dc7-a853-48c7-a52a-bdca5c4e9f44', 'Maya', 12, '2026-11-13 17:10:10', '2026-11-13 17:10:23', NULL),
(18, 18, 21, 10, '6af6dab5c51bbf9feac43b2a', 'https://checkout-staging.xendit.co/web/6af6dab5c51bbf9feac43b2a', 780.00, 'paid', 'ewc_dfcc5daf-04ef-40d7-8044-fe5cb0a77ca9', 'GCash', 13, '2026-11-13 17:38:59', '2026-11-13 17:39:14', NULL),
(19, 5, 8, 3, '6af70e12c51bbf9feac48de3', 'https://checkout-staging.xendit.co/web/6af70e12c51bbf9feac48de3', 1604.00, 'pending', NULL, NULL, NULL, '2026-11-13 21:18:09', NULL, NULL),
(20, 19, 22, 3, '6af71662531128dfd3718c8b', 'https://checkout-staging.xendit.co/web/6af71662531128dfd3718c8b', 1380.00, 'paid', 'ewc_0f8907ef-fae4-4cfb-877d-e4fc67765f1d', 'GCash', 14, '2026-11-13 21:53:37', '2026-11-13 21:53:53', NULL),
(21, 3, 9, 3, '6af71a7d458447fb0e1cb67b', 'https://checkout-staging.xendit.co/web/6af71a7d458447fb0e1cb67b', 535.20, 'paid', 'ewc_a89a7c20-8e61-4098-92a7-7e6a63db387e', 'GCash', 15, '2026-11-13 22:11:09', '2026-11-13 22:11:22', NULL),
(22, 21, 24, 9, '6af728cc531128dfd371a9ab', 'https://checkout-staging.xendit.co/web/6af728cc531128dfd371a9ab', 180.00, 'paid', 'ewc_ed83a726-2cce-4a29-9927-c3168c090ba2', 'GCash', 16, '2026-11-13 23:12:11', '2026-11-13 23:12:23', NULL),
(23, 22, 25, 9, '6af733ca4fcf7f2f30f5b2f3', 'https://checkout-staging.xendit.co/web/6af733ca4fcf7f2f30f5b2f3', 920.00, 'paid', 'ewc_3bb6b99f-4547-4cd8-bb43-44ef908d9f8b', 'GCash', 17, '2026-11-13 23:59:05', '2026-11-13 23:59:19', NULL),
(24, 24, 27, 3, '6af822c4458447fb0e1df896', 'https://checkout-staging.xendit.co/web/6af822c4458447fb0e1df896', 790.00, 'paid', 'ewc_ed4e0fd2-2d17-44c2-ba52-da58fcb73a9e', 'GCash', 18, '2026-11-14 16:58:43', '2026-11-14 16:58:59', NULL),
(25, 23, 26, 9, '6af85bcac9132dec3b97e102', 'https://checkout-staging.xendit.co/web/6af85bcac9132dec3b97e102', 860.00, 'paid', 'ewc_f862de36-aa46-4661-a6f2-69c912a80f24', 'GCash', 19, '2026-11-14 21:02:02', '2026-11-14 21:02:20', NULL),
(26, 26, 29, 9, '6af9237624d19f19a51dab85', 'https://checkout-staging.xendit.co/web/6af9237624d19f19a51dab85', 760.00, 'paid', 'ewc_7253e6ba-d290-4b39-81cf-da39e3e4e1d3', 'GCash', 20, '2026-11-15 11:13:57', '2026-11-15 11:14:12', NULL),
(27, 29, 30, 9, '6af9cc35e0cb8825cc40f295', 'https://checkout-staging.xendit.co/web/6af9cc35e0cb8825cc40f295', 860.00, 'paid', 'ewc_ba820be4-06fc-4ac8-b8df-7d5b54337da4', 'GCash', 21, '2026-11-15 23:13:56', '2026-11-15 23:14:11', NULL),
(28, 30, 31, 9, '6af9d85224d19f19a51e5a71', 'https://checkout-staging.xendit.co/web/6af9d85224d19f19a51e5a71', 860.00, 'paid', 'ewc_79008647-1974-4d52-9955-27363992d026', 'Maya', 22, '2026-11-16 00:05:37', '2026-11-16 00:05:52', NULL),
(29, 33, 32, 9, '6afa9f594de4ae59a687f071', 'https://checkout-staging.xendit.co/web/6afa9f594de4ae59a687f071', 1160.00, 'paid', 'ewc_6d569419-2baf-4fd8-a1c5-6069d8c2a345', 'GCash', 23, '2026-11-16 14:14:48', '2026-11-16 14:15:00', NULL),
(30, 35, 34, 9, '6afc138d0464d7814bdc305d', 'https://checkout-staging.xendit.co/web/6afc138d0464d7814bdc305d', 750.00, 'paid', 'ewc_35da98c2-9097-4a08-b39c-09156fcdd7a3', 'GCash', 24, '2026-11-17 16:42:51', '2026-11-17 16:43:10', NULL),
(31, 37, 36, 9, '6afc4d3d4f82d8bba60e94b0', 'https://checkout-staging.xendit.co/web/6afc4d3d4f82d8bba60e94b0', 700.00, 'paid', 'ewc_b38756de-e2eb-4433-9278-548cfbc4b1f3', 'GCash', 25, '2026-11-17 20:48:59', '2026-11-17 20:49:39', NULL),
(32, 38, 37, 9, '6afc64400464d7814bdca167', 'https://checkout-staging.xendit.co/web/6afc64400464d7814bdca167', 600.00, 'paid', 'ewc_3122225e-e923-4bd7-b5cb-89f2991da575', 'GCash', 26, '2026-11-17 22:27:11', '2026-11-17 22:27:28', NULL),
(33, 39, 38, 9, '6afd36e08e191c0c749e6beb', 'https://checkout-staging.xendit.co/web/6afd36e08e191c0c749e6beb', 600.00, 'paid', 'ewc_43f9ee0d-ea86-4e0f-8391-15a98ad7e8e5', 'Maya', 27, '2026-11-18 13:25:50', '2026-11-18 13:26:05', NULL),
(34, 40, 39, 9, '6afd38ce4f82d8bba610038b', 'https://checkout-staging.xendit.co/web/6afd38ce4f82d8bba610038b', 960.00, 'paid', 'ewc_fb35b0c4-38e0-4015-a39a-74aae3c43b3b', 'Maya', 28, '2026-11-18 13:34:04', '2026-11-18 13:34:19', NULL),
(35, 41, 41, 9, '6afd3ec902e57e0e3e788d00', 'https://checkout-staging.xendit.co/web/6afd3ec902e57e0e3e788d00', 690.00, 'paid', 'ewc_cadc35bf-deb3-4c4a-85aa-6efc5aad5344', 'GCash', 29, '2026-11-18 13:59:35', '2026-11-18 14:00:12', NULL),
(36, 45, 42, 9, '6afd977faddd094f2d6e1f1b', 'https://checkout-staging.xendit.co/web/6afd977faddd094f2d6e1f1b', 690.00, 'pending', NULL, NULL, NULL, '2026-11-18 20:18:06', NULL, NULL),
(37, 46, 43, 9, '6afd98e98e191c0c749ef353', 'https://checkout-staging.xendit.co/web/6afd98e98e191c0c749ef353', 600.00, 'paid', 'ewc_2e52a557-cb37-4cb0-b135-0b30459babee', 'GCash', 30, '2026-11-18 20:24:08', '2026-11-18 20:24:35', '2026-11-18 21:30:01'),
(38, 47, 44, 9, '6afd9de694c7a71c9c636da4', 'https://checkout-staging.xendit.co/web/6afd9de694c7a71c9c636da4', 1300.00, 'paid', 'ewc_6849243f-ddac-4de7-b37e-7bb2cdeb1052', 'GCash', 31, '2026-11-18 20:45:25', '2026-11-18 20:45:49', '2026-11-18 22:00:01'),
(39, 50, 46, 9, '6afdc6240464d7814bdea899', 'https://checkout-staging.xendit.co/web/6afdc6240464d7814bdea899', 1000.00, 'paid', 'ewc_99fb9ca4-45c2-4d13-8da4-afd7ae47b117', 'GCash', 32, '2026-11-18 23:37:07', '2026-11-18 23:37:46', '2026-11-19 11:00:01'),
(40, 56, 47, 9, '6afe8131cb1f3ec624219af5', 'https://checkout-staging.xendit.co/web/6afe8131cb1f3ec624219af5', 1500.00, 'paid', 'ewc_57fc1e41-9b42-4e9a-83f9-4f5e89187666', 'GCash', 33, '2026-11-19 12:55:11', '2026-11-19 12:56:30', '2026-11-19 14:00:00'),
(41, 60, 52, 9, '6afeed99712cc225a105837d', 'https://checkout-staging.xendit.co/web/6afeed99712cc225a105837d', 1100.00, 'pending', NULL, NULL, NULL, '2026-11-19 20:37:45', NULL, '2026-11-19 21:00:02'),
(42, 62, 54, 9, '6afefe3e2bc24d40d3885a29', 'https://checkout-staging.xendit.co/web/6afefe3e2bc24d40d3885a29', 2200.00, 'paid', 'ewc_698da63a-c9aa-49d0-b56d-0cb84d8a5891', 'GCash', 34, '2026-11-19 21:48:47', '2026-11-19 21:49:36', '2026-11-20 23:59:01');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activities`
--
ALTER TABLE `activities`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `fk_activities_contact` (`contact_id`),
  ADD KEY `fk_activities_lead` (`lead_id`),
  ADD KEY `fk_activities_deal` (`deal_id`),
  ADD KEY `fk_activities_ticket` (`ticket_id`),
  ADD KEY `fk_activities_assigned_user` (`assigned_user_id`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`booking_id`),
  ADD UNIQUE KEY `uq_booking_inquiry` (`inquiry_id`);

--
-- Indexes for table `booking_feedback`
--
ALTER TABLE `booking_feedback`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_feedback_booking` (`booking_id`);

--
-- Indexes for table `cib_attachment_reviews`
--
ALTER TABLE `cib_attachment_reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_msg_att` (`message_id`,`attachment_index`),
  ADD KEY `conversation_id` (`conversation_id`),
  ADD KEY `reference` (`reference`);

--
-- Indexes for table `cib_conversations`
--
ALTER TABLE `cib_conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `cib_messages`
--
ALTER TABLE `cib_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `conversation_id` (`conversation_id`);

--
-- Indexes for table `cib_tickets`
--
ALTER TABLE `cib_tickets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `cib_ticket_activity`
--
ALTER TABLE `cib_ticket_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indexes for table `cib_ticket_messages`
--
ALTER TABLE `cib_ticket_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indexes for table `cib_ticket_notes`
--
ALTER TABLE `cib_ticket_notes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ticket_id` (`ticket_id`);

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`contact_id`);

--
-- Indexes for table `deadline_reminders`
--
ALTER TABLE `deadline_reminders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_deadline_reminder` (`kind`,`ref_id`,`stage`);

--
-- Indexes for table `deals`
--
ALTER TABLE `deals`
  ADD PRIMARY KEY (`deal_id`),
  ADD UNIQUE KEY `lead_id` (`lead_id`),
  ADD KEY `fk_deals_assigned_user` (`assigned_user_id`);

--
-- Indexes for table `inquiry_assignment_history`
--
ALTER TABLE `inquiry_assignment_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `lead_id` (`lead_id`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`lead_id`),
  ADD KEY `fk_leads_contact` (`contact_id`),
  ADD KEY `fk_leads_assigned_user` (`assigned_user_id`);

--
-- Indexes for table `legal_documents`
--
ALTER TABLE `legal_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_doc_version` (`doc_type`,`version`),
  ADD KEY `idx_doc_current` (`doc_type`,`is_current`),
  ADD KEY `idx_created_by` (`created_by`);

--
-- Indexes for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`menu_item_id`),
  ADD KEY `idx_menu_category` (`category`);

--
-- Indexes for table `menu_item_tiers`
--
ALTER TABLE `menu_item_tiers`
  ADD PRIMARY KEY (`tier_id`),
  ADD KEY `idx_tier_item` (`menu_item_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_read` (`user_id`,`is_read`,`created_at`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`reset_id`),
  ADD UNIQUE KEY `uq_reset_token` (`token_hash`),
  ADD KEY `fk_reset_user` (`user_id`);

--
-- Indexes for table `payment_requests`
--
ALTER TABLE `payment_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pr_invoice` (`invoice_id`),
  ADD KEY `idx_pr_booking` (`booking_id`),
  ADD KEY `idx_pr_customer` (`customer_id`);

--
-- Indexes for table `paymongo_payments`
--
ALTER TABLE `paymongo_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_pm_session` (`checkout_session_id`),
  ADD UNIQUE KEY `uq_pm_payment` (`payment_id`),
  ADD KEY `idx_pm_inquiry` (`inquiry_id`);

--
-- Indexes for table `quotations`
--
ALTER TABLE `quotations`
  ADD PRIMARY KEY (`quotation_id`),
  ADD KEY `idx_quote_inquiry` (`inquiry_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD UNIQUE KEY `role_name` (`role_name`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`ticket_id`),
  ADD KEY `fk_tickets_contact` (`contact_id`),
  ADD KEY `fk_tickets_assigned_user` (`assigned_user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uq_users_phone` (`phone`),
  ADD KEY `fk_users_role` (`role_id`);

--
-- Indexes for table `user_legal_acceptances`
--
ALTER TABLE `user_legal_acceptances`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_doc` (`user_id`,`doc_type`,`version`);

--
-- Indexes for table `xendit_payments`
--
ALTER TABLE `xendit_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_xen_invoice` (`invoice_id`),
  ADD UNIQUE KEY `uq_xen_payment` (`payment_id`),
  ADD KEY `idx_xen_inquiry` (`inquiry_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activities`
--
ALTER TABLE `activities`
  MODIFY `activity_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `booking_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `booking_feedback`
--
ALTER TABLE `booking_feedback`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `cib_attachment_reviews`
--
ALTER TABLE `cib_attachment_reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `cib_conversations`
--
ALTER TABLE `cib_conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `cib_messages`
--
ALTER TABLE `cib_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=348;

--
-- AUTO_INCREMENT for table `cib_tickets`
--
ALTER TABLE `cib_tickets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `cib_ticket_activity`
--
ALTER TABLE `cib_ticket_activity`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `cib_ticket_messages`
--
ALTER TABLE `cib_ticket_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `cib_ticket_notes`
--
ALTER TABLE `cib_ticket_notes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `contact_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `deadline_reminders`
--
ALTER TABLE `deadline_reminders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=137;

--
-- AUTO_INCREMENT for table `deals`
--
ALTER TABLE `deals`
  MODIFY `deal_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inquiry_assignment_history`
--
ALTER TABLE `inquiry_assignment_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `lead_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=63;

--
-- AUTO_INCREMENT for table `legal_documents`
--
ALTER TABLE `legal_documents`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `menu_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `menu_item_tiers`
--
ALTER TABLE `menu_item_tiers`
  MODIFY `tier_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1089;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `reset_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `payment_requests`
--
ALTER TABLE `payment_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `paymongo_payments`
--
ALTER TABLE `paymongo_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `quotations`
--
ALTER TABLE `quotations`
  MODIFY `quotation_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=55;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `ticket_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `user_legal_acceptances`
--
ALTER TABLE `user_legal_acceptances`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `xendit_payments`
--
ALTER TABLE `xendit_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activities`
--
ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activities_assigned_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_activities_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`contact_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_activities_deal` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`deal_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_activities_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`lead_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_activities_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`) ON UPDATE CASCADE;

--
-- Constraints for table `deals`
--
ALTER TABLE `deals`
  ADD CONSTRAINT `fk_deals_assigned_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_deals_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`lead_id`) ON UPDATE CASCADE;

--
-- Constraints for table `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `fk_leads_assigned_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_leads_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`contact_id`) ON UPDATE CASCADE;

--
-- Constraints for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD CONSTRAINT `fk_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `fk_tickets_assigned_user` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tickets_contact` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`contact_id`) ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
