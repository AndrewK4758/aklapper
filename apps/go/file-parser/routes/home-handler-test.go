package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHttpHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/", nil)

	if err != nil {
		fmt.Println("Unable to create request")
	}

	respRecorder := httptest.NewRecorder()

	HomeHandler(respRecorder, req)

	respSendValue := respRecorder.Result()

	defer respSendValue.Body.Close()

	expected := "Response Sent\n"
	actual := respRecorder.Body.String()

	if expected != actual {
		t.Errorf("Error:\nRecieved: %v\nExpected: %v", actual, expected)
	}
}
