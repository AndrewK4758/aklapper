package k8sevents

import (
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func TestFilterForRoleRedactsAdminNamespaceForGuests(t *testing.T) {
	t.Parallel()

	events := []contracts.K8sPodEvent{
		NewScaleEvent("1", contracts.PublicNamespace, "cadence-demo", "Running", "ready", true),
		NewScaleEvent("2", contracts.AdminNamespace, "cadence-admin", "Running", "admin pod", true),
	}

	guestEvents := FilterForRole(events, contracts.RoleGuest)
	if len(guestEvents) != 1 || guestEvents[0].Namespace != contracts.PublicNamespace {
		t.Fatalf("expected guest to see only public namespace, got %+v", guestEvents)
	}

	adminEvents := FilterForRole(events, contracts.RoleAdmin)
	if len(adminEvents) != 2 {
		t.Fatalf("expected admin to see all events, got %d", len(adminEvents))
	}
}

func TestFormatOSC7501(t *testing.T) {
	t.Parallel()

	pct := 65
	seq := FormatOSC7501(contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     "scaling",
		Label:     "Waking pod; step 2",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	})

	if !strings.HasPrefix(seq, "\x1b]7501;cadence-demo;scaling;65;") {
		t.Fatalf("unexpected OSC 7501 sequence: %q", seq)
	}
	if !strings.HasSuffix(seq, "\x07") {
		t.Fatalf("expected BEL terminator in %q", seq)
	}
}
