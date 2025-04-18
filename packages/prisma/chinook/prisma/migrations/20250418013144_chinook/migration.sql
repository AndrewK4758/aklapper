-- CreateTable
CREATE TABLE "album" (
    "title" VARCHAR(160) NOT NULL,
    "artist_id" INTEGER NOT NULL,
    "album_id" SERIAL NOT NULL,

    CONSTRAINT "album_pkey" PRIMARY KEY ("album_id")
);

-- CreateTable
CREATE TABLE "artist" (
    "name" VARCHAR(120),
    "artist_id" SERIAL NOT NULL,

    CONSTRAINT "artist_pkey" PRIMARY KEY ("artist_id")
);

-- CreateTable
CREATE TABLE "customer" (
    "customer_id" INTEGER NOT NULL,
    "first_name" VARCHAR(40) NOT NULL,
    "last_name" VARCHAR(20) NOT NULL,
    "company" VARCHAR(80),
    "address" VARCHAR(70),
    "city" VARCHAR(40),
    "state" VARCHAR(40),
    "country" VARCHAR(40),
    "postal_code" VARCHAR(10),
    "phone" VARCHAR(24),
    "fax" VARCHAR(24),
    "email" VARCHAR(60) NOT NULL,
    "support_rep_id" INTEGER,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "employee" (
    "employee_id" INTEGER NOT NULL,
    "last_name" VARCHAR(20) NOT NULL,
    "first_name" VARCHAR(20) NOT NULL,
    "title" VARCHAR(30),
    "reports_to" INTEGER,
    "birth_date" TIMESTAMP(6),
    "hire_date" TIMESTAMP(6),
    "address" VARCHAR(70),
    "city" VARCHAR(40),
    "state" VARCHAR(40),
    "country" VARCHAR(40),
    "postal_code" VARCHAR(10),
    "phone" VARCHAR(24),
    "fax" VARCHAR(24),
    "email" VARCHAR(60),

    CONSTRAINT "employee_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "genre" (
    "genre_id" INTEGER NOT NULL,
    "name" VARCHAR(120),

    CONSTRAINT "genre_pkey" PRIMARY KEY ("genre_id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "invoice_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "invoice_date" TIMESTAMP(6) NOT NULL,
    "billing_address" VARCHAR(70),
    "billing_city" VARCHAR(40),
    "billing_state" VARCHAR(40),
    "billing_country" VARCHAR(40),
    "billing_postal_code" VARCHAR(10),
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "invoice_line_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "track_id" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("invoice_line_id")
);

-- CreateTable
CREATE TABLE "media_type" (
    "media_type_id" INTEGER NOT NULL,
    "name" VARCHAR(120),

    CONSTRAINT "media_type_pkey" PRIMARY KEY ("media_type_id")
);

-- CreateTable
CREATE TABLE "playlist" (
    "playlist_id" INTEGER NOT NULL,
    "name" VARCHAR(120),

    CONSTRAINT "playlist_pkey" PRIMARY KEY ("playlist_id")
);

-- CreateTable
CREATE TABLE "playlist_track" (
    "playlist_id" INTEGER NOT NULL,
    "track_id" INTEGER NOT NULL,

    CONSTRAINT "playlist_track_pkey" PRIMARY KEY ("playlist_id","track_id")
);

-- CreateTable
CREATE TABLE "track" (
    "track_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "album_id" INTEGER,
    "media_type_id" INTEGER NOT NULL,
    "genre_id" INTEGER,
    "composer" VARCHAR(220),
    "milliseconds" INTEGER NOT NULL,
    "bytes" INTEGER,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "track_pkey" PRIMARY KEY ("track_id")
);

-- CreateIndex
CREATE INDEX "album_artist_id_idx" ON "album"("artist_id");

-- CreateIndex
CREATE INDEX "customer_support_rep_id_idx" ON "customer"("support_rep_id");

-- CreateIndex
CREATE INDEX "employee_reports_to_idx" ON "employee"("reports_to");

-- CreateIndex
CREATE INDEX "invoice_customer_id_idx" ON "invoice"("customer_id");

-- CreateIndex
CREATE INDEX "invoice_line_invoice_id_idx" ON "invoice_line"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_line_track_id_idx" ON "invoice_line"("track_id");

-- CreateIndex
CREATE INDEX "playlist_track_playlist_id_idx" ON "playlist_track"("playlist_id");

-- CreateIndex
CREATE INDEX "playlist_track_track_id_idx" ON "playlist_track"("track_id");

-- CreateIndex
CREATE INDEX "track_album_id_idx" ON "track"("album_id");

-- CreateIndex
CREATE INDEX "track_genre_id_idx" ON "track"("genre_id");

-- CreateIndex
CREATE INDEX "track_media_type_id_idx" ON "track"("media_type_id");

-- AddForeignKey
ALTER TABLE "album" ADD CONSTRAINT "album_artist_fkey" FOREIGN KEY ("artist_id") REFERENCES "artist"("artist_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_support_rep_id_fkey" FOREIGN KEY ("support_rep_id") REFERENCES "employee"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_reports_to_fkey" FOREIGN KEY ("reports_to") REFERENCES "employee"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("invoice_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_track_fkey" FOREIGN KEY ("track_id") REFERENCES "track"("track_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_track" ADD CONSTRAINT "playlist_track_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlist"("playlist_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "playlist_track" ADD CONSTRAINT "playlist_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "track"("track_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "track" ADD CONSTRAINT "album_id_album_fkey" FOREIGN KEY ("album_id") REFERENCES "album"("album_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "track" ADD CONSTRAINT "track_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genre"("genre_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "track" ADD CONSTRAINT "track_media_type_id_fkey" FOREIGN KEY ("media_type_id") REFERENCES "media_type"("media_type_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
