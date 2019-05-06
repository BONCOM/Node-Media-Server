const express = require('express');
const serverController = require('../controllers/radiant-info');

module.exports = (context) => {
    let router = express.Router();
    router.get('/:uuid', serverController.getVideoUrl.bind(context));
    return router;
};
