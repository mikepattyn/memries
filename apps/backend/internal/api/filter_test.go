package api

import (
	"net/url"
	"testing"
	"time"
)

func TestParsePhotoFilterReadsYearFavoriteAndQuery(t *testing.T) {
	q := url.Values{
		"year":     []string{"2024", "2025"},
		"favorite": []string{"true"},
		"q":        []string{"2024-08"},
	}
	got := parsePhotoFilter(q)
	if len(got.Years) != 2 || got.Years[0] != "2024" || got.Years[1] != "2025" {
		t.Fatalf("years %+v", got.Years)
	}
	if got.Favorite == nil || !*got.Favorite {
		t.Fatal("expected favorite true")
	}
	if got.Query != "2024-08" {
		t.Fatalf("query %q", got.Query)
	}
}

func TestParseRangeDefaultAllowsNearFutureCaptureTimes(t *testing.T) {
	from, to, err := parseRange("", "")
	if err != nil {
		t.Fatal(err)
	}
	future := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)
	if !from.Before(future) || !future.Before(to) {
		t.Fatalf("range [%s, %s] excludes %s", from, to, future)
	}
}

func TestParsePhotoFilterEmptyMeansNoConstraint(t *testing.T) {
	got := parsePhotoFilter(url.Values{})
	if got.Favorite != nil || len(got.Years) != 0 || len(got.Months) != 0 || got.Query != "" || got.LocalFrom != "" || got.LocalTo != "" {
		t.Fatalf("got %+v", got)
	}
}

func TestParsePhotoFilterReadsMonthAndLocalTakenAtBounds(t *testing.T) {
	q := url.Values{
		"month":      []string{"06", "07"},
		"local_from": []string{"2025-12-01"},
		"local_to":   []string{"2026-03-01"},
	}
	got := parsePhotoFilter(q)
	if len(got.Months) != 2 || got.Months[0] != "06" || got.Months[1] != "07" {
		t.Fatalf("months %+v", got.Months)
	}
	if got.LocalFrom != "2025-12-01" || got.LocalTo != "2026-03-01" {
		t.Fatalf("local bounds %q %q", got.LocalFrom, got.LocalTo)
	}
}

func TestParsePhotoFilterIgnoresInvalidMonthAndLocalDays(t *testing.T) {
	q := url.Values{
		"month":      []string{"13", "ab", "6"},
		"local_from": []string{"2025-1-1"},
		"local_to":   []string{"yesterday"},
	}
	got := parsePhotoFilter(q)
	if len(got.Months) != 0 || got.LocalFrom != "" || got.LocalTo != "" {
		t.Fatalf("got %+v", got)
	}
}
