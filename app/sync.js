// Escribe capacitor.config.json con la dirección de Pistea y sincroniza el proyecto de Android.
//   PISTEA_URL=https://pistea.tudominio.es node sync.js        (producción)
//   node sync.js                                               (emulador: http://10.0.2.2:3000, el ordenador anfitrión)
const fs = require('fs'), { execSync } = require('child_process');
const url = (process.env.PISTEA_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
// Sin HTTPS la sesión y la ubicación viajarían en claro: http solo para el emulador o la red local de pruebas
if (url.startsWith('http://') && !/^(10\.0\.2\.2|localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/.test(new URL(url).hostname)) {
  console.error('PISTEA_URL tiene que empezar por https:// (la app se publica).'); process.exit(1);
}
// Canal: PISTEA_CANAL=play para la versión de Google Play. Esa no lleva el aviso de «versión nueva» (que descarga una APK
// fuera de la tienda): Google Play prohíbe que una app se actualice por otro camino que Play
const PLAY = process.env.PISTEA_CANAL === 'play';
const vc = (/versionCode\s+(\d+)/.exec(fs.readFileSync('android/app/build.gradle', 'utf8')) || [])[1] || '1';   // el aviso de «versión nueva» compara este número con APK.min del servidor
const cfg = { appId: 'com.pistea.app', appName: 'Pistea', webDir: 'www', server: { url, cleartext: url.startsWith('http://'), allowNavigation: [new URL(url).host] }, backgroundColor: '#0b0c0f', android: { useLegacyBridge: true, appendUserAgent: (PLAY ? 'PisteaPlay/' : 'PisteaApp/') + vc }, plugins: { SystemBars: { style: 'DARK' } } };   // texto claro en las barras: la app es oscura
fs.writeFileSync('capacitor.config.json', JSON.stringify(cfg, null, 2));
console.log('Pistea carga', url);
execSync('npx cap sync android', { stdio: 'inherit' });
