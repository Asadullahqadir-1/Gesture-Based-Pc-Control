import os
import math
from typing import Any, Dict, Optional

import cv2

from camera_module import CameraModule
from dashboard_ui import DashboardUI
from gesture_classifier import GestureClassifier
from hand_detector import HandDetector
from landmark_extractor import LandmarkExtractor
from pc_controller import PCController


class GesturePCControlApp:
    """Main application that integrates camera, detection, extraction, and dashboard."""

    _ASSUMED_PALM_WIDTH_FT = 0.27
    _ASSUMED_CAMERA_HFOV_DEG = 60.0

    def __init__(self) -> None:
        auto_start_permissions = None
        if os.getenv("DRIVEFLOW_PERMISSION_PRESET", "0") == "1":
            camera_allowed = os.getenv("DRIVEFLOW_CAMERA_ALLOWED", "0") == "1"
            pc_allowed = os.getenv("DRIVEFLOW_PC_ALLOWED", "0") == "1"
            auto_start_permissions = (camera_allowed, pc_allowed)

        self.camera = CameraModule(device_index=0, width=960, height=540)
        self.detector = HandDetector(
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5,
        )
        self.extractor = LandmarkExtractor()
        self.classifier = GestureClassifier()
        self.controller = PCController(min_action_interval_sec=0.45)
        self.ui = DashboardUI(
            width=960,
            height=540,
            auto_start_permissions=auto_start_permissions,
        )
        self._last_action = "No action"
        self._camera_started = False

    def _set_controls_enabled(self, enabled: bool) -> None:
        self.controller.set_enabled(enabled)

    def _start_after_consent(self, camera_allowed: bool, pc_allowed: bool) -> bool:
        if not camera_allowed:
            return False

        if not self._camera_started:
            if not self.camera.start_camera():
                return False
            self._camera_started = True

        self.controller.set_enabled(pc_allowed)
        self.ui.set_frame_provider(self._process_next_frame)
        return True

    def _build_landmark_debug(self, landmarks_payload: list[dict[str, Any]]) -> str:
        if not landmarks_payload:
            return "No landmarks detected"

        hand = landmarks_payload[0]
        label = hand.get("handedness", "Unknown")
        score = hand.get("score", 0.0)
        distance_ft = hand.get("distance_ft")
        points = hand.get("landmarks", [])[:5]
        coords = [f"({p['x']:.3f}, {p['y']:.3f}, {p['z']:.3f})" for p in points]
        distance_text = f", approx {distance_ft:.2f} ft" if isinstance(distance_ft, (int, float)) else ""
        return f"{label} ({score:.2f}{distance_text}) first-5: " + ", ".join(coords)

    def _estimate_distance_ft(self, landmarks: list[dict[str, Any]], frame_width: int) -> Optional[float]:
        if len(landmarks) < 18 or frame_width <= 0:
            return None

        index_mcp = landmarks[5]
        pinky_mcp = landmarks[17]
        palm_width_px = math.hypot(
            index_mcp["px"] - pinky_mcp["px"],
            index_mcp["py"] - pinky_mcp["py"],
        )
        if palm_width_px <= 1:
            return None

        focal_length_px = frame_width / (2 * math.tan(math.radians(self._ASSUMED_CAMERA_HFOV_DEG / 2)))
        distance_ft = (self._ASSUMED_PALM_WIDTH_FT * focal_length_px) / palm_width_px
        return max(distance_ft, 0.1)

    def _annotate_hand_distances(self, frame: Any, landmarks_payload: list[dict[str, Any]]) -> Optional[float]:
        if frame is None or not landmarks_payload:
            return None

        frame_width = frame.shape[1]
        primary_distance_ft: Optional[float] = None

        for hand in landmarks_payload:
            landmarks = hand.get("landmarks", [])
            distance_ft = self._estimate_distance_ft(landmarks, frame_width)
            hand["distance_ft"] = distance_ft
            if distance_ft is None or not landmarks:
                continue

            if primary_distance_ft is None or distance_ft < primary_distance_ft:
                primary_distance_ft = distance_ft

            min_x = min(point["px"] for point in landmarks)
            min_y = min(point["py"] for point in landmarks)
            label = f"Distance: {distance_ft:.2f} ft"

            text_origin = (max(10, min_x), max(24, min_y - 12))
            cv2.putText(frame, label, text_origin,
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 3, cv2.LINE_AA)
            cv2.putText(frame, label, text_origin,
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 1, cv2.LINE_AA)

        return primary_distance_ft

    def _process_next_frame(self) -> Optional[Dict[str, Any]]:
        frame = self.camera.get_frame()
        if frame is None:
            return {
                "frame": None,
                "gesture": "None",
                "landmarks": [],
                "distance_ft": None,
            }

        processed_frame, results = self.detector.process_frame(frame)
        h, w = processed_frame.shape[:2]
        landmarks_payload = self.extractor.extract(results, frame_width=w, frame_height=h)
        primary_distance_ft = self._annotate_hand_distances(processed_frame, landmarks_payload)
        gesture_text = self.classifier.classify(landmarks_payload)
        self._last_action = self.controller.handle_gesture(gesture_text, landmarks_payload)
        landmark_debug = self._build_landmark_debug(landmarks_payload)

        return {
            "frame": processed_frame,
            "gesture": gesture_text,
            "landmarks": landmarks_payload,
            "distance_ft": primary_distance_ft,
            "controls_enabled": self.controller.enabled,
            "action": self._last_action,
            "landmark_debug": landmark_debug,
        }

    def run(self) -> None:
        self.ui.set_start_callback(self._start_after_consent)
        self.ui.set_control_toggle_callback(self._set_controls_enabled)
        try:
            self.ui.start()
        finally:
            self.detector.close()
            self.camera.release_camera()


def main() -> None:
    app = GesturePCControlApp()
    app.run()


if __name__ == "__main__":
    main()
