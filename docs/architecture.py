# ReductStore capability architecture figure.
# Regenerate with: python3 docs/architecture.py
# Drawing kit: reductstore website repo, scripts/diagrams/blogkit.py
# (set KIT to its location if the website checkout is elsewhere).
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent
KIT = os.environ.get(
    "KIT", str(Path.home() / "git" / "website" / "scripts" / "diagrams")
)
sys.path.insert(0, KIT)
from blogkit import Diagram  # noqa: E402


def figure():
    d = Diagram()

    # One robot at the edge.
    d.zone(0, 0, 340, 300, "On each robot")
    d.item(
        40, 48, 260, 56, "ReductBridge", "ROS 2 · MQTT · HTTP", accent=True
    )
    d.arrow((170, 104), (170, 134))
    d.panel(40, 134, 260, 146, "ReductStore Pro", "local FIFO bucket", brand=True)
    d.records(60, 206, 220, 26)
    d.text(170, 258, "quota-capped · survives offline", "text-label")

    # The same block repeats across the fleet.
    d.ellipsis(170, 322)
    d.text(170, 346, "and every other robot in the fleet", "text-note")

    # Central store.
    d.zone(520, 120, 360, 210, "Cloud or central server")
    d.card(560, 168, 280, 64, "ReductStore", "fleet-wide history", brand=True)
    d.card(
        560, 252, 280, 62, "Query API · SDK", "transform · filter · fuse (Pro)"
    )
    d.arrow((700, 232), (700, 252))

    # Replication up to the cloud, resilient to connectivity.
    d.arrow((300, 200), (560, 200), dashed=True)
    d.text(430, 190, "replicate new records", "text-label-strong")
    d.text(430, 218, "resumes after reconnect", "text-note")

    # Reads reach the fleet store or any single robot.
    d.arrow((300, 272), (560, 283), dashed=True)
    d.text(430, 300, "query a robot directly", "text-note")

    return d


if __name__ == "__main__":
    figure().save(HERE / "architecture.svg")
    print(HERE / "architecture.svg")
