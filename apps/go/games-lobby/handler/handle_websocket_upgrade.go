package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(req *http.Request) bool {
		return true // Allows all origins for dev; change for production
	},
}

func HandleWebsocketConnections(resp http.ResponseWriter, req *http.Request) {
	// fmt.Printf("Handler invoked: Path=%s, Method=%s, Headers=%v\n", req.URL.Path, req.Method, req.Header)

	var err error

	ws, err := upgrader.Upgrade(resp, req, nil) // nil argument is the header for upgrade. Will ammend

	if err != nil {
		fmt.Printf("websocket upgrade failed with error: %e\n\n", err)
		return
	}

	defer ws.Close()

	// implement enter lobby and leave lobby logic
	// print data as string for now

	for {
		messageType, message, err := ws.ReadMessage()

		if err != nil {
			break
		}

		switch messageType {
		case websocket.TextMessage:
			fmt.Printf("Received: %s\n\n", string(message))
			handleTextListenEvent(ws, message)
		case websocket.BinaryMessage:
			// handle binary message
			fmt.Printf("binary message received")
			fmt.Printf("Received: %s\n%v\n", string(message), messageType)
		case websocket.CloseMessage:
			fmt.Println("connection closed")
			return
		}

		// ws.WriteMessage(websocket.TextMessage, []byte("Response to client	"))
		// err = ws.WriteMessage(messageType, fmt.Appendf(nil, "This was the message received: %s", message))

		// if err != nil {
		// 	break
		// }
	}

}

type WsTextEvent struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

func handleTextListenEvent(ws *websocket.Conn, message []byte) {
	var err error
	var msgData WsTextEvent

	err = json.Unmarshal(message, &msgData)

	if err != nil {
		fmt.Printf("error unmarshalling ws text event message: %s", err.Error())
	}

	if msgData.Event == "custom-event" {
		printJsonString(msgData)

		// a := msgData.Event
		// b := msgData.Data

		// d := WsTextEvent{Event: a, Data: b}

		ws.WriteJSON(msgData)

	} else if msgData.Event == "event2" {

		x := "server-custom-event"
		z := "Data for custom event"

		y := WsTextEvent{Event: x, Data: z}
		ws.WriteJSON(y)
		fmt.Printf("Other event recieved: %v\n\n", msgData.Data)
	}

}

func printJsonString(data WsTextEvent) {
	printVar, err := json.MarshalIndent(data, "", " ")
	if err != nil {
		fmt.Printf("error marshalling JSON: %v\n\n", err)
	}
	fmt.Printf("PRINT VALUE: %v\n\n", string(printVar))
}
