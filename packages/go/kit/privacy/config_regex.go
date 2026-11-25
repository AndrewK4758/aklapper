package privacy

import (
	"errors"
	"fmt"
	"regexp"
	"regexp/syntax"
)

// validateAndMeasureRegex walks a parsed Go RE2 AST (without Simplify) and enforces a strictly
// context-free, finite regex grammar so streaming chunk boundaries can never alter matches.
// Returns (minRunes, maxRunes, nil) on success or a fail-closed error without echoing raw patterns.
func validateAndMeasureRegex(re *syntax.Regexp) (int, int, error) {
	if re == nil {
		return 0, 0, nil
	}
	switch re.Op {
	case syntax.OpEmptyMatch:
		return 0, 0, nil
	case syntax.OpLiteral:
		n := len(re.Rune)
		return n, n, nil
	case syntax.OpCharClass:
		if len(re.Rune) == 0 {
			return 0, 0, errors.New("privacy denylist regex contains unsatisfiable character class")
		}
		return 1, 1, nil
	case syntax.OpAnyCharNotNL, syntax.OpAnyChar:
		return 1, 1, nil
	case syntax.OpCapture:
		if len(re.Sub) == 0 {
			return 0, 0, nil
		}
		return validateAndMeasureRegex(re.Sub[0])
	case syntax.OpQuest:
		if len(re.Sub) == 0 {
			return 0, 0, nil
		}
		_, subMax, err := validateAndMeasureRegex(re.Sub[0])
		if err != nil {
			return 0, 0, err
		}
		return 0, subMax, nil
	case syntax.OpStar, syntax.OpPlus:
		return 0, 0, errors.New("privacy denylist entry contains unbounded regex quantifier")
	case syntax.OpRepeat:
		if re.Max < 0 || len(re.Sub) == 0 {
			return 0, 0, errors.New("privacy denylist entry contains unbounded regex quantifier")
		}
		subMin, subMax, err := validateAndMeasureRegex(re.Sub[0])
		if err != nil {
			return 0, 0, err
		}
		if re.Max == 0 || subMax == 0 {
			return 0, 0, nil
		}
		if re.Max > MaxNormalizedDenylistRunes || subMax > MaxNormalizedDenylistRunes || re.Max*subMax > MaxNormalizedDenylistRunes {
			return 0, 0, fmt.Errorf("privacy denylist regex exceeds max %d runes", MaxNormalizedDenylistRunes)
		}
		minRunes := 0
		if re.Min > 0 && subMin > 0 {
			if re.Min > MaxNormalizedDenylistRunes || subMin > MaxNormalizedDenylistRunes || re.Min*subMin > MaxNormalizedDenylistRunes {
				return 0, 0, fmt.Errorf("privacy denylist regex exceeds max %d runes", MaxNormalizedDenylistRunes)
			}
			minRunes = re.Min * subMin
		}
		return minRunes, re.Max * subMax, nil
	case syntax.OpConcat:
		totalMin, totalMax := 0, 0
		for _, sub := range re.Sub {
			subMin, subMax, err := validateAndMeasureRegex(sub)
			if err != nil {
				return 0, 0, err
			}
			totalMin += subMin
			totalMax += subMax
			if totalMax > MaxNormalizedDenylistRunes {
				return 0, 0, fmt.Errorf("privacy denylist regex exceeds max %d runes", MaxNormalizedDenylistRunes)
			}
		}
		return totalMin, totalMax, nil
	case syntax.OpAlternate:
		if len(re.Sub) == 0 {
			return 0, 0, errors.New("privacy denylist regex contains empty alternation")
		}
		bestMin := -1
		bestMax := 0
		for _, sub := range re.Sub {
			subMin, subMax, err := validateAndMeasureRegex(sub)
			if err != nil {
				return 0, 0, err
			}
			if bestMin < 0 || subMin < bestMin {
				bestMin = subMin
			}
			if subMax > bestMax {
				bestMax = subMax
			}
		}
		return bestMin, bestMax, nil
	case syntax.OpBeginLine, syntax.OpEndLine,
		syntax.OpBeginText, syntax.OpEndText,
		syntax.OpWordBoundary, syntax.OpNoWordBoundary:
		return 0, 0, errors.New("privacy denylist regex forbids zero-width boundary or anchor assertions")
	case syntax.OpNoMatch:
		return 0, 0, errors.New("privacy denylist regex is unsatisfiable")
	default:
		return 0, 0, errors.New("privacy denylist regex contains unsupported construct")
	}
}

func compileContextFreeDenylistRegex(ruleIndex int, expr string) (*regexp.Regexp, int, error) {
	parsed, err := syntax.Parse("(?i)"+expr, syntax.Perl)
	if err != nil {
		return nil, 0, sanitizeRegexError(ruleIndex, err)
	}
	minRunes, maxRunes, err := validateAndMeasureRegex(parsed)
	if err != nil {
		return nil, 0, fmt.Errorf("rule %d: %w", ruleIndex, err)
	}
	if minRunes < 1 {
		return nil, 0, fmt.Errorf("rule %d: privacy denylist regex must match at least 1 rune", ruleIndex)
	}
	if maxRunes > MaxNormalizedDenylistRunes {
		return nil, 0, fmt.Errorf("rule %d: privacy denylist regex max match length %d exceeds max %d runes", ruleIndex, maxRunes, MaxNormalizedDenylistRunes)
	}
	compiled, err := regexp.Compile("(?i)" + expr)
	if err != nil {
		return nil, 0, sanitizeRegexError(ruleIndex, err)
	}
	if compiled.MatchString("") {
		return nil, 0, fmt.Errorf("rule %d: privacy denylist regex must not match empty string", ruleIndex)
	}
	return compiled, maxRunes, nil
}

func sanitizeRegexError(ruleIndex int, err error) error {
	var se *syntax.Error
	if errors.As(err, &se) {
		return fmt.Errorf("invalid privacy denylist regex at rule %d: %s", ruleIndex, se.Code)
	}
	return fmt.Errorf("invalid privacy denylist regex at rule %d", ruleIndex)
}
