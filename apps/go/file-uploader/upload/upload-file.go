package upload

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"os"
)

func checkOrCreateDirectory(filePath string, perm os.FileMode) error {
	var err error

	if _, err = os.Stat(filePath); os.IsNotExist(err) {
		err = os.MkdirAll(filePath, perm)

		if err != nil {
			return fmt.Errorf("error creating file path: %v", err.Error())
		}
	}
	return err

}

func UploadFile(filePath string, file *multipart.FileHeader, dest *bytes.Buffer) error {
	var err error

	fileSrc, err := file.Open()
	if err != nil {
		return fmt.Errorf("error opening file: %v", err.Error())
	}

	defer fileSrc.Close()

	err = checkOrCreateDirectory(filePath, 0644)

	if err != nil {
		return fmt.Errorf("error checking or creating filepath: %v", err.Error())

	}

	_, err = io.Copy(dest, fileSrc)
	if err != nil {
		return fmt.Errorf("error copying file: %v", err.Error())

	}

	err = os.WriteFile(filePath+"/"+(file.Filename), dest.Bytes(), 0644)

	if err != nil {
		fmt.Print(err.Error())
	}

	fmt.Printf("File upload succesful: %s\n", file.Filename)
	return nil
}
