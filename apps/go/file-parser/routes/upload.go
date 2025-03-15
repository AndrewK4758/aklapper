package routes

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func enableCORS(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, PATCH, HEAD, DELETE")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func UploadHandler(resp http.ResponseWriter, req *http.Request) {
	var err error
	errChan := make(chan error)
	enableCORS(&resp)

	curDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current working directory: %v", err.Error())
	}

	filePath := curDir + "/files"

	currentPath := req.URL.Path
	fmt.Printf("Current Path: %s\n", currentPath)

	err = req.ParseMultipartForm(10000)
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(resp, err.Error(), http.StatusBadRequest)
	}

	formData := req.MultipartForm

	if formData != nil {
		var wg sync.WaitGroup
		files := formData.File["files"]

		for fileNum, fileHeader := range files {
			fileBuffer := new(bytes.Buffer)
			fmt.Printf("File number: %d started upload\n", fileNum)

			wg.Add(1)

			go func() {
				defer wg.Done()
				err = UploadFile(filePath, fileHeader, fileBuffer)
				if err != nil {
					errChan <- err
				}

			}()

		}

		go func() {
			wg.Wait()
			close(errChan)
		}()

		for err = range errChan {
			if err = <-errChan; err != nil {
				fmt.Printf("error uploading file: %v\n", err.Error())

			}
		}
	}
	print("\nALL FILES UPLOADED\n")
}
