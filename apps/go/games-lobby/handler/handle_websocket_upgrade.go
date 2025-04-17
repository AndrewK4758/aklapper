package handler

import (
	events "apps/go/games-lobby/events"
	lobbydata "apps/go/games-lobby/lobby-data"
	json "encoding/json"
	fmt "fmt"
	http "net/http"

	websocket "github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(req *http.Request) bool {
		return true // Allows all origins for dev; change for production
	},
}

func HandleWebsocketConnections(resp http.ResponseWriter, req *http.Request) {
	// Uncomment to view connection information
	// fmt.Printf("Handler invoked: Path=%s, Method=%s, Headers=%v\n", req.URL.Path, req.Method, req.Header)

	var err error

	ws, err := upgrader.Upgrade(resp, req, nil) // nil argument is the header for upgrade. Will ammend

	if err != nil {
		fmt.Printf("websocket upgrade failed with error: %e\n\n", err)
		return
	}

	defer ws.Close()

	for {
		messageType, message, err := ws.ReadMessage()

		if err != nil {
			fmt.Println("Error reading websocket message. Error: ", err)
			break
		}

		fmt.Printf("Received:\n\tMessage Type: %d\n\tMessage Data: 	%s\n\n", messageType, string(message))
		switch messageType {
		case websocket.TextMessage:
			handleTextListenEvent(ws, message)
		case websocket.BinaryMessage:
			// handle binary message
			fmt.Printf("binary message received")
			fmt.Printf("Received: %s\n%v\n", string(message), messageType)
		case websocket.CloseMessage:
			fmt.Println("connection closed")
			return

		}
	}

}

func handleTextListenEvent(ws *websocket.Conn, message []byte) {
	var err error
	var msgData lobbydata.IncomingWsEvent

	err = json.Unmarshal(message, &msgData)

	if err != nil {
		fmt.Printf("error unmarshalling ws text event message: %s\n\n", err.Error())
	}

	switch msgData.Event {
	case "enter-player":
		events.HandleEnterLobby(ws, msgData)
		return

	case "remove-player":
		events.HandleLeaveLobby(ws, msgData)
		return
	}
}
