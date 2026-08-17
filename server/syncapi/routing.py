from django.urls import re_path

from .consumers import HouseholdConsumer

websocket_urlpatterns = [
    re_path(r"^ws/households/(?P<household_id>[0-9a-f-]+)/?$", HouseholdConsumer.as_asgi()),
]
