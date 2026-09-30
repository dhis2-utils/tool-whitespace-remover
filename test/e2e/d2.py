"""Minimal DHIS2 API helper (urllib, basic auth)."""
import base64
import json
import urllib.request
import urllib.error

USER, PASS = "admin", "district"
JSON_CONTENT_TYPE = "application/json"


def _req(base, method, path, body=None, content_type=JSON_CONTENT_TYPE):
    url = f"{base}{path}"
    data = None
    headers = {
        "Authorization": "Basic "
        + base64.b64encode(f"{USER}:{PASS}".encode()).decode(),
    }
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode()
        elif isinstance(body, bytes):
            data = body
        else:
            data = str(body).encode()
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw) if raw else None
            except json.JSONDecodeError:
                return r.status, raw[:500]
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return e.code, raw[:500]


def get(base, path):
    return _req(base, "GET", path)


def post(base, path, body, content_type=JSON_CONTENT_TYPE):
    return _req(base, "POST", path, body, content_type)


def delete(base, path):
    return _req(base, "DELETE", path)


def login_cookie(base):
    """Get a session cookie; try POST /api/auth/login, fall back to /api/me."""
    req = urllib.request.Request(
        f"{base}/api/auth/login",
        data=json.dumps({"username": USER, "password": PASS}).encode(),
        headers={"Content-Type": JSON_CONTENT_TYPE},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            for c in r.headers.get_all("Set-Cookie") or []:
                head = c.split(";", 1)[0]
                n, _, v = head.partition("=")
                if "JSESSIONID" in n:
                    return n.strip(), v.strip()
    except urllib.error.HTTPError:
        pass
    # Fallback: basic-auth GET yields a session cookie
    req = urllib.request.Request(
        f"{base}/api/me",
        headers={
            "Authorization": "Basic "
            + base64.b64encode(f"{USER}:{PASS}".encode()).decode()
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        for c in r.headers.get_all("Set-Cookie") or []:
            head = c.split(";", 1)[0]
            n, _, v = head.partition("=")
            if "JSESSIONID" in n:
                return n.strip(), v.strip()
    raise RuntimeError("No JSESSIONID returned")
