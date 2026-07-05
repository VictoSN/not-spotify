# Multi-stage build for the NotSpotify .NET 8 API.
# Build context is this directory (backend/src/NotSpotify.Api):
#   docker build -t not-spotify-api backend/src/NotSpotify.Api

# ---- build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first (cached until the csproj changes) then build.
COPY NotSpotify.Api.csproj ./
RUN dotnet restore NotSpotify.Api.csproj

COPY . ./
RUN dotnet publish NotSpotify.Api.csproj -c Release -o /app --no-restore

# ---- runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./

# Kestrel listens on 8080 for the ALB/ECS target group to reach.
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "NotSpotify.Api.dll"]
