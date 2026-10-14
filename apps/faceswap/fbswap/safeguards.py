"""Safeguards, on by default and not configurable off from the CLI or web UI:

* consent attestation is required before any processing;
* every output carries a visible "AI-GENERATED" watermark;
* outputs carry machine-readable synthetic-media metadata (EXIF + XMP with IPTC
  DigitalSourceType=trainedAlgorithmicMedia) plus an unsigned C2PA-style JSON sidecar;
* only local files are accepted (no URLs, no web scraping, no directory batch of scraped faces);
* logs record timings/sizes only, never pixels or image bytes.

No watermark-removal feature is provided.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import logging
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, PngImagePlugin

from . import __version__

WATERMARK_TEXT = "AI-GENERATED"
DIGITAL_SOURCE_TYPE = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
CONSENT_TEXT = (
    "I attest that every person whose face appears in the source and target has given informed "
    "consent to this edit, no one depicted is a minor, and the output will not be used for "
    "sexual content, impersonation, harassment, fraud or deception."
)

log = logging.getLogger("fbswap")


class ConsentRequired(PermissionError):
    pass


class RemoteInputRefused(ValueError):
    pass


def require_consent(consent: bool) -> None:
    if consent is not True:
        raise ConsentRequired("Consent attestation required (--i-have-consent / checkbox). " + CONSENT_TEXT)


def local_only(*paths: str) -> None:
    for p in paths:
        s = str(p).lower()
        if "://" in s or s.startswith(("www.", "data:")):
            raise RemoteInputRefused("Only local files are accepted; fetching faces from the web is not supported.")


def watermark(img: np.ndarray, text: str = WATERMARK_TEXT) -> np.ndarray:
    """Draw a visible banner bottom-right. Scales with image size."""
    out = img.copy()
    h, w = out.shape[:2]
    scale = max(0.35, min(w, h) / 900)
    thick = max(1, int(round(scale * 2)))
    (tw, th), base = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)
    pad = max(3, int(6 * scale))
    x1, y1 = w - 1 - pad, h - 1 - pad
    x0, y0 = max(0, x1 - tw - 2 * pad), max(0, y1 - th - base - 2 * pad)
    cv2.rectangle(out, (x0, y0), (x1, y1), (0, 0, 0), -1)
    cv2.putText(out, text, (x0 + pad, y1 - pad - base // 2), cv2.FONT_HERSHEY_SIMPLEX, scale,
                (255, 255, 255), thick, cv2.LINE_AA)
    return out


def watermark_box(shape) -> tuple[int, int, int, int]:
    h, w = shape[:2]
    scale = max(0.35, min(w, h) / 900)
    thick = max(1, int(round(scale * 2)))
    (tw, th), base = cv2.getTextSize(WATERMARK_TEXT, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)
    pad = max(3, int(6 * scale))
    x1, y1 = w - 1 - pad, h - 1 - pad
    return max(0, x1 - tw - 2 * pad), max(0, y1 - th - base - 2 * pad), x1, y1


def manifest(parts: dict, out_sha: str | None = None) -> dict:
    return {
        "claim_generator": f"fbswap/{__version__}",
        "format": "c2pa-style unsigned assertion (not a signed C2PA manifest)",
        "created": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "assertions": [
            {"label": "c2pa.actions", "data": {"actions": [
                {"action": "c2pa.edited", "digitalSourceType": DIGITAL_SOURCE_TYPE,
                 "softwareAgent": f"fbswap/{__version__}", "parameters": parts}]}},
            {"label": "fbswap.synthetic", "data": {"ai_generated": True, "consent_attested": True}},
        ],
        "output_sha256": out_sha,
    }


def xmp_packet(parts: dict) -> str:
    p = ", ".join(f"{k}={v}" for k, v in parts.items())
    return (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"'
        ' xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f"<Iptc4xmpExt:DigitalSourceType>{DIGITAL_SOURCE_TYPE}</Iptc4xmpExt:DigitalSourceType>"
        f"<xmp:CreatorTool>fbswap/{__version__}</xmp:CreatorTool>"
        f"<dc:description><rdf:Alt><rdf:li xml:lang=\"x-default\">AI-GENERATED synthetic face swap ({p})"
        "</rdf:li></rdf:Alt></dc:description>"
        '</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
    )


def encode_image(img_bgr: np.ndarray, parts: dict, fmt: str = "png") -> bytes:
    """Encode with EXIF + XMP synthetic-media marks (in memory)."""
    import io

    im = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    desc = f"AI-GENERATED synthetic image (fbswap {__version__})"
    exif = Image.Exif()
    exif[0x010E] = desc  # ImageDescription
    exif[0x0131] = f"fbswap/{__version__}"  # Software
    xmp = xmp_packet(parts)
    buf = io.BytesIO()
    if fmt == "png":
        info = PngImagePlugin.PngInfo()
        info.add_text("AI-Generated", "true")
        info.add_text("Description", desc)
        info.add_itxt("XML:com.adobe.xmp", xmp)
        im.save(buf, format="PNG", pnginfo=info, exif=exif)
    elif fmt in ("jpg", "jpeg"):
        im.save(buf, format="JPEG", quality=95, exif=exif, xmp=xmp.encode())
    else:
        raise ValueError("output must be .png or .jpg")
    return buf.getvalue()


def save_image(path: str | Path, img_bgr: np.ndarray, parts: dict) -> Path:
    """Save with marks plus a C2PA-style JSON sidecar carrying the output hash."""
    path = Path(path)
    data = encode_image(img_bgr, parts, path.suffix.lower().lstrip("."))
    path.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    Path(str(path) + ".c2pa.json").write_text(json.dumps(manifest(parts, sha), indent=2))
    return path


def read_marks(path: str | Path) -> dict:
    """Return the synthetic-media marks found in a saved file (used by tests and `fbswap inspect`)."""
    path = Path(path)
    im = Image.open(path)
    exif = im.getexif()
    raw = path.read_bytes()
    side = Path(str(path) + ".c2pa.json")
    return {
        "exif_description": exif.get(0x010E),
        "software": exif.get(0x0131),
        "xmp_digital_source_type": DIGITAL_SOURCE_TYPE.encode() in raw,
        "png_ai_generated": getattr(im, "text", {}).get("AI-Generated") if hasattr(im, "text") else None,
        "sidecar": json.loads(side.read_text()) if side.exists() else None,
    }
