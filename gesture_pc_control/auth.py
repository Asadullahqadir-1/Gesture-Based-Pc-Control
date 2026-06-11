import json
import os
import hashlib
from typing import Optional


class AuthManager:
    """Simple local auth manager. Uses a users.json file if present.

    File format (optional):
    {
      "users": {
        "alice": {"salt": "..", "password_hash": "..."}
      }
    }

    If no file exists, a default username/password of admin/admin is accepted.
    """

    def __init__(self, users_path: Optional[str] = None) -> None:
        if users_path is None:
            users_path = os.path.join(os.path.dirname(__file__), "users.json")
        self._users_path = users_path
        self._users = {}
        self._load()

    def _load(self) -> None:
        try:
            with open(self._users_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                users = data.get("users", {}) if isinstance(data, dict) else {}
                self._users = users
        except FileNotFoundError:
            self._users = {}
        except Exception:
            self._users = {}

    @staticmethod
    def _hash_password(salt: str, password: str) -> str:
        h = hashlib.sha256()
        h.update(salt.encode("utf-8"))
        h.update(password.encode("utf-8"))
        return h.hexdigest()

    def verify(self, username: str, password: str) -> bool:
        username = str(username)
        if not self._users:
            # No users file — allow default development user
            return username == "admin" and password == "admin"

        user = self._users.get(username)
        if not user:
            return False

        salt = user.get("salt", "")
        expected = user.get("password_hash", "")
        return expected == self._hash_password(salt, password)

    def list_users(self):
        return list(self._users.keys())
