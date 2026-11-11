package com.pistea.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

// Lo que la web (gps.js) puede pedirle al grabador: empezar y parar, cómo está, las posiciones apuntadas desde una dada,
// borrar una grabación ya guardada en la app, el texto del aviso fijo, que Android no la duerma (ahorro de batería), que
// la pantalla no se apague (el velocímetro) y abrir los ajustes. Manda en directo «fix» con cada posición y «state»
// cuando cambia algo (empieza, para, se apaga el GPS).
@CapacitorPlugin(
        name = "Grabador",
        permissions = {
                @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
                @Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})
        }
)
public class GrabadorPlugin extends Plugin implements GrabadorService.Listener {

    @Override
    public void load() {
        GrabadorService.listener = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (GrabadorService.listener == this) GrabadorService.listener = null;
    }

    @Override
    public void fix(long n, String row) {
        JSObject o = new JSObject();
        o.put("n", n);
        o.put("row", row);
        notifyListeners("fix", o);
    }

    @Override
    public void changed() {
        notifyListeners("state", status());
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(GrabadorService.PREFS, Context.MODE_PRIVATE);
    }

    private boolean granted(String p) {
        return ContextCompat.checkSelfPermission(getContext(), p) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject status() {
        Context c = getContext();
        SharedPreferences p = prefs();
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        JSObject o = new JSObject();
        long id = p.getLong("id", 0);
        o.put("id", id == 0 ? null : id);
        o.put("recording", GrabadorService.running);
        o.put("stopped", p.getString("stopped", null));
        o.put("allowed", granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION));
        o.put("precise", granted(Manifest.permission.ACCESS_FINE_LOCATION));
        o.put("gps", lm != null && lm.isProviderEnabled(LocationManager.GPS_PROVIDER));
        o.put("battery", pm == null || pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        o.put("sats", GrabadorService.sats);
        return o;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void start(PluginCall call) {
        boolean notify = Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED;
        if (getPermissionState("location") != PermissionState.GRANTED || !notify) {
            requestPermissionForAliases(new String[]{"location", "notifications"}, call, "afterPermissions");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterPermissions(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            // Con la ubicación «aproximada» Android no da el GPS: se dice tal cual, para que se active la precisa
            if (granted(Manifest.permission.ACCESS_COARSE_LOCATION)) call.reject("Ubicación aproximada", "approximate");
            else call.reject("Sin permiso de ubicación", "denied");
            return;
        }
        begin(call);   // sin permiso de avisos se graba igual; solo no se ve el aviso fijo
    }

    private void begin(PluginCall call) {
        if (GrabadorService.running) {
            call.resolve(status());
            return;
        }
        LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null || !lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            call.reject("La ubicación del teléfono está apagada", "off");
            return;
        }
        long id = System.currentTimeMillis();
        prefs().edit().putLong("id", id).remove("stopped").apply();
        Long since = call.getLong("since", id);   // desde cuándo cuenta el reloj del aviso (el principio del día)
        Intent i = new Intent(getContext(), GrabadorService.class).setAction(GrabadorService.START).putExtra("id", id).putExtra("since", since == null ? id : since);
        ContextCompat.startForegroundService(getContext(), i);
        JSObject o = status();
        o.put("recording", true);
        call.resolve(o);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (GrabadorService.running)
            getContext().startService(new Intent(getContext(), GrabadorService.class).setAction(GrabadorService.STOP));
        call.resolve();
    }

    // Las posiciones apuntadas en la grabación `id` desde la número `from`: { rows: [línea…], next }
    @PluginMethod
    public void read(PluginCall call) {
        Long id = call.getLong("id");
        int from = call.getInt("from", 0);
        JSArray rows = new JSArray();
        int n = 0;
        File f = new File(GrabadorService.dir(getContext()), id + ".csv");
        if (id != null && f.exists()) {
            try (BufferedReader in = new BufferedReader(new FileReader(f))) {
                for (String line; (line = in.readLine()) != null; n++) if (n >= from) rows.put(line);
            } catch (IOException e) {
                call.reject("No se ha podido leer la grabación", "read");
                return;
            }
        }
        JSObject o = new JSObject();
        o.put("rows", rows);
        o.put("next", Math.max(n, from));
        call.resolve(o);
    }

    // La app ya ha guardado esa grabación: se borra el fichero
    @PluginMethod
    public void clear(PluginCall call) {
        Long id = call.getLong("id");
        if (id != null) {
            new File(GrabadorService.dir(getContext()), id + ".csv").delete();
            if (prefs().getLong("id", 0) == id && !GrabadorService.running) prefs().edit().clear().apply();
        }
        call.resolve();
    }

    @PluginMethod
    public void message(PluginCall call) {
        GrabadorService.message(call.getString("text"));
        call.resolve();
    }

    // Que el ahorro de batería no duerma la grabación: Android pregunta con su propio diálogo
    @PluginMethod
    public void battery(PluginCall call) {
        Context c = getContext();
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(c.getPackageName())) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + c.getPackageName())));
            } catch (Exception e) {
                getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            }
        }
        call.resolve();
    }

    // La pantalla encendida (con el velocímetro delante) o no
    @PluginMethod
    public void awake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    // Los ajustes de la app (permisos) o los de ubicación del teléfono
    @PluginMethod
    public void settings(PluginCall call) {
        Intent i = "gps".equals(call.getString("what"))
                ? new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
        getActivity().startActivity(i);
        call.resolve();
    }
}
