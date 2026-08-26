package db

import (
	"strings"
	"testing"
)

func TestPhotoFilterAQLUsesTakenAtLocalForMonthAndRange(t *testing.T) {
	bind := map[string]interface{}{}
	got := photoFilterAQL(PhotoFilter{
		Months:    []string{"06"},
		LocalFrom: "2026-08-25",
		LocalTo:   "2026-08-26",
	}, bind)
	if !strings.Contains(got, `SUBSTRING(p.taken_at_local, 5, 2) IN @months`) {
		t.Fatalf("missing month filter: %s", got)
	}
	if !strings.Contains(got, `SUBSTRING(p.taken_at_local, 0, 10) >= @localFrom`) {
		t.Fatalf("missing local_from filter: %s", got)
	}
	if !strings.Contains(got, `SUBSTRING(p.taken_at_local, 0, 10) < @localTo`) {
		t.Fatalf("missing local_to filter: %s", got)
	}
	months, _ := bind["months"].([]string)
	if len(months) != 1 || months[0] != "06" {
		t.Fatalf("months bind %+v", bind["months"])
	}
	if bind["localFrom"] != "2026-08-25" || bind["localTo"] != "2026-08-26" {
		t.Fatalf("range bind %+v", bind)
	}
}
