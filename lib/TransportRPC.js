'use strict'

const http = require('http')
const request = require('request')
const Base = require('grenache-nodejs-base')

class TransportRPC extends Base.TransportRPC {

  constructor(client, conf) {
    super(client, conf)

    this.init()
  }

  listen(port) {
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

  request(key, payload, opts, cb) { 
    const req = this.newRequest(key, payload, opts, cb)
    this.addRequest(req)
    this.sendRequest(req)
  }

  sendReply(rep, rid, res) {
    rep.write(this.format([rid, res]))
    rep.end()
  }

  sendRequest(req) {
    const dest = `http://${this.conf.dest}`

    request({
      url: dest,
      body: this.format([req.rid, req.key, req.payload]),
      method: 'POST'
    }, (err, resp, body) => {
      const data = this.parse(body)
      if (!data) return

      const [rid, res] = [data[0], data[1]]
      this.handleReply(rid, res)
    })  
  }
}

module.exports = TransportRPC
