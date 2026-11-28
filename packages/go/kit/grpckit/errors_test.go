package grpckit

import (
	"testing"

	"connectrpc.com/connect"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
)

func TestNewDetailedConnectErrorWithFindings(t *testing.T) {
	t.Parallel()

	findings := []*commonv1.PrivacySanitizationFinding{
		{
			RuleId:   "pii.us_phone",
			Category: "pii",
			Field:    "summaryBody",
			Location: "line 1",
		},
	}
	pubErr := &commonv1.PublicAppError{
		Code:          "ERR_CONSTRAINT",
		Status:        422,
		Message:       "Content failed privacy sanitization policy.",
		Action:        "Remove sensitive terms and retry.",
		CorrelationId: "corr-findings-1",
	}

	err := NewDetailedConnectErrorWithFindings(connect.CodeFailedPrecondition, pubErr, findings)
	if err.Code() != connect.CodeFailedPrecondition {
		t.Fatalf("expected CodeFailedPrecondition, got %v", err.Code())
	}
	if got := err.Meta().Get(MetadataCorrelationID); got != "corr-findings-1" {
		t.Fatalf("expected correlation header corr-findings-1, got %q", got)
	}
	details := err.Details()
	if len(details) != 1 {
		t.Fatalf("expected 1 error detail, got %d", len(details))
	}
	val, valErr := details[0].Value()
	if valErr != nil {
		t.Fatalf("decode detail: %v", valErr)
	}
	env, ok := val.(*commonv1.ErrorDetailEnvelope)
	if !ok {
		t.Fatalf("expected *commonv1.ErrorDetailEnvelope, got %T", val)
	}
	if len(env.GetSanitizationFindings()) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(env.GetSanitizationFindings()))
	}
	if env.GetSanitizationFindings()[0].GetRuleId() != "pii.us_phone" {
		t.Fatalf("unexpected finding rule_id: %q", env.GetSanitizationFindings()[0].GetRuleId())
	}
}
