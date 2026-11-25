package contracts

import "testing"

func TestFormatOSC7501WithProgressAndSemicolonSanitization(t *testing.T) {
	t.Parallel()

	progress := 42
	got := FormatOSC7501(Osc7501Status{
		Source:   "cadence",
		State:    "running",
		Label:    "build;step",
		Progress: &progress,
	})
	want := "\x1b]7501;cadence;running;42;build step\x07"
	if got != want {
		t.Fatalf("FormatOSC7501() = %q, want %q", got, want)
	}
}

func TestFormatOSC7501OmitsEmptyProgress(t *testing.T) {
	t.Parallel()

	got := FormatOSC7501(Osc7501Status{
		Source:   "cadence",
		State:    "idle",
		Label:    "ready",
		Progress: nil,
	})
	want := "\x1b]7501;cadence;idle;;ready\x07"
	if got != want {
		t.Fatalf("FormatOSC7501() = %q, want %q", got, want)
	}
}
