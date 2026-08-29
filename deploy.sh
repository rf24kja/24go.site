#!/usr/bin/env bash
# Deploy to VPS — push to git, SCP changed files, rebuild containers.
# Usage: bash deploy.sh [backend|worker|bot|all]
# Rollback: bash deploy.sh rollback
set -euo pipefail

VPS="root@46.250.235.165"
VPS_DIR="/opt/generator-ad"
SSH_KEY="$HOME/.ssh/id_ed25519_generator"
SSH="ssh -i $SSH_KEY $VPS"
SCP="scp -i $SSH_KEY"
SCOPE="${1:-all}"

# Rollback support
if [ "$SCOPE" = "rollback" ]; then
  echo "=== Rollback ==="
  LAST_TAG=$(git tag -l 'deploy-*' --sort=-creatordate | head -1)
  if [ -z "$LAST_TAG" ]; then
    echo "No deploy tags found. Cannot rollback."
    exit 1
  fi
  echo "Rolling back to $LAST_TAG..."
  git checkout "$LAST_TAG" -- .
  bash "$0" all
  exit 0
fi

echo "=== LeadGen Deploy ==="
echo "Scope: $SCOPE"
echo "Time: $(date)"
echo ""

# 1. Git push
echo "[1/4] Pushing to git..."
cd "$(dirname "$0")"
git add -A
# Don't commit lockfiles or buildinfo
git reset HEAD "services/dashboard/package-lock.json" "services/dashboard/tsconfig.tsbuildinfo" 2>/dev/null || true

CHANGED=$(git diff --cached --name-only 2>/dev/null | head -1)
if [ -n "$CHANGED" ]; then
  git commit -m "deploy: $(date +%Y-%m-%d_%H-%M)" --quiet
  git tag "deploy-$(date +%Y%m%d-%H%M%S)" --quiet
  git push origin main --quiet 2>&1
  echo "  Pushed."
else
  echo "  Nothing to commit."
fi

# 2. SCP changed backend files
echo ""
echo "[2/4] Syncing backend files..."

deploy_backend() {
  local files=(
    "services/backend/app/main.py"
    "services/backend/app/config.py"
    "services/backend/app/models.py"
    "services/backend/app/schemas.py"
    "services/backend/app/routers/leads.py"
    "services/backend/app/routers/campaigns.py"
    "services/backend/app/routers/analytics.py"
    "services/backend/app/routers/campaign_analytics.py"
    "services/backend/app/routers/notifications.py"
    "services/backend/app/routers/groups.py"
    "services/backend/app/routers/accounts.py"
  )
  for f in "${files[@]}"; do
    if [ -f "$f" ]; then
      $SCP "$f" "$VPS:$VPS_DIR/$f" 2>/dev/null
    fi
  done
  # Migrations
  for f in services/backend/alembic/versions/*.py; do
    $SCP "$f" "$VPS:$VPS_DIR/$f" 2>/dev/null
  done
  echo "  Backend synced."
}

deploy_worker() {
  local files=(
    "services/worker/app/celery_app.py"
    "services/worker/app/telegram_client.py"
    "services/worker/app/lead_pipeline.py"
    "services/worker/app/notifications.py"
    "services/worker/app/vk_client.py"
    "services/worker/app/tasks/campaign_scheduler.py"
    "services/worker/app/tasks/listener.py"
    "services/worker/app/tasks/poster.py"
    "services/worker/app/tasks/comment_scraper.py"
    "services/worker/app/tasks/group_scanner.py"
    "services/worker/app/tasks/vk_listener.py"
    "services/worker/app/tasks/vk_poster.py"
    "services/worker/app/tasks/vk_comment_scraper.py"
    "services/worker/app/tasks/vk_group_scanner.py"
    "services/worker/app/tasks/warmup.py"
    "services/worker/requirements.txt"
  )
  for f in "${files[@]}"; do
    if [ -f "$f" ]; then
      $SCP "$f" "$VPS:$VPS_DIR/$f" 2>/dev/null
    fi
  done
  echo "  Worker synced."
}

deploy_bot() {
  $SCP "services/bot/bot.py" "$VPS:$VPS_DIR/services/bot/bot.py" 2>/dev/null
  echo "  Bot synced."
}

if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
  deploy_backend
fi
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "worker" ]; then
  deploy_worker
fi
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "bot" ]; then
  deploy_bot
fi

# 3. Rebuild containers
echo ""
echo "[3/4] Rebuilding containers..."
if [ "$SCOPE" = "all" ]; then
  $SSH "cd $VPS_DIR && docker compose up -d --build --no-deps fastapi worker-poster worker-listener worker-parser worker-warmup worker-billing celery-beat bot 2>&1 | tail -20"
elif [ "$SCOPE" = "backend" ]; then
  $SSH "cd $VPS_DIR && docker compose up -d --build --no-deps fastapi 2>&1 | tail -5"
elif [ "$SCOPE" = "worker" ]; then
  $SSH "cd $VPS_DIR && docker compose up -d --build --no-deps worker-poster worker-listener worker-parser worker-warmup worker-billing celery-beat 2>&1 | tail -10"
elif [ "$SCOPE" = "bot" ]; then
  $SSH "cd $VPS_DIR && docker compose up -d --build --no-deps bot 2>&1 | tail -5"
fi

# 4. Run migrations
echo ""
echo "[4/4] Running migrations..."
$SSH "cd $VPS_DIR && docker compose exec -T fastapi alembic upgrade head 2>&1"

echo ""
echo "=== Deploy Complete ==="
echo "API: https://api.24go.site/health"
echo "Dashboard: https://24go.site"
