package llm

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

const (
	DefaultStreamIdleTimeout            = 45 * time.Second
	DefaultStreamDialTimeout            = 5 * time.Second
	DefaultStreamTLSHandshake           = 5 * time.Second
	DefaultStreamResponseHeaderTTL      = 15 * time.Second
	DefaultLocalHTTPTimeout             = 120 * time.Second
	DefaultLocalStreamResponseHeaderTTL = 120 * time.Second
	DefaultLocalStreamIdleTimeout       = 120 * time.Second
)

func parseEnvDurationMs(envKey string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(envKey))
	if raw == "" {
		return fallback
	}
	ms, err := strconv.Atoi(raw)
	if err != nil || ms <= 0 {
		return fallback
	}
	return time.Duration(ms) * time.Millisecond
}

func localHTTPTimeout() time.Duration {
	return parseEnvDurationMs("LOCAL_LLM_HTTP_TIMEOUT_MS", DefaultLocalHTTPTimeout)
}

func localStreamResponseHeaderTTL() time.Duration {
	return parseEnvDurationMs("LOCAL_LLM_STREAM_HEADER_TIMEOUT_MS", DefaultLocalStreamResponseHeaderTTL)
}

func localStreamIdleTimeout(requested time.Duration) time.Duration {
	if requested > 0 {
		return requested
	}
	return parseEnvDurationMs("LOCAL_LLM_STREAM_IDLE_TIMEOUT_MS", DefaultLocalStreamIdleTimeout)
}

// ErrStreamIdleTimeout indicates an active LLM stream stopped delivering bytes past IdleTimeout.
var ErrStreamIdleTimeout = errors.New("llm stream idle timeout exceeded")

type ChatStreamRequest struct {
	Messages       []ChatMessage
	MaxTokens      int
	Temperature    *float64
	Model          string
	ThinkingBudget *int
	ResponseSchema *JSONSchema
	IdleTimeout    time.Duration
}

type ChatStreamChunk struct {
	Delta        string
	FinishReason string
}

type ChatStreamResult struct {
	Text           string
	Model          string
	FinishReason   string
	TokensUsed     int
	UsageEstimated bool
}

// StreamingProvider is an additive interface extending Provider without altering unary callers.
type StreamingProvider interface {
	Provider
	ChatStream(ctx context.Context, req ChatStreamRequest, onChunk func(ChatStreamChunk) error) (ChatStreamResult, error)
}

// StreamChat dispatches to StreamingProvider.ChatStream when implemented, otherwise falls back
// to single-chunk unary Provider.Chat so legacy test doubles and callers stay compatible.
func StreamChat(
	ctx context.Context,
	p Provider,
	req ChatStreamRequest,
	onChunk func(ChatStreamChunk) error,
) (ChatStreamResult, error) {
	if p == nil {
		return ChatStreamResult{}, errors.New("llm provider is nil")
	}
	if sp, ok := p.(StreamingProvider); ok {
		return sp.ChatStream(ctx, req, onChunk)
	}
	if req.ResponseSchema != nil {
		if err := req.ResponseSchema.Validate(); err != nil {
			return ChatStreamResult{}, err
		}
	}
	comp, err := p.Chat(ctx, req.Messages, req.MaxTokens)
	if err != nil {
		return ChatStreamResult{}, err
	}
	if comp.Text != "" && onChunk != nil {
		if err := onChunk(ChatStreamChunk{Delta: comp.Text, FinishReason: "stop"}); err != nil {
			return ChatStreamResult{}, err
		}
	}
	return ChatStreamResult{
		Text:         comp.Text,
		Model:        comp.Model,
		FinishReason: "stop",
		TokensUsed:   comp.TokensUsed,
	}, nil
}

// ParseVertexThinkingBudget validates VERTEX_THINKING_BUDGET, defaulting empty values to &0
// and failing closed on negative or non-numeric strings.
func ParseVertexThinkingBudget(raw string) (*int, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		zero := 0
		return &zero, nil
	}
	val, err := strconv.Atoi(trimmed)
	if err != nil || val < 0 {
		return nil, fmt.Errorf("invalid VERTEX_THINKING_BUDGET %q: must be a non-negative integer", raw)
	}
	return &val, nil
}

// IsDevUnlimitedEnabled returns true strictly when AI_DEV_UNLIMITED=true outside production
// (neither NODE_ENV nor APP_ENV is "production") AND AI_PROVIDER is not "vertex".
func IsDevUnlimitedEnabled() bool {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv("AI_DEV_UNLIMITED")), "true") {
		return false
	}
	isProd := internalauth.IsProductionEnv()
	isVertex := strings.EqualFold(strings.TrimSpace(os.Getenv("AI_PROVIDER")), "vertex")
	if isProd || isVertex {
		reason := "production_env"
		if isVertex && !isProd {
			reason = "vertex_provider"
		} else if isVertex && isProd {
			reason = "production_and_vertex"
		}
		logLLMSeam("UNSOUND_CONDITION", "llm.config.dev_unlimited_refused", map[string]any{
			"reason": reason,
		})
		return false
	}
	return true
}

func logLLMSeam(seamType, event string, fields map[string]any) {
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

func newDefaultStreamHTTPClient(base *http.Client) *http.Client {
	return newStreamHTTPClient(base, DefaultStreamResponseHeaderTTL)
}

func newStreamHTTPClient(base *http.Client, responseHeaderTimeout time.Duration) *http.Client {
	if responseHeaderTimeout <= 0 {
		responseHeaderTimeout = DefaultStreamResponseHeaderTTL
	}
	var transport http.RoundTripper
	if base != nil && base.Transport != nil {
		if ht, ok := base.Transport.(*http.Transport); ok {
			cloned := ht.Clone()
			if cloned.TLSHandshakeTimeout == 0 {
				cloned.TLSHandshakeTimeout = DefaultStreamTLSHandshake
			}
			if cloned.ResponseHeaderTimeout == 0 {
				cloned.ResponseHeaderTimeout = responseHeaderTimeout
			}
			transport = cloned
		} else {
			transport = base.Transport
		}
	} else {
		var cloned *http.Transport
		if dt, ok := http.DefaultTransport.(*http.Transport); ok {
			cloned = dt.Clone()
		} else {
			cloned = &http.Transport{}
		}
		cloned.DialContext = (&net.Dialer{
			Timeout:   DefaultStreamDialTimeout,
			KeepAlive: 30 * time.Second,
		}).DialContext
		cloned.TLSHandshakeTimeout = DefaultStreamTLSHandshake
		cloned.ResponseHeaderTimeout = responseHeaderTimeout
		transport = cloned
	}
	return &http.Client{
		Timeout:   0,
		Transport: transport,
	}
}

func effectiveIdleTimeout(d time.Duration) time.Duration {
	if d <= 0 {
		return DefaultStreamIdleTimeout
	}
	return d
}

func estimateTokensFromText(text string) int {
	runes := utf8.RuneCountInString(text)
	if runes/4 < 1 {
		return 1
	}
	return runes / 4
}

type idleWatchReader struct {
	body        io.ReadCloser
	idleTimeout time.Duration
	cancel      context.CancelFunc
	timedOut    atomic.Bool
	mu          sync.Mutex
	timer       *time.Timer
	closed      bool
}

func newIdleWatchReader(body io.ReadCloser, idleTimeout time.Duration, cancel context.CancelFunc) *idleWatchReader {
	r := &idleWatchReader{
		body:        body,
		idleTimeout: idleTimeout,
		cancel:      cancel,
	}
	r.timer = time.AfterFunc(idleTimeout, func() {
		r.timedOut.Store(true)
		cancel()
		_ = body.Close()
	})
	return r
}

func (r *idleWatchReader) Read(p []byte) (int, error) {
	n, err := r.body.Read(p)
	if n > 0 {
		r.mu.Lock()
		if !r.closed && r.timer != nil {
			r.timer.Reset(r.idleTimeout)
		}
		r.mu.Unlock()
	}
	if err != nil && r.timedOut.Load() {
		return n, fmt.Errorf("%w: %w", ErrStreamIdleTimeout, context.DeadlineExceeded)
	}
	return n, err
}

func (r *idleWatchReader) Close() error {
	r.mu.Lock()
	r.closed = true
	if r.timer != nil {
		r.timer.Stop()
	}
	r.mu.Unlock()
	r.cancel()
	return r.body.Close()
}

type upstreamSSEError struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
	Status  string `json:"status"`
	Type    string `json:"type"`
}

func formatUpstreamSSEError(provider string, e *upstreamSSEError) error {
	if e == nil {
		return fmt.Errorf("%s stream returned error event", provider)
	}
	detail := strings.TrimSpace(e.Message)
	if detail == "" {
		detail = strings.TrimSpace(e.Status)
	}
	if detail == "" {
		detail = strings.TrimSpace(e.Type)
	}
	if detail == "" {
		detail = "upstream error"
	}
	return fmt.Errorf("%s stream error: %s", provider, detail)
}

func scanSSEData(r io.Reader, onData func(eventName, data string) error) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var eventName string
	var dataLines []string
	flush := func() error {
		if len(dataLines) == 0 {
			eventName = ""
			return nil
		}
		ev := eventName
		joined := strings.Join(dataLines, "\n")
		eventName = ""
		dataLines = dataLines[:0]
		return onData(ev, joined)
	}

	for scanner.Scan() {
		line := strings.TrimSuffix(scanner.Text(), "\r")
		if line == "" {
			if err := flush(); err != nil {
				return err
			}
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue
		}
		if strings.HasPrefix(line, "event:") {
			val := line[len("event:"):]
			if strings.HasPrefix(val, " ") {
				val = val[1:]
			}
			eventName = strings.TrimSpace(val)
			continue
		}
		if strings.HasPrefix(line, "data:") {
			val := line[len("data:"):]
			if strings.HasPrefix(val, " ") {
				val = val[1:]
			}
			dataLines = append(dataLines, val)
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return flush()
}
