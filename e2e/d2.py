"""Minimal DHIS2 API client (urllib, basic auth). Configured from the environment."""

import base64
import json
import os
import urllib.error
import urllib.request
import uuid

JSON_CONTENT_TYPE = "application/json"
TIMEOUT_S = 300


class Api:
    def __init__(self, base, user, password):
        self.base = base.rstrip("/")
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.auth = f"Basic {token}"

    @classmethod
    def from_env(cls):
        return cls(
            os.environ["DHIS2_URL"],
            os.environ["DHIS2_USER"],
            os.environ["DHIS2_PASS"],
        )

    def request(self, method, path, body=None, content_type=JSON_CONTENT_TYPE):
        """Returns (status, parsed JSON or raw bytes); never raises on HTTP errors."""
        headers = {"Authorization": self.auth, "Accept": JSON_CONTENT_TYPE}
        data = None
        if body is not None:
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            headers["Content-Type"] = content_type
        req = urllib.request.Request(
            f"{self.base}{path}", data=data, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as response:
                return response.status, _parse(response.read())
        except urllib.error.HTTPError as error:
            return error.code, _parse(error.read())

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, body):
        return self.request("POST", path, body)

    def put(self, path, body):
        return self.request("PUT", path, body)

    def delete(self, path):
        return self.request("DELETE", path)

    def upload(self, path, field, filename, content):
        """POST a single file as multipart/form-data."""
        boundary = uuid.uuid4().hex
        body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            "Content-Type: application/zip\r\n\r\n"
        ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
        return self.request(
            "POST", path, body, f"multipart/form-data; boundary={boundary}"
        )

    def session_cookie(self):
        """(name, value) of the session cookie from a basic-auth GET.

        Servers can rename the cookie (JSESSIONID_<suffix>), so match the prefix.
        """
        req = urllib.request.Request(
            f"{self.base}/api/me", headers={"Authorization": self.auth}
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as response:
            for header in response.headers.get_all("Set-Cookie") or []:
                name, _, value = header.split(";", 1)[0].partition("=")
                if name.strip().startswith("JSESSIONID"):
                    return name.strip(), value.strip()
        raise RuntimeError("the server returned no JSESSIONID")


def _parse(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw[:500]
