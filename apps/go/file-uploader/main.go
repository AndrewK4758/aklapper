package main

import (
	"apps/go/file-uploader/upload"
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("In main function")

	http.HandleFunc("/", upload.UploadHandler)

	log.Fatal(http.ListenAndServe(":6900", nil))
}
