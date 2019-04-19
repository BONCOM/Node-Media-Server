const express = require('express');
const serverController = require('../controllers/radiant-info');

module.exports = (context) => {
    let router = express.Router();
    router.get('/', serverController.getVideoUrl.bind(context));
    return router;
};
