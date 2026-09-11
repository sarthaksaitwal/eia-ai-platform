import pytest

from app.services.distance_service import (
    assemble_rings,
    circle_polygon,
    destination_point,
    distance_to_line_m,
    distance_to_polygon_m,
    haversine_m,
    point_in_ring,
)

SITE = (28.6139, 77.2090)


def test_haversine_known_distance():
    # One degree of latitude is ~111.2 km.
    assert haversine_m((0.0, 0.0), (1.0, 0.0)) == pytest.approx(111_195, rel=1e-3)


def test_destination_point_round_trips_with_haversine():
    target = destination_point(SITE, 5_000, 45)
    assert haversine_m(SITE, target) == pytest.approx(5_000, rel=1e-6)


def test_distance_to_line_uses_perpendicular_not_vertices():
    # A 20 km east-west line passing 1 km north of the site: the vertices are
    # ~10 km away but the perpendicular distance is 1 km.
    north = destination_point(SITE, 1_000, 0)
    west = destination_point(north, 10_000, 270)
    east = destination_point(north, 10_000, 90)
    assert distance_to_line_m(SITE, [west, east]) == pytest.approx(1_000, rel=5e-3)


def test_distance_to_single_point_line():
    other = destination_point(SITE, 2_500, 180)
    assert distance_to_line_m(SITE, [other]) == pytest.approx(2_500, rel=5e-3)


def test_distance_to_empty_line_is_none():
    assert distance_to_line_m(SITE, []) is None


def test_point_in_ring_inside_and_outside():
    ring = circle_polygon(SITE, 1_000)
    assert point_in_ring(SITE, ring)
    assert not point_in_ring(destination_point(SITE, 3_000, 90), ring)


def test_distance_to_polygon_inside_is_zero():
    assert distance_to_polygon_m(SITE, [circle_polygon(SITE, 1_000)]) == (0.0, True)


def test_distance_to_polygon_outside_measures_to_boundary():
    centre = destination_point(SITE, 5_000, 90)
    distance, inside = distance_to_polygon_m(SITE, [circle_polygon(centre, 1_000, vertices=128)])
    assert not inside
    assert distance == pytest.approx(4_000, rel=1e-2)


def test_distance_to_polygon_inside_hole_is_not_inside():
    outer = circle_polygon(SITE, 2_000)
    hole = circle_polygon(SITE, 500, vertices=128)
    distance, inside = distance_to_polygon_m(SITE, [outer], [hole])
    assert not inside
    assert distance == pytest.approx(500, rel=1e-2)


def test_assemble_rings_joins_split_fragments():
    a, b, c, d = (0.0, 0.0), (0.0, 1.0), (1.0, 1.0), (1.0, 0.0)
    # Two halves of a square, the second one reversed.
    rings, open_lines = assemble_rings([[a, b, c], [a, d, c]])
    assert open_lines == []
    assert len(rings) == 1
    assert set(rings[0]) == {a, b, c, d}
    assert rings[0][0] == rings[0][-1]


def test_assemble_rings_keeps_unclosable_fragments_as_lines():
    rings, open_lines = assemble_rings([[(0.0, 0.0), (0.0, 1.0)]])
    assert rings == []
    assert open_lines == [[(0.0, 0.0), (0.0, 1.0)]]
