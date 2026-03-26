// debug.js — первый скрипт в index.html

// Блокируем live-server reload
const _WS = window.WebSocket;
window.WebSocket = function(url, protocols) {
    const ws = protocols ? new _WS(url, protocols) : new _WS(url);
    ws.addEventListener('message', function(msg) {
        if (msg.data === 'reload') {
            console.warn('[DEBUG] Live-server reload BLOCKED');
        }
    });
    return ws;
};
window.WebSocket.prototype = _WS.prototype;
window.WebSocket.CONNECTING = _WS.CONNECTING;
window.WebSocket.OPEN = _WS.OPEN;
window.WebSocket.CLOSING = _WS.CLOSING;
window.WebSocket.CLOSED = _WS.CLOSED;

console.log('[DEBUG] Live-server reload blocked');