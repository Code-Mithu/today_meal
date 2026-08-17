import uuid
from django.conf import settings
from django.db import models


class Household(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    join_code = models.CharField(max_length=12, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Membership(models.Model):
    ROLES = [("owner", "Owner"), ("admin", "Admin"), ("member", "Member")]
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="household_memberships")
    role = models.CharField(max_length=16, choices=ROLES, default="member")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["household", "user"], name="unique_household_member")]


class SyncEntity(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="entities")
    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=128)
    payload = models.JSONField(default=dict)
    version = models.PositiveBigIntegerField(default=1)
    client_updated_at = models.DateTimeField()
    winning_operation_id = models.CharField(max_length=128)
    deleted_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["household", "entity_type", "entity_id"], name="unique_synced_entity")]


class SyncOperation(models.Model):
    operation_id = models.CharField(max_length=128, primary_key=True)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    accepted = models.BooleanField()
    response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class Change(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="changes")
    sync_entity = models.ForeignKey(SyncEntity, on_delete=models.CASCADE)
    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=128)
    payload = models.JSONField(default=dict)
    version = models.PositiveBigIntegerField()
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="audit_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=32)
    entity_type = models.CharField(max_length=40)
    entity_id = models.CharField(max_length=128)
    previous_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DirectOperation(models.Model):
    operation_id = models.CharField(max_length=128)
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=64)
    response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["household", "operation_id"], name="unique_direct_operation")]


class Receipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="receipts")
    expense_id = models.CharField(max_length=128)
    image = models.ImageField(upload_to="receipts/%Y/%m/")
    content_type = models.CharField(max_length=80)
    size = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["household", "expense_id"])]


class Invitation(models.Model):
    STATUS = [("pending", "Pending"), ("accepted", "Accepted"), ("revoked", "Revoked"), ("failed", "Failed")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=16, choices=Membership.ROLES, default="member")
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=STATUS, default="pending")
    expires_at = models.DateTimeField()
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["household", "email", "status"])]


class RecurrenceOccurrence(models.Model):
    household = models.ForeignKey(Household, on_delete=models.CASCADE)
    rule_id = models.CharField(max_length=128)
    occurrence_date = models.DateField()
    expense_id = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["household", "rule_id", "occurrence_date"], name="unique_recurrence_occurrence")]
