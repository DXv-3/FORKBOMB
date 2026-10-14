"""fbswap CLI: image | video | webcam | web | models | inspect."""

from __future__ import annotations

import argparse
import json
import logging
import sys

from . import models, safeguards


def _pipe(a):
    from .pipeline import build

    return build(swapper=a.swapper, blender=a.blend, restorer=a.restore, accept=tuple(a.accept_license))


def _common(p):
    p.add_argument("--source", required=True, help="local image of the consenting source person")
    p.add_argument("--swapper", default="classic", choices=["classic", "inswapper_128"],
                   help="classic = permissive (default); inswapper_128 = RESEARCH-ONLY")
    p.add_argument("--blend", default="feather", choices=["feather", "poisson"])
    p.add_argument("--restore", default="none", choices=["none", "unsharp"])
    p.add_argument("--all-faces", action="store_true")
    p.add_argument("--accept-license", action="append", default=[], metavar="MODEL")
    p.add_argument("--i-have-consent", action="store_true", dest="consent",
                   help="required: " + safeguards.CONSENT_TEXT)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="fbswap", description="Modular face swap with safeguards on by default.")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("image")
    _common(pi)
    pi.add_argument("--target", required=True)
    pi.add_argument("-o", "--output", required=True, help=".png or .jpg")

    pv = sub.add_parser("video")
    _common(pv)
    pv.add_argument("--target", required=True)
    pv.add_argument("-o", "--output", required=True, help=".mp4")
    pv.add_argument("--max-frames", type=int)

    pw = sub.add_parser("webcam")
    _common(pw)
    pw.add_argument("--device", type=int, default=0)

    pu = sub.add_parser("web")
    pu.add_argument("--host", default="127.0.0.1")
    pu.add_argument("--port", type=int, default=3901)

    pm = sub.add_parser("models")
    pm.add_argument("action", choices=["list", "fetch"])
    pm.add_argument("names", nargs="*")
    pm.add_argument("--accept-license", action="append", default=[], metavar="MODEL")
    pm.add_argument("--path", help="register a local copy (for models with no public URL)")

    pn = sub.add_parser("inspect")
    pn.add_argument("file")

    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO if a.verbose else logging.WARNING, format="%(levelname)s %(message)s")
    try:
        if a.cmd == "models":
            if a.action == "list":
                for s in models.REGISTRY.values():
                    have = "yes" if models.model_path(s.name).exists() else "no"
                    print(f"{s.name:14} {s.stage:7} {s.label:32} downloaded={have:3} {s.license}")
                return 0
            for n in a.names or models.DEFAULT_SET:
                print(models.fetch(n, a.accept_license, a.path))
            return 0
        if a.cmd == "inspect":
            print(json.dumps(safeguards.read_marks(a.file), indent=2, default=str))
            return 0
        if a.cmd == "web":
            from .web import serve

            serve(a.host, a.port)
            return 0
        safeguards.require_consent(a.consent)
        from .pipeline import imread

        pipe = _pipe(a)
        src = imread(a.source)
        if a.cmd == "image":
            out = pipe.run_image(src, imread(a.target), consent=a.consent, all_faces=a.all_faces)
            print(safeguards.save_image(a.output, out, pipe.parts()))
        elif a.cmd == "video":
            from .video import run_video

            print(run_video(pipe, src, a.target, a.output, consent=a.consent, all_faces=a.all_faces,
                            max_frames=a.max_frames))
        else:
            from .video import run_webcam

            run_webcam(pipe, src, consent=a.consent, device=a.device)
        return 0
    except (safeguards.ConsentRequired, safeguards.RemoteInputRefused, models.LicenseNotAccepted,
            models.ModelUnavailable, ValueError) as e:
        print(f"fbswap: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
