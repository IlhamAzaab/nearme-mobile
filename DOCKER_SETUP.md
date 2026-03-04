# NearMe Mobile - Docker Setup Guide

## Prerequisites (One-time Setup)

Your friend needs to install only **2 things**:

### 1. Install Docker Desktop
- **Windows/Mac**: Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: 
  ```bash
  sudo apt-get update
  sudo apt-get install docker.io docker-compose-plugin
  ```

### 2. Install Expo Go App on Phone
- **Android**: [Play Store - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)

---

## Quick Start (Every Time)

### Step 1: Clone the Repository
```bash
git clone https://github.com/IlhamAzaab/nearme-mobile.git
cd nearme-mobile
```

### Step 2: Start the App
```bash
docker compose up --build
```

Wait for the message: **"Metro bundler started"** and a QR code will appear.

### Step 3: Connect Your Phone
1. Open **Expo Go** app on your phone
2. Scan the QR code shown in terminal
3. App will load on your phone!

---

## Stop the App
```bash
# Press Ctrl+C in terminal, then:
docker compose down
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `docker compose up` | Start the app |
| `docker compose up --build` | Rebuild & start (after package.json changes) |
| `docker compose down` | Stop the app |
| `docker compose logs -f` | View logs |
| `docker compose exec nearme-mobile sh` | Enter container shell |
| `docker compose ps` | Check container health status |

---

## Environment Variables

If the project needs API keys or environment variables, create a `.env` file in the project root:
```bash
# .env (create this file)
API_URL=http://192.168.x.x:5000
NODE_ENV=development
```
Docker Compose will automatically load this file.

---

## Troubleshooting

### QR Code not working?
```bash
# Stop and restart with tunnel mode
docker compose down
docker compose up
```

### Package changes not reflecting?
```bash
# Rebuild the container
docker compose down
docker compose up --build
```

### Port already in use?
```bash
# Find and kill process on port 8081
# Windows:
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :8081
kill -9 <PID>
```

### Container won't start?
```bash
# Remove old containers and rebuild
docker compose down -v
docker system prune -f
docker compose up --build
```

### Check container health
```bash
docker compose ps
# You should see "healthy" in the STATUS column
```

---

## Project Structure

```
nearme-mobile/
├── src/                 # Source code (edit these files)
│   ├── screens/         # App screens
│   ├── components/      # Reusable components
│   ├── services/        # API services
│   └── ...
├── assets/              # Images, fonts, sounds
├── app.config.js        # Expo app configuration
├── babel.config.js      # Babel configuration
├── metro.config.js      # Metro bundler configuration
├── Dockerfile           # Docker container configuration
├── docker-compose.yml   # Docker Compose orchestration
└── package.json         # Dependencies
```

---

## Docker Stack Info

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22 LTS (Alpine) | Active LTS until April 2027 |
| npm | Included with Node 22 | Uses `npm ci` for deterministic installs |
| @expo/ngrok | ^4.1.0 | Pre-installed for tunnel mode |
| Expo SDK | 54 | React Native 0.81 |

---

## Team Workflow

1. **Pull latest changes**: `git pull origin main`
2. **Start app**: `docker compose up --build`
3. **Make changes** in `src/` folder
4. **Test** on phone via Expo Go
5. **Commit**: `git add . && git commit -m "your message"`
6. **Push**: `git push origin main`

---

## Need Help?

- Check [Expo Documentation](https://docs.expo.dev/)
- Check [Docker Documentation](https://docs.docker.com/)
- Ask in team chat!
