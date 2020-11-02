'use strict'

const http = require('http')
const https = require('https')
const zlib = require('zlib')
const assert = require('assert')

const Base = require('grenache-nodejs-base')

class TransportRPCServer extends Base.TransportRPCServer {
  constructor (client, conf) {
    super(client, conf)
    this.conf = conf

    this.init()
    this.disableBuffered = this.conf.disableBuffered || false
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
      const isStream = req.headers['transfer-encoding'] === 'chunked'
      const enc = req.headers['accept-encoding'] || ''
      const isCompress = enc.includes('gzip')

      const cert = secure ? req.socket.getPeerCertificate() : undefined
      const meta = { cert, isStream: isStream, compress: isCompress }

      try {
        if (req.headers._gr) {
          meta.infoHeaders = JSON.parse(req.headers._gr)
        }
      } catch (e) {
        rep.statusCode = 500
        rep.end('[null, "ERR_HEADER_PARSE_GR", null]')
        return
      }

      meta.action = req.headers._a || null

      try {
        meta.args = JSON.parse(req.headers._ar)
      } catch (e) {
        meta.args = {}
      }

      this.emit('stream', req, rep, meta, {
        reply: this.sendReply.bind(this, rep)
      })

      if (this.disableBuffered) return

      this.handleBufferedRequest(req, rep, meta)
    }).listen(port)

    this.socket = socket
    this.port = port

    return this
  }

  handleBufferedRequest (req, rep, meta) {
    const handler = {
      reply: (rid, err, res) => {
        this.sendReply(rep, rid, err, res, meta)
      }
    }

    let body = []

    req.on('data', (chunk) => {
      body.push(chunk)
    }).on('end', async () => {
      body = Buffer.concat(body)

      if (meta.compress) {
        try {
          body = await new Promise((resolve, reject) => {
            zlib.gunzip(body, (err, res) => {
              if (err) {
                return reject(err)
              }

              resolve(res)
            })
          })
        } catch (err) {
          // NOTE: we try keeping the body, since decompression failed
        }
      }

      const data = this.parse(body)

      this.handleRequest(
        handler,
        data,
        meta
      )
    })
  }

  getRidKey (infoHeaders, data) {
    // a stream will supply rid and key via header
    let rid, key

    if (infoHeaders && infoHeaders[0]) {
      rid = infoHeaders[0]
    } else {
      rid = data[0]
    }

    if (infoHeaders && infoHeaders[1]) {
      key = infoHeaders[1]
    } else {
      key = data[1]
    }

    return { rid, key }
  }

  handleRequest (handler, data, meta) {
    if (!data) {
      this.emit('request-error')
      return
    }

    const { infoHeaders } = meta
    const { rid, key } = this.getRidKey(infoHeaders, data)
    const payload = data[2]

    this.emit(
      'request', rid, key, payload,
      {
        reply: (err, res) => {
          handler.reply(rid, err, res)
        }
      },
      meta.cert, // TODO remove compat mode
      meta
    )
  }

  unlisten () {
    if (!this.socket) return
    try {
      this.socket.close()
    } catch (e) {}
    this.socket = null
  }

  async sendReply (rep, rid, err, res, meta) {
    let out = this.format([
      rid, err ? err.message : null,
      res
    ])

    const send = (out) => {
      rep.write(out)
      rep.end()
    }

    if (meta && meta.compress) {
      try {
        out = await new Promise((resolve, reject) => {
          zlib.gzip(out, (err, res) => {
            if (err) {
              return reject(err)
            }

            resolve(res)
          })
        })
      } catch (err) {
        out = this.format([
          rid, err ? err.message : null,
          res
        ])
      }
    }

    send(out)
  }

  _stop () {
    super._stop()
    this.unlisten()
  }
}

module.exports = TransportRPCServer
