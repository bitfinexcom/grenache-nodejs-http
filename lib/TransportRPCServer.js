'use strict'

const http = require('http')
const Base = require('grenache-nodejs-base')

class TransportRPCServer extends Base.TransportRPCServer {
  constructor (client, conf) {
    super(client, conf)

    this._httpKeepAliveAgent = new http.Agent({
      keepAlive: true
    })

    this.init()
  }

  listen (port) {
    const socket = http.createServer()

    socket.on('request', (req, rep) => {
      let body = []

      req.on('data', (chunk) => {
        body.push(chunk)
      }).on('end', () => {
        body = Buffer.concat(body).toString()

        this.handleRequest({
          reply: (rid, res) => {
            this.sendReply(rep, rid, res)
          }
        }, this.parse(body))
      })
    }).listen(port)

    this.socket = socket
    this.port = port

    return this
  }

  unlisten () {
    if (!this.socket) return
    try {
      this.socket.close()
    } catch (e) {}
    this.socket = null
  }

  sendReply (rep, rid, res) {
    rep.write(this.format([rid, res]))
    rep.end()
  }

  _stop () {
    super._stop()
    this.unlisten()
  }
}

module.exports = TransportRPCServer
