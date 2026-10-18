-- Creates the app's OWN database and a least-privilege user. Touches nothing else.
-- Run as a MySQL admin (e.g. `sudo mysql < create-database.sql`, or paste into phpMyAdmin's SQL tab),
-- after replacing CHANGE_ME with a long random password (openssl rand -base64 24).
CREATE DATABASE IF NOT EXISTS `club_management` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'club_app'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP ON `club_management`.* TO 'club_app'@'localhost';
FLUSH PRIVILEGES;
