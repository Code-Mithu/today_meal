from datetime import datetime, timedelta, timezone

from django.test import override_settings
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

    def test_signup_validation_duplicate_login_and_protected_me(self):
        invalid = self.client.post(
            reverse("signup"),
            {"name": "", "email": "invalid@example.com", "password": "short"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("message", invalid.data)

        signup = self.signup()
        me = self.client.get(reverse("me"))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data["user"]["email"], "owner@example.com")

        self.client.credentials()
        duplicate = self.client.post(
            reverse("signup"),
            {"name": "Owner", "email": "OWNER@example.com", "password": "correct-horse"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 409)

        bad_login = self.client.post(
            reverse("login"),
            {"email": "owner@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(bad_login.status_code, 401)

        protected = self.client.get(reverse("me"))
        self.assertEqual(protected.status_code, 401)
        self.assertIn("access", signup)

    def test_refresh_rejects_invalid_token(self):
        response = self.client.post(reverse("token-refresh"), {"refresh": "not-a-token"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_refresh_rotation_and_logout_revoke_old_tokens(self):
        signup = self.signup()
        self.client.credentials()
        rotated = self.client.post(reverse("token-refresh"), {"refresh": signup["refresh"]}, format="json")
        self.assertEqual(rotated.status_code, 200)
        self.assertIn("refresh", rotated.data)

        reused = self.client.post(reverse("token-refresh"), {"refresh": signup["refresh"]}, format="json")
        self.assertEqual(reused.status_code, 401)

        logout = self.client.post(reverse("logout"), {"refresh": rotated.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 204)
        after_logout = self.client.post(reverse("token-refresh"), {"refresh": rotated.data["refresh"]}, format="json")
        self.assertEqual(after_logout.status_code, 401)

        repeated_logout = self.client.post(reverse("logout"), {"refresh": rotated.data["refresh"]}, format="json")
        self.assertEqual(repeated_logout.status_code, 204)

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

    def test_malformed_household_and_operation_input_is_rejected_without_server_error(self):
        self.signup()
        household = self.household()

        for household_id in ("not-a-uuid", "", {"nested": True}, 12):
            push = self.client.post(reverse("sync-push"), {"householdId": household_id, "operations": []}, format="json")
            self.assertEqual(push.status_code, 403)
            pull = self.client.get(reverse("sync-pull"), {"householdId": household_id})
            self.assertEqual(pull.status_code, 403)

        missing = self.client.get(reverse("sync-pull"))
        self.assertEqual(missing.status_code, 403)

        bad_cursor = self.client.get(reverse("sync-pull"), {"householdId": household["id"], "cursor": "abc"})
        self.assertEqual(bad_cursor.status_code, 400)

        bad_operations = self.client.post(
            reverse("sync-push"),
            {"householdId": household["id"], "operations": ["oops", None, 5]},
            format="json",
        )
        self.assertEqual(bad_operations.status_code, 200)
        self.assertTrue(all(result["accepted"] is False for result in bad_operations.data["results"]))
        self.assertEqual(SyncEntity.objects.count(), 0)

    def test_expense_approval_is_idempotent(self):
        self.signup()
        household = self.household()
        now = datetime.now(timezone.utc)
        self.operation(household["id"], "expense-create", 25, now)
        headers = {"HTTP_IDEMPOTENCY_KEY": "approve-once"}
        first = self.client.post(
            reverse("approve-expense", kwargs={"expense_id": "expense-1"}),
            {"householdId": household["id"]}, format="json", **headers,
        )
        replay = self.client.post(
            reverse("approve-expense", kwargs={"expense_id": "expense-1"}),
            {"householdId": household["id"]}, format="json", **headers,
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(first.data, replay.data)
        self.assertEqual(SyncEntity.objects.get(entity_type="expenses").payload["approval_status"], "approved")

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_invitation_and_report_email_are_idempotent(self):
        self.signup()
        household = self.household()
        invite = self.client.post(
            reverse("invite-member"),
            {"householdId": household["id"], "email": "guest@example.com", "role": "member"},
            format="json", HTTP_IDEMPOTENCY_KEY="invite-once",
        )
        replay = self.client.post(
            reverse("invite-member"),
            {"householdId": household["id"], "email": "guest@example.com", "role": "member"},
            format="json", HTTP_IDEMPOTENCY_KEY="invite-once",
        )
        self.assertEqual(invite.status_code, 201)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(invite.data, replay.data)
        report = self.client.post(
            reverse("email-report"),
            {"householdId": household["id"], "email": "owner@example.com", "currency": "BDT"},
            format="json", HTTP_IDEMPOTENCY_KEY="report-once",
        )
        self.assertEqual(report.status_code, 201)

    def test_household_isolation(self):
        self.signup()
        household = self.household()
        self.client.credentials()
        self.signup("other@example.com", "Other")
        pull = self.client.get(reverse("sync-pull"), {"householdId": household["id"], "cursor": 0})
        self.assertEqual(pull.status_code, 403)
        push = self.operation(household["id"], "forbidden", 9, datetime.now(timezone.utc))
        self.assertEqual(push.status_code, 403)
