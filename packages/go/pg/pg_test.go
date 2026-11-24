package pg

import "testing"

func TestValidateDSN(t *testing.T) {
	t.Parallel()

	if err := ValidateDSN(DefaultDatabaseURL); err != nil {
		t.Fatalf("expected default DSN to be valid, got %v", err)
	}
	if err := ValidateDSN("mysql://localhost/db"); err == nil {
		t.Fatal("expected error for non-postgres scheme")
	}
	if err := ValidateDSN("postgres:///missinghost"); err == nil {
		t.Fatal("expected error for missing host")
	}
}
