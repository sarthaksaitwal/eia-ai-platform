"""
Geometry helpers for proximity analysis around a project site.

Points are (latitude, longitude) tuples in WGS84. Distances to lines and
polygons are computed on a local equirectangular projection centred on the
site, which keeps errors well under 1% within the tens of kilometres this
service searches. Not intended for antimeridian-crossing geometries.
"""
import math
from typing import Optional, Sequence

EARTH_RADIUS_M = 6_371_008.8

Point = tuple[float, float]


def haversine_m(a: Point, b: Point) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def destination_point(origin: Point, distance_m: float, bearing_deg: float) -> Point:
    """Point reached by travelling distance_m from origin on the given bearing."""
    lat1, lon1 = math.radians(origin[0]), math.radians(origin[1])
    bearing = math.radians(bearing_deg)
    angular = distance_m / EARTH_RADIUS_M
    lat2 = math.asin(math.sin(lat1) * math.cos(angular) + math.cos(lat1) * math.sin(angular) * math.cos(bearing))
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular) * math.cos(lat1),
        math.cos(angular) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def circle_polygon(origin: Point, radius_m: float, vertices: int = 32) -> list[Point]:
    """Closed ring approximating a circle, e.g. for population-within-radius queries."""
    ring = [destination_point(origin, radius_m, 360 * i / vertices) for i in range(vertices)]
    return ring + [ring[0]]


class _LocalProjection:
    def __init__(self, origin: Point):
        self._lat0, self._lon0 = origin
        self._cos_lat0 = math.cos(math.radians(origin[0]))

    def to_xy(self, point: Point) -> tuple[float, float]:
        x = math.radians(point[1] - self._lon0) * EARTH_RADIUS_M * self._cos_lat0
        y = math.radians(point[0] - self._lat0) * EARTH_RADIUS_M
        return x, y


def _distance_to_segment(ax: float, ay: float, bx: float, by: float) -> float:
    """Distance from the projection origin (0, 0) to segment AB."""
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(ax, ay)
    t = max(0.0, min(1.0, -(ax * dx + ay * dy) / length_sq))
    return math.hypot(ax + t * dx, ay + t * dy)


def distance_to_line_m(origin: Point, line: Sequence[Point]) -> Optional[float]:
    """Shortest distance from origin to a polyline. A single point is a valid line."""
    if not line:
        return None
    projection = _LocalProjection(origin)
    points = [projection.to_xy(p) for p in line]
    if len(points) == 1:
        return math.hypot(*points[0])
    return min(_distance_to_segment(*points[i], *points[i + 1]) for i in range(len(points) - 1))


def point_in_ring(origin: Point, ring: Sequence[Point]) -> bool:
    """Ray-casting point-in-polygon test for a closed ring."""
    if len(ring) < 4:
        return False
    projection = _LocalProjection(origin)
    points = [projection.to_xy(p) for p in ring]
    inside = False
    for (xi, yi), (xj, yj) in zip(points, points[-1:] + points[:-1]):
        if (yi > 0) != (yj > 0) and xi + (-yi) * (xj - xi) / (yj - yi) > 0:
            inside = not inside
    return inside


def distance_to_polygon_m(
    origin: Point,
    outer_rings: Sequence[Sequence[Point]],
    inner_rings: Sequence[Sequence[Point]] = (),
) -> tuple[Optional[float], bool]:
    """Returns (distance_m, inside). Distance is 0 when origin lies inside an
    outer ring and not inside a hole; otherwise it is the distance to the
    nearest boundary."""
    in_outer = any(point_in_ring(origin, ring) for ring in outer_rings)
    in_hole = any(point_in_ring(origin, ring) for ring in inner_rings)
    if in_outer and not in_hole:
        return 0.0, True
    distances = [d for ring in (*outer_rings, *inner_rings) if (d := distance_to_line_m(origin, ring)) is not None]
    return (min(distances) if distances else None), False


def assemble_rings(fragments: Sequence[Sequence[Point]]) -> tuple[list[list[Point]], list[list[Point]]]:
    """Joins way fragments that share endpoints into closed rings (OSM
    multipolygon members are often split). Returns (rings, open_lines);
    fragments that cannot be closed are still usable for distance."""
    remaining = [list(fragment) for fragment in fragments if len(fragment) >= 2]
    rings: list[list[Point]] = []
    open_lines: list[list[Point]] = []

    while remaining:
        current = remaining.pop()
        extended = True
        while current[0] != current[-1] and extended:
            extended = False
            for index, fragment in enumerate(remaining):
                if fragment[0] == current[-1]:
                    current = current + fragment[1:]
                elif fragment[-1] == current[-1]:
                    current = current + fragment[::-1][1:]
                elif fragment[-1] == current[0]:
                    current = fragment[:-1] + current
                elif fragment[0] == current[0]:
                    current = fragment[::-1][:-1] + current
                else:
                    continue
                remaining.pop(index)
                extended = True
                break

        if len(current) >= 4 and current[0] == current[-1]:
            rings.append(current)
        else:
            open_lines.append(current)

    return rings, open_lines
