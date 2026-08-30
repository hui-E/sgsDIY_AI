package com.huie.sgsdiy;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.HashSet;
import java.util.Set;

/**
 * 相册工具：提供“同名文件不覆盖、自动生成副本序号”的辅助方法。
 */
@CapacitorPlugin(name = "AlbumTools")
public class AlbumToolsPlugin extends Plugin {

    @PluginMethod
    public void nextFileName(PluginCall call) {
        String dir = call.getString("albumDir");
        String baseName = call.getString("baseName");
        if (dir == null || baseName == null || baseName.isEmpty()) {
            call.reject("参数不完整");
            return;
        }

        File folder = new File(dir);
        Set<String> used = new HashSet<>();
        String[] entries = folder.list();
        if (entries != null) {
            for (String e : entries) {
                String lower = e.toLowerCase();
                if (lower.endsWith(".jpeg") || lower.endsWith(".jpg") || lower.endsWith(".png")) {
                    int dot = e.lastIndexOf('.');
                    String stem = dot > 0 ? e.substring(0, dot) : e;
                    used.add(stem);
                }
            }
        }

        String candidate = baseName;
        int i = 0;
        while (used.contains(candidate)) {
            i++;
            candidate = baseName + "_" + i;
        }

        JSObject o = new JSObject();
        o.put("name", candidate);
        call.resolve(o);
    }
}