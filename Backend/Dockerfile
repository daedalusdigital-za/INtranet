# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY ["ProjectTracker.API.csproj", "./"]
RUN dotnet restore "ProjectTracker.API.csproj"

# Copy everything else and build
COPY . .
RUN dotnet build "ProjectTracker.API.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "ProjectTracker.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Container-optimized GC settings
ENV DOTNET_gcServer=1
ENV DOTNET_GCDynamicAdaptationMode=1

EXPOSE 5143

COPY --from=publish /app/publish .

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -sf http://localhost:5143/api/aichat/health || exit 1

ENTRYPOINT ["dotnet", "ProjectTracker.API.dll"]
