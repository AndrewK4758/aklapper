package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

const retiredMaintenanceKey = "portal-maintenance"

func checkRetiredMaintenanceTarget(target, surface, corrID string) *connect.Error {
	if strings.EqualFold(strings.TrimSpace(target), retiredMaintenanceKey) {
		logAdminSeam("UNSOUND_CONDITION", "admin.cms.retired_maintenance_intent_blocked", map[string]any{
			"surface":       surface,
			"target":        retiredMaintenanceKey,
			"correlationId": corrID,
		})
		return newAdminError(
			connect.CodeFailedPrecondition,
			"RETIRED_CMS_KEY",
			http.StatusGone,
			"Maintenance mode is controlled via the PORTAL_MAINTENANCE_MODE environment variable and is no longer editable in CMS.",
			"Update PORTAL_MAINTENANCE_MODE on the portal service instead.",
			corrID,
			nil,
		)
	}
	return nil
}

func isValidRootRelativeAssetPath(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || !strings.HasPrefix(trimmed, "/") || strings.HasPrefix(trimmed, "//") {
		return false
	}
	if strings.Contains(trimmed, "://") || strings.Contains(trimmed, "..") || strings.ContainsAny(trimmed, "\r\n\x00\\") {
		return false
	}
	return true
}

func validateAndSanitizeSiteContent(
	key string,
	markdownBody string,
	metadataJSON string,
	corrID string,
) (string, *connect.Error) {
	trimmedKey := strings.TrimSpace(key)
	if trimmedKey == "" || len(trimmedKey) > 120 || containsNul(trimmedKey) || containsNul(markdownBody) || containsNul(metadataJSON) {
		return "", newAdminError(
			connect.CodeInvalidArgument,
			contracts.ErrCodeValidation,
			http.StatusBadRequest,
			"Site content key, markdown body, and metadata JSON must be valid UTF-8 without NUL bytes.",
			"Review the site content fields and retry.",
			corrID,
			nil,
		)
	}
	if retiredErr := checkRetiredMaintenanceTarget(trimmedKey, "site_content", corrID); retiredErr != nil {
		return "", retiredErr
	}

	var parsedMeta map[string]any
	if err := json.Unmarshal([]byte(metadataJSON), &parsedMeta); err != nil || parsedMeta == nil {
		return "", newAdminError(
			connect.CodeInvalidArgument,
			contracts.ErrCodeValidation,
			http.StatusBadRequest,
			"Site content metadata must be a valid JSON object.",
			"Fix JSON syntax errors and retry.",
			corrID,
			nil,
		)
	}

	if trimmedKey == "portal-home" {
		if portraitRaw, ok := parsedMeta["portrait"]; ok && portraitRaw != nil {
			portraitMap, isMap := portraitRaw.(map[string]any)
			if !isMap {
				return "", newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "portal-home portrait must be an object.", "Fix portrait metadata.", corrID, nil)
			}
			src, _ := portraitMap["src"].(string)
			if !isValidRootRelativeAssetPath(src) {
				logAdminSeam("UNSOUND_CONDITION", "portal.home.portrait_src_invalid", map[string]any{
					"surface":       "site_content.portal-home",
					"correlationId": corrID,
				})
				return "", newAdminError(
					connect.CodeInvalidArgument,
					contracts.ErrCodeValidation,
					http.StatusBadRequest,
					"Portrait image src must be a root-relative path (starting with '/').",
					"Use a root-relative asset path such as /images/portrait.webp.",
					corrID,
					nil,
				)
			}
		}
	}

	if trimmedKey == "portal-home" || trimmedKey == "portal-about" || trimmedKey == "portal-ask" {
		denylist, dlErr := privacy.LoadPolicyDenylistFromEnv()
		if dlErr != nil {
			return "", newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Privacy denylist configuration is invalid.", "Check DOSSIER_PRIVACY_DENYLIST.", corrID, nil)
		}
		if err := privacy.ScanSiteContent(trimmedKey, markdownBody, parsedMeta, denylist, privacy.PublishScanOptions{
			RequireConfiguredDenylist: privacy.IsProductionPolicyEnv(),
			CorrelationID:             corrID,
			EmitAuditLogs:             true,
		}); err != nil {
			if pe, ok := privacy.AsPolicyError(err); ok {
				return "", newPrivacyConstraintError(pe.Findings, pe.Error(), corrID)
			}
			return "", newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Privacy scan failed.", "Retry shortly.", corrID, nil)
		}
	}

	canonicalBytes, err := json.Marshal(parsedMeta)
	if err != nil {
		return "", newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Failed to encode metadata JSON.", "Fix metadata fields.", corrID, nil)
	}
	return string(canonicalBytes), nil
}
