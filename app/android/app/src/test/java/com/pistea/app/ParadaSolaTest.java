package com.pistea.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

// Cuándo para sola la grabación (ParadaSola): una posición por minuto, con la distancia al centro de una estación de radio 5 km
public class ParadaSolaTest {
    private static final long MIN = 60 * 1000L, T0 = 1_800_000_000_000L;
    private static final double R = 5000;

    // n minutos a la distancia d (m) desde el minuto m0; devuelve la primera razón para parar, o null
    private static String run(ParadaSola p, int m0, int n, double d, float acc) {
        for (int i = 0; i < n; i++) {
            String why = p.add(T0 + (m0 + i) * MIN, d, acc);
            if (why != null) return why;
        }
        return null;
    }

    @Test
    public void unDiaNormalNoPara() {
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 8 * 60, 1500, 10));
        assertTrue(p.seen);
    }

    @Test
    public void volverACasaPara() {
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 60, 2000, 10));             // esquiando
        assertNull(run(p, 60, 15, 9000, 10));            // 14 min lejos: aún no (la primera posición lejos marca el inicio)
        assertEquals("away", run(p, 75, 5, 9000, 10));   // al cumplir 15
    }

    @Test
    public void lejosSinHaberLlegadoNoPara() {   // de camino a la estación, dos horas en coche
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 120, 40000, 10));
        assertFalse(p.seen);
        assertNull(run(p, 120, 60, 1000, 10));   // y luego un día normal
    }

    @Test
    public void comerJustoFueraNoPara() {   // entre el círculo y el margen de 2 km: no cuenta como irse
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 30, 1000, 10));
        assertNull(run(p, 30, 90, 6500, 10));
        assertEquals(0, p.away);
    }

    @Test
    public void unRatoLejosYVolverNoPara() {   // 10 min lejos y de vuelta: la cuenta empieza de cero
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 30, 1000, 10));
        assertNull(run(p, 30, 10, 9000, 10));
        assertNull(run(p, 40, 5, 1000, 10));
        assertEquals(0, p.away);
        assertNull(run(p, 45, 14, 9000, 10));
    }

    @Test
    public void posicionesMalasNoCuentan() {   // lejos pero con 300 m de error, o sin error conocido
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 30, 1000, 10));
        assertNull(run(p, 30, 40, 9000, 300));
        assertNull(run(p, 70, 40, 9000, Float.NaN));
        assertEquals(0, p.away);
    }

    @Test
    public void topeDeHoras() {   // 15 h 45 min desde la primera posición, aunque siga en la estación
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 15 * 60 + 44, 1000, 10));
        assertEquals("limit", run(p, 15 * 60 + 44, 5, 1000, 10));
    }

    @Test
    public void sinCirculoSoloElTope() {
        ParadaSola p = new ParadaSola(0, false, 0, 0);
        assertNull(run(p, 0, 120, 90000, 10));
        assertEquals("limit", run(p, 120, 16 * 60, 90000, 10));
    }

    @Test
    public void elEstadoSigueTrasReiniciar() {   // Android cierra el servicio a los 10 min lejos; al volver, siguen contando
        ParadaSola p = new ParadaSola(R, false, 0, 0);
        assertNull(run(p, 0, 30, 1000, 10));
        assertNull(run(p, 30, 10, 9000, 10));
        ParadaSola q = new ParadaSola(R, p.seen, p.away, p.first);
        assertEquals("away", run(q, 40, 10, 9000, 10));
    }
}
