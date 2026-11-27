package e2etest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"testing"
	"time"
)

type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// ReservePort finds an unused loopback TCP port for an isolated E2E service instance.
func ReservePort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve loopback port: %v", err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	if err := ln.Close(); err != nil {
		t.Fatalf("close reserved port listener: %v", err)
	}
	return port
}

// StartBinary compiles the Go service in serviceDir, launches the binary on an
// ephemeral port, waits until GET /healthz returns 200, and registers a graceful
// SIGTERM shutdown in t.Cleanup.
func StartBinary(t *testing.T, serviceDir string, extraEnv ...string) string {
	t.Helper()

	absDir, err := filepath.Abs(serviceDir)
	if err != nil {
		t.Fatalf("resolve service dir %q: %v", serviceDir, err)
	}

	binPath := filepath.Join(t.TempDir(), filepath.Base(absDir)+"-e2e-bin")
	buildCmd := exec.Command("go", "build", "-o", binPath, ".")
	buildCmd.Dir = absDir
	if out, err := buildCmd.CombinedOutput(); err != nil {
		t.Fatalf("go build %s failed: %v\n%s", absDir, err, string(out))
	}

	port := ReservePort(t)
	baseURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	logs := &lockedBuffer{}
	cmd := exec.Command(binPath)
	cmd.Dir = absDir
	cmd.Env = append(os.Environ(), "PORT="+strconv.Itoa(port))
	cmd.Env = append(cmd.Env, extraEnv...)
	cmd.Stdout = logs
	cmd.Stderr = logs

	if err := cmd.Start(); err != nil {
		t.Fatalf("start %s: %v", binPath, err)
	}

	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()

	t.Cleanup(func() {
		if cmd.Process != nil {
			_ = cmd.Process.Signal(syscall.SIGTERM)
		}
		select {
		case err := <-waitCh:
			if err != nil {
				t.Logf("service %s exited after SIGTERM with: %v\nlogs:\n%s", filepath.Base(absDir), err, logs.String())
			}
		case <-time.After(5 * time.Second):
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
			}
			<-waitCh
			t.Errorf("service %s did not shut down cleanly on SIGTERM within 5s\nlogs:\n%s", filepath.Base(absDir), logs.String())
		}
	})

	client := &http.Client{
		Timeout: 500 * time.Millisecond,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}
	defer client.CloseIdleConnections()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case exitErr := <-waitCh:
			t.Fatalf("service %s exited prematurely (%v)\nlogs:\n%s", filepath.Base(absDir), exitErr, logs.String())
		default:
		}

		res, err := client.Get(baseURL + "/healthz")
		if err == nil {
			_, _ = io.Copy(io.Discard, res.Body)
			_ = res.Body.Close()
			if res.StatusCode == http.StatusOK {
				return baseURL
			}
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("service %s did not become healthy at %s/healthz within 10s\nlogs:\n%s", filepath.Base(absDir), baseURL, logs.String())
	return ""
}

// DoRequest sends a real HTTP request and returns the response and raw body bytes.
func DoRequest(t *testing.T, method, url string, rawBody []byte, headers map[string]string) (*http.Response, []byte) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var bodyReader io.Reader
	if rawBody != nil {
		bodyReader = bytes.NewReader(rawBody)
	}
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		t.Fatalf("new request %s %s: %v", method, url, err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}
	defer client.CloseIdleConnections()
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("http %s %s: %v", method, url, err)
	}
	defer res.Body.Close()

	data, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("read response body %s %s: %v", method, url, err)
	}
	return res, data
}

// DoJSON marshals payload (when non-nil), sends an HTTP request, and decodes the JSON response into T.
func DoJSON[T any](t *testing.T, method, url string, payload any, headers map[string]string) (*http.Response, T) {
	t.Helper()

	var raw []byte
	reqHeaders := make(map[string]string, len(headers)+1)
	for k, v := range headers {
		reqHeaders[k] = v
	}
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal request JSON: %v", err)
		}
		raw = encoded
		if _, ok := reqHeaders["Content-Type"]; !ok {
			reqHeaders["Content-Type"] = "application/json"
		}
	}

	res, body := DoRequest(t, method, url, raw, reqHeaders)
	var out T
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("decode JSON from %s %s (status %d): %v\nbody: %s", method, url, res.StatusCode, err, string(body))
	}
	return res, out
}
