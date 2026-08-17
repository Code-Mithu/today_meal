import secrets
import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import AuditLog, Change, Household, Membership, SyncEntity, SyncOperation

User = get_user_model()
ENTITY_TYPES = {"groups", "members", "expenses", "contributions", "daily_meals", "daily_menus", "categories", "vendors", "group_settings"}
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
                Change.objects.create(household_id=household_id, sync_entity=current, entity_type=entity_type, entity_id=entity_id, payload=payload, version=current.version, deleted_at=deleted_at)
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
