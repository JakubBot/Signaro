package com.signaro.backend.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Component
public class SignalingHandler extends TextWebSocketHandler {
    private final ConcurrentHashMap<String, WebSocketSession> jsClients = new ConcurrentHashMap<>();
    private final AtomicReference<WebSocketSession> pythonClient = new AtomicReference<>();

    String clientId = "a89das687cz"; // for 1 person, for testing purposes

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // prosty JWT mockup: ?token=XYZ w query param
        String query = session.getUri().getQuery(); // np. token=XYZ
        Map<String, String> params = Arrays.stream(query != null ? query.split("&") : new String[0])
                .map(s -> s.split("=", 2))
                .filter(arr -> arr.length == 2)
                .collect(Collectors.toMap(arr -> arr[0], arr -> arr[1]));

        String clientType = params.get("client");
        System.out.println("clientType " + clientType);

        String token = params.get("token");
//        if (token == null || !mockVerifyJwt(token)) {
//            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid JWT"));
//            return;
//        }
//        String clientId = extractClientIdFromJwt(token);


//        ws://localhost:8080/stream?client=python
//        ws://localhost:8080/stream?client=js&token=1asd21
        if ("python".equals(clientType)) {
            pythonClient.set(session);
            System.out.println("Python connected");
        } else {
            jsClients.put(clientId, session);
            System.out.println("JS client connected: " + clientId);
        }
    }
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        if (session.equals(pythonClient.get())) {
            // stream to JS clients
//            String clientId = extractClientIdFromPayload(payload); // we will have to extract 'to' from payload
            WebSocketSession jsClient = jsClients.get(clientId);
            if (jsClient != null && jsClient.isOpen()) {
                jsClient.sendMessage(new TextMessage(payload));
            } else {
                System.out.println("Target JS session not ready yet: " + clientId);
            }
        } else {
            // stream to python
            WebSocketSession python = pythonClient.get();

//            String clientId = getClientIdForSession(session);
            String payloadWithFrom = addFromToPayload(payload, clientId);

            if (python != null && python.isOpen()) {
                python.sendMessage(new TextMessage(payloadWithFrom));
            } else {
                System.out.println("Python not connected");
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        if (session.equals(pythonClient.get())) {
            pythonClient.set(null);
        } else {
            jsClients.entrySet().removeIf(entry -> entry.getValue().equals(session));
        }
    }

    public String addFromToPayload(String payload, String clientId) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            ObjectNode node = (ObjectNode) mapper.readTree(payload);
            node.put("from", clientId);  // add "from" field with clientId
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            // return original payload if parsing fails
            return payload;
        }
    }
}
