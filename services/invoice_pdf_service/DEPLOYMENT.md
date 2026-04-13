# Deployment Guide - PyPDF2 Invoice Service

Complete deployment instructions for various platforms and hosting providers.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker](#docker)
3. [Railway.app](#railway-app)
4. [Heroku](#heroku)
5. [Azure App Service](#azure-app-service)
6. [AWS](#aws)
7. [DigitalOcean](#digitalocean)

---

## Local Development

### Quick Start
```bash
cd services/invoice_pdf_service
./run.sh  # or run.bat on Windows
```

### Manual Setup
```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate.bat

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run
python main.py
```

Service available at: http://127.0.0.1:8000

---

## Docker

### Build Locally

```bash
cd services/invoice_pdf_service

# Build image
docker build -t invoice-pdf-service:latest .

# Run container
docker run -p 8000:8000 \
  -e HOST=0.0.0.0 \
  -e PORT=8000 \
  -e ENVIRONMENT=production \
  invoice-pdf-service:latest
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Push to Docker Hub

```bash
# Login
docker login

# Tag image
docker tag invoice-pdf-service:latest your-username/invoice-pdf-service:latest

# Push
docker push your-username/invoice-pdf-service:latest
```

---

## Railway.app

### Prerequisites
- GitHub account
- Railway account (free tier available)

### Deployment Steps

1. **Push to GitHub**
   ```bash
   git add services/invoice_pdf_service/
   git commit -m "Add PyPDF2 invoice service"
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to https://railway.app/dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Python project

3. **Configure**
   - Port: `8000`
   - Click on service
   - Go to Variables
   - Add environment variables:
     ```
     HOST=0.0.0.0
     PORT=8000
     ENVIRONMENT=production
     LOG_LEVEL=info
     NEXT_APP_URL=https://your-nextjs-app.com
     ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy generated URL

5. **Update Next.js**
   - In Next.js `.env.production`:
     ```env
     PDF_SERVICE_URL=https://your-railway-app.up.railway.app
     ```

### Custom Domain (Optional)
- In Railway settings, add custom domain
- Configure DNS records according to Railway

---

## Heroku

### Prerequisites
- Heroku CLI installed
- Heroku account (free tier available)

### Deployment Steps

1. **Create Procfile** (if not exists)
   ```bash
   cd services/invoice_pdf_service
   echo "web: gunicorn main:app" > Procfile
   ```

2. **Create Heroku app**
   ```bash
   heroku login
   heroku create your-app-name
   ```

3. **Add Python buildpack** (usually auto-detected)
   ```bash
   heroku buildpacks:add heroku/python
   ```

4. **Set environment variables**
   ```bash
   heroku config:set HOST=0.0.0.0
   heroku config:set PORT=8000
   heroku config:set ENVIRONMENT=production
   heroku config:set LOG_LEVEL=info
   heroku config:set NEXT_APP_URL=https://your-nextjs-app.com
   ```

5. **Deploy from subdirectory**
   
   Create `.gitignore` in root (if needed):
   ```
   # Allow services folder
   # (already tracked)
   ```
   
   Deploy specific folder:
   ```bash
   git subtree push --prefix services/invoice_pdf_service heroku main
   ```

6. **View logs**
   ```bash
   heroku logs --tail
   ```

7. **Get URL**
   ```bash
   heroku apps:info
   # Or check Heroku dashboard
   ```

### Alternative: Procfile with module reference
```
web: gunicorn --chdir services/invoice_pdf_service main:app
```

---

## Azure App Service

### Prerequisites
- Azure account (free tier available)
- Azure CLI installed

### Deployment Steps

1. **Create Resource Group**
   ```bash
   az group create \
     --name invoice-service-rg \
     --location eastus
   ```

2. **Create App Service Plan**
   ```bash
   az appservice plan create \
     --name invoice-service-plan \
     --resource-group invoice-service-rg \
     --sku B1 \
     --runtime "python|3.11"
   ```

3. **Create Web App**
   ```bash
   az webapp create \
     --resource-group invoice-service-rg \
     --plan invoice-service-plan \
     --name invoice-pdf-service \
     --runtime "python|3.11"
   ```

4. **Configure Startup Command**
   ```bash
   az webapp config set \
     --resource-group invoice-service-rg \
     --name invoice-pdf-service \
     --startup-file "gunicorn --bind 0.0.0.0 --workers 4 main:app"
   ```

5. **Set Environment Variables**
   ```bash
   az webapp config appsettings set \
     --resource-group invoice-service-rg \
     --name invoice-pdf-service \
     --settings \
       HOST=0.0.0.0 \
       PORT=8000 \
       ENVIRONMENT=production \
       LOG_LEVEL=info \
       NEXT_APP_URL=https://your-nextjs-app.com
   ```

6. **Deploy Code**
   ```bash
   # Initialize Git
   git config --global user.email "you@example.com"
   git config --global user.name "Your Name"
   
   # Get deployment credentials
   az webapp deployment user set \
     --user-name <username> \
     --password <password>
   
   # Get Git URL
   git remote add azure <git-url-from-azure>
   
   # Deploy
   git subtree push --prefix services/invoice_pdf_service azure main
   ```

7. **Monitor**
   ```bash
   az webapp log tail \
     --resource-group invoice-service-rg \
     --name invoice-pdf-service
   ```

---

## AWS

### Using Elastic Container Service (ECS)

1. **Build and Push Docker Image**
   ```bash
   # Create ECR repository
   aws ecr create-repository --repository-name invoice-pdf-service
   
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
   
   # Build image
   cd services/invoice_pdf_service
   docker build -t invoice-pdf-service .
   
   # Tag image
   docker tag invoice-pdf-service:latest \
     <account-id>.dkr.ecr.us-east-1.amazonaws.com/invoice-pdf-service:latest
   
   # Push
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/invoice-pdf-service:latest
   ```

2. **Create ECS Cluster**
   ```bash
   aws ecs create-cluster --cluster-name invoice-cluster
   ```

3. **Register Task Definition**
   
   Create `ecs-task-definition.json`:
   ```json
   {
     "family": "invoice-pdf-service",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "containerDefinitions": [
       {
         "name": "invoice-pdf-service",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/invoice-pdf-service:latest",
         "portMappings": [
           {
             "containerPort": 8000,
             "hostPort": 8000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "HOST",
             "value": "0.0.0.0"
           },
           {
             "name": "ENVIRONMENT",
             "value": "production"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/invoice-pdf-service",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

   Register:
   ```bash
   aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
   ```

4. **Create ECS Service**
   ```bash
   aws ecs create-service \
     --cluster invoice-cluster \
     --service-name invoice-pdf-service \
     --task-definition invoice-pdf-service \
     --desired-count 1 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
   ```

5. **Setup Load Balancer**
   - AWS ALB/NLB for high availability
   - Configure health checks
   - Point to ECS service

---

## DigitalOcean

### Using App Platform

1. **Connect Repository**
   - DigitalOcean Dashboard → App Platform → New App
   - Select GitHub repository
   - Configure:
     - Source: `services/invoice_pdf_service`
     - Python version: 3.11

2. **Environment Variables**
   ```
   HOST=0.0.0.0
   PORT=8080
   ENVIRONMENT=production
   LOG_LEVEL=info
   NEXT_APP_URL=https://your-nextjs-app.com
   ```

3. **Build Configuration**
   - Build command: `pip install -r requirements.txt`
   - Run command: `gunicorn --bind 0.0.0.0:8080 main:app`
   - HTTP port: 8080

4. **Deploy**
   - Review configuration
   - Click "Create Resources"
   - Wait for deployment

### Using Droplets (Self-Hosted)

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - Basic plan
   - Add SSH key

2. **SSH into Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install Dependencies**
   ```bash
   apt-get update
   apt-get install -y python3.11 python3-pip nginx supervisor
   ```

4. **Clone Repository**
   ```bash
   cd /opt
   git clone https://github.com/yourname/retail.git
   cd retail/services/invoice_pdf_service
   ```

5. **Setup Python**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

6. **Configure Supervisor**
   
   Create `/etc/supervisor/conf.d/invoice-service.conf`:
   ```ini
   [program:invoice-service]
   directory=/opt/retail/services/invoice_pdf_service
   command=/opt/retail/services/invoice_pdf_service/venv/bin/gunicorn --bind 0.0.0.0:8000 main:app
   user=www-data
   autostart=true
   autorestart=true
   environment=PATH="/opt/retail/services/invoice_pdf_service/venv/bin",HOST="0.0.0.0",PORT="8000"
   ```

7. **Configure Nginx**
   
   Create `/etc/nginx/sites-available/invoice-service`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

8. **Start Services**
   ```bash
   supervisorctl reread
   supervisorctl update
   supervisorctl start invoice-service
   
   systemctl restart nginx
   ```

---

## Monitoring & Logging

### Health Check
```bash
curl https://your-deployed-service.com/health
```

### View Logs
- **Heroku**: `heroku logs --tail`
- **Railway**: Dashboard logs
- **Azure**: Azure Portal > Logs
- **AWS**: CloudWatch logs
- **DigitalOcean**: Access via app dashboard

### Set Alerts
- Monitor response times
- Track error rates
- Setup uptime monitoring
- Configure auto-restart policies

---

## Performance Tips

### Production Settings

```env
ENVIRONMENT=production
LOG_LEVEL=warning
```

### Gunicorn Configuration
```bash
gunicorn --workers 4 --threads 2 --worker-class gthread main:app
```

### Database Connection Pooling
- Configure connection limits
- Use connection pooling

### Caching
- Enable HTTP caching headers
- Implement CDN for static assets

---

## Troubleshooting Deployment

### Port Issues
- Ensure environment PORT matches exposed port
- Check firewall rules

### Start Command
- Verify startup command format
- Check Python path in venv

### Dependencies
- Verify all packages in requirements.txt
- Test locally before deploying

### CORS Configuration
- Update NEXT_APP_URL for new domain
- Restart service after configuration

---

## Cost Estimation (Monthly)

| Platform | Tier | Estimated Cost |
|----------|------|-----------------|
| Railway | Hobby | Free - $5 |
| Heroku | Eco | $7 |
| Azure | B1 | $15 |
| AWS | t3.micro | $10-15 |
| DigitalOcean | Basic Droplet | $5 |

---

## Recommended for Production

**High Availability:**
- Load balancer
- Multiple instances
- Auto-scaling

**Monitoring:**
- Error tracking (Sentry)
- Performance monitoring (New Relic)
- Uptime monitoring (UptimeRobot)

**Security:**
- HTTPS/SSL certificate
- Rate limiting
- API authentication
- WAF rules

---

For detailed deployment help, see platform-specific documentation or reach out for support.
