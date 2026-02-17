# Security Alert: Exposed Firebase API Key

## ⚠️ CRITICAL: Immediate Actions Required

### What Happened?
The `google-services.json` file containing Firebase/Google Cloud credentials was accidentally committed to the public GitHub repository. This file contains sensitive API keys that should NEVER be shared publicly.

### What is `google-services.json`?
This file is a Firebase configuration file for Android apps that contains:
- Firebase project credentials
- API keys for Google services
- Project IDs and other sensitive information

**Purpose:** It allows your React Native/Expo app to connect to Firebase services (authentication, database, push notifications, etc.)

**Why it was pushed to GitHub:** It was not included in `.gitignore` initially, so Git tracked and committed it like any other file.

## ✅ What Has Been Done

1. ✅ Removed `google-services.json` from Git tracking
2. ✅ Added `google-services.json` to `.gitignore`
3. ✅ Created `google-services.json.example` as a template
4. ✅ Committed these changes to the repository

## 🚨 What You MUST Do NOW

### 1. Regenerate Your Firebase API Key (CRITICAL - Do this IMMEDIATELY)
Since the old key was exposed publicly, you MUST regenerate it:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **nearme-mobile-f2763**
3. Navigate to: **APIs & Services > Credentials**
4. Find the exposed key: `AIzaSyBP4piM9xDbrGKsYTusyWtMPjAMzmIZDf4`
5. Click the key, then click **REGENERATE KEY**
6. Download the new `google-services.json` file
7. Replace your local `google-services.json` with the new one

### 2. Remove File from Git History (CRITICAL)
The file is removed from the latest commit, but it still exists in Git history. Anyone can access it from previous commits. You need to remove it completely:

**Option A: Using Git Filter-Repo (Recommended)**
```bash
# Install git-filter-repo (if not installed)
pip install git-filter-repo

# Remove the file from entire history
git filter-repo --path google-services.json --invert-paths --force
```

**Option B: Using BFG Repo-Cleaner (Easier)**
```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
# Then run:
bfg --delete-files google-services.json
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 3. Force Push to GitHub
After cleaning history, force push to overwrite the remote repository:
```bash
git push origin main --force
```

⚠️ **WARNING:** Force pushing will rewrite history. Notify any collaborators to re-clone the repository.

### 4. Add API Key Restrictions (Security Best Practice)
Even with a new key, restrict what it can do:

1. In Google Cloud Console > Credentials
2. Edit your new API key
3. Under "Application restrictions":
   - Add your app's package name: `com.nearme.mobile`
   - Add your app's SHA-1 fingerprint
4. Under "API restrictions":
   - Restrict to only the APIs your app needs (Firebase, Maps, etc.)

### 5. Monitor Your Google Cloud Billing
Check for any suspicious activity:
1. Go to Google Cloud Console > Billing
2. Review recent API usage
3. Set up billing alerts if not already configured

## 🔒 Prevention for Future

### Files That Should NEVER Be Committed:
- ✅ `google-services.json` (Android Firebase config)
- ✅ `GoogleService-Info.plist` (iOS Firebase config)
- ✅ `.env` files with secrets
- ✅ Any files with API keys, passwords, or tokens
- ✅ Service account JSON files

### Setup Instructions for New Developers:
1. Copy `google-services.json.example` to `google-services.json`
2. Get the real credentials from:
   - Firebase Console: Project Settings > General > Your apps
   - Or ask the project admin for the file
3. Never commit this file to Git (it's now in `.gitignore`)

## 📚 Related Documentation
- [Handling Compromised GCP Credentials](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- [Firebase Security Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [Git Filter-Repo Documentation](https://github.com/newren/git-filter-repo)

---

**TIMELINE:**
- Exposed Key: `AIzaSyBP4piM9xDbrGKsYTusyWtMPjAMzmIZDf4`
- Detection Date: February 18, 2026
- Removed from tracking: February 18, 2026
- **PENDING:** Key regeneration and history cleanup (DO THIS NOW!)
