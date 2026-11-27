package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/jackc/pgx/v5/pgconn"
)

func logPortalSeam(seamType, event string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func resolveCorrID(ctx context.Context) string {
	if c := grpckit.CorrelationIDFromContext(ctx); c != "" {
		return c
	}
	return contracts.NewUUIDv4()
}

func newPortalError(
	connectCode connect.Code,
	appCode string,
	httpStatus int,
	msg string,
	action string,
	corrID string,
	fieldErrors map[string][]string,
	retryAfterSeconds *int32,
) *connect.Error {
	if corrID == "" {
		corrID = contracts.NewUUIDv4()
	}
	return grpckit.NewDetailedConnectErrorWithRetryAfter(
		connectCode,
		grpckit.ToProtoPublicError(&contracts.PublicAppError{
			Code:          appCode,
			Status:        httpStatus,
			Message:       msg,
			Action:        action,
			CorrelationID: corrID,
			FieldErrors:   fieldErrors,
		}),
		nil,
		retryAfterSeconds,
	)
}

func mapStoreErrorToConnect(err error, corrID string) *connect.Error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr != nil {
		if pgErr.Code == "42501" {
			logPortalSeam("UNSOUND_CONDITION", "portal_app.privilege.boundary_denied", map[string]any{
				"sqlState":      pgErr.Code,
				"correlationId": corrID,
			})
			return newPortalError(
				connect.CodePermissionDenied,
				contracts.ErrCodeForbidden,
				http.StatusForbidden,
				"Permission denied for action.",
				"Return home or sign in again.",
				corrID,
				nil,
				nil,
			)
		}
		if strings.HasPrefix(pgErr.Code, "08") || strings.HasPrefix(pgErr.Code, "57P") || pgErr.Code == "53300" {
			return newPortalError(
				connect.CodeUnavailable,
				contracts.ErrCodeDbUnavailable,
				http.StatusServiceUnavailable,
				"Database temporarily unavailable.",
				"Retry shortly or share ID.",
				corrID,
				nil,
				nil,
			)
		}
	}
	if errors.Is(err, pg.ErrSiteContentMissing) || errors.Is(err, pg.ErrTerminalProfileMissing) || errors.Is(err, pg.ErrCadencePresetsEmpty) {
		return newPortalError(
			connect.CodeFailedPrecondition,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
			nil,
		)
	}
	return newPortalError(
		connect.CodeUnavailable,
		contracts.ErrCodeDbUnavailable,
		http.StatusServiceUnavailable,
		"Database temporarily unavailable.",
		"Retry shortly or share ID.",
		corrID,
		nil,
		nil,
	)
}

func toProtoTerminalProfile(rec pg.TerminalProfileRecord) *portalv1.TerminalProfileData {
	entries := make([]*portalv1.TerminalInitialEntry, 0, len(rec.InitialEntries))
	for _, e := range rec.InitialEntries {
		entries = append(entries, &portalv1.TerminalInitialEntry{
			Command:       e.Command,
			Output:        e.Output,
			Status:        e.Status,
			DurationLabel: e.DurationLabel,
			Timestamp:     e.Timestamp,
			SortOrder:     int32(e.SortOrder),
		})
	}
	cmds := make([]*portalv1.TerminalCommandSpec, 0, len(rec.Commands))
	for _, c := range rec.Commands {
		cmds = append(cmds, &portalv1.TerminalCommandSpec{
			Name:          c.Name,
			Description:   c.Description,
			Kind:          c.Kind,
			Output:        c.Output,
			TargetRoute:   c.TargetRoute,
			AllowedRoutes: append([]string(nil), c.AllowedRoutes...),
			ErrorTemplate: c.ErrorTemplate,
			SortOrder:     int32(c.SortOrder),
		})
	}
	return &portalv1.TerminalProfileData{
		Slug:           rec.Slug,
		BannerTitle:    rec.BannerTitle,
		BannerMeta:     rec.BannerMeta,
		OsLabel:        rec.OSLabel,
		Directory:      rec.Directory,
		VcsBranch:      rec.VCSBranch,
		VcsState:       rec.VCSState,
		ContextLabel:   rec.ContextLabel,
		Placeholder:    rec.Placeholder,
		QuickCommands:  append([]string(nil), rec.QuickCommands...),
		InitialEntries: entries,
		Commands:       cmds,
	}
}

func toProtoCareerDossier(d pg.PortalCareerDossierRecord) *portalv1.CareerDossier {
	sections := make([]*portalv1.CareerDossierSection, 0, len(d.Sections))
	for _, s := range d.Sections {
		sections = append(sections, &portalv1.CareerDossierSection{
			Heading: s.Heading,
			Body:    s.Body,
		})
	}
	return &portalv1.CareerDossier{
		Slug:                   d.Slug,
		Kind:                   d.Kind,
		Title:                  d.Title,
		DomainLabel:            d.DomainLabel,
		RoleTitle:              d.RoleTitle,
		Timeframe:              d.Timeframe,
		Skills:                 append([]string(nil), d.Skills...),
		SummaryBody:            d.SummaryBody,
		Sections:               sections,
		PublishStatus:          d.PublishStatus,
		SanitizationVerifiedAt: d.SanitizationVerifiedAt,
		DenylistHash:           d.DenylistHash,
		SortOrder:              int32(d.SortOrder),
		UpdatedAt:              d.UpdatedAt,
	}
}

func toProtoCadencePreset(p contracts.CadencePreset) *portalv1.CadencePreset {
	return &portalv1.CadencePreset{
		Slug:                p.Slug,
		Title:               p.Title,
		StarterPrompt:       p.StarterPrompt,
		ExpectedKind:        p.ExpectedKind,
		StarterArtifactHtml: p.StarterArtifactHTML,
		SortOrder:           int32(p.SortOrder),
	}
}

func toProtoAgensiSkill(s agensi.Skill) *portalv1.AgensiSkill {
	return &portalv1.AgensiSkill{
		Slug:          s.Slug,
		Name:          s.Name,
		Summary:       s.Summary,
		Tags:          append([]string(nil), s.Tags...),
		Url:           s.URL,
		SortOrder:     int32(s.SortOrder),
		CreatorHandle: s.CreatorHandle,
		IsPublished:   s.IsPublished,
		SyncedAt:      s.SyncedAt,
		Source:        s.Source,
	}
}

func formatOptISO(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(time.RFC3339Nano)
	return &s
}

func toProtoAgensiSyncState(rec *pg.AgensiSyncStateRecord) *portalv1.AgensiSyncState {
	if rec == nil {
		return nil
	}
	return &portalv1.AgensiSyncState{
		CreatorHandle: rec.CreatorHandle,
		LastSyncedAt:  formatOptISO(rec.LastSyncedAt),
		LastAttemptAt: formatOptISO(rec.LastAttemptAt),
		LastStatus:    rec.LastStatus,
		LastError:     rec.LastError,
		ItemCount:     int32(rec.ItemCount),
	}
}

func toProtoContactSummary(rec pg.ContactSubmissionSummaryRecord) *portalv1.ContactSubmissionSummary {
	return &portalv1.ContactSubmissionSummary{
		Id:                  rec.ID,
		Name:                rec.Name,
		Email:               rec.Email,
		Phone:               rec.Phone,
		AttachmentName:      rec.AttachmentName,
		AttachmentSizeBytes: rec.AttachmentSizeBytes,
		AttachmentSha256:    rec.AttachmentSHA256,
		CreatedAt:           rec.CreatedAt,
	}
}
