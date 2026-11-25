package pg

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode"
)

var lexicalStopwords = map[string]struct{}{
	"about": {}, "after": {}, "all": {}, "also": {}, "am": {}, "an": {}, "and": {}, "any": {},
	"are": {}, "as": {}, "at": {}, "be": {}, "been": {}, "before": {}, "being": {}, "between": {},
	"both": {}, "but": {}, "by": {}, "can": {}, "could": {}, "describe": {}, "did": {}, "do": {},
	"does": {}, "doing": {}, "done": {}, "each": {}, "explain": {}, "for": {}, "from": {},
	"get": {}, "had": {}, "has": {}, "have": {}, "he": {}, "her": {}, "here": {}, "him": {},
	"his": {}, "how": {}, "if": {}, "in": {}, "into": {}, "is": {}, "it": {}, "its": {},
	"just": {}, "kind": {}, "kinds": {}, "like": {}, "make": {}, "many": {}, "may": {}, "me": {},
	"more": {}, "most": {}, "my": {}, "no": {}, "not": {}, "now": {}, "of": {}, "on": {},
	"one": {}, "only": {}, "or": {}, "other": {}, "our": {}, "out": {}, "over": {}, "please": {},
	"share": {}, "she": {}, "should": {}, "show": {}, "so": {}, "some": {}, "such": {}, "tell": {},
	"than": {}, "that": {}, "the": {}, "their": {}, "them": {}, "then": {}, "there": {},
	"these": {}, "they": {}, "this": {}, "those": {}, "through": {}, "to": {}, "up": {}, "us": {},
	"use": {}, "used": {}, "using": {}, "very": {}, "want": {}, "was": {}, "we": {}, "were": {},
	"what": {}, "when": {}, "where": {}, "which": {}, "while": {}, "who": {}, "whom": {}, "why": {},
	"will": {}, "with": {}, "work": {}, "worked": {}, "would": {}, "you": {}, "your": {},
}

var lexicalOwnerNameTokens = map[string]struct{}{
	"andrew": {}, "klapper": {},
}

// buildLexicalOrQuery extracts sanitized ASCII alphanumeric tokens into a bounded disjunctive
// PostgreSQL tsquery string ("tok1 | tok2 | ...") so natural-language questions and long JDs
// score overlapping dossier terms rather than requiring every conversational word to match.
func buildLexicalOrQuery(raw string) string {
	var tokens []string
	var nameTokens []string
	seen := make(map[string]struct{})
	var cur strings.Builder

	flush := func() {
		if cur.Len() == 0 {
			return
		}
		tok := strings.ToLower(cur.String())
		cur.Reset()
		if len(tok) < 2 {
			return
		}
		if _, stop := lexicalStopwords[tok]; stop {
			return
		}
		if _, dup := seen[tok]; dup {
			return
		}
		seen[tok] = struct{}{}
		if _, isName := lexicalOwnerNameTokens[tok]; isName {
			nameTokens = append(nameTokens, tok)
			return
		}
		tokens = append(tokens, tok)
	}

	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			cur.WriteRune(unicode.ToLower(r))
		} else {
			flush()
		}
	}
	flush()

	if len(tokens) == 0 {
		tokens = nameTokens
	}
	if len(tokens) > 24 {
		tokens = tokens[:24]
	}
	return strings.Join(tokens, " | ")
}

// TryAcquireReindexLock acquires a session-pinned PostgreSQL advisory lock on a dedicated pooled
// connection so concurrent CLI qdrant-seed and HTTP /v1/ask/reindex runs never cross-prune points.
// Any ambiguous lock or unlock error closes the underlying connection before returning it to the pool
// so a session holding an advisory lock is never recycled to subsequent callers.
func (s *Store) TryAcquireReindexLock(ctx context.Context) (func(context.Context) error, bool, error) {
	if s == nil || s.pool == nil {
		if s == nil {
			return func(context.Context) error { return nil }, true, nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.reindexLocked {
			return nil, false, nil
		}
		s.reindexLocked = true
		var once sync.Once
		return func(context.Context) error {
			once.Do(func() {
				s.mu.Lock()
				s.reindexLocked = false
				s.mu.Unlock()
			})
			return nil
		}, true, nil
	}

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("acquire reindex lock connection: %w", err)
	}
	var acquired bool
	if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock(hashtext($1))`, reindexAdvisoryLockKey).Scan(&acquired); err != nil {
		closeCtx, cancelClose := context.WithTimeout(context.Background(), 2*time.Second)
		_ = conn.Conn().Close(closeCtx)
		cancelClose()
		conn.Release()
		return nil, false, fmt.Errorf("pg_try_advisory_lock: %w", err)
	}
	if !acquired {
		conn.Release()
		return nil, false, nil
	}

	var once sync.Once
	release := func(releaseCtx context.Context) error {
		var unlockErr error
		once.Do(func() {
			defer conn.Release()
			baseCtx := releaseCtx
			if baseCtx == nil {
				baseCtx = context.Background()
			}
			unlockCtx, cancel := context.WithTimeout(context.WithoutCancel(baseCtx), 5*time.Second)
			defer cancel()
			var unlocked bool
			unlockErr = conn.QueryRow(unlockCtx, `SELECT pg_advisory_unlock(hashtext($1))`, reindexAdvisoryLockKey).Scan(&unlocked)
			if unlockErr != nil || !unlocked {
				closeCtx, cancelClose := context.WithTimeout(context.Background(), 2*time.Second)
				_ = conn.Conn().Close(closeCtx)
				cancelClose()
				if unlockErr == nil {
					unlockErr = fmt.Errorf("pg_advisory_unlock returned false for %s", reindexAdvisoryLockKey)
				}
			}
		})
		return unlockErr
	}
	return release, true, nil
}
