package com.roguelineage.rattracker;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/** Wait for token deletion before a new account can register this installation. */
@CapacitorPlugin(name = "ChatPush")
public class ChatPushPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject(); result.put("configured", !FirebaseApp.getApps(getContext()).isEmpty()); call.resolve(result);
    }
    @PluginMethod public void unregister(PluginCall call) {
        if (FirebaseApp.getApps(getContext()).isEmpty()) { call.resolve(); return; }
        FirebaseMessaging messaging = FirebaseMessaging.getInstance(); messaging.setAutoInitEnabled(false);
        messaging.deleteToken().addOnCompleteListener(task -> {
            if (task.isSuccessful()) call.resolve(); else call.reject("Could not unregister notifications");
        });
    }
}
