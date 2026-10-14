"""fbswap: a modular, permissively-licensed face-swap pipeline with safeguards on by default.

One module per stage, each behind a small interface in :mod:`fbswap.types`:
detect -> align -> embed -> swap -> mask -> blend -> restore -> safeguards (watermark + metadata).
"""

__version__ = "0.1.0"
