package com.huie.sgsdiy;

import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 原生流式 AI 桥接：不依赖额外 HTTP 库，直接使用 HttpURLConnection
 * 读取 OpenAI 兼容接口的 SSE 流，并通过 notifyListeners 把增量推到 WebView。
 */
@CapacitorPlugin(name = "AiStream")
public class AiStreamPlugin extends Plugin {

    private final Map<String, HttpURLConnection> connections = new ConcurrentHashMap<>();
    private final Map<String, Boolean> cancels = new ConcurrentHashMap<>();

    @PluginMethod
    public void stream(PluginCall call) {
        final String requestId = call.getString("requestId");
        final String baseUrl = call.getString("baseUrl");
        final String apiKey = call.getString("apiKey");
        final String model = call.getString("model");
        final String payload = call.getString("payload");

        if (requestId == null || baseUrl == null || model == null || payload == null) {
            call.reject("参数不完整");
            return;
        }

        JSObject started = new JSObject();
        started.put("requestId", requestId);
        started.put("started", true);
        call.resolve(started);

        Thread thread = new Thread(() -> doStream(requestId, baseUrl, apiKey, payload));
        thread.setDaemon(true);
        thread.start();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        String requestId = call.getString("requestId");
        if (requestId == null) {
            call.reject("缺少 requestId");
            return;
        }
        cancels.put(requestId, true);
        HttpURLConnection conn = connections.get(requestId);
        if (conn != null) {
            try { conn.disconnect(); } catch (Exception ignored) {}
        }
        call.resolve();
    }
    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        boolean keep = Boolean.TRUE.equals(call.getBoolean("keepScreenOn"));
        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                if (keep) {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }
        call.resolve();
    }

    private void emit(final String event, final JSObject data) {
        bridge.executeOnMainThread(() -> notifyListeners(event, data));
    }

    private void finish(String requestId) {
        connections.remove(requestId);
        cancels.remove(requestId);
    }

    private void doStream(String requestId, String baseUrl, String apiKey, String payload) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(baseUrl);
            conn = (HttpURLConnection) url.openConnection();
            connections.put(requestId, conn);

            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(0);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "text/event-stream");
            if (apiKey != null && !apiKey.isEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            }

            byte[] body = payload.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
                os.flush();
            }

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                String err = readBody(conn.getErrorStream());
                emitError(requestId, "HTTP " + status + (err != null && !err.isEmpty() ? "：" + err : ""));
                finish(requestId);
                return;
            }

            StringBuilder reasoningFull = new StringBuilder();
            StringBuilder contentFull = new StringBuilder();
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(new BufferedInputStream(conn.getInputStream()), StandardCharsets.UTF_8));
            String line;
            while ((line = reader.readLine()) != null) {
                if (Boolean.TRUE.equals(cancels.get(requestId))) {
                    emitDone(requestId, true);
                    finish(requestId);
                    return;
                }
                if (line.startsWith("data:")) {
                    String data = line.substring(5).trim();
                    if (data.isEmpty()) continue;
                    if ("[DONE]".equals(data)) {
                        emitDone(requestId, false);
                        finish(requestId);
                        return;
                    }
                    try {
                        JSONObject obj = new JSONObject(data);
                        JSONArray choices = obj.optJSONArray("choices");
                        if (choices == null || choices.length() == 0) continue;
                        JSONObject choice = choices.optJSONObject(0);
                        if (choice == null) continue;
                        JSONObject delta = choice.optJSONObject("delta");
                        if (delta == null) continue;

                        String reasoning = strOf(delta.opt("reasoning_content"));
                        if (reasoning == null) reasoning = strOf(delta.opt("reasoning"));
                        if (reasoning != null && !reasoning.isEmpty()) {
                            reasoningFull.append(reasoning);
                            emitReasoning(requestId, reasoning, reasoningFull.toString());
                        }

                        String content = strOf(delta.opt("content"));
                        if (content != null && !content.isEmpty()) {
                            contentFull.append(content);
                            emitContent(requestId, content, contentFull.toString());
                        }
                    } catch (JSONException ignored) {
                        // 忽略不完整/非 JSON 的流式行（如空行、注释）
                    }
                }
            }
            if (Boolean.TRUE.equals(cancels.get(requestId))) {
                emitDone(requestId, true);
            } else {
                emitDone(requestId, false);
            }
            finish(requestId);
        } catch (Exception e) {
            if (Boolean.TRUE.equals(cancels.get(requestId))) {
                emitDone(requestId, true);
            } else {
                emitError(requestId, String.valueOf(e.getMessage()));
            }
            finish(requestId);
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
    }

    private String readBody(InputStream in) {
        if (in == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            char[] buf = new char[2048];
            int n;
            while ((n = r.read(buf)) != -1) sb.append(buf, 0, n);
        } catch (Exception ignored) {}
        return sb.length() > 400 ? sb.substring(0, 400) : sb.toString();
    }

    private void emitReasoning(String requestId, String chunk, String full) {
        JSObject o = new JSObject();
        o.put("requestId", requestId);
        o.put("chunk", chunk);
        o.put("full", full);
        emit("reasoning", o);
    }

    private void emitContent(String requestId, String chunk, String full) {
        JSObject o = new JSObject();
        o.put("requestId", requestId);
        o.put("chunk", chunk);
        o.put("full", full);
        emit("content", o);
    }

    private void emitDone(String requestId, boolean cancelled) {
        JSObject o = new JSObject();
        o.put("requestId", requestId);
        o.put("done", true);
        o.put("cancelled", cancelled);
        emit("done", o);
    }

    private void emitError(String requestId, String message) {
        JSObject o = new JSObject();
        o.put("requestId", requestId);
        o.put("error", message == null ? "未知错误" : message);
        emit("error", o);
    }

    private static String strOf(Object v) {
        if (v == null || v == JSONObject.NULL) return null;
        if (v instanceof String) return (String) v;
        return String.valueOf(v);
    }
}
