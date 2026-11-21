# Docker Setup Guide

## Overview
This project is containerized using Docker with the following services:
- **Frontend**: Angular application served by Nginx
- **Backend**: ASP.NET Core Web API
- **Database**: SQL Server 2022 Express

## Prerequisites
- Docker Desktop installed and running
- At least 4GB of RAM allocated to Docker

## Quick Start

### 1. Build and Run All Services
```bash
docker-compose up -d --build
```

### 2. Access the Application
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:5000
- **Database**: localhost:1433

### 3. Stop All Services
```bash
docker-compose down
```

### 4. Stop and Remove Volumes (Complete Cleanup)
```bash
docker-compose down -v
```

## Individual Service Commands

### Backend Only
```bash
cd Backend
docker build -t projecttracker-backend .
docker run -p 5000:80 projecttracker-backend
```

### Frontend Only
```bash
cd Frontend
docker build -t projecttracker-frontend .
docker run -p 4200:80 projecttracker-frontend
```

## Database Configuration

### Default Credentials
- **Server**: localhost,1433
- **Username**: sa
- **Password**: YourStrong@Passw0rd

⚠️ **Important**: Change the SA password in `docker-compose.yml` for production use!

### Run Migrations
After the containers are running, apply migrations:
```bash
docker exec -it projecttracker-backend dotnet ef database update
```

### Access SQL Server
```bash
docker exec -it projecttracker-db /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd
```

## Useful Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

### Restart a Service
```bash
docker-compose restart backend
```

### Rebuild a Service
```bash
docker-compose up -d --build backend
```

### Check Running Containers
```bash
docker-compose ps
```

### Enter Container Shell
```bash
docker exec -it projecttracker-backend sh
docker exec -it projecttracker-frontend sh
```

## Troubleshooting

### Database Connection Issues
1. Check if database is healthy:
   ```bash
   docker-compose ps
   ```

2. Wait for database to be fully started (may take 30-60 seconds)

3. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

### Frontend Can't Connect to Backend
- Ensure all services are running: `docker-compose ps`
- Check nginx configuration in `Frontend/nginx.conf`
- Verify API calls are proxied correctly through `/api/` path

### Port Conflicts
If ports 4200, 5000, or 1433 are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "NEW_PORT:80"  # Change NEW_PORT to an available port
```

## Production Considerations

1. **Environment Variables**: Use `.env` file for sensitive data
2. **Database Password**: Change default SA password
3. **SSL/TLS**: Configure HTTPS certificates
4. **Resource Limits**: Set memory and CPU limits in docker-compose.yml
5. **Health Checks**: Monitor container health
6. **Logging**: Configure log aggregation
7. **Backups**: Implement database backup strategy

## Development vs Production

### Development (Current Setup)
```bash
docker-compose up -d
```

### Production Recommendations
- Use environment-specific docker-compose files:
  - `docker-compose.yml` (base)
  - `docker-compose.prod.yml` (production overrides)
  
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Network Architecture

All services communicate through the `projecttracker-network` bridge network:
- Frontend → Backend: via nginx proxy at `/api/` and `/hubs/`
- Backend → Database: via service name `database:1433`
- External → Frontend: port 4200
- External → Backend: port 5000 (can be closed if all traffic goes through frontend)
