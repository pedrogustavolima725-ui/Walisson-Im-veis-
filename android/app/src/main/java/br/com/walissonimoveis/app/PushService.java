package br.com.walissonimoveis.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/** Recebe as notificações push do servidor e mostra na tela; ao tocar, abre a página certa no app. */
public class PushService extends FirebaseMessagingService {
    static final String CHANNEL = "avisos";
    static final String PREFS = "push";

    @Override
    public void onNewToken(@NonNull String token) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("token", token).apply();
        MainActivity.onPushToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        String title = d.get("title");
        String body = d.get("body");
        if (title == null && msg.getNotification() != null) {
            title = msg.getNotification().getTitle();
            body = msg.getNotification().getBody();
        }
        if (title == null) return;
        show(this, title, body, d.get("link"));
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Avisos", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Leads, visitas, mensagens e propostas");
                nm.createNotificationChannel(ch);
            }
        }
    }

    static void show(Context ctx, String title, String body, String link) {
        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra("link", link == null ? "/" : link);
        int id = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pi = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_stat_notify)
                .setColor(0xFFC9A77C)
                .setContentTitle(title)
                .setContentText(body == null ? "" : body)
                .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        ctx.getSystemService(NotificationManager.class).notify(id, b.build());
    }
}
