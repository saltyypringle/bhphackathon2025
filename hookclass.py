from datetime import datetime


class Hook:
    def __init__(self, name, bollard_name, berth_name, port_name, max_tension=10):
        self.name = name
        self.bollard_name = bollard_name
        self.berth_name = berth_name
        self.port_name = port_name
        self.max_tension = max_tension

        self.history = []
        self.current_tension = None
        self.previous_tension = None
        self.faulted = False
        self.attached_line = None

    def update(self, tension, faulted, attached_line, timestamp=None):
        timestamp = timestamp or datetime.now()
        self.previous_tension = self.current_tension
        self.current_tension = tension
        self.faulted = faulted
        self.attached_line = attached_line
        self.history.append({"timestamp": timestamp, "tension": tension})

    def tension_percent(self):
        if self.current_tension is None:
            return None
        return (self.current_tension / self.max_tension) * 100

    def rate_of_change(self):
        if self.previous_tension is None or self.current_tension is None:
            return 0
        return self.current_tension - self.previous_tension

    def needs_attention(self, attention_threshold=50):
        """
        Returns True if tension exceeds attention threshold (% of max tension).
        Default attention threshold changed to 50%% (e.g., 5/10 for max_tension=10).
        """
        pct = self.tension_percent()
        if pct is None:
            return False
        return pct >= attention_threshold

    def is_critical(self, critical_threshold=80):
        """
        Returns True if tension exceeds critical threshold (% of max tension).
        Default critical threshold changed to 80%% (e.g., 8/10 for max_tension=10).
        """
        pct = self.tension_percent()
        if pct is None:
            return False
        return pct >= critical_threshold

    def __repr__(self):
        pct = self.tension_percent()
        pct_str = f"{pct:.1f}%" if pct is not None else "N/A"
        return (
            f"<Hook {self.name}: tension={self.current_tension}, "
            f"{pct_str} of max, "
            f"rate={self.rate_of_change()}, "
            f"faulted={self.faulted}, line={self.attached_line}>"
        )


class MooringMonitor:
    def __init__(self):
        self.hooks = {}  # key = berth.bollard.hook

    def update_from_record(self, record):
        key = f"{record['berth_name']}.{record['bollard_name']}.{record['hook_name']}"
        if key not in self.hooks:
            self.hooks[key] = Hook(
                name=record["hook_name"],
                bollard_name=record["bollard_name"],
                berth_name=record["berth_name"],
                port_name=record["port_name"],
            )
        self.hooks[key].update(
            tension=record["tension"],
            faulted=record["faulted"],
            attached_line=record["attached_line"],
            timestamp=record["timestamp"],
        )

    def hooks_needing_attention(self, attention_threshold=80):
        return [
            hook
            for hook in self.hooks.values()
            if hook.needs_attention(attention_threshold)
        ]

    def hooks_critical(self, critical_threshold=90):
        return [
            hook for hook in self.hooks.values() if hook.is_critical(critical_threshold)
        ]
