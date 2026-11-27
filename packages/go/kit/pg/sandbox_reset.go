package pg

import (
	"context"
	"strings"
)

// ClearSandboxRunsForSession deletes strictly non-golden sandbox runs owned by sessionID
// (cascading sandbox_turns via foreign key). Golden showcase runs are never deleted.
func (s *Store) ClearSandboxRunsForSession(ctx context.Context, sessionID string) (int, error) {
	trimmed := strings.TrimSpace(sessionID)
	if s == nil || trimmed == "" {
		return 0, nil
	}

	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		kept := make([]*SandboxRun, 0, len(s.runs))
		deleted := 0
		for _, r := range s.runs {
			if r != nil && !r.IsGolden && r.SessionID == trimmed {
				delete(s.runsByID, r.RunID)
				deleted++
				continue
			}
			kept = append(kept, r)
		}
		s.runs = kept
		return deleted, nil
	}

	tag, err := s.pool.Exec(
		ctx,
		`DELETE FROM sandbox_runs WHERE session_id = $1 AND is_golden = false`,
		trimmed,
	)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}
