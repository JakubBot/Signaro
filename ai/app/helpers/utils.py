from aiortc import (
    RTCPeerConnection,
    RTCIceCandidate,
)

def parse_ice_candidate_string(candidate_string: str) -> dict:
    """
    Parse ICE candidate string to extract components.
    Example: "candidate:842163049 1 udp 1677729535 192.168.1.2 54400 typ srflx..."
    """
    try:
        parts = candidate_string.split()
        if len(parts) < 8:
            raise ValueError(f"Invalid candidate string: {candidate_string}")

        # Parse basic components
        foundation = parts[0].split(":")[1]  # "candidate:842163049" -> "842163049"
        component = int(parts[1])
        protocol = parts[2]
        priority = int(parts[3])
        ip = parts[4]
        port = int(parts[5])
        candidate_type = parts[7]  # after "typ"

        return {
            "foundation": foundation,
            "component": component,
            "protocol": protocol,
            "priority": priority,
            "ip": ip,
            "port": port,
            "type": candidate_type,
        }
    except Exception as e:
        print(f"❌ Error parsing candidate string: {e}")
        return {
            "foundation": "0",
            "component": 1,
            "protocol": "udp",
            "priority": 1,
            "ip": "0.0.0.0",
            "port": 9,
            "type": "host",
        }


async def add_ice_candidate_safe(
    pc: RTCPeerConnection, client_id: str, cand_dict: dict
):
    """Safely add ICE candidate with proper error handling."""
    try:
        candidate_string = cand_dict.get("candidate")
        sdp_mid = cand_dict.get("sdpMid")
        sdp_mline_index = cand_dict.get("sdpMLineIndex")

        if not candidate_string:
            print(f"[{client_id}] ⚠️ Empty candidate string, skipping")
            return

        # Parse candidate string
        parsed = parse_ice_candidate_string(candidate_string)

        ice_candidate = RTCIceCandidate(
            component=parsed["component"],
            foundation=parsed["foundation"],
            ip=parsed["ip"],
            port=parsed["port"],
            priority=parsed["priority"],
            protocol=parsed["protocol"],
            type=parsed["type"],
            sdpMid=sdp_mid,
            sdpMLineIndex=sdp_mline_index,
        )

        await pc.addIceCandidate(ice_candidate)
        # print(
        #     f"[{client_id}] ✅ ICE candidate added: {parsed['type']} {parsed['protocol']}"
        # )

    except Exception as e:
        print(f"[{client_id}] ❌ addIceCandidate failed: {e}")
