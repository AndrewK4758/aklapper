package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

type authUserRecord struct {
	ID                 string
	Handle             string
	Role               string
	PasswordHashArgon2 *string
}

type adminSessionRecord struct {
	SessionID    string
	UserID       string
	Role         string
	Handle       string
	ExpiresAt    time.Time
	TotpEnabled  bool
	PasskeyCount int
}

type webauthnCredentialRecord struct {
	CredentialID   string
	UserID         string
	PublicKey      string
	Counter        int
	Transports     []string
	BackupEligible *bool
	BackupState    *bool
}

type webauthnChallengeRecord struct {
	ID        string
	Challenge string
	UserID    *string
	Kind      string
	ExpiresAt time.Time
}

func (d adminServiceDeps) findAdminUserByHandle(ctx context.Context, handle string) (*authUserRecord, error) {
	pool := d.store.Pool()
	if pool == nil {
		return nil, errors.New("database pool not initialized")
	}
	norm := strings.ToLower(strings.TrimSpace(handle))
	if norm == "" {
		return nil, nil
	}
	var u authUserRecord
	err := pool.QueryRow(
		ctx,
		`SELECT id::text, handle, role, password_hash_argon2
		 FROM users
		 WHERE lower(handle) = $1
		 LIMIT 1`,
		norm,
	).Scan(&u.ID, &u.Handle, &u.Role, &u.PasswordHashArgon2)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (d adminServiceDeps) getUserByID(ctx context.Context, userID string) (*authUserRecord, error) {
	pool := d.store.Pool()
	if pool == nil || !contracts.ValidateUUID(userID) {
		return nil, nil
	}
	var u authUserRecord
	err := pool.QueryRow(
		ctx,
		`SELECT id::text, handle, role, password_hash_argon2
		 FROM users
		 WHERE id = $1::uuid
		 LIMIT 1`,
		userID,
	).Scan(&u.ID, &u.Handle, &u.Role, &u.PasswordHashArgon2)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (d adminServiceDeps) getValidAdminSession(ctx context.Context, sessionID string) (*adminSessionRecord, error) {
	pool := d.store.Pool()
	if pool == nil {
		return nil, errors.New("database pool not initialized")
	}
	if !contracts.ValidateUUID(sessionID) {
		return nil, nil
	}
	var rec adminSessionRecord
	var userID *string
	err := pool.QueryRow(
		ctx,
		`SELECT s.id::text, s.user_id::text, s.role, COALESCE(u.handle, s.role), s.expires_at,
		        COALESCE((SELECT t.enabled FROM totp_secrets t WHERE t.user_id = s.user_id LIMIT 1), false),
		        COALESCE((SELECT COUNT(*)::int FROM webauthn_credentials w WHERE w.user_id = s.user_id), 0)
		 FROM auth_sessions s
		 LEFT JOIN users u ON u.id = s.user_id
		 WHERE s.id = $1::uuid
		   AND s.revoked_at IS NULL
		   AND s.expires_at > NOW()
		 LIMIT 1`,
		sessionID,
	).Scan(&rec.SessionID, &userID, &rec.Role, &rec.Handle, &rec.ExpiresAt, &rec.TotpEnabled, &rec.PasskeyCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if userID != nil {
		rec.UserID = *userID
	}
	return &rec, nil
}

func (d adminServiceDeps) createAdminSession(ctx context.Context, userID, handle string, ttl time.Duration) (adminSessionRecord, error) {
	pool := d.store.Pool()
	if pool == nil {
		return adminSessionRecord{}, errors.New("database pool not initialized")
	}
	expiresAt := d.now().Add(ttl)
	var rec adminSessionRecord
	err := pool.QueryRow(
		ctx,
		`INSERT INTO auth_sessions (user_id, role, expires_at)
		 VALUES ($1::uuid, 'admin', $2)
		 RETURNING id::text, role, expires_at`,
		userID,
		expiresAt,
	).Scan(&rec.SessionID, &rec.Role, &rec.ExpiresAt)
	if err != nil {
		return adminSessionRecord{}, err
	}
	rec.UserID = userID
	rec.Handle = handle
	return rec, nil
}

func (d adminServiceDeps) revokeAuthSession(ctx context.Context, sessionID string) error {
	pool := d.store.Pool()
	if pool == nil || !contracts.ValidateUUID(sessionID) {
		return nil
	}
	_, err := pool.Exec(
		ctx,
		`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1::uuid AND revoked_at IS NULL`,
		sessionID,
	)
	return err
}

func (d adminServiceDeps) countUserPasskeys(ctx context.Context, userID string) (int, error) {
	pool := d.store.Pool()
	if pool == nil || !contracts.ValidateUUID(userID) {
		return 0, nil
	}
	var total int
	err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM webauthn_credentials WHERE user_id = $1::uuid`, userID).Scan(&total)
	return total, err
}

func (d adminServiceDeps) listUserWebauthnCredentials(ctx context.Context, userID string) ([]webauthnCredentialRecord, error) {
	pool := d.store.Pool()
	if pool == nil || !contracts.ValidateUUID(userID) {
		return nil, nil
	}
	rows, err := pool.Query(
		ctx,
		`SELECT credential_id, user_id::text, public_key, counter, transports, backup_eligible, backup_state
		 FROM webauthn_credentials
		 WHERE user_id = $1::uuid
		 ORDER BY created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]webauthnCredentialRecord, 0)
	for rows.Next() {
		var c webauthnCredentialRecord
		if err := rows.Scan(&c.CredentialID, &c.UserID, &c.PublicKey, &c.Counter, &c.Transports, &c.BackupEligible, &c.BackupState); err != nil {
			return nil, err
		}
		if c.Transports == nil {
			c.Transports = []string{}
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d adminServiceDeps) getWebauthnCredentialByID(ctx context.Context, credID string) (*webauthnCredentialRecord, error) {
	pool := d.store.Pool()
	if pool == nil || strings.TrimSpace(credID) == "" {
		return nil, nil
	}
	var c webauthnCredentialRecord
	err := pool.QueryRow(
		ctx,
		`SELECT credential_id, user_id::text, public_key, counter, transports, backup_eligible, backup_state
		 FROM webauthn_credentials
		 WHERE credential_id = $1
		 LIMIT 1`,
		credID,
	).Scan(&c.CredentialID, &c.UserID, &c.PublicKey, &c.Counter, &c.Transports, &c.BackupEligible, &c.BackupState)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if c.Transports == nil {
		c.Transports = []string{}
	}
	return &c, nil
}

func (d adminServiceDeps) saveWebauthnCredential(ctx context.Context, rec webauthnCredentialRecord) error {
	pool := d.store.Pool()
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	transports := rec.Transports
	if transports == nil {
		transports = []string{}
	}
	_, err := pool.Exec(
		ctx,
		`INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports, backup_eligible, backup_state)
		 VALUES ($1, $2::uuid, $3, $4, $5, $6, $7)
		 ON CONFLICT (credential_id) DO UPDATE SET
		   public_key = EXCLUDED.public_key,
		   counter = EXCLUDED.counter,
		   transports = EXCLUDED.transports,
		   backup_eligible = EXCLUDED.backup_eligible,
		   backup_state = EXCLUDED.backup_state`,
		rec.CredentialID, rec.UserID, rec.PublicKey, rec.Counter, transports, rec.BackupEligible, rec.BackupState,
	)
	return err
}

func (d adminServiceDeps) updateWebauthnCredentialAfterLogin(ctx context.Context, credID string, counter int, backupEligible, backupState bool) error {
	pool := d.store.Pool()
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	_, err := pool.Exec(
		ctx,
		`UPDATE webauthn_credentials
		 SET counter = $2,
		     backup_eligible = $3,
		     backup_state = $4
		 WHERE credential_id = $1`,
		credID, counter, backupEligible, backupState,
	)
	return err
}

func (d adminServiceDeps) createWebauthnChallenge(ctx context.Context, challenge string, userID *string, kind string, ttl time.Duration) (string, error) {
	pool := d.store.Pool()
	if pool == nil {
		return "", errors.New("database pool not initialized")
	}
	var id string
	err := pool.QueryRow(
		ctx,
		`INSERT INTO webauthn_challenges (challenge, user_id, kind, expires_at)
		 VALUES ($1, $2::uuid, $3, $4)
		 RETURNING id::text`,
		challenge, userID, kind, d.now().Add(ttl),
	).Scan(&id)
	return id, err
}

func (d adminServiceDeps) consumeWebauthnChallenge(ctx context.Context, challengeID, kind string) (*webauthnChallengeRecord, error) {
	pool := d.store.Pool()
	if pool == nil {
		return nil, errors.New("database pool not initialized")
	}
	if !contracts.ValidateUUID(challengeID) {
		return nil, nil
	}
	var rec webauthnChallengeRecord
	err := pool.QueryRow(
		ctx,
		`UPDATE webauthn_challenges
		 SET consumed_at = NOW()
		 WHERE id = $1::uuid
		   AND kind = $2
		   AND consumed_at IS NULL
		   AND expires_at > NOW()
		 RETURNING id::text, challenge, user_id::text, kind, expires_at`,
		challengeID, kind,
	).Scan(&rec.ID, &rec.Challenge, &rec.UserID, &rec.Kind, &rec.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}
