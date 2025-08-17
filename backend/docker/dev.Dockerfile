FROM eclipse-temurin:24
# FROM eclipse-temurin:24-alpine

WORKDIR /app

# Copy build files and source code
COPY mvnw mvnw
COPY .mvn .mvn
COPY pom.xml pom.xml
COPY src src

RUN apt-get update && apt-get install -y bash dos2unix curl \
    && rm -rf /var/lib/apt/lists/*

RUN dos2unix mvnw && chmod +x mvnw

RUN ./mvnw dependency:resolve

EXPOSE 8080

# Fixes problem with mvnw \r ending on linux 
COPY entrypoint.sh /usr/local/bin/entrypoint.sh 
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

# Start aplikacji w trybie developerskim z hot reload
CMD ["./mvnw", "spring-boot:run"]