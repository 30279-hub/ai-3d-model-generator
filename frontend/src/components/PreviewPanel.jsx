import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { Download, RefreshCcw, Rotate3D } from "lucide-react";
import { api } from "../api.js";

function PreviewModel({ url }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} />;
}

export function PreviewPanel({ job, formats, onRegenerate }) {
  const [format, setFormat] = useState("stl");
  const [changes, setChanges] = useState("");

  const ready = job?.status === "ready";
  const failed = job?.status === "failed";
  const previewUrl = ready ? api.previewUrl(job.id) : null;

  function download() {
    if (!job?.id) return;
    window.open(api.exportUrl(job.id, format), "_blank", "noopener,noreferrer");
  }

  function regenerate() {
    if (!changes.trim()) return;
    onRegenerate(changes.trim());
    setChanges("");
  }

  return (
    <section className="preview-panel">
      <div className="panel-heading">
        <Rotate3D size={18} />
        <span>Preview and exports</span>
      </div>

      <div className="preview-viewport">
        {!job ? (
          <div className="empty-state">
            <Rotate3D size={34} />
            <span>Preview appears after confirmation and mesh repair.</span>
          </div>
        ) : failed ? (
          <div className="empty-state error">
            <span>{job.error || "Generation failed"}</span>
          </div>
        ) : !ready ? (
          <div className="job-progress">
            <div className="spinner" />
            <strong>{job.stage}</strong>
            <span>{job.status}</span>
          </div>
        ) : (
          <Canvas camera={{ position: [140, -180, 120], fov: 42 }}>
            <Suspense fallback={null}>
              <Stage intensity={0.8} adjustCamera={false} environment="city">
                <Bounds fit clip observe margin={1.2}>
                  <Center>
                    <PreviewModel url={previewUrl} />
                  </Center>
                </Bounds>
              </Stage>
            </Suspense>
            <OrbitControls makeDefault />
          </Canvas>
        )}
      </div>

      <div className="export-row">
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          disabled={!ready}
          aria-label="Export format"
        >
          {Object.entries(formats).map(([key, definition]) => (
            <option key={key} value={key}>
              {definition.label}
            </option>
          ))}
        </select>
        <button className="icon-text-button" type="button" onClick={download} disabled={!ready}>
          <Download size={17} />
          Download
        </button>
      </div>

      <div className="regenerate-box">
        <label htmlFor="changes">Regenerate with changes</label>
        <textarea
          id="changes"
          value={changes}
          onChange={(event) => setChanges(event.target.value)}
          placeholder="Example: make it 20 mm taller and add a smoother finish"
          rows={3}
        />
        <button className="icon-text-button" type="button" onClick={regenerate} disabled={!changes.trim()}>
          <RefreshCcw size={17} />
          Update spec
        </button>
      </div>
    </section>
  );
}
