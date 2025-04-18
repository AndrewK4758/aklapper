-- CreateTable
CREATE TABLE "players" (
    "player_id" VARCHAR(6) NOT NULL,
    "player_name" VARCHAR NOT NULL,
    "current_time_entered" TIMESTAMPTZ(6) NOT NULL,
    "active_game_id" VARCHAR(6),
    "email" VARCHAR NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("player_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_email" ON "players"("email");

-- CreateIndex
CREATE INDEX "email_index" ON "players"("email");
