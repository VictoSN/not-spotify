/**
 * Lightweight, dependency-free i18n. We deliberately avoid a library
 * (react-i18next etc.) because node_modules is committed to this repo, so a new
 * dependency means a huge tracked diff. Instead: flat key→string dictionaries
 * per language + a tiny `t()` (see [[useTranslation]]) with `{var}` interpolation.
 * Current language lives in the localeStore (persisted to `ns-pref-language`).
 *
 * Coverage is incremental — the Settings page is translated first (it's where
 * the language picker lives, so switching is immediately visible). Add keys +
 * sections over time; missing keys fall back to English, then to the raw key.
 */
export type LanguageCode = 'en' | 'es' | 'fr'

/** Selectable languages (native names shown verbatim, not themselves translated). */
export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English (English)' },
  { code: 'es', label: 'Español (Spanish)' },
  { code: 'fr', label: 'Français (French)' },
]

type Dict = Record<string, string>

const en: Dict = {
  'settings.title': 'Settings',
  'settings.account': 'Account',
  'settings.account.edit': 'Edit login methods',
  'settings.account.editSub': 'Manage your account, plan, payment and security',
  'common.edit': 'Edit',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme.sub': 'Dark and light use the same music-first green accent',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'settings.language': 'Language',
  'settings.language.choose': 'Choose language',
  'settings.language.sub': 'Switch the language used across the app',
  'settings.audio': 'Audio quality',
  'settings.audio.streaming': 'Streaming quality',
  'settings.audio.streamingSub': "Adaptive bitrate isn't available yet",
  'settings.audio.normalize': 'Normalize volume',
  'settings.audio.normalizeSub': 'Even out the loudness between songs as they play',
  'quality.auto': 'Automatic',
  'quality.low': 'Low',
  'quality.normal': 'Normal',
  'quality.high': 'High',
  'quality.veryhigh': 'Very High',
  'settings.library': 'Your Library',
  'settings.library.compact': 'Use compact library layout',
  'settings.library.compactSub': 'Reduce artwork size and row spacing in the sidebar',
  'settings.display': 'Display',
  'settings.display.nowPlaying': 'Show the now-playing panel',
  'settings.display.nowPlayingSub': "Open the right panel with what's currently playing",
  'settings.playback': 'Playback',
  'settings.playback.autoplay': 'Autoplay similar content when your music ends',
  'settings.playback.crossfade': 'Crossfade songs',
  'settings.playback.crossfadeSub': 'Blend the end of one song into the start of the next',
  'crossfade.off': 'Off',
  'crossfade.seconds': '{n} seconds',
  'common.comingSoon': 'Coming soon',
}

const es: Dict = {
  'settings.title': 'Ajustes',
  'settings.account': 'Cuenta',
  'settings.account.edit': 'Editar métodos de inicio de sesión',
  'settings.account.editSub': 'Gestiona tu cuenta, plan, pago y seguridad',
  'common.edit': 'Editar',
  'settings.appearance': 'Apariencia',
  'settings.theme': 'Tema',
  'settings.theme.sub': 'Los modos oscuro y claro usan el mismo acento verde',
  'theme.dark': 'Oscuro',
  'theme.light': 'Claro',
  'settings.language': 'Idioma',
  'settings.language.choose': 'Elegir idioma',
  'settings.language.sub': 'Cambia el idioma usado en toda la aplicación',
  'settings.audio': 'Calidad de audio',
  'settings.audio.streaming': 'Calidad de streaming',
  'settings.audio.streamingSub': 'La tasa de bits adaptable aún no está disponible',
  'settings.audio.normalize': 'Normalizar volumen',
  'settings.audio.normalizeSub': 'Iguala el volumen entre canciones mientras suenan',
  'quality.auto': 'Automática',
  'quality.low': 'Baja',
  'quality.normal': 'Normal',
  'quality.high': 'Alta',
  'quality.veryhigh': 'Muy alta',
  'settings.library': 'Tu biblioteca',
  'settings.library.compact': 'Usar diseño compacto de biblioteca',
  'settings.library.compactSub': 'Reduce el tamaño de las portadas y el espaciado en la barra lateral',
  'settings.display': 'Pantalla',
  'settings.display.nowPlaying': 'Mostrar el panel de reproducción actual',
  'settings.display.nowPlayingSub': 'Abre el panel derecho con lo que se está reproduciendo',
  'settings.playback': 'Reproducción',
  'settings.playback.autoplay': 'Reproducir contenido similar cuando termine tu música',
  'settings.playback.crossfade': 'Fundir canciones',
  'settings.playback.crossfadeSub': 'Mezcla el final de una canción con el inicio de la siguiente',
  'crossfade.off': 'Desactivado',
  'crossfade.seconds': '{n} segundos',
  'common.comingSoon': 'Próximamente',
}

const fr: Dict = {
  'settings.title': 'Paramètres',
  'settings.account': 'Compte',
  'settings.account.edit': 'Modifier les méthodes de connexion',
  'settings.account.editSub': 'Gérez votre compte, votre offre, le paiement et la sécurité',
  'common.edit': 'Modifier',
  'settings.appearance': 'Apparence',
  'settings.theme': 'Thème',
  'settings.theme.sub': 'Les modes sombre et clair utilisent le même vert d’accent',
  'theme.dark': 'Sombre',
  'theme.light': 'Clair',
  'settings.language': 'Langue',
  'settings.language.choose': 'Choisir la langue',
  'settings.language.sub': 'Changez la langue utilisée dans toute l’application',
  'settings.audio': 'Qualité audio',
  'settings.audio.streaming': 'Qualité de streaming',
  'settings.audio.streamingSub': 'Le débit adaptatif n’est pas encore disponible',
  'settings.audio.normalize': 'Normaliser le volume',
  'settings.audio.normalizeSub': 'Égalise le volume entre les morceaux pendant la lecture',
  'quality.auto': 'Automatique',
  'quality.low': 'Basse',
  'quality.normal': 'Normale',
  'quality.high': 'Haute',
  'quality.veryhigh': 'Très haute',
  'settings.library': 'Votre bibliothèque',
  'settings.library.compact': 'Utiliser une mise en page compacte',
  'settings.library.compactSub': 'Réduit la taille des pochettes et l’espacement dans la barre latérale',
  'settings.display': 'Affichage',
  'settings.display.nowPlaying': 'Afficher le panneau de lecture en cours',
  'settings.display.nowPlayingSub': 'Ouvre le panneau de droite avec le morceau en cours',
  'settings.playback': 'Lecture',
  'settings.playback.autoplay': 'Lire du contenu similaire à la fin de votre musique',
  'settings.playback.crossfade': 'Fondu enchaîné',
  'settings.playback.crossfadeSub': 'Fond la fin d’un morceau avec le début du suivant',
  'crossfade.off': 'Désactivé',
  'crossfade.seconds': '{n} secondes',
  'common.comingSoon': 'Bientôt disponible',
}

export const translations: Record<LanguageCode, Dict> = { en, es, fr }
