build-dev:
	docker compose -f compose.dev.yaml build

start-dev:
	docker compose -f compose.dev.yaml up

stop-dev:
	docker compose -f compose.dev.yaml down 

rebuild-backend-dev:
	docker compose -f compose.dev.yaml stop backend
	docker compose -f compose.dev.yaml build backend
	docker compose -f compose.dev.yaml up backend -d

rebuild-ai-dev:
	docker compose -f compose.dev.yaml stop ai
	docker compose -f compose.dev.yaml build ai
	docker compose -f compose.dev.yaml up ai -d

rebuild-frontend-dev:
	docker compose -f compose.dev.yaml stop frontend
	docker compose -f compose.dev.yaml build frontend
	docker compose -f compose.dev.yaml up frontend -d

rebuild-dev:
	docker compose -f compose.dev.yaml down
	docker compose -f compose.dev.yaml build
	docker compose -f compose.dev.yaml up

rebuild-dev-full:
	docker compose -f compose.dev.yaml down
	docker compose -f compose.dev.yaml build --no-cache
	docker compose -f compose.dev.yaml up

build-prod:
	docker compose -f compose.dev.yaml build

start-prod:
	docker compose -f compose.prod.yaml up

stop-prod:
	docker compose -f compose.prod.yaml down


rebuild-prod:
	docker compose -f compose.prod.yaml down  
	docker compose -f compose.prod.yaml build --no-cache
	docker compose -f compose.prod.yaml up

clean-all:
	docker compose -f compose.dev.yaml down
	docker compose -f compose.prod.yaml down
	docker system prune -f
	docker builder prune -a -f

# Logs commands
logs-ai-dev:
	docker compose -f compose.dev.yaml logs -f ai

logs-frontend-dev:
	docker compose -f compose.dev.yaml logs -f frontend

logs-backend-dev:
	docker compose -f compose.dev.yaml logs -f backend

logs-dev-all:
	docker compose -f compose.dev.yaml logs -f
