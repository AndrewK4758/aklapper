package pg

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5/pgconn"
)

type ContactConstraintError struct {
	ConstraintName string
	FieldErrors    map[string][]string
	Message        string
}

func (e *ContactConstraintError) Error() string { return e.Message }

var contactConstraintFieldMap = map[string]struct {
	field   string
	message string
}{
	"contact_name_length_check": {
		field:   "name",
		message: "Database constraint rejected Name (must be 2–120 non-whitespace characters).",
	},
	"contact_phone_format_check": {
		field:   "phone",
		message: "Database constraint rejected Phone format.",
	},
	"contact_email_format_check": {
		field:   "email",
		message: "Database constraint rejected Email format.",
	},
	"contact_message_length_check": {
		field:   "message",
		message: "Database constraint rejected Message (must be 10–4000 non-whitespace characters).",
	},
	"contact_attachment_consistency_check": {
		field:   "file",
		message: "Database constraint rejected File attachment metadata or size.",
	},
}

func classifyContactPGError(err error) *ContactConstraintError {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr == nil {
		return nil
	}
	if pgErr.Code != "23514" && pgErr.Code != "23502" {
		return nil
	}
	constraint := pgErr.ConstraintName
	if constraint == "" {
		constraint = pgErr.ColumnName
	}
	if constraint == "" {
		constraint = "unknown_constraint"
	}
	if mapped, ok := contactConstraintFieldMap[constraint]; ok {
		return &ContactConstraintError{
			ConstraintName: constraint,
			FieldErrors:    map[string][]string{mapped.field: {mapped.message}},
			Message:        mapped.message,
		}
	}
	if pgErr.Code == "23502" && pgErr.ColumnName != "" {
		field := pgErr.ColumnName
		if strings.HasPrefix(field, "attachment_") {
			field = "file"
		}
		msg := fmt.Sprintf(`Database NOT NULL constraint rejected missing field %q.`, pgErr.ColumnName)
		return &ContactConstraintError{
			ConstraintName: constraint,
			FieldErrors:    map[string][]string{field: {msg}},
			Message:        msg,
		}
	}
	return &ContactConstraintError{
		ConstraintName: constraint,
		FieldErrors:    map[string][]string{},
		Message:        fmt.Sprintf("Database constraint violation (%s).", constraint),
	}
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr != nil && pgErr.Code == "23503"
}

type ContactSubmissionInsertInput struct {
	Name                    string
	Phone                   *string
	Email                   string
	Message                 string
	AttachmentName          *string
	AttachmentMimeType      *string
	AttachmentSizeBytes     *int32
	AttachmentSHA256        *string
	AttachmentContentBase64 *string
	AnalyticsSessionID      *string
	GuestSessionID          *string
}

type ContactSubmissionSummaryRecord struct {
	ID                  string
	Name                string
	Email               string
	Phone               *string
	AttachmentName      *string
	AttachmentSizeBytes *int32
	AttachmentSHA256    *string
	CreatedAt           string
}

// InsertContactSubmissionNoReturning executes a plain INSERT with Go-generated UUIDv4 and UTC
// created_at and ZERO RETURNING clause so portal_app never requires SELECT on contact_submissions.
// On SQLSTATE 23503 (FK violation on analytics_session_id), retries once with NULL.
func (s *Store) InsertContactSubmissionNoReturning(
	ctx context.Context,
	in ContactSubmissionInsertInput,
) (ContactSubmissionSummaryRecord, bool, error) {
	id := contracts.NewUUIDv4()
	createdAt := time.Now().UTC()
	summary := ContactSubmissionSummaryRecord{
		ID:                  id,
		Name:                in.Name,
		Email:               in.Email,
		Phone:               in.Phone,
		AttachmentName:      in.AttachmentName,
		AttachmentSizeBytes: in.AttachmentSizeBytes,
		AttachmentSHA256:    in.AttachmentSHA256,
		CreatedAt:           createdAt.Format(time.RFC3339Nano),
	}
	if s == nil || s.pool == nil {
		return summary, false, nil
	}

	insertSQL := `INSERT INTO contact_submissions (
		id, name, phone, email, message,
		attachment_name, attachment_mime_type, attachment_size_bytes,
		attachment_sha256, attachment_content_base64,
		analytics_session_id, guest_session_id, created_at
	) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	execInsert := func(sessionID *string) error {
		_, err := s.pool.Exec(
			ctx,
			insertSQL,
			id,
			in.Name,
			in.Phone,
			in.Email,
			in.Message,
			in.AttachmentName,
			in.AttachmentMimeType,
			in.AttachmentSizeBytes,
			in.AttachmentSHA256,
			in.AttachmentContentBase64,
			sessionID,
			in.GuestSessionID,
			createdAt,
		)
		return err
	}

	err := execInsert(in.AnalyticsSessionID)
	if err != nil {
		if in.AnalyticsSessionID != nil && strings.TrimSpace(*in.AnalyticsSessionID) != "" && isForeignKeyViolation(err) {
			if retryErr := execInsert(nil); retryErr != nil {
				if mapped := classifyContactPGError(retryErr); mapped != nil {
					return ContactSubmissionSummaryRecord{}, true, mapped
				}
				return ContactSubmissionSummaryRecord{}, true, retryErr
			}
			return summary, true, nil
		}
		if mapped := classifyContactPGError(err); mapped != nil {
			return ContactSubmissionSummaryRecord{}, false, mapped
		}
		return ContactSubmissionSummaryRecord{}, false, err
	}
	return summary, false, nil
}

func (s *Store) RecordContactSubmittedEvent(ctx context.Context, analyticsSessionID string, now time.Time) {
	sid := strings.TrimSpace(analyticsSessionID)
	if sid == "" || s == nil || s.pool == nil {
		return
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if _, err := s.pool.Exec(
		ctx,
		`INSERT INTO analytics_events (session_id, type, name, path, value, metadata_json, created_at)
		 VALUES ($1, 'interaction', 'contact_submitted', '/contact', NULL, '{"app":"portal"}'::jsonb, $2)`,
		sid,
		now.UTC(),
	); err != nil {
		emitPortalPGSeam("BOUNDARY_FAULT", "portal.contact.analytics_event_insert_failed", map[string]any{
			"detail": err.Error(),
		})
	}
}
