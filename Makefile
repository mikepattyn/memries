# Local Compose stack.
#
#   make up           Start (build + up)
#   make down         Stop; keep volumes
#   make down WIPE=1  Stop; delete Compose volumes
#   make down-wipe    Same as WIPE=1
#
# WIPE does not delete bind-mounted ./data/photos (or ./data/cache).

COMPOSE ?= docker compose
PWSH ?= powershell

ifeq ($(OS),Windows_NT)
  REQUIRE_ENV := $(PWSH) -NoProfile -Command "if (-not (Test-Path -LiteralPath .env)) { Write-Error 'Missing .env (see README quick start)'; exit 1 }"
else
  REQUIRE_ENV := test -f .env || { echo "Missing .env (see README quick start)" >&2; exit 1; }
endif

.PHONY: help up down down-wipe

help:
	$(info make up              Start the stack (docker compose up -d --build))
	$(info make down            Stop containers; keep volumes)
	$(info make down WIPE=1     Stop, wipe Compose volumes)
	$(info make down-wipe       Alias for make down WIPE=1)
	$(info                      Bind-mounted ./data/photos is not removed.)
	@exit 0

up:
	$(REQUIRE_ENV)
	$(COMPOSE) up -d --build

down:
ifeq ($(WIPE),1)
	$(COMPOSE) down -v --remove-orphans
else
	$(COMPOSE) down --remove-orphans
endif

down-wipe:
	$(MAKE) down WIPE=1
