from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from .models import Membership


class HouseholdConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.household_id = str(self.scope["url_route"]["kwargs"]["household_id"])
        user = self.scope.get("user")
        if not user or not user.is_authenticated or not await self.can_join(user.id):
            await self.close(code=4403)
            return
        self.group_name = f"household_{self.household_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    @database_sync_to_async
    def can_join(self, user_id):
        return Membership.objects.filter(user_id=user_id, household_id=self.household_id).exists()

    async def disconnect(self, _code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def data_changed(self, event):
        await self.send_json({"type": "data.changed", "cursor": event.get("cursor")})
