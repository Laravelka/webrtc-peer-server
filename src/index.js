module.exports = WebrtcPeerServer

var inherits = require('inherits')
var EventEmitter = require('nanobus')

inherits(WebrtcPeerServer, EventEmitter)

function WebrtcPeerServer(io) {
    if (!(this instanceof WebrtcPeerServer)) return new WebrtcPeerServer(io)

    EventEmitter.call(this)

    io.on('connection', (socket) => {
        socket.on('webrtc-peer[discover]', this._onDiscover.bind(this, socket))
        socket.on('disconnect', this._onDisconnect.bind(this, socket));
    })
}

WebrtcPeerServer.prototype._onDiscover = function(socket, discoveryData) {
    const discoveryRequest = { socket, discoveryData }
    discoveryRequest.discover = (discoveryData = {}) => {
        socket.removeAllListeners('webrtc-peer[offer]');
        socket.removeAllListeners('webrtc-peer[signal]');
        socket.removeAllListeners('webrtc-peer[reject]');

        socket.emit('webrtc-peer[discover]', { id: socket.id, discoveryData })

        socket.on('webrtc-peer[offer]', this._onOffer.bind(this, socket))
        socket.on('webrtc-peer[signal]', this._onSignal.bind(this, socket))
        socket.on('webrtc-peer[reject]', this._onReject.bind(this, socket))
        socket.on('webrtc-peer[message]', this._onMessage.bind(this, socket))
    }

    if (this.listeners('discover').length === 0) {
        discoveryRequest.discover() // defaults to using socket.id for identification
    } else {
        this.emit('discover', discoveryRequest)
    }
}

WebrtcPeerServer.prototype._onOffer = function(socket, { sessionId, signal, target, metadata }) {
    const request = { initiator: socket.id, target, metadata, socket }
    request.forward = (metadata = request.metadata) => {
        socket.broadcast.to(target).emit('webrtc-peer[offer]', {
            initiator: socket.id,
            sessionId,
            signal,
            metadata
        })
    }

    if (this.listeners('request').length === 0) {
        request.forward()
    } else {
        this.emit('request', request)
    }
}

WebrtcPeerServer.prototype._onSignal = function(socket, { target, sessionId, signal, metadata }) {
    // misc. signaling data is always forwarded
    socket.broadcast.to(target).emit('webrtc-peer[signal]', {
        sessionId,
        signal,
        metadata
    })
}

WebrtcPeerServer.prototype._onReject = function(socket, { target, sessionId, metadata }) {
    // rejections are always forwarded
    socket.broadcast.to(target).emit('webrtc-peer[reject]', {
        sessionId,
        metadata
    })
}

WebrtcPeerServer.prototype._onDisconnect = function(socket) {
    this.emit('disconnect', socket)
}