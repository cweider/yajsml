/*

  Copyright (C) 2011 Chad Weider

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

*/

var fs = require('fs');
var urlutil = require('url');
var pathutil = require('path');

var fs_client = (new function () {
  var STATUS_MESSAGES = {
    403: '403: Access denied.'
  , 404: '404: File not found.'
  , 405: '405: Only the HEAD or GET methods are allowed.'
  , 500: '500: Error reading file.'
  };

  function request(options, callback) {
    var path = options.path;
    var method = options.method;

    var response = new (require('events').EventEmitter);
    response.setEncoding = function (encoding) {this._encoding = encoding};
    response.statusCode = 504;
    response.headers = {};

    var request = new (require('events').EventEmitter);
    request.end = function () {
      if (options.method != 'HEAD' && options.method != 'GET') {
        response.statusCode = 405;
        response.headers['allow'] = 'HEAD, GET';

        callback(response);
        response.emit('data', STATUS_MESSAGES[response.statusCode])
        response.emit('end');
      } else {
        function head() {
          fs.lstat(path, function (error, stats) {
            if (error) {
              if (error.code == 'ENOENT') {
                response.statusCode = 404;
                fs.stat(pathutil.dirname(path), function (error, stats) {
                  if (!error) {
                    var modifiedLast = new Date(stats.mtime);
                    response.headers['date'] = date.toUTCString();
                    response.headers['last-modified'] =
                        modifiedLast.toUTCString();
                  } else {
                    response.statusCode = 502;
                  }
                  after_head();
                });
              } else if (error.code == 'EACCESS') {
                response.statusCode = 403;
                after_head();
              } else {
                response.statusCode = 502;
                after_head();
              }
            } else if (stats.isFile()) {
              var date = new Date()
              var modifiedLast = new Date(stats.mtime);
              var modifiedSince = (options.headers || {})['if-modified-since'];
              modifiedSince = modifiedSince && new Date(modifiedSince);

              response.headers['date'] = date.toUTCString();
              response.headers['last-modified'] = modifiedLast.toUTCString();

              if (modifiedSince && modifiedLast
                  && modifiedSince >= modifiedLast) {
                response.statusCode = 304;
              } else {
                response.statusCode = 200;
              }
              after_head();
            } else if (stats.isSymbolicLink()) {
              var modifiedLast = new Date(stats.mtime);
              response.headers['date'] = date.toUTCString();
              response.headers['last-modified'] = modifiedLast.toUTCString();

              fs.readLink(path, function (error, linkString) {
                if (!error) {
                  response.statusCode = 307;
                  response.headers['location'] = linkString;
                } else {
                  response.statusCode = 502;
                }
                after_head();
              });
            } else {
              response.statusCode = 404;
              after_head();
            }
          });
        }
        function after_head() {
          if (method == 'HEAD') {
            callback(response);
            response.emit('end');
          } else if (response.statusCode != 200) {
            if (STATUS_MESSAGES[response.statusCode]) {
              response.headers['content-type'] = 'text/plain; charset=utf-8';
            }

            callback(response);
            if (STATUS_MESSAGES[response.statusCode]) {
              response.emit('data', STATUS_MESSAGES[response.statusCode]);
            }
            response.emit('end');
          } else {
            get();
          }
        }
        function get() {
          fs.readFile(path, function (error, text) {
            if (error) {
              if (error.code == 'ENOENT') {
                response.statusCode = 404;
              } else if (error.code == 'EACCESS') {
                response.statusCode = 403;
              } else {
                response.statusCode = 502;
              }
              response.headers['content-type'] = 'text/plain; charset=utf-8';

              callback(response);
              response.emit('data', STATUS_MESSAGES[response.statusCode])
              response.emit('end');
            } else {
              response.statusCode = 200;
              response.headers['content-type'] =
                  'application/javascript; charset=utf-8';

              callback(response);
              response.emit('data', text);
              response.emit('end');
            }
          });
        }
      }

      head();
    };
    return request;
  }
  this.request = request;
}());

/* Retrieve file, http, or https resources. */
function requestURL(url, method, headers, callback) {
  var parsedURL = urlutil.parse(url);
  var client = undefined;
  if (parsedURL.protocol == 'file:') {
    client = fs_client;
  } else if (parsedURL.protocol == 'http:') {
    client = require('http');
  } else if (parsedURL.protocol == 'https:') {
    client = require('https');
  } else {
    throw new Error("No implementation for this resource's protocol");
  }

  var request = client.request({
    host: parsedURL.host
  , port: parsedURL.port
  , path: parsedURL.path
  , method: method
  , headers: headers
  }, function (response) {
    var buffer = undefined;
    response.setEncoding('utf8');
    response.on('data', function (chunk) {
      buffer = buffer || '';
      buffer += chunk;
    });
    response.on('close', function () {
      callback(502, {});
    });
    response.on('end', function () {
      callback(response.statusCode, response.headers, buffer);
    });
  });
  request.on('error', function () {
    callback(502, {});
  });
  request.end();
}

exports.requestURL = requestURL;

