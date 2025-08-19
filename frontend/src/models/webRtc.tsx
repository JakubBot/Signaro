type SignalMsg =
  | { type: "offer"; sdp: any; from?: string; to?: string }
  | { type: "answer"; sdp: any; from?: string; to?: string }
  | { type: "ice"; candidate: any; from?: string; to?: string }
  | { type: "ready"; from?: string };