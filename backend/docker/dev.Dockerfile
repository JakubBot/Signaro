# Use full JDK image for dev (with tools)
FROM eclipse-temurin:24-alpine

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