# 🚀 NearMe Mobile - Docker Setup Guide

## 📋 Prerequisites (One-time Setup)

Your friend needs to install only **2 things**:

### 1. Install Docker Desktop
- **Windows/Mac**: Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: 
  ```bash
  sudo apt-get update
  sudo apt-get install docker.io docker-compose
  ```

### 2. Install Expo Go App on Phone
- **Android**: [Play Store - Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store - Expo Go](https://apps.apple.com/app/expo-go/id982107779)

---

## 🏃 Quick Start (Every Time)

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/nearme-mobile.git
cd nearme-mobile
```

### Step 2: Start the App
```bash
docker-compose up
```

Wait for the message: **"Metro bundler started"** and a QR code will appear.

### Step 3: Connect Your Phone
1. Open **Expo Go** app on your phone
2. Scan the QR code shown in terminal
3. App will load on your phone! 📱

---

## 🛑 Stop the App
```bash
# Press Ctrl+C in terminal, then:
docker-compose down
```

---

## 🔄 Common Commands

| Command | Description |
|---------|-------------|
| `docker-compose up` | Start the app |
| `docker-compose up --build` | Rebuild & start (after package.json changes) |
| `docker-compose down` | Stop the app |
| `docker-compose logs -f` | View logs |
| `docker-compose exec nearme-mobile sh` | Enter container shell |

---

## 🐛 Troubleshooting

### QR Code not working?
```bash
# Stop and restart with tunnel mode
docker-compose down
docker-compose up
```

### Package changes not reflecting?
```bash
# Rebuild the container
docker-compose down
docker-compose up --build
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
docker-compose down -v
docker system prune -f
docker-compose up --build
```

---

## 📁 Project Structure

```
nearme-mobile/
├── src/                 # Source code (edit these files)
│   ├── screens/         # App screens
│   ├── components/      # Reusable components
│   ├── services/        # API services
│   └── ...
├── assets/              # Images, fonts
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose configuration
└── package.json         # Dependencies
```

---

## 👥 Team Workflow

1. **Pull latest changes**: `git pull origin main`
2. **Start app**: `docker-compose up`
3. **Make changes** in `src/` folder
4. **Test** on phone via Expo Go
5. **Commit**: `git add . && git commit -m "your message"`
6. **Push**: `git push origin main`

---

## 🆘 Need Help?

- Check [Expo Documentation](https://docs.expo.dev/)
- Check [Docker Documentation](https://docs.docker.com/)
- Ask in team chat!
