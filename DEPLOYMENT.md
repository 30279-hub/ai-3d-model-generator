# Deployment Guide

This project is now prepared as a single Dockerized web app. The deployed service serves:

- React frontend
- Express backend API
- Blender model generation and mesh repair
- Assimp mesh conversion

## Before You Push

Do not commit `.env`. It is already ignored.

Use a fresh Gemini key because any key pasted into chat should be rotated:

```env
GEMINI_API_KEY=your_new_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
```

## Push To GitHub

Create an empty GitHub repository in your account, then run:

```bash
git init
git add .
git commit -m "Initial AI 3D model generator platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

## Deploy On Render With Docker

1. Open Render.
2. Create a new Web Service.
3. Connect your GitHub repository.
4. Choose Docker as the environment.
5. Render will use `Dockerfile`.
6. Add environment variables:

```env
GEMINI_API_KEY=your_new_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=production
SERVE_FRONTEND=true
BLENDER_BIN=blender
ASSIMP_BIN=assimp
STORAGE_ROOT=/app/backend/storage
```

7. Set health check path to:

```text
/health
```

8. Deploy.

Your final website URL will be the Render service URL, for example:

```text
https://your-service-name.onrender.com
```

## Run The Production Build Locally

```bash
docker compose up --build
```

Open:

```text
http://localhost:4000
```

## Notes

STL preview/export works with Blender. PLY export works with Blender. 3MF and AMF use Assimp. STEP, IGES, and DXF still need FreeCAD installed/configured if you want those formats in production. Proprietary formats like DWG, Parasolid, and SolidWorks require vendor converters.
