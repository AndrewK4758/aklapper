-- Create the schema defined in your Prisma datasource
CREATE SCHEMA IF NOT EXISTS games;

-- Create the table based on your Prisma model
CREATE TABLE games.players (
    player_id VARCHAR(6) PRIMARY KEY,
    player_name VARCHAR NOT NULL,
    current_time_entered TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_game_id VARCHAR(6),
    email VARCHAR UNIQUE NOT NULL
);

-- Create the index defined in your Prisma model
CREATE INDEX email_index ON games.players (email);
-- Seed some users
INSERT INTO games.players (player_id, player_name, email) VALUES
('P00001', 'Alice Gamer', 'alice@example.com'),
('P00002', 'Bob Player', 'bob@example.com'),
('P00003', 'Charlie Dev', 'charlie@example.com');