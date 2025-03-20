package upload

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
	enableCORS(&resp)

	var err error
	errChan := make(chan error)

	curDir, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current working directory: %v", err.Error())
	}

	filePath := curDir + "/files"

	tmpDir, err := os.MkdirTemp(filePath, "")

	println("\n" + tmpDir + "\n")
	if err != nil {
		fmt.Printf("error creating tmp directory: %v", err.Error())
	}

	// defer func() {
	// 	err := os.RemoveAll(tmpDir)
	// 	if err != nil {
	// 		fmt.Println("Error removing temporary directory:", err)
	// 	} else {
	// 		fmt.Println("Temporary directory removed successfully")
	// 	}
	// }()

	currentPath := req.URL.Path
	fmt.Printf("Current Path: %s\n", currentPath)

	err = req.ParseMultipartForm(int64(25000))
	if err != nil {
		fmt.Printf("err: %v\n", err)
		http.Error(resp, err.Error(), http.StatusBadRequest)
	}

	formData := req.MultipartForm
	defer formData.RemoveAll()

	var wg sync.WaitGroup
	if formData != nil {
		files := formData.File["files"]

		for fileNum, fileHeader := range files {
			fileBuffer := new(bytes.Buffer)

			wg.Add(1)

			go func() {
				defer wg.Done()
				Worker(fileNum, fileHeader, fileBuffer, tmpDir, errChan)
			}()

		}

		go func() {
			wg.Wait()
			close(errChan)
		}()

		print("errChan length: ", len(errChan), "\n")

		for err := range errChan {
			print("Error: ", err, "\n")
			if err != nil {
				fmt.Printf("error uploading file: %v\n", err.Error())

			}
		}

	}
	print("\nALL FILES UPLOADED\n")
	resp.Header().Add("Content-Type", "text/plain")
	resp.Write([]byte("All Files Uploaded"))

}
