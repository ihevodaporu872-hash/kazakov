import schedule
import time
from main import update_balances
from config import UPDATE_INTERVAL_MINUTES


def run_scheduler():
    """Запускает обновление балансов по расписанию."""
    print(f"Планировщик запущен. Интервал: каждые {UPDATE_INTERVAL_MINUTES} мин.")

    # Первый запуск сразу
    update_balances()

    # Далее по расписанию
    schedule.every(UPDATE_INTERVAL_MINUTES).minutes.do(update_balances)

    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    run_scheduler()
