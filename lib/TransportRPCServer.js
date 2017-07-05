'use strict'

const http = require('http')
const https = require('https')
const assert = require('assert')

const Base = require('grenache-nodejs-base')

class TransportRPCServer extends Base.TransportRPCServer {
  constructor (client, conf) {
    super(client, conf)
    this.conf = conf

    this.init()
  }

  getSocket (secure) {
    if (!secure) {
      return http.createServer()
    }

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')

    return https.createServer(secure)
  }

  listen (port) {
    const secure = this.conf.secure
    const socket = this.getSocket(secure)

    const timeout = this.conf.timeout
    if (timeout) {
      socket.setTimeout(timeout)
    }

    socket.on('request', (req, rep) => {
      let body = []

      req.on('data', (chunk) => {
        body.push(chunk)
      }).on('end', () => {
        body = Buffer.concat(body).toString()
        const cert = secure ? req.socket.getPeerCertificate() : undefined
        this.handleRequest(
          {
            reply: (rid, err, res) => {
              this.sendReply(rep, rid, err, res)
            }
          },
          this.parse(body),
          cert
        )
      })
    }).listen(port)

    this.socket = socket
    this.port = port

    return this
  }

  handleRequest (handler, data, cert) {
    if (!data) {
      this.emit('request-error')
      return
    }

    const rid = data[0]
    const key = data[1]
    const payload = data[2]

    this.emit(
      'request', rid, key, payload,
      {
        reply: (err, res) => {
          handler.reply(rid, err, res)
        }
      },
      cert
    )
  }

  unlisten () {
    if (!this.socket) return
    try {
      this.socket.close()
    } catch (e) {}
    this.socket = null
  }

  sendReply (rep, rid, err, res) {
    rep.write(this.format([rid, err ? err.message : null, res]))
    rep.end()
  }

  _stop () {
    super._stop()
    this.unlisten()
  }
}

module.exports = TransportRPCServer
