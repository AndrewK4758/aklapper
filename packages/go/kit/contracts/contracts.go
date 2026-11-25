package contracts

import (
	"errors"
	"strings"
	"time"
)

const (
	// AdminNamespace is strictly isolated from public guest telemetry.
	AdminNamespace  = "cadence-admin"
	PublicNamespace = "portfolio-public"

	RoleGuest = "guest"
	RoleAdmin = "admin"

	TurnStatusPending   = "pending"
	TurnStatusRunning   = "running"
	TurnStatusCompleted = "completed"
	TurnStatusAbstained = "abstained"
	TurnStatusFailed    = "failed"
	TurnStatusExpired   = "expired"

	CadenceModeFast = "fast"
	CadenceModeLLM  = "llm"

	CadenceExecutionModeGolden   = "golden"
	CadenceExecutionModeCached   = "cached"
	CadenceExecutionModeLive     = "live"
	CadenceExecutionModeFast     = "fast"
	CadenceExecutionModeFallback = "fallback"

	CadenceStatusPending = "pending"
	CadenceStatusRunning = "running"
	CadenceStatusReady   = "ready"
	CadenceStatusFailed  = "failed"

	GroundingTierProfile  = "profile"
	GroundingTierEvidence = "evidence"
	GroundingTierBoundary = "boundary"

	ErrCodeValidation          = "ERR_VALIDATION"
	ErrCodeConstraint          = "ERR_CONSTRAINT"
	ErrCodeNotFound            = "ERR_NOT_FOUND"
	ErrCodeUnauthorized        = "ERR_UNAUTHORIZED"
	ErrCodeForbidden           = "ERR_FORBIDDEN"
	ErrCodeRateLimited         = "ERR_RATE_LIMITED"
	ErrCodeDbUnavailable       = "ERR_DB_UNAVAILABLE"
	ErrCodeStreamTimeout       = "ERR_STREAM_TIMEOUT"
	ErrCodeStreamAborted       = "ERR_STREAM_ABORTED"
	ErrCodeUpstreamUnavailable = "ERR_UPSTREAM_UNAVAILABLE"
	ErrCodeInternal            = "ERR_INTERNAL"
)

type Osc7501Status struct {
	Source    string    `json:"source"`
	State     string    `json:"state"`
	Label     string    `json:"label"`
	Progress  *int      `json:"progress,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

type K8sPodEvent struct {
	EventID    string    `json:"eventId"`
	Namespace  string    `json:"namespace"`
	Deployment string    `json:"deployment"`
	PodName    string    `json:"podName"`
	Phase      string    `json:"phase"`
	Ready      bool      `json:"ready"`
	Message    string    `json:"message"`
	Timestamp  time.Time `json:"timestamp"`
}

type QuotaStatus struct {
	Role       string `json:"role"`
	TurnsUsed  int    `json:"turnsUsed"`
	MaxTurns   int    `json:"maxTurns"`
	TokensUsed int    `json:"tokensUsed"`
	MaxTokens  int    `json:"maxTokens"`
}

type PublicAppError struct {
	Code          string `json:"code"`
	Status        int    `json:"status"`
	Message       string `json:"message"`
	Action        string `json:"action"`
	CorrelationID string `json:"correlationId"`
}

type CadenceRunRequest struct {
	Prompt         string `json:"prompt"`
	PresetSlug     string `json:"presetSlug,omitempty"`
	SessionID      string `json:"sessionId,omitempty"`
	Role           string `json:"role,omitempty"`
	Mode           string `json:"mode,omitempty"`
	DeferExecution bool   `json:"deferExecution,omitempty"`
}

func (r CadenceRunRequest) Validate() error {
	trimmed := strings.TrimSpace(r.Prompt)
	if len(trimmed) < 4 {
		return errors.New("prompt must be at least 4 characters")
	}
	if len(trimmed) > 1200 {
		return errors.New("prompt must not exceed 1200 characters")
	}
	mode := strings.TrimSpace(r.Mode)
	if mode != "" && mode != CadenceModeFast && mode != CadenceModeLLM {
		return errors.New("mode must be 'fast' or 'llm'")
	}
	return nil
}

type CadenceTurn struct {
	ID        int            `json:"id,omitempty"`
	Phase     string         `json:"phase"`
	AgentName string         `json:"agentName"`
	Status    string         `json:"status"`
	Summary   string         `json:"summary"`
	LatencyMs int            `json:"latencyMs"`
	Payload   map[string]any `json:"payload,omitempty"`
	CreatedAt string         `json:"createdAt,omitempty"`
}

type CadencePreset struct {
	Slug                string `json:"slug"`
	Title               string `json:"title"`
	StarterPrompt       string `json:"starterPrompt"`
	ExpectedKind        string `json:"expectedKind"`
	StarterArtifactHTML string `json:"starterArtifactHtml"`
	SortOrder           int    `json:"sortOrder"`
}

type CadenceSpecArtifact struct {
	Title            string   `json:"title"`
	Summary          string   `json:"summary"`
	Conditions       []string `json:"conditions"`
	Handling         []string `json:"handling"`
	Outcomes         []string `json:"outcomes"`
	Rules            []string `json:"rules"`
	Deltas           []string `json:"deltas"`
	RecalledPatterns []string `json:"recalledPatterns,omitempty"`
}

type CadenceGateCheckItem struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Status string `json:"status"`
	Detail string `json:"detail"`
}

type CadenceGateAudit struct {
	Summary       string                 `json:"summary"`
	Sanitized     bool                   `json:"sanitized"`
	ArtifactBytes int                    `json:"artifactBytes"`
	Checks        []CadenceGateCheckItem `json:"checks"`
}

// NormalizeCadencePrompt trims outer whitespace, collapses internal ASCII/Unicode whitespace runs
// to a single space, and lowercases, matching TS normalizeCadencePrompt byte-for-byte.
func NormalizeCadencePrompt(raw string) string {
	return strings.ToLower(strings.Join(strings.Fields(raw), " "))
}

type CadenceRunResult struct {
	RunID         string               `json:"runId"`
	Prompt        string               `json:"prompt"`
	PresetSlug    string               `json:"presetSlug,omitempty"`
	RunStatus     string               `json:"runStatus,omitempty"`
	Mode          string               `json:"mode,omitempty"`
	ExecutionMode string               `json:"executionMode,omitempty"`
	IsGolden      bool                 `json:"isGolden,omitempty"`
	Spec          *CadenceSpecArtifact `json:"spec,omitempty"`
	GateAudit     *CadenceGateAudit    `json:"gateAudit,omitempty"`
	Status        *Osc7501Status       `json:"status,omitempty"`
	OSC7501       string               `json:"osc7501,omitempty"`
	GateVerdict   string               `json:"gateVerdict"`
	Turns         []CadenceTurn        `json:"turns"`
	ArtifactHTML  string               `json:"artifactHtml"`
	TokensIn      int                  `json:"tokensIn,omitempty"`
	TokensOut     int                  `json:"tokensOut,omitempty"`
	Quota         *QuotaStatus         `json:"quota,omitempty"`
	CreatedAt     string               `json:"createdAt,omitempty"`
}

type CadenceStreamLogEvent struct {
	RunID     string `json:"runId"`
	Line      string `json:"line"`
	Timestamp string `json:"timestamp,omitempty"`
}

type CadenceStreamPhaseEvent struct {
	RunID     string         `json:"runId"`
	RunStatus string         `json:"runStatus"`
	Status    *Osc7501Status `json:"status,omitempty"`
	Progress  int            `json:"progress,omitempty"`
	Turn      CadenceTurn    `json:"turn"`
}

type CadenceStreamCompleteEvent struct {
	Run   CadenceRunResult `json:"run"`
	Quota *QuotaStatus     `json:"quota,omitempty"`
}

type CadenceStreamErrorEvent struct {
	RunID     string `json:"runId"`
	Error     string `json:"error"`
	Code      string `json:"code,omitempty"`
	RunStatus string `json:"runStatus,omitempty"`
}

type AskSource struct {
	ID             string  `json:"id,omitempty"`
	Title          string  `json:"title"`
	Snippet        string  `json:"snippet"`
	Score          float64 `json:"score"`
	Category       string  `json:"category,omitempty"`
	SectionHeading string  `json:"sectionHeading,omitempty"`
	DocKey         string  `json:"docKey,omitempty"`
}

type AskSuggestedLink struct {
	Route  string `json:"route"`
	Label  string `json:"label"`
	Reason string `json:"reason"`
}

// IsAllowedPortalNavigableRoute validates routes strictly against the navigable portal route allow-list.
func IsAllowedPortalNavigableRoute(route string) bool {
	switch strings.TrimSpace(route) {
	case "/", "/menu", "/cadence", "/ask", "/agensi", "/contact":
		return true
	default:
		return false
	}
}

type JdMatchEvaluation struct {
	MatchScore int      `json:"matchScore"`
	Strengths  []string `json:"strengths"`
	Gaps       []string `json:"gaps"`
}

type AskResponse struct {
	AttemptID         string             `json:"attemptId,omitempty"`
	Grounded          bool               `json:"grounded"`
	Abstained         bool               `json:"abstained"`
	GroundingTier     string             `json:"groundingTier,omitempty"`
	ConversationID    string             `json:"conversationId,omitempty"`
	TurnIndex         int                `json:"turnIndex,omitempty"`
	Mode              string             `json:"mode"`
	Answer            string             `json:"answer"`
	Sources           []AskSource        `json:"sources"`
	SuggestedLinks    []AskSuggestedLink `json:"suggestedLinks,omitempty"`
	FollowUpQuestions []string           `json:"followUpQuestions,omitempty"`
	MatchScore        *int               `json:"matchScore,omitempty"`
	Strengths         []string           `json:"strengths,omitempty"`
	Gaps              []string           `json:"gaps,omitempty"`
	Provider          string             `json:"provider"`
	Model             string             `json:"model,omitempty"`
	TokensUsed        int                `json:"tokensUsed"`
	LatencyMs         int                `json:"latencyMs,omitempty"`
	CorrelationID     string             `json:"correlationId,omitempty"`
	Quota             *QuotaStatus       `json:"quota,omitempty"`
}

type AskTurnState struct {
	AttemptID      string          `json:"attemptId"`
	Status         string          `json:"status"`
	Mode           string          `json:"mode"`
	ConversationID string          `json:"conversationId,omitempty"`
	TurnIndex      int             `json:"turnIndex,omitempty"`
	CorrelationID  string          `json:"correlationId"`
	LeaseExpiresAt string          `json:"leaseExpiresAt"`
	ExpiresAt      string          `json:"expiresAt"`
	Quota          *QuotaStatus    `json:"quota,omitempty"`
	Response       *AskResponse    `json:"response,omitempty"`
	Error          *PublicAppError `json:"error,omitempty"`
}

type AskCollectionStatus struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	PointsCount int    `json:"pointsCount"`
	VectorSize  int    `json:"vectorSize,omitempty"`
}

type AskServiceStatus struct {
	Status      string               `json:"status"`
	Provider    string               `json:"provider"`
	PGConnected bool                 `json:"pgConnected"`
	Collection  *AskCollectionStatus `json:"collection,omitempty"`
}

// ValidateUUID returns true strictly when value is a canonical 36-char UUID string.
func ValidateUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		isHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !isHex {
			return false
		}
	}
	return true
}

type MenuItem struct {
	Slug            string  `json:"slug"`
	KeyShortcut     string  `json:"keyShortcut"`
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	TargetK8sDeploy *string `json:"targetK8sDeploy"`
	Namespace       *string `json:"namespace"`
	AdminOnly       bool    `json:"adminOnly"`
	SortOrder       int     `json:"sortOrder"`
	Enabled         bool    `json:"enabled"`
}

type ContactRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

func (r ContactRequest) Validate() error {
	if len(strings.TrimSpace(r.Name)) < 2 {
		return errors.New("name must be at least 2 characters")
	}
	email := strings.TrimSpace(r.Email)
	if !strings.Contains(email, "@") || len(email) < 5 {
		return errors.New("valid email is required")
	}
	if len(strings.TrimSpace(r.Message)) < 10 {
		return errors.New("message must be at least 10 characters")
	}
	return nil
}

type ContactNotifyRequest struct {
	SubmissionID  string `json:"submissionId"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	HasAttachment bool   `json:"hasAttachment"`
	ReceivedAt    string `json:"receivedAt"`
}

func (r ContactNotifyRequest) Validate() error {
	if strings.TrimSpace(r.SubmissionID) == "" {
		return errors.New("submissionId is required")
	}
	if len(strings.TrimSpace(r.Name)) < 2 {
		return errors.New("name must be at least 2 characters")
	}
	email := strings.TrimSpace(r.Email)
	if !strings.Contains(email, "@") || len(email) < 5 {
		return errors.New("valid email is required")
	}
	return nil
}
