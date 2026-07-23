"""Not Spotify - presigned S3 upload URLs.

API Gateway (HTTP API) -> Lambda -> a presigned S3 POST the browser uses directly.

Why this exists: personal uploads used to stream *through* the ASP.NET container on
ECS (POST /me/uploads, multipart, RequestSizeLimit 50 MB). Every byte crossed the ALB
and sat in container memory, so the cap was really a container constraint rather than a
product decision. Here the browser uploads straight to S3 and the monolith only ever
sees a small JSON call to register the finished object.

This replaces the first console-authored version of `generatePresignedUrl` in place: same
function name, same API, same POST /presign route, so the deployed resources (and the
screenshots of them) stay valid. What changed is the handler - see docs/aws-lambda-setup.md
for the before/after. The response shape moved from a single `uploadUrl` (presigned PUT)
to a policy + fields (presigned POST), because only POST can cap the body size.

Flow:
    1. POST /presign   (Authorization: Bearer <app access token>)
       -> {upload: {url, fields}, key, maxBytes, expiresIn}
    2. Browser POSTs the file straight to S3 using those fields.
    3. Browser calls POST /me/uploads/complete on the monolith with the key, which
       re-checks ownership and size with HeadObject before creating the DB row.

The Lambda never touches the file. It only decides *where* a given user is allowed to
put one, and S3 enforces that decision.

Runtime: python3.13. Standard library plus boto3, which the runtime already ships -
nothing to pip install, and the JWT is verified with hmac/hashlib rather than PyJWT.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
import uuid
from typing import Any

import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# BUCKET_NAME / URL_TTL_SECONDS keep the names the console version used, so the deployed
# configuration (and the screenshots of it) carry over unchanged.
BUCKET = os.environ.get("BUCKET_NAME", os.environ.get("MEDIA_BUCKET", ""))
REGION = os.environ.get("MEDIA_REGION", os.environ.get("AWS_REGION", "ap-southeast-1"))

# Must match the monolith's Jwt:SigningKey / Jwt:Issuer / Jwt:Audience exactly.
JWT_SIGNING_KEY = os.environ.get("JWT_SIGNING_KEY", "")
JWT_ISSUER = os.environ.get("JWT_ISSUER", "not-spotify")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "not-spotify-frontend")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 100 * 1024 * 1024))
PRESIGN_EXPIRY_SECONDS = int(os.environ.get("URL_TTL_SECONDS", 900))

# A little clock skew tolerance so a token that expires mid-flight, or a Lambda whose
# clock is a second ahead of the API's, does not produce a spurious 401.
CLOCK_SKEW_SECONDS = 30

# Same list the monolith enforces (MeUploadsController.AllowedAudioExts), kept in sync
# by hand. A file type accepted here but rejected there would leave orphaned objects.
ALLOWED_EXTENSIONS = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/opus",
    ".flac": "audio/flac",
    ".webm": "audio/webm",
}

# S3 must sign with SigV4 for a presigned POST policy to be accepted.
_s3 = boto3.client("s3", region_name=REGION, config=Config(signature_version="s3v4"))

JSON_HEADERS = {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


# --------------------------------------------------------------------------- helpers


def _response(status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {"statusCode": status, "headers": JSON_HEADERS, "body": json.dumps(body)}


def _error(status: int, code: str, message: str) -> dict[str, Any]:
    return _response(status, {"error": code, "message": message})


def _b64url_decode(segment: str) -> bytes:
    """Decode a JWT segment, restoring the padding JWTs strip."""
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


class TokenError(Exception):
    """Any reason a token is not acceptable. The message is safe to return."""


def verify_access_token(token: str) -> dict[str, Any]:
    """Validate an HS256 token minted by the monolith's TokenService.

    Deliberately hand-rolled on hmac/hashlib: the only algorithm the app issues is
    HS256, and a dependency-free handler keeps the deploy zip a single file. The
    trade-off is that this MUST reject everything it does not understand rather than
    skipping checks it cannot perform - hence the explicit alg allowlist below, which
    is what stops the classic "alg: none" and RS256-key-confusion attacks.
    """
    if not JWT_SIGNING_KEY:
        raise TokenError("Upload authorization is not configured.")

    parts = token.split(".")
    if len(parts) != 3:
        raise TokenError("Malformed token.")
    header_b64, payload_b64, signature_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
        signature = _b64url_decode(signature_b64)
    except (ValueError, json.JSONDecodeError) as exc:
        raise TokenError("Malformed token.") from exc

    if header.get("alg") != "HS256":
        raise TokenError("Unsupported token algorithm.")

    expected = hmac.new(
        JWT_SIGNING_KEY.encode("utf-8"),
        f"{header_b64}.{payload_b64}".encode("ascii"),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(expected, signature):
        raise TokenError("Token signature does not match.")

    now = int(time.time())
    exp = payload.get("exp")
    if not isinstance(exp, int) or now > exp + CLOCK_SKEW_SECONDS:
        raise TokenError("Token has expired.")
    nbf = payload.get("nbf")
    if isinstance(nbf, int) and now + CLOCK_SKEW_SECONDS < nbf:
        raise TokenError("Token is not valid yet.")

    if payload.get("iss") != JWT_ISSUER:
        raise TokenError("Token issuer is not accepted.")
    # "aud" is a string or a list of strings depending on the issuer.
    audience = payload.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if JWT_AUDIENCE not in audiences:
        raise TokenError("Token audience is not accepted.")

    subject = payload.get("sub")
    if not isinstance(subject, str) or not _UUID_RE.match(subject):
        raise TokenError("Token has no usable subject.")

    return payload


def _bearer_token(event: dict[str, Any]) -> str:
    header = (event.get("headers") or {}).get("authorization", "")
    if not header.lower().startswith("bearer "):
        return ""
    return header[7:].strip()


def _parse_body(event: dict[str, Any]) -> dict[str, Any] | None:
    raw = event.get("body")
    if not raw:
        return None
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _extension_of(file_name: str) -> str:
    _, dot, ext = file_name.rpartition(".")
    return f".{ext.lower()}" if dot else ""


# ---------------------------------------------------------------------------- routes


def presign(event: dict[str, Any]) -> dict[str, Any]:
    if not BUCKET:
        logger.error("MEDIA_BUCKET is not set")
        return _error(500, "not_configured", "Uploads are not configured.")

    token = _bearer_token(event)
    if not token:
        return _error(401, "unauthorized", "Sign in to upload.")
    try:
        claims = verify_access_token(token)
    except TokenError as exc:
        # 401 on every token problem: the client's move is always the same (refresh and
        # retry, or sign in), and distinguishing the causes only helps someone probing.
        logger.info("rejected token: %s", exc)
        return _error(401, "unauthorized", str(exc))

    user_id = claims["sub"]

    body = _parse_body(event)
    if body is None:
        return _error(400, "invalid_body", "Send a JSON object.")

    file_name = body.get("fileName")
    if not isinstance(file_name, str) or not file_name.strip():
        return _error(422, "file_name_required", "Include the file name.")

    extension = _extension_of(file_name.strip())
    if extension not in ALLOWED_EXTENSIONS:
        return _error(
            422,
            "unsupported_type",
            f"Unsupported file type '{extension or file_name}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    size_bytes = body.get("sizeBytes")
    if not isinstance(size_bytes, int) or isinstance(size_bytes, bool) or size_bytes <= 0:
        return _error(422, "size_required", "Include the file size in bytes.")
    if size_bytes > MAX_UPLOAD_BYTES:
        return _error(
            413,
            "too_large",
            f"That file is {size_bytes // (1024 * 1024)} MB. The limit is "
            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    # The browser's reported type is a hint, not a fact - Windows serves .flac as
    # application/octet-stream often enough that trusting it breaks real uploads. The
    # extension decides, and the policy then pins the header S3 will accept.
    content_type = ALLOWED_EXTENSIONS[extension]

    # Key layout matches what MeUploadsController already writes, so objects created by
    # either path are indistinguishable and the ownership check downstream is a simple
    # prefix comparison.
    key = f"uploads/{user_id}/{uuid.uuid4()}{extension}"

    # A presigned POST (not PUT) specifically for content-length-range: a presigned PUT
    # cannot cap the body, so a client could ignore sizeBytes above and stream gigabytes
    # into the bucket. With this policy S3 itself rejects anything outside the range.
    presigned = _s3.generate_presigned_post(
        Bucket=BUCKET,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, MAX_UPLOAD_BYTES],
        ],
        ExpiresIn=PRESIGN_EXPIRY_SECONDS,
    )

    logger.info("presigned %s for user %s (%s bytes)", key, user_id, size_bytes)
    return _response(
        200,
        {
            "upload": {"url": presigned["url"], "fields": presigned["fields"]},
            "key": key,
            "contentType": content_type,
            "maxBytes": MAX_UPLOAD_BYTES,
            "expiresIn": PRESIGN_EXPIRY_SECONDS,
        },
    )


def health(_event: dict[str, Any]) -> dict[str, Any]:
    return _response(
        200,
        {
            "ok": True,
            "bucket": BUCKET or None,
            "authConfigured": bool(JWT_SIGNING_KEY),
            "maxUploadMb": MAX_UPLOAD_BYTES // (1024 * 1024),
            "allowedExtensions": sorted(ALLOWED_EXTENSIONS),
        },
    )


ROUTES = {
    "GET /health": health,
    "POST /presign": presign,
}


# Named lambda_handler to match the deployed function's configured entry point
# (lambda_function.lambda_handler) - renaming it would need a console change too.
def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    route = event.get("routeKey", "")
    handle = ROUTES.get(route)
    if handle is None:
        return _error(404, "no_route", f"No handler for {route or 'the requested route'}.")
    try:
        return handle(event)
    except Exception:  # noqa: BLE001 - never leak a stack trace to the caller
        logger.exception("unhandled error on %s", route)
        return _error(500, "internal_error", "Something went wrong. Try again shortly.")
