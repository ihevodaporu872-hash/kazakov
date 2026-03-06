from sheets_client import read_api_keys, write_balances
from exchanges.bybit_client import get_bybit_balances

# Маппинг бирж на функции получения баланса
EXCHANGE_HANDLERS = {
    "bybit": get_bybit_balances,
}


def update_balances():
    """Основная функция: читает ключи, получает балансы, записывает в таблицу."""
    print("=== Обновление балансов ===")

    # 1. Читаем API ключи из Google Sheets
    api_keys = read_api_keys()
    if not api_keys:
        print("Нет API ключей в таблице. Добавьте ключи на лист 'API Keys'.")
        return

    print(f"Найдено {len(api_keys)} ключей")

    # 2. Получаем балансы со всех бирж
    all_balances = []
    for key_info in api_keys:
        exchange = key_info["exchange"]
        handler = EXCHANGE_HANDLERS.get(exchange)

        if handler is None:
            print(f"[{exchange}] Биржа не поддерживается, пропускаем")
            continue

        try:
            balances = handler(key_info["api_key"], key_info["api_secret"])
            all_balances.extend(balances)
        except Exception as e:
            print(f"[{exchange}] Ошибка при получении баланса: {e}")

    # 3. Записываем в Google Sheets
    if all_balances:
        write_balances(all_balances)
    else:
        print("Нет данных для записи")

    print("=== Готово ===")


if __name__ == "__main__":
    update_balances()
