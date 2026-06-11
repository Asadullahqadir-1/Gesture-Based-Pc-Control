"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const DEFAULT_GESTURE = "No hand";
const MODULE_BUILD = "modules v2-web";
const SMOOTH_PROFILE = "fast";
const ACTIVE_MODULES = [
  "Feature Engineering",
  "Gesture Classification",
  "Gesture Smoothing & Optimization",
];
const MODULE_DETAILS = {
  "Feature Engineering": "Normalizes hand landmarks and builds a compact feature vector for robust gesture recognition.",
  "Gesture Classification": "Runs rule-based + feature-assisted gesture labeling with confidence scoring.",
  "Gesture Smoothing & Optimization": "Applies temporal consensus and anti-jitter logic before triggering actions.",
};
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

function detectPinchZoom(landmarks, previousPinchDistance = null) {
  if (!landmarks || landmarks.length < 9) return { gesture: null, distance: null };
  
  const thumb = landmarks[4];
  const index = landmarks[8];
  const distance = distanceXY(thumb, index);
  
  if (previousPinchDistance === null) {
    return { gesture: null, distance };
  }
  
  if (distance < previousPinchDistance - 0.03) {
    return { gesture: "Zoom In", distance };
  }
  if (distance > previousPinchDistance + 0.03) {
    return { gesture: "Zoom Out", distance };
  }
  
  return { gesture: null, distance };
}

function detectSwipe(landmarks, previousLandmarks = null) {
  if (!landmarks || landmarks.length < 9 || !previousLandmarks) {
    return null;
  }
  
  const wrist = landmarks[0];
  const prevWrist = previousLandmarks[0];
  const xDelta = wrist.x - prevWrist.x;
  
  if (Math.abs(xDelta) > 0.04) {
    return xDelta < 0 ? "Swipe Left" : "Swipe Right";
  }
  
  return null;
}

function classifyGesture(landmarks, previousPinchDistance = null, previousLandmarks = null) {
  if (!landmarks || landmarks.length !== 21) {
    return { gesture: DEFAULT_GESTURE, pinchDistance: null };
  }

  const wrist = landmarks[0];
  const index = landmarks[8];
  const middle = landmarks[12];
  const ring = landmarks[16];
  const little = landmarks[20];
  const thumb = landmarks[4];

  const pinch = detectPinchZoom(landmarks, previousPinchDistance);
  if (pinch.gesture) {
    return { gesture: pinch.gesture, pinchDistance: pinch.distance };
  }
  
  const swipe = detectSwipe(landmarks, previousLandmarks);
  if (swipe) {
    return { gesture: swipe, pinchDistance: pinch.distance };
  }

  const fingersUp = [index, middle, ring, little].map((tip, i) => {
    const pipIndex = [6, 10, 14, 18][i];
    return tip.y < landmarks[pipIndex].y;
  });

  const count = fingersUp.filter(Boolean).length;
  if (count >= 4) return { gesture: "Open Palm", pinchDistance: pinch.distance };
  if (count === 0) return { gesture: "Fist", pinchDistance: pinch.distance };
  if (fingersUp[0] && fingersUp[1] && !fingersUp[2] && !fingersUp[3]) return { gesture: "Two Finger", pinchDistance: pinch.distance };
  if (fingersUp[0] && !fingersUp[1] && !fingersUp[2] && !fingersUp[3]) {
    if (index.x < wrist.x - 0.05) return { gesture: "Point Left", pinchDistance: pinch.distance };
    if (index.x > wrist.x + 0.05) return { gesture: "Point Right", pinchDistance: pinch.distance };
    return { gesture: "Point", pinchDistance: pinch.distance };
  }
  return { gesture: "None", pinchDistance: pinch.distance };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceXY(a, b) {
  const dx = (a.x ?? 0) - (b.x ?? 0);
  const dy = (a.y ?? 0) - (b.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function extractFeatureVector(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return null;
  }

  const wrist = landmarks[0];
  const palmWidth = Math.max(distanceXY(landmarks[5], landmarks[17]), 1e-6);

  const centered = landmarks.map((point) => ({
    x: (point.x - wrist.x) / palmWidth,
    y: (point.y - wrist.y) / palmWidth,
    z: (point.z - wrist.z) / palmWidth,
  }));

  const xyVector = [];
  for (const point of centered) {
    xyVector.push(point.x, point.y);
  }

  const distances = [
    distanceXY(landmarks[0], landmarks[4]) / palmWidth,
    distanceXY(landmarks[0], landmarks[8]) / palmWidth,
    distanceXY(landmarks[0], landmarks[12]) / palmWidth,
    distanceXY(landmarks[0], landmarks[16]) / palmWidth,
    distanceXY(landmarks[0], landmarks[20]) / palmWidth,
    distanceXY(landmarks[4], landmarks[8]) / palmWidth,
    distanceXY(landmarks[8], landmarks[12]) / palmWidth,
    distanceXY(landmarks[12], landmarks[16]) / palmWidth,
    distanceXY(landmarks[16], landmarks[20]) / palmWidth,
  ];

  return {
    vector: [...xyVector, ...distances],
    palmWidth,
    featureDim: xyVector.length + distances.length,
    fingertipSpread: distances.slice(0, 5).reduce((sum, value) => sum + value, 0) / 5,
  };
}

function classifyWithFeatureEngineering(landmarks, handednessLabel = "", previousPinchDistance = null, previousLandmarks = null) {
  if (!landmarks || landmarks.length !== 21) {
    return {
      gesture: DEFAULT_GESTURE,
      confidence: 0,
      source: "feature-engineering",
      featureDim: 0,
      pinchDistance: null,
    };
  }

  const features = extractFeatureVector(landmarks);
  if (!features) {
    return {
      gesture: DEFAULT_GESTURE,
      confidence: 0,
      source: "feature-engineering",
      featureDim: 0,
      pinchDistance: null,
    };
  }

  const gestureResult = classifyGesture(landmarks, previousPinchDistance, previousLandmarks);
  const baseGesture = gestureResult.gesture;
  
  if (baseGesture === "Zoom In" || baseGesture === "Zoom Out" || baseGesture === "Swipe Left" || baseGesture === "Swipe Right") {
    return {
      gesture: baseGesture,
      confidence: 0.9,
      source: "feature-engineering",
      featureDim: features.featureDim,
      pinchDistance: gestureResult.pinchDistance,
    };
  }
  
  const fingersUp = [8, 12, 16, 20].map((tipId, index) => {
    const pipId = [6, 10, 14, 18][index];
    return landmarks[tipId].y < landmarks[pipId].y;
  });

  const countUp = fingersUp.filter(Boolean).length;
  const handedness = handednessLabel.toLowerCase();
  const thumbTipX = landmarks[4].x;
  const thumbIpX = landmarks[3].x;
  const thumbUp = handedness.includes("right") ? thumbTipX > thumbIpX : thumbTipX < thumbIpX;

  let confidence = 0.45;
  if (baseGesture === "Open Palm") {
    confidence = clamp(0.62 + (features.fingertipSpread - 1.0) * 0.2, 0.55, 0.96);
  } else if (baseGesture === "Fist") {
    confidence = clamp(0.90 - features.fingertipSpread * 0.18, 0.55, 0.95);
  } else if (baseGesture === "Two Finger") {
    confidence = clamp(0.68 + countUp * 0.04, 0.55, 0.92);
  } else if (baseGesture === "Point" || baseGesture === "Point Left" || baseGesture === "Point Right") {
    confidence = clamp(0.66 + (landmarks[6].y - landmarks[8].y) * 0.35, 0.55, 0.92);
  } else if (thumbUp) {
    confidence = 0.62;
  } else if (baseGesture === "None") {
    confidence = clamp(0.30 + countUp * 0.06, 0.2, 0.52);
  }

  return {
    gesture: baseGesture,
    confidence,
    source: "feature-engineering",
    featureDim: features.featureDim,
    pinchDistance: gestureResult.pinchDistance,
  };
}

function createSmoothingState() {
  return {
    history: [],
    stableGesture: DEFAULT_GESTURE,
    pendingGesture: DEFAULT_GESTURE,
    pendingCount: 0,
    cooldown: 0,
  };
}

function getSmoothingPreset(profile) {
  if (profile === "balanced") {
    return { windowSize: 7, minConfidence: 0.55, minConsensus: 0.6, holdFrames: 2, cooldown: 1 };
  }
  if (profile === "stable") {
    return { windowSize: 9, minConfidence: 0.62, minConsensus: 0.68, holdFrames: 3, cooldown: 2 };
  }
  return { windowSize: 5, minConfidence: 0.5, minConsensus: 0.55, holdFrames: 1, cooldown: 0 };
}

function getGestureThresholds(gesture, basePreset) {
  const overrides = {
    "Point": { minConfidence: 0.58, minConsensus: 0.62, holdFrames: 2 },
    "Point Left": { minConfidence: 0.62, minConsensus: 0.66, holdFrames: 2 },
    "Point Right": { minConfidence: 0.62, minConsensus: 0.66, holdFrames: 2 },
    "Two Finger": { minConfidence: 0.65, minConsensus: 0.68, holdFrames: 2 },
    "Open Palm": { minConfidence: 0.5, minConsensus: 0.56, holdFrames: 1 },
    "Fist": { minConfidence: 0.52, minConsensus: 0.58, holdFrames: 1 },
  };

  const custom = overrides[gesture] || {};
  return {
    minConfidence: custom.minConfidence ?? basePreset.minConfidence,
    minConsensus: custom.minConsensus ?? basePreset.minConsensus,
    holdFrames: custom.holdFrames ?? basePreset.holdFrames,
  };
}

function smoothGesture(state, rawGesture, rawConfidence, profile = "fast") {
  const preset = getSmoothingPreset(profile);
  const thresholds = getGestureThresholds(rawGesture, preset);
  const filteredGesture = rawConfidence >= thresholds.minConfidence ? rawGesture : DEFAULT_GESTURE;
  const filteredConfidence = rawConfidence >= thresholds.minConfidence ? rawConfidence : 0;

  state.history.push({ gesture: filteredGesture, confidence: filteredConfidence });
  if (state.history.length > preset.windowSize) {
    state.history.shift();
  }

  const weightedVotes = new Map();
  let total = 0;
  const size = state.history.length;

  state.history.forEach((item, index) => {
    const recencyWeight = 1 + (index / Math.max(1, size - 1)) * 0.5;
    const vote = Math.max(item.confidence, 0.01) * recencyWeight;
    weightedVotes.set(item.gesture, (weightedVotes.get(item.gesture) || 0) + vote);
    total += vote;
  });

  let candidate = state.stableGesture;
  let consensus = 0;
  if (total > 0 && weightedVotes.size > 0) {
    const sorted = [...weightedVotes.entries()].sort((a, b) => b[1] - a[1]);
    candidate = sorted[0][0];
    consensus = sorted[0][1] / total;
  }

  const candidateThresholds = getGestureThresholds(candidate, preset);
  const requiredConsensus = Math.max(thresholds.minConsensus, candidateThresholds.minConsensus);
  const requiredHold = Math.max(thresholds.holdFrames, candidateThresholds.holdFrames);

  if (consensus < requiredConsensus) {
    candidate = state.stableGesture;
  }

  let changed = false;
  if (candidate === state.stableGesture) {
    state.pendingGesture = candidate;
    state.pendingCount = 0;
    if (state.cooldown > 0) state.cooldown -= 1;
  } else if (state.cooldown > 0) {
    state.cooldown -= 1;
  } else if (candidate !== state.pendingGesture) {
    state.pendingGesture = candidate;
    state.pendingCount = 1;
  } else {
    state.pendingCount += 1;
    if (state.pendingCount >= requiredHold) {
      state.stableGesture = candidate;
      state.pendingCount = 0;
      state.cooldown = preset.cooldown;
      changed = true;
    }
  }

  const uniqueGestures = new Set(state.history.map((item) => item.gesture));
  const jitter = state.history.length > 0 ? uniqueGestures.size / state.history.length : 0;

  return {
    stableGesture: state.stableGesture,
    filteredGesture,
    consensus,
    jitter,
    changed,
    minConfidence: thresholds.minConfidence,
    minConsensus: requiredConsensus,
    holdFrames: requiredHold,
  };
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

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLabel(ctx, text, x, y, bg = "rgba(18, 34, 28, 0.78)", fg = "#f3fff7") {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1.5;
  ctx.font = "13px Segoe UI, sans-serif";
  const padding = 8;
  const textWidth = ctx.measureText(text).width;
  const rectWidth = textWidth + padding * 2;
  const rectHeight = 24;
  drawRoundedRectPath(ctx, x, y, rectWidth, rectHeight, 10);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + padding, y + 16);
  ctx.restore();
}

function buildGestureStats(gesture, confidence, source, consensus, jitter) {
  return `${gesture} | ${confidence.toFixed(2)} | ${source} | consensus ${consensus.toFixed(2)} | jitter ${jitter.toFixed(2)}`;
}

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Idle");
  const [gesture, setGesture] = useState(DEFAULT_GESTURE);
  const [confidence, setConfidence] = useState(0);
  const [source, setSource] = useState("unknown");
  const [consensus, setConsensus] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [previousLandmarks, setPreviousLandmarks] = useState(null);
  const [previousPinchDistance, setPreviousPinchDistance] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkCanvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const [targetRes, setTargetRes] = useState({ width: 640, height: 480 });
  const [liveStatus, setLiveStatus] = useState("Waiting for camera...");

  useEffect(() => {
    async function loadModel() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "/models"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions({
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            filesetResolver,
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        setModelLoaded(true);
      } catch (error) {
        setErrorMessage(`Model load failed: ${error.message}`);
      }
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (!modelLoaded || streamActive) return;

    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamActive(true);
          setStatus("Live");
        }
      } catch (error) {
        setErrorMessage(`Camera failed: ${error.message}`);
      }
    }

    startStream();
  }, [modelLoaded, streamActive]);

  useEffect(() => {
    if (!streamActive || !landmarkerRef.current || !videoRef.current) return;

    const interval = setInterval(async () => {
      if (!videoRef.current) return;
      const results = await landmarkerRef.current.detect(videoRef.current);
      if (!results || !results.landmarks || results.landmarks.length === 0) {
        setGesture(DEFAULT_GESTURE);
        setLiveStatus("No hand detected");
        return;
      }

      const landmarks = results.landmarks[0];
      const classification = classifyWithFeatureEngineering(
        landmarks,
        "Right",
        previousPinchDistance,
        previousLandmarks
      );
      setGesture(classification.gesture);
      setConfidence(classification.confidence);
      setSource(classification.source);
      setConsensus(classification.pinchDistance || 0);
      setJitter(0);
      setPreviousLandmarks(landmarks);
      setPreviousPinchDistance(classification.pinchDistance);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, [streamActive, previousLandmarks, previousPinchDistance]);

  return (
    <main style={{ padding: 16 }}>
      <h1>DriveFlow Web Dashboard</h1>
      <p>App status: {status}</p>
      <p>Gesture: {gesture}</p>
      <p>Confidence: {confidence.toFixed(2)}</p>
      <p>Source: {source}</p>
      <p>Consensus: {consensus.toFixed(2)}</p>
      <p>Jitter: {jitter.toFixed(2)}</p>
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
      <video ref={videoRef} width={targetRes.width} height={targetRes.height} autoPlay muted playsInline />
      <canvas ref={canvasRef} width={targetRes.width} height={targetRes.height} style={{ display: 'none' }} />
      <canvas ref={landmarkCanvasRef} width={targetRes.width} height={targetRes.height} />
    </main>
  );
}
