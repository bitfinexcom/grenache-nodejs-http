'use strict'

const uuid = require('uuid')
const request = require('request')
const http = require('http')
const _ = require('lodash')
const Base = require('grenache-nodejs-base')

class Peer extends Base.Peer {
  
  constructor(grape, conf) {
    super(grape, conf)
  }

  parse(data) {
    try {
      data = JSON.parse(data)
    } catch(e) {
      data = null
    }

    return data
  }

  format(data) {
    return JSON.stringify(data)
  }


  transport(data) {
    const transport = super.transport(data)

    transport.set({
      persist: true
    })

    return transport
  }

  _listen(transport, type, port) {
    const socket = http.createServer()

    socket.on('request', (req, rep) => {
      let body = []
      
      req.on('data', (chunk) => {
        body.push(chunk)
      }).on('end', () => {
        body = Buffer.concat(body).toString()

        this.handleRequest({
          reply: (rid, res) => {
            rep.write(this.format([rid, res]))
            rep.end()
          }
        }, this.parse(body))
      })
    }).listen(port)

    transport.set({
      socket: socket,
      port: port
    })
   
    return transport
  }

  _unlisten(transport) {
    if (!transport.socket || !transport.listening) return
    transport.socket.close()
  }

  _connect(transport, type, _dest) {
    const dest = 'http://' + _dest

    transport.set({
      send: (data) => {
        request({
          url: dest,
          body: data,
          method: 'POST'
        }, (err, resp, body) => {
          const data = this.parse(body)
          if (!data) return

          const rid = data[0]
          const res = data[1]

          this.handleReply(rid, res)
        })  
      }
    })

    transport.emit('connect')
  }

  _send(transport, data) {
    transport.send(this.format(data))
  }
}

module.exports = Peer
