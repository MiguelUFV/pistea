package com.pistea.app;

// Cuándo para sola la grabación. Lo decide el servicio con cada posición, sin red ni la app abierta:
//  - al irse de la estación: tras haber estado dentro de su círculo (el de estaciones_geo.json, el mismo con el que el
//    servidor comprueba que el día es de esa estación), 15 min seguidos a más de 2 km fuera de él. Comer en el pueblo de al
//    lado o un fuera de pista que se sale un poco no la paran; volver a casa, sí;
//  - antes de 16 horas desde la primera posición, que es lo más largo que el servidor acepta guardar.
// Las posiciones con más de 100 m de error no cuentan para la distancia. Sin el círculo (la app no lo tenía, por ejemplo sin
// conexión), solo el tope de horas. El estado (seen, away, first) lo guarda el servicio en el teléfono para que siga igual si
// Android lo cierra y lo vuelve a arrancar.
final class ParadaSola {
    static final long AWAY = 15 * 60 * 1000L;                 // ms seguidos fuera
    static final double MARGIN = 2000;                         // m más allá del círculo
    static final long LIMIT = (16 * 60 - 15) * 60 * 1000L;     // 15 h 45 min: el servidor no guarda días de más de 16 h
    static final float BAD = 100;                              // m de error a partir de los que una posición no cuenta

    final double r;    // radio del círculo de la estación (m); 0 = sin él
    boolean seen;      // ya ha estado dentro
    long away, first;  // desde cuándo está lejos (0 = no lo está) y la hora de la primera posición (ms)

    ParadaSola(double r, boolean seen, long away, long first) {
        this.r = r;
        this.seen = seen;
        this.away = away;
        this.first = first;
    }

    // La siguiente posición: hora (ms), distancia al centro de la estación (m) y su error (m; NaN si no lo trae).
    // Devuelve por qué parar ("away", "limit") o null para seguir
    String add(long t, double d, float acc) {
        if (first == 0) first = t;
        if (t - first >= LIMIT) return "limit";
        if (r <= 0 || !(acc <= BAD)) return null;
        if (d <= r) {
            seen = true;
            away = 0;
        } else if (seen && d > r + MARGIN) {
            if (away == 0) away = t;
            else if (t - away >= AWAY) return "away";
        } else away = 0;
        return null;
    }
}
