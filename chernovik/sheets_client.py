import gspread
from datetime import datetime
from config import SPREADSHEET_NAME, SHEET_API_KEYS, SHEET_BALANCES, SERVICE_ACCOUNT_FILE


def get_client():
    """Подключение к Google Sheets через сервисный аккаунт."""
    return gspread.service_account(filename=SERVICE_ACCOUNT_FILE)


def read_api_keys():
    """
    Читает API ключи с листа "API Keys".
    Ожидаемый формат таблицы:
      A: Биржа | B: API Key | C: API Secret
    Первая строка — заголовки.
    Возвращает список словарей: [{exchange, api_key, api_secret}]
    """
    gc = get_client()
    sh = gc.open(SPREADSHEET_NAME)
    ws = sh.worksheet(SHEET_API_KEYS)

    rows = ws.get_all_records()
    keys = []
    for row in rows:
        exchange = row.get("exchange", "").strip().lower()
        api_key = row.get("api_key", "").strip()
        api_secret = row.get("api_secret", "").strip()
        if exchange and api_key and api_secret:
            keys.append({
                "exchange": exchange,
                "api_key": api_key,
                "api_secret": api_secret,
            })
    return keys


def write_balances(balances):
    """
    Записывает балансы на лист "Balances".
    Очищает лист и записывает заново.

    balances — список словарей:
      [{exchange, coin, wallet_balance, available, usd_value}]
    """
    gc = get_client()
    sh = gc.open(SPREADSHEET_NAME)
    ws = sh.worksheet(SHEET_BALANCES)

    # Заголовки
    headers = ["exchange", "coin", "wallet_balance", "available", "usd_value", "updated_at"]

    # Формируем строки
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = [headers]
    for b in balances:
        rows.append([
            b["exchange"],
            b["coin"],
            b["wallet_balance"],
            b["available"],
            b["usd_value"],
            now,
        ])

    # Очищаем лист и записываем
    ws.clear()
    ws.update(range_name="A1", values=rows)
    print(f"[Sheets] Записано {len(balances)} строк в '{SHEET_BALANCES}'")
