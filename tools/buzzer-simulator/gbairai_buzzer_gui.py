#!/usr/bin/env python3
"""
Gbairai — Buzzer simulé avec INTERFACE GRAPHIQUE.

Se comporte à l'identique du futur buzzer physique ESP32 :
  • un gros bouton rond (clic souris ou BARRE D'ESPACE) = appui buzzer ;
  • une LED (l'anneau coloré du bouton) pilotée par les messages serveur :
        bleu = prêt · blanc = appui · vert = gagné · rouge = verrouillé ·
        orange = réponse révélée · gris = déconnecté.

Interface : widgets natifs (ttk) pour une compatibilité macOS / Windows / Linux ;
seul le buzzer est un Canvas (couleurs garanties).

Dépendance : websockets   (pip install -r requirements.txt)
Lancement   : python3 gbairai_buzzer_gui.py
"""
import math
import queue
import random
import time
import tkinter as tk
from tkinter import ttk

from buzzer_client import BuzzerClient

# (couleur LED, titre, sous-titre) par état.
LED = {
    "disconnected": ("#6B7280", "Déconnecté", "Connecte-toi pour jouer"),
    "idle":         ("#475569", "En attente", "La partie va commencer…"),
    "armed":        ("#3B82F6", "BUZZ !", "Appuie dès que tu sais"),
    "pressed":      ("#FFFFFF", "…", "Appui détecté"),
    "winner":       ("#22C55E", "GAGNÉ !", "Tu as buzzé en premier"),
    "locked":       ("#EF4444", "Verrouillé", "Quelqu'un a buzzé avant toi"),
    "reveal":       ("#F59E0B", "Réponse", "Regarde l'écran"),
}
CANVAS_BG = "#0E0E12"


def gen_mac():
    return "5E:" + ":".join(f"{random.randint(0, 255):02X}" for _ in range(5))


class BuzzerGUI:
    def __init__(self, root):
        self.root = root
        self.q = queue.Queue()
        self.client = None
        self.state = "disconnected"
        self.pulse = 0
        self.flash_until = 0.0

        root.title("Gbairai — Buzzer (simulateur)")
        root.geometry("440x640")
        root.minsize(420, 600)

        # ── Connexion (widgets natifs) ──────────────────────────────────────
        top = ttk.LabelFrame(root, text="Connexion")
        top.pack(fill="x", padx=14, pady=(12, 8))
        top.columnconfigure(1, weight=1)

        self.url_var = tk.StringVar(value="ws://localhost:4000")
        self.mac_var = tk.StringVar(value=gen_mac())
        self.code_var = tk.StringVar(value="")
        self._row(top, 0, "Serveur", self.url_var)
        self._row(top, 1, "MAC du buzzer", self.mac_var)
        self._row(top, 2, "Code de la partie", self.code_var)

        self.connect_btn = ttk.Button(top, text="Se connecter", command=self.toggle_connect)
        self.connect_btn.grid(row=3, column=0, columnspan=2, sticky="ew", padx=8, pady=(6, 8))

        self.status = ttk.Label(root, text="● Déconnecté", foreground="#9090A0")
        self.status.pack(pady=(0, 6))

        # ── Le buzzer (Canvas) ──────────────────────────────────────────────
        self.canvas = tk.Canvas(root, width=300, height=300, bg=CANVAS_BG, highlightthickness=0)
        self.canvas.pack(pady=6)
        self.canvas.bind("<Button-1>", lambda e: self.do_buzz())

        ttk.Label(root, text="Clique le bouton ou appuie sur ESPACE pour buzzer",
                  foreground="#6B7280").pack(pady=(2, 6))

        # ── Journal ─────────────────────────────────────────────────────────
        self.log = tk.Text(root, height=6, relief="flat", bg="#15151B", fg="#9090A0",
                           font=("Menlo", 9), state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True, padx=14, pady=(0, 12))

        root.bind("<space>", lambda e: self.do_buzz())
        self.draw()
        self.root.after(40, self.tick)

    def _row(self, parent, r, label, var):
        ttk.Label(parent, text=label).grid(row=r, column=0, sticky="w", padx=(8, 6), pady=3)
        ttk.Entry(parent, textvariable=var).grid(row=r, column=1, sticky="ew", padx=(0, 8), pady=3)

    # ── Connexion ───────────────────────────────────────────────────────────
    def toggle_connect(self):
        if self.client and self.client.connected:
            self.client.stop()
        else:
            self.client = BuzzerClient(on_event=lambda m: self.q.put(("event", m)),
                                       on_status=lambda s, d="": self.q.put(("status", (s, d))))
            self.client.start(self.url_var.get().strip(), self.mac_var.get().strip(), self.code_var.get())
            self.connect_btn.config(text="Connexion…")

    def do_buzz(self):
        if self.client and self.client.connected:
            self.client.buzz()
            self.flash_until = time.time() + 0.18
            self._log("→ BUZZ envoyé")

    # ── Boucle UI ─────────────────────────────────────────────────────────────
    def tick(self):
        try:
            while True:
                kind, data = self.q.get_nowait()
                if kind == "status":
                    self._apply_status(*data)
                else:
                    self._apply_event(data)
        except queue.Empty:
            pass
        self.pulse += 1
        self.draw()
        self.root.after(40, self.tick)

    def _apply_status(self, state, detail):
        if state == "connected":
            self.state = "idle"
            self.status.config(text=f"● Connecté · {detail}", foreground="#22C55E")
            self.connect_btn.config(text="Se déconnecter")
            self._log(f"Connecté ({detail})")
        elif state == "disconnected":
            self.state = "disconnected"
            self.status.config(text="● Déconnecté", foreground="#9090A0")
            self.connect_btn.config(text="Se connecter")
            self._log("Déconnecté")
        elif state == "error":
            self.status.config(text=f"● Erreur : {detail}", foreground="#EF4444")
            self._log(f"Erreur : {detail}")
            self.connect_btn.config(text="Se connecter")

    def _apply_event(self, msg):
        t = msg.get("type")
        mine = msg.get("mac") == self.mac_var.get().strip()
        if t == "question_display":
            self.state = "armed"
            self._log(f"Question #{(msg.get('index') or 0) + 1}")
        elif t == "buzz_reopened":
            self.state = "armed"
            self._log("Buzz rouvert")
        elif t == "buzzer_pressed_visual" and mine:
            self.flash_until = time.time() + 0.18
        elif t == "buzzer_winner":
            self.state = "winner" if mine else "locked"
            self._log(("🏆 GAGNÉ ! " if mine else f"{msg.get('prenom', '?')} a buzzé ") + f"({msg.get('responseMs')} ms)")
        elif t == "question_reveal":
            self.state = "reveal"
            self._log(f"Réponse : {msg.get('reponse')}")
        elif t == "game_ended":
            self.state = "idle"
            self._log("Partie terminée")

    # ── Rendu du buzzer ──────────────────────────────────────────────────────
    def draw(self):
        c = self.canvas
        c.delete("all")
        cx, cy, r = 150, 150, 110
        flashing = time.time() < self.flash_until
        color, title, sub = LED["pressed"] if flashing else LED.get(self.state, LED["idle"])

        if self.state in ("armed", "winner") and not flashing:
            amp = (1 + math.sin(self.pulse / 4)) / 2
            glow = int(r + 8 + amp * 14)
            c.create_oval(cx - glow, cy - glow, cx + glow, cy + glow, outline=color, width=3)

        c.create_oval(cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8, outline=color, width=6)
        body = "#23232B" if self.state == "disconnected" else self._shade(color, 0.82)
        c.create_oval(cx - r, cy - r, cx + r, cy + r, fill=body, outline=self._shade(color, 0.6), width=2)

        txt = "#0E0E12" if flashing else "#FFFFFF"
        c.create_text(cx, cy - 12, text=title, fill=txt, font=("Helvetica", 28, "bold"))
        c.create_text(cx, cy + 24, text=sub, fill=("#0E0E12" if flashing else "#E5E7EB"),
                      font=("Helvetica", 11), width=190, justify="center")

    def _shade(self, hexc, k):
        hexc = hexc.lstrip("#")
        r, g, b = (int(hexc[i:i + 2], 16) for i in (0, 2, 4))
        return f"#{int(r * k):02x}{int(g * k):02x}{int(b * k):02x}"

    def _log(self, line):
        self.log.config(state="normal")
        self.log.insert("end", line + "\n")
        self.log.see("end")
        self.log.config(state="disabled")


def main():
    root = tk.Tk()
    try:
        ttk.Style().theme_use("aqua")  # natif macOS si dispo
    except tk.TclError:
        pass
    BuzzerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
