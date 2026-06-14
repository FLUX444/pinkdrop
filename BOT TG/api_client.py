import aiohttp

from config import config


class SiteApi:
    def __init__(self) -> None:
        self.base = config.api_url
        self.headers = {
            "Authorization": f"Bearer {config.bot_api_secret}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs):
        url = f"{self.base}{path}"
        async with aiohttp.ClientSession(headers=self.headers) as session:
            async with session.request(method, url, **kwargs) as response:
                payload = await response.json(content_type=None)
                if response.status >= 400:
                    if isinstance(payload, dict):
                        message = payload.get("error") or payload.get("message") or str(payload)
                    else:
                        message = str(payload)
                    raise RuntimeError(message or f"HTTP {response.status}")
                return payload

    async def ensure_user(self, telegram_user: dict, chat_id: int) -> dict:
        payload = await self._request(
            "POST",
            "/api/bot/users/ensure",
            json={"telegramUser": telegram_user, "chatId": chat_id},
        )
        return payload["user"]

    async def get_products(self) -> list:
        payload = await self._request("GET", "/api/bot/products")
        return payload.get("products", [])

    async def create_order(self, user_id: int, items: list, customer_name: str, phone: str, address: str) -> dict:
        return await self._request(
            "POST",
            "/api/bot/orders",
            json={
                "userId": user_id,
                "items": items,
                "customerName": customer_name,
                "phone": phone,
                "address": address,
            },
        )

    async def open_support_thread(self, user_id: int) -> dict:
        payload = await self._request("POST", "/api/bot/support/threads", json={"userId": user_id})
        return payload["thread"]

    async def send_support_message(self, user_id: int, thread_id: str, body: str) -> dict:
        return await self._request(
            "POST",
            "/api/bot/support/messages",
            json={"userId": user_id, "threadId": thread_id, "body": body},
        )

    async def get_support_messages(self, user_id: int, thread_id: str) -> dict:
        return await self._request(
            "GET",
            "/api/bot/support/messages",
            params={"userId": user_id, "threadId": thread_id},
        )

    async def is_restock_subscribed(self, chat_id: int) -> bool:
        payload = await self._request("GET", "/api/bot/restock/subscribed", params={"chatId": chat_id})
        return bool(payload.get("subscribed"))

    async def subscribe_restock(self, chat_id: int, telegram_user: dict) -> None:
        await self._request(
            "POST",
            "/api/bot/restock/subscribe",
            json={"chatId": chat_id, "telegramUser": telegram_user},
        )

    async def unsubscribe_restock(self, chat_id: int) -> None:
        await self._request("POST", "/api/bot/restock/unsubscribe", json={"chatId": chat_id})

    async def start_bargain(self, telegram_user: dict, chat_id: int, product_id: str, category: str) -> dict:
        return await self._request(
            "POST",
            "/api/bot/bargain/start",
            json={
                "telegramUser": telegram_user,
                "chatId": chat_id,
                "productId": product_id,
                "category": category,
            },
        )

    async def bargain_offer(self, telegram_user: dict, chat_id: int, message: str) -> dict:
        return await self._request(
            "POST",
            "/api/bot/bargain/offer",
            json={"telegramUser": telegram_user, "chatId": chat_id, "message": message},
        )

    async def bargain_accept(self, telegram_user: dict, chat_id: int) -> dict:
        return await self._request(
            "POST",
            "/api/bot/bargain/accept",
            json={"telegramUser": telegram_user, "chatId": chat_id},
        )

    async def bargain_reject(self, telegram_user: dict, chat_id: int) -> dict:
        return await self._request(
            "POST",
            "/api/bot/bargain/reject",
            json={"telegramUser": telegram_user, "chatId": chat_id},
        )

    async def bargain_cancel(self, telegram_user: dict, chat_id: int) -> dict:
        return await self._request(
            "POST",
            "/api/bot/bargain/cancel",
            json={"telegramUser": telegram_user, "chatId": chat_id},
        )

    async def get_cart_bargain_items(self, telegram_user: dict) -> dict:
        return await self._request(
            "POST",
            "/api/bot/cart/bargain-items",
            json={"telegramUser": telegram_user},
        )


    async def activate_telegram_link(self, telegram_user: dict, chat_id: int, session_id: str) -> dict:
        return await self._request(
            "POST",
            "/api/bot/telegram/link/activate",
            json={
                "telegramUser": telegram_user,
                "chatId": chat_id,
                "sessionId": session_id,
            },
        )

    async def register_telegram_link_message(self, session_id: str, message_id: int) -> None:
        await self._request(
            "POST",
            "/api/bot/telegram/link/register-message",
            json={"sessionId": session_id, "messageId": message_id},
        )

    async def get_telegram_link_status(self, session_id: str) -> dict:
        return await self._request(
            "GET",
            "/api/bot/telegram/link/status",
            params={"sessionId": session_id},
        )

    async def get_pending_telegram_link(self, chat_id: int) -> dict | None:
        payload = await self._request(
            "GET",
            "/api/bot/telegram/link/pending",
            params={"chatId": chat_id},
        )
        return payload.get("pending")

    async def mark_telegram_link_notified(self, session_id: str) -> None:
        await self._request(
            "POST",
            "/api/bot/telegram/link/notified",
            json={"sessionId": session_id},
        )


site_api = SiteApi()
