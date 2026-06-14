from dataclasses import dataclass, field


@dataclass
class UserSession:
    user_id: int | None = None
    mode: str = "idle"
    support_thread_id: str | None = None
    menu_message_id: int | None = None
    bargain_session_id: int | None = None
    bargain_product_id: str | None = None
    bargain_category: str | None = None
    telegram_site_linked: bool = False
    telegram_link_session_id: str | None = None
    bargain_cart_items: list[dict] | None = None


_sessions: dict[int, UserSession] = {}


def get_session(chat_id: int) -> UserSession:
    if chat_id not in _sessions:
        _sessions[chat_id] = UserSession()
    return _sessions[chat_id]


def reset_bargain(session: UserSession) -> None:
    session.bargain_session_id = None
    session.bargain_product_id = None
    session.bargain_category = None
    session.bargain_cart_items = None
    if session.mode == "bargain":
        session.mode = "idle"
