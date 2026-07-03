"""Cover-art thumbnail microservice (Task 2 serverless component).

One function, two entry routes:
  A) S3 ObjectCreated event on the covers/ prefix -> pre-generate thumbnail.
  B) API Gateway HTTP API: GET /thumbnail/{key+}  -> 302 to presigned thumb URL.

Deploy notes are in README.md next to this file. Requires a Pillow layer
built for the Lambda runtime (Amazon Linux), not a Windows/macOS wheel.
"""
import io
import os

import boto3
from PIL import Image

s3 = boto3.client("s3")
BUCKET = os.environ["MEDIA_BUCKET"]            # e.g. not-spotify-media
SIZE = int(os.environ.get("THUMB_SIZE", "300"))


def _make_thumb(key: str, thumb_key: str) -> None:
    original = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
    img = Image.open(io.BytesIO(original)).convert("RGB")
    img.thumbnail((SIZE, SIZE))                # keeps aspect ratio
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    s3.put_object(
        Bucket=BUCKET, Key=thumb_key, Body=buf.getvalue(),
        ContentType="image/jpeg",
        CacheControl="public, max-age=604800",
    )


def handler(event, context):
    # Route A - S3 trigger: pre-generate thumbs for new cover uploads.
    # The trigger MUST be scoped to the covers/ prefix; output goes to
    # thumbs/ so a generated thumbnail can never re-trigger the event.
    if "Records" in event:
        for rec in event["Records"]:
            key = rec["s3"]["object"]["key"]   # covers/{guid}.jpg
            _make_thumb(key, f"thumbs/{SIZE}/{key}")
        return {"generated": len(event["Records"])}

    # Route B - API Gateway: GET /thumbnail/{key+} -> 302 presigned URL
    key = event["pathParameters"]["key"]
    thumb_key = f"thumbs/{SIZE}/{key}"
    try:
        s3.head_object(Bucket=BUCKET, Key=thumb_key)   # cache hit?
    except s3.exceptions.ClientError:
        _make_thumb(key, thumb_key)                    # miss: build once
    url = s3.generate_presigned_url(
        "get_object", Params={"Bucket": BUCKET, "Key": thumb_key},
        ExpiresIn=43200,
    )
    return {"statusCode": 302, "headers": {"Location": url}}
