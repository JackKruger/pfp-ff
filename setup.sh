#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# PFP-FF — Couch Multiplayer Game Platform
# Setup & run script
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}→${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Check prerequisites ──
info "Checking prerequisites..."

NODE_MIN=20
command -v node >/dev/null 2>&1 || fail "Node.js is required. Install from https://nodejs.org/ (v${NODE_MIN}+)"
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -ge "$NODE_MIN" ] || fail "Node.js v${NODE_MIN}+ required (found v$(node -v))"
ok "Node.js $(node -v)"

if command -v pnpm >/dev/null 2>&1; then
  ok "pnpm $(pnpm -v)"
else
  info "Installing pnpm..."
  npm install -g pnpm@10
  ok "pnpm $(pnpm -v)"
fi

# ── Install dependencies ──
info "Installing dependencies..."
pnpm install
ok "Dependencies installed"

# ── Check for Playwright browsers (optional, for screenshots) ──
if grep -q '"playwright"' package.json 2>/dev/null; then
  if [ ! -d ~/.cache/ms-playwright/chromium* ]; then
    warn "Playwright browsers not found. Run 'pnpm exec playwright install chromium' if you need screenshots."
  fi
fi

# ── Summary ──
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  PFP-FF is ready!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Start the dev server:${NC}"
echo -e "    ${GREEN}pnpm dev${NC}"
echo ""
echo -e "  ${YELLOW}Then open in your browser:${NC}"
echo -e "    ${GREEN}http://localhost:5173/${NC}"
echo ""
echo -e "  ${YELLOW}Other commands:${NC}"
echo -e "    ${GREEN}pnpm build${NC}        Production build"
echo -e "    ${GREEN}pnpm test${NC}         Run tests"
echo -e "    ${GREEN}pnpm typecheck${NC}    TypeScript checks"
echo ""
echo -e "  ${YELLOW}Games:${NC}"
echo -e "    Pong            :5175  ${GREEN}2 players${NC}"
echo -e "    Space Invaders  :5176  ${GREEN}1-4 players${NC}"
echo -e "    Iron Yard       :5177  ${GREEN}1-4 players${NC}  (medieval brawler)"
echo -e "    Raskulls        :5174  ${GREEN}2-4 players${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"