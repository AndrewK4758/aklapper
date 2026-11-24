package k8sevents

import (
	"fmt"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/contracts"
)

// VisibleToRole enforces the strict guest redaction boundary: guest sessions
// can never observe pods or events belonging to the isolated cadence-admin namespace.
func VisibleToRole(ev contracts.K8sPodEvent, role string) bool {
	if role == contracts.RoleAdmin {
		return true
	}
	return ev.Namespace != contracts.AdminNamespace
}

func FilterForRole(events []contracts.K8sPodEvent, role string) []contracts.K8sPodEvent {
	out := make([]contracts.K8sPodEvent, 0, len(events))
	for _, ev := range events {
		if VisibleToRole(ev, role) {
			out = append(out, ev)
		}
	}
	return out
}

// FormatOSC7501 encodes an OSC 7501 status sequence for terminal/TUI clients.
func FormatOSC7501(status contracts.Osc7501Status) string {
	cleanLabel := strings.ReplaceAll(status.Label, ";", " ")
	if status.Progress != nil {
		return fmt.Sprintf("\x1b]7501;%s;%s;%d;%s\x07", status.Source, status.State, *status.Progress, cleanLabel)
	}
	return fmt.Sprintf("\x1b]7501;%s;%s;;%s\x07", status.Source, status.State, cleanLabel)
}

func NewScaleEvent(eventID, namespace, deployment, phase, message string, ready bool) contracts.K8sPodEvent {
	return contracts.K8sPodEvent{
		EventID:    eventID,
		Namespace:  namespace,
		Deployment: deployment,
		PodName:    fmt.Sprintf("%s-0", deployment),
		Phase:      phase,
		Ready:      ready,
		Message:    message,
		Timestamp:  time.Now().UTC(),
	}
}
