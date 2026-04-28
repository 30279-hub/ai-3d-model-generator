# AI-Powered 3D Model Generator Platform

This project is a complete modular prototype for a conversational AI platform that gathers requirements first, confirms the final specification, generates a Blender model, repairs the mesh, previews it in the browser, and exports it through a pluggable conversion pipeline.

For GitHub and cloud deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md). The included Dockerfile builds the React frontend and serves it from the Express backend as one production web app.

## 1. Architecture Diagram

```text
User
  |
  v
React Frontend
  - Chat UI
  - Saved sessions
  - Preview before download
  - Regenerate with changes
  |
  v
Node.js Express Backend
  - Serves frontend/dist in production
  |
  +--> Session API
  |      - JSON session storage
  |      - Chat history
  |      - Requirement state
  |
  +--> AI Conversation Layer
  |      - Gemini extraction when GEMINI_API_KEY is set
  |      - Heuristic fallback when offline
  |      - Step-by-step requirement gathering
  |      - Explicit generation confirmation gate
  |
  +--> Generation Service
  |      - Job manifest
  |      - Blender Python model generation
  |      - Blender mesh repair and GLB preview
  |
  +--> Export Service
         - STL direct
         - PLY through Blender
         - 3MF/AMF through Assimp
         - STEP/IGES/DXF through FreeCAD
         - DWG/Parasolid/SolidWorks through configured vendor adapters

Storage
  - backend/storage/sessions/*.json
  - backend/storage/jobs/<job-id>/*
```

## 2. Folder Structure

```text
.
├── backend
│   ├── package.json
│   ├── scripts/check-syntax.mjs
│   ├── src
│   │   ├── ai
│   │   │   ├── conversationManager.js
│   │   │   ├── prompts.js
│   │   │   └── requirementExtractor.js
│   │   ├── routes
│   │   │   ├── chat.routes.js
│   │   │   ├── jobs.routes.js
│   │   │   └── sessions.routes.js
│   │   ├── services
│   │   │   ├── exportService.js
│   │   │   ├── jobStore.js
│   │   │   ├── modelGenerationService.js
│   │   │   └── sessionStore.js
│   │   ├── utils
│   │   │   ├── httpError.js
│   │   │   ├── ids.js
│   │   │   └── runCommand.js
│   │   ├── app.js
│   │   ├── config.js
│   │   └── server.js
│   └── storage
│       ├── jobs
│       └── sessions
├── frontend
│   ├── package.json
│   ├── index.html
│   └── src
│       ├── components
│       │   ├── ChatPanel.jsx
│       │   ├── PreviewPanel.jsx
│       │   └── SessionSidebar.jsx
│       ├── api.js
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
├── scripts
│   ├── blender
│   │   ├── export_model.py
│   │   ├── generate_model.py
│   │   └── repair_mesh.py
│   └── freecad
│       └── convert_mesh.py
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 3. Backend API

The Express API is implemented in `backend/src`.

### Sessions

```http
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:sessionId
DELETE /api/sessions/:sessionId
```

Sessions persist chat history, requirement state, confirmation state, and the most recent generation job.

### Chat

```http
POST /api/chat
Content-Type: application/json

{
  "sessionId": "ses_...",
  "message": "120 x 80 x 20 mm PLA mechanical bracket, high detail"
}
```

The chat endpoint handles all requirement gathering. It does not generate immediately. When the user says `Generate the model`, the backend summarizes the requirements and asks for `Confirm and generate`. Only that explicit confirmation starts a job.

### Jobs and Exports

```http
GET /api/jobs/formats
GET /api/jobs/:jobId
GET /api/jobs/:jobId/preview
GET /api/jobs/:jobId/exports/:format
```

Supported export keys:

```text
stl, 3mf, ply, amf, step, igs, x_t, sldprt, dwg, dxf
```

Real-world note: mesh formats are directly available through Blender/Assimp. STEP, IGES, and DXF require FreeCAD. Parasolid, SolidWorks, and DWG require licensed vendor converters, configured via command templates in `.env`.

## 4. Frontend Chat Interface

The React frontend is implemented in `frontend/src`.

It includes:

- A chatbot requirement flow.
- Session sidebar with persisted sessions.
- 3D preview using `@react-three/fiber`, `three`, and `@react-three/drei`.
- Export format selector and download button.
- Regenerate-with-changes box that sends the change request back through the controlled chat flow.

## 5. AI Conversation Logic

The conversation state machine lives in `backend/src/ai/conversationManager.js`.

It collects these fields in order:

1. Dimensions
2. Shape type
3. Use case
4. Material
5. Level of detail
6. Constraints

Google Gemini extraction is implemented in `backend/src/ai/requirementExtractor.js`. If `GEMINI_API_KEY` is missing or the call fails, the server uses a deterministic heuristic extractor so the system still runs locally.

Generation gate:

```text
User: Generate the model
Assistant: summarizes all requirements and asks for "Confirm and generate"
User: Confirm and generate
Backend: starts Blender generation job
```

## 6. 3D Model Generation Script

`scripts/blender/generate_model.py` reads `requirements.json` and creates parametric Blender geometry:

- Box/cube
- Cylinder/flange
- Sphere
- Cone
- Torus
- Gear
- Plate/bracket with mounting holes
- Simple architectural mass

It exports:

- `raw.stl`
- `model.blend`
- `preview_raw.glb`
- `generation_metadata.json`

The generation engine is modular: replace `runBlenderScript("generate_model.py", ...)` in `backend/src/services/modelGenerationService.js` with an OpenSCAD or CAD-kernel adapter without changing chat/session/export APIs.

## 7. Mesh Repair Pipeline

`scripts/blender/repair_mesh.py` performs:

- Mesh-object joining
- Duplicate vertex merge
- Hole filling where possible
- Normal recalculation
- Triangulation
- Weighted-normal smoothing
- Decimation for very high polygon counts
- Optional Blender printability checks when `mesh_print3d_toolbox` is available

It exports:

- `model.stl`
- `preview.glb`
- `repair_metadata.json`

## 8. Export and Conversion Logic

`backend/src/services/exportService.js` maps formats to adapters:

```text
STL     copy repaired STL
PLY     Blender export_model.py
3MF     Assimp
AMF     Assimp
STEP    FreeCAD mesh-to-solid conversion
IGES    FreeCAD mesh-to-solid conversion
DXF     FreeCAD export
DWG     external vendor command template
X_T     external Parasolid command template
SLDPRT  external SolidWorks command template
```

External converter templates can use:

```text
{input} {output} {format} {jobDir}
```

Example:

```env
PARASOLID_CONVERTER_CMD="C:\Tools\ParasolidExporter.exe" --input {input} --output {output}
```

## 9. Step-by-Step Execution Flow

1. User opens the React app.
2. Frontend creates or loads a saved session.
3. User describes the model in chat.
4. Backend extracts structured requirements with Gemini or heuristic fallback.
5. Backend asks the next missing clarification question.
6. User says `Generate the model`.
7. Backend checks for missing fields.
8. Backend summarizes the full specification.
9. User replies `Confirm and generate`.
10. Backend creates a job manifest under `backend/storage/jobs/<job-id>`.
11. Blender generates `raw.stl`, `model.blend`, and `preview_raw.glb`.
12. Blender repairs/optimizes the mesh and writes `model.stl` plus `preview.glb`.
13. Frontend polls the job endpoint until ready.
14. Frontend renders `preview.glb` in the browser.
15. User downloads STL or requests another export format.
16. Export service converts through Blender, Assimp, FreeCAD, or configured vendor adapters.
17. User can type changes in the regenerate box; the new request goes back through summary and confirmation.

## 10. Local Run Instructions

### Prerequisites

- Node.js 20+
- Blender 4.x available as `blender` on PATH, or set `BLENDER_BIN`
- Optional: Assimp for `3mf` and `amf`
- Optional: FreeCAD for `step`, `igs`, and `dxf`
- Optional: licensed vendor converters for `x_t`, `sldprt`, and `dwg`

### Setup

```bash
cp .env.example .env
npm install
```

Set `GEMINI_API_KEY` in `.env` if you want LLM extraction. The app still works without it through heuristic extraction.

```env
GEMINI_API_KEY=your_fresh_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
```

### Run

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:4000/health
```

### Example Chat

```text
I need a mechanical bracket, 120 x 80 x 20 mm, PLA, high detail, 3D printable and watertight.
Generate the model
Confirm and generate
```

After the job reaches `ready`, the preview appears and export downloads become available.
