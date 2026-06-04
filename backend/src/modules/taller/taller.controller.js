const service = require('./taller.service')
const { ok } = require('../../utils/respuesta')

const listar = async (req, res) => ok(res, await service.listar(req.query))
const crear = async (req, res) => ok(res, await service.crear(req.body), 'Ingreso a taller registrado', 201)
const completar = async (req, res) => ok(res, await service.completar(req.params.id, req.body), 'Trabajo de taller completado')

module.exports = { listar, crear, completar }
