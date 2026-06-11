import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Gamepad2, Power, Link2, QrCode, Trophy, Smartphone, Cpu, MonitorPlay,
  ChevronDown, Wifi, BatteryMedium, Lightbulb, ArrowRight, ArrowLeft, RotateCcw,
} from 'lucide-react'

// Page d'onboarding « Get Started » des buzzers — publique (le QR sous le
// boîtier l'ouvre, même non connecté). Style guidé, illustré, rassurant.
export default function BuzzerGuide() {
  const { user } = useAuth()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-5 h-14 flex items-center justify-between"
        style={{ background: 'color-mix(in srgb, var(--surface-2) 82%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <Link to={user ? '/dashboard' : '/login'} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black text-white" style={{ background: '#6366F1' }}>G</div>
          <span className="font-bold text-sm">Gbairai · Buzzers</span>
        </Link>
        <Link to={user ? '/dashboard' : '/login'} className="btn-ghost btn-sm gap-1.5"><ArrowLeft size={13} />Retour</Link>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <Gamepad2 size={30} style={{ color: '#818CF8' }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Joue avec un buzzer</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Physique, simulé ou ton téléphone — tout marche pareil. Aucune configuration compliquée.
          </p>
        </div>

        {/* 3 chemins */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          <PathCard icon={Cpu} color="#22C55E" title="Buzzer physique"
            text="Allume-le. Il se connecte et s'allume tout seul." />
          <PathCard icon={MonitorPlay} color="#0EA5E9" title="Buzzer simulé"
            text="Teste sans matériel, depuis n'importe quel appareil." cta={{ label: 'Ouvrir le simulateur', href: '/buzzer.html' }} />
          <PathCard icon={Smartphone} color="#A855F7" title="Téléphone"
            text="Pas de buzzer ? Joue directement avec un gros bouton à l'écran." />
        </div>

        {/* Première connexion Wi-Fi — buzzer physique neuf */}
        <div className="card p-5 mb-10" style={{ border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.06)' }}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wifi size={18} style={{ color: '#0EA5E9' }} />Buzzer neuf ? Connecte-le à ton Wi-Fi
          </h2>
          <p className="text-2xs mt-1 mb-4" style={{ color: 'var(--text-dim)' }}>
            Uniquement au tout premier allumage (ou après un reset). Ensuite il se reconnecte seul.
          </p>
          <div className="space-y-3">
            <WifiStep n="1" title="Allume le buzzer"
              text="Tout neuf, il crée son propre réseau Wi-Fi « Gbairai-Buzzer-XXXX » — la LED pulse en blanc." />
            <WifiStep n="2" title="Connecte ton téléphone à ce réseau"
              text="Choisis « Gbairai-Buzzer-XXXX » dans les réglages Wi-Fi du téléphone. Un portail de configuration s'ouvre tout seul." />
            <WifiStep n="3" title="Choisis ton Wi-Fi"
              text="Sélectionne ton réseau Wi-Fi et saisis son mot de passe. C'est tout — le buzzer connaît déjà le serveur Gbairai (rien d'autre à régler)." />
            <WifiStep n="4" title="Valide"
              text="Le buzzer redémarre, mémorise tout et se reconnecte automatiquement à chaque allumage suivant." />
          </div>
          <div className="mt-4 pt-4 flex items-start gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            <RotateCcw size={15} style={{ color: '#F59E0B' }} className="mt-0.5 shrink-0" />
            <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text)' }}>Changer de Wi-Fi / réinitialiser :</b> maintiens le bouton enfoncé pendant que tu
              allumes le buzzer. Il oublie le Wi-Fi et le serveur (clignotement rouge de confirmation), puis rouvre son portail pour une nouvelle config.
            </p>
          </div>
        </div>

        {/* Étapes guidées */}
        <h2 className="text-lg font-bold mb-4">Ensuite, pour jouer — en 4 étapes</h2>
        <div className="space-y-3 mb-10">
          <Step n="1" icon={Power} color="#22C55E" title="Allume / ouvre ton buzzer"
            text="Buzzer physique : mets-le sous tension. Simulateur : ouvre-le et clique « Allumer »." />
          <Step n="2" icon={Link2} color="#6366F1" title="Appaire-le (une seule fois)"
            text="Dans l'app : « Mes buzzers » → ajoute-le par sa MAC. Ensuite, il est reconnu automatiquement." />
          <Step n="3" icon={QrCode} color="#F59E0B" title="Rejoins une partie"
            text="Scanne le QR de la partie (ou saisis le code). Pas besoin de compte : un pseudo suffit." />
          <Step n="4" icon={Trophy} color="#EAB308" title="Joue — le buzzer s'allume tout seul"
            text="Quand l'animateur lance, ta LED passe au bleu. Appuie dès que tu sais !" />
        </div>

        {/* QR sous le boîtier */}
        <div className="card p-5 mb-10 flex flex-col sm:flex-row items-center gap-5">
          <div className="bg-white rounded-xl p-3 shrink-0">
            <QRCodeSVG value={`${origin}/buzzer`} size={104} level="M" />
          </div>
          <div>
            <h3 className="font-bold flex items-center gap-2"><QrCode size={16} style={{ color: '#818CF8' }} />Le QR sous ton buzzer</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Chaque buzzer physique porte un QR Code imprimé. Le scanner ouvre <b>cette page</b> :
              démarrage immédiat, sans notice. Le buzzer simulé propose le même lien.
            </p>
            <p className="text-2xs mt-2" style={{ color: 'var(--text-dim)' }}>
              Tu peux scanner ce QR de démonstration : il mène ici.
            </p>
          </div>
        </div>

        {/* Bon à savoir */}
        <h2 className="text-lg font-bold mb-4">Bon à savoir</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          <Info icon={Lightbulb} color="#3B82F6" title="La LED te guide"
            text={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              {[['#E5E7EB', 'config Wi-Fi'], ['#EAB308', 'à appairer'], ['#3B82F6', 'prêt'], ['#22C55E', 'gagné'], ['#EF4444', 'verrouillé'], ['#F97316', 'réponse'], ['#4B5563', 'éteint']].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1">
                  <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: c }} />{l}
                </span>
              ))}
            </span>} />
          <Info icon={Smartphone} color="#A855F7" title="Le téléphone est ton filet"
            text="Buzzer déchargé ou hors Wi-Fi ? Tu continues au téléphone, sans perdre ta place." />
          <Info icon={BatteryMedium} color="#22C55E" title="Batterie & reconnexion"
            text="La batterie s'affiche dans l'app. Le buzzer se reconnecte tout seul." />
        </div>

        {/* Dépannage */}
        <h2 className="text-lg font-bold mb-4">Ça coince ?</h2>
        <div className="space-y-2 mb-10">
          <FAQ q="Mon buzzer n'apparaît pas">
            Vérifie qu'il est allumé (LED active) et sur le même Wi-Fi. Ajoute-le dans « Mes buzzers » par sa MAC.
            Sur le simulateur, vérifie l'adresse du serveur.
          </FAQ>
          <FAQ q="Il est « hors ligne »">
            Il a perdu le Wi-Fi. Rapproche-le de la box ou reconnecte-le : il se réassocie automatiquement.
            En attendant, joue au téléphone.
          </FAQ>
          <FAQ q="Changer le Wi-Fi ou réinitialiser le buzzer">
            Maintiens le bouton enfoncé pendant que tu allumes le buzzer : il efface le Wi-Fi et la config serveur
            (clignotement rouge de confirmation), puis rouvre son portail « Gbairai-Buzzer-XXXX » (LED blanche) pour
            une nouvelle configuration — reprends alors les 4 étapes Wi-Fi ci-dessus.
          </FAQ>
          <FAQ q="Je n'ai pas de buzzer">
            Aucun souci : rejoins la partie et joue avec le bouton BUZZ à l'écran. Le buzzer est un bonus, jamais obligatoire.
          </FAQ>
          <FAQ q="Comment tester sans matériel ?">
            Ouvre le <a href="/buzzer.html" style={{ color: '#818CF8' }}>simulateur</a> (sur n'importe quel appareil du réseau),
            ou regarde l'<a href="/esp32-portal.html" style={{ color: '#818CF8' }}>aperçu du boîtier</a>.
          </FAQ>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="/buzzer.html" className="btn-primary gap-2"><MonitorPlay size={15} />Ouvrir le simulateur</a>
          <a href="/esp32-portal.html" className="btn-secondary gap-2"><Cpu size={15} />Aperçu du boîtier</a>
          {user && <Link to="/compte" className="btn-secondary gap-2"><Link2 size={15} />Mes buzzers</Link>}
          {user && <Link to="/dashboard" className="btn-secondary gap-2">Rejoindre <ArrowRight size={14} /></Link>}
        </div>
      </main>
    </div>
  )
}

function PathCard({ icon: Icon, color, title, text, cta }) {
  return (
    <div className="card p-4 flex flex-col" style={{ border: `1px solid ${hex(color, 0.25)}` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: hex(color, 0.15) }}>
        <Icon size={17} style={{ color }} />
      </div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-2xs mt-1 flex-1" style={{ color: 'var(--text-muted)' }}>{text}</p>
      {cta && <a href={cta.href} className="text-xs font-medium mt-2" style={{ color }}>{cta.label} →</a>}
    </div>
  )
}
function Step({ n, icon: Icon, color, title, text }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold" style={{ background: hex(color, 0.15), color }}>{n}</div>
      <div className="flex-1">
        <p className="font-semibold text-sm flex items-center gap-2"><Icon size={15} style={{ color }} />{title}</p>
        <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>{text}</p>
      </div>
    </div>
  )
}
function WifiStep({ n, title, text }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ background: 'rgba(14,165,233,0.18)', color: '#0EA5E9' }}>{n}</div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{text}</p>
      </div>
    </div>
  )
}
function Info({ icon: Icon, color, title, text }) {
  return (
    <div className="card p-4">
      <Icon size={18} style={{ color }} className="mb-2" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  )
}
function FAQ({ q, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-medium">{q}</span>
        <ChevronDown size={16} style={{ color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
      </button>
      {open && <div className="px-4 pb-3 text-sm" style={{ color: 'var(--text-muted)' }}>{children}</div>}
    </div>
  )
}
function hex(c, a) { const x = c.replace('#', ''); return `rgba(${parseInt(x.slice(0,2),16)},${parseInt(x.slice(2,4),16)},${parseInt(x.slice(4,6),16)},${a})` }
