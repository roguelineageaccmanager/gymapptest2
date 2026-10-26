package com.roguelineage.rattracker;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;

/** User-invoked system camera. No camera/gallery permission or gallery writes. */
@CapacitorPlugin(name = "ProgressPhoto")
public class ProgressPhotoPlugin extends Plugin {
    private boolean busy;
    private File photoFile() { return new File(getContext().getCacheDir(), "progress-camera/picture.jpg"); }
    @PluginMethod public void takePicture(PluginCall call) {
        if (busy) { call.reject("Camera is already open"); return; }
        File file = photoFile();
        try {
            file.getParentFile().mkdirs();
            if (file.exists()) file.delete();
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri)
                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.setClipData(ClipData.newRawUri("Progress picture", uri));
            busy = true; startActivityForResult(call, intent, "pictureResult");
        } catch (Exception error) { busy = false; file.delete(); call.reject("Camera unavailable", error); }
    }
    @ActivityCallback private void pictureResult(PluginCall call, ActivityResult result) {
        File file = photoFile(); busy = false;
        if (call == null) { file.delete(); return; }
        if (result.getResultCode() != Activity.RESULT_OK) { file.delete(); call.reject("Photo cancelled"); return; }
        Bitmap bitmap = null, oriented = null;
        try {
            if (!file.isFile() || file.length() > 20 * 1024 * 1024) throw new IllegalArgumentException("Picture unavailable");
            BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getPath(), options);
            options.inSampleSize = 1;
            while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 1600) options.inSampleSize *= 2;
            options.inJustDecodeBounds = false;
            bitmap = BitmapFactory.decodeFile(file.getPath(), options);
            if (bitmap == null) throw new IllegalArgumentException("Picture unreadable");
            int orientation = new ExifInterface(file.getPath()).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1, -1); break;
                case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
                case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(270); matrix.postScale(-1, 1); break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(270); break;
                default: break;
            }
            oriented = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); oriented.compress(Bitmap.CompressFormat.JPEG, 85, bytes);
            JSObject value = new JSObject(); value.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
            call.resolve(value);
        } catch (Exception error) { call.reject("Picture unavailable", error); }
        finally { if (oriented != null && oriented != bitmap) oriented.recycle(); if (bitmap != null) bitmap.recycle(); file.delete(); }
    }
}
