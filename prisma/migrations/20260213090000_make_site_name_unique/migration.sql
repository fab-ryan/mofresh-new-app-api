-- CreateIndex: Add unique constraint on sites.name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'sites' 
        AND indexname = 'sites_name_key'
    ) THEN
        CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");
    END IF;
END $$;
