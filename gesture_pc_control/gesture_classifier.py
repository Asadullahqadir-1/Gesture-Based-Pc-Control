from typing import Any, Dict, List


class GestureClassifier:
    """Lightweight rule-based gesture classifier from hand landmarks."""

    TIP_IDS = [4, 8, 12, 16, 20]
    PIP_IDS = [3, 6, 10, 14, 18]

    def classify(self, hands_payload: List[Dict[str, Any]]) -> str:
        if not hands_payload:
            return "None"

        hand = hands_payload[0]
        landmarks = hand.get("landmarks", [])
        handedness = hand.get("handedness", "Right")

        if len(landmarks) != 21:
            return "None"

        fingers_up = self._fingers_up(landmarks, handedness)
        count_up = sum(1 for is_up in fingers_up if is_up)

        thumb_up, index_up, middle_up, ring_up, little_up = fingers_up
        wrist_x = landmarks[0]["x"]
        index_x = landmarks[8]["x"]

        if count_up == 0:
            return "Fist"

        if count_up >= 4:
            return "Open Palm"

        if index_up and middle_up and not ring_up and not little_up:
            return "Two Finger"

        if index_up and not middle_up and not ring_up and not little_up:
            if index_x < wrist_x - 0.05:
                return "Point Left"
            if index_x > wrist_x + 0.05:
                return "Point Right"
            return "Point"

        if thumb_up and not index_up and not middle_up and not ring_up and not little_up:
            return "Thumb"

        return "None"

    def _fingers_up(self, landmarks: List[Dict[str, float]], handedness: str) -> List[bool]:
        thumb_tip_x = landmarks[self.TIP_IDS[0]]["x"]
        thumb_ip_x = landmarks[self.PIP_IDS[0]]["x"]

        if handedness.lower() == "right":
            thumb_up = thumb_tip_x > thumb_ip_x
        else:
            thumb_up = thumb_tip_x < thumb_ip_x

        other_fingers = []
        for tip_id, pip_id in zip(self.TIP_IDS[1:], self.PIP_IDS[1:]):
            tip_y = landmarks[tip_id]["y"]
            pip_y = landmarks[pip_id]["y"]
            other_fingers.append(tip_y < pip_y)

        return [thumb_up, *other_fingers]
