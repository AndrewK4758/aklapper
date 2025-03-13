package routes

import (
	"fmt"
	"net/http"
)

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func HomeHandler(resp http.ResponseWriter, req *http.Request) {

	enableCORS(&resp)

	currentPath := req.URL.Path
	fmt.Printf("Current Path: %s\n", currentPath)

	err := req.ParseMultipartForm(500)

	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(resp, err.Error(), http.StatusBadRequest)
	}

	files := req.MultipartForm.File["files"]

	for _, handler := range files {

		fmt.Printf("Uploaded File: %+v\n", handler.Filename)
		fmt.Printf("File Size: %+v\n", handler.Size)
		fmt.Printf("MIME Header: %+v\n", handler.Header)

		file, err := handler.Open()

		if err != nil {
			http.Error(resp, err.Error(), http.StatusInternalServerError)
			return
		}

		defer file.Close()

		fmt.Println(file)

	}

}
