package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/jackc/pgx/v5"
)

const attachmentStreamChunkBytes = 256 * 1024

func (s *adminInboxServiceServer) StreamContactAttachment(
	ctx context.Context,
	req *connect.Request[adminv1.StreamContactAttachmentRequest],
	stream *connect.ServerStream[adminv1.StreamContactAttachmentResponse],
) error {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return err
	}
	submissionID := strings.TrimSpace(req.Msg.GetSubmissionId())
	if !contracts.ValidateUUID(submissionID) {
		return newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Attachment not found.", "Verify the submission ID.", corrID, nil)
	}

	var id string
	var name, mimeType, shaHex, contentB64 *string
	var sizeBytes *int64
	err := s.deps.store.Pool().QueryRow(
		ctx,
		`SELECT id::text, attachment_name, attachment_mime_type, attachment_size_bytes::bigint, attachment_sha256, attachment_content_base64
		 FROM contact_submissions
		 WHERE id = $1::uuid
		 LIMIT 1`,
		submissionID,
	).Scan(&id, &name, &mimeType, &sizeBytes, &shaHex, &contentB64)
	if errors.Is(err, pgx.ErrNoRows) {
		return newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Attachment not found.", "Verify the submission ID.", corrID, nil)
	}
	if err != nil {
		return mapAdminStoreError(err, corrID)
	}
	if name == nil || mimeType == nil || sizeBytes == nil || shaHex == nil || contentB64 == nil ||
		*name == "" || *mimeType == "" || *sizeBytes <= 0 || *shaHex == "" || *contentB64 == "" {
		return newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Attachment not found.", "This message has no file attachment.", corrID, nil)
	}

	rawBytes, decErr := base64.StdEncoding.DecodeString(*contentB64)
	if decErr != nil {
		logAdminSeam("BOUNDARY_FAULT", "admin.inbox.attachment_stream_failed", map[string]any{
			"submissionId":  submissionID,
			"reason":        "base64_decode_failed",
			"correlationId": corrID,
		})
		return newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Stored attachment is corrupted.", "Contact operator.", corrID, nil)
	}
	sum := sha256.Sum256(rawBytes)
	computedSha := hex.EncodeToString(sum[:])
	if int64(len(rawBytes)) != *sizeBytes || !strings.EqualFold(computedSha, *shaHex) {
		logAdminSeam("BOUNDARY_FAULT", "admin.inbox.attachment_stream_failed", map[string]any{
			"submissionId":  submissionID,
			"reason":        "integrity_mismatch",
			"correlationId": corrID,
		})
		return newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Stored attachment integrity check failed.", "Contact operator.", corrID, nil)
	}

	if sendErr := stream.Send(&adminv1.StreamContactAttachmentResponse{
		Chunk: &adminv1.StreamContactAttachmentResponse_Metadata{
			Metadata: &adminv1.ContactAttachmentMetadata{
				Id:        id,
				Filename:  *name,
				MimeType:  *mimeType,
				SizeBytes: *sizeBytes,
				Sha256:    *shaHex,
			},
		},
	}); sendErr != nil {
		logAdminSeam("BOUNDARY_FAULT", "admin.inbox.attachment_stream_failed", map[string]any{
			"submissionId":  submissionID,
			"reason":        "stream_send_metadata_failed",
			"correlationId": corrID,
		})
		return sendErr
	}

	for offset := 0; offset < len(rawBytes); offset += attachmentStreamChunkBytes {
		if err := ctx.Err(); err != nil {
			logAdminSeam("BOUNDARY_FAULT", "admin.inbox.attachment_stream_failed", map[string]any{
				"submissionId":  submissionID,
				"reason":        "client_cancelled",
				"correlationId": corrID,
			})
			return err
		}
		end := min(offset+attachmentStreamChunkBytes, len(rawBytes))
		if sendErr := stream.Send(&adminv1.StreamContactAttachmentResponse{
			Chunk: &adminv1.StreamContactAttachmentResponse_Data{
				Data: rawBytes[offset:end],
			},
		}); sendErr != nil {
			logAdminSeam("BOUNDARY_FAULT", "admin.inbox.attachment_stream_failed", map[string]any{
				"submissionId":  submissionID,
				"reason":        "stream_send_chunk_failed",
				"correlationId": corrID,
			})
			return sendErr
		}
	}
	return nil
}
