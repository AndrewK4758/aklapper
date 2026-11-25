package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const cadencePromptCacheVersion = "v1"

func sha256Hex(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func computePresetRevisionHash(expectedKind, starterArtifactHTML string) string {
	kind := strings.TrimSpace(expectedKind)
	if kind == "" && starterArtifactHTML == "" {
		return ""
	}
	return sha256Hex(kind + "\x00" + starterArtifactHTML)
}

func computePromptHash(presetSlug, presetRevisionHash, mode, prompt string) string {
	canonicalPreset := strings.TrimSpace(presetSlug)
	if canonicalPreset == "" {
		canonicalPreset = "custom"
	}
	canonicalMode := contracts.CadenceModeFast
	if strings.TrimSpace(mode) == contracts.CadenceModeLLM {
		canonicalMode = contracts.CadenceModeLLM
	}
	normalized := contracts.NormalizeCadencePrompt(prompt)
	return sha256Hex(
		cadencePromptCacheVersion + "\x00" +
			canonicalPreset + "\x00" +
			presetRevisionHash + "\x00" +
			canonicalMode + "\x00" +
			normalized,
	)
}

type cacheLookupResult struct {
	PromptHash string
	ClonedRun  *pg.SandboxRun
	Hit        bool
	Branch     string
}

func resolveCacheLookupAndClone(
	ctx context.Context,
	store *pg.Store,
	sessionID, ipHash, presetSlug, mode, prompt string,
) (cacheLookupResult, error) {
	presetRevisionHash := ""
	isSeededPresetPrompt := false

	if store != nil && presetSlug != "" && presetSlug != "custom" && presetSlug != "__custom__" {
		preset, err := store.GetCadencePreset(ctx, presetSlug)
		if err == nil && preset != nil {
			presetRevisionHash = computePresetRevisionHash(preset.ExpectedKind, preset.StarterArtifactHTML)
			isSeededPresetPrompt = contracts.NormalizeCadencePrompt(prompt) == contracts.NormalizeCadencePrompt(preset.StarterPrompt)
		}
	}

	promptHash := computePromptHash(presetSlug, presetRevisionHash, mode, prompt)
	if store == nil {
		return cacheLookupResult{PromptHash: promptHash, Branch: "miss"}, nil
	}

	source, err := store.FindCachedSandboxRun(ctx, promptHash, sessionID, isSeededPresetPrompt)
	if err != nil {
		return cacheLookupResult{PromptHash: promptHash, Branch: "miss"}, err
	}
	if source == nil {
		logCadenceSeam("RULE_DIVERGENCE", "cadence.cache.lookup_outcome", "info", map[string]any{
			"branch":     "miss",
			"presetSlug": nonEmptyOr(presetSlug, "custom"),
			"mode":       mode,
		})
		return cacheLookupResult{PromptHash: promptHash, Branch: "miss"}, nil
	}

	branch := "session_private_hit"
	if isSeededPresetPrompt {
		branch = "preset_global_hit"
	}
	cloned, cloneErr := store.CloneCachedSandboxRunForSession(
		ctx,
		source,
		sessionID,
		ipHash,
		presetSlug,
		strings.TrimSpace(prompt),
		promptHash,
	)
	if cloneErr != nil {
		return cacheLookupResult{PromptHash: promptHash, Branch: "miss"}, cloneErr
	}

	logCadenceSeam("RULE_DIVERGENCE", "cadence.cache.lookup_outcome", "info", map[string]any{
		"branch":     branch,
		"runId":      cloned.RunID,
		"presetSlug": nonEmptyOr(presetSlug, "custom"),
		"mode":       mode,
	})
	logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_mode_selected", "info", map[string]any{
		"branch": contracts.CadenceExecutionModeCached,
		"runId":  cloned.RunID,
	})
	logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.audit", "info", map[string]any{
		"deltaStatus":   "cached_clone",
		"runId":         cloned.RunID,
		"executionMode": contracts.CadenceExecutionModeCached,
		"isGolden":      false,
		"tokensIn":      0,
		"tokensOut":     0,
	})

	return cacheLookupResult{
		PromptHash: promptHash,
		ClonedRun:  cloned,
		Hit:        true,
		Branch:     branch,
	}, nil
}
