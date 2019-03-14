//
//  Created by Mingliang Chen on 18/3/9.
//  illuspas[a]gmail.com
//  Copyright (c) 2018 Nodemedia. All rights reserved.
//
const Logger = require('./node_core_logger');
const { v1 } = require('uuid');
const EventEmitter = require('events');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const mkdirp = require('mkdirp');
const _ = require('lodash');

const fileWatcher = require('./Radiant/fileWatcher');

class NodeTransSession extends EventEmitter {
  constructor(conf) {
    super();
    this.conf = conf;
  }

  run() {
    // console.log('NODE_TRANS_SESSION!');
    const fileName = v1().replace(/-/g, '');
    let vc = this.conf.args.vc == 7 ? 'copy' : 'libx264';
    let ac = this.conf.args.ac == 10 ? 'copy' : 'aac';
    let inPath;
    if(this.conf.auth.play) {
      const keys = _.keys(this.conf.args);
      let urlParams = '';
      _.each(keys, (key,i) => {
        if(key !== 'vc' && key !== 'ac'){
          if(i === keys.length - 3){
            urlParams+= `${key}=${this.conf.args[key]}`;
          } else {
            urlParams+= `${key}=${this.conf.args[key]}&`;
          }
        }
      });
      inPath = `rtmp://127.0.0.1:${this.conf.port}${this.conf.streamPath}?${urlParams}`;
    } else {
      inPath = `rtmp://127.0.0.1:${this.conf.port}${this.conf.streamPath}`;
    }

    let ouPath = `${this.conf.mediaroot}/${this.conf.app}/${this.conf.stream}-${fileName}`;
    let mapStr = '';
    if (this.conf.mp4) {
      this.conf.mp4Flags = this.conf.mp4Flags ? this.conf.mp4Flags : '';
      let mp4FileName = dateFormat('yyyy-mm-dd-HH-MM') + '.mp4';
      let mapMp4 = `${this.conf.mp4Flags}${ouPath}/${mp4FileName}|`;
      mapStr += mapMp4;
      Logger.log('[Transmuxing MP4] ' + this.conf.streamPath + ' to ' + ouPath + '/' + mp4FileName);
    }
    if (this.conf.hls) {
      // GET the Params for the user token so the graphql call works
      this.conf.hlsFlags = this.conf.hlsFlags ? this.conf.hlsFlags : '';
      let hlsFileName = `${fileName}-i.m3u8`;
      let mapHls = `${this.conf.hlsFlags}${ouPath}/${hlsFileName}|`;
      mapStr += mapHls;
      Logger.log('[Transmuxing HLS] ' + this.conf.streamPath + ' to ' + ouPath + '/' + hlsFileName);
      fileWatcher.watch(ouPath, this.conf.args);
    }
    if (this.conf.dash) {
      this.conf.dashFlags = this.conf.dashFlags ? this.conf.dashFlags : '';
      let dashFileName = 'index.mpd';
      let mapDash = `${this.conf.dashFlags}${ouPath}/${dashFileName}`;
      mapStr += mapDash;
      Logger.log('[Transmuxing DASH] ' + this.conf.streamPath + ' to ' + ouPath + '/' + dashFileName);
    }
    mkdirp.sync(ouPath);
    // let argv = ['-y', '-fflags', 'nobuffer', '-analyzeduration', '1000000', '-i', inPath, '-c:v', vc, '-c:a', ac, '-f', 'tee', '-map', '0:a?', '-map', '0:v?', mapStr];
    let argv = ['-y', '-i', inPath, '-c:v', vc, '-c:a', ac, '-f', 'tee', '-map', '0:a?', '-map', '0:v?', mapStr];
    Logger.ffdebug(argv.toString());
    this.ffmpeg_exec = spawn(this.conf.ffmpeg, argv);
    this.ffmpeg_exec.on('error', (e) => {
      Logger.ffdebug(e);
    });

    this.ffmpeg_exec.stdout.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.stderr.on('data', (data) => {
      Logger.ffdebug(`FF输出：${data}`);
    });

    this.ffmpeg_exec.on('close', (code) => {
      Logger.log('[Transmuxing end] ' + this.conf.streamPath);
      fileWatcher.end(ouPath);
      this.emit('end');
    });
  }

  end() {
    // this.ffmpeg_exec.kill('SIGINT');
    this.ffmpeg_exec.stdin.write('q');
  }
}

module.exports = NodeTransSession;