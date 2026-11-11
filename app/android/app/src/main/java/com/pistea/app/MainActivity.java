package com.pistea.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GrabadorPlugin.class);   // el grabador del día (posiciones GPS en un fichero, con un servicio en primer plano)
        super.onCreate(savedInstanceState);
    }
}
