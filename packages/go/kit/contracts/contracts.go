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

type CadenceRunRequest struct {
	Prompt     string `json:"prompt"`
	PresetSlug string `json:"presetSlug,omitempty"`
	SessionID  string `json:"sessionId,omitempty"`
	Role       string `json:"role,omitempty"`
}

func (r CadenceRunRequest) Validate() error {
	trimmed := strings.TrimSpace(r.Prompt)
	if len(trimmed) < 4 {
		return errors.New("prompt must be at least 4 characters")
	}
	if len(trimmed) > 1200 {
		return errors.New("prompt must not exceed 1200 characters")
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

type AskSource struct {
	ID       string  `json:"id,omitempty"`
	Title    string  `json:"title"`
	Snippet  string  `json:"snippet"`
	Score    float64 `json:"score"`
	Category string  `json:"category,omitempty"`
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
