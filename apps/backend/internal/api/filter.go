package api

import (
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/memries/memries/internal/db"
)

func parsePhotoFilter(q url.Values) db.PhotoFilter {
	filter := db.PhotoFilter{
		Query:     strings.TrimSpace(q.Get("q")),
		LocalFrom: parseLocalDay(q.Get("local_from")),
		LocalTo:   parseLocalDay(q.Get("local_to")),
	}
	if years := q["year"]; len(years) > 0 {
		for _, year := range years {
			year = strings.TrimSpace(year)
			if year != "" {
				filter.Years = append(filter.Years, year)
			}
		}
	}
	if months := q["month"]; len(months) > 0 {
		for _, month := range months {
			if month = parseMonth(month); month != "" {
				filter.Months = append(filter.Months, month)
			}
		}
	}
	if raw := strings.TrimSpace(q.Get("favorite")); raw != "" {
		if v, err := strconv.ParseBool(raw); err == nil {
			filter.Favorite = &v
		}
	}
	return filter
}

func parseMonth(raw string) string {
	month := strings.TrimSpace(raw)
	if len(month) != 2 {
		return ""
	}
	n, err := strconv.Atoi(month)
	if err != nil || n < 1 || n > 12 {
		return ""
	}
	return month
}

func parseLocalDay(raw string) string {
	day := strings.TrimSpace(raw)
	if len(day) != 10 || day[4] != '-' || day[7] != '-' {
		return ""
	}
	if _, err := time.Parse("2006-01-02", day); err != nil {
		return ""
	}
	return day
}
