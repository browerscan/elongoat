# ElonGoat - Production Deployment Makefile
# Target: /opt/docker-projects/standalone-apps/elongoat

.PHONY: deploy down logs restart validate clean

# Default: validate + build + deploy
deploy: validate
	@echo "🚀 Building and deploying ElonGoat..."
	docker compose up -d --build
	@echo "✅ Deployed. Run 'make logs' to check."

# Stop all services
down:
	@echo "🛑 Stopping ElonGoat..."
	docker compose down

# View logs (follow mode)
logs:
	docker compose logs -f --tail=100

# Restart (down + up)
restart: down deploy

# Validate configuration before deploy
validate:
	@echo "🔍 Validating configuration..."
	@test -f .env || (echo "❌ Missing .env file" && exit 1)
	@docker compose config > /dev/null || (echo "❌ Invalid docker-compose.yml" && exit 1)
	@echo "✅ Configuration valid"

# Clean build cache (use with caution)
clean:
	@echo "🧹 Cleaning build cache..."
	docker compose down --rmi local
	@echo "✅ Build cache cleaned"

# Health check
health:
	@echo "🏥 Checking health..."
	@curl -sf http://localhost:3000/api/health || (echo "❌ Local health check failed" && curl -sf https://$${API_DOMAIN:-api.elongoat.io}/api/health || echo "❌ External health check failed")

# Apply database schema
db-schema:
	@echo "📊 Applying database schema..."
	@test -f .env && export $$(grep -v '^#' .env | xargs) && \
		psql "$$DATABASE_URL" -f backend/supabase/schema.sql
	@echo "✅ Schema applied"

# Seed content (PAA answers, sample videos/tweets)
db-seed-content:
	@echo "🌱 Seeding content..."
	@test -f .env && export $$(cat .env | xargs) && \
		npx tsx backend/scripts/seed_content.ts
	@echo "✅ Content seeding complete"
