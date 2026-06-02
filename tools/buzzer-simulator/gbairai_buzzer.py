#!/usr/bin/env python3
"""
Gbairai — Simulateur de buzzer (ESP32) en Python.

Reproduit le protocole WebSocket d'un buzzer matériel, SANS matériel :
  1. Connexion WebSocket au serveur.
  2. Annonce de l'appareil  : {"type": "buzzer_hello", "mac": "...", "firmware": "..."}
  3. (optionnel) rejoint une salle pour recevoir les évènements de jeu.
  4. Buzz : {"type": "buzz", "source": "device", "mac": "..."}
     (le serveur résout la partie EN_COURS depuis l'assignation du buzzer ;
      on peut aussi forcer --code pour inclure partieCode.)

Sert à deux choses :
  • Conformité du protocole (avant d'écrire le firmware ESP32).
  • Test de charge (N buzzers simultanés) avec --count.

Exemples :
  # Un buzzer interactif (ENTER pour buzzer) :
  python3 gbairai_buzzer.py --mac AA:BB:CC:00:11:22 --code QUIZ42

  # Auto-buzz à chaque question (délai aléatoire), idéal en démo :
  python3 gbairai_buzzer.py --mac AA:BB:CC:00:11:22 --code QUIZ42 --auto

  # Test de charge : 50 buzzers qui pressent 1 s après connexion puis quittent :
  python3 gbairai_buzzer.py --count 50 --press-after 1 --once

Dépendance : pip install websockets
"""
import argparse
import asyncio
import json
import random
import sys

try:
    import websockets
except ImportError:
    print("Erreur : module 'websockets' manquant. Installez-le :\n  pip install websockets", file=sys.stderr)
    sys.exit(1)


def gen_mac(i: int) -> str:
    """MAC déterministe pour le buzzer simulé n°i (test de charge)."""
    return "5E:" + ":".join(f"{b:02X}" for b in [0x10, 0x00, (i >> 16) & 0xFF, (i >> 8) & 0xFF, i & 0xFF])


class SimBuzzer:
    def __init__(self, mac, args, idx=0):
        self.mac = mac
        self.args = args
        self.idx = idx
        self.ws = None
        self.presses = 0

    def log(self, *a):
        if self.args.verbose or self.args.count == 1:
            print(f"[{self.mac}]", *a)

    async def send(self, obj):
        await self.ws.send(json.dumps(obj))

    async def press(self):
        msg = {"type": "buzz", "source": "device", "mac": self.mac}
        if self.args.code:
            msg["partieCode"] = self.args.code.upper()
        await self.send(msg)
        self.presses += 1
        self.log("BUZZ →", "envoyé")

    async def run(self):
        async with websockets.connect(self.args.url) as ws:
            self.ws = ws
            # 1. Annonce de l'appareil
            await self.send({"type": "buzzer_hello", "mac": self.mac, "firmware": self.args.firmware})
            self.log("connecté + buzzer_hello")
            # 2. Rejoint la salle (pour recevoir les évènements de jeu)
            if self.args.code:
                await self.send({"type": "join_room", "partieCode": self.args.code.upper()})

            # 3. Stratégie de buzz
            if self.args.press_after is not None:
                await asyncio.sleep(self.args.press_after + random.uniform(0, self.args.jitter))
                await self.press()
                if self.args.once:
                    return

            # 4. Boucle de réception + auto-buzz / interactif
            recv_task = asyncio.create_task(self._recv_loop())
            tasks = [recv_task]
            if self.args.interval:
                tasks.append(asyncio.create_task(self._interval_loop()))
            if self.args.interactive:
                tasks.append(asyncio.create_task(self._keyboard_loop()))
            await asyncio.gather(*tasks)

    async def _recv_loop(self):
        async for raw in self.ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            t = msg.get("type")
            if t == "question_display":
                self.log(f"Question #{(msg.get('index') or 0) + 1} affichée")
                if self.args.auto:
                    delay = random.uniform(self.args.min_delay, self.args.max_delay)
                    asyncio.create_task(self._delayed_press(delay))
            elif t == "buzzer_winner":
                who = msg.get("prenom", "?")
                mine = " (MOI)" if msg.get("mac") == self.mac else ""
                self.log(f"🏆 Gagnant : {who}{mine}  ({msg.get('responseMs')} ms)")
            elif t == "question_reveal":
                self.log("Réponse révélée :", msg.get("reponse"))
            elif t == "game_ended":
                self.log("Partie terminée.")
                return

    async def _delayed_press(self, delay):
        await asyncio.sleep(delay)
        await self.press()

    async def _interval_loop(self):
        while True:
            await asyncio.sleep(self.args.interval)
            await self.press()

    async def _keyboard_loop(self):
        loop = asyncio.get_event_loop()
        while True:
            await loop.run_in_executor(None, sys.stdin.readline)
            await self.press()


async def main():
    p = argparse.ArgumentParser(description="Simulateur de buzzer Gbairai (ESP32).")
    p.add_argument("--url", default="ws://localhost:4000", help="URL WebSocket du serveur")
    p.add_argument("--mac", default=None, help="MAC du buzzer (sinon générée)")
    p.add_argument("--code", default=None, help="Code de la partie (rejoint la salle + inclus dans le buzz)")
    p.add_argument("--firmware", default="sim-1.0", help="Version firmware annoncée")
    p.add_argument("--count", type=int, default=1, help="Nombre de buzzers simultanés (test de charge)")
    p.add_argument("--auto", action="store_true", help="Buzz auto à chaque question (délai aléatoire)")
    p.add_argument("--min-delay", type=float, default=0.3, help="Délai min avant auto-buzz (s)")
    p.add_argument("--max-delay", type=float, default=2.5, help="Délai max avant auto-buzz (s)")
    p.add_argument("--interval", type=float, default=None, help="Buzz toutes les N secondes")
    p.add_argument("--press-after", type=float, default=None, help="Buzz une fois N s après connexion")
    p.add_argument("--jitter", type=float, default=0.0, help="Aléa ajouté à --press-after (s)")
    p.add_argument("--once", action="store_true", help="Quitter après le 1er buzz (avec --press-after)")
    p.add_argument("--interactive", action="store_true", help="Buzz à chaque appui sur ENTER")
    p.add_argument("--verbose", action="store_true", help="Logs détaillés même en mode --count")
    args = p.parse_args()

    if args.count == 1 and not (args.auto or args.interval or args.press_after is not None):
        args.interactive = True  # mode interactif par défaut pour un seul buzzer

    macs = [args.mac or gen_mac(0)] if args.count == 1 else [gen_mac(i) for i in range(args.count)]
    buzzers = [SimBuzzer(mac, args, i) for i, mac in enumerate(macs)]
    print(f"▶ {len(buzzers)} buzzer(s) → {args.url}" + (f" · partie {args.code}" if args.code else ""))

    results = await asyncio.gather(*(b.run() for b in buzzers), return_exceptions=True)
    errs = [r for r in results if isinstance(r, Exception)]
    total = sum(b.presses for b in buzzers)
    print(f"✔ Terminé — {total} buzz envoyés, {len(errs)} erreur(s)")
    if errs:
        print("  ex:", errs[0])


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nArrêt.")
