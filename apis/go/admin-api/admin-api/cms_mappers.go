package main

import (
	"context"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

func (s *adminCmsServiceServer) authorizeAndValidateFields(
	ctx context.Context,
	headers http.Header,
	errMsg string,
	action string,
	required []string,
	optional []string,
) (string, []string, error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, headers, ""); err != nil {
		return "", nil, err
	}
	trimmed := make([]string, len(required))
	for i, v := range required {
		t := strings.TrimSpace(v)
		if t == "" || containsNul(t) {
			return "", nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, errMsg, action, corrID, nil)
		}
		trimmed[i] = t
	}
	for _, v := range optional {
		if containsNul(v) {
			return "", nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, errMsg, action, corrID, nil)
		}
	}
	return corrID, trimmed, nil
}

func toProtoTerminalProfile(p pg.TerminalProfileRecord) *portalv1.TerminalProfileData {
	initialEntries := make([]*portalv1.TerminalInitialEntry, 0, len(p.InitialEntries))
	for _, e := range p.InitialEntries {
		initialEntries = append(initialEntries, &portalv1.TerminalInitialEntry{
			Command:       e.Command,
			Output:        e.Output,
			Status:        e.Status,
			DurationLabel: e.DurationLabel,
			Timestamp:     e.Timestamp,
			SortOrder:     int32(e.SortOrder),
		})
	}
	commands := make([]*portalv1.TerminalCommandSpec, 0, len(p.Commands))
	for _, c := range p.Commands {
		commands = append(commands, &portalv1.TerminalCommandSpec{
			Name:          c.Name,
			Description:   c.Description,
			Kind:          c.Kind,
			Output:        c.Output,
			TargetRoute:   c.TargetRoute,
			AllowedRoutes: c.AllowedRoutes,
			ErrorTemplate: c.ErrorTemplate,
			SortOrder:     int32(c.SortOrder),
		})
	}
	return &portalv1.TerminalProfileData{
		Slug:           p.Slug,
		BannerTitle:    p.BannerTitle,
		BannerMeta:     p.BannerMeta,
		OsLabel:        p.OSLabel,
		Directory:      p.Directory,
		VcsBranch:      p.VCSBranch,
		VcsState:       p.VCSState,
		ContextLabel:   p.ContextLabel,
		Placeholder:    p.Placeholder,
		QuickCommands:  p.QuickCommands,
		InitialEntries: initialEntries,
		Commands:       commands,
	}
}

func toProtoAgensiSkills(skills []agensi.Skill) []*portalv1.AgensiSkill {
	out := make([]*portalv1.AgensiSkill, 0, len(skills))
	for _, sk := range skills {
		tags := sk.Tags
		if tags == nil {
			tags = []string{}
		}
		out = append(out, &portalv1.AgensiSkill{
			Slug:          sk.Slug,
			Name:          sk.Name,
			Summary:       sk.Summary,
			Tags:          tags,
			Url:           sk.URL,
			SortOrder:     int32(sk.SortOrder),
			CreatorHandle: sk.CreatorHandle,
			IsPublished:   sk.IsPublished,
			SyncedAt:      sk.SyncedAt,
			Source:        sk.Source,
		})
	}
	return out
}

func toProtoAgensiSyncState(rec *pg.AgensiSyncStateRecord) *portalv1.AgensiSyncState {
	if rec == nil {
		return nil
	}
	return &portalv1.AgensiSyncState{
		CreatorHandle: rec.CreatorHandle,
		LastSyncedAt:  optionalRFC3339Millis(rec.LastSyncedAt),
		LastAttemptAt: optionalRFC3339Millis(rec.LastAttemptAt),
		LastStatus:    rec.LastStatus,
		LastError:     rec.LastError,
		ItemCount:     int32(rec.ItemCount),
	}
}

func toProtoCareerDossier(rec pg.PortalCareerDossierRecord) *portalv1.CareerDossier {
	sections := make([]*portalv1.CareerDossierSection, 0, len(rec.Sections))
	for _, sec := range rec.Sections {
		sections = append(sections, &portalv1.CareerDossierSection{
			Heading: sec.Heading,
			Body:    sec.Body,
		})
	}
	skills := rec.Skills
	if skills == nil {
		skills = []string{}
	}
	return &portalv1.CareerDossier{
		Slug:                   rec.Slug,
		Kind:                   rec.Kind,
		Title:                  rec.Title,
		DomainLabel:            rec.DomainLabel,
		RoleTitle:              rec.RoleTitle,
		Timeframe:              rec.Timeframe,
		Skills:                 skills,
		SummaryBody:            rec.SummaryBody,
		Sections:               sections,
		PublishStatus:          rec.PublishStatus,
		SanitizationVerifiedAt: rec.SanitizationVerifiedAt,
		DenylistHash:           rec.DenylistHash,
		SortOrder:              int32(rec.SortOrder),
		UpdatedAt:              rec.UpdatedAt,
	}
}
