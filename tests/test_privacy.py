"""The privacy promises in the README, checked against the real routes."""

import pytest

from app import app, businesses, match_for, providers

OWNER_ID = next(b["id"] for b in businesses.values() if b["claimed"])
OTHER_OWNER_ID = [b["id"] for b in businesses.values() if b["claimed"]][1]
PROVIDER_ID = next(iter(providers))
OTHER_PROVIDER_ID = list(providers)[1]


@pytest.fixture
def client():
    return app.test_client()


def sign_in(client, role, target):
    assert client.post("/api/demo-login", json={"role": role, "id": target}).status_code == 200


def business_with(**need):
    full = {"status": "happy", "provider": "p1", "rating": 2, "comment": "Slow.", "note": "", "shared": True}
    return {"claimed": True, "public": {}, "needs": {"banking": {**full, **need}}}


def test_public_list_has_no_private_fields(client):
    for b in client.get("/api/businesses").get_json():
        assert "needs" not in b and "signals" not in b


@pytest.mark.parametrize("sign_in_as", [None, ("owner", OTHER_OWNER_ID), ("provider", PROVIDER_ID)])
def test_only_the_owner_can_read_a_business(client, sign_in_as):
    if sign_in_as:
        sign_in(client, *sign_in_as)
    assert client.get(f"/api/business/{OWNER_ID}").status_code == 403


def test_owner_can_read_their_own_business(client):
    sign_in(client, "owner", OWNER_ID)
    assert "needs" in client.get(f"/api/business/{OWNER_ID}").get_json()


@pytest.mark.parametrize("sign_in_as", [None, ("provider", OTHER_PROVIDER_ID), ("owner", OWNER_ID)])
def test_only_that_provider_can_read_its_map(client, sign_in_as):
    if sign_in_as:
        sign_in(client, *sign_in_as)
    assert client.get(f"/api/provider/{PROVIDER_ID}/map").status_code == 403


def test_provider_map_has_no_private_guesses(client):
    sign_in(client, "provider", PROVIDER_ID)
    for b in client.get(f"/api/provider/{PROVIDER_ID}/map").get_json():
        assert "signals" not in b and "needs" not in b


def test_current_provider_sees_nothing_without_the_separate_tick():
    match = match_for(business_with(), "banking", "p1")
    assert match["state"] == "private" and "rating" not in match and "comment" not in match


def test_current_provider_sees_feedback_with_the_separate_tick():
    match = match_for(business_with(share_feedback=True), "banking", "p1")
    assert match["state"] == "customer_happy" and match["rating"] == 2


def test_competitor_is_not_named_to_another_provider():
    match = match_for(business_with(status="unhappy"), "banking", "p2")
    assert match["state"] == "open" and "p1" not in str(match) and "comment" not in match


def test_real_businesses_are_never_leads():
    real = {"claimed": False, "real": True, "public": {"has_website": False}}
    assert match_for(real, "website", "p1")["state"] == "no_info"
