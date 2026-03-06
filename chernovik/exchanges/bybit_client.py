from pybit.unified_trading import HTTP


def get_bybit_balances(api_key, api_secret):
    """
    Получает баланс всех монет с Bybit (Unified Account).
    Возвращает список словарей:
      [{exchange, coin, wallet_balance, available, usd_value}]
    """
    session = HTTP(
        api_key=api_key,
        api_secret=api_secret,
    )

    response = session.get_wallet_balance(accountType="UNIFIED")

    if response["retCode"] != 0:
        print(f"[Bybit] Ошибка: {response['retMsg']}")
        return []

    balances = []
    for account in response["result"]["list"]:
        for coin_data in account.get("coin", []):
            wallet_balance = coin_data.get("walletBalance", "0")
            # Пропускаем монеты с нулевым балансом
            if float(wallet_balance) == 0:
                continue

            balances.append({
                "exchange": "bybit",
                "coin": coin_data.get("coin", ""),
                "wallet_balance": wallet_balance,
                "available": coin_data.get("availableToWithdraw", "0"),
                "usd_value": coin_data.get("usdValue", "0"),
            })

    print(f"[Bybit] Получено {len(balances)} монет с ненулевым балансом")
    return balances
