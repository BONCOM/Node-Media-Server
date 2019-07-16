const _ = require('lodash');
const chalk = require('chalk');

const winston = require('winston');

const { Loggly } = require('winston-loggly-bulk');

LOG_TYPES = {
  NONE: 0,
  ERROR: 1,
  NORMAL: 2,
  DEBUG: 3,
  FFDEBUG: 4
};

let logType = LOG_TYPES.NORMAL;

const initLoggly = (config) => {

  let tags = [];
  if (_.has(config, 'tags')) {
    tags = config.tags;
  }

  tags.push(process.env.ENV);
  tags.push('NODE_MEDIA_SERVER');

  winston.add(
      new Loggly({
        token: process.env.LOGGLY_TOKEN,
        subdomain: config.subdomain ? config.subdomain : 'radiantorg',
        tags: tags,
        json: config.json ? config.json : true,
        level: process.env.LOGGLY_LOG_LEVEL,
      })
  )
};


const setLogType = (type) => {
  if (typeof type !== 'number') return;

  logType = type;
};

const logTime = () => {
  let nowDate = new Date();
  return nowDate.toLocaleDateString() + ' ' + nowDate.toLocaleTimeString([], { hour12: false });
};

const log = (...args) => {
  if (logType < LOG_TYPES.NORMAL) return;
  winston.log('info', `${logTime()}, ${process.pid}, ${args}`, );
  console.log(logTime(), process.pid, chalk.bold.green('[INFO]'), ...args);
};

const error = (...args) => {
  if (logType < LOG_TYPES.ERROR) return;
  winston.log('error', `${logTime()}, ${process.pid}, ${args}`);
  console.log(logTime(), process.pid, chalk.bold.red('[ERROR]'), ...args);
};

const warn = (...args) => {
  if (logType < LOG_TYPES.ERROR) return;
  winston.log('warn', `${logTime()}, ${process.pid}, ${args}`);
  console.log(logTime(), process.pid, chalk.bold.red('[WARN]'), ...args);
};

const debug = (...args) => {
  if (logType < LOG_TYPES.DEBUG) return;
  winston.log('debug', `${logTime()}, ${process.pid}, ${args}`);
  console.log(logTime(), process.pid, chalk.bold.blue('[DEBUG]'), ...args);
};

const ffdebug = (...args) => {
  if (logType < LOG_TYPES.FFDEBUG) return;
  winston.log('debug', `${logTime()}, ${process.pid}, ${args}`);
  console.log(logTime(), process.pid, chalk.bold.blue('[FFDEBUG]'), ...args);
};

module.exports = {
  LOG_TYPES,
  setLogType,
  initLoggly,
  log, error, debug, ffdebug, warn
};
