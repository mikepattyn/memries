package index

import "testing"

func TestPrefixFromEmailOwnerFolder(t *testing.T) {
	got, err := PrefixFromEmail("Admin@Example.com")
	if err != nil {
		t.Fatal(err)
	}
	if got != "admin@example.com" {
		t.Fatalf("got %q", got)
	}
}

func TestPrefixFromEmailRejectsTraversal(t *testing.T) {
	cases := []string{"", "  ", "../photos", "a/b@x.com", `a\b@x.com`, "a:b@x.com", "..", "."}
	for _, email := range cases {
		if _, err := PrefixFromEmail(email); err != ErrInvalidEmail {
			t.Fatalf("%q: got %v, want ErrInvalidEmail", email, err)
		}
	}
}
