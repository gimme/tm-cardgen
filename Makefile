# `.github/workflows/` run these targets by name, so renaming one breaks CI.

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help
MAKEFLAGS += --no-print-directory

.PHONY: help install dev test typecheck lint format format-check check \
        build build-pages verify-pages

# e.g. `make dev ARGS=--host`, `make test ARGS=src/core`
ARGS ?=

# GitHub Pages serves the app from /<repo>/, not the domain root.
PAGES_BASE ?= /tm-cardgen/

# npm rewrites this file on every install, so its mtime tracks node_modules.
DEPS := node_modules/.package-lock.json

help: ## List targets
	@grep -hE '^[a-z][a-z-]*:.*## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN { FS = ":.*## " } { printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2 }'

$(DEPS): package-lock.json
	npm ci
	@touch $@

install: $(DEPS) ## Install deps from the lockfile (only when it is newer)

dev: $(DEPS) ## Dev server (append ?calibrate to the URL for the mm-grid overlay)
	npm run dev -- $(ARGS)

test: $(DEPS) ## Run the vitest suite once
	npm test -- $(ARGS)

typecheck: $(DEPS) ## Typecheck app + DOM-free core + tests
	npm run typecheck

lint: $(DEPS) ## oxlint
	npm run lint

format: $(DEPS) ## Rewrite sources with prettier
	npm run format

format-check: $(DEPS) ## Fail if anything is unformatted
	npm run format:check

check: ## Everything CI runs: typecheck, lint, format check, tests
	$(MAKE) typecheck
	$(MAKE) lint
	$(MAKE) format-check
	$(MAKE) test

build: $(DEPS) ## Production build into dist/ (typechecks first)
	npm run build

build-pages: $(DEPS) ## Production build with the GitHub Pages base path
	BASE_PATH=$(PAGES_BASE) npm run build

verify-pages: build-pages ## Build for Pages, then check every asset link resolves
	BASE_PATH=$(PAGES_BASE) npm run check:links
