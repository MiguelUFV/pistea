// Escribe capacitor.config.json con la dirección de Pistea y sincroniza el proyecto de Android.
//   PISTEA_URL=https://pistea.tudominio.es node sync.js        (producción)
//   node sync.js                                               (emulador: http://10.0.2.2:3000, el ordenador anfitrión)
const fs = require('fs'), { execSync } = require('child_process');
const url = (process.env.PISTEA_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
const cfg = { appId: 'com.pistea.app', appName: 'Pistea', webDir: 'www', server: { url, cleartext: url.startsWith('http://'), allowNavigation: [new URL(url).host] }, android: { useLegacyBridge: true } };
fs.writeFileSync('capacitor.config.json', JSON.stringify(cfg, null, 2));
console.log('Pistea carga', url);
execSync('npx cap sync android', { stdio: 'inherit' });
