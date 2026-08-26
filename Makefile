# Local Compose stack.
#
#   make up           Start (build + up)
#   make down         Stop; keep volumes
#   make down WIPE=1  Stop; delete Compose volumes
#   make down-wipe    Same as WIPE=1
#   make db-clear          Empty Arango collections; restart API
#   make e2e-docker        Plan isolated e2e-docker feature runs
#   make e2e-docker FORCE=1
#   make e2e-docker-force  Plan a fresh run of every feature
#
# WIPE does not delete bind-mounted ./data/photos (or ./data/cache).
# db-clear does not delete volumes or bind mounts.

COMPOSE ?= docker compose
PWSH ?= powershell

# Override: make <target> SCRIPT_SHELL=unix|powershell
ifeq ($(OS),Windows_NT)
  SCRIPT_SHELL ?= powershell
else
  SCRIPT_SHELL ?= unix
endif

ifeq ($(SCRIPT_SHELL),powershell)
  SCRIPT_EXT := ps1
  SCRIPT_RUN := $(PWSH) -NoProfile -ExecutionPolicy Bypass -File
else ifeq ($(SCRIPT_SHELL),unix)
  SCRIPT_EXT := sh
  SCRIPT_RUN :=
else
  $(error SCRIPT_SHELL must be 'unix' or 'powershell', got '$(SCRIPT_SHELL)')
endif

ifeq ($(OS),Windows_NT)
  REQUIRE_ENV := $(PWSH) -NoProfile -Command "if (-not (Test-Path -LiteralPath .env)) { Write-Error 'Missing .env (see README quick start)'; exit 1 }"
else
  REQUIRE_ENV := test -f .env || { echo "Missing .env (see README quick start)" >&2; exit 1; }
endif

.PHONY: help up down down-wipe db-clear e2e e2e-down e2e-docker e2e-docker-force

help:
	$(info make up              Start the stack (docker compose up -d --build))
	$(info make down            Stop containers; keep volumes)
	$(info make down WIPE=1     Stop, wipe Compose volumes)
	$(info make down-wipe       Alias for make down WIPE=1)
	$(info make db-clear        Empty Arango collections; restart the API)
	$(info make e2e             Playwright BDD against the isolated memries-e2e stack)
	$(info make e2e-down        Stop the isolated e2e stack; keep volumes)
	$(info make e2e-docker      Plan isolated e2e-docker feature runs)
	$(info make e2e-docker FORCE=1)
	$(info make e2e-docker-force  Plan a fresh run of every feature (refresh last-runs))
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

db-clear:
	$(REQUIRE_ENV)
	$(SCRIPT_RUN) ./scripts/clear-arango.$(SCRIPT_EXT)
	$(COMPOSE) restart backend

e2e:
	$(REQUIRE_ENV)
	npm --prefix e2e test

e2e-down:
	$(REQUIRE_ENV)
	npm --prefix e2e run stack:down

e2e-docker:
	$(REQUIRE_ENV)
ifeq ($(FORCE),1)
	$(SCRIPT_RUN) ./scripts/e2e-docker/e2e-docker.$(SCRIPT_EXT) plan --force
else
	$(SCRIPT_RUN) ./scripts/e2e-docker/e2e-docker.$(SCRIPT_EXT) plan
endif

e2e-docker-force:
	$(MAKE) e2e-docker FORCE=1
