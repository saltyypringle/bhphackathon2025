from datetime import datetime


def parse_mooring_payload(payload: dict):
    """
    Convert nested mooring data JSON into the main stuff (hook data).
    """
    records = []
    port_name = payload.get("name", "UNKNOWN_PORT")

    for berth in payload.get("berths", []):
        berth_name = berth.get("name", "UNKNOWN_BERTH")
        for bollard in berth.get("bollards", []):
            bollard_name = bollard.get("name", "UNKNOWN_BOLLARD")
            for hook in bollard.get("hooks", []):
                record = {
                    "timestamp": datetime.now().isoformat(),
                    "port_name": port_name,
                    "berth_name": berth_name,
                    "bollard_name": bollard_name,
                    "hook_name": hook.get("name"),
                    "tension": hook.get("tension"),
                    "faulted": hook.get("faulted"),
                    "attached_line": hook.get("attachedLine"),
                }
                records.append(record)
    return records
