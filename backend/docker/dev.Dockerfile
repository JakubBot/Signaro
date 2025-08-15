FROM eclipse-temurin:24
# FROM eclipse-temurin:24-alpine


RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# RUN apt-get update && apt-get install -y --no-install-recommends \
#     curl \
#     wget \
#     git \
#     vim \
#     net-tools \
#     procps \
#     unzip \
#     && rm -rf /var/lib/apt/lists/*
# RUN apk add --no-cache curl # Install curl for health checks

WORKDIR /app

# Kopiuj pliki buildowe i kod źródłowy
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
COPY src src

# Instalacja zależności (optional, można zrobić podczas budowy obrazu)
RUN ./mvnw dependency:resolve

# Expose port aplikacji (domyślny Spring Boot)
EXPOSE 8080

# Start aplikacji w trybie developerskim z hot reload
CMD ["./mvnw", "spring-boot:run"]

# , "-Dspring-boot.run.profiles=dev", \
#      "-Dspring.devtools.restart.enabled=true", \
#      "-Dspring.devtools.livereload.enabled=true", \
#      "-Dspring.devtools.remote.secret=mysecret"