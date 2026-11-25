package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
)

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("contact"))

	mux.HandleFunc("POST /v1/contact", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := httpkit.RequireInternalAuth(w, r); !ok {
			return
		}
		var req contracts.ContactRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		httpkit.WriteJSON(w, http.StatusAccepted, map[string]any{
			"accepted":   true,
			"receiptId":  fmt.Sprintf("msg-%d", time.Now().UTC().UnixNano()),
			"receivedAt": time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("POST /v1/contact/notify", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := httpkit.RequireInternalAuth(w, r); !ok {
			return
		}
		var req contracts.ContactNotifyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		log.Printf(
			"contact notify queued submissionId=%s sender=%q hasAttachment=%v",
			req.SubmissionID,
			req.Name,
			req.HasAttachment,
		)

		httpkit.WriteJSON(w, http.StatusAccepted, map[string]any{
			"accepted":       true,
			"notificationId": fmt.Sprintf("ntf-%d", time.Now().UTC().UnixNano()),
			"submissionId":   req.SubmissionID,
			"queuedAt":       time.Now().UTC().Format(time.RFC3339),
		})
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8084")
	log.Printf("contact listening on %s", addr)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler()); err != nil {
		log.Fatal(err)
	}
}
