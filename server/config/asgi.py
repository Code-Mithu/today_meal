import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from syncapi.routing import websocket_urlpatterns
from syncapi.websocket_auth import JwtQueryAuthMiddleware

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JwtQueryAuthMiddleware(AuthMiddlewareStack(URLRouter(websocket_urlpatterns))),
})
