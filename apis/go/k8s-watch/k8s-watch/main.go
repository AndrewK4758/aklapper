package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
)

const (
	defaultSATokenPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	defaultSACAPath    = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
)

type k8sAPIClient struct {
	baseURL string
	token   string
	http    *http.Client
}

func newInClusterClient() *k8sAPIClient {
	host := strings.TrimSpace(os.Getenv("KUBERNETES_SERVICE_HOST"))
	if host == "" {
		return nil
	}
	port := strings.TrimSpace(os.Getenv("KUBERNETES_SERVICE_PORT"))
	if port == "" {
		port = "443"
	}
	tokenBytes, err := os.ReadFile(defaultSATokenPath)
	if err != nil {
		return nil
	}
	token := strings.TrimSpace(string(tokenBytes))
	if token == "" {
		return nil
	}

	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if caBytes, caErr := os.ReadFile(defaultSACAPath); caErr == nil && len(caBytes) > 0 {
		pool := x509.NewCertPool()
		if pool.AppendCertsFromPEM(caBytes) {
			tlsCfg.RootCAs = pool
		}
	}

	return &k8sAPIClient{
		baseURL: fmt.Sprintf("https://%s:%s", host, port),
		token:   token,
		http: &http.Client{
			Timeout:   4 * time.Second,
			Transport: &http.Transport{TLSClientConfig: tlsCfg},
		},
	}
}

type deploymentList struct {
	Items []struct {
		Metadata struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
		Spec struct {
			Replicas *int `json:"replicas"`
		} `json:"spec"`
		Status struct {
			ReadyReplicas int `json:"readyReplicas"`
			Replicas      int `json:"replicas"`
		} `json:"status"`
	} `json:"items"`
}

func (c *k8sAPIClient) listDeployments(ctx context.Context, namespace string) ([]contracts.K8sPodEvent, error) {
	endpoint := fmt.Sprintf("%s/apis/apps/v1/namespaces/%s/deployments", strings.TrimRight(c.baseURL, "/"), namespace)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")

	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return nil, fmt.Errorf("k8s api status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var list deploymentList
	if err := json.NewDecoder(res.Body).Decode(&list); err != nil {
		return nil, err
	}

	events := make([]contracts.K8sPodEvent, 0, len(list.Items))
	for i, item := range list.Items {
		desired := 0
		if item.Spec.Replicas != nil {
			desired = *item.Spec.Replicas
		}
		ready := item.Status.ReadyReplicas
		phase := "ScaledZero"
		msg := fmt.Sprintf("Idle at %d/%d replicas", ready, desired)
		isReady := false
		if ready > 0 && ready >= desired {
			phase = "Ready"
			msg = fmt.Sprintf("Running %d/%d replicas", ready, desired)
			isReady = true
		} else if desired > 0 {
			phase = "Scaling"
			msg = fmt.Sprintf("Scaling %d/%d replicas", ready, desired)
		}
		ns := item.Metadata.Namespace
		if ns == "" {
			ns = namespace
		}
		events = append(events, k8sevents.NewScaleEvent(
			fmt.Sprintf("k8s-%s-%d", item.Metadata.Name, i+1),
			ns,
			item.Metadata.Name,
			phase,
			msg,
			isReady,
		))
	}
	return events, nil
}

func simulatedEvents() []contracts.K8sPodEvent {
	return []contracts.K8sPodEvent{
		k8sevents.NewScaleEvent("evt-1", contracts.PublicNamespace, "cadence-demo", "ScaledZero", "Idle at 0 replicas", false),
		k8sevents.NewScaleEvent("evt-2", contracts.AdminNamespace, "cadence-admin", "ScaledZero", "Isolated admin runtime", false),
	}
}

func collectClusterEvents(ctx context.Context, client *k8sAPIClient, role string) []contracts.K8sPodEvent {
	if client != nil {
		namespaces := []string{contracts.PublicNamespace}
		if role == contracts.RoleAdmin {
			namespaces = append(namespaces, contracts.AdminNamespace)
		}
		live := make([]contracts.K8sPodEvent, 0, 6)
		allFailed := true
		for _, ns := range namespaces {
			evs, err := client.listDeployments(ctx, ns)
			if err == nil {
				allFailed = false
				live = append(live, evs...)
			}
		}
		if !allFailed && len(live) > 0 {
			return k8sevents.FilterForRole(live, role)
		}
	}
	return k8sevents.FilterForRole(simulatedEvents(), role)
}

func newHandler(client *k8sAPIClient) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("k8s-watch"))

	mux.HandleFunc("GET /v1/cluster/stream", func(w http.ResponseWriter, r *http.Request) {
		role := contracts.RoleGuest
		if internalauth.IsAdminRequest(r) {
			role = contracts.RoleAdmin
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		for _, ev := range collectClusterEvents(r.Context(), client, role) {
			_ = httpkit.WriteSSEEvent(w, "pod", ev)
		}
	})

	mux.HandleFunc("POST /v1/cluster/wake/{deployment}", func(w http.ResponseWriter, r *http.Request) {
		deployment := r.PathValue("deployment")
		if deployment == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "deployment is required")
			return
		}
		if deployment == "cadence-admin" && !internalauth.IsAdminRequest(r) {
			httpkit.WriteError(w, http.StatusForbidden, "signed admin internal auth required to wake isolated admin workload")
			return
		}
		ns := contracts.PublicNamespace
		if deployment == "cadence-admin" {
			ns = contracts.AdminNamespace
		}
		ev := k8sevents.NewScaleEvent("wake-"+deployment, ns, deployment, "TriggeredScaleUp", "Activator requested scale 0 -> 1", false)
		pct := 25
		osc := contracts.Osc7501Status{
			Source:    deployment,
			State:     "scaling",
			Label:     "Waking " + deployment + " from 0 replicas",
			Progress:  &pct,
			Timestamp: time.Now().UTC(),
		}
		httpkit.WriteJSON(w, http.StatusAccepted, map[string]any{
			"event":   ev,
			"osc7501": k8sevents.FormatOSC7501(osc),
		})
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8081")
	client := newInClusterClient()
	log.Printf("k8s-watch listening on %s (inCluster=%v)", addr, client != nil)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(client)); err != nil {
		log.Fatal(err)
	}
}
