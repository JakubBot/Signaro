build-dev:
	docker-compose -f compose.dev.yaml build

start-dev:
	docker-compose -f compose.dev.yaml up

stop-dev:
	docker-compose -f compose.dev.yaml down 


build-prod:
	docker-compose -f compose.dev.yaml build

start-prod:
	docker-compose -f compose.prod.yaml up

stop-prod:
	docker-compose -f compose.prod.yaml down

rebuild-dev:
	docker-compose -f compose.dev.yaml down
	docker-compose -f compose.dev.yaml build --no-cache
	docker-compose -f compose.dev.yaml up

rebuild-prod:
	docker-compose -f compose.prod.yaml down  
	docker-compose -f compose.prod.yaml build --no-cache
	docker-compose -f compose.prod.yaml up

clean:
	docker-compose -f compose.dev.yaml down
	docker-compose -f compose.prod.yaml down
	docker system prune -f
	docker builder prune -a -f