"""Signed C2PA provenance (c2pa-python, MIT OR Apache-2.0).

Every output gets an embedded C2PA manifest, signed with ES256, that declares
``digitalSourceType = trainedAlgorithmicMedia``. ``verify()`` checks the signature and data hash.

Credentials: by default a local **dev** CA and signer certificate are generated at runtime under
``$FBSWAP_HOME/c2pa-dev/`` (key file mode 0600). They are never committed and never shipped.
Dev-signed files verify as cryptographically *valid*. They are only *trusted* where the dev CA is
configured as a trust anchor, which by default is just this machine. For production, set
``FBSWAP_C2PA_CERT`` (PEM chain, leaf first), ``FBSWAP_C2PA_KEY`` (PEM private key) and optionally
``FBSWAP_C2PA_ANCHORS`` (PEM trust anchors).
"""

from __future__ import annotations

import datetime as _dt
import io
import json
import os
from dataclasses import dataclass
from pathlib import Path

import c2pa

from . import __version__

DIGITAL_SOURCE_TYPE = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
ASSERTION_LABEL = "org.forkbomb.fbswap.synthetic"
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4"}


@dataclass(frozen=True)
class Credentials:
    chain_pem: bytes
    key_pem: bytes
    anchors_pem: bytes | None
    dev: bool


def _dev_dir() -> Path:
    from .models import home

    return home() / "c2pa-dev"


def _make_dev_chain(d: Path) -> None:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    now = _dt.datetime.now(_dt.timezone.utc)

    def name(cn):
        return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn),
                          x509.NameAttribute(NameOID.ORGANIZATION_NAME, "fbswap local dev (untrusted)")])

    ca_key = ec.generate_private_key(ec.SECP256R1())
    ca = (x509.CertificateBuilder().subject_name(name("fbswap dev CA")).issuer_name(name("fbswap dev CA"))
          .public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
          .not_valid_before(now - _dt.timedelta(minutes=5)).not_valid_after(now + _dt.timedelta(days=365))
          .add_extension(x509.BasicConstraints(ca=True, path_length=0), True)
          .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), True)
          .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), False)
          .sign(ca_key, hashes.SHA256()))
    key = ec.generate_private_key(ec.SECP256R1())
    leaf = (x509.CertificateBuilder().subject_name(name("fbswap dev signer")).issuer_name(ca.subject)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - _dt.timedelta(minutes=5)).not_valid_after(now + _dt.timedelta(days=90))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), True)
            .add_extension(x509.KeyUsage(True, False, False, False, False, False, False, False, False), True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]), False)
            .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), False)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), False)
            .sign(ca_key, hashes.SHA256()))
    pem = serialization.Encoding.PEM
    d.mkdir(parents=True, exist_ok=True)
    (d / "ca.pem").write_bytes(ca.public_bytes(pem))
    (d / "chain.pem").write_bytes(leaf.public_bytes(pem) + ca.public_bytes(pem))
    kp = d / "signer.key"
    fd = os.open(kp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(key.private_bytes(pem, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    # the CA key is discarded: the dev CA can sign exactly this one signer, then never again


def credentials() -> Credentials:
    cert, key = os.environ.get("FBSWAP_C2PA_CERT"), os.environ.get("FBSWAP_C2PA_KEY")
    if cert and key:
        anchors = os.environ.get("FBSWAP_C2PA_ANCHORS")
        return Credentials(Path(cert).read_bytes(), Path(key).read_bytes(),
                           Path(anchors).read_bytes() if anchors else None, dev=False)
    d = _dev_dir()
    if not (d / "chain.pem").exists() or not (d / "signer.key").exists():
        _make_dev_chain(d)
    return Credentials((d / "chain.pem").read_bytes(), (d / "signer.key").read_bytes(),
                       (d / "ca.pem").read_bytes(), dev=True)


def manifest_definition(parts: dict, title: str, mime: str) -> dict:
    return {
        "claim_generator_info": [{"name": "fbswap", "version": __version__}],
        "title": title,
        "format": mime,
        "assertions": [
            {"label": "c2pa.actions", "data": {"actions": [
                {"action": "c2pa.created", "digitalSourceType": DIGITAL_SOURCE_TYPE,
                 "softwareAgent": {"name": "fbswap", "version": __version__},
                 "parameters": {"description": "AI-GENERATED face swap", **{k: str(v) for k, v in parts.items()}}},
            ]}},
            {"label": ASSERTION_LABEL, "data": {"ai_generated": True, "consent_attested": True,
                                                "visible_watermark": "AI-GENERATED"}},
        ],
    }


def _signer(creds: Credentials):
    return c2pa.Signer.from_info(c2pa.C2paSignerInfo(alg=b"es256", sign_cert=creds.chain_pem,
                                                     private_key=creds.key_pem, ta_url=None))


def sign_bytes(data: bytes, mime: str, parts: dict, title: str = "fbswap-output") -> bytes:
    creds = credentials()
    builder = c2pa.Builder(manifest_definition(parts, title, mime))
    dst = io.BytesIO()
    builder.sign(_signer(creds), mime, io.BytesIO(data), dst)
    return dst.getvalue()


def sign_file(path: str | Path, parts: dict) -> Path:
    path = Path(path)
    mime = MIME[path.suffix.lower()]
    signed = sign_bytes(path.read_bytes(), mime, parts, path.name)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(signed)
    os.replace(tmp, path)
    return path


def verify_bytes(data: bytes, mime: str) -> dict:
    """Verify an embedded manifest. Returns state (Trusted / Valid / Invalid / missing) plus details."""
    anchors = None
    try:
        anchors = credentials().anchors_pem
    except Exception:  # noqa: BLE001 - verification must still run without local creds
        anchors = None
    ctx = None
    if anchors:
        ctx = c2pa.Context(c2pa.Settings.from_dict(
            {"verify": {"verify_trust": True}, "trust": {"user_anchors": anchors.decode()}}))
    try:
        reader = c2pa.Reader(mime, io.BytesIO(data), context=ctx) if ctx else c2pa.Reader(mime, io.BytesIO(data))
    except c2pa.C2paError as e:
        return {"state": "missing", "signature_valid": False, "trusted": False, "failures": [type(e).__name__],
                "ai_generated": False}
    state = reader.get_validation_state() or "Unknown"
    res = reader.get_validation_results() or {}
    active = res.get("activeManifest", {}) if isinstance(res, dict) else {}
    failures = [f.get("code") for f in active.get("failure", [])]
    man = json.loads(reader.json())
    m = man.get("manifests", {}).get(man.get("active_manifest"), {})
    labels = {a.get("label"): a.get("data") for a in m.get("assertions", [])}
    ai = bool((labels.get(ASSERTION_LABEL) or {}).get("ai_generated"))
    sig_ok = state in ("Valid", "Trusted") or (
        bool(failures) and all(f == "signingCredential.untrusted" for f in failures))
    return {"state": state, "signature_valid": sig_ok, "trusted": state == "Trusted", "failures": failures,
            "ai_generated": ai, "signer": (m.get("signature_info") or {}).get("issuer"),
            "claim_generator": [g.get("name") for g in m.get("claim_generator_info", [])]}


def verify_file(path: str | Path) -> dict:
    path = Path(path)
    return verify_bytes(path.read_bytes(), MIME[path.suffix.lower()])
