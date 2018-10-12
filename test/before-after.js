/* eslint-env mocha */

'use strict'

const { bootTwoGrapes, killGrapes } = require('./helper')

let grapes
function setupHooks (cb) {
  beforeEach(function (done) {
    this.timeout(20000)
    bootTwoGrapes((err, g) => {
      if (err) throw err
      grapes = g
      grapes[0].once('announce', () => {
        done()
      })

      cb()
    })
  })

  afterEach(function (done) {
    this.timeout(5000)
    killGrapes(grapes, done)
  })

  return grapes
}

module.exports = setupHooks
