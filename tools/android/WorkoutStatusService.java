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

/** An explicitly started workout timer; no sensors, network, alarm or wake lock. */
public class WorkoutStatusService extends Service {
    static final long MAX_AGE = 12 * 3600000L;
    private static final String CHANNEL = "workout_status";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long startedAt, restUntil;
    private int done, total;
    private String title = "Workout", exercise = "";
    private boolean resting;
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            if (System.currentTimeMillis() - startedAt >= MAX_AGE) { stopSelf(); return; }
            boolean nowResting = restUntil > System.currentTimeMillis();
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
        startedAt = intent.getLongExtra("startedAt", 0);
        if (startedAt <= 0 || System.currentTimeMillis() - startedAt >= MAX_AGE) { stopSelf(); return START_NOT_STICKY; }
        title = intent.getStringExtra("title");
        exercise = intent.getStringExtra("exercise");
        restUntil = intent.getLongExtra("restUntil", 0);
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
        String text = (resting ? "Rest · " : "") + (exercise == null || exercise.isEmpty() ? progress : exercise + " · " + progress);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_workout_notification)
            .setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text))
            .setContentIntent(tap).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setWhen(resting ? restUntil : startedAt).setShowWhen(true).setUsesChronometer(true);
        if (Build.VERSION.SDK_INT >= 24) builder.setChronometerCountDown(resting);
        if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(Math.max(1, startedAt + MAX_AGE - System.currentTimeMillis()));
        startForeground(401, builder.build());
    }
    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        stopForeground(true);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
