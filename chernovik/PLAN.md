# План: Баланс криптобирж -> Google Sheets

## Обзор
Python-программа, которая получает балансы монет с Bybit через API и записывает их в Google Sheets. API-ключи также хранятся в Google Sheets.

## Архитектура

```
Google Sheets (таблица "Crypto Balances")
├── Лист "API Keys"        <- хранение API ключей бирж
│   ├── Столбец A: Название биржи (например, "bybit")
│   ├── Столбец B: API Key
│   └── Столбец C: API Secret
│
└── Лист "Balances"        <- баланс по монетам
    ├── Столбец A: Биржа
    ├── Столбец B: Монета (BTC, ETH, USDT...)
    ├── Столбец C: Баланс (walletBalance)
    ├── Столбец D: Доступно (availableToWithdraw)
    ├── Столбец E: USD-эквивалент (usdValue)
    └── Столбец F: Дата обновления
```

## Структура файлов

```
chernovik/
├── main.py                  # Точка входа (запуск вручную или по расписанию)
├── config.py                # Конфигурация (ID таблицы, настройки)
├── sheets_client.py         # Работа с Google Sheets (чтение ключей, запись балансов)
├── exchanges/
│   ├── __init__.py
│   └── bybit_client.py     # Получение баланса с Bybit через pybit
├── scheduler.py             # Планировщик (запуск по расписанию)
├── requirements.txt         # Зависимости
└── service_account.json     # Ключ сервисного аккаунта Google (НЕ коммитить!)
```

## Зависимости (requirements.txt)

```
pybit>=5.0.0          # Официальный SDK Bybit
gspread>=6.0.0        # Google Sheets API
google-auth>=2.0.0    # Авторизация Google
schedule>=1.2.0       # Планировщик задач
```

## Этапы реализации

### Этап 1: Настройка Google Sheets
1. Создать сервисный аккаунт Google (в Google Cloud Console)
2. Включить Google Sheets API и Google Drive API
3. Скачать файл `service_account.json`
4. Создать Google таблицу и расшарить её на email сервисного аккаунта
5. Создать листы "API Keys" и "Balances"

### Этап 2: sheets_client.py — работа с Google Sheets
- Функция `read_api_keys()` — читает API ключи с листа "API Keys"
- Функция `write_balances()` — записывает балансы на лист "Balances"
- Авторизация через `gspread.service_account()`

### Этап 3: exchanges/bybit_client.py — получение баланса Bybit
- Используем `pybit.unified_trading.HTTP`
- Метод `get_wallet_balance(accountType="UNIFIED")` для получения всех монет
- Возвращаем список: [{coin, walletBalance, availableToWithdraw, usdValue}]

### Этап 4: main.py — основная логика
1. Прочитать API ключи из Google Sheets
2. Подключиться к Bybit
3. Получить баланс
4. Записать результат в Google Sheets

### Этап 5: scheduler.py — запуск по расписанию
- Библиотека `schedule` для периодического запуска
- Настраиваемый интервал (по умолчанию — каждый час)
- Можно запускать и вручную через `main.py`

## Безопасность
- `service_account.json` добавляется в `.gitignore`
- API ключи бирж хранятся в Google Sheets (доступ только у сервисного аккаунта)
- Bybit API ключи создаются с правами **только на чтение** (Read-Only)

## Bybit API — ключевые моменты
- Эндпоинт: `GET /v5/account/wallet-balance`
- Параметр: `accountType="UNIFIED"`
- Лимит: 50 запросов/сек (более чем достаточно)
- pybit автоматически обрабатывает подписи HMAC-SHA256
