package com.roguelineage.rattracker;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "WorkoutStatus", permissions = {
    @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class WorkoutStatusPlugin extends Plugin {
    @Override public void load() { opened(getActivity().getIntent()); }
    @Override protected void handleOnNewIntent(Intent intent) { opened(intent); }
    private void opened(Intent intent) {
        if (intent != null && intent.getBooleanExtra("openWorkout", false)) {
            intent.removeExtra("openWorkout");
            notifyListeners("openWorkout", new JSObject(), true);
        }
    }

    @PluginMethod public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult");
        } else permissionResult(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod public void update(PluginCall call) {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) { JSObject result = new JSObject(); result.put("enabled", false); call.resolve(result); return; }
        long startedAt = call.getLong("startedAt", 0L);
        long now = System.currentTimeMillis();
        if (startedAt <= 0 || startedAt > now || now - startedAt >= WorkoutStatusService.MAX_AGE) {
            stop(call); return;
        }
        Intent intent = new Intent(getContext(), WorkoutStatusService.class);
        intent.putExtra("startedAt", startedAt);
        intent.putExtra("title", bounded(call.getString("title", "Workout")));
        intent.putExtra("exercise", bounded(call.getString("exercise", "")));
        intent.putExtra("done", Math.max(0, Math.min(10000, call.getInt("done", 0))));
        intent.putExtra("total", Math.max(0, Math.min(10000, call.getInt("total", 0))));
        intent.putExtra("restUntil", Math.max(0L, Math.min(now + 3600000L, call.getLong("restUntil", 0L))));
        intent.putExtra("restEnabled", call.getBoolean("restEnabled", true));
        intent.putExtra("restVibration", call.getBoolean("restVibration", true));
        String sound = call.getString("restSound", "beep");
        intent.putExtra("restSound", sound.matches("beep|chime|bell|silent") ? sound : "beep");
        intent.putExtra("nextWorkout", bounded(call.getString("nextWorkout", "")));
        intent.putExtra("nextExercise", bounded(call.getString("nextExercise", "")));
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            JSObject result = new JSObject(); result.put("enabled", true); call.resolve(result);
        } catch (RuntimeException error) {
            // A new service must start while the app is visible. JS retries on return.
            call.reject("Workout notification unavailable", error);
        }
    }
    @PluginMethod public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), WorkoutStatusService.class));
        NotificationManagerCompat.from(getContext()).cancel(401);
        NotificationManagerCompat.from(getContext()).cancel(402);
        call.resolve();
    }
    @PluginMethod public void clearChatNotifications(PluginCall call) {
        android.app.NotificationManager manager = getContext().getSystemService(android.app.NotificationManager.class);
        for (android.service.notification.StatusBarNotification notification : manager.getActiveNotifications()) {
            String tag = notification.getTag();
            if (tag != null && tag.startsWith("gym-chat-")) manager.cancel(tag, notification.getId());
        }
        call.resolve();
    }
    private static String bounded(String value) {
        return value == null ? "" : value.substring(0, Math.min(value.length(), 100));
    }
}
