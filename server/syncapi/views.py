import hashlib
import secrets
import uuid
from datetime import date, timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (
    AuditLog, Change, DirectOperation, Household, Invitation, Membership,
    Receipt, RecurrenceOccurrence, SyncEntity, SyncOperation,
)

User = get_user_model()
ENTITY_TYPES = {
    "groups", "members", "expenses", "contributions", "daily_meals",
    "daily_menus", "categories", "vendors", "group_settings", "budgets",
    "exchange_rates", "recurring_rules", "grocery_lists", "grocery_items",
    "invitations", "report_deliveries",
}
WRITE_ROLES = {"owner", "admin", "member"}


def user_payload(user):
    return {"id": str(user.id), "name": user.get_full_name() or user.username, "email": user.email}


def token_payload(user):
    refresh = RefreshToken.for_user(user)
    return {"user": user_payload(user), "access": str(refresh.access_token), "refresh": str(refresh)}


def membership_for(user, household_id):
    # Household primary keys are UUIDs. Passing an arbitrary client string straight
    # into the ORM raises a database ValidationError (HTTP 500), so unparseable ids
    # are rejected here and surface as a normal "access denied" response instead.
    try:
        household_uuid = uuid.UUID(str(household_id))
    except (TypeError, ValueError, AttributeError):
        return None
    return Membership.objects.select_related("household").filter(user=user, household_id=household_uuid).first()


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([AllowAny])
def signup(request):
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    name = str(request.data.get("name", "")).strip()
    if not email or len(password) < 8 or not name:
        return Response({"message": "Name, email, and an 8-character password are required."}, status=400)
    if User.objects.filter(username=email).exists():
        return Response({"message": "An account with this email already exists."}, status=409)
    user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
    return Response(token_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    from django.contrib.auth import authenticate
    email = str(request.data.get("email", "")).strip().lower()
    user = authenticate(username=email, password=request.data.get("password"))
    if not user:
        return Response({"message": "Invalid email or password."}, status=401)
    return Response(token_payload(user))


@api_view(["GET"])
def me(request):
    return Response({"user": user_payload(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def logout(request):
    refresh_value = str(request.data.get("refresh", ""))
    if refresh_value:
        try:
            RefreshToken(refresh_value).blacklist()
        except Exception:
            # Logout is idempotent: an invalid, expired, or already-revoked token is signed out.
            pass
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def households(request):
    if request.method == "GET":
        rows = Membership.objects.select_related("household").filter(user=request.user)
        return Response({"households": [{"id": str(row.household_id), "name": row.household.name, "role": row.role, "joinCode": row.household.join_code} for row in rows]})
    name = str(request.data.get("name", "")).strip()
    if not name:
        return Response({"message": "Household name is required."}, status=400)
    with transaction.atomic():
        household = Household.objects.create(name=name, join_code=secrets.token_hex(4).upper())
        Membership.objects.create(household=household, user=request.user, role="owner")
    return Response({"household": {"id": str(household.id), "name": household.name, "role": "owner", "joinCode": household.join_code}}, status=201)


@api_view(["POST"])
def join_household(request):
    code = str(request.data.get("joinCode", "")).strip().upper()
    household = Household.objects.filter(join_code=code).first()
    if not household:
        return Response({"message": "Invalid join code."}, status=404)
    membership, _ = Membership.objects.get_or_create(household=household, user=request.user, defaults={"role": "member"})
    return Response({"household": {"id": str(household.id), "name": household.name, "role": membership.role}})


def normalized_timestamp(payload):
    value = parse_datetime(str(payload.get("updated_date", "")))
    return value if value else timezone.now()


@api_view(["POST"])
def sync_push(request):
    membership = membership_for(request.user, request.data.get("householdId"))
    if not membership or membership.role not in WRITE_ROLES:
        return Response({"message": "Household access denied."}, status=403)
    # Always use the verified membership's household id so every write below is
    # scoped to a household this user actually belongs to.
    household_id = membership.household_id
    operations = request.data.get("operations", [])
    if not isinstance(operations, list) or len(operations) > 250:
        return Response({"message": "Operations must be a list of at most 250 items."}, status=400)
    results = []
    with transaction.atomic():
        for operation in operations:
            if not isinstance(operation, dict):
                results.append({"operationId": "", "accepted": False, "error": "Invalid operation"})
                continue
            operation_id = str(operation.get("operationId", ""))[:128]
            entity_type = str(operation.get("entityType", ""))
            entity_id = str(operation.get("entityId", ""))[:128]
            payload = operation.get("payload") if isinstance(operation.get("payload"), dict) else {}
            if entity_type == "expenses" and membership.role == "member":
                policy = SyncEntity.objects.filter(
                    household_id=household_id, entity_type="group_settings", deleted_at__isnull=True
                ).first()
                if policy and policy.payload.get("expense_approval_required"):
                    payload = {**payload, "approval_status": "pending", "reviewed_by": None, "reviewed_at": None}
            if not operation_id or not entity_id or entity_type not in ENTITY_TYPES:
                results.append({"operationId": operation_id, "accepted": False, "error": "Invalid operation"})
                continue
            prior = SyncOperation.objects.filter(operation_id=operation_id, household_id=household_id).first()
            if prior:
                results.append(prior.response)
                continue
            current = SyncEntity.objects.select_for_update().filter(household_id=household_id, entity_type=entity_type, entity_id=entity_id).first()
            incoming_at = normalized_timestamp(payload)
            incoming_key = (incoming_at, operation_id)
            current_key = (current.client_updated_at, current.winning_operation_id) if current else None
            accepted = current is None or incoming_key > current_key
            previous = current.payload if current else None
            if accepted:
                deleted_at = timezone.now() if operation.get("deleted") else None
                if current:
                    current.payload = payload; current.version += 1; current.client_updated_at = incoming_at
                    current.winning_operation_id = operation_id; current.deleted_at = deleted_at; current.save()
                else:
                    current = SyncEntity.objects.create(household_id=household_id, entity_type=entity_type, entity_id=entity_id, payload=payload, client_updated_at=incoming_at, winning_operation_id=operation_id, deleted_at=deleted_at)
                change = Change.objects.create(household_id=household_id, sync_entity=current, entity_type=entity_type, entity_id=entity_id, payload=payload, version=current.version, deleted_at=deleted_at)
                transaction.on_commit(lambda hid=household_id, cursor=change.id: broadcast_change(hid, cursor))
                audit = AuditLog.objects.create(household_id=household_id, actor=request.user, action="deleted" if deleted_at else ("created" if previous is None else "updated"), entity_type=entity_type, entity_id=entity_id, previous_value=previous, new_value=payload)
                Change.objects.create(household_id=household_id, sync_entity=current, entity_type="audit_logs", entity_id=str(audit.id), payload={"id": str(audit.id), "group_id": payload.get("group_id") or entity_id, "action": audit.action, "actor_id": str(request.user.id), "actor_name": request.user.get_full_name() or request.user.username, "entity_type": entity_type, "previous_value": previous, "new_value": payload, "created_date": audit.created_at.isoformat()}, version=1)
            response = {"operationId": operation_id, "accepted": accepted, "current": {"entityType": entity_type, "entityId": entity_id, "payload": current.payload, "version": current.version, "deletedAt": current.deleted_at.isoformat() if current.deleted_at else None}}
            SyncOperation.objects.create(operation_id=operation_id, household_id=household_id, user=request.user, accepted=accepted, response=response)
            results.append(response)
    return Response({"results": results})


@api_view(["GET"])
def sync_pull(request):
    membership = membership_for(request.user, request.query_params.get("householdId"))
    if not membership:
        return Response({"message": "Household access denied."}, status=403)
    try:
        cursor = max(0, int(request.query_params.get("cursor", "0")))
    except (TypeError, ValueError):
        return Response({"message": "Invalid cursor."}, status=400)
    rows = list(Change.objects.filter(household_id=membership.household_id, id__gt=cursor).order_by("id")[:251])
    has_more = len(rows) > 250
    rows = rows[:250]
    changes = [{"sequence": str(row.id), "entity_type": row.entity_type, "entity_id": row.entity_id, "payload": row.payload, "version": row.version, "deleted_at": row.deleted_at.isoformat() if row.deleted_at else None} for row in rows]
    return Response({"changes": changes, "cursor": rows[-1].id if rows else cursor, "hasMore": has_more})


def emit_change(household_id, actor, entity_type, entity_id, payload, action="updated"):
    current = SyncEntity.objects.select_for_update().filter(
        household_id=household_id, entity_type=entity_type, entity_id=entity_id
    ).first()
    previous = current.payload if current else None
    now = timezone.now()
    operation_id = f"server:{uuid.uuid4()}"
    if current:
        current.payload = payload
        current.version += 1
        current.client_updated_at = now
        current.winning_operation_id = operation_id
        current.deleted_at = None
        current.save()
    else:
        current = SyncEntity.objects.create(
            household_id=household_id, entity_type=entity_type, entity_id=entity_id,
            payload=payload, client_updated_at=now, winning_operation_id=operation_id,
        )
    change = Change.objects.create(
        household_id=household_id, sync_entity=current, entity_type=entity_type,
        entity_id=entity_id, payload=payload, version=current.version,
    )
    AuditLog.objects.create(
        household_id=household_id, actor=actor, action=action,
        entity_type=entity_type, entity_id=entity_id, previous_value=previous, new_value=payload,
    )
    transaction.on_commit(lambda: broadcast_change(household_id, change.id))
    return current, change


def broadcast_change(household_id, cursor):
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        async_to_sync(get_channel_layer().group_send)(
            f"household_{household_id}", {"type": "data.changed", "cursor": cursor}
        )
    except Exception:
        # Realtime is an optimization; cursor sync remains authoritative.
        pass


def direct_operation(request, membership, action, callback):
    operation_id = str(request.headers.get("Idempotency-Key") or request.data.get("operationId", ""))[:128]
    if not operation_id:
        return Response({"message": "Idempotency-Key is required."}, status=400)
    with transaction.atomic():
        prior = DirectOperation.objects.filter(household=membership.household, operation_id=operation_id).first()
        if prior:
            return Response(prior.response)
        response, response_status = callback()
        DirectOperation.objects.create(
            operation_id=operation_id, household=membership.household, user=request.user,
            action=action, response=response,
        )
    return Response(response, status=response_status)


def require_membership(request, roles=None):
    membership = membership_for(request.user, request.data.get("householdId") or request.query_params.get("householdId"))
    if not membership or (roles and membership.role not in roles):
        return None
    return membership


@api_view(["POST"])
def approval_action(request, expense_id, decision):
    membership = require_membership(request, {"owner", "admin"})
    if not membership or decision not in {"approve", "reject"}:
        return Response({"message": "Admin access denied."}, status=403)

    def apply():
        entity = SyncEntity.objects.select_for_update().filter(
            household=membership.household, entity_type="expenses", entity_id=expense_id, deleted_at__isnull=True
        ).first()
        if not entity:
            return ({"message": "Expense not found."}, 404)
        payload = dict(entity.payload)
        payload.update({
            "approval_status": "approved" if decision == "approve" else "rejected",
            "reviewed_by": str(request.user.id),
            "reviewed_at": timezone.now().isoformat(),
            "rejection_reason": str(request.data.get("reason", "")).strip() if decision == "reject" else None,
            "updated_date": timezone.now().isoformat(),
        })
        current, _ = emit_change(membership.household_id, request.user, "expenses", expense_id, payload, decision + "d")
        return ({"expense": current.payload, "version": current.version}, 200)

    return direct_operation(request, membership, f"expense.{decision}", apply)


@api_view(["GET", "POST", "DELETE"])
def receipt_detail(request, expense_id):
    membership = require_membership(request)
    if not membership:
        return Response({"message": "Household access denied."}, status=403)
    if request.method == "GET":
        receipt = Receipt.objects.filter(household=membership.household, expense_id=expense_id).first()
        return FileResponse(receipt.image.open("rb"), content_type=receipt.content_type) if receipt else Response({"message": "Receipt not found."}, status=404)
    if request.method == "DELETE":
        receipt = Receipt.objects.filter(household=membership.household, expense_id=expense_id).first()
        if receipt:
            receipt.image.delete(save=False)
            receipt.delete()
        return Response(status=204)
    upload = request.FILES.get("receipt")
    if not upload or upload.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        return Response({"message": "A JPEG, PNG, or WebP receipt is required."}, status=400)
    if upload.size > settings.FILE_UPLOAD_MAX_MEMORY_SIZE:
        return Response({"message": "Receipt exceeds the upload limit."}, status=413)
    receipt = Receipt.objects.filter(household=membership.household, expense_id=expense_id).first()
    if receipt:
        receipt.image.delete(save=False)
        receipt.image = upload
        receipt.content_type = upload.content_type
        receipt.size = upload.size
        receipt.uploaded_by = request.user
        receipt.save()
    else:
        receipt = Receipt.objects.create(
            household=membership.household, expense_id=expense_id, image=upload,
            content_type=upload.content_type, size=upload.size, uploaded_by=request.user,
        )
    return Response({"receiptId": str(receipt.id), "expenseId": expense_id}, status=201)


@api_view(["POST"])
def generate_recurring(request, rule_id):
    membership = require_membership(request)
    if not membership:
        return Response({"message": "Household access denied."}, status=403)

    def apply():
        rule = SyncEntity.objects.filter(household=membership.household, entity_type="recurring_rules", entity_id=rule_id, deleted_at__isnull=True).first()
        if not rule or not rule.payload.get("active", True):
            return ({"message": "Active recurring rule not found."}, 404)
        occurrence = date.fromisoformat(str(request.data.get("occurrenceDate", date.today().isoformat())))
        existing = RecurrenceOccurrence.objects.filter(household=membership.household, rule_id=rule_id, occurrence_date=occurrence).first()
        if existing:
            return ({"expenseId": existing.expense_id, "created": False}, 200)
        expense_id = str(uuid.uuid4())
        payload = {**rule.payload.get("expense_template", {}), "id": expense_id, "group_id": str(membership.household_id), "date": occurrence.isoformat(), "approval_status": "pending", "recurring_rule_id": rule_id, "updated_date": timezone.now().isoformat()}
        emit_change(membership.household_id, request.user, "expenses", expense_id, payload, "generated")
        RecurrenceOccurrence.objects.create(household=membership.household, rule_id=rule_id, occurrence_date=occurrence, expense_id=expense_id)
        return ({"expenseId": expense_id, "created": True}, 201)

    return direct_operation(request, membership, "recurring.generate", apply)


@api_view(["POST"])
def grocery_to_expense(request, list_id):
    membership = require_membership(request)
    if not membership:
        return Response({"message": "Household access denied."}, status=403)

    def apply():
        items = SyncEntity.objects.filter(household=membership.household, entity_type="grocery_items", deleted_at__isnull=True)
        purchased = [row.payload for row in items if row.payload.get("list_id") == list_id and row.payload.get("checked")]
        amount = round(sum(float(item.get("actual_cost") or item.get("estimated_cost") or 0) for item in purchased), 2)
        if not purchased:
            return ({"message": "No purchased grocery items found."}, 400)
        expense_id = str(uuid.uuid4())
        payload = {"id": expense_id, "group_id": str(membership.household_id), "description": request.data.get("description", "Groceries"), "amount": amount, "date": date.today().isoformat(), "approval_status": "pending", "grocery_list_id": list_id, "updated_date": timezone.now().isoformat()}
        emit_change(membership.household_id, request.user, "expenses", expense_id, payload, "created")
        return ({"expenseId": expense_id, "amount": amount}, 201)

    return direct_operation(request, membership, "grocery.convert", apply)


@api_view(["POST"])
def invite_member(request):
    membership = require_membership(request, {"owner", "admin"})
    if not membership:
        return Response({"message": "Admin access denied."}, status=403)
    email = str(request.data.get("email", "")).strip().lower()
    if "@" not in email:
        return Response({"message": "A valid email is required."}, status=400)

    def apply():
        token = secrets.token_urlsafe(32)
        invitation = Invitation.objects.create(
            household=membership.household, email=email, role=request.data.get("role", "member"),
            token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=timezone.now() + timedelta(days=7),
            invited_by=request.user,
        )
        accept_url = f"{settings.APP_PUBLIC_URL}/invite/{token}"
        try:
            send_mail(f"Join {membership.household.name}", f"You were invited to join {membership.household.name}. Open {accept_url}", settings.DEFAULT_FROM_EMAIL, [email])
            invitation.sent_at = timezone.now(); invitation.save(update_fields=["sent_at"])
        except Exception:
            invitation.status = "failed"; invitation.save(update_fields=["status"])
            return ({"invitationId": str(invitation.id), "status": "failed"}, 502)
        payload = {"id": str(invitation.id), "group_id": str(membership.household_id), "email": email, "role": invitation.role, "status": invitation.status, "expires_at": invitation.expires_at.isoformat(), "updated_date": timezone.now().isoformat()}
        emit_change(membership.household_id, request.user, "invitations", str(invitation.id), payload, "invited")
        return ({"invitation": payload}, 201)

    return direct_operation(request, membership, "invitation.send", apply)


@api_view(["POST"])
@permission_classes([AllowAny])
def accept_invitation(request, token):
    if not request.user.is_authenticated:
        return Response({"message": "Sign in before accepting this invitation."}, status=401)
    invitation = Invitation.objects.select_related("household").filter(token_hash=hashlib.sha256(token.encode()).hexdigest(), status="pending", expires_at__gt=timezone.now()).first()
    if not invitation or invitation.email.lower() != request.user.email.lower():
        return Response({"message": "Invitation is invalid or expired."}, status=400)
    Membership.objects.update_or_create(household=invitation.household, user=request.user, defaults={"role": invitation.role})
    invitation.status = "accepted"; invitation.accepted_at = timezone.now(); invitation.save(update_fields=["status", "accepted_at"])
    return Response({"householdId": str(invitation.household_id), "status": "accepted"})


@api_view(["POST"])
def email_report(request):
    membership = require_membership(request, {"owner", "admin"})
    if not membership:
        return Response({"message": "Admin access denied."}, status=403)
    recipient = str(request.data.get("email", "")).strip().lower()
    if "@" not in recipient:
        return Response({"message": "A valid recipient email is required."}, status=400)

    def apply():
        expenses = SyncEntity.objects.filter(household=membership.household, entity_type="expenses", deleted_at__isnull=True)
        approved = [row.payload for row in expenses if row.payload.get("approval_status", "approved") == "approved"]
        total = round(sum(float(item.get("normalized_amount") or item.get("amount") or 0) for item in approved), 2)
        base_currency = request.data.get("currency", "USD")
        send_mail(f"{membership.household.name} expense report", f"Approved expenses: {len(approved)}\nTotal: {total:.2f} {base_currency}", settings.DEFAULT_FROM_EMAIL, [recipient])
        delivery_id = str(uuid.uuid4())
        payload = {"id": delivery_id, "group_id": str(membership.household_id), "email": recipient, "status": "sent", "total": total, "currency": base_currency, "updated_date": timezone.now().isoformat()}
        emit_change(membership.household_id, request.user, "report_deliveries", delivery_id, payload, "emailed")
        return ({"delivery": payload}, 201)

    return direct_operation(request, membership, "report.email", apply)
