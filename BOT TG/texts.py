PAGE_SIZE = 5


def escape_html(value) -> str:
    text = str(value or "")
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_catalog_page(products: list, page: int) -> tuple[list, int, str]:
    total_pages = max(1, (len(products) + PAGE_SIZE - 1) // PAGE_SIZE)
    safe_page = min(max(page, 0), total_pages - 1)
    slice_products = products[safe_page * PAGE_SIZE : safe_page * PAGE_SIZE + PAGE_SIZE]

    if not products:
        return [], 0, "Сейчас нет товаров в наличии. Подпишитесь на уведомления о пополнении 🔔"

    lines = [
        f"<b>🛍 Каталог PINKDROP</b> ({safe_page + 1}/{total_pages})",
        "",
    ]
    for index, product in enumerate(slice_products):
        number = safe_page * PAGE_SIZE + index + 1
        price = "FREE" if product.get("isFree") else f"{product['price']} ₽"
        lines.append(f"{number}. <b>{escape_html(product['name'])}</b> — {price}")

    lines.extend(["", "Нажмите номер товара ниже."])
    return slice_products, safe_page, "\n".join(lines)


def format_product_card(product: dict, frontend_url: str) -> str:
    url = f"{frontend_url}/product/{product['category']}/{product['id']}"
    stock = (
        f"В наличии: {product['stock']} шт"
        if isinstance(product.get("stock"), int)
        else "В наличии"
    )
    price = "БЕСПЛАТНО" if product.get("isFree") else f"{product['price']} ₽"
    description = escape_html((product.get("description") or "")[:180])
    return "\n".join(
        [
            f"<b>{escape_html(product['name'])}</b>",
            price,
            stock,
            description,
            f'<a href="{url}">Подробнее на сайте</a>',
        ]
    )


def format_cart(session) -> str:
    from storage import cart_total

    if not session.cart:
        return "🛒 Корзина пуста.\n\nОткройте каталог и добавьте товары."

    lines = ["<b>🛒 Ваша корзина</b>", ""]
    for index, item in enumerate(session.cart, start=1):
        amount = item.price * item.quantity
        lines.append(f"{index}. <b>{escape_html(item.name)}</b> × {item.quantity} — {amount} ₽")
    lines.extend(["", f"Итого: <b>{cart_total(session)} ₽</b>"])
    return "\n".join(lines)


def format_support_intro(thread: dict) -> str:
    return "\n".join(
        [
            "<b>💬 Поддержка PINKDROP</b>",
            "",
            f"Обращение <b>#{escape_html(thread.get('ticketNumber'))}</b> открыто.",
            "Напишите сообщение — оператор ответит здесь и на сайте.",
        ]
    )


def format_support_messages(thread: dict, messages: list) -> str:
    if not messages:
        return f"Обращение <b>#{escape_html(thread.get('ticketNumber'))}</b>\n\nПока нет сообщений."

    lines = [f"<b>Обращение #{escape_html(thread.get('ticketNumber'))}</b>", ""]
    for message in messages[-8:]:
        author = "Поддержка" if message.get("senderRole") == "admin" else "Вы"
        lines.append(f"<b>{author}:</b> {escape_html(message.get('body'))}")
    return "\n".join(lines)
