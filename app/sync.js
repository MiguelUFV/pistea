// Escribe capacitor.config.json con la dirección de Pistea y sincroniza el proyecto de Android.
//   PISTEA_URL=https://pistea.tudominio.es node sync.js        (producción)
//   node sync.js                                               (emulador: http://10.0.2.2:3000, el ordenador anfitrión)
const fs = require('fs'), { execSync } = require('child_process');
const url = (process.env.PISTEA_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
// Sin HTTPS la sesión y la ubicación viajarían en claro: http solo para el emulador o la red local de pruebas
if (url.startsWith('http://') && !/^(10\.0\.2\.2|localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/.test(new URL(url).hostname)) {
  console.error('PISTEA_URL tiene que empezar por https:// (la app se publica).'); process.exit(1);
}
const cfg = { appId: 'com.pistea.app', appName: 'Pistea', webDir: 'www', server: { url, cleartext: url.startsWith('http://'), allowNavigation: [new URL(url).host] }, android: { useLegacyBridge: true } };
fs.writeFileSync('capacitor.config.json', JSON.stringify(cfg, null, 2));
console.log('Pistea carga', url);
execSync('npx cap sync android', { stdio: 'inherit' });
