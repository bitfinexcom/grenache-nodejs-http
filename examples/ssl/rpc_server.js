// make sure you start 2 grapes
// grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
// grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'

'use strict'

const Link = require('grenache-nodejs-link')
const Peer = require('../../').PeerRPCServer
const _ = require('lodash')
const fs = require('fs')
const path = require('path')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const opts = {
  secure: {
    key: fs.readFileSync(path.join(__dirname, 'server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'server-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'ca-crt.pem')),
    requestCert: true,
    rejectUnauthorized: false // take care, can be dangerous in production!
  }
}

const peer = new Peer(
  link,
  opts
)
peer.init()

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_test', service.port, {})
}, 1000)

service.on('request', function (rid, key, payload, handler, cert) {
  console.log(cert.fingerprint)
  handler.reply(null, 'world')
})
