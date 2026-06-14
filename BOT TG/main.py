import asyncio
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.enums import ChatAction
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, CallbackQuery, MenuButtonCommands, Message, User

from process_guard import kill_other_bot_instances
from api_client import site_api
from config import assert_config, config
from keyboards import (
    bargain_keyboard,
    cart_pick_keyboard,
    get_site_open_url,
    main_menu_keyboard,
    proxy_info_text,
    proxy_keyboard,
    sub_menu_keyboard,
    support_keyboard,
)
from proxy_settings import build_proxy_url, load_proxy_settings, toggle_proxy_enabled
from monitor import (
    handle_runtime_failure,
    install_bot_monitoring,
    log_self_heal,
    mark_bot_restart,
    send_bot_log,
    start_heartbeat,
)
from storage import UserSession, get_session, reset_bargain
from ui import (
    can_accept_user_text,
    cleanup_user_message,
    delete_message_safe,
    show_main_menu_screen,
    show_screen,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pinkdrop-bot")

restart_event = asyncio.Event()
_link_watch_tasks: dict[int, asyncio.Task] = {}


def telegram_user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
    }


def is_bargain_cart_deeplink(args: str | None) -> bool:
    return args in ("bargain_cart", "cart")


def parse_bargain_deeplink(args: str | None) -> tuple[str, str] | None:
    if not args or not args.startswith("bargain_"):
        return None
    payload = args[len("bargain_") :]
    if payload == "cart":
        return None
    if "__" not in payload:
        return None
    category, product_id = payload.split("__", 1)
    if not category or not product_id:
        return None
    return category, product_id


async def ensure_site_user(chat_id: int, user: User) -> dict | None:
    session = get_session(chat_id)
    try:
        site_user = await site_api.ensure_user(telegram_user_dict(user), chat_id)
        session.user_id = int(site_user["id"])
        session.telegram_site_linked = bool(site_user.get("telegramSiteLinked"))
        return site_user
    except Exception as error:
        logger.error("API ensure_user failed: %s", error)
        return None


async def get_subscribed(chat_id: int) -> bool:
    try:
        return await site_api.is_restock_subscribed(chat_id)
    except Exception:
        return False


async def show_main_menu(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    *,
    text: str = "",
    edit_message: Message | None = None,
    subscribed: bool | None = None,
) -> None:
    if subscribed is None:
        subscribed = await get_subscribed(chat_id)
    caption = text.strip() or None
    if caption:
        caption = f"<b>{caption}</b>" if not caption.startswith("<") else caption
    await show_main_menu_screen(
        bot,
        chat_id=chat_id,
        session=session,
        caption=caption or "",
        reply_markup=main_menu_keyboard(subscribed),
        edit_message=edit_message,
    )


async def show_bargain_reply(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    text: str,
    *,
    edit_message: Message | None = None,
) -> None:
    await bot.send_chat_action(chat_id, ChatAction.TYPING)
    await asyncio.sleep(0.7)
    await show_screen(
        bot,
        chat_id=chat_id,
        session=session,
        text=text,
        reply_markup=bargain_keyboard(),
        edit_message=edit_message,
    )


async def handle_bargain_result(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    result: dict,
    *,
    edit_message: Message | None = None,
) -> None:
    if result.get("status") == "sold_out" or result.get("code") == "sold_out":
        session.mode = "idle"
        reset_bargain(session)
        await show_screen(
            bot,
            chat_id=chat_id,
            session=session,
            text=result.get("message", "Товар закончился"),
            reply_markup=None,
            edit_message=edit_message,
        )
        await asyncio.sleep(2.5)
        await show_main_menu(bot, chat_id, session)
        return

    if result.get("status") == "completed":
        await finish_bargain_deal(bot, chat_id, session, result, edit_message=edit_message)
        return

    await show_bargain_reply(
        bot,
        chat_id,
        session,
        result.get("message", "Продолжаем торг..."),
        edit_message=edit_message,
    )


async def finish_bargain_deal(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    result: dict,
    *,
    edit_message: Message | None = None,
) -> None:
    session.mode = "idle"
    reset_bargain(session)
    await show_screen(
        bot,
        chat_id=chat_id,
        session=session,
        text=result.get("message", "Сделка заключена!"),
        reply_markup=None,
        edit_message=edit_message,
    )
    await asyncio.sleep(2.5)
    await show_main_menu(bot, chat_id, session)


async def start_bargain_flow(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    user: User,
    category: str,
    product_id: str,
    *,
    edit_message: Message | None = None,
) -> None:
    await ensure_site_user(chat_id, user)

    try:
        result = await site_api.start_bargain(
            telegram_user_dict(user),
            chat_id,
            product_id,
            category,
        )
    except RuntimeError as error:
        session.mode = "idle"
        reset_bargain(session)
        await show_screen(
            bot,
            chat_id=chat_id,
            session=session,
            text=str(error),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    if not result.get("ok"):
        session.mode = "idle"
        reset_bargain(session)
        await show_screen(
            bot,
            chat_id=chat_id,
            session=session,
            text=result.get("message", "Торг недоступен"),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    session.mode = "bargain"
    session.bargain_session_id = int(result.get("sessionId") or 0)
    session.bargain_product_id = product_id
    session.bargain_category = category
    await show_bargain_reply(
        bot,
        chat_id,
        session,
        result.get("message", "Торг начат"),
        edit_message=edit_message,
    )


async def start_cart_bargain_flow(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    user: User,
    *,
    edit_message: Message | None = None,
) -> None:
    await ensure_site_user(chat_id, user)

    try:
        payload = await site_api.get_cart_bargain_items(telegram_user_dict(user))
    except RuntimeError as error:
        await show_screen(
            bot,
            chat_id=chat_id,
            session=session,
            text=str(error),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    items = payload.get("items") or []
    if not items:
        await show_screen(
            bot,
            chat_id=chat_id,
            session=session,
            text=(
                "🛒 <b>Корзина пуста</b> или все товары уже с максимальной скидкой −28%.\n\n"
                "Добавьте товары на сайте и вернитесь сюда."
            ),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    if len(items) == 1:
        item = items[0]
        await start_bargain_flow(
            bot,
            chat_id,
            session,
            user,
            item["category"],
            item["productId"],
            edit_message=edit_message,
        )
        return

    session.bargain_cart_items = items
    lines = ["🤝 <b>Выберите товар из корзины для торга:</b>", ""]
    for index, item in enumerate(items[:8], start=1):
        lines.append(
            f"{index}. <b>{item.get('name')}</b> — {item.get('currentPrice')} ₽ (−{item.get('siteDiscount', 0)}%)"
        )
    await show_screen(
        bot,
        chat_id=chat_id,
        session=session,
        text="\n".join(lines),
        reply_markup=cart_pick_keyboard(items),
        edit_message=edit_message,
    )


def parse_auth_deeplink(args: str | None) -> str | None:
    if not args or not args.startswith("login_"):
        return None
    session_id = args[len("login_") :].strip()
    if len(session_id) != 32:
        return None
    return session_id


def parse_link_deeplink(args: str | None) -> str | None:
    if not args or not args.startswith("link_"):
        return None
    session_id = args[len("link_") :].strip()
    if len(session_id) != 32:
        return None
    return session_id


def cancel_link_watch(chat_id: int) -> None:
    task = _link_watch_tasks.pop(chat_id, None)
    if task and not task.done():
        task.cancel()


async def complete_telegram_link_flow(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    result: dict,
    session_id: str,
) -> None:
    cancel_link_watch(chat_id)
    session.mode = "idle"
    session.telegram_link_session_id = None
    session.telegram_site_linked = True

    first_name = result.get("firstName") or "друг"
    await show_screen(
        bot,
        chat_id=chat_id,
        session=session,
        text=result.get("message", "✅ Telegram успешно привязан!"),
        reply_markup=None,
    )
    await asyncio.sleep(2.5)
    await show_main_menu(
        bot,
        chat_id,
        session,
        text=f"<b>Добро пожаловать в PINKDROP, {first_name}!</b>",
    )

    try:
        await site_api.mark_telegram_link_notified(session_id)
    except Exception as error:
        logger.warning("Failed to mark telegram link notified: %s", error)


async def check_pending_telegram_link_completion(bot: Bot, chat_id: int, session: UserSession) -> bool:
    try:
        pending = await site_api.get_pending_telegram_link(chat_id)
    except Exception as error:
        logger.debug("Pending telegram link check failed: %s", error)
        return False

    if not pending or pending.get("notified"):
        return False

    await complete_telegram_link_flow(
        bot,
        chat_id,
        session,
        pending,
        pending["sessionId"],
    )
    return True


async def watch_telegram_link_completion(
    bot: Bot,
    chat_id: int,
    session: UserSession,
    session_id: str,
) -> None:
    try:
        for _ in range(600):
            if session.mode != "telegram_link" or session.telegram_link_session_id != session_id:
                return

            try:
                status = await site_api.get_telegram_link_status(session_id)
            except Exception as error:
                logger.debug("Telegram link status poll failed: %s", error)
                await asyncio.sleep(2)
                continue

            if status.get("status") == "linked" and not status.get("notified"):
                await complete_telegram_link_flow(bot, chat_id, session, status, session_id)
                return

            if status.get("status") in ("expired", "not_found"):
                session.mode = "idle"
                session.telegram_link_session_id = None
                await show_screen(
                    bot,
                    chat_id=chat_id,
                    session=session,
                    text=status.get(
                        "message",
                        "Привязка истекла. Нажмите «Привязать Telegram» на сайте ещё раз.",
                    ),
                    reply_markup=sub_menu_keyboard(),
                )
                return

            await asyncio.sleep(2)
    except asyncio.CancelledError:
        return


def start_link_watch(bot: Bot, chat_id: int, session: UserSession, session_id: str) -> None:
    cancel_link_watch(chat_id)
    _link_watch_tasks[chat_id] = asyncio.create_task(
        watch_telegram_link_completion(bot, chat_id, session, session_id)
    )


async def start_telegram_auth_flow(
    bot: Bot,
    message: Message,
    session_id: str,
    *,
    edit_message: Message | None = None,
) -> None:
    session = get_session(message.chat.id)
    session.mode = "idle"
    reset_bargain(session)

    try:
        result = await site_api.activate_telegram_auth(
            telegram_user_dict(message.from_user),
            message.chat.id,
            session_id,
        )
    except RuntimeError as error:
        await show_screen(
            bot,
            chat_id=message.chat.id,
            session=session,
            text=str(error),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    if not result.get("ok"):
        await show_screen(
            bot,
            chat_id=message.chat.id,
            session=session,
            text=result.get("message", "Вход недоступен"),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    await show_screen(
        bot,
        chat_id=message.chat.id,
        session=session,
        text=result.get("message", "Код отправлен"),
        reply_markup=None,
        edit_message=edit_message,
    )


async def start_telegram_link_flow(
    bot: Bot,
    message: Message,
    session_id: str,
    *,
    edit_message: Message | None = None,
) -> None:
    session = get_session(message.chat.id)
    session.mode = "telegram_link"
    session.telegram_link_session_id = session_id
    reset_bargain(session)

    try:
        result = await site_api.activate_telegram_link(
            telegram_user_dict(message.from_user),
            message.chat.id,
            session_id,
        )
    except RuntimeError as error:
        session.mode = "idle"
        session.telegram_link_session_id = None
        await show_screen(
            bot,
            chat_id=message.chat.id,
            session=session,
            text=str(error),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    if not result.get("ok"):
        session.mode = "idle"
        session.telegram_link_session_id = None
        await show_screen(
            bot,
            chat_id=message.chat.id,
            session=session,
            text=result.get("message", "Привязка недоступна"),
            reply_markup=sub_menu_keyboard(),
            edit_message=edit_message,
        )
        return

    if result.get("alreadyLinked"):
        session.mode = "idle"
        session.telegram_link_session_id = None
        cancel_link_watch(message.chat.id)
        await show_screen(
            bot,
            chat_id=message.chat.id,
            session=session,
            text=result.get("message", "Telegram уже привязан"),
            reply_markup=None,
            edit_message=edit_message,
        )
        await asyncio.sleep(2.5)
        await show_main_menu(
            bot,
            message.chat.id,
            session,
            text=f"<b>Добро пожаловать в PINKDROP, {message.from_user.first_name or 'друг'}!</b>",
        )
        return

    sent = await show_screen(
        bot,
        chat_id=message.chat.id,
        session=session,
        text=result.get("message", "Код отправлен"),
        reply_markup=None,
        edit_message=edit_message,
    )

    if sent and session_id:
        try:
            await site_api.register_telegram_link_message(session_id, sent.message_id)
        except Exception as error:
            logger.warning("Failed to register link message id: %s", error)

    start_link_watch(bot, message.chat.id, session, session_id)


def register_handlers(dp: Dispatcher) -> None:
    @dp.errors()
    async def on_error(event) -> bool:
        logger.exception("Handler error: %s", event.exception)
        update = event.update
        if update.message:
            session = get_session(update.message.chat.id)
            await show_screen(
                update.message.bot,
                chat_id=update.message.chat.id,
                session=session,
                text=(
                    "⚠️ Произошла ошибка. Проверьте что сервер запущен: "
                    "<code>npm run dev:server</code>"
                ),
            )
        elif update.callback_query:
            await update.callback_query.answer("Ошибка. Запустите сервер сайта.", show_alert=True)
        return True

    @dp.message(CommandStart())
    async def cmd_start(message: Message, command: CommandObject) -> None:
        session = get_session(message.chat.id)
        session.mode = "idle"
        reset_bargain(session)

        bargain = parse_bargain_deeplink(command.args)
        if bargain:
            category, product_id = bargain
            await start_bargain_flow(
                message.bot,
                message.chat.id,
                session,
                message.from_user,
                category,
                product_id,
            )
            await cleanup_user_message(message)
            return

        if is_bargain_cart_deeplink(command.args):
            await start_cart_bargain_flow(
                message.bot,
                message.chat.id,
                session,
                message.from_user,
            )
            await cleanup_user_message(message)
            return

        auth_session_id = parse_auth_deeplink(command.args)
        if auth_session_id:
            await start_telegram_auth_flow(message.bot, message, auth_session_id)
            await cleanup_user_message(message)
            return

        link_session_id = parse_link_deeplink(command.args)
        if link_session_id:
            await start_telegram_link_flow(message.bot, message, link_session_id)
            await cleanup_user_message(message)
            return

        user = await ensure_site_user(message.chat.id, message.from_user)
        if await check_pending_telegram_link_completion(message.bot, message.chat.id, session):
            await cleanup_user_message(message)
            return

        server_hint = ""
        if user is None:
            server_hint = (
                "\n\n⚠️ <b>Сервер не отвечает.</b> Запустите в терминале из папки <code>S:\\site</code>:\n"
                "<code>npm run dev:server</code>"
            )

        await show_main_menu(
            message.bot,
            message.chat.id,
            session,
            text="\n".join(
                [
                    f"<b>Добро пожаловать, {message.from_user.first_name or (user or {}).get('name', 'друг')}!</b>",
                    server_hint,
                ]
            ).strip(),
        )
        await cleanup_user_message(message)

    @dp.message(Command("menu"))
    async def cmd_menu(message: Message) -> None:
        await ensure_site_user(message.chat.id, message.from_user)
        session = get_session(message.chat.id)
        if await check_pending_telegram_link_completion(message.bot, message.chat.id, session):
            await cleanup_user_message(message)
            return
        session.mode = "idle"
        reset_bargain(session)
        await show_main_menu(message.bot, message.chat.id, session)
        await cleanup_user_message(message)

    @dp.message(Command("proxy"))
    async def cmd_proxy(message: Message) -> None:
        session = get_session(message.chat.id)
        await show_screen(
            message.bot,
            chat_id=message.chat.id,
            session=session,
            text=proxy_info_text(),
            reply_markup=proxy_keyboard(load_proxy_settings()),
        )
        await cleanup_user_message(message)

    @dp.callback_query(F.data == "menu:home")
    async def menu_home(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        session.mode = "idle"
        reset_bargain(session)
        await show_main_menu(
            callback.bot,
            callback.message.chat.id,
            session,
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "menu:bargain")
    async def menu_bargain(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        await start_cart_bargain_flow(
            callback.bot,
            callback.message.chat.id,
            session,
            callback.from_user,
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "menu:link")
    async def menu_link(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        user = await ensure_site_user(callback.message.chat.id, callback.from_user)
        if not user:
            await callback.answer("Сервер недоступен", show_alert=True)
            return

        if user.get("telegramSiteLinked"):
            handle = user.get("telegramUsername") or user.get("name") or "Telegram"
            if handle and not str(handle).startswith("@"):
                handle = f"@{handle}" if user.get("telegramUsername") else handle
            text = "\n".join(
                [
                    "✅ <b>Telegram привязан к сайту</b>",
                    "",
                    f"Аккаунт: <b>{handle}</b>",
                    "Можно торговаться с ботом и получать скидки.",
                ]
            )
        else:
            text = "\n".join(
                [
                    "❌ <b>Telegram не привязан к сайту</b>",
                    "",
                    "Откройте личный кабинет на сайте и нажмите «Привязать Telegram».",
                ]
            )

        await show_screen(
            callback.bot,
            chat_id=callback.message.chat.id,
            session=session,
            text=text,
            reply_markup=sub_menu_keyboard(),
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "proxy:toggle")
    async def proxy_toggle(callback: CallbackQuery) -> None:
        settings = toggle_proxy_enabled()
        await callback.answer(
            f"Прокси {'включен' if settings['enabled'] else 'выключен'}",
            show_alert=True,
        )
        session = get_session(callback.message.chat.id)
        await show_screen(
            callback.bot,
            chat_id=callback.message.chat.id,
            session=session,
            text="\n".join(
                [
                    proxy_info_text(),
                    "",
                    "♻️ Перезапускаю подключение к Telegram...",
                ]
            ),
            reply_markup=proxy_keyboard(settings),
            edit_message=callback.message,
        )
        restart_event.set()

    @dp.callback_query(F.data == "menu:support")
    async def menu_support(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        session.mode = "idle"
        reset_bargain(session)
        session.support_thread_id = None
        from config import config as bot_config

        await show_screen(
            callback.bot,
            chat_id=callback.message.chat.id,
            session=session,
            text=bot_config.support_intro,
            reply_markup=support_keyboard(),
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "support:new")
    async def support_new(callback: CallbackQuery) -> None:
        from keyboards import get_support_contact_url

        support_url = get_support_contact_url()
        if support_url:
            await callback.answer(url=support_url)
            return
        await callback.answer("Контакт поддержки не настроен в config/pinkdrop.yaml", show_alert=True)

    @dp.callback_query(F.data == "menu:sub")
    async def menu_sub(callback: CallbackQuery) -> None:
        from keyboards import get_store_channel_url

        channel_url = get_store_channel_url()
        if channel_url:
            await callback.answer(url=channel_url)
        else:
            await callback.answer("Канал пополнений не настроен", show_alert=True)

    @dp.callback_query(F.data == "menu:unsub")
    async def menu_unsub(callback: CallbackQuery) -> None:
        await callback.answer(
            "Чтобы отписаться, выйдите из канала пополнений в Telegram.",
            show_alert=True,
        )

    @dp.callback_query(F.data.startswith("bargain:pick:"))
    async def bargain_pick(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        items = session.bargain_cart_items or []
        try:
            index = int(callback.data.split(":")[-1])
        except ValueError:
            index = -1
        if index < 0 or index >= len(items):
            await show_screen(
                callback.bot,
                chat_id=callback.message.chat.id,
                session=session,
                text="Товар не найден. Выберите снова.",
                reply_markup=sub_menu_keyboard(),
                edit_message=callback.message,
            )
            return
        item = items[index]
        await start_bargain_flow(
            callback.bot,
            callback.message.chat.id,
            session,
            callback.from_user,
            item["category"],
            item["productId"],
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "bargain:end")
    async def bargain_end(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        try:
            await site_api.bargain_cancel(
                telegram_user_dict(callback.from_user),
                callback.message.chat.id,
            )
        except RuntimeError:
            pass
        session.mode = "idle"
        reset_bargain(session)
        await show_main_menu(
            callback.bot,
            callback.message.chat.id,
            session,
            text="Торг завершён. Главное меню PINKDROP",
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "bargain:accept")
    async def bargain_accept(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        try:
            result = await site_api.bargain_accept(
                telegram_user_dict(callback.from_user),
                callback.message.chat.id,
            )
        except RuntimeError as error:
            await show_screen(
                callback.bot,
                chat_id=callback.message.chat.id,
                session=session,
                text=str(error),
                reply_markup=bargain_keyboard(),
                edit_message=callback.message,
            )
            return

        if not result.get("ok"):
            if result.get("code") == "sold_out":
                await handle_bargain_result(
                    callback.bot,
                    callback.message.chat.id,
                    session,
                    result,
                    edit_message=callback.message,
                )
                return
            session.mode = "idle"
            reset_bargain(session)
            await show_main_menu(
                callback.bot,
                callback.message.chat.id,
                session,
                text=result.get("message", "Не удалось принять предложение"),
                edit_message=callback.message,
            )
            return

        await handle_bargain_result(
            callback.bot,
            callback.message.chat.id,
            session,
            result,
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "bargain:reject")
    async def bargain_reject(callback: CallbackQuery) -> None:
        await callback.answer()
        session = get_session(callback.message.chat.id)
        try:
            result = await site_api.bargain_reject(
                telegram_user_dict(callback.from_user),
                callback.message.chat.id,
            )
        except RuntimeError as error:
            await show_bargain_reply(
                callback.bot,
                callback.message.chat.id,
                session,
                str(error),
                edit_message=callback.message,
            )
            return

        await handle_bargain_result(
            callback.bot,
            callback.message.chat.id,
            session,
            result,
            edit_message=callback.message,
        )

    @dp.callback_query(F.data == "bargain:continue")
    async def bargain_continue(callback: CallbackQuery) -> None:
        await callback.answer("Напишите новую скидку или цену")
        session = get_session(callback.message.chat.id)
        session.mode = "bargain"
        await show_bargain_reply(
            callback.bot,
            callback.message.chat.id,
            session,
            "💬 Напишите, какую скидку хотите (например <code>27%</code>) или цену в рублях.",
            edit_message=callback.message,
        )

    @dp.message(F.text)
    async def handle_text(message: Message) -> None:
        if message.text.startswith("/"):
            await cleanup_user_message(message)
            return

        session = get_session(message.chat.id)
        text = message.text.strip()

        if not can_accept_user_text(session):
            await delete_message_safe(message.bot, message.chat.id, message.message_id)
            return

        await ensure_site_user(message.chat.id, message.from_user)
        await delete_message_safe(message.bot, message.chat.id, message.message_id)

        if session.mode == "bargain":
            try:
                result = await site_api.bargain_offer(
                    telegram_user_dict(message.from_user),
                    message.chat.id,
                    text,
                )
            except RuntimeError as error:
                await show_bargain_reply(
                    message.bot,
                    message.chat.id,
                    session,
                    str(error),
                )
                return

            await handle_bargain_result(message.bot, message.chat.id, session, result)
            return

    @dp.message(~F.text)
    async def handle_non_text(message: Message) -> None:
        session = get_session(message.chat.id)
        if can_accept_user_text(session):
            return
        await delete_message_safe(message.bot, message.chat.id, message.message_id)


def build_bot() -> Bot:
    proxy_url = build_proxy_url()
    if proxy_url:
        logger.info("Telegram proxy enabled: %s", proxy_url)
        session = AiohttpSession(proxy=proxy_url)
    else:
        logger.info("Telegram proxy disabled")
        session = AiohttpSession()
    return Bot(token=config.bot_token, session=session)


async def setup_bot_ui(bot: Bot) -> None:
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Главное меню"),
            BotCommand(command="menu", description="Открыть меню"),
        ]
    )
    await bot.set_chat_menu_button(menu_button=MenuButtonCommands())


async def verify_startup(bot: Bot) -> None:
    try:
        me = await bot.get_me()
        logger.info("Telegram connected: @%s", me.username)
        await setup_bot_ui(bot)
        logger.info("Site button URL: %s", get_site_open_url())
    except Exception as error:
        logger.error("Cannot reach Telegram API: %s", error)
        raise RuntimeError(
            "Не удалось подключиться к Telegram. Включите VPN/прокси 127.0.0.1:2080 "
            "или нажмите кнопку «Прокси» в боте после запуска."
        ) from error

    try:
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(f"{config.api_url}/api/health", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status != 200:
                    logger.warning("Site API health check failed: HTTP %s", resp.status)
                else:
                    logger.info("Site API ready: %s", config.api_url)
        async with aiohttp.ClientSession(headers=site_api.headers) as session:
            async with session.get(f"{config.api_url}/api/bot/products", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                if resp.status == 404:
                    logger.warning("Bot API not found — перезапустите сервер: npm run dev:server")
                elif resp.status >= 400:
                    logger.warning("Bot API error: HTTP %s", resp.status)
                else:
                    logger.info("Bot API ready")
    except Exception as error:
        logger.warning("Site API check failed: %s — запустите npm run dev:server", error)


async def run_polling_once() -> bool:
    proxy_settings = load_proxy_settings()
    start_heartbeat(bool(proxy_settings.get("enabled")))

    bot = build_bot()
    await verify_startup(bot)
    await send_bot_log("Сессия polling запущена", details={"api": config.api_url})
    dp = Dispatcher(storage=MemoryStorage())
    register_handlers(dp)

    polling_task = asyncio.create_task(dp.start_polling(bot))
    restart_task = asyncio.create_task(restart_event.wait())

    done, pending = await asyncio.wait(
        {polling_task, restart_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    for task in done:
        if task is polling_task and not task.cancelled():
            exc = task.exception()
            if exc is not None:
                should_retry = await handle_runtime_failure(exc, context="polling")
                await dp.stop_polling()
                await bot.session.close()
                if should_retry:
                    mark_bot_restart()
                    await log_self_heal("Polling перезапускается после ошибки", details=str(exc))
                    return True
                raise exc

    await dp.stop_polling()
    await bot.session.close()
    return restart_event.is_set()


async def main() -> None:
    assert_config()
    kill_other_bot_instances()
    install_bot_monitoring()
    logger.info("PINKDROP bot starting (API %s, menu=v2-cart)", config.api_url)
    await send_bot_log("PINKDROP bot starting", details={"api": config.api_url})

    while True:
        restart_event.clear()
        try:
            should_restart = await run_polling_once()
        except Exception as error:
            should_restart = await handle_runtime_failure(error, context="main")
            mark_bot_restart()
            if not should_restart:
                await send_bot_log("Бот остановлен из-за критической ошибки", level="critical", details=str(error))
                raise
            await log_self_heal("Бот перезапускается после критической ошибки", details=str(error))
        if not should_restart:
            await send_bot_log("Бот остановлен штатно", level="info")
            break
        logger.info("Restarting bot after proxy toggle...")
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
