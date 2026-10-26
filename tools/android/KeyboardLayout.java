package com.roguelineage.rattracker;

import android.graphics.Rect;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/** Preserve adjustResize on edge-to-edge WebViews that remain behind the IME. */
public final class KeyboardLayout {
    public static void install(BridgeActivity activity) {
        View content = activity.findViewById(android.R.id.content);
        View web = activity.getBridge().getWebView();
        int restingHeight = web.getLayoutParams().height;
        boolean[] resized = { false };
        content.getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            Rect visible = new Rect();
            content.getWindowVisibleDisplayFrame(visible);
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(content);
            boolean ime = insets != null && insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottom = visible.bottom;
            if (ime && Build.VERSION.SDK_INT >= 30) {
                bottom = Math.min(bottom, activity.getWindowManager().getCurrentWindowMetrics().getBounds().bottom
                    - insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
            }
            int[] position = new int[2]; web.getLocationOnScreen(position);
            int available = bottom - position[1];
            ViewGroup.LayoutParams params = web.getLayoutParams();
            if (ime && available > 0 && (web.getHeight() > available + 1 || (resized[0] && params.height != available))) {
                params.height = available; web.setLayoutParams(params); resized[0] = true;
            } else if (!ime && resized[0]) {
                params.height = restingHeight; web.setLayoutParams(params); resized[0] = false;
            }
        });
    }
    private KeyboardLayout() {}
}
