"""Offline tests for the presigned-upload Lambda.

    py -m unittest discover -s serverless/uploads-presign

No AWS, no boto3, no network: boto3 is stubbed in sys.modules before the handler is
imported, and the test mints real HS256 tokens with the standard library so the
signature verification path is genuinely exercised rather than mocked out.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
import time
import types
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

SIGNING_KEY = "test-signing-key-at-least-32-characters-long"
ISSUER = "not-spotify"
AUDIENCE = "not-spotify-frontend"
BUCKET = "test-media-bucket"


# ----------------------------------------------------------------------- fake boto3

class FakeS3:
    def __init__(self):
        self.calls: list[dict] = []

    def generate_presigned_post(self, Bucket, Key, Fields, Conditions, ExpiresIn):  # noqa: N803
        self.calls.append(
            {
                "Bucket": Bucket,
                "Key": Key,
                "Fields": Fields,
                "Conditions": Conditions,
                "ExpiresIn": ExpiresIn,
            }
        )
        return {
            "url": f"https://{Bucket}.s3.amazonaws.com/",
            "fields": {**Fields, "key": Key, "policy": "stub", "x-amz-signature": "stub"},
        }


S3 = FakeS3()

_fake_boto3 = types.ModuleType("boto3")
_fake_boto3.client = lambda *_a, **_k: S3
_botocore = types.ModuleType("botocore")
_botocore_config = types.ModuleType("botocore.config")
_botocore_config.Config = lambda **_k: None
_botocore.config = _botocore_config
sys.modules.setdefault("boto3", _fake_boto3)
sys.modules.setdefault("botocore", _botocore)
sys.modules.setdefault("botocore.config", _botocore_config)

os.environ.update(
    {
        "BUCKET_NAME": BUCKET,
        "JWT_SIGNING_KEY": SIGNING_KEY,
        "JWT_ISSUER": ISSUER,
        "JWT_AUDIENCE": AUDIENCE,
        "MAX_UPLOAD_BYTES": str(100 * 1024 * 1024),
    }
)

import lambda_function as lf  # noqa: E402 - must follow the sys.modules injection


# ---------------------------------------------------------------------- test helpers


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def make_token(*, key=SIGNING_KEY, alg="HS256", iss=ISSUER, aud=AUDIENCE, sub=None,
               exp_delta=900, nbf_delta=None, tamper=False) -> str:
    """Mint a real HS256 JWT so the handler's own verification runs for real."""
    header = {"alg": alg, "typ": "JWT"}
    payload: dict = {
        "sub": sub if sub is not None else str(uuid.uuid4()),
        "iss": iss,
        "aud": aud,
        "exp": int(time.time()) + exp_delta,
    }
    if nbf_delta is not None:
        payload["nbf"] = int(time.time()) + nbf_delta

    header_b64 = b64url(json.dumps(header).encode())
    payload_b64 = b64url(json.dumps(payload).encode())
    signature = hmac.new(key.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    token = f"{header_b64}.{payload_b64}.{b64url(signature)}"

    if tamper:
        # Swap the subject for another user id but keep the original signature - the
        # exact move the signature check exists to defeat.
        evil = dict(payload, sub=str(uuid.uuid4()))
        token = f"{header_b64}.{b64url(json.dumps(evil).encode())}.{b64url(signature)}"
    return token


def event(route="POST /presign", body=None, token=None, headers=None):
    all_headers = dict(headers or {})
    if token:
        all_headers["authorization"] = f"Bearer {token}"
    return {
        "routeKey": route,
        "body": json.dumps(body) if body is not None else None,
        "headers": all_headers,
        "requestContext": {"http": {"sourceIp": "203.0.113.7"}},
    }


VALID_BODY = {"fileName": "demo-track.mp3", "sizeBytes": 4_200_000}


def body_of(response):
    return json.loads(response["body"])


class PresignTests(unittest.TestCase):
    def setUp(self):
        S3.calls.clear()

    def call(self, body=None, token=None):
        return lf.lambda_handler(event(body=body if body is not None else VALID_BODY,
                                token=token if token is not None else make_token()), None)

    # -- happy path ---------------------------------------------------------------

    def test_returns_a_presigned_post_for_a_valid_request(self):
        res = self.call()
        self.assertEqual(200, res["statusCode"])
        payload = body_of(res)
        self.assertIn("url", payload["upload"])
        self.assertIn("fields", payload["upload"])
        self.assertTrue(payload["key"].endswith(".mp3"))

    def test_key_is_scoped_to_the_token_subject(self):
        user_id = str(uuid.uuid4())
        res = self.call(token=make_token(sub=user_id))
        key = body_of(res)["key"]
        self.assertTrue(key.startswith(f"uploads/{user_id}/"), key)

    def test_two_requests_for_the_same_name_get_different_keys(self):
        first = body_of(self.call())["key"]
        second = body_of(self.call())["key"]
        self.assertNotEqual(first, second)

    def test_a_user_cannot_choose_their_own_key(self):
        # A caller-supplied key would let them write over somebody else's object.
        res = self.call(body={**VALID_BODY, "key": "uploads/00000000-0000-0000-0000-000000000000/evil.mp3"})
        self.assertEqual(200, res["statusCode"])
        self.assertNotIn("evil", body_of(res)["key"])

    def test_content_type_comes_from_the_extension_not_the_client(self):
        res = self.call(body={**VALID_BODY, "contentType": "text/html"})
        self.assertEqual("audio/mpeg", body_of(res)["contentType"])
        self.assertEqual("audio/mpeg", S3.calls[0]["Fields"]["Content-Type"])

    def test_policy_pins_the_content_type_and_caps_the_size(self):
        self.call()
        conditions = S3.calls[0]["Conditions"]
        self.assertIn({"Content-Type": "audio/mpeg"}, conditions)
        self.assertIn(["content-length-range", 1, 100 * 1024 * 1024], conditions)

    def test_every_allowed_extension_is_accepted(self):
        for extension in lf.ALLOWED_EXTENSIONS:
            with self.subTest(extension=extension):
                res = self.call(body={"fileName": f"song{extension}", "sizeBytes": 1000})
                self.assertEqual(200, res["statusCode"])

    def test_extension_matching_is_case_insensitive(self):
        self.assertEqual(200, self.call(body={"fileName": "SONG.MP3", "sizeBytes": 1000})["statusCode"])

    # -- authentication -----------------------------------------------------------

    def test_missing_token_is_401(self):
        res = lf.lambda_handler(event(body=VALID_BODY), None)
        self.assertEqual(401, res["statusCode"])
        self.assertEqual(0, len(S3.calls))

    def test_token_signed_with_another_key_is_401(self):
        res = self.call(token=make_token(key="a-completely-different-signing-key-value"))
        self.assertEqual(401, res["statusCode"])
        self.assertEqual(0, len(S3.calls))

    def test_tampered_payload_is_401(self):
        res = self.call(token=make_token(tamper=True))
        self.assertEqual(401, res["statusCode"])

    def test_alg_none_is_rejected(self):
        # The classic JWT forgery: swap the algorithm and drop the signature.
        header = b64url(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        payload = b64url(
            json.dumps(
                {"sub": str(uuid.uuid4()), "iss": ISSUER, "aud": AUDIENCE, "exp": int(time.time()) + 900}
            ).encode()
        )
        res = self.call(token=f"{header}.{payload}.")
        self.assertEqual(401, res["statusCode"])

    def test_expired_token_is_401(self):
        self.assertEqual(401, self.call(token=make_token(exp_delta=-120))["statusCode"])

    def test_token_expiring_within_the_skew_window_is_still_accepted(self):
        self.assertEqual(200, self.call(token=make_token(exp_delta=-5))["statusCode"])

    def test_not_yet_valid_token_is_401(self):
        self.assertEqual(401, self.call(token=make_token(nbf_delta=600))["statusCode"])

    def test_wrong_issuer_is_401(self):
        self.assertEqual(401, self.call(token=make_token(iss="evil-issuer"))["statusCode"])

    def test_wrong_audience_is_401(self):
        self.assertEqual(401, self.call(token=make_token(aud="some-other-app"))["statusCode"])

    def test_audience_may_be_a_list(self):
        token = make_token(aud=["another-app", AUDIENCE])
        self.assertEqual(200, self.call(token=token)["statusCode"])

    def test_non_uuid_subject_is_401(self):
        # Anything else would end up in the S3 key path unvalidated.
        self.assertEqual(401, self.call(token=make_token(sub="../../etc"))["statusCode"])

    def test_malformed_token_is_401(self):
        for bad in ("", "abc", "a.b", "a.b.c.d", "not.a.token"):
            with self.subTest(token=bad):
                res = lf.lambda_handler(event(body=VALID_BODY, headers={"authorization": f"Bearer {bad}"}), None)
                self.assertEqual(401, res["statusCode"])

    def test_non_bearer_authorization_is_401(self):
        res = lf.lambda_handler(event(body=VALID_BODY, headers={"authorization": "Basic dXNlcjpwYXNz"}), None)
        self.assertEqual(401, res["statusCode"])

    # -- request validation -------------------------------------------------------

    def test_unsupported_extension_is_rejected(self):
        for name in ("virus.exe", "cover.png", "noextension", "track.mp4"):
            with self.subTest(name=name):
                res = self.call(body={"fileName": name, "sizeBytes": 1000})
                self.assertEqual(422, res["statusCode"])
                self.assertEqual("unsupported_type", body_of(res)["error"])

    def test_oversized_file_is_rejected_before_any_s3_call(self):
        res = self.call(body={"fileName": "huge.wav", "sizeBytes": 500 * 1024 * 1024})
        self.assertEqual(413, res["statusCode"])
        self.assertEqual(0, len(S3.calls))

    def test_missing_or_bad_size_is_rejected(self):
        for size in (None, 0, -1, "4200000", True):
            with self.subTest(size=size):
                body = {"fileName": "demo.mp3"}
                if size is not None:
                    body["sizeBytes"] = size
                self.assertEqual(422, self.call(body=body)["statusCode"])

    def test_missing_file_name_is_rejected(self):
        self.assertEqual(422, self.call(body={"sizeBytes": 1000})["statusCode"])

    def test_non_json_body_is_rejected(self):
        broken = event(token=make_token())
        broken["body"] = "not json"
        self.assertEqual(400, lf.lambda_handler(broken, None)["statusCode"])

    # -- plumbing -----------------------------------------------------------------

    def test_health_reports_configuration(self):
        payload = body_of(lf.lambda_handler(event(route="GET /health"), None))
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["authConfigured"])
        self.assertEqual(BUCKET, payload["bucket"])

    def test_health_needs_no_token(self):
        self.assertEqual(200, lf.lambda_handler(event(route="GET /health"), None)["statusCode"])

    def test_unknown_route_is_404(self):
        self.assertEqual(404, lf.lambda_handler(event(route="DELETE /presign"), None)["statusCode"])

    def test_no_cors_headers_are_emitted(self):
        # CORS belongs to the HTTP API (see deploy-lambda.ps1); duplicating it here
        # would produce two Access-Control-Allow-Origin headers and browsers reject that.
        headers = self.call()["headers"]
        self.assertFalse([h for h in headers if h.lower().startswith("access-control")])

    def test_an_unexpected_failure_returns_500_without_leaking_details(self):
        original = S3.generate_presigned_post
        S3.generate_presigned_post = lambda **_k: (_ for _ in ()).throw(RuntimeError("boom: bucket arn"))
        try:
            res = self.call()
        finally:
            S3.generate_presigned_post = original
        self.assertEqual(500, res["statusCode"])
        self.assertNotIn("boom", res["body"])


if __name__ == "__main__":
    unittest.main()
