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
]
