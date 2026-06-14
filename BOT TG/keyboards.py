from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from config import config


def is_public_url(url: str) -> bool:
    lowered = url.lower()
    return not ("localhost" in lowered or "127.0.0.1" in lowered)


def get_site_open_url() -> str:
    if config.public_frontend_url:
        return config.public_frontend_url
    if is_public_url(config.frontend_url):
        return config.frontend_url
    return "https://pinkdrop.ru"


def get_store_channel_url() -> str:
    if config.store_channel_link:
        return config.store_channel_link
    if config.store_channel_username:
        return f"https://t.me/{config.store_channel_username}"
    channel_id = config.store_channel_id
    if channel_id.startswith("-100"):
        return f"https://t.me/c/{channel_id[4:]}"
    return ""


def get_support_contact_url() -> str:
    if config.support_contact_username:
        return f"https://t.me/{config.support_contact_username}"
    return ""


def back_button() -> InlineKeyboardButton:
    return InlineKeyboardButton(text="◀️ Назад", callback_data="menu:home")


def restock_button() -> InlineKeyboardButton:
    channel_url = get_store_channel_url()
    if channel_url:
        return InlineKeyboardButton(text="🔔 Подписаться", url=channel_url)
    return InlineKeyboardButton(text="🔔 Подписаться", callback_data="menu:sub")


def site_button() -> InlineKeyboardButton:
    return InlineKeyboardButton(text="🌐 Сайт", url=get_site_open_url())


def support_new_button() -> InlineKeyboardButton:
    support_url = get_support_contact_url()
    label = config.support_new_button or "✉️ Новое обращение"
    if support_url:
        return InlineKeyboardButton(text=label, url=support_url)
    return InlineKeyboardButton(text=label, callback_data="support:new")


def main_menu_keyboard(_subscribed: bool = False) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🤝 Торг", callback_data="menu:bargain"),
                InlineKeyboardButton(text="🔗 Привязка", callback_data="menu:link"),
            ],
            [
                InlineKeyboardButton(text="💬 Поддержка", callback_data="menu:support"),
                restock_button(),
            ],
            [site_button()],
        ]
    )


def support_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [support_new_button()],
            [back_button()],
        ]
    )


def bargain_chat_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Принять", callback_data="bargain:accept"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data="bargain:reject"),
            ],
            [InlineKeyboardButton(text="💬 Продолжить торг", callback_data="bargain:continue")],
            [InlineKeyboardButton(text="🏠 В главное меню", callback_data="bargain:end")],
        ]
    )


def bargain_keyboard() -> InlineKeyboardMarkup:
    return bargain_chat_keyboard()


def cart_pick_keyboard(items: list[dict]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for index, item in enumerate(items[:8]):
        label = str(item.get("name") or "Товар")[:28]
        site_discount = item.get("siteDiscount") or 0
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"{label} (−{site_discount}%)",
                    callback_data=f"bargain:pick:{index}",
                )
            ]
        )
    rows.append([back_button()])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def sub_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[back_button()]])


def proxy_keyboard(proxy_settings: dict | None = None) -> InlineKeyboardMarkup:
    from proxy_settings import is_proxy_configured_in_yaml, load_proxy_settings

    proxy_settings = proxy_settings or load_proxy_settings()
    proxy_status = "✅ ВКЛ" if proxy_settings.get("enabled") else "❌ ВЫКЛ"
    rows = []
    if not is_proxy_configured_in_yaml():
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"Переключить прокси ({proxy_status})",
                    callback_data="proxy:toggle",
                )
            ]
        )
    rows.append([back_button()])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def proxy_info_text() -> str:
    from proxy_settings import is_proxy_configured_in_yaml, load_proxy_settings, proxy_label

    settings = load_proxy_settings()
    yaml_note = (
        "\n\nНастройка задаётся в <code>config/pinkdrop.yaml</code> "
        "(раздел <code>bot.proxy.enabled</code>)."
        if is_proxy_configured_in_yaml()
        else "\n\nПереключатель доступен через команду /proxy."
    )
    return (
        "<b>🌐 Настройки прокси</b>\n\n"
        f"Адрес: <code>{settings.get('host', '127.0.0.1')}:{settings.get('port', 2080)}</code>\n"
        f"Статус: <b>{'включен' if settings.get('enabled') else 'выключен'}</b>\n\n"
        f"{proxy_label(settings)}"
        f"{yaml_note}"
    )
