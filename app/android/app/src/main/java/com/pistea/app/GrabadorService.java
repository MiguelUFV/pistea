package com.pistea.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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
import java.io.FileWriter;
import java.io.IOException;

// El grabador del día: un servicio en primer plano (con su aviso fijo) que pide al GPS del teléfono una posición por
// segundo y apunta cada una en un fichero, en cuanto llega. La app (la web, en GrabadorPlugin) las recibe en directo
// mientras está abierta y, si Android la cierra o se quita de las recientes, el servicio sigue grabando y la app lee lo
// que se ha perdido al volver. Se usa el GPS tal cual (no el proveedor «fused» de Google): da la velocidad Doppler y su
// precisión sin suavizados escondidos, y el filtro está en la app (filter.js).
public class GrabadorService extends Service {
    static final String START = "pistea.grabador.START", STOP = "pistea.grabador.STOP";
    static final String PREFS = "grabador";
    private static final String CHANNEL = "grabacion";
    private static final int NOTIFICATION = 7001;

    interface Listener {
        void fix(long n, String row);
        void changed();
    }

    static volatile Listener listener;   // el plugin, mientras la app está abierta
    static volatile boolean running = false;
    static volatile boolean gps = true;
    static volatile int sats = -1;        // satélites usados en la última posición
    private static GrabadorService self;

    private LocationManager lm;
    private BufferedWriter out;
    private long id, since, count, away = 0;
    private boolean been = false;   // ya se ha estado en Valdesquí en esta grabación
    // Valdesquí, para dejar de grabar solo a la vuelta: a más de 6 km durante 15 min, tras haber estado allí
    private static final double LAT = 40.80, LON = -3.965;
    private static final float FAR = 6000;
    private static final long AWAY = 15 * 60 * 1000;
    private String text = "Toca para ver tu día. Puedes bloquear el teléfono.";

    static File dir(Context c) {
        File d = new File(c.getFilesDir(), "grabaciones");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) {
            finish("user");
            return START_NOT_STICKY;
        }
        if (running || intent == null) return START_NOT_STICKY;
        id = intent.getLongExtra("id", System.currentTimeMillis());
        since = intent.getLongExtra("since", id);
        count = 0;
        away = 0;
        been = false;
        // Lo primero, el aviso fijo: Android cierra la app si un servicio pedido en primer plano tarda en ponerlo
        try {
            ServiceCompat.startForeground(this, NOTIFICATION, notification(),
                    Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        } catch (Exception e) {   // Android no deja: sin permiso de ubicación o la app no estaba a la vista
            finish("denied");
            return START_NOT_STICKY;
        }
        try {
            out = new BufferedWriter(new FileWriter(new File(dir(this), id + ".csv"), true));
        } catch (IOException e) {
            finish("error");
            return START_NOT_STICKY;
        }
        lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, location, Looper.getMainLooper());
            lm.registerGnssStatusCallback(gnss, new Handler(Looper.getMainLooper()));
        } catch (SecurityException | IllegalArgumentException e) {
            finish("denied");
            return START_NOT_STICKY;
        }
        gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER);
        running = true;
        self = this;
        changed();
        return START_NOT_STICKY;
    }

    private final LocationListener location = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location l) {
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
                + (sats >= 0 ? sats : "");
    }

    private static String round(double v, double k) {
        return Double.toString(Math.round(v * k) / k);
    }

    private NotificationCompat.Builder builder() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.canal_grabacion), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
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
                .setContentIntent(content)
                .addAction(0, "Parar", stop);
    }

    private android.app.Notification notification() {
        return builder().build();
    }

    // El texto del aviso fijo (las cifras del día, que manda la app)
    static void message(String text) {
        GrabadorService s = self;
        if (s == null || !running || text == null) return;
        s.text = text;
        s.getSystemService(NotificationManager.class).notify(NOTIFICATION, s.notification());
    }

    static void changed() {
        Listener to = listener;
        if (to != null) to.changed();
    }

    // Deja de grabar. `why` queda apuntado para la app: "user" (desde el aviso o la app), "auto" (al irse de Valdesquí),
    // "denied", "error"
    private void finish(String why) {
        boolean was = running;
        running = false;
        self = null;
        if (lm != null) {
            lm.removeUpdates(location);
            lm.unregisterGnssStatusCallback(gnss);
        }
        try {
            if (out != null) out.close();
        } catch (IOException ignored) {
        }
        out = null;
        if (was || !"user".equals(why))
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("stopped", why).apply();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        changed();
    }

    // Si Android para el servicio por su cuenta, la grabación queda cortada (sin «stopped»): la app lo dice al volver
    @Override
    public void onDestroy() {
        if (running) {
            running = false;
            self = null;
            if (lm != null) {
                lm.removeUpdates(location);
                lm.unregisterGnssStatusCallback(gnss);
            }
            try {
                if (out != null) out.close();
            } catch (IOException ignored) {
            }
            changed();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
