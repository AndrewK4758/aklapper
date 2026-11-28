package main

import (
	"context"
	"errors"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

type totpSecretRecord struct {
	UserID          string
	EncryptedSecret string
	Enabled         bool
	BackupCodesHash []string
}

func (d adminServiceDeps) getUserTotpSecret(ctx context.Context, userID string) (*totpSecretRecord, error) {
	pool := d.store.Pool()
	if pool == nil || !contracts.ValidateUUID(userID) {
		return nil, nil
	}
	var rec totpSecretRecord
	err := pool.QueryRow(
		ctx,
		`SELECT user_id::text, encrypted_secret, enabled, backup_codes_hash
		 FROM totp_secrets
		 WHERE user_id = $1::uuid
		 LIMIT 1`,
		userID,
	).Scan(&rec.UserID, &rec.EncryptedSecret, &rec.Enabled, &rec.BackupCodesHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if rec.BackupCodesHash == nil {
		rec.BackupCodesHash = []string{}
	}
	return &rec, nil
}

func (d adminServiceDeps) upsertUserTotpSecret(ctx context.Context, userID, encryptedSecret string, backupCodesHash []string, enabled bool) error {
	pool := d.store.Pool()
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	_, err := pool.Exec(
		ctx,
		`INSERT INTO totp_secrets (user_id, encrypted_secret, backup_codes_hash, enabled)
		 VALUES ($1::uuid, $2, $3, $4)
		 ON CONFLICT (user_id) DO UPDATE SET
		   encrypted_secret = EXCLUDED.encrypted_secret,
		   backup_codes_hash = EXCLUDED.backup_codes_hash,
		   enabled = EXCLUDED.enabled`,
		userID, encryptedSecret, backupCodesHash, enabled,
	)
	return err
}

func (d adminServiceDeps) enableUserTotpSecret(ctx context.Context, userID string) error {
	pool := d.store.Pool()
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	_, err := pool.Exec(ctx, `UPDATE totp_secrets SET enabled = true WHERE user_id = $1::uuid`, userID)
	return err
}

func (d adminServiceDeps) disableUserTotpSecret(ctx context.Context, userID string) error {
	pool := d.store.Pool()
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	_, err := pool.Exec(ctx, `DELETE FROM totp_secrets WHERE user_id = $1::uuid`, userID)
	return err
}

// consumeTotpBackupCode atomically removes a single matching backup code hash using PostgreSQL array_remove.
func (d adminServiceDeps) consumeTotpBackupCode(ctx context.Context, userID, codeHash string) (bool, error) {
	pool := d.store.Pool()
	if pool == nil {
		return false, errors.New("database pool not initialized")
	}
	var returned string
	err := pool.QueryRow(
		ctx,
		`UPDATE totp_secrets
		 SET backup_codes_hash = array_remove(backup_codes_hash, $2::text)
		 WHERE user_id = $1::uuid
		   AND $2::text = ANY(backup_codes_hash)
		 RETURNING user_id::text`,
		userID, codeHash,
	).Scan(&returned)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return returned != "", nil
}
