"""Observations grounded only in actual check-in records."""
from collections import Counter
from .models import CheckIn

def summarize(events: list[CheckIn]) -> dict:
    count = len(events)
    completed = sum(event.status == "completed" for event in events)
    obstacles = Counter(event.reason for event in events if event.reason)
    top = obstacles.most_common(1)[0][0] if obstacles else None
    rate = round(completed / count * 100, 1) if count else None
    if not count:
        reflection = "Start with one small commitment. Your first check-in will begin your story."
    elif count < 3:
        reflection = f"You completed {completed} of {count} check-ins. It's too early to call anything a pattern."
    else:
        reflection = f"You completed {completed} of {count} check-ins ({rate}%)."
        if top:
            reflection += f" Your most reported obstacle was '{top}'. Try one small change and see what happens."
    return dict(checkins=count, completed=completed, completion_rate=rate, top_obstacle=top, reflection=reflection)
