# Gesture-Based PC Control (Modular Desktop App)

This module provides a modular OpenCV + MediaPipe + Tkinter desktop application for real-time hand tracking.

## Modules

- `camera_module.py` - Webcam acquisition with stable backend/index fallback
- `hand_detector.py` - MediaPipe Hands detection + landmark drawing
- `landmark_extractor.py` - Extracts 21 landmarks into normalized and pixel coordinates
- `gesture_classifier.py` - Rule-based gesture classifier
- `pc_controller.py` - Optional PC controls (mouse/click/navigation) behind runtime toggle
- `dashboard_ui.py` - Tkinter real-time dashboard (feed, gesture placeholder, FPS)
- `main.py` - Integration runner

## Install (if needed)

```bash
.\venv_mediapipe\Scripts\python.exe -m pip install mediapipe opencv-python pillow pyautogui
```

## Run

From the project root:

```bash
.\venv_mediapipe\Scripts\python.exe .\gesture_pc_control\main.py
```

## Notes

- Press `C` in the Tkinter window to toggle PC controls ON/OFF.
- Press `Q` in the Tkinter window to exit.
- Controls are OFF by default for safety.
- If `pyautogui` is not installed, app runs in simulation mode and shows that in Action status.
- If no hand is detected, the app continues streaming and reports `Hands: 0`.
