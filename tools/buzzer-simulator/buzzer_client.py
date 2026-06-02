"""
Client WebSocket de buzzer Gbairai — cœur réutilisable (sans interface).

Reproduit le protocole exact du futur buzzer physique ESP32 :
  • à la connexion : {"type":"buzzer_hello","mac","firmware"}
  • (option) {"type":"join_room","partieCode"}  → pour recevoir l'état (LED)
  • appui bouton  : {"type":"buzz","source":"device","mac"[, "partieCode"]}

Le client tourne dans un thread dédié (boucle asyncio) afin de cohabiter avec
une interface graphique Tkinter (thread principal). Les évènements entrants sont
remontés via le callback `on_event(msg: dict)` (appelé depuis le thread WS :
l'appelant doit re-synchroniser vers son thread UI, ex. via une file).
"""
import asyncio
import json
import threading

try:
    import websockets
except ImportError as e:  # pragma: no cover
    raise SystemExit("Module 'websockets' manquant. Faites : pip install websockets") from e


class BuzzerClient:
    def __init__(self, on_event=None, on_status=None):
        self.on_event = on_event       # on_event(dict)
        self.on_status = on_status     # on_status(state: str, detail: str)
        self._loop = None
        self._thread = None
        self._ws = None
        self._connected = False
        self.url = None
        self.mac = None
        self.code = None
        self.firmware = "sim-gui-1.0"

    # ── API publique (appelée depuis le thread UI) ──────────────────────────
    def start(self, url, mac, code=None):
        self.url, self.mac = url, mac
        self.code = (code or "").strip().upper() or None
        self._thread = threading.Thread(target=self._run_thread, daemon=True)
        self._thread.start()

    def buzz(self):
        if self._loop and self._connected:
            asyncio.run_coroutine_threadsafe(self._send_buzz(), self._loop)

    def stop(self):
        if self._loop:
            asyncio.run_coroutine_threadsafe(self._close(), self._loop)

    @property
    def connected(self):
        return self._connected

    # ── Interne ─────────────────────────────────────────────────────────────
    def _status(self, state, detail=""):
        if self.on_status:
            self.on_status(state, detail)

    def _emit(self, msg):
        if self.on_event:
            self.on_event(msg)

    def _run_thread(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._main())
        except Exception as e:  # pragma: no cover
            self._status("error", str(e))
        finally:
            self._connected = False
            self._status("disconnected")

    async def _main(self):
        try:
            async with websockets.connect(self.url) as ws:
                self._ws = ws
                self._connected = True
                await ws.send(json.dumps({"type": "buzzer_hello", "mac": self.mac, "firmware": self.firmware}))
                if self.code:
                    await ws.send(json.dumps({"type": "join_room", "partieCode": self.code}))
                self._status("connected", self.mac)
                async for raw in ws:
                    try:
                        self._emit(json.loads(raw))
                    except Exception:
                        pass
        except Exception as e:
            self._status("error", str(e))

    async def _send_buzz(self):
        if not self._ws:
            return
        msg = {"type": "buzz", "source": "device", "mac": self.mac}
        if self.code:
            msg["partieCode"] = self.code
        await self._ws.send(json.dumps(msg))

    async def _close(self):
        try:
            if self._ws:
                await self._ws.close()
        except Exception:
            pass
