package grpckit

import (
	"errors"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
)

// ToProtoPublicError converts a domain PublicAppError into its canonical Protobuf representation.
func ToProtoPublicError(e *contracts.PublicAppError) *commonv1.PublicAppError {
	if e == nil {
		return nil
	}
	var fieldErrors map[string]*commonv1.FieldErrorList
	if len(e.FieldErrors) > 0 {
		fieldErrors = make(map[string]*commonv1.FieldErrorList, len(e.FieldErrors))
		for field, msgs := range e.FieldErrors {
			if len(msgs) == 0 {
				continue
			}
			copied := append([]string(nil), msgs...)
			fieldErrors[field] = &commonv1.FieldErrorList{Messages: copied}
		}
		if len(fieldErrors) == 0 {
			fieldErrors = nil
		}
	}
	return &commonv1.PublicAppError{
		Code:          e.Code,
		Status:        int32(e.Status),
		Message:       e.Message,
		Action:        e.Action,
		CorrelationId: e.CorrelationID,
		FieldErrors:   fieldErrors,
	}
}

// ToProtoQuota converts a domain QuotaStatus into its canonical Protobuf representation.
func ToProtoQuota(q *contracts.QuotaStatus) *commonv1.QuotaStatus {
	if q == nil {
		return nil
	}
	return &commonv1.QuotaStatus{
		Role:       q.Role,
		TurnsUsed:  int32(q.TurnsUsed),
		MaxTurns:   int32(q.MaxTurns),
		TokensUsed: int32(q.TokensUsed),
		MaxTokens:  int32(q.MaxTokens),
	}
}

// NewDetailedConnectError constructs a Connect/gRPC error carrying the canonical
// common.v1.ErrorDetailEnvelope (PublicAppError + optional QuotaStatus) in error details
// and echoing x-correlation-id in response metadata when present.
func NewDetailedConnectError(
	code connect.Code,
	pubErr *commonv1.PublicAppError,
	quota *commonv1.QuotaStatus,
) *connect.Error {
	return NewDetailedConnectErrorWithRetryAfter(code, pubErr, quota, nil)
}

// NewDetailedConnectErrorWithRetryAfter attaches optional retry_after_seconds alongside
// PublicAppError (including structured field_errors) and optional QuotaStatus.
func NewDetailedConnectErrorWithRetryAfter(
	code connect.Code,
	pubErr *commonv1.PublicAppError,
	quota *commonv1.QuotaStatus,
	retryAfterSeconds *int32,
) *connect.Error {
	msg := "request failed"
	if pubErr != nil && strings.TrimSpace(pubErr.GetMessage()) != "" {
		msg = strings.TrimSpace(pubErr.GetMessage())
	}
	connectErr := connect.NewError(code, errors.New(msg))
	if pubErr != nil || quota != nil || retryAfterSeconds != nil {
		envelope := &commonv1.ErrorDetailEnvelope{
			Error:             pubErr,
			Quota:             quota,
			RetryAfterSeconds: retryAfterSeconds,
		}
		if detail, err := connect.NewErrorDetail(envelope); err == nil {
			connectErr.AddDetail(detail)
		}
		if pubErr != nil {
			if corrID := strings.TrimSpace(pubErr.GetCorrelationId()); corrID != "" {
				connectErr.Meta().Set(MetadataCorrelationID, corrID)
			}
		}
	}
	return connectErr
}
