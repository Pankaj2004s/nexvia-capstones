module.exports = { routes: require('./video.routes'), service: require('./video.service'), startWorker: () => require('./video.worker').startWorker() };
