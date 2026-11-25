package llm

import (
	"errors"
	"fmt"
	"strings"
)

const maxSchemaDepth = 16

// JSONSchema defines a provider-neutral structured-output schema subset translatable
// to both GCP Vertex AI responseSchema and OpenAI-compatible response_format json_schema.
type JSONSchema struct {
	Name        string                 `json:"name,omitempty"`
	Type        string                 `json:"type"`
	Description string                 `json:"description,omitempty"`
	Properties  map[string]*JSONSchema `json:"properties,omitempty"`
	Required    []string               `json:"required,omitempty"`
	Items       *JSONSchema            `json:"items,omitempty"`
	Enum        []string               `json:"enum,omitempty"`
	Minimum     *float64               `json:"minimum,omitempty"`
	Maximum     *float64               `json:"maximum,omitempty"`
	Nullable    bool                   `json:"nullable,omitempty"`
	Extra       map[string]any         `json:"extra,omitempty"`
}

func (s *JSONSchema) Validate() error {
	if s == nil {
		return errors.New("JSONSchema must not be nil")
	}
	return s.validateDepth(0)
}

func (s *JSONSchema) validateDepth(depth int) error {
	if depth > maxSchemaDepth {
		return fmt.Errorf("JSONSchema exceeds max depth %d", maxSchemaDepth)
	}
	if len(s.Extra) > 0 {
		for k := range s.Extra {
			return fmt.Errorf("unsupported JSONSchema keyword %q", k)
		}
	}
	t := strings.ToLower(strings.TrimSpace(s.Type))
	switch t {
	case "object", "array", "string", "integer", "number", "boolean":
	default:
		return fmt.Errorf("unsupported JSONSchema type %q", s.Type)
	}
	if s.Minimum != nil && s.Maximum != nil && *s.Minimum > *s.Maximum {
		return fmt.Errorf("JSONSchema minimum (%v) exceeds maximum (%v)", *s.Minimum, *s.Maximum)
	}
	if t == "array" {
		if s.Items == nil {
			return errors.New("JSONSchema array type requires items schema")
		}
		if err := s.Items.validateDepth(depth + 1); err != nil {
			return err
		}
	}
	if t == "object" {
		for name, prop := range s.Properties {
			if strings.TrimSpace(name) == "" {
				return errors.New("JSONSchema object property name must not be empty")
			}
			if prop == nil {
				return fmt.Errorf("JSONSchema property %q must not be nil", name)
			}
			if err := prop.validateDepth(depth + 1); err != nil {
				return fmt.Errorf("property %q: %w", name, err)
			}
		}
		for _, req := range s.Required {
			if _, ok := s.Properties[req]; !ok {
				return fmt.Errorf("JSONSchema required field %q not declared in properties", req)
			}
		}
	}
	return nil
}

// ToVertexSchema translates JSONSchema into Vertex AI Gemini generationConfig.responseSchema format.
func (s *JSONSchema) ToVertexSchema() (map[string]any, error) {
	if err := s.Validate(); err != nil {
		return nil, err
	}
	return s.toVertexMap(), nil
}

func (s *JSONSchema) toVertexMap() map[string]any {
	out := map[string]any{
		"type": strings.ToUpper(strings.TrimSpace(s.Type)),
	}
	if s.Description != "" {
		out["description"] = s.Description
	}
	if s.Nullable {
		out["nullable"] = true
	}
	if len(s.Enum) > 0 {
		out["enum"] = s.Enum
	}
	if s.Minimum != nil {
		out["minimum"] = *s.Minimum
	}
	if s.Maximum != nil {
		out["maximum"] = *s.Maximum
	}
	if s.Items != nil {
		out["items"] = s.Items.toVertexMap()
	}
	if len(s.Properties) > 0 {
		props := make(map[string]any, len(s.Properties))
		for k, v := range s.Properties {
			props[k] = v.toVertexMap()
		}
		out["properties"] = props
	}
	if len(s.Required) > 0 {
		out["required"] = s.Required
	}
	return out
}

// ToOpenAIResponseFormat translates JSONSchema into OpenAI-compatible response_format json_schema.
func (s *JSONSchema) ToOpenAIResponseFormat() (map[string]any, error) {
	if err := s.Validate(); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(s.Name)
	if name == "" {
		name = "structured_response"
	}
	return map[string]any{
		"type": "json_schema",
		"json_schema": map[string]any{
			"name":   name,
			"strict": true,
			"schema": s.toOpenAIMap(),
		},
	}, nil
}

func (s *JSONSchema) toOpenAIMap() map[string]any {
	t := strings.ToLower(strings.TrimSpace(s.Type))
	out := map[string]any{}
	if s.Nullable {
		out["type"] = []string{t, "null"}
	} else {
		out["type"] = t
	}
	if s.Description != "" {
		out["description"] = s.Description
	}
	if len(s.Enum) > 0 {
		out["enum"] = s.Enum
	}
	if s.Minimum != nil {
		out["minimum"] = *s.Minimum
	}
	if s.Maximum != nil {
		out["maximum"] = *s.Maximum
	}
	if s.Items != nil {
		out["items"] = s.Items.toOpenAIMap()
	}
	if t == "object" {
		props := make(map[string]any, len(s.Properties))
		for k, v := range s.Properties {
			props[k] = v.toOpenAIMap()
		}
		out["properties"] = props
		out["additionalProperties"] = false
		if len(s.Required) > 0 {
			out["required"] = s.Required
		}
	}
	return out
}
