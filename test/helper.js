'use strict'

const { Grape } = require('grenache-grape')
const async = require('async')

const startGrapes = async () => {
  const grapes = [
    new Grape({
      dht_port: 20002,
      dht_bootstrap: ['127.0.0.1:20001'],
      api_port: 40001
    }),
    new Grape({
      dht_port: 20001,
      dht_bootstrap: ['127.0.0.1:20002'],
      api_port: 30001
    })
  ]

  await async.each(grapes, (grape, next) => {
    grape.start()
    grape.once('ready', () => next())
  })
  return grapes
}

const stopGrapes = async (grapes) => {
  await async.each(grapes, (grape, next) => {
    grape.stop(next)
  })
}

module.exports = {
  startGrapes,
  stopGrapes
}
