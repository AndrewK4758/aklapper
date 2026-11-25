package contracts

import (
	"fmt"
	"strings"
)

// FormatOSC7501 encodes an OSC 7501 status sequence for terminal/TUI clients.
func FormatOSC7501(status Osc7501Status) string {
	cleanLabel := strings.ReplaceAll(status.Label, ";", " ")
	if status.Progress != nil {
		return fmt.Sprintf("\x1b]7501;%s;%s;%d;%s\x07", status.Source, status.State, *status.Progress, cleanLabel)
	}
	return fmt.Sprintf("\x1b]7501;%s;%s;;%s\x07", status.Source, status.State, cleanLabel)
}
