export function createWs(
  url: string,
  onMessage: (msg: any) => void,
  onStatus?: (s: "open" | "close" | "error") => void
) {
  const ws = new WebSocket(url);
  ws.onopen = () => onStatus?.("open");
  ws.onclose = () => onStatus?.("close");
  ws.onerror = () => onStatus?.("error");
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {}
  };
  return ws;
}
