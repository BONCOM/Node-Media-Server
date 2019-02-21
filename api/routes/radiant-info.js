const express = require('express');
const serverController = require('../controllers/radiant-info');

module.exports = (context) => {
  let router = express.Router();
  router.get('/', serverController.getInfo.bind(context));
  return router;
};
