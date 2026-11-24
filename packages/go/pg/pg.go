package pg

import (
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
)

const DefaultDatabaseURL = "postgres://postgres:postgres@127.0.0.1:5432/aklapper?sslmode=disable"

type Config struct {
	DatabaseURL string
	MaxConns    int
}

func ConfigFromEnv() (Config, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		dsn = DefaultDatabaseURL
	}
	if err := ValidateDSN(dsn); err != nil {
		return Config{}, err
	}
	maxConns := 10
	if raw := os.Getenv("PG_MAX_CONNS"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			return Config{}, errors.New("PG_MAX_CONNS must be a positive integer")
		}
		maxConns = parsed
	}
	return Config{
		DatabaseURL: dsn,
		MaxConns:    maxConns,
	}, nil
}

func ValidateDSN(dsn string) error {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return err
	}
	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return errors.New("DATABASE_URL must use postgres:// or postgresql:// scheme")
	}
	if parsed.Host == "" {
		return errors.New("DATABASE_URL must include a host")
	}
	return nil
}
