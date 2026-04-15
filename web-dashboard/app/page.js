"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const DEFAULT_GESTURE = "No hand";
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const LANDMARK_NAMES = [
  "Wrist",
  "Thumb CMC",
  "Thumb MCP",
  "Thumb IP",
  "Thumb Tip",
  "Index MCP",
  "Index PIP",
  "Index DIP",
  "Index Tip",
  "Middle MCP",
  "Middle PIP",
  "Middle DIP",
  "Middle Tip",
  "Ring MCP",
  "Ring PIP",
  "Ring DIP",
  "Ring Tip",
  "Pinky MCP",
  "Pinky PIP",
  "Pinky DIP",
  "Pinky Tip",
];

const TIP_INDICES = [4, 8, 12, 16, 20];

function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return DEFAULT_GESTURE;
  }

  const wrist = landmarks[0];
  const index = landmarks[8];
  const middle = landmarks[12];
  const ring = landmarks[16];
  const little = landmarks[20];

  const fingersUp = [index, middle, ring, little].map((tip, i) => {
    const pipIndex = [6, 10, 14, 18][i];
    return tip.y < landmarks[pipIndex].y;
  });

  const count = fingersUp.filter(Boolean).length;
  if (count >= 4) return "Open Palm";
  if (count === 0) return "Fist";
  if (fingersUp[0] && fingersUp[1] && !fingersUp[2] && !fingersUp[3]) return "Two Finger";
  if (fingersUp[0] && !fingersUp[1] && !fingersUp[2] && !fingersUp[3]) {
    if (index.x < wrist.x - 0.05) return "Point Left";
    if (index.x > wrist.x + 0.05) return "Point Right";
    return "Point";
  }
  return "None";
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distance3D(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function formatDistance(value, isWorld = false) {
  if (!Number.isFinite(value)) return "n/a";
  return isWorld ? `${value.toFixed(3)}m` : `${value.toFixed(1)}px`;
}

function drawLabel(ctx, text, x, y, bg = "rgba(18, 34, 28, 0.78)", fg = "#f3fff7") {
  ctx.save();
  ctx.font = "11px Segoe UI";
  const paddingX = 6;
  const paddingY = 4;
  const metrics = ctx.measureText(text);
  const w = metrics.width + paddingX * 2;
  const h = 18;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y - h, w, h, 6);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + paddingX, y - 5);
  ctx.restore();
}

function drawHandOverlay(ctx, handLandmarks, worldLandmarks, width, height, handIndex, handednessLabel, handednessScore) {
  if (!handLandmarks?.length) return;

  const palette = ["#2be5a7", "#f6c15b", "#7ad7ff", "#ff8a7a"];
  const color = palette[handIndex % palette.length];

  const points = handLandmarks.map((lm) => ({
    x: lm.x * width,
    y: lm.y * height,
    z: lm.z,
  }));

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const start = points[startIdx];
    const end = points[endIdx];
    if (!start || !end) continue;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  for (let i = 0; i < points.length; i += 1) {
    const pt = points[i];
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 25, 21, 0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if ([0, 4, 8, 12, 16, 20].includes(i)) {
      const label = `${i}: ${LANDMARK_NAMES[i]}`;
      drawLabel(ctx, label, pt.x + 8, pt.y - 8, "rgba(8, 24, 19, 0.86)");
    }
  }

  const wrist = points[0];
  const worldWrist = worldLandmarks?.[0] ?? null;
  const worldDistances = TIP_INDICES.map((tipIdx) => {
    const tipWorld = worldLandmarks?.[tipIdx];
    const tipPoint = points[tipIdx];
    return {
      name: LANDMARK_NAMES[tipIdx],
      px: distance2D(wrist, tipPoint),
      world: worldWrist && tipWorld ? distance3D(worldWrist, tipWorld) : null,
    };
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(minX - 14, minY - 34, maxX - minX + 28, maxY - minY + 48);

  const titleLines = [
    `${handednessLabel || "Unknown"} hand`,
    `Score ${(handednessScore * 100 || 0).toFixed(0)}%`,
    `Tip distances: ${worldDistances
      .map((item) => `${item.name.split(" ")[0]} ${formatDistance(item.world ?? item.px, Boolean(item.world))}`)
      .join(" | ")}`,
  ];

  const boxWidth = Math.min(width - 20, 430);
  const boxHeight = 66;
  const boxX = Math.max(10, minX - 10);
  const boxY = Math.max(42, minY - 44);
  ctx.fillStyle = "rgba(8, 24, 19, 0.78)";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY - boxHeight + 10, boxWidth, boxHeight, 12);
  ctx.fill();

  ctx.fillStyle = "#effef4";
  ctx.font = "12px Segoe UI";
  ctx.fillText(titleLines[0], boxX + 12, boxY - 28);
  ctx.fillText(titleLines[1], boxX + 12, boxY - 12);
  ctx.fillText(titleLines[2], boxX + 12, boxY + 4);

  ctx.restore();
}

function drawLandmarks(ctx, result, width, height) {
  ctx.clearRect(0, 0, width, height);
  if (!result?.landmarks?.length) return;

  const hands = result.landmarks;
  const worldHands = result.worldLandmarks ?? [];
  const handednessList = result.handedness ?? [];

  hands.forEach((handLandmarks, index) => {
    const handednessItem = handednessList[index]?.[0];
    const handednessLabel = handednessItem?.categoryName || handednessItem?.displayName || `Hand ${index + 1}`;
    const handednessScore = handednessItem?.score ?? 0;
    drawHandOverlay(
      ctx,
      handLandmarks,
      worldHands[index] ?? null,
      width,
      height,
      index,
      handednessLabel,
      handednessScore,
    );
  });
}

export default function Page() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(true);
  const [controlsAllowed, setControlsAllowed] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [gesture, setGesture] = useState(DEFAULT_GESTURE);
  const [handsCount, setHandsCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [lastAction, setLastAction] = useState("Waiting");
  const [error, setError] = useState("");

  const score = useMemo(() => {
    let s = 40;
    if (running) s += 30;
    if (gesture !== DEFAULT_GESTURE) s += 20;
    if (fps > 15) s += 10;
    return Math.min(100, s);
  }, [running, gesture, fps]);

  useEffect(() => {
    return () => {
      stopApp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initLandmarker() {
    if (handLandmarkerRef.current) return handLandmarkerRef.current;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.65,
      minTrackingConfidence: 0.5,
    });

    return handLandmarkerRef.current;
  }

  function stopApp() {
    setRunning(false);
    setStatus("Stopped");
    setLastAction("Stopped by user");

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = overlayRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function runLoop() {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    const detector = handLandmarkerRef.current;

    if (!video || !canvas || !detector || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(runLoop);
      return;
    }

    const now = performance.now();
    const delta = now - (lastFrameTimeRef.current || now);
    lastFrameTimeRef.current = now;

    if (delta > 0) {
      const instant = 1000 / delta;
      setFps((prev) => (prev === 0 ? instant : prev * 0.85 + instant * 0.15));
    }

    const result = detector.detectForVideo(video, now);
    const landmarks = result?.landmarks?.[0] ?? null;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      drawLandmarks(ctx, result, canvas.width, canvas.height);
    }

    const nextGesture = classifyGesture(landmarks);
    setGesture(nextGesture);
    setHandsCount(result?.landmarks?.length ?? 0);

    if (nextGesture === "Open Palm") setLastAction("Play/Pause (simulated)");
    else if (nextGesture === "Fist") setLastAction("Click (simulated)");
    else if (nextGesture === "Point Left") setLastAction("Back (simulated)");
    else if (nextGesture === "Point Right") setLastAction("Forward (simulated)");
    else setLastAction("No action");

    animationRef.current = requestAnimationFrame(runLoop);
  }

  async function startAppWithPermissions() {
    setError("");

    if (!cameraAllowed) {
      setError("Camera permission is required to run the app.");
      return;
    }

    try {
      setStatus("Starting...");
      const detector = await initLandmarker();
      if (!detector) throw new Error("Failed to initialize hand detector.");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 540, facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not ready.");

      video.srcObject = stream;
      await video.play();

      const canvas = overlayRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 960;
        canvas.height = video.videoHeight || 540;
      }

      setRunning(true);
      setStatus("Running");
      setLastAction(controlsAllowed ? "Controls enabled" : "Controls disabled");
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(runLoop);
    } catch (e) {
      setStatus("Error");
      setError(e instanceof Error ? e.message : "Could not start camera.");
      stopApp();
    }
  }

  return (
    <main className="page">
      <aside className="sidebar">
        <h1>DriveFlow Web</h1>
        <p>Vercel-ready AI driving dashboard</p>
        <div className="chip">{running ? "APP RUNNING" : "APP STOPPED"}</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h2>Operations Dashboard</h2>
            <p>Click Run App, grant permission, and start webcam gesture control.</p>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => setPermissionOpen(true)}>
              Run App
            </button>
            <button className="btn" onClick={stopApp}>
              Stop App
            </button>
          </div>
        </header>

        <div className="grid stats">
          <article className="card"><span>Status</span><strong>{status}</strong></article>
          <article className="card"><span>Gesture</span><strong>{gesture}</strong></article>
          <article className="card"><span>Hands</span><strong>{handsCount}</strong></article>
          <article className="card"><span>FPS</span><strong>{fps.toFixed(1)}</strong></article>
          <article className="card"><span>Last Action</span><strong>{lastAction}</strong></article>
          <article className="card"><span>Runtime Score</span><strong>{score}%</strong></article>
        </div>

        <div className="grid main-grid">
          <article className="card video-card">
            <div className="video-wrap">
              <video ref={videoRef} playsInline muted />
              <canvas ref={overlayRef} />
            </div>
          </article>

          <article className="card control-card">
            <h3>Permissions</h3>
            <label>
              <input
                type="checkbox"
                checked={cameraAllowed}
                onChange={(e) => setCameraAllowed(e.target.checked)}
              />
              Allow camera access (required)
            </label>
            <label>
              <input
                type="checkbox"
                checked={controlsAllowed}
                onChange={(e) => setControlsAllowed(e.target.checked)}
              />
              Allow controls (simulated in browser)
            </label>
            <p className="muted">Browser will ask actual camera permission on first run.</p>
            {error ? <p className="error">{error}</p> : null}
          </article>
        </div>
      </section>

      {permissionOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Permission Request</h3>
            <p>Before starting, confirm camera permission and optional controls.</p>
            <label>
              <input
                type="checkbox"
                checked={cameraAllowed}
                onChange={(e) => setCameraAllowed(e.target.checked)}
              />
              Allow camera access (required)
            </label>
            <label>
              <input
                type="checkbox"
                checked={controlsAllowed}
                onChange={(e) => setControlsAllowed(e.target.checked)}
              />
              Allow controls (optional)
            </label>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPermissionOpen(false)}>Cancel</button>
              <button
                className="btn primary"
                onClick={async () => {
                  setPermissionOpen(false);
                  await startAppWithPermissions();
                }}
              >
                Allow and Run
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
