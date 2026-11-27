package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
)

const contactMaxFileBytes = 5 * 1024 * 1024

var (
	contactNameSafeRE   = regexp.MustCompile(`^[\p{L}\p{M}\p{N} .,'-]+$`)
	contactPhoneCharsRE = regexp.MustCompile(`^[0-9+(). -]+$`)
	contactEmailRE      = regexp.MustCompile(`^[A-Za-z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$`)

	contactAllowedExtensions = []string{
		".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg", ".webp", ".json", ".csv",
	}
	contactAllowedMimeTypes = map[string]struct{}{
		"application/pdf":  {},
		"text/plain":       {},
		"text/markdown":    {},
		"image/png":        {},
		"image/jpeg":       {},
		"image/webp":       {},
		"application/json": {},
		"text/csv":         {},
	}
	contactExtensionToMimes = map[string][]string{
		".pdf":  {"application/pdf"},
		".txt":  {"text/plain"},
		".md":   {"text/markdown", "text/plain"},
		".png":  {"image/png"},
		".jpg":  {"image/jpeg"},
		".jpeg": {"image/jpeg"},
		".webp": {"image/webp"},
		".json": {"application/json", "text/plain"},
		".csv":  {"text/csv", "text/plain"},
	}
)

type contactFormNode struct {
	Kind           string            `json:"kind"`
	FieldType      string            `json:"fieldType"`
	Name           string            `json:"name"`
	Label          string            `json:"label"`
	Required       bool              `json:"required"`
	MinLength      *int              `json:"minLength"`
	MaxLength      *int              `json:"maxLength"`
	Pattern        string            `json:"pattern"`
	PatternMessage string            `json:"patternMessage"`
	MaxBytes       *int              `json:"maxBytes"`
	Children       []contactFormNode `json:"children"`
}

type contactFormDefinition struct {
	Nodes []contactFormNode `json:"nodes"`
}

type validatedContactSubmission struct {
	Name               string
	Phone              *string
	Email              string
	Message            string
	AttachmentName     *string
	AttachmentMimeType *string
	AttachmentBytes    []byte
}

func addFieldError(m map[string][]string, field, msg string) {
	if slices.Contains(m[field], msg) {
		return
	}
	m[field] = append(m[field], msg)
}

func sanitizeContactFilename(raw string) string {
	base := raw
	if idx := strings.LastIndexAny(base, `/\`); idx >= 0 {
		base = base[idx+1:]
	}
	var b strings.Builder
	b.Grow(len(base))
	for _, r := range base {
		if r >= 0x20 && r != 0x7f {
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(b.String())
}

func getContactFileExtension(filename string) string {
	clean := sanitizeContactFilename(filename)
	dot := strings.LastIndexByte(clean, '.')
	if dot <= 0 || dot == len(clean)-1 {
		return ""
	}
	return strings.ToLower(clean[dot:])
}

func resolveAllowedContactMime(filename, declaredMime string) string {
	normMime := strings.ToLower(strings.TrimSpace(strings.Split(declaredMime, ";")[0]))
	ext := getContactFileExtension(filename)
	extMimes := contactExtensionToMimes[ext]
	if len(extMimes) == 0 {
		return ""
	}
	if normMime != "" {
		if _, allowed := contactAllowedMimeTypes[normMime]; allowed {
			if slices.Contains(extMimes, normMime) {
				return normMime
			}
			return ""
		}
	}
	if normMime == "" || normMime == "application/octet-stream" {
		return extMimes[0]
	}
	return ""
}

func countDigits(s string) int {
	n := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			n++
		}
	}
	return n
}

func collectContactFormFields(nodes []contactFormNode) []contactFormNode {
	var fields []contactFormNode
	for _, n := range nodes {
		if n.Kind == "field" {
			fields = append(fields, n)
		} else if len(n.Children) > 0 {
			fields = append(fields, collectContactFormFields(n.Children)...)
		}
	}
	return fields
}

func parseContactFormDefinition(contactContentJSON string) contactFormDefinition {
	var envelope struct {
		Form contactFormDefinition `json:"form"`
	}
	_ = json.Unmarshal([]byte(contactContentJSON), &envelope)
	return envelope.Form
}

func validateDynamicContactField(field contactFormNode, req *portalv1.SubmitContactRequest, errs map[string][]string) {
	if field.FieldType == "file" {
		att := req.GetAttachment()
		if att == nil || (att.GetFilename() == "" && len(att.GetContent()) == 0) {
			if field.Required {
				addFieldError(errs, field.Name, field.Label+" is required")
			}
			return
		}
		cleanName := sanitizeContactFilename(att.GetFilename())
		if cleanName == "" || utf8.RuneCountInString(cleanName) > 255 {
			addFieldError(errs, field.Name, "Attachment filename is invalid or exceeds 255 characters")
		}
		if len(att.GetContent()) <= 0 {
			addFieldError(errs, field.Name, "Attached file cannot be empty")
		}
		maxBytes := contactMaxFileBytes
		if field.MaxBytes != nil && *field.MaxBytes > 0 {
			maxBytes = *field.MaxBytes
		}
		if len(att.GetContent()) > maxBytes {
			maxMb := strings.TrimSuffix(fmt.Sprintf("%.1f", float64(maxBytes)/(1024*1024)), ".0")
			addFieldError(errs, field.Name, fmt.Sprintf("Attached file exceeds %s MiB limit", maxMb))
		}
		if resolveAllowedContactMime(cleanName, att.GetMimeType()) == "" {
			addFieldError(errs, field.Name, "Unsupported file type. Allowed: "+strings.Join(contactAllowedExtensions, ", "))
		}
		return
	}

	var rawVal string
	switch field.Name {
	case "name":
		rawVal = req.GetName()
	case "phone":
		rawVal = req.GetPhone()
	case "email":
		rawVal = req.GetEmail()
	case "message":
		rawVal = req.GetMessage()
	}
	if strings.IndexByte(rawVal, 0) >= 0 {
		addFieldError(errs, field.Name, field.Label+" contains unsupported characters")
		return
	}
	val := strings.TrimSpace(rawVal)
	if val == "" {
		if field.Required {
			addFieldError(errs, field.Name, field.Label+" is required")
		}
		return
	}
	valLen := utf8.RuneCountInString(val)
	if field.MinLength != nil && valLen < *field.MinLength {
		addFieldError(errs, field.Name, fmt.Sprintf("%s must be at least %d characters", field.Label, *field.MinLength))
	}
	if field.MaxLength != nil && valLen > *field.MaxLength {
		addFieldError(errs, field.Name, fmt.Sprintf("%s must be %d characters or fewer", field.Label, *field.MaxLength))
	}
	switch field.FieldType {
	case "text":
		if field.Pattern != "" {
			if re, err := regexp.Compile(field.Pattern); err == nil && !re.MatchString(val) {
				msg := field.PatternMessage
				if msg == "" {
					msg = field.Label + " format is invalid"
				}
				addFieldError(errs, field.Name, msg)
			}
		}
		if field.Name == "name" && !contactNameSafeRE.MatchString(val) {
			addFieldError(errs, field.Name, "Name contains unsupported characters")
		}
	case "tel":
		digits := countDigits(val)
		if !contactPhoneCharsRE.MatchString(val) || digits < 7 || digits > 15 {
			msg := field.PatternMessage
			if msg == "" {
				msg = "Enter a valid phone number (7–15 digits, optional +, (), -, spaces)"
			}
			addFieldError(errs, field.Name, msg)
		}
	case "email":
		if !contactEmailRE.MatchString(strings.ToLower(val)) {
			addFieldError(errs, field.Name, "Enter a valid email address")
		}
	}
}

func validateContactRequest(formDef contactFormDefinition, req *portalv1.SubmitContactRequest) (validatedContactSubmission, map[string][]string) {
	errs := make(map[string][]string)
	for _, field := range collectContactFormFields(formDef.Nodes) {
		validateDynamicContactField(field, req, errs)
	}

	name := strings.TrimSpace(req.GetName())
	nameLen := utf8.RuneCountInString(name)
	if strings.IndexByte(req.GetName(), 0) >= 0 {
		addFieldError(errs, "name", "Name contains unsupported characters")
	} else if nameLen < 2 {
		addFieldError(errs, "name", "Name must be at least 2 characters")
	} else if nameLen > 120 {
		addFieldError(errs, "name", "Name must be 120 characters or fewer")
	} else if !contactNameSafeRE.MatchString(name) {
		addFieldError(errs, "name", "Name contains unsupported characters")
	}

	var phonePtr *string
	phone := strings.TrimSpace(req.GetPhone())
	if strings.IndexByte(req.GetPhone(), 0) >= 0 {
		addFieldError(errs, "phone", "Phone contains unsupported characters")
	} else if phone != "" {
		pLen := utf8.RuneCountInString(phone)
		digits := countDigits(phone)
		if pLen < 7 || pLen > 32 || !contactPhoneCharsRE.MatchString(phone) || digits < 7 || digits > 15 {
			addFieldError(errs, "phone", "Enter a valid phone number (7–15 digits, optional +, (), -, spaces)")
		} else {
			phonePtr = &phone
		}
	}

	email := strings.ToLower(strings.TrimSpace(req.GetEmail()))
	if strings.IndexByte(req.GetEmail(), 0) >= 0 {
		addFieldError(errs, "email", "Email contains unsupported characters")
	} else {
		if utf8.RuneCountInString(email) > 254 {
			addFieldError(errs, "email", "Email must be 254 characters or fewer")
		}
		if !contactEmailRE.MatchString(email) {
			addFieldError(errs, "email", "Enter a valid email address")
		}
	}

	message := strings.TrimSpace(req.GetMessage())
	msgLen := utf8.RuneCountInString(message)
	if strings.IndexByte(req.GetMessage(), 0) >= 0 {
		addFieldError(errs, "message", "Message contains unsupported characters")
	} else if msgLen < 10 {
		addFieldError(errs, "message", "Message must be at least 10 characters")
	} else if msgLen > 4000 {
		addFieldError(errs, "message", "Message must be 4000 characters or fewer")
	}

	var attNamePtr *string
	var attMimePtr *string
	var attBytes []byte
	if att := req.GetAttachment(); att != nil && (att.GetFilename() != "" || len(att.GetContent()) > 0) {
		cleanName := sanitizeContactFilename(att.GetFilename())
		resolvedMime := resolveAllowedContactMime(cleanName, att.GetMimeType())
		content := att.GetContent()

		if cleanName == "" || utf8.RuneCountInString(cleanName) > 255 {
			addFieldError(errs, "file", "Attachment filename is invalid or exceeds 255 characters")
		}
		if strings.Contains(cleanName, "/") || strings.Contains(cleanName, `\`) || strings.Contains(cleanName, "..") {
			addFieldError(errs, "file", "Attachment filename contains disallowed path segments")
		}
		if len(content) <= 0 {
			addFieldError(errs, "file", "Attached file cannot be empty")
		}
		if len(content) > contactMaxFileBytes {
			addFieldError(errs, "file", "Attachment exceeds the 5 MiB limit")
		}
		if resolvedMime == "" {
			addFieldError(errs, "file", "Unsupported attachment file type")
		}
		if len(errs["file"]) == 0 {
			attNamePtr = &cleanName
			attMimePtr = &resolvedMime
			attBytes = content
		}
	}

	if len(errs) > 0 {
		return validatedContactSubmission{}, errs
	}
	return validatedContactSubmission{
		Name:               name,
		Phone:              phonePtr,
		Email:              email,
		Message:            message,
		AttachmentName:     attNamePtr,
		AttachmentMimeType: attMimePtr,
		AttachmentBytes:    attBytes,
	}, nil
}
