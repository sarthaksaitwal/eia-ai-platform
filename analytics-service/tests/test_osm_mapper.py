import pytest

from app.services.distance_service import circle_polygon, destination_point
from app.services.mappers.osm_mapper import build_query, map_overpass_result

SITE = (20.0, 73.78)


def node(element_id, point, **tags):
    return {"type": "node", "id": element_id, "lat": point[0], "lon": point[1], "tags": tags}


def geometry(points):
    return [{"lat": lat, "lon": lon} for lat, lon in points]


def way(element_id, points, **tags):
    return {"type": "way", "id": element_id, "geometry": geometry(points), "tags": tags}


def by_type(rows):
    return {row["feature_type"]: row for row in rows}


def test_build_query_caps_radius_and_includes_site_context():
    query = build_query(SITE, max_radius_m=3_000, timeout_seconds=60)
    assert "around:3000," in query
    assert "around:25000" not in query
    assert "is_in(20.0,73.78)" in query
    assert "out center tags;" in query and "out geom tags;" in query


def test_nearest_river_uses_perpendicular_distance_and_absence_is_explicit():
    north = destination_point(SITE, 1_500, 0)
    river = way(1, [destination_point(north, 5_000, 270), destination_point(north, 5_000, 90)], waterway="river", name="Godavari")
    rows = by_type(map_overpass_result({"elements": [river]}, SITE, max_radius_m=25_000))

    assert rows["nearest_river"]["feature_name"] == "Godavari"
    assert rows["nearest_river"]["distance_m"] == pytest.approx(1_500, rel=1e-2)
    assert rows["nearest_river"]["source_reference"] == "osm:way/1"
    assert rows["nearest_railway"]["metadata"]["found"] is False
    assert rows["nearest_railway"]["value_text"] == "None found within 10 km"
    assert rows["nearest_railway"]["distance_m"] is None


def test_site_inside_forest_polygon():
    forest = way(2, circle_polygon(SITE, 500), landuse="forest", name="Test Forest")
    rows = by_type(map_overpass_result({"elements": [forest]}, SITE, max_radius_m=25_000))
    assert rows["nearest_forest"]["distance_m"] == 0.0
    assert rows["nearest_forest"]["inside_boundary"] is True


def test_counts_only_include_features_within_radius():
    schools = [
        node(10, destination_point(SITE, 1_000, 0), amenity="school"),
        node(11, destination_point(SITE, 7_000, 0), amenity="school"),
    ]
    rows = by_type(map_overpass_result({"elements": schools}, SITE, max_radius_m=25_000))
    assert rows["school_count"]["value_numeric"] == 1
    assert rows["nearest_school"]["distance_m"] == pytest.approx(1_000, rel=1e-2)


def test_split_multipolygon_protected_area_and_designations():
    ring = circle_polygon(destination_point(SITE, 8_000, 90), 2_000, vertices=64)
    half = len(ring) // 2
    relation = {
        "type": "relation",
        "id": 5,
        "tags": {"boundary": "protected_area", "name": "Test Wildlife Sanctuary"},
        "members": [
            {"type": "way", "role": "outer", "geometry": geometry(ring[: half + 1])},
            {"type": "way", "role": "outer", "geometry": geometry(ring[half:])},
        ],
    }
    rows = map_overpass_result({"elements": [relation]}, SITE, max_radius_m=25_000)
    indexed = by_type(rows)

    assert indexed["nearest_protected_area"]["distance_m"] == pytest.approx(6_000, rel=2e-2)
    assert indexed["nearest_protected_area"]["inside_boundary"] is False
    assert indexed["nearest_wildlife_sanctuary"]["feature_name"] == "Test Wildlife Sanctuary"
    assert indexed["nearest_national_park"]["metadata"]["found"] is False
    assert sum(row["feature_type"] == "protected_area" for row in rows) == 1


def test_site_land_use_and_administrative_areas():
    areas = [
        {"type": "area", "id": 3600304716, "tags": {"boundary": "administrative", "admin_level": "2", "name": "India", "ISO3166-1": "IN"}},
        {"type": "area", "id": 1, "tags": {"landuse": "farmland"}},
    ]
    rows = by_type(map_overpass_result({"elements": areas}, SITE, max_radius_m=25_000))
    assert rows["site_land_use"]["value_text"] == "farmland"
    assert rows["site_land_cover"]["metadata"]["found"] is False
    assert rows["administrative_area"]["feature_name"] == "India"
    assert rows["administrative_area"]["value_numeric"] == 2.0
