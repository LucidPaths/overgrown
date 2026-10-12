"""overgrown art pipeline entry point. ART-001 registers the generators."""

import logging

log = logging.getLogger("overgrown.art")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    log.info("overgrown art pipeline: no generators registered yet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
