ALTER TABLE `pageview` ADD COLUMN `ip_hash` VARCHAR(64) NULL;
CREATE INDEX `pageview_ip_hash_idx` ON `pageview`(`ip_hash`);
