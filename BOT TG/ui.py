from pathlib import Path

from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import FSInputFile, InlineKeyboardMarkup, Message

from storage import UserSession

MENU_BANNER_PATH = Path(__file__).resolve().parent / "assets" / "menu_banner.png"


async def delete_message_safe(bot, chat_id: int, message_id: int | None) -> None:
    if not message_id:
        return
    try:
        await bot.delete_message(chat_id, message_id)
    except TelegramBadRequest:
        pass
    except Exception:
        pass


async def cleanup_user_message(message: Message) -> None:
    try:
        await message.delete()
    except Exception:
        await delete_message_safe(message.bot, message.chat.id, message.message_id)


async def strip_message_keyboard(bot, chat_id: int, message_id: int | None) -> None:
    if not message_id:
        return
    try:
        await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=None)
    except TelegramBadRequest:
        pass
    except Exception:
        pass


async def show_screen(
    bot,
    *,
    chat_id: int,
    session: UserSession,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    edit_message: Message | None = None,
) -> Message | None:
    """Один экран в чате: редактирует текущее меню или заменяет предыдущее."""
    if edit_message is not None:
        try:
            await edit_message.edit_text(
                text,
                parse_mode=ParseMode.HTML,
                reply_markup=reply_markup,
            )
            if session.menu_message_id and session.menu_message_id != edit_message.message_id:
                await delete_message_safe(bot, chat_id, session.menu_message_id)
            session.menu_message_id = edit_message.message_id
            return edit_message
        except TelegramBadRequest as error:
            error_text = str(error).lower()
            if "message is not modified" in error_text:
                session.menu_message_id = edit_message.message_id
                return edit_message
            await delete_message_safe(bot, chat_id, edit_message.message_id)

    if session.menu_message_id:
        await delete_message_safe(bot, chat_id, session.menu_message_id)
        session.menu_message_id = None

    sent = await bot.send_message(
        chat_id,
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=reply_markup,
    )
    session.menu_message_id = sent.message_id
    return sent


async def show_main_menu_screen(
    bot,
    *,
    chat_id: int,
    session: UserSession,
    caption: str = "",
    reply_markup: InlineKeyboardMarkup | None = None,
    edit_message: Message | None = None,
) -> Message | None:
    """Главное меню: баннер с логотипом и inline-кнопки."""
    if edit_message is not None:
        await delete_message_safe(bot, chat_id, edit_message.message_id)

    if session.menu_message_id:
        await delete_message_safe(bot, chat_id, session.menu_message_id)
        session.menu_message_id = None

    sent = await bot.send_photo(
        chat_id,
        FSInputFile(MENU_BANNER_PATH),
        caption=caption or None,
        parse_mode=ParseMode.HTML,
        reply_markup=reply_markup,
    )
    session.menu_message_id = sent.message_id
    return sent


def can_accept_user_text(session: UserSession) -> bool:
    return session.mode == "bargain"
