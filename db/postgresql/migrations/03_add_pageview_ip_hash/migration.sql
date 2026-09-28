ALTER TABLE "pageview" ADD COLUMN "ip_hash" VARCHAR(64);
CREATE INDEX "pageview_ip_hash_idx" ON "pageview"("ip_hash");
