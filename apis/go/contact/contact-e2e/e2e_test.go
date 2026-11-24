package contact_e2e_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
)

type contactReceipt struct {
	Accepted   bool   `json:"accepted"`
	ReceiptID  string `json:"receiptId"`
	ReceivedAt string `json:"receivedAt"`
}

func TestContactEndToEnd(t *testing.T) {
	t.Parallel()

	baseURL := e2etest.StartBinary(t, "../contact")

	t.Run("GET /healthz returns contact health", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "contact" {
			t.Fatalf("unexpected health response (status %d): %+v", res.StatusCode, health)
		}
	})

	t.Run("POST /v1/contact accepts valid inquiry and issues receipt", func(t *testing.T) {
		res, receipt := e2etest.DoJSON[contactReceipt](
			t,
			http.MethodPost,
			baseURL+"/v1/contact",
			contracts.ContactRequest{
				Name:    "Andrew Klapper",
				Email:   "andrew@example.com",
				Subject: "Architecture Inquiry",
				Message: "Verifying end-to-end contact submission receipt contract.",
			},
			nil,
		)
		if res.StatusCode != http.StatusAccepted {
			t.Fatalf("expected 202, got %d", res.StatusCode)
		}
		if !receipt.Accepted || !strings.HasPrefix(receipt.ReceiptID, "msg-") {
			t.Fatalf("unexpected receipt: %+v", receipt)
		}
		if _, err := time.Parse(time.RFC3339, receipt.ReceivedAt); err != nil {
			t.Fatalf("expected RFC3339 receivedAt, got %q: %v", receipt.ReceivedAt, err)
		}
	})

	t.Run("POST /v1/contact rejects malformed JSON and invalid fields", func(t *testing.T) {
		resBad, _ := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/contact",
			[]byte("{bad"),
			map[string]string{"Content-Type": "application/json"},
		)
		if resBad.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for bad JSON, got %d", resBad.StatusCode)
		}

		cases := []struct {
			name string
			req  contracts.ContactRequest
		}{
			{
				name: "short name",
				req:  contracts.ContactRequest{Name: "A", Email: "a@b.co", Message: "Long enough inquiry message."},
			},
			{
				name: "invalid email",
				req:  contracts.ContactRequest{Name: "Andrew", Email: "not-an-email", Message: "Long enough inquiry message."},
			},
			{
				name: "short message",
				req:  contracts.ContactRequest{Name: "Andrew", Email: "a@b.co", Message: "too short"},
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				res, errBody := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodPost, baseURL+"/v1/contact", tc.req, nil)
				if res.StatusCode != http.StatusBadRequest || errBody.Error == "" {
					t.Fatalf("expected 400 error for %s, got %d (%+v)", tc.name, res.StatusCode, errBody)
				}
			})
		}
	})
}
