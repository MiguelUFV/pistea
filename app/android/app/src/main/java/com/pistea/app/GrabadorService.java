package com.pistea.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.io.InputStream;

// El grabador del día: un servicio en primer plano (con su aviso fijo) que pide al GPS del teléfono una posición por
// segundo y apunta cada una en un fichero, en cuanto llega. La app (la web, en GrabadorPlugin) las recibe en directo
// mientras está abierta y, si Android la cierra o se quita de las recientes, el servicio sigue grabando y la app lee lo
// que se ha perdido al volver. Se usa el GPS tal cual (no el proveedor «fused» de Google): da la velocidad Doppler y su
// precisión sin suavizados escondidos, y el filtro está en la app (calc.js).
//
// Si Android cierra el servicio (falta de memoria, el ahorro de batería de algunas marcas), lo vuelve a arrancar solo
// (START_STICKY) y sigue en el mismo fichero. Desde Android 11, un servicio arrancado así, con la app sin abrir, puede no
// recibir el GPS (Pistea no pide la ubicación «todo el tiempo»): si en WAKE_WAIT no llega ninguna posición, se para sin
// darlo por terminado y avisa; tocar el aviso abre la app, que sigue grabando en el mismo día. La app también sigue sola
// si se abre poco después de un corte. Y para sola al irse de la estación o antes de las 16 horas (ParadaSola).
//
// Lo que se guarda en el teléfono (PREFS): id (el fichero), since (desde cuándo cuenta el reloj del aviso), name, lat, lon
// y r (la estación y el radio de su círculo, de la app), seen, away y first (el estado de ParadaSola) y stopped: por qué
// paró ("user" con «Parar», "away" al irse, "limit" por las horas, "denied" o "error" al empezar). Sin stopped, la
// grabación no ha terminado: se cortó y se puede seguir.
public class GrabadorService extends Service {
    static final String START = "pistea.grabador.START", STOP = "pistea.grabador.STOP";
    static final String PREFS = "grabador";
    private static final String CHANNEL = "grabacion", ALERTS = "avisos";
    private static final int NOTIFICATION = 7001, ALERT = 7002;
    private static final long WAKE_WAIT = 2 * 60 * 1000L;

    interface Listener {
        void fix(long n, String row);
        void changed();
    }

    static volatile Listener listener;   // el plugin, mientras la app está abierta
    static volatile boolean running = false;
    static volatile boolean gps = true;
    static volatile int sats = -1;        // satélites usados en la última posición
    private static GrabadorService self;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager lm;
    private BufferedWriter out;
    private long id, since, count;
    private boolean revived, got;          // arrancado de nuevo por Android, y si ya ha llegado alguna posición
    private ParadaSola fin;
    private double lat, lon;
    private String name;
    private String text = "Toca para ver tu día. Puedes bloquear el teléfono.";

    static File dir(Context c) {
        File d = new File(c.getFilesDir(), "grabaciones");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            finish("user");
            return START_NOT_STICKY;
        }
        if (running) return START_STICKY;
        SharedPreferences p = prefs(this);
        revived = intent == null;   // Android lo vuelve a arrancar tras cerrarlo
        id = revived ? p.getLong("id", 0) : intent.getLongExtra("id", p.getLong("id", 0));
        if (id == 0 || (revived && p.contains("stopped"))) {   // nada que seguir
            stopSelf();
            return START_NOT_STICKY;
        }
        since = revived ? p.getLong("since", id) : intent.getLongExtra("since", p.getLong("since", id));
        name = p.getString("name", null);
        lat = Double.longBitsToDouble(p.getLong("lat", 0));
        lon = Double.longBitsToDouble(p.getLong("lon", 0));
        fin = new ParadaSola(p.getFloat("r", 0), p.getBoolean("seen", false), p.getLong("away", 0), p.getLong("first", 0));
        alerts().cancel(ALERT);   // el aviso de un corte o de un final anterior
        File file = new File(dir(this), id + ".csv");
        count = lines(file);      // al seguir una grabación, las posiciones se numeran a continuación de las que ya hay
        // Lo primero, el aviso fijo: Android cierra la app si un servicio pedido en primer plano tarda en ponerlo
        try {
            ServiceCompat.startForeground(this, NOTIFICATION, notification(),
                    Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        } catch (Exception e) {   // sin permiso de ubicación, o arrancado por Android con la app sin abrir (Android 14)
            if (revived) cut(); else finish("denied");
            return START_NOT_STICKY;
        }
        try {
            out = new BufferedWriter(new FileWriter(file, true));
        } catch (IOException e) {
            finish("error");
            return START_NOT_STICKY;
        }
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, location, Looper.getMainLooper());
            lm.registerGnssStatusCallback(gnss, new Handler(Looper.getMainLooper()));
        } catch (SecurityException | IllegalArgumentException e) {
            if (revived) cut(); else finish("denied");
            return START_NOT_STICKY;
        }
        gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        running = true;
        self = this;
        got = false;
        if (revived) handler.postDelayed(watch, WAKE_WAIT);
        changed();
        return START_STICKY;
    }

    // Arrancado de nuevo por Android: si en WAKE_WAIT no ha llegado ninguna posición, no le deja usar el GPS
    private final Runnable watch = () -> {
        if (running && !got) cut();
    };

    // Las líneas que ya tiene el fichero (las posiciones apuntadas antes de un corte)
    private static long lines(File f) {
        if (!f.exists()) return 0;
        long n = 0;
        byte[] b = new byte[65536];
        try (InputStream in = new FileInputStream(f)) {
            for (int k; (k = in.read(b)) > 0; ) for (int i = 0; i < k; i++) if (b[i] == '\n') n++;
        } catch (IOException ignored) {
        }
        return n;
    }

    private final LocationListener location = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location l) {
            if (!running) return;
            if (!got) {
                got = true;
                handler.removeCallbacks(watch);
            }
            String row = row(l);
            try {
                out.write(row);
                out.write('\n');
                out.flush();
            } catch (IOException ignored) {
                // sin sitio en el teléfono: la posición llega igual a la app si está abierta
            }
            Listener to = listener;
            if (to != null) to.fix(count, row);
            count++;
            // ¿Para sola? (irse de la estación, el tope de horas). Su estado se guarda al cambiar, por si Android la cierra
            double d = Double.NaN;
            if (fin.r > 0) {
                float[] m = new float[1];
                Location.distanceBetween(l.getLatitude(), l.getLongitude(), lat, lon, m);
                d = m[0];
            }
            boolean seen = fin.seen;
            long away = fin.away, first = fin.first;
            String why = fin.add(l.getTime(), d, l.hasAccuracy() ? l.getAccuracy() : Float.NaN);
            if (fin.seen != seen || fin.away != away || fin.first != first)
                prefs(GrabadorService.this).edit().putBoolean("seen", fin.seen).putLong("away", fin.away).putLong("first", fin.first).apply();
            if (why != null) finish(why);
        }

        @Override
        public void onProviderDisabled(@NonNull String provider) {
            gps = false;
            message("Activa la ubicación del teléfono para seguir grabando.");
            changed();
        }

        @Override
        public void onProviderEnabled(@NonNull String provider) {
            gps = true;
            changed();
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {
        }
    };

    private final GnssStatus.Callback gnss = new GnssStatus.Callback() {
        @Override
        public void onSatelliteStatusChanged(@NonNull GnssStatus status) {
            int used = 0;
            for (int i = 0; i < status.getSatelliteCount(); i++) if (status.usedInFix(i)) used++;
            sats = used;
        }
    };

    // Una línea del fichero: hora (ms), latitud, longitud, precisión (m), velocidad (m/s) y su precisión, rumbo (º) y su
    // precisión, altitud (m) y su precisión, satélites. Lo que el GPS no da, vacío. Double.toString usa siempre el punto
    private static boolean mock(Location l) {
        return Build.VERSION.SDK_INT >= 31 ? l.isMock() : l.isFromMockProvider();
    }

    private static String row(Location l) {
        boolean o = Build.VERSION.SDK_INT >= 26;
        return l.getTime() + "," + round(l.getLatitude(), 1e7) + "," + round(l.getLongitude(), 1e7) + ","
                + (l.hasAccuracy() ? round(l.getAccuracy(), 10) : "") + ","
                + (l.hasSpeed() ? round(l.getSpeed(), 100) : "") + ","
                + (o && l.hasSpeedAccuracy() ? round(l.getSpeedAccuracyMetersPerSecond(), 100) : "") + ","
                + (l.hasBearing() ? round(l.getBearing(), 10) : "") + ","
                + (o && l.hasBearingAccuracy() ? round(l.getBearingAccuracyDegrees(), 10) : "") + ","
                + (l.hasAltitude() ? round(l.getAltitude(), 10) : "") + ","
                + (o && l.hasVerticalAccuracy() ? round(l.getVerticalAccuracyMeters(), 10) : "") + ","
                + (sats >= 0 ? sats : "") + ","
                + (mock(l) ? "1" : "");   // ubicación simulada (apps que falsean el GPS): el servidor rechaza el día
    }

    private static String round(double v, double k) {
        return Double.toString(Math.round(v * k) / k);
    }

    private NotificationManager alerts() {
        return getSystemService(NotificationManager.class);
    }

    private PendingIntent openApp() {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private NotificationCompat.Builder builder() {
        NotificationManager nm = alerts();
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.canal_grabacion), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, GrabadorService.class).setAction(STOP), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_tracking)
                .setColor(0xFF006072)
                .setContentTitle("Grabando tu día de esquí")
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setUsesChronometer(true)
                .setShowWhen(true)
                .setWhen(since)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openApp())
                .addAction(0, "Parar", stop);
    }

    private android.app.Notification notification() {
        return builder().build();
    }

    // Un aviso que se queda al acabar la grabación (corte o final solo): tocarlo abre la app
    private void alert(String title, String body) {
        try {
            NotificationManager nm = alerts();
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(ALERTS) == null)
                nm.createNotificationChannel(new NotificationChannel(ALERTS, getString(R.string.canal_avisos), NotificationManager.IMPORTANCE_DEFAULT));
            nm.notify(ALERT, new NotificationCompat.Builder(this, ALERTS)
                    .setSmallIcon(R.drawable.ic_tracking)
                    .setColor(0xFF006072)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setCategory(NotificationCompat.CATEGORY_STATUS)
                    .setAutoCancel(true)
                    .setContentIntent(openApp())
                    .build());
        } catch (SecurityException ignored) {   // sin permiso de avisos: la app lo dice al abrirla
        }
    }

    // El texto del aviso fijo (las cifras del día, que manda la app)
    static void message(String text) {
        GrabadorService s = self;
        if (s == null || !running || text == null) return;
        s.text = text;
        s.alerts().notify(NOTIFICATION, s.notification());
    }

    static void changed() {
        Listener to = listener;
        if (to != null) to.changed();
    }

    // Deja de escuchar el GPS y cierra el fichero
    private void release() {
        running = false;
        self = null;
        handler.removeCallbacks(watch);
        if (lm != null) {
            lm.removeUpdates(location);
            lm.unregisterGnssStatusCallback(gnss);
        }
        try {
            if (out != null) out.close();
        } catch (IOException ignored) {
        }
        out = null;
    }

    // Deja de grabar y lo da por terminado (`why`, ver arriba). Si para sola, lo avisa
    private void finish(String why) {
        boolean was = running;
        release();
        if (was || !"user".equals(why))
            prefs(this).edit().putString("stopped", why).apply();
        String en = name == null ? "" : " en " + name;
        if ("away".equals(why))
            alert("Día terminado" + en, "Te has ido de la estación y la grabación se ha parado sola. Toca para guardar el día. Si vuelves a esquiar, «Retomar» sigue en el mismo día.");
        else if ("limit".equals(why))
            alert("Día terminado" + en, "Llevabas casi 16 horas grabando, lo más largo que se puede guardar. Toca para guardar el día.");
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        changed();
    }

    // Android lo ha vuelto a arrancar pero no le deja usar el GPS: se para sin darlo por terminado y avisa
    private void cut() {
        release();
        alert("Pistea ha dejado de grabar", "Android ha cerrado la grabación" + (name == null ? "" : " de tu día en " + name) + ". Toca para seguir grabando: lo grabado hasta ahora no se pierde.");
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        changed();
    }

    // Si Android lo cierra por su cuenta, la grabación queda cortada (sin «stopped»): la vuelve a arrancar (START_STICKY) y,
    // si no, la app la sigue al abrirse
    @Override
    public void onDestroy() {
        if (running) {
            release();
            changed();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
