from datetime import datetime, timedelta, timezone

from django.urls import reverse
from rest_framework.test import APITestCase

from .models import AuditLog, Change, SyncEntity, SyncOperation


class SyncApiTests(APITestCase):
    def signup(self, email="owner@example.com", name="Owner"):
        response = self.client.post(reverse("signup"), {"name": name, "email": email, "password": "correct-horse"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    def household(self):
        response = self.client.post(reverse("households"), {"name": "My household"}, format="json")
        self.assertEqual(response.status_code, 201)
        return response.data["household"]

    def operation(self, household_id, operation_id, amount, updated_at):
        return self.client.post(
            reverse("sync-push"),
            {
                "householdId": household_id,
                "operations": [{
                    "operationId": operation_id,
                    "entityType": "expenses",
                    "entityId": "expense-1",
                    "baseVersion": 0,
                    "deleted": False,
                    "payload": {"id": "expense-1", "group_id": "local-group", "amount": amount, "updated_date": updated_at.isoformat()},
                }],
            },
            format="json",
        )

    def test_health_signup_login_and_refresh(self):
        health = self.client.get(reverse("health"))
        self.assertEqual(health.status_code, 200)
        self.signup()
        self.client.credentials()
        login = self.client.post(reverse("login"), {"email": "owner@example.com", "password": "correct-horse"}, format="json")
        self.assertEqual(login.status_code, 200)
        refresh = self.client.post(reverse("token-refresh"), {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 200)
        self.assertIn("access", refresh.data)

    def test_sync_is_idempotent_audited_and_pullable(self):
        self.signup()
        household = self.household()
        now = datetime.now(timezone.utc)
        first = self.operation(household["id"], "op-1", 12, now)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["results"][0]["accepted"])
        replay = self.operation(household["id"], "op-1", 12, now)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(SyncOperation.objects.count(), 1)
        self.assertEqual(SyncEntity.objects.count(), 1)
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(Change.objects.count(), 2)
        pulled = self.client.get(reverse("sync-pull"), {"householdId": household["id"], "cursor": 0})
        self.assertEqual(pulled.status_code, 200)
        self.assertEqual(len(pulled.data["changes"]), 2)
        self.assertGreater(pulled.data["cursor"], 0)

    def test_latest_timestamp_wins(self):
        self.signup()
        household = self.household()
        now = datetime.now(timezone.utc)
        self.operation(household["id"], "newer", 20, now)
        older = self.operation(household["id"], "older", 10, now - timedelta(minutes=1))
        self.assertFalse(older.data["results"][0]["accepted"])
        entity = SyncEntity.objects.get()
        self.assertEqual(entity.payload["amount"], 20)

    def test_household_isolation(self):
        self.signup()
        household = self.household()
        self.client.credentials()
        self.signup("other@example.com", "Other")
        pull = self.client.get(reverse("sync-pull"), {"householdId": household["id"], "cursor": 0})
        self.assertEqual(pull.status_code, 403)
        push = self.operation(household["id"], "forbidden", 9, datetime.now(timezone.utc))
        self.assertEqual(push.status_code, 403)
