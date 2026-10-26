package com.roguelineage.rattracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.net.Uri;
import android.media.AudioAttributes;

/** An explicitly started workout timer; no sensors, network, alarm or wake lock. */
public class WorkoutStatusService extends Service {
    static final long MAX_AGE = 12 * 3600000L;
    private static final String CHANNEL = "workout_status";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long startedAt, restUntil, alertedUntil;
    private int done, total;
    private String title = "Workout", exercise = "";
    private String sound = "beep", nextWorkout = "", nextExercise = "";
    private boolean resting, ready, restEnabled = true, vibrate = true;
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            if (System.currentTimeMillis() - startedAt >= MAX_AGE) { stopSelf(); return; }
            boolean nowResting = restUntil > System.currentTimeMillis();
            alertIfDue();
            if (nowResting != resting) post();
            handler.postDelayed(this, nowResting ? 1000 : 30000);
        }
    };
    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Active workout", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null);
            channel.enableVibration(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        long nextStart = intent.getLongExtra("startedAt", 0);
        if (nextStart != startedAt) { restUntil = 0; alertedUntil = 0; ready = false; getSystemService(NotificationManager.class).cancel(402); }
        startedAt = nextStart;
        if (startedAt <= 0 || System.currentTimeMillis() - startedAt >= MAX_AGE) { stopSelf(); return START_NOT_STICKY; }
        restEnabled = intent.getBooleanExtra("restEnabled", true);
        if (restEnabled) alertIfDue();
        else { ready = false; getSystemService(NotificationManager.class).cancel(402); }
        title = intent.getStringExtra("title");
        exercise = intent.getStringExtra("exercise");
        restUntil = intent.getLongExtra("restUntil", 0);
        if (restUntil > System.currentTimeMillis()) { ready = false; getSystemService(NotificationManager.class).cancel(402); }
        if (!restEnabled) restUntil = 0;
        sound = intent.getStringExtra("restSound");
        vibrate = intent.getBooleanExtra("restVibration", true);
        nextWorkout = intent.getStringExtra("nextWorkout");
        nextExercise = intent.getStringExtra("nextExercise");
        done = intent.getIntExtra("done", 0); total = intent.getIntExtra("total", 0);
        post();
        handler.removeCallbacks(refresh);
        handler.postDelayed(refresh, 1000);
        // Never resurrect a finished workout after force-stop/restart.
        return START_NOT_STICKY;
    }
    private void post() {
        resting = restUntil > System.currentTimeMillis();
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("openWorkout", true);
        PendingIntent tap = PendingIntent.getActivity(this, 401, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String progress = done + "/" + total + " sets";
        String text = (resting ? "Rest · " : ready ? "Rest ready · " : "") + (exercise == null || exercise.isEmpty() ? progress : exercise + " · " + progress);
        String details = text;
        if (nextExercise != null && !nextExercise.isEmpty()) details += "\nNext exercise · " + nextExercise;
        if (nextWorkout != null && !nextWorkout.isEmpty()) details += "\nNext workout · " + nextWorkout;
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_workout_notification)
            .setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(details))
            .setContentIntent(tap).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setWhen(resting ? restUntil : startedAt).setShowWhen(true).setUsesChronometer(true);
        if (Build.VERSION.SDK_INT >= 24) builder.setChronometerCountDown(resting);
        if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(Math.max(1, startedAt + MAX_AGE - System.currentTimeMillis()));
        startForeground(401, builder.build());
    }
    private void alertIfDue() {
        long now = System.currentTimeMillis();
        if (!restEnabled || restUntil <= 0 || restUntil > now || alertedUntil == restUntil) return;
        alertedUntil = restUntil;
        ready = true;
        NotificationManager manager = getSystemService(NotificationManager.class);
        String choice = sound != null && sound.matches("beep|chime|bell|silent") ? sound : "beep";
        String channelId = "rest_ready_v1_" + choice + (vibrate ? "_vibrate" : "_quiet");
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(channelId, "Rest ready · " + choice + (vibrate ? " + vibration" : ""), NotificationManager.IMPORTANCE_HIGH);
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            // Resource NAME is stable across releases; never persist a numeric resource ID.
            Uri uri = "silent".equals(choice) ? null : Uri.parse("android.resource://" + getPackageName() + "/raw/rest_" + choice);
            channel.setSound(uri, attributes); channel.enableVibration(vibrate);
            manager.createNotificationChannel(channel);
        }
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("openWorkout", true);
        PendingIntent tap = PendingIntent.getActivity(this, 401, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder alert = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, channelId) : new Notification.Builder(this);
        alert.setSmallIcon(R.drawable.ic_workout_notification).setContentTitle("Rest ready")
            .setContentText(exercise == null || exercise.isEmpty() ? title : exercise + " · " + title)
            .setContentIntent(tap).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PRIVATE);
        if (Build.VERSION.SDK_INT >= 26) alert.setTimeoutAfter(60000);
        manager.notify(402, alert.build());
    }
    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopForeground(true);
        getSystemService(NotificationManager.class).cancel(402);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
