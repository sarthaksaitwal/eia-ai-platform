"""
Builds the Overpass query for a site and maps its result onto gis_feature
records: nearest feature of each type (with distance and inside/outside),
counts of receptors, protected areas, land use at the site and the
administrative areas containing it. Kept pure (no I/O).

OSM is geographic context, not authoritative regulatory evidence (spec §7).
Absence is reported explicitly ("none found within X km") rather than omitted.
"""
import re
from dataclasses import dataclass
from typing import Any, Iterable, Optional

from app.services.distance_service import Point, assemble_rings, distance_to_line_m, distance_to_polygon_m, haversine_m
from app.services.mappers.common import gis_feature

SOURCE_KEY = "osm_overpass"


@dataclass(frozen=True)
class TagFilter:
    element: str  # "node", "way" or "nwr" (node/way/relation)
    conditions: tuple[tuple[str, str], ...]  # (tag key, anchored regex)

    def to_ql(self, radius_m: int, origin: Point) -> str:
        tags = "".join(f'["{key}"~"{pattern}"]' for key, pattern in self.conditions)
        return f"{self.element}(around:{radius_m},{origin[0]},{origin[1]}){tags};"

    def matches(self, element_type: str, tags: dict[str, str]) -> bool:
        if self.element != "nwr" and self.element != element_type:
            return False
        return all(key in tags and re.search(pattern, tags[key]) for key, pattern in self.conditions)


@dataclass(frozen=True)
class FeatureSpec:
    feature_type: str
    section: str
    filters: tuple[TagFilter, ...]
    radius_m: int
    geometry: str  # "center" for small features, "geom" for lines and areas
    is_area: bool = False
    count: bool = False


def _f(element: str, **conditions: str) -> TagFilter:
    return TagFilter(element, tuple((key.replace("__", ":"), f"^({pattern})$") for key, pattern in conditions.items()))


FEATURES: tuple[FeatureSpec, ...] = (
    FeatureSpec("school", "socio_economic", (_f("nwr", amenity="school|college|university"),), 5_000, "center", count=True),
    FeatureSpec("hospital", "socio_economic", (_f("nwr", amenity="hospital|clinic"),), 5_000, "center", count=True),
    FeatureSpec("settlement", "socio_economic", (_f("node", place="city|town|village|hamlet|suburb"),), 10_000, "center", count=True),
    FeatureSpec("urban_area", "land", (_f("node", place="city|town"),), 25_000, "center"),
    FeatureSpec("airport", "land", (_f("nwr", aeroway="aerodrome"),), 25_000, "center"),
    FeatureSpec("road", "land", (_f("way", highway="motorway|trunk|primary|secondary"),), 5_000, "geom"),
    FeatureSpec("railway", "land", (_f("way", railway="rail"),), 10_000, "geom"),
    FeatureSpec("river", "ecology", (_f("way", waterway="river|canal"),), 10_000, "geom"),
    FeatureSpec("lake", "ecology", (_f("nwr", natural="water", water="lake|reservoir|pond|oxbow"),), 10_000, "geom", is_area=True),
    FeatureSpec("water_body", "ecology", (_f("nwr", natural="water"),), 10_000, "geom", is_area=True),
    FeatureSpec("wetland", "ecology", (_f("nwr", natural="wetland"),), 10_000, "geom", is_area=True),
    FeatureSpec("forest", "ecology", (_f("nwr", landuse="forest"), _f("nwr", natural="wood")), 10_000, "geom", is_area=True),
    FeatureSpec("industrial_area", "land", (_f("nwr", landuse="industrial"),), 10_000, "geom", is_area=True),
    FeatureSpec("residential_area", "socio_economic", (_f("nwr", landuse="residential"),), 2_000, "geom", is_area=True),
    FeatureSpec(
        "protected_area",
        "ecology",
        (_f("nwr", boundary="protected_area|national_park"), _f("nwr", leisure="nature_reserve")),
        25_000,
        "geom",
        is_area=True,
    ),
)

# Protected-area designations recognised from OSM tags (protection_title,
# designation, name). OSM tagging of Indian designations is inconsistent, so
# absence here does not prove absence on the ground.
DESIGNATIONS = {
    "national_park": r"national\s+park",
    "wildlife_sanctuary": r"sanctuary",
    "biosphere_reserve": r"biosphere",
}

METADATA_TAGS = (
    "name:en", "highway", "railway", "waterway", "natural", "water", "landuse", "leisure", "boundary",
    "protect_class", "protection_title", "designation", "amenity", "aeroway", "place", "operator", "admin_level",
)


def _effective_radius(spec: FeatureSpec, max_radius_m: float) -> int:
    return int(min(spec.radius_m, max_radius_m))


def build_query(origin: Point, *, max_radius_m: float, timeout_seconds: int) -> str:
    def block(geometry: str) -> str:
        return "\n".join(
            f"  {tag_filter.to_ql(_effective_radius(spec, max_radius_m), origin)}"
            for spec in FEATURES if spec.geometry == geometry
            for tag_filter in spec.filters
        )

    return (
        f"[out:json][timeout:{timeout_seconds}];\n"
        f"(\n{block('center')}\n);\nout center tags;\n"
        f"(\n{block('geom')}\n);\nout geom tags;\n"
        f"is_in({origin[0]},{origin[1]})->.containing;\n.containing out tags;"
    )


def _name(tags: dict[str, str]) -> Optional[str]:
    return tags.get("name:en") or tags.get("name")


def _reference(element: dict) -> str:
    return f"osm:{element['type']}/{element['id']}"


def _point_of(element: dict) -> Optional[Point]:
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]
    centre = element.get("center")
    return (centre["lat"], centre["lon"]) if centre else None


def _line(geometry: Iterable[dict]) -> list[Point]:
    return [(point["lat"], point["lon"]) for point in geometry or [] if point]


def element_distance(element: dict, origin: Point, *, is_area: bool) -> tuple[Optional[float], Optional[bool]]:
    """(distance_m, inside) for a node, a way or a multipolygon relation."""
    point = _point_of(element)
    if element["type"] == "node" or ("geometry" not in element and "members" not in element):
        return (haversine_m(origin, point), None) if point else (None, None)

    if element["type"] == "way":
        line = _line(element.get("geometry"))
        if is_area and len(line) >= 4 and line[0] == line[-1]:
            return distance_to_polygon_m(origin, [line])
        return distance_to_line_m(origin, line), None

    outer = [_line(m.get("geometry")) for m in element.get("members") or [] if m.get("type") == "way" and m.get("role") != "inner"]
    inner = [_line(m.get("geometry")) for m in element.get("members") or [] if m.get("type") == "way" and m.get("role") == "inner"]
    outer_rings, outer_open = assemble_rings(outer)
    inner_rings, inner_open = assemble_rings(inner)
    if is_area and outer_rings:
        distance, inside = distance_to_polygon_m(origin, outer_rings, inner_rings)
        open_distances = [d for line in outer_open + inner_open if (d := distance_to_line_m(origin, line)) is not None]
        if not inside and open_distances:
            distance = min([distance, *open_distances]) if distance is not None else min(open_distances)
        return distance, inside
    distances = [d for line in outer + inner if (d := distance_to_line_m(origin, line)) is not None]
    return (min(distances) if distances else None), None


def _metadata(tags: dict[str, str], **extra: Any) -> dict:
    return {**{key: tags[key] for key in METADATA_TAGS if key in tags}, **extra}


def _not_found(section: str, feature_type: str, radius_m: int) -> dict:
    return gis_feature(
        section=section,
        feature_type=feature_type,
        source_key=SOURCE_KEY,
        value_text=f"None found within {radius_m / 1000:g} km",
        metadata={"found": False, "search_radius_m": radius_m},
    )


def map_overpass_result(raw: dict[str, Any], origin: Point, *, max_radius_m: float) -> list[dict]:
    elements = raw.get("elements") or []
    features = [e for e in elements if e.get("type") in ("node", "way", "relation")]
    areas = [e for e in elements if e.get("type") == "area"]
    rows: list[dict] = []

    for spec in FEATURES:
        radius = _effective_radius(spec, max_radius_m)
        matches = []
        for element in features:
            tags = element.get("tags") or {}
            if not any(tag_filter.matches(element["type"], tags) for tag_filter in spec.filters):
                continue
            distance, inside = element_distance(element, origin, is_area=spec.is_area)
            # Overpass "around" also matches features that merely touch the
            # radius, so re-check against the computed distance.
            if distance is not None and distance <= radius:
                matches.append((distance, inside, element))
        matches.sort(key=lambda match: match[0])

        if matches:
            distance, inside, element = matches[0]
            tags = element.get("tags") or {}
            rows.append(
                gis_feature(
                    section=spec.section,
                    feature_type=f"nearest_{spec.feature_type}",
                    feature_name=_name(tags),
                    distance_m=distance,
                    inside_boundary=inside if spec.is_area else None,
                    source_key=SOURCE_KEY,
                    source_reference=_reference(element),
                    metadata=_metadata(tags, found=True, search_radius_m=radius),
                )
            )
        else:
            rows.append(_not_found(spec.section, f"nearest_{spec.feature_type}", radius))

        if spec.count:
            rows.append(
                gis_feature(
                    section=spec.section,
                    feature_type=f"{spec.feature_type}_count",
                    value_numeric=len(matches),
                    unit="count",
                    source_key=SOURCE_KEY,
                    metadata={"search_radius_m": radius},
                )
            )

        if spec.feature_type == "protected_area":
            rows.extend(_protected_area_rows(matches, radius))

    rows.extend(_site_context_rows(areas))
    return rows


def _protected_area_rows(matches: list, radius: int) -> list[dict]:
    rows = []
    nearest_by_designation: dict[str, tuple] = {}
    for distance, inside, element in matches:
        tags = element.get("tags") or {}
        rows.append(
            gis_feature(
                section="ecology",
                feature_type="protected_area",
                feature_name=_name(tags),
                distance_m=distance,
                inside_boundary=inside,
                source_key=SOURCE_KEY,
                source_reference=_reference(element),
                metadata=_metadata(tags, search_radius_m=radius),
            )
        )
        label = " ".join(tags.get(key, "") for key in ("protection_title", "designation", "name", "name:en")).lower()
        for designation, pattern in DESIGNATIONS.items():
            if re.search(pattern, label) and designation not in nearest_by_designation:
                nearest_by_designation[designation] = (distance, inside, element)

    for designation in DESIGNATIONS:
        if designation in nearest_by_designation:
            distance, inside, element = nearest_by_designation[designation]
            tags = element.get("tags") or {}
            rows.append(
                gis_feature(
                    section="ecology",
                    feature_type=f"nearest_{designation}",
                    feature_name=_name(tags),
                    distance_m=distance,
                    inside_boundary=inside,
                    source_key=SOURCE_KEY,
                    source_reference=_reference(element),
                    metadata=_metadata(tags, found=True, search_radius_m=radius),
                )
            )
        else:
            rows.append(_not_found("ecology", f"nearest_{designation}", radius))
    return rows


def _site_context_rows(areas: list[dict]) -> list[dict]:
    rows = []
    land_use = [area for area in areas if "landuse" in (area.get("tags") or {})]
    land_cover = [area for area in areas if "natural" in (area.get("tags") or {})]

    for feature_type, tag_key, matches in (("site_land_use", "landuse", land_use), ("site_land_cover", "natural", land_cover)):
        if not matches:
            rows.append(gis_feature(section="land", feature_type=feature_type, source_key=SOURCE_KEY,
                                    value_text="Not mapped in OSM at the site", metadata={"found": False}))
        for area in matches:
            tags = area["tags"]
            rows.append(
                gis_feature(
                    section="land",
                    feature_type=feature_type,
                    feature_name=_name(tags),
                    value_text=tags[tag_key],
                    distance_m=0.0,
                    inside_boundary=True,
                    source_key=SOURCE_KEY,
                    source_reference=f"osm:area/{area['id']}",
                    metadata=_metadata(tags, found=True),
                )
            )

    for area in areas:
        tags = area.get("tags") or {}
        if tags.get("boundary") == "administrative" and tags.get("admin_level"):
            rows.append(
                gis_feature(
                    section="land",
                    feature_type="administrative_area",
                    feature_name=_name(tags),
                    value_text=_name(tags),
                    value_numeric=float(tags["admin_level"]) if tags["admin_level"].isdigit() else None,
                    unit="admin_level",
                    inside_boundary=True,
                    source_key=SOURCE_KEY,
                    source_reference=f"osm:area/{area['id']}",
                    metadata=_metadata(tags, iso3166_1=tags.get("ISO3166-1"), iso3166_2=tags.get("ISO3166-2")),
                )
            )
    return rows
