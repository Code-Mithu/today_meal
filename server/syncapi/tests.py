import io
import shutil
import tempfile
from datetime import datetime, date, timedelta, timezone

from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AuditLog, Change, Household, Membership, Receipt,
    RecurrenceOccurrence, SyncEntity, SyncOperation,
)

MEDIA_ROOT = tempfile.mkdtemp(prefix="today-meal-test-media-")


def png_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (12, 120, 90)).save(buffer, format="PNG")
    return buffer.getvalue()


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

    def test_email_report_requires_a_valid_recipient(self):
        self.signup()
        household = self.household()
        response = self.client.post(
            reverse("email-report"),
            {"householdId": household["id"], "email": " "},
            format="json", HTTP_IDEMPOTENCY_KEY="report-invalid",
        )
        self.assertEqual(response.status_code, 400)

    def test_direct_operations_require_an_idempotency_key(self):
        self.signup()
        household = self.household()
        response = self.client.post(
            reverse("approve-expense", kwargs={"expense_id": "expense-1"}),
            {"householdId": household["id"]}, format="json",
        )
        self.assertEqual(response.status_code, 400)

    def push_entity(self, household_id, entity_type, entity_id, payload, operation_id):
        return self.client.post(
            reverse("sync-push"),
            {"householdId": household_id, "operations": [{
                "operationId": operation_id, "entityType": entity_type, "entityId": entity_id,
                "baseVersion": 0, "deleted": False,
                "payload": {**payload, "id": entity_id, "updated_date": datetime.now(timezone.utc).isoformat()},
            }]},
            format="json",
        )

    def test_recurring_rule_generates_one_expense_per_occurrence(self):
        self.signup()
        household = self.household()
        self.push_entity(household["id"], "recurring_rules", "rule-1", {
            "group_id": "local-group", "name": "Gas bill", "frequency": "monthly", "active": True,
            "expense_template": {"description": "Gas bill", "amount": 800, "currency": "BDT"},
        }, "rule-create")
        occurrence = date.today().isoformat()
        first = self.client.post(
            reverse("generate-recurring", kwargs={"rule_id": "rule-1"}),
            {"householdId": household["id"], "occurrenceDate": occurrence},
            format="json", HTTP_IDEMPOTENCY_KEY="generate-once",
        )
        self.assertEqual(first.status_code, 201)
        self.assertTrue(first.data["created"])

        replay = self.client.post(
            reverse("generate-recurring", kwargs={"rule_id": "rule-1"}),
            {"householdId": household["id"], "occurrenceDate": occurrence},
            format="json", HTTP_IDEMPOTENCY_KEY="generate-once",
        )
        self.assertEqual(replay.data, first.data)

        # A different idempotency key must still be blocked by the occurrence guard.
        retry = self.client.post(
            reverse("generate-recurring", kwargs={"rule_id": "rule-1"}),
            {"householdId": household["id"], "occurrenceDate": occurrence},
            format="json", HTTP_IDEMPOTENCY_KEY="generate-twice",
        )
        self.assertEqual(retry.status_code, 200)
        self.assertFalse(retry.data["created"])
        self.assertEqual(RecurrenceOccurrence.objects.count(), 1)
        generated = SyncEntity.objects.get(entity_type="expenses", entity_id=first.data["expenseId"])
        self.assertEqual(generated.payload["approval_status"], "pending")
        self.assertEqual(generated.payload["recurring_rule_id"], "rule-1")

    def test_purchased_grocery_items_convert_to_a_single_expense(self):
        self.signup()
        household = self.household()
        self.push_entity(household["id"], "grocery_lists", "list-1", {"group_id": "local-group", "name": "Weekly run", "status": "active"}, "list-create")
        empty = self.client.post(
            reverse("grocery-to-expense", kwargs={"list_id": "list-1"}),
            {"householdId": household["id"]}, format="json", HTTP_IDEMPOTENCY_KEY="convert-empty",
        )
        self.assertEqual(empty.status_code, 400)

        self.push_entity(household["id"], "grocery_items", "item-1", {"group_id": "local-group", "list_id": "list-1", "name": "Rice", "estimated_cost": 100, "actual_cost": 120, "checked": True}, "item-1-create")
        self.push_entity(household["id"], "grocery_items", "item-2", {"group_id": "local-group", "list_id": "list-1", "name": "Oil", "estimated_cost": 80, "checked": True}, "item-2-create")
        self.push_entity(household["id"], "grocery_items", "item-3", {"group_id": "local-group", "list_id": "list-1", "name": "Salt", "estimated_cost": 20, "checked": False}, "item-3-create")

        converted = self.client.post(
            reverse("grocery-to-expense", kwargs={"list_id": "list-1"}),
            {"householdId": household["id"], "description": "Weekly groceries"},
            format="json", HTTP_IDEMPOTENCY_KEY="convert-once",
        )
        self.assertEqual(converted.status_code, 201)
        # Actual cost wins over the estimate, and unchecked items are excluded.
        self.assertEqual(converted.data["amount"], 200)
        expense = SyncEntity.objects.get(entity_type="expenses", entity_id=converted.data["expenseId"])
        self.assertEqual(expense.payload["grocery_list_id"], "list-1")
        self.assertEqual(expense.payload["approval_status"], "pending")


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ReceiptTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        signup = self.client.post(reverse("signup"), {"name": "Owner", "email": "owner@example.com", "password": "correct-horse"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {signup.data['access']}")
        self.household_id = self.client.post(reverse("households"), {"name": "My household"}, format="json").data["household"]["id"]
        self.url = reverse("expense-receipt", kwargs={"expense_id": "expense-1"})

    def upload(self, payload=None, content_type="image/png", filename="receipt.png"):
        image = SimpleUploadedFile(filename, payload if payload is not None else png_bytes(), content_type=content_type)
        return self.client.post(self.url, {"householdId": self.household_id, "receipt": image}, format="multipart")

    def test_receipt_upload_replace_fetch_and_delete(self):
        created = self.upload()
        self.assertEqual(created.status_code, 201)
        self.assertEqual(Receipt.objects.count(), 1)

        replaced = self.upload()
        self.assertEqual(replaced.status_code, 201)
        self.assertEqual(Receipt.objects.count(), 1)

        fetched = self.client.get(self.url, {"householdId": self.household_id})
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched["Content-Type"], "image/png")
        fetched.close()

        removed = self.client.delete(f"{self.url}?householdId={self.household_id}")
        self.assertEqual(removed.status_code, 204)
        self.assertEqual(Receipt.objects.count(), 0)
        self.assertEqual(self.client.get(self.url, {"householdId": self.household_id}).status_code, 404)

    def test_receipt_rejects_unsupported_type_and_foreign_household(self):
        rejected = self.upload(payload=b"not-an-image", content_type="application/pdf", filename="receipt.pdf")
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(Receipt.objects.count(), 0)

        self.upload()
        other = self.client.post(reverse("signup"), {"name": "Other", "email": "other@example.com", "password": "correct-horse"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {other.data['access']}")
        self.assertEqual(self.client.get(self.url, {"householdId": self.household_id}).status_code, 403)
        self.assertEqual(self.upload().status_code, 403)


class RealtimeTests(TransactionTestCase):
    def build(self, household_id, token):
        from config.asgi import application
        return WebsocketCommunicator(application, f"/ws/households/{household_id}?token={token}")

    def setUp(self):
        user_model = get_user_model()
        self.member = user_model.objects.create_user(username="member@example.com", email="member@example.com", password="correct-horse")
        self.outsider = user_model.objects.create_user(username="outsider@example.com", email="outsider@example.com", password="correct-horse")
        self.household = Household.objects.create(name="My household", join_code="ABCD1234")
        Membership.objects.create(household=self.household, user=self.member, role="owner")
        # Tokens are minted here because issuing them touches the database, which is not
        # allowed directly inside an async test body.
        self.member_token = str(RefreshToken.for_user(self.member).access_token)
        self.outsider_token = str(RefreshToken.for_user(self.outsider).access_token)

    async def test_member_receives_change_notifications(self):
        communicator = self.build(self.household.id, self.member_token)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        from channels.layers import get_channel_layer
        await get_channel_layer().group_send(f"household_{self.household.id}", {"type": "data.changed", "cursor": 42})
        self.assertEqual(await communicator.receive_json_from(), {"type": "data.changed", "cursor": 42})
        await communicator.disconnect()

    async def test_non_members_and_anonymous_sockets_are_rejected(self):
        for token in (self.outsider_token, "invalid-token", ""):
            communicator = self.build(self.household.id, token)
            connected, code = await communicator.connect()
            self.assertFalse(connected)
            self.assertEqual(code, 4403)
            await communicator.disconnect()
