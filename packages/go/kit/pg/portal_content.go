package pg

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

const PortalHomeTerminalSlug = "portal-home"

var (
	ErrSiteContentMissing     = errors.New("required site_content row missing in PostgreSQL")
	ErrTerminalProfileMissing = errors.New("required terminal_profiles row missing in PostgreSQL")
	ErrCadencePresetsEmpty    = errors.New("required cadence_presets rows missing in PostgreSQL")
)

type TerminalInitialEntryRecord struct {
	Command       string
	Output        string
	Status        string
	DurationLabel string
	Timestamp     string
	SortOrder     int
}

type TerminalCommandRecord struct {
	Name          string
	Description   string
	Kind          string
	Output        string
	TargetRoute   *string
	AllowedRoutes []string
	ErrorTemplate *string
	SortOrder     int
}

type TerminalDirectoryEntryRecord struct {
	Name        string
	Description string
	SortOrder   int
	Enabled     bool
}

type TerminalProfileRecord struct {
	Slug           string
	BannerTitle    string
	BannerMeta     string
	OSLabel        string
	Directory      string
	VCSBranch      string
	VCSState       string
	ContextLabel   string
	Placeholder    string
	QuickCommands  []string
	InitialEntries []TerminalInitialEntryRecord
	Commands       []TerminalCommandRecord
}

// FormatTerminalDirectoryListing formats enabled directory entries identically to
// @aklapper/core's formatTerminalDirectoryListing (longestName + 3 space pad + "# description").
func FormatTerminalDirectoryListing(entries []TerminalDirectoryEntryRecord) string {
	if len(entries) == 0 {
		return ""
	}
	longest := 0
	for _, e := range entries {
		if len(e.Name) > longest {
			longest = len(e.Name)
		}
	}
	padWidth := longest + 3
	lines := make([]string, 0, len(entries))
	for _, e := range entries {
		pad := padWidth - len(e.Name)
		if pad < 1 {
			pad = 1
		}
		lines = append(lines, e.Name+strings.Repeat(" ", pad)+"# "+e.Description)
	}
	return strings.Join(lines, "\n")
}

func resolveTerminalLsOutput(cmdName, fallbackOutput string, dirListing *string) string {
	if dirListing != nil && strings.TrimSpace(cmdName) == "ls" {
		return *dirListing
	}
	return fallbackOutput
}

func (s *Store) LoadSiteContentJSON(ctx context.Context, key string) (string, error) {
	if s == nil || s.pool == nil {
		return "", ErrSiteContentMissing
	}
	var raw string
	err := s.pool.QueryRow(
		ctx,
		`SELECT metadata_json::text FROM site_content WHERE key = $1 LIMIT 1`,
		key,
	).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", fmt.Errorf("%w: key=%q", ErrSiteContentMissing, key)
	}
	if err != nil {
		return "", err
	}
	return raw, nil
}

func (s *Store) LoadTerminalProfile(ctx context.Context, slug string) (TerminalProfileRecord, error) {
	if s == nil || s.pool == nil {
		return TerminalProfileRecord{}, ErrTerminalProfileMissing
	}

	var profile TerminalProfileRecord
	err := s.pool.QueryRow(
		ctx,
		`SELECT slug, banner_title, banner_meta, os_label, directory, vcs_branch, vcs_state,
		        context_label, placeholder, quick_commands
		 FROM terminal_profiles
		 WHERE slug = $1
		 LIMIT 1`,
		slug,
	).Scan(
		&profile.Slug,
		&profile.BannerTitle,
		&profile.BannerMeta,
		&profile.OSLabel,
		&profile.Directory,
		&profile.VCSBranch,
		&profile.VCSState,
		&profile.ContextLabel,
		&profile.Placeholder,
		&profile.QuickCommands,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return TerminalProfileRecord{}, fmt.Errorf("%w: slug=%q", ErrTerminalProfileMissing, slug)
	}
	if err != nil {
		return TerminalProfileRecord{}, err
	}
	if profile.QuickCommands == nil {
		profile.QuickCommands = []string{}
	}

	dirRows, err := s.pool.Query(
		ctx,
		`SELECT name, description, sort_order, enabled
		 FROM terminal_directory_entries
		 WHERE profile_slug = $1 AND enabled = true
		 ORDER BY sort_order ASC, id ASC`,
		slug,
	)
	if err != nil {
		return TerminalProfileRecord{}, err
	}
	dirEntries := make([]TerminalDirectoryEntryRecord, 0)
	for dirRows.Next() {
		var d TerminalDirectoryEntryRecord
		if scanErr := dirRows.Scan(&d.Name, &d.Description, &d.SortOrder, &d.Enabled); scanErr != nil {
			dirRows.Close()
			return TerminalProfileRecord{}, scanErr
		}
		dirEntries = append(dirEntries, d)
	}
	if err := dirRows.Err(); err != nil {
		dirRows.Close()
		return TerminalProfileRecord{}, err
	}
	dirRows.Close()

	var dirListing *string
	if len(dirEntries) > 0 {
		formatted := FormatTerminalDirectoryListing(dirEntries)
		dirListing = &formatted
	}

	entryRows, err := s.pool.Query(
		ctx,
		`SELECT command, output, status, duration_label, timestamp_label, sort_order
		 FROM terminal_initial_entries
		 WHERE profile_slug = $1
		 ORDER BY sort_order ASC, id ASC`,
		slug,
	)
	if err != nil {
		return TerminalProfileRecord{}, err
	}
	profile.InitialEntries = make([]TerminalInitialEntryRecord, 0)
	for entryRows.Next() {
		var e TerminalInitialEntryRecord
		if scanErr := entryRows.Scan(&e.Command, &e.Output, &e.Status, &e.DurationLabel, &e.Timestamp, &e.SortOrder); scanErr != nil {
			entryRows.Close()
			return TerminalProfileRecord{}, scanErr
		}
		e.Output = resolveTerminalLsOutput(e.Command, e.Output, dirListing)
		profile.InitialEntries = append(profile.InitialEntries, e)
	}
	if err := entryRows.Err(); err != nil {
		entryRows.Close()
		return TerminalProfileRecord{}, err
	}
	entryRows.Close()

	cmdRows, err := s.pool.Query(
		ctx,
		`SELECT name, description, kind, output, target_route, allowed_routes, error_template, sort_order
		 FROM terminal_commands
		 WHERE profile_slug = $1
		 ORDER BY sort_order ASC, id ASC`,
		slug,
	)
	if err != nil {
		return TerminalProfileRecord{}, err
	}
	profile.Commands = make([]TerminalCommandRecord, 0)
	for cmdRows.Next() {
		var c TerminalCommandRecord
		if scanErr := cmdRows.Scan(&c.Name, &c.Description, &c.Kind, &c.Output, &c.TargetRoute, &c.AllowedRoutes, &c.ErrorTemplate, &c.SortOrder); scanErr != nil {
			cmdRows.Close()
			return TerminalProfileRecord{}, scanErr
		}
		c.Output = resolveTerminalLsOutput(c.Name, c.Output, dirListing)
		if c.AllowedRoutes == nil {
			c.AllowedRoutes = []string{}
		}
		profile.Commands = append(profile.Commands, c)
	}
	if err := cmdRows.Err(); err != nil {
		cmdRows.Close()
		return TerminalProfileRecord{}, err
	}
	cmdRows.Close()

	return profile, nil
}
