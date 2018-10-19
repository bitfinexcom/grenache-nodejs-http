'use strict'

const Grenache = require('./../')
const Link = require('grenache-nodejs-link')
const Peer = Grenache.PeerRPCServer

const _ = require('lodash')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

const peer = new Peer(link, {
  timeout: 300000,
  disableBuffered: true
})
peer.init()

const service = peer.transport('server')
service.listen(_.random(1000) + 1024)

setInterval(function () {
  link.announce('rpc_stream', service.port, {})
}, 1000)

service.on('stream', (req, res, meta, handler) => {
  console.log(meta) // meta.isStream === true

  const [rid] = meta.infoHeaders

  req.pipe(process.stdout)

  handler.reply(rid, null, 'world') // convenience reply
})
