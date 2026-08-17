from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication


class JwtQueryAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]
        scope["user"] = await self.authenticate(token)
        return await self.app(scope, receive, send)

    @database_sync_to_async
    def authenticate(self, token):
        if not token:
            return AnonymousUser()
        try:
            auth = JWTAuthentication()
            validated = auth.get_validated_token(token)
            return auth.get_user(validated)
        except Exception:
            return AnonymousUser()
