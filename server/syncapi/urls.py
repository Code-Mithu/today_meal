from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path("health", views.health, name="health"),
    path("auth/signup", views.signup, name="signup"),
    path("auth/login", views.login, name="login"),
    path("auth/refresh", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/logout", views.logout, name="logout"),
    path("auth/me", views.me, name="me"),
    path("households", views.households, name="households"),
    path("households/join", views.join_household, name="join-household"),
    path("sync/push", views.sync_push, name="sync-push"),
    path("sync/pull", views.sync_pull, name="sync-pull"),
    path("expenses/<str:expense_id>/approve", views.approval_action, {"decision": "approve"}, name="approve-expense"),
    path("expenses/<str:expense_id>/reject", views.approval_action, {"decision": "reject"}, name="reject-expense"),
    path("expenses/<str:expense_id>/receipt", views.receipt_detail, name="expense-receipt"),
    path("recurring/<str:rule_id>/generate", views.generate_recurring, name="generate-recurring"),
    path("groceries/<str:list_id>/to-expense", views.grocery_to_expense, name="grocery-to-expense"),
    path("invitations", views.invite_member, name="invite-member"),
    path("invitations/accept/<str:token>", views.accept_invitation, name="accept-invitation"),
    path("reports/email", views.email_report, name="email-report"),
]
