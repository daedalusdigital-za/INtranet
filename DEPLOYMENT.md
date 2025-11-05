# Azure Deployment Guide for Project Tracker

## Prerequisites
- Azure account with active subscription
- Azure CLI installed
- Azure SQL Database
- Azure App Service (or Azure Static Web Apps for frontend)

## Step 1: Create Azure Resources

### 1.1 Create Resource Group
```bash
az group create --name ProjectTrackerRG --location eastus
```

### 1.2 Create Azure SQL Server and Database
```bash
# Create SQL Server
az sql server create \
  --name projecttracker-sql-server \
  --resource-group ProjectTrackerRG \
  --location eastus \
  --admin-user sqladmin \
  --admin-password YourStrongPassword123!

# Create SQL Database
az sql db create \
  --resource-group ProjectTrackerRG \
  --server projecttracker-sql-server \
  --name ProjectTrackerDb \
  --service-objective S0

# Configure firewall to allow Azure services
az sql server firewall-rule create \
  --resource-group ProjectTrackerRG \
  --server projecttracker-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 1.3 Create App Service Plan and Web App (Backend)
```bash
# Create App Service Plan
az appservice plan create \
  --name ProjectTrackerPlan \
  --resource-group ProjectTrackerRG \
  --sku B1 \
  --is-linux

# Create Web App for API
az webapp create \
  --name projecttracker-api \
  --resource-group ProjectTrackerRG \
  --plan ProjectTrackerPlan \
  --runtime "DOTNET|9.0"
```

### 1.4 Create Static Web App (Frontend)
```bash
az staticwebapp create \
  --name projecttracker-frontend \
  --resource-group ProjectTrackerRG \
  --location eastus
```

## Step 2: Configure Backend

### 2.1 Set Connection String
```bash
# Get SQL connection string
az sql db show-connection-string \
  --server projecttracker-sql-server \
  --name ProjectTrackerDb \
  --client ado.net

# Set connection string in App Service
az webapp config connection-string set \
  --resource-group ProjectTrackerRG \
  --name projecttracker-api \
  --connection-string-type SQLAzure \
  --settings DefaultConnection="Server=tcp:projecttracker-sql-server.database.windows.net,1433;Database=ProjectTrackerDb;User ID=sqladmin;Password=YourStrongPassword123!;Encrypt=true;Connection Timeout=30;"
```

### 2.2 Configure App Settings
```bash
az webapp config appsettings set \
  --resource-group ProjectTrackerRG \
  --name projecttracker-api \
  --settings \
    JwtSettings__SecretKey="YourSuperSecretKeyForProductionUse123456789!" \
    JwtSettings__Issuer="ProjectTrackerAPI" \
    JwtSettings__Audience="ProjectTrackerClient" \
    ASPNETCORE_ENVIRONMENT="Production"
```

### 2.3 Enable CORS
```bash
az webapp cors add \
  --resource-group ProjectTrackerRG \
  --name projecttracker-api \
  --allowed-origins https://projecttracker-frontend.azurestaticapps.net
```

### 2.4 Deploy Backend
```powershell
# Navigate to Backend folder
cd Backend

# Publish the application
dotnet publish -c Release -o ./publish

# Create zip file
Compress-Archive -Path ./publish/* -DestinationPath ./deploy.zip

# Deploy to Azure
az webapp deployment source config-zip \
  --resource-group ProjectTrackerRG \
  --name projecttracker-api \
  --src ./deploy.zip
```

## Step 3: Configure and Deploy Frontend

### 3.1 Update environment configuration
Create `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://projecttracker-api.azurewebsites.net/api'
};
```

### 3.2 Update services to use environment
Update API service files to use:
```typescript
import { environment } from '../../environments/environment';

private apiUrl = environment.apiUrl;
```

### 3.3 Build and Deploy
```powershell
# Navigate to Frontend folder
cd Frontend

# Install dependencies
npm install

# Build for production
ng build --configuration production

# Deploy to Azure Static Web Apps (using Azure CLI)
az staticwebapp deploy \
  --name projecttracker-frontend \
  --resource-group ProjectTrackerRG \
  --app-location "./dist/frontend/browser"
```

## Step 4: Database Migration

### 4.1 Run migrations from local machine
```powershell
# Update connection string in appsettings.json temporarily
# Then run:
dotnet ef database update

# Or use SQL scripts:
dotnet ef migrations script -o migration.sql
# Execute migration.sql in Azure SQL Database
```

## Step 5: Verify Deployment

### 5.1 Test API
```bash
curl https://projecttracker-api.azurewebsites.net/api/departments
```

### 5.2 Test Frontend
Open browser: `https://projecttracker-frontend.azurestaticapps.net`

## Step 6: Configure SSL and Custom Domain (Optional)

### 6.1 Add Custom Domain to API
```bash
az webapp config hostname add \
  --webapp-name projecttracker-api \
  --resource-group ProjectTrackerRG \
  --hostname api.yourcompany.com
```

### 6.2 Add Custom Domain to Static Web App
```bash
az staticwebapp hostname set \
  --name projecttracker-frontend \
  --resource-group ProjectTrackerRG \
  --hostname app.yourcompany.com
```

## Step 7: Monitoring and Diagnostics

### 7.1 Enable Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app projecttracker-insights \
  --location eastus \
  --resource-group ProjectTrackerRG

# Get instrumentation key
az monitor app-insights component show \
  --app projecttracker-insights \
  --resource-group ProjectTrackerRG \
  --query instrumentationKey

# Add to App Service
az webapp config appsettings set \
  --resource-group ProjectTrackerRG \
  --name projecttracker-api \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=YOUR_KEY"
```

### 7.2 Enable Logging
```bash
az webapp log config \
  --name projecttracker-api \
  --resource-group ProjectTrackerRG \
  --application-logging filesystem \
  --level information
```

## Step 8: Security Best Practices

1. **Use Azure Key Vault for secrets**
2. **Enable HTTPS only**
3. **Configure authentication on App Service**
4. **Use Managed Identity for database access**
5. **Enable Azure DDoS Protection**
6. **Set up Azure Front Door for CDN and WAF**

## Continuous Deployment with GitHub Actions

### Backend (App Service)
Create `.github/workflows/backend-deploy.yml`:
```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [ main ]
    paths:
      - 'Backend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v1
        with:
          dotnet-version: '9.0.x'
      
      - name: Build
        run: |
          cd Backend
          dotnet build --configuration Release
          dotnet publish --configuration Release --output ./publish
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: projecttracker-api
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: Backend/publish
```

### Frontend (Static Web App)
Create `.github/workflows/frontend-deploy.yml`:
```yaml
name: Deploy Frontend to Azure Static Web Apps

on:
  push:
    branches: [ main ]
    paths:
      - 'Frontend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Build
        run: |
          cd Frontend
          npm install
          npm run build -- --configuration production
      
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "Frontend"
          output_location: "dist/frontend/browser"
```

## Troubleshooting

### Common Issues

1. **Database connection fails**
   - Check firewall rules
   - Verify connection string
   - Ensure App Service IP is allowed

2. **CORS errors**
   - Verify CORS settings on API
   - Check allowed origins

3. **SignalR not connecting**
   - Enable WebSockets on App Service
   - Check authentication token

4. **Slow performance**
   - Upgrade App Service plan
   - Enable caching
   - Use Azure CDN

## Cost Optimization

- Use Azure DevTest pricing for development
- Configure auto-scaling
- Use Azure Reserved Instances for production
- Monitor costs with Azure Cost Management

## Backup and Disaster Recovery

- Enable automated backups for Azure SQL
- Configure geo-replication for database
- Set up App Service backup
- Store backups in Azure Blob Storage

## Support

For deployment issues, contact the DevOps team.
